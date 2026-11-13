// Sky: gradient, moons, stars, volumetric smoke field lit from below, painterly repaint.
(function () {
  'use strict';
  const FS = window.FS;
  const { clamp, sstep, gauss, mix } = FS;

  FS.MOON = { x: 300, y: 2270, r: 335 };
  FS.MOON2 = { x: 100, y: 610, r: 38 };
  // the fire cyclone: axis and radius as a function of height
  FS.CY = { x: 3500, base: 2790, top: 0, eyeY: 430 };
  FS.cyX = (y) => FS.CY.x + 70 * Math.sin(Math.PI * clamp(1 - y / FS.CY.base, 0, 1));
  FS.cyR = (y) => {
    const u = clamp((FS.CY.base - y) / FS.CY.base, 0, 1);
    return 66 + 560 * Math.pow(u, 1.45);
  };
  // smoke sources (burning sites) — x, base y, strength
  FS.SMOKE = [
    { x: 742, y: 2840, s: 0.16, l: 0.7 },
    { x: 1046, y: 2880, s: 0.3, l: 1.2 },
    { x: 1250, y: 2760, s: 0.45, l: 0.8 },
    { x: 1470, y: 2850, s: 0.55, l: 1.3 },
    { x: 1540, y: 2900, s: 0.35, l: 0.6 },
    { x: 1730, y: 2700, s: 0.8, l: 1.0 },
    { x: 2060, y: 2900, s: 0.75, l: 1.4 },
    { x: 2170, y: 2760, s: 0.95, l: 0.75 },
    { x: 2420, y: 2820, s: 1.0, l: 1.1 },
    { x: 2620, y: 2880, s: 1.05, l: 0.9 },
    { x: 2700, y: 2800, s: 0.7, l: 1.5 },
    { x: 2900, y: 2860, s: 0.95, l: 1.2 },
  ]

  let N1, N2, N3;

  // vortex domain twist: smoke spirals into the cyclone
  function twist(x, y) {
    const cx = 3500,
      cy = 700;
    const dx = x - cx,
      dy = (y - cy) * 0.85;
    const rho = Math.hypot(dx, dy);
    const w = sstep(2300, 3300, x) * 1.3 * Math.exp(-rho / 1300);
    const c = Math.cos(w),
      s = Math.sin(w);
    return [cx + dx * c - dy * s, cy + (dx * s + dy * c) / 0.85];
  }

  function density(x, y) {
    const t = x / FS.W;
    let d = 0;
    // --- night strata (left): long horizontal cloud bands
    const nightW = 1 - sstep(0.24, 0.5, t);
    if (nightW > 0) {
      const w = N1.fbm(x * 0.0004, y * 0.0011, 3);
      const c = N1.fbm(x * 0.0007 + w * 0.7, y * 0.0042 + w * 0.35, 5);
      const band = 0.9 * gauss(y, 1330, 190) + 0.7 * gauss(y, 2060, 120) + 0.55 * gauss(y, 430, 140) + 0.3 * gauss(y, 2780, 90);
      d += sstep(0.0, 0.35, c + (band - 0.6) * 0.45) * band * nightW * 1.1;
    }
    // --- smoke columns: billowing plumes, leaning toward the vortex
    let mask = 0;
    for (let k = 0; k < FS.SMOKE.length; k++) {
      const S = FS.SMOKE[k];
      if (y > S.y + 30) continue;
      const rise = Math.max(0, S.y - y);
      const lean = (0.006 + 0.03 * Math.pow(S.x / FS.W, 1.4)) * (S.l || 1);
      const cx = S.x + lean * Math.pow(rise, 1.33) + 80 * N2.n2(k * 7.1, rise * 0.0011);
      const wid = 30 + 50 * S.s + rise * (0.03 + 0.07 * S.s);
      const dx = (x - cx) / wid;
      if (Math.abs(dx) > 2.2) continue;
      const v = S.s * Math.exp(-dx * dx * 1.1) * sstep(-30, 140, rise);
      if (v > mask) mask = v;
    }
    if (mask > 0.01) {
      const b = N2.billow(x * 0.0013, y * 0.0017, 4);
      d += sstep(0.3, 0.75, mask * (0.3 + b * 1.7)) * 1.5;
    }
    // --- smoke ceiling (top), swirling into the vortex on the right
    const pallW = sstep(0.24, 0.55, t);
    if (pallW > 0) {
      const q = twist(x, y);
      const w = N3.fbm(q[0] * 0.0006, q[1] * 0.0009, 3);
      const p = N3.fbm(q[0] * 0.0011 + w * 1.1, q[1] * 0.0019 + w * 0.6, 6);
      const pb = N3.billow(q[0] * 0.0016 + w * 0.8, q[1] * 0.0024, 5);
      d += pallW * sstep(1100, 100, y) * sstep(0.22, 0.48, pb + p * 0.2) * 1.3;
      // low haze above burning districts
      d += pallW * gauss(y, 3060, 150) * clamp(0.25 + p, 0, 1) * 0.45;
    }
    // --- cyclone sheath: dark walls hugging the funnel
    const vw = sstep(2650, 3150, x);
    if (vw > 0 && y < FS.CY.base + 120) {
      const r = FS.cyR(y),
        u = (x - FS.cyX(y)) / r;
      const au = Math.abs(u);
      d += vw * gauss(au, 1.25, 0.22) * sstep(0.12, 0.4, N2.billow(x * 0.0022, y * 0.0018, 4)) * 1.4;
      d *= 1 - vw * 0.9 * sstep(1.08, 0.75, au);
    }
    return Math.max(0, d);
  }

  FS.drawSky = function (g) {
    N1 = FS.makeNoise(FS.seed * 3 + 1);
    N2 = FS.makeNoise(FS.seed * 3 + 2);
    N3 = FS.makeNoise(FS.seed * 3 + 3);
    FS.reset(g);
    const N = Math.min(1000, FS.PX);
    const cell = FS.W / N;
    const GH = Math.ceil((FS.HZ + 40) / cell);
    const D = new Float32Array(N * GH);
    for (let j = 0; j < GH; j++) {
      const y = (j + 0.5) * cell;
      for (let i = 0; i < N; i++) D[j * N + i] = density((i + 0.5) * cell, y);
    }
    if (FS.debugDensity) {
      const im = new ImageData(N, GH);
      for (let i = 0; i < N * GH; i++) {
        const v = Math.min(255, D[i] * 160);
        im.data[i * 4] = v;
        im.data[i * 4 + 1] = v;
        im.data[i * 4 + 2] = v;
        im.data[i * 4 + 3] = 255;
      }
      const c = FS.canvas(N, GH);
      c.getContext('2d').putImageData(im, 0, 0);
      g.drawImage(c, 0, 0, N, GH, 0, 0, FS.W, GH * cell);
      return;
    }
    const bg = new ImageData(N, GH),
      sm = new ImageData(N, GH);
    const A = new Float32Array(N * GH);
    const M = FS.MOON;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * cell;
      const t = x / FS.W;
      const heat = FS.heat(x),
        calm = FS.calm(x);
      const I0 = Math.pow(heat, 1.1) * (0.85 + 0.35 * N2.n2(x * 0.004, 7.7));
      const darkS = mix([20, 24, 50], [17, 11, 10], sstep(0.2, 0.48, t));
      let tau = 0;
      for (let j = GH - 1; j >= 0; j--) {
        const y = (j + 0.5) * cell;
        const id = j * N + i;
        const d = D[id];
        // ---- background sky
        let c = FS.skyAt(x, y);
        // horizon fire glow
        const Eh = Math.pow(heat, 1.2) * (0.75 * Math.exp(-(FS.HZ - y) / 230) + 0.42 * Math.exp(-(FS.HZ - y) / 1100)) * (0.75 + 0.35 * N1.n2(x * 0.003, 3.3));
        c = FS.add(c, FS.mul(FS.fire(0.62 + 0.25 * Eh), Eh * 0.75));
        // moon halo
        const dm = Math.hypot(x - M.x, y - M.y);
        const Em = calm * (Math.exp(-Math.max(0, dm - M.r) / 260) * 0.55 + Math.exp(-Math.max(0, dm - M.r) / 900) * 0.25);
        c = FS.add(c, FS.mul([70, 80, 140], Em));
        const p = id * 4;
        bg.data[p] = c[0];
        bg.data[p + 1] = c[1];
        bg.data[p + 2] = c[2];
        bg.data[p + 3] = 255;
        // ---- smoke
        tau += d * cell * 0.0036;
        const a = 1 - Math.exp(-d * 1.9);
        A[id] = a;
        let L = I0 * Math.exp(-tau) * (0.1 + 0.9 * Math.exp(-(FS.HZ - y) / 1600));
        // cyclone light
        const vw = sstep(2700, 3200, x);
        if (vw > 0 && y < FS.CY.base + 150) {
          const u = Math.abs(x - FS.cyX(y)) / FS.cyR(y);
          L += vw * Math.exp(-Math.max(0, u - 0.8) * 3.5) * 0.9 * sstep(FS.CY.eyeY - 150, FS.CY.eyeY + 250, y);
        }
        // lit undersides of billows: density thinning downward faces the fire
        const dj = Math.max(2, Math.round(36 / cell));
        if (j + dj < GH) {
          const under = clamp((d - D[(j + dj) * N + i]) * 1.6);
          L += under * heat * (0.25 + 0.75 * Math.exp(-(FS.HZ - y) / 1600)) * 0.9;
        }
        L = Math.min(1.6, L);
        const amb = FS.add(darkS, FS.mul([95, 40, 18], 0.36 * heat * (0.4 + 0.6 * Math.exp(-(FS.HZ - y) / 2200))));
        const Lc = Math.min(1, L);
        let litC = FS.mul(FS.fire(0.5 + 0.4 * Lc), 0.3 + 0.75 * Lc);
        const lg = (litC[0] + litC[1] + litC[2]) / 3;
        litC = FS.mix(litC, [lg, lg * 0.9, lg * 0.8], 0.22 * (1 - Lc * 0.8));
        let sc = FS.mix(amb, litC, Math.min(1, L * 1.25));
        if (L > 1) sc = FS.mix(sc, [255, 220, 160], (L - 1) * 0.6);
        // moonlit cloud edges (thin cloud brighter)
        const moonL = calm * (Math.exp(-Math.max(0, dm - M.r) / 380) * 1.1 + 0.18);
        sc = FS.add(sc, FS.mul([110, 120, 175], moonL * (1 - a) * 1.3 + moonL * 0.2));
        sc = FS.add(sc, FS.mul([40, 46, 90], calm * 0.5));
        sm.data[p] = sc[0];
        sm.data[p + 1] = sc[1];
        sm.data[p + 2] = sc[2];
        sm.data[p + 3] = a * 255;
      }
    }
    FS.smokeA = { A, N, GH, cell };
    const cb = FS.canvas(N, GH),
      cs = FS.canvas(N, GH);
    cb.getContext('2d').putImageData(bg, 0, 0);
    cs.getContext('2d').putImageData(sm, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cb, 0, 0, N, GH, 0, 0, FS.W, GH * cell);
    drawStars(g);
    drawMoon(g);
    drawSmallMoon(g, FS.MOON2.x, FS.MOON2.y, FS.MOON2.r, 1);
    g.drawImage(cs, 0, 0, N, GH, 0, 0, FS.W, GH * cell);
    repaint(g);
  };

  FS.smokeAt = (x, y) => {
    const S = FS.smokeA;
    const i = clamp(Math.floor(x / S.cell), 0, S.N - 1),
      j = clamp(Math.floor(y / S.cell), 0, S.GH - 1);
    return S.A[j * S.N + i];
  };

  function drawStars(g) {
    const r = FS.rng('stars');
    g.save();
    for (let k = 0; k < 2600; k++) {
      const x = r.f() * FS.W;
      const y = r.f() * 2900;
      const t = x / FS.W;
      const keep = Math.pow(1 - sstep(0.0, 0.42, t), 1.3) * (1 - sstep(2100, 2900, y) * 0.8);
      if (r.f() > keep) continue;
      if (Math.hypot(x - FS.MOON.x, y - FS.MOON.y) < FS.MOON.r + 30) continue;
      const m = Math.pow(r.f(), 3.2);
      const a = (0.25 + 0.75 * m) * (1 - FS.smokeAt(x, y));
      if (a < 0.05) continue;
      const tint = r.pick([[255, 248, 235], [210, 220, 255], [255, 230, 200], [190, 205, 255]]);
      const rad = 0.9 + m * 2.2;
      g.fillStyle = FS.css(tint, a);
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
      if (m > 0.5) FS.glow(g, x, y, rad * 6, tint, a * 0.3);
      if (m > 0.8) {
        g.strokeStyle = FS.css(tint, a * 0.5);
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(x - rad * 4, y);
        g.lineTo(x + rad * 4, y);
        g.moveTo(x, y - rad * 4);
        g.lineTo(x, y + rad * 4);
        g.stroke();
      }
    }
    g.restore();
  }

  function drawMoon(g) {
    const M = FS.MOON,
      r = FS.rng('moon');
    g.save();
    // outer glow
    FS.glow(g, M.x, M.y, M.r * 1.7, [150, 160, 220], 0.22);
    g.beginPath();
    g.arc(M.x, M.y, M.r, 0, Math.PI * 2);
    g.clip();
    const gr = g.createRadialGradient(M.x - M.r * 0.25, M.y - M.r * 0.3, M.r * 0.1, M.x, M.y, M.r);
    gr.addColorStop(0, '#f4ecdc');
    gr.addColorStop(0.6, '#d9d3cf');
    gr.addColorStop(0.92, '#a9acc8');
    gr.addColorStop(1, '#8a90b8');
    g.fillStyle = gr;
    g.fillRect(M.x - M.r, M.y - M.r, M.r * 2, M.r * 2);
    // maria: soft blotches made of brushy dabs
    const N = FS.makeNoise(FS.seed + 99);
    for (let k = 0; k < 1700; k++) {
      const a = r.f() * Math.PI * 2,
        rr = Math.sqrt(r.f()) * M.r;
      const x = M.x + Math.cos(a) * rr,
        y = M.y + Math.sin(a) * rr;
      const v = N.fbm(x * 0.006, y * 0.006, 4);
      if (v < 0.05) continue;
      const w = 10 + r.f() * 26;
      const gr2 = g.createRadialGradient(x, y, 0, x, y, w);
      gr2.addColorStop(0, FS.css([125, 122, 150], 0.03 + v * 0.12));
      gr2.addColorStop(1, FS.css([125, 122, 150], 0));
      g.fillStyle = gr2;
      g.fillRect(x - w, y - w, 2 * w, 2 * w);
    }
    // a few craters
    for (let k = 0; k < 26; k++) {
      const a = r.f() * Math.PI * 2,
        rr = Math.sqrt(r.f()) * M.r * 0.92;
      const x = M.x + Math.cos(a) * rr,
        y = M.y + Math.sin(a) * rr;
      const cr = 3 + Math.pow(r.f(), 2) * 16;
      g.strokeStyle = 'rgba(110,110,140,0.14)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, cr, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = 'rgba(255,250,240,0.1)';
      g.beginPath();
      g.arc(x + 1, y + 1, cr, -0.3, 1.8);
      g.stroke();
    }
    // limb darkening + a faint warm blush on the lower right (the fire far away)
    const lg = g.createRadialGradient(M.x, M.y, M.r * 0.6, M.x, M.y, M.r);
    lg.addColorStop(0, 'rgba(40,40,90,0)');
    lg.addColorStop(1, 'rgba(40,40,90,0.35)');
    g.fillStyle = lg;
    g.fillRect(M.x - M.r, M.y - M.r, M.r * 2, M.r * 2);
    const wg = g.createLinearGradient(M.x - M.r, M.y - M.r, M.x + M.r, M.y + M.r);
    wg.addColorStop(0.55, 'rgba(255,140,80,0)');
    wg.addColorStop(1, 'rgba(255,140,80,0.22)');
    g.fillStyle = wg;
    g.fillRect(M.x - M.r, M.y - M.r, M.r * 2, M.r * 2);
    g.restore();
  }

  // small ringed moon (also reappears inside the cyclone's eye)
  function drawSmallMoon(g, x, y, r, a) {
    g.save();
    FS.glow(g, x, y, r * 4, [190, 205, 255], 0.28 * a);
    const tilt = -0.32;
    const ring = (front) => {
      g.save();
      g.translate(x, y);
      g.rotate(tilt);
      g.beginPath();
      if (front) g.ellipse(0, 0, r * 1.95, r * 0.42, 0, 0, Math.PI);
      else g.ellipse(0, 0, r * 1.95, r * 0.42, 0, Math.PI, Math.PI * 2);
      g.strokeStyle = `rgba(230,225,255,${0.75 * a})`;
      g.lineWidth = r * 0.12;
      g.stroke();
      g.beginPath();
      if (front) g.ellipse(0, 0, r * 1.62, r * 0.33, 0, 0, Math.PI);
      else g.ellipse(0, 0, r * 1.62, r * 0.33, 0, Math.PI, Math.PI * 2);
      g.strokeStyle = `rgba(200,200,255,${0.45 * a})`;
      g.lineWidth = r * 0.07;
      g.stroke();
      g.restore();
    };
    ring(false);
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, `rgba(255,252,245,${a})`);
    gr.addColorStop(0.7, `rgba(205,210,240,${a})`);
    gr.addColorStop(1, `rgba(120,130,190,${a})`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    // crescent shadow
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = `rgba(20,24,60,${0.55 * a})`;
    g.beginPath();
    g.arc(x + r * 0.55, y + r * 0.25, r * 0.95, 0, Math.PI * 2);
    g.fill();
    g.restore();
    ring(true);
    g.restore();
  }
  FS.drawSmallMoon = drawSmallMoon;

  // flow direction for painterly strokes
  FS.flowAngle = function (x, y) {
    const t = x / FS.W;
    const n = N2.n2(x * 0.0011, y * 0.0011);
    // night: horizontal
    let vx = Math.cos(n * 0.5),
      vy = Math.sin(n * 0.5) * 0.4;
    // smoke: rising, leaning right
    const sw = sstep(0.2, 0.42, t);
    const a2 = -Math.PI / 2 + 0.35 + n * 1.5 + 1.2 * N3.n2(x * 0.004, y * 0.004);
    vx = vx * (1 - sw) + Math.cos(a2) * sw;
    vy = vy * (1 - sw) + Math.sin(a2) * sw;
    // pall near top: drifting toward the vortex
    const pw = sstep(0.3, 0.6, t) * sstep(1700, 500, y);
    vx += pw * 1.1;
    vy += pw * (n * 0.5);
    // vortex: tangential (counter-clockwise on screen) + inward
    const dx = x - 3500,
      dy = (y - 700) * 0.85;
    const rho = Math.hypot(dx, dy) + 1;
    const vwt = sstep(2300, 3200, x) * Math.exp(-rho / 1500) * 2.2;
    vx += vwt * (-dy / rho - 0.35 * dx / rho);
    vy += vwt * (dx / rho - 0.35 * dy / rho);
    return Math.atan2(vy, vx);
  };


  // Painterly repaint: sample the composited sky and lay brush strokes over smoke/cloud.
  function repaint(g) {
    const S = FS.smokeA;
    const SN = 500,
      cell = FS.W / SN;
    const small = FS.canvas(SN, SN);
    const sg = small.getContext('2d');
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(g.canvas, 0, 0, SN, SN);
    const img = sg.getImageData(0, 0, SN, SN).data;
    const sample = (x, y) => {
      const i = clamp(Math.floor(x / cell), 0, SN - 1),
        j = clamp(Math.floor(y / cell), 0, SN - 1);
      const p = (j * SN + i) * 4;
      return [img[p], img[p + 1], img[p + 2]];
    };
    const r = FS.rng('repaint');
    const M = FS.MOON;
    g.save();
    // pass 1: broad strokes, pass 2: finer lit strokes
    const passes = [
      { sp: 20, wmin: 14, wmax: 34, lmin: 26, lmax: 80, a: 0.36, thr: 0.12 },
      { sp: 22, wmin: 5, wmax: 12, lmin: 20, lmax: 55, a: 0.35, thr: 0.3 },
    ];
    for (const P of passes) {
      for (let y = 0; y < FS.HZ - 60; y += P.sp) {
        for (let x = 0; x < FS.W; x += P.sp) {
          const px = x + r.f() * P.sp,
            py = y + r.f() * P.sp;
          const a = FS.smokeAt(px, py);
          if (a < P.thr) continue;
          if (Math.hypot(px - M.x, py - M.y) < M.r + 10 && a < 0.6) continue;
          const c = sample(px, py);
          const lum = (c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15) / 255;
          if (P === passes[1] && lum < 0.12 && r.f() < 0.7) continue;
          const len = P.lmin + r.f() * (P.lmax - P.lmin);
          const w = P.wmin + r.f() * (P.wmax - P.wmin);
          const pts = FS.trace(px, py, len, 7, FS.flowAngle);
          // shift so the stroke is centred on the sample
          const mid = pts[Math.floor(pts.length / 2)];
          const ox = px - mid[0],
            oy = py - mid[1];
          for (const p of pts) {
            p[0] += ox;
            p[1] += oy;
          }
          const k = P === passes[1] ? 0.98 + r.f() * 0.1 : 0.94 + r.f() * 0.12;
          FS.bristle(g, pts, w, FS.mul(c, k), P.a * Math.min(1, a * 1.4), r, { jitter: 0.08, n: Math.max(3, Math.round(w / 4.5)) });
        }
      }
    }
    g.restore();
  }
})();
