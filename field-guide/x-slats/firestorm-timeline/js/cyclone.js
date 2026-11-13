// The fire cyclone (strips 16-20) and the small fire whirl (strip 14).
(function () {
  'use strict';
  const FS = window.FS;
  const { clamp, sstep, mix } = FS;
  const TILT = 0.17;

  // projected helix point
  function hp(V, y, th, rk = 1) {
    const r = V.rF(y) * rk;
    return [V.cxF(y) + r * Math.cos(th), y + r * Math.sin(th) * TILT, Math.sin(th)];
  }

  // brightness profile along the height (0 top .. 1 base)
  function prof(V, y) {
    const u = clamp((y - V.top) / (V.base - V.top));
    return V.profile ? V.profile(u) : 1;
  }

  function core(g, V, r) {
    g.globalCompositeOperation = 'lighter';
    for (let y = V.base; y > V.top; y -= 40) {
      const rr = V.rF(y),
        pr = prof(V, y);
      FS.glow(g, V.cxF(y), y, rr * 1.25, [255, 110, 35], 0.045 * pr * V.intensity, 0.6);
    }
    // incandescent core streaks
    const nS = V.coreStreaks || 60;
    for (let k = 0; k < nS; k++) {
      const off = r.gauss() * 0.22;
      const y0 = V.base - r.f() * (V.base - V.top) * 0.95;
      const len = 80 + r.f() * 380;
      const pts = [];
      for (let y = y0; y > y0 - len && y > V.top; y -= 10) {
        const rr = V.rF(y);
        pts.push([V.cxF(y) + off * rr + Math.sin(y * 0.01 + k) * rr * 0.05, y]);
      }
      if (pts.length < 3) continue;
      const pr = prof(V, y0);
      const w = V.rF(y0) * (0.05 + r.f() * 0.08) + 2;
      FS.bristle(g, pts, w, FS.fire(0.8 + 0.2 * r.f()), 0.11 * pr * V.intensity * (1 - Math.min(1, Math.abs(off) * 1.5)), r, { jitter: 0.1 });
    }
    g.globalCompositeOperation = 'source-over';
  }

  function stairs(g, V, r, side) {
    // a staircase of flame spiralling up around the funnel
    const turns = V.stairTurns;
    const omega = (turns * Math.PI * 2) / (V.base - 120 - V.eye);
    const steps = [];
    const dth = 0.125;
    for (let th = 0; ; th += dth) {
      const y = V.base - 120 - th / omega;
      if (y < V.eye + 60) break;
      const rk = 1.14;
      const p = hp(V, y, th + 1.2, rk);
      steps.push({ x: p[0], y: p[1], z: p[2], th: th + 1.2, yy: y });
    }
    FS.stairSteps = steps;
    // the stringer: a dark spine under the steps
    {
      let seg = [];
      const flush = () => {
        if (seg.length > 2) {
          const rr = V.rF(seg[0][2]);
          g.strokeStyle = side === 'front' ? 'rgba(30,10,6,0.85)' : 'rgba(60,20,10,0.4)';
          g.lineWidth = 5 + rr * 0.03;
          g.lineJoin = 'round';
          g.beginPath();
          g.moveTo(seg[0][0], seg[0][1]);
          for (const p of seg) g.lineTo(p[0], p[1]);
          g.stroke();
        }
        seg = [];
      };
      for (const s of steps) {
        const front = s.z > 0;
        if ((side === 'front') === front) seg.push([s.x, s.y + 8 + V.rF(s.yy) * 0.03, s.yy]);
        else flush();
      }
      flush();
    }
    for (const s of steps) {
      const front = s.z > 0;
      if ((side === 'front') !== front) continue;
      const rr = V.rF(s.yy) * 1.14;
      // tangent on screen
      const tx = -Math.sin(s.th),
        ty = Math.cos(s.th) * TILT;
      const tl = Math.hypot(tx, ty);
      const ux = tx / tl,
        uy = ty / tl;
      const sw = (18 + rr * 0.1) * (0.5 + 0.5 * Math.abs(s.z) + (front ? 0 : -0.1));
      const th = 6 + rr * 0.022;
      const zz = Math.abs(s.z);
      if (front) {
        // flame licks from the step
        g.globalCompositeOperation = 'lighter';
        FS.glow(g, s.x, s.y - th, sw * 1.4, [255, 130, 40], 0.18 + 0.2 * zz, 0.7);
        for (let k = 0; k < 3; k++) {
          FS.tongue(g, s.x + (r.f() - 0.5) * sw * 0.8, s.y - th * 0.5, sw * (0.5 + r.f() * 0.7), sw * 0.35, {
            sway: 3,
            phase: r.f() * 6,
            lean: 0.15,
            c0: [255, 230, 150],
            c1: [255, 140, 40],
            c2: [200, 50, 10],
            baseA: 0.1,
            alpha: 0.55 * (0.4 + 0.6 * zz),
          });
        }
        g.globalCompositeOperation = 'source-over';
      }
      // the slab: lit top, dark riser
      g.beginPath();
      g.moveTo(s.x - ux * sw / 2, s.y - uy * sw / 2);
      g.lineTo(s.x + ux * sw / 2, s.y + uy * sw / 2);
      g.lineTo(s.x + ux * sw / 2, s.y + uy * sw / 2 + th);
      g.lineTo(s.x - ux * sw / 2, s.y - uy * sw / 2 + th);
      g.closePath();
      g.fillStyle = front ? FS.css([40, 16, 10], 0.95) : FS.css([60, 22, 12], 0.5);
      g.fill();
      g.lineWidth = Math.max(1.5, th * 0.45);
      g.strokeStyle = front ? FS.css(FS.fire(0.8 + 0.15 * zz), 0.95) : FS.css(FS.fire(0.5), 0.45);
      g.beginPath();
      g.moveTo(s.x - ux * sw / 2, s.y - uy * sw / 2);
      g.lineTo(s.x + ux * sw / 2, s.y + uy * sw / 2);
      g.stroke();
    }
  }

  // band brightness on the front surface: u = screen offset (-1..1) from axis
  function surf(V, y, u, N) {
    const omega = (V.turns * Math.PI * 2) / (V.base - V.top);
    const z = Math.sqrt(Math.max(0, 1 - u * u));
    const th = Math.acos(clamp(u, -1, 1));
    const ph = V.K * (th - omega * (V.base - y)) + 1.3 * N.n2(y * 0.003, u * 0.8);
    const b = 0.5 + 0.5 * Math.cos(ph);
    const n = N.n2(y * 0.006 + 9, u * 1.5);
    const pr = prof(V, y);
    const temp = pr * (0.2 + 0.33 * Math.pow(z, 0.6) + 0.4 * b * (0.35 + 0.65 * z)) * (0.88 + 0.2 * n);
    return { z, b, temp };
  }

  function body(g, V, N) {
    const step = 3;
    for (let y = V.top; y <= V.base; y += step) {
      const cx = V.cxF(y),
        rr = V.rF(y);
      const gr = g.createLinearGradient(cx - rr * 1.12, 0, cx + rr * 1.12, 0);
      const NS = 20;
      for (let i = 0; i <= NS; i++) {
        const u = -1.12 + (2.24 * i) / NS;
        const au = Math.abs(u);
        let col, a;
        if (au >= 1) {
          col = FS.fire(0.3);
          a = 0.5 * (1 - (au - 1) / 0.12) * V.intensity;
        } else {
          const S = surf(V, y, u, N);
          col = FS.fire(S.temp);
          if (S.b < 0.3 && V.smokeA) col = mix(col, V.smokeCol || [40, 16, 10], ((0.3 - S.b) / 0.3) * 0.75 * V.smokeA * (0.4 + 0.6 * S.z));
          a = (0.55 + 0.45 * S.z) * V.intensity;
        }
        gr.addColorStop(i / NS, FS.css(col, a * (V.fadeTop ? sstep(V.top, V.top + V.fadeTop, y) : 1)));
      }
      g.fillStyle = gr;
      g.fillRect(cx - rr * 1.12, y, rr * 2.24, step + 0.8);
    }
  }

  function surfaceStrokes(g, V, N, r, count) {
    const omega = (V.turns * Math.PI * 2) / (V.base - V.top);
    for (let k = 0; k < count; k++) {
      const y0 = V.top + r.f() * (V.base - V.top);
      if (V.fadeTop && r.f() > sstep(V.top, V.top + V.fadeTop, y0)) continue;
      const u0 = (r.f() * 2 - 1) * 0.97;
      let th = Math.acos(u0);
      const pts = [];
      const len = 6 + Math.floor(r.f() * 12);
      const dth = 0.05 + r.f() * 0.04;
      let y = y0;
      for (let s = 0; s < len; s++) {
        if (th > Math.PI - 0.05 || y < V.top) break;
        pts.push([V.cxF(y) + V.rF(y) * Math.cos(th), y]);
        th += dth;
        y -= dth / omega;
      }
      if (pts.length < 3) continue;
      const S = surf(V, y0, u0, N);
      const bright = S.b > 0.55;
      let col = FS.fire(S.temp * (bright ? 1.08 : 0.92) + (r.f() - 0.5) * 0.08);
      if (!bright && S.b < 0.3 && V.smokeA) col = mix(col, [34, 14, 10], 0.6 * V.smokeA);
      const w = V.rF(y0) * (0.04 + r.f() * 0.09) + 2;
      if (bright) g.globalCompositeOperation = 'lighter';
      FS.bristle(g, pts, w, col, bright ? 0.16 : 0.55, r, { jitter: 0.14 });
      g.globalCompositeOperation = 'source-over';
    }
  }

  function edgeFlames(g, V, r, count) {
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < count; k++) {
      const y = V.top + 40 + r.f() * (V.base - V.top - 80);
      const s = r.sign();
      const rr = V.rF(y);
      const x = V.cxF(y) + s * rr * (0.92 + r.f() * 0.1);
      const pr = prof(V, y);
      FS.tongue(g, x, y, rr * (0.25 + r.f() * 0.5) + 10, rr * (0.08 + r.f() * 0.1) + 4, {
        sway: rr * 0.06,
        phase: r.f() * 6,
        lean: s * (0.7 + r.f() * 0.6),
        c0: FS.fire(0.8),
        c1: FS.fire(0.6),
        c2: FS.fire(0.35),
        baseA: 0,
        alpha: 0.35 * pr * V.intensity,
      });
    }
    g.globalCompositeOperation = 'source-over';
  }

  FS.drawVortex = function (g, V, rname) {
    const r = FS.rng(rname);
    const N = FS.makeNoise(FS.seed * 23 + rname.length);
    FS.reset(g);
    g.save();
    if (V.stairTurns) stairs(g, V, r, 'back');
    body(g, V, N);
    surfaceStrokes(g, V, N, r, V.strokes || 1200);
    core(g, V, r);
    edgeFlames(g, V, r, V.edge || 120);
    if (V.stairTurns) stairs(g, V, r, 'front');
    g.restore();
  };

  FS.drawCyclone = function (g) {
    const V = {
      cxF: FS.cyX,
      rF: FS.cyR,
      base: FS.CY.base,
      top: FS.CY.eyeY,
      eye: FS.CY.eyeY,
      turns: 1.6,
      K: 3,
      strokes: 2600,
      edge: 160,
      intensity: 1,
      smokeA: 1,
      stairTurns: 3.5,
      coreStreaks: 110,
      profile: (u) => 0.74 + 0.3 * u + 0.22 * Math.exp(-u * 10),
    };
    FS.reset(g);
    // big back-glow
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, 3500, 1600, 1100, [255, 110, 30], 0.18, 1.6);
    FS.glow(g, 3500, 2800, 420, [255, 170, 70], 0.35, 1.0);
    g.globalCompositeOperation = 'source-over';
    FS.drawVortex(g, V, 'cyclone');
    drawEyeInterior(g);
    drawEyeRim(g);
    drawDebrisAndEmbers(g);
  };

  function eyeGeom() {
    const y = FS.CY.eyeY;
    const rx = FS.cyR(y) * 0.98;
    return { x: FS.cyX(y), y, rx, ry: rx * TILT * 1.35 };
  }

  function drawEyeInterior(g) {
    const E = eyeGeom();
    const r = FS.rng('eye');
    g.save();
    g.beginPath();
    g.ellipse(E.x, E.y, E.rx, E.ry, 0, 0, Math.PI * 2);
    g.clip();
    const gr = g.createRadialGradient(E.x, E.y - E.ry * 0.3, 10, E.x, E.y, E.rx);
    gr.addColorStop(0, '#0a1036');
    gr.addColorStop(0.55, '#141448');
    gr.addColorStop(0.85, '#3a1e4e');
    gr.addColorStop(1, '#a04a2a');
    g.fillStyle = gr;
    g.fillRect(E.x - E.rx, E.y - E.ry, E.rx * 2, E.ry * 2);
    // the far inner wall of the throat, lined with fire, falling away into the night
    const wg = g.createLinearGradient(0, E.y - E.ry, 0, E.y + E.ry * 0.2);
    wg.addColorStop(0, 'rgba(255,150,60,0.85)');
    wg.addColorStop(0.25, 'rgba(190,60,20,0.55)');
    wg.addColorStop(0.6, 'rgba(60,20,40,0.0)');
    g.fillStyle = wg;
    g.fillRect(E.x - E.rx, E.y - E.ry, E.rx * 2, E.ry * 1.3);
    for (let k = 0; k < 60; k++) {
      const a = Math.PI * (1.05 + r.f() * 0.9);
      const pts = [];
      for (let u = 0; u < 1; u += 0.1) pts.push([E.x + Math.cos(a + u * 0.25) * E.rx * (1 - u * 0.45), E.y + Math.sin(a + u * 0.25) * E.ry * (1 - u * 0.6)]);
      FS.bristle(g, pts, 6 + r.f() * 10, FS.fire(0.55 + r.f() * 0.3), 0.3, r);
    }
    // stars of the calm night from strip 1
    for (let k = 0; k < 260; k++) {
      const a0 = r.f() * Math.PI * 2,
        rr0 = Math.sqrt(r.f()) * 0.72;
      const x = E.x + Math.cos(a0) * E.rx * rr0,
        y = E.y + 6 + Math.sin(a0) * E.ry * rr0 * 0.8;
      const m = Math.pow(r.f(), 3);
      g.fillStyle = FS.css(r.pick([[255, 250, 240], [200, 215, 255]]), 0.4 + 0.6 * m);
      g.beginPath();
      g.arc(x, y, 0.8 + m * 2.2, 0, Math.PI * 2);
      g.fill();
      if (m > 0.6) FS.glow(g, x, y, 10, [210, 220, 255], 0.3);
    }
    // a faint aurora swirl
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 14; k++) {
      const pts = [];
      const a0 = r.f() * Math.PI * 2;
      const rk = 0.3 + r.f() * 0.6;
      for (let a = a0; a < a0 + 1.6; a += 0.08) pts.push([E.x + Math.cos(a) * E.rx * rk, E.y + Math.sin(a) * E.ry * rk]);
      FS.bristle(g, pts, 10, [70, 90, 200], 0.12, r);
    }
    g.globalCompositeOperation = 'source-over';
    FS.drawSmallMoon(g, FS.safeX(E.x, 40), E.y - 8, 24, 1);
    g.restore();
  }

  function drawEyeRim(g) {
    const E = eyeGeom();
    const r = FS.rng('eyerim');
    g.save();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, E.x, E.y, E.rx * 1.2, [255, 120, 40], 0.14, 0.4);
    // rim of fire: irregular, hot spots, front (lower) half brighter
    const N = FS.makeNoise(FS.seed * 29);
    g.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 90; k++) {
      const a0 = r.f() * Math.PI * 2,
        span = 0.15 + r.f() * 0.45;
      const pts = [];
      const rk = 0.96 + r.f() * 0.12;
      for (let a = a0; a < a0 + span; a += 0.025) pts.push([E.x + Math.cos(a) * E.rx * rk, E.y + Math.sin(a) * E.ry * rk]);
      const front = Math.sin(a0 + span / 2) > 0;
      const hot = 0.5 + 0.5 * N.n2(Math.cos(a0) * 2, Math.sin(a0) * 2);
      FS.bristle(g, pts, (front ? 16 : 9) + hot * 18, FS.fire(0.45 + hot * 0.35 + (front ? 0.1 : 0)), 0.55, r, { hue: FS.fire(0.9) });
    }
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 30; k++) {
      const a0 = r.f() * Math.PI * 2,
        span = 0.1 + r.f() * 0.25;
      const hot = 0.5 + 0.5 * N.n2(Math.cos(a0) * 2, Math.sin(a0) * 2);
      if (hot < 0.45) continue;
      const pts = [];
      for (let a = a0; a < a0 + span; a += 0.025) pts.push([E.x + Math.cos(a) * E.rx, E.y + Math.sin(a) * E.ry]);
      FS.bristle(g, pts, 8 + hot * 10, [255, 225, 160], 0.35, r);
    }
    // flames licking outward over the rim
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 90; k++) {
      const a = r.f() * Math.PI * 2;
      const x = E.x + Math.cos(a) * E.rx,
        y = E.y + Math.sin(a) * E.ry;
      if (Math.sin(a) > 0.3) continue;
      const h = 60 + r.f() * 160;
      FS.tongue(g, x, y, h, 18 + r.f() * 30, {
        sway: 14,
        phase: r.f() * 6,
        lean: Math.cos(a) * 0.5,
        c0: [255, 200, 110],
        c1: [240, 90, 20],
        c2: [140, 30, 8],
        baseA: 0.1,
        alpha: 0.35,
      });
    }
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }

  function drawDebrisAndEmbers(g) {
    const r = FS.rng('debris');
    g.save();
    // debris on helical orbits: roof tiles, stones, pages
    for (let k = 0; k < 170; k++) {
      const y = 500 + r.f() * 2400;
      const th = r.f() * Math.PI * 2;
      const rk = 1.15 + r.f() * 0.6;
      const p = hp({ cxF: FS.cyX, rF: FS.cyR }, y, th, rk);
      if (p[0] < 2900 || p[0] > 4000) continue;
      const sz = 3 + Math.pow(r.f(), 2.5) * 22;
      g.save();
      g.translate(p[0], p[1]);
      g.rotate(r.f() * 6.28);
      const page = r.f() < 0.25;
      g.fillStyle = page ? FS.css([255, 210, 150], 0.85) : FS.css([24, 10, 8], 0.92);
      g.beginPath();
      if (page) g.rect(-sz * 0.4, -sz * 0.3, sz * 0.8, sz * 0.6);
      else {
        g.moveTo(-sz / 2, -sz * 0.2);
        g.lineTo(sz * 0.4, -sz * 0.4);
        g.lineTo(sz / 2, sz * 0.3);
        g.lineTo(-sz * 0.3, sz * 0.4);
      }
      g.fill();
      if (!page) {
        g.strokeStyle = FS.css([255, 140, 50], 0.6);
        g.lineWidth = 1.2;
        g.stroke();
      }
      g.restore();
    }
    // embers spiralling upward
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 1300; k++) {
      const y = 350 + r.f() * 2700;
      const th = r.f() * Math.PI * 2;
      const rk = 0.9 + r.f() * 1.0;
      const V = { cxF: FS.cyX, rF: FS.cyR };
      const p = hp(V, y, th, rk);
      const q = hp(V, y - 6, th + 0.06 + r.f() * 0.05, rk);
      if (p[0] < 2700) continue;
      const qd = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const len = 4 + r.f() * 16;
      const x2 = p[0] + ((q[0] - p[0]) / qd) * len,
        y2 = p[1] + ((q[1] - p[1]) / qd) * len;
      const c = FS.fire(0.75 + r.f() * 0.25);
      g.strokeStyle = FS.css(c, 0.4 + 0.5 * r.f());
      g.lineWidth = 1 + r.f() * 2.2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(p[0], p[1]);
      g.lineTo(x2, y2);
      g.stroke();
    }
    g.restore();
  }

  // fire whirl in strip 14
  FS.drawFireWhirl = function (g) {
    const X = 2700,
      base = 3230,
      top = 2350;
    const V = {
      cxF: (y) => X + 22 * Math.sin((base - y) * 0.006),
      rF: (y) => 14 + 52 * Math.pow((base - y) / (base - top), 1.3),
      base,
      top,
      turns: 2.2,
      K: 2,
      strokes: 260,
      edge: 30,
      intensity: 1.05,
      smokeA: 0.7,
      coreStreaks: 30,
      fadeTop: 260,
      profile: (u) => 0.4 + 0.6 * u,
    };
    FS.reset(g);
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, X, 2950, 260, [255, 120, 30], 0.3, 1.6);
    g.globalCompositeOperation = 'source-over';
    FS.drawVortex(g, V, 'whirl');
  };
})();
