// THE PHOENIX UNFOLDS — hand-placed micro-stories (one per strip), ember rain, stairway, liquid light.
(function (G) {
  const PU = G.PU;
  const { lerp, clamp, smooth } = PU;
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------- figures
  // Poses in unit coords (height 1, feet at y=0, up is negative). Each limb is a polyline.
  const POSES = {
    stand: { head: [0, -0.9], torso: [[0, -0.8], [0, -0.47]], arms: [[[-0.08, -0.77], [-0.11, -0.6], [-0.1, -0.45]], [[0.08, -0.77], [0.11, -0.6], [0.1, -0.45]]], legs: [[[-0.04, -0.47], [-0.05, -0.24], [-0.06, 0]], [[0.04, -0.47], [0.05, -0.24], [0.06, 0]]] },
    point: { head: [0.01, -0.9], torso: [[0, -0.8], [0, -0.47]], arms: [[[0.07, -0.78], [0.2, -0.95], [0.3, -1.12]], [[-0.07, -0.77], [-0.1, -0.6], [-0.08, -0.46]]], legs: [[[-0.04, -0.47], [-0.05, -0.24], [-0.06, 0]], [[0.04, -0.47], [0.05, -0.24], [0.07, 0]]] },
    reachUp: { head: [0, -0.9], torso: [[0, -0.8], [0, -0.47]], arms: [[[0.07, -0.78], [0.12, -0.98], [0.14, -1.15]], [[-0.07, -0.78], [-0.13, -0.96], [-0.12, -1.12]]], legs: [[[-0.04, -0.47], [-0.06, -0.24], [-0.08, 0]], [[0.04, -0.47], [0.06, -0.24], [0.08, 0]]] },
    offer: { head: [0.02, -0.9], torso: [[0, -0.8], [0.01, -0.47]], arms: [[[0.07, -0.78], [0.2, -0.75], [0.33, -0.8]], [[-0.07, -0.77], [-0.1, -0.6], [-0.09, -0.46]]], legs: [[[-0.04, -0.47], [-0.05, -0.24], [-0.06, 0]], [[0.04, -0.47], [0.05, -0.24], [0.06, 0]]] },
    kneel: { head: [0.06, -0.62], torso: [[0.04, -0.52], [-0.02, -0.25]], arms: [[[0.07, -0.5], [0.15, -0.4], [0.2, -0.36]], [[0.0, -0.5], [0.08, -0.38], [0.18, -0.34]]], legs: [[[-0.02, -0.25], [0.14, -0.2], [0.14, 0]], [[-0.02, -0.25], [-0.04, -0.02], [-0.22, 0]]] },
    climb: { head: [0.04, -0.9], torso: [[0.02, -0.8], [-0.02, -0.47]], arms: [[[0.07, -0.78], [0.16, -0.85], [0.22, -0.92]], [[-0.05, -0.77], [0.02, -0.62], [0.1, -0.6]]], legs: [[[-0.03, -0.47], [0.1, -0.36], [0.1, -0.12]], [[0.0, -0.47], [-0.04, -0.24], [-0.1, 0]]] },
    ladder: { head: [0.05, -0.9], torso: [[0.02, -0.8], [0, -0.47]], arms: [[[0.07, -0.78], [0.18, -0.92], [0.24, -1.05]], [[-0.04, -0.77], [0.06, -0.66], [0.1, -0.62]]], legs: [[[-0.02, -0.47], [0.06, -0.33], [0.04, -0.18]], [[0.02, -0.47], [0.0, -0.24], [0.02, 0]]] },
    bow: { head: [0.12, -0.72], torso: [[0.08, -0.65], [-0.02, -0.45]], arms: [[[0.07, -0.63], [0.14, -0.45], [0.2, -0.33]], [[0.02, -0.62], [0.08, -0.44], [0.12, -0.3]]], legs: [[[-0.03, -0.45], [-0.04, -0.24], [-0.05, 0]], [[0.0, -0.45], [0.03, -0.24], [0.05, 0]]] },
    violin: { head: [-0.02, -0.9], torso: [[0, -0.8], [0, -0.47]], arms: [[[-0.07, -0.78], [-0.1, -0.72], [-0.04, -0.82]], [[0.07, -0.78], [0.18, -0.7], [0.26, -0.74]]], legs: [[[-0.04, -0.47], [-0.05, -0.24], [-0.07, 0]], [[0.04, -0.47], [0.07, -0.24], [0.1, 0]]] },
    pull: { head: [0, -0.9], torso: [[0, -0.8], [0.01, -0.47]], arms: [[[0.06, -0.78], [0.1, -0.95], [0.12, -1.08]], [[-0.06, -0.78], [-0.02, -0.92], [0.06, -1.0]]], legs: [[[-0.04, -0.47], [-0.06, -0.24], [-0.08, 0]], [[0.04, -0.47], [0.05, -0.24], [0.06, 0]]] },
    hold: { head: [0, -0.9], torso: [[0, -0.8], [0, -0.47]], arms: [[[0.07, -0.78], [0.12, -0.62], [0.1, -0.56]], [[-0.07, -0.78], [-0.02, -0.62], [0.06, -0.56]]], legs: [[[-0.04, -0.47], [-0.05, -0.24], [-0.06, 0]], [[0.04, -0.47], [0.05, -0.24], [0.06, 0]]] },
    sit: { head: [0.02, -0.66], torso: [[0.02, -0.56], [0, -0.26]], arms: [[[0.06, -0.54], [0.14, -0.4], [0.2, -0.3]], [[-0.04, -0.54], [0.06, -0.4], [0.16, -0.32]]], legs: [[[0, -0.26], [0.2, -0.26], [0.22, 0]], [[0, -0.26], [0.18, -0.22], [0.2, 0]]] },
    scope: { head: [0.1, -0.86], torso: [[0.06, -0.77], [0, -0.47]], arms: [[[0.1, -0.74], [0.2, -0.8], [0.27, -0.88]], [[0.04, -0.74], [0.14, -0.72], [0.22, -0.8]]], legs: [[[-0.03, -0.47], [-0.05, -0.24], [-0.07, 0]], [[0.02, -0.47], [0.04, -0.24], [0.06, 0]]] },
    hug: { head: [0.05, -0.9], torso: [[0.02, -0.8], [0, -0.47]], arms: [[[0.07, -0.78], [0.14, -0.66], [0.2, -0.7]], [[-0.04, -0.78], [0.06, -0.68], [0.16, -0.66]]], legs: [[[-0.04, -0.47], [-0.05, -0.24], [-0.06, 0]], [[0.04, -0.47], [0.05, -0.24], [0.06, 0]]] },
  };

  function figure(ctx, x, y, h, pose, o = {}) {
    const P = POSES[pose];
    const fx = o.flip ? -1 : 1;
    const T = (p) => ({ x: x + p[0] * h * fx, y: y + p[1] * h });
    const draw = (col, dx, dy, grow) => {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // torso
      const n = T(P.torso[0]),
        hp = T(P.torso[1]);
      ctx.lineWidth = h * 0.15 + grow;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.lineTo(hp.x, hp.y);
      ctx.stroke();
      if (o.robe) {
        ctx.beginPath();
        ctx.moveTo(n.x - h * 0.08 - grow / 2, n.y + h * 0.05);
        ctx.lineTo(n.x + h * 0.08 + grow / 2, n.y + h * 0.05);
        ctx.lineTo(x + h * 0.15 * (o.robeW || 1) + grow / 2, y + grow / 2);
        ctx.lineTo(x - h * 0.15 * (o.robeW || 1) - grow / 2, y + grow / 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.lineWidth = h * 0.055 + grow;
      for (const limb of P.arms.concat(o.robe && pose !== 'kneel' ? [] : P.legs)) {
        ctx.beginPath();
        limb.forEach((p, i) => {
          const q = T(p);
          i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
        });
        ctx.stroke();
      }
      if (o.robe && pose === 'kneel') {
        /* legs already drawn */
      }
      const hd = T(P.head);
      ctx.beginPath();
      ctx.arc(hd.x, hd.y, h * 0.075 + grow / 2, 0, TAU);
      ctx.fill();
      if (o.hood) {
        ctx.beginPath();
        ctx.moveTo(hd.x - h * 0.09, hd.y + h * 0.06);
        ctx.quadraticCurveTo(hd.x - h * 0.1, hd.y - h * 0.12, hd.x + h * 0.02 * fx, hd.y - h * 0.11);
        ctx.quadraticCurveTo(hd.x + h * 0.1, hd.y - h * 0.06, hd.x + h * 0.09, hd.y + h * 0.06);
        ctx.fill();
      }
      if (o.hair) {
        ctx.beginPath();
        ctx.moveTo(hd.x - h * 0.06 * fx, hd.y - h * 0.03);
        ctx.quadraticCurveTo(hd.x - h * 0.14 * fx, hd.y + h * 0.1, hd.x - h * 0.08 * fx, hd.y + h * 0.18);
        ctx.lineWidth = h * 0.05 + grow;
        ctx.stroke();
      }
      if (o.extra) o.extra(ctx, T, grow);
      ctx.restore();
    };
    // rim light: warm copy offset toward the light, then the dark figure
    const L = o.light || [-1, -1];
    const rimC = o.rim || 'rgba(255,150,70,0.9)';
    draw(rimC, L[0] * h * 0.03, L[1] * h * 0.03, h * 0.012);
    draw(o.col || '#070308', 0, 0, 0);
    return T;
  }
  PU.figure = figure;

  function glowDot(ctx, x, y, r, c, a) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, PU.rgba(c, a));
    gr.addColorStop(0.3, PU.rgba(c, a * 0.4));
    gr.addColorStop(1, PU.rgba(c, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  PU.glowDot = glowDot;

  function emberBird(ctx, x, y, s, ang, heat, a = 1) {
    // a tiny bird made of flame: gull-like M of swept wings, glowing body, short trail
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.max(-0.5, Math.min(0.5, Math.sin(ang) * 0.5)));
    const flip = Math.cos(ang) < 0 ? -1 : 1;
    ctx.scale(flip, 1);
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, 0, 0, s * 2.6, PU.fire(heat * 0.8), 0.3 * a);
    ctx.fillStyle = PU.rgba(PU.fire(heat), 0.95 * a);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.15);
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.75, -s * 1.5, -s * 0.35);
    ctx.quadraticCurveTo(-s * 0.7, -s * 0.45, -s * 0.15, s * 0.3);
    ctx.lineTo(s * 0.15, s * 0.3);
    ctx.quadraticCurveTo(s * 0.7, -s * 0.45, s * 1.5, -s * 0.35);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.75, 0, s * 0.15);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.05, s * 0.2, s * 0.32, s * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PU.rgba(PU.fire(heat * 0.85), 0.35 * a);
    ctx.lineWidth = s * 0.22;
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, s * 0.25);
    ctx.quadraticCurveTo(-s * 1.2, s * 0.5, -s * 2.6, s * 0.4);
    ctx.stroke();
    ctx.restore();
  }
  PU.emberBird = emberBird;

  // ------------------------------------------------------------- in the sky (before clouds & city)
  // STRIPS 1–3 — a feather of the left wing becomes a river of fire meandering down the sky to the horizon
  PU.renderStoriesSky = function (ctx, S, seed, g) {
    const rng = PU.rngFor(seed, 'river');
    const noise = PU.makeNoise(PU.hashStr(seed + 'river'));
    const ft = featherTip(g, -1, 150, 300);
    const p0 = ft ? ft.tip : { x: 222, y: 1040 };
    const ctrl = [
      { x: p0.x, y: p0.y - 40 },
      { x: p0.x + 30, y: p0.y + 150 },
      { x: 300, y: 1330 },
      { x: 238, y: 1470 },
      { x: 300, y: 1610 },
      { x: 390, y: 1700 },
      { x: 330, y: 1880 },
      { x: 268, y: 2010 },
      { x: 360, y: 2160 },
      { x: 420, y: 2300 },
      { x: 392, y: 2470 },
      { x: 455, y: 2700 },
    ];
    const path = PU.resample(PU.catmull(ctrl, 20), 260);
    const W = (t) => lerp(120, 22, Math.pow(t, 0.75)) * (1 + 0.25 * Math.sin(t * 23));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // soft halo lighting the smoke around it
    {
      const H = PU.layer(S * 0.25);
      const hc = H.ctx;
      hc.strokeStyle = 'rgba(255,120,40,0.5)';
      hc.lineCap = 'round';
      hc.lineJoin = 'round';
      hc.lineWidth = 120;
      PU.poly(hc, path);
      hc.stroke();
      PU.blitScaled(ctx, PU.blurred(H, 1, 70), 'lighter', 0.45);
    }
    // the wing's feather tips converge and pour into the river's head
    for (const tip of [{ x: 211, y: 890 }, { x: 236, y: 921 }, { x: 140, y: 980 }, { x: 300, y: 960 }]) {
      for (let k = 0; k < 8; k++) {
        ctx.strokeStyle = PU.rgba(PU.fire(rng.r(0.6, 0.9)), rng.r(0.06, 0.15));
        ctx.lineWidth = rng.r(2, 6);
        ctx.beginPath();
        ctx.moveTo(tip.x + rng.r(-15, 15), tip.y);
        ctx.quadraticCurveTo(tip.x + rng.r(-10, 30), (tip.y + path[6].y) / 2, path[6].x + rng.r(-20, 20), path[6].y);
        ctx.stroke();
      }
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const o = rng.r(-0.5, 0.5);
      const t0 = rng.r(0, 0.5),
        t1 = Math.min(1, t0 + rng.r(0.15, 0.6));
      const heat = rng.r(0.6, 0.92) - Math.abs(o) * 0.3;
      ctx.strokeStyle = PU.rgba(PU.fire(heat), rng.r(0.06, 0.16));
      ctx.lineWidth = rng.r(2, 7);
      ctx.beginPath();
      for (let k = 0; k <= 80; k++) {
        const t = lerp(t0, t1, k / 80);
        const p = PU.at(path, t);
        const w = W(t);
        const x = p.x + p.nx * o * w + 3 * noise.n(i, t * 12),
          y = p.y + p.ny * o * w;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // a bright current down the middle, with glints like light on moving water
    for (let i = 0; i < 60; i++) {
      const t = rng.r(0, 1);
      const p = PU.at(path, t);
      const w = W(t);
      const x = p.x + p.nx * rng.r(-0.3, 0.3) * w,
        y = p.y + p.ny * rng.r(-0.3, 0.3) * w;
      ctx.strokeStyle = PU.rgba(PU.fire(rng.r(0.85, 1)), 0.5);
      ctx.lineWidth = rng.r(1.5, 3);
      ctx.beginPath();
      ctx.moveTo(x - p.tx * w * 0.4, y - p.ty * w * 0.4);
      ctx.lineTo(x + p.tx * w * 0.4, y + p.ty * w * 0.4);
      ctx.stroke();
    }
    // embers lifting off its banks
    for (let i = 0; i < 0; i++) {
      const t = rng.r(0.02, 0.85);
      const p = PU.at(path, t);
      const sgn = rng.chance(0.5) ? 1 : -1;
      const w = W(t) / 2;
      PU.flameLick(ctx, noise, rng, p.x + p.nx * sgn * w, p.y + p.ny * sgn * w, -Math.PI / 2 + rng.r(-0.5, 0.5), rng.r(20, 60) * (1 - t * 0.6), w * 0.6, 0.85, 0.22, 0.12);
    }
    for (let i = 0; i < 70; i++) {
      const t = rng.r(0, 0.9);
      const p = PU.at(path, t);
      glowDot(ctx, p.x + rng.r(-60, 60), p.y - rng.r(0, 80), rng.r(2, 5), PU.fire(rng.r(0.7, 1)), 0.7);
    }
    ctx.restore();
  };

  // ------------------------------------------------------------- behind the mid city
  function featherTip(g, side, xmin, xmax) {
    let best = null;
    for (const f of g.feathers) {
      if (f.kind !== 'flight' || f.side !== side) continue;
      const t = f.c[f.c.length - 1];
      if (t.x < xmin || t.x > xmax) continue;
      if (f.special) return { f, tip: t };
      if (!best || t.y > best.tip.y) best = { f, tip: t };
    }
    return best;
  }
  PU.featherTip = featherTip;

  PU.renderStoriesBehindMid = function (ctx, S, seed, g) {
    const rng = PU.rngFor(seed, 'stair');
    const noise = PU.makeNoise(PU.hashStr(seed + 'stair'));
    // STRIP 8 — a feather of fire becomes a stairway down to a rooftop
    const LM = PU.LM;
    const ft = featherTip(g, -1, 1440, 1560);
    const top = ft ? { x: ft.tip.x, y: ft.tip.y - 30 } : { x: 1500, y: 1980 };
    const bot = { x: LM.stairTower.cx - 20, y: LM.stairTower.top - 4 };
    // a spiral stair of fire winding down from the feather tip (helix seen slightly from above)
    const turns = 1.7,
      nSteps = 30,
      th0 = 0.6;
    const Ry = 0.3;
    const stepAt = (t) => {
      const th = th0 + t * turns * TAU;
      const R = lerp(86, 52, t);
      const ax = lerp(top.x, bot.x, t),
        ay = lerp(top.y + 30, bot.y - 10, t);
      return { th, R, ax, ay };
    };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // the feather's flame pours down into the stair
    glowDot(ctx, top.x, top.y, 120, [255, 150, 60], 0.3);
    for (let k = 0; k < 16; k++) {
      ctx.strokeStyle = PU.rgba(PU.fire(rng.r(0.7, 0.95)), rng.r(0.06, 0.16));
      ctx.lineWidth = rng.r(2, 6);
      const s0 = stepAt(0);
      ctx.beginPath();
      ctx.moveTo(top.x + rng.r(-20, 20), top.y - 70);
      ctx.quadraticCurveTo(top.x + rng.r(-30, 30), top.y, s0.ax + Math.sin(s0.th) * s0.R * rng.r(0, 1), s0.ay + Math.cos(s0.th) * s0.R * Ry);
      ctx.stroke();
    }
    // central spine of light (the feather's shaft)
    const sg = ctx.createLinearGradient(0, top.y, 0, bot.y);
    sg.addColorStop(0, 'rgba(255,220,150,0.55)');
    sg.addColorStop(1, 'rgba(255,140,60,0.15)');
    ctx.strokeStyle = sg;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y + 20);
    ctx.lineTo(bot.x, bot.y);
    ctx.stroke();
    const steps = [];
    for (let i = 0; i < nSteps; i++) steps.push(i);
    // draw back steps first, then front steps
    const drawStep = (i) => {
      const t = i / nSteps;
      const st = stepAt(t);
      const dth = ((turns * TAU) / nSteps) * 0.82;
      const front = Math.cos(st.th + dth / 2);
      const heat = 0.86 - t * 0.22;
      const vis = (0.55 + 0.45 * front) * (0.95 - t * 0.3);
      // tread: elliptical sector
      ctx.fillStyle = PU.rgba(PU.fire(Math.min(1, heat + 0.03 * front)), 0.75 * vis);
      ctx.beginPath();
      ctx.moveTo(st.ax, st.ay);
      for (let k = 0; k <= 8; k++) {
        const th = st.th + (dth * k) / 8;
        ctx.lineTo(st.ax + Math.sin(th) * st.R, st.ay + Math.cos(th) * st.R * Ry);
      }
      ctx.closePath();
      ctx.fill();
      // riser on the outer rim for steps facing us
      if (front > -0.1) {
        const rh = 12;
        const gr = ctx.createLinearGradient(0, st.ay, 0, st.ay + st.R * Ry + rh * 2);
        gr.addColorStop(0, PU.rgba(PU.fire(heat * 0.82), 0.65 * vis));
        gr.addColorStop(1, PU.rgba(PU.fire(heat * 0.4), 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) {
          const th = st.th + (dth * k) / 8;
          ctx.lineTo(st.ax + Math.sin(th) * st.R, st.ay + Math.cos(th) * st.R * Ry);
        }
        for (let k = 8; k >= 0; k--) {
          const th = st.th + (dth * k) / 8;
          ctx.lineTo(st.ax + Math.sin(th) * st.R, st.ay + Math.cos(th) * st.R * Ry + rh * 2);
        }
        ctx.closePath();
        ctx.fill();
        // drips of liquid light from the rim
        const th = st.th + dth * rng.r(0.2, 0.8);
        const dx = st.ax + Math.sin(th) * st.R,
          dy = st.ay + Math.cos(th) * st.R * Ry + rh;
        const dl = rng.r(8, 40);
        ctx.strokeStyle = PU.rgba(PU.fire(heat * 0.85), 0.3 * vis);
        ctx.lineWidth = rng.r(1.2, 2.2);
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx, dy + dl);
        ctx.stroke();
        glowDot(ctx, dx, dy + dl + 3, 4, PU.fire(heat), 0.5 * vis);
        if (i % 3 === 0) PU.flameLick(ctx, noise, rng, dx, st.ay - 2, -Math.PI / 2 + rng.r(-0.3, 0.3), rng.r(14, 28), 8, heat, 0.28 * vis, 0.1);
      }
      glowDot(ctx, st.ax + Math.sin(st.th) * st.R * 0.6, st.ay, 60, PU.fire(heat * 0.75), 0.12 * vis);
      return st;
    };
    const backs = steps.filter((i) => Math.cos(stepAt(i / nSteps).th) < 0);
    const fronts = steps.filter((i) => Math.cos(stepAt(i / nSteps).th) >= 0);
    for (const i of backs) drawStep(i);
    for (const i of fronts) drawStep(i);
    ctx.restore();
    // the climber, on a front step a third of the way down, carrying a lantern
    let ci = fronts.find((i) => i >= 9) || fronts[0];
    const st = stepAt(ci / nSteps);
    const th = st.th + 0.25;
    const cx = st.ax + Math.sin(th) * st.R * 0.6,
      cy = st.ay + Math.cos(th) * st.R * Ry * 0.6;
    figure(ctx, cx, cy, 54, 'climb', { rim: 'rgba(255,215,150,0.95)', light: [0.5, -1] });
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, cx + 54 * 0.22, cy - 54 * 0.92, 18, [255, 210, 140], 0.8);
    ctx.restore();
  };

  // ------------------------------------------------------------- after the mid city (before water)
  PU.renderStoriesAfterMid = function (ctx, S, seed, g) {
    const rng = PU.rngFor(seed, 'aftermid');
    const noise = PU.makeNoise(PU.hashStr(seed + 'aftermid'));
    const LM = PU.LM;
    ctx.save();
    // STRIP 13 — light that falls like liquid: a feather tip pours molten gold into the canal
    {
      const ft = featherTip(g, 1, 2400, 2620);
      const xt = ft ? ft.tip.x : 2505,
        y0 = ft ? ft.tip.y - 40 : 1760;
      const xb = LM.fall.x,
        y1 = PU.QUAY + 24;
      const X = (t) => lerp(xt, xb, smooth(0, 0.5, t)) + 7 * Math.sin(t * 9) * (1 - t);
      ctx.globalCompositeOperation = 'lighter';
      // soft glow column
      for (let k = 0; k < 24; k++) {
        const t = k / 23;
        glowDot(ctx, X(t), lerp(y0, y1, t), 110 - 40 * t, [255, 140, 50], 0.07);
      }
      const strands = 48;
      for (let i = 0; i < strands; i++) {
        const o = rng.g() * 0.5;
        const t0 = rng.r(0, 0.08);
        const t1 = rng.chance(0.35) ? rng.r(0.5, 0.95) : 1;
        const heat = rng.r(0.72, 1.0);
        ctx.strokeStyle = PU.rgba(PU.fire(heat), rng.r(0.08, 0.26));
        ctx.lineWidth = rng.r(1.2, 4);
        ctx.beginPath();
        for (let k = 0; k <= 70; k++) {
          const t = lerp(t0, t1, k / 70);
          const y = lerp(y0, y1, t);
          // pours wide from the feather, narrows like honey as it accelerates
          const wid = 70 * (1 - t) * (1 - t) + 14;
          const x = X(t) + o * wid + 4 * noise.n(i * 0.37, y * 0.006);
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      // bright pulses travelling down the stream
      for (let i = 0; i < 9; i++) {
        const t = rng.r(0.1, 0.95);
        glowDot(ctx, X(t), lerp(y0, y1, t), rng.r(10, 20), [255, 225, 160], 0.5);
      }
      // droplets peeling off in the lower half
      for (let i = 0; i < 46; i++) {
        const t = rng.r(0.35, 1);
        const y = lerp(y0, y1, t);
        const x = X(t) + rng.g() * 16 * t;
        glowDot(ctx, x, y, rng.r(3, 7), PU.fire(rng.r(0.8, 1)), 0.6);
      }
      // pool of light and splash crown at the bottom
      glowDot(ctx, xb, y1 - 6, 130, [255, 160, 70], 0.4);
      glowDot(ctx, xb, y1 - 6, 34, [255, 240, 200], 0.8);
      for (let i = 0; i < 22; i++) {
        const a = -Math.PI / 2 + rng.r(-1.25, 1.25);
        const len = rng.r(16, 54);
        ctx.strokeStyle = PU.rgba(PU.fire(rng.r(0.8, 1)), 0.45);
        ctx.lineWidth = rng.r(1.2, 2.6);
        ctx.beginPath();
        ctx.moveTo(xb, y1 - 6);
        ctx.quadraticCurveTo(xb + Math.cos(a) * len, y1 - 6 + Math.sin(a) * len, xb + Math.cos(a) * len * 1.5, y1 - 6 + Math.sin(a) * len * 0.5 + 18);
        ctx.stroke();
      }
    }
    // STRIP 7 — embers turn into a flock of tiny birds circling the great spire
    {
      const cx = LM.mainSpire.cx,
        cy = LM.mainSpire.top + 120;
      for (let i = 0; i < 26; i++) {
        const t = i / 26;
        const a = t * TAU * 1.6 + rng.r(-0.2, 0.2);
        const rad = 40 + t * 70;
        const x = cx + Math.cos(a) * rad * 0.9;
        const y = cy - 180 + t * 260 + Math.sin(a) * rad * 0.35;
        if (t < 0.35) {
          // still embers
          ctx.globalCompositeOperation = 'lighter';
          glowDot(ctx, x, y, 7, PU.fire(0.9), 0.8);
        } else emberBird(ctx, x, y, 7 + t * 9, a + Math.PI / 2 + rng.r(-0.3, 0.3), 0.8, 0.6 + 0.4 * t);
      }
    }
    // STRIP 9 — sky lanterns rising from a roof toward the bird
    {
      const lx = LM.lanternRoof.x;
      const ls = [
        { x: lx + 30, y: LM.lanternRoof.y - 120, s: 1 },
        { x: lx - 30, y: 2560, s: 0.8 },
        { x: lx + 40, y: 2330, s: 0.65 },
        { x: lx - 10, y: 2140, s: 0.5 },
        { x: lx + 50, y: 1990, s: 0.4 },
      ];
      for (const L of ls) lantern(ctx, L.x, L.y, L.s);
    }
    // STRIP 16 — an ember-bird alighting on the slender spire
    emberBird(ctx, LM.slimSpire.cx + 2, LM.slimSpire.top - 46, 13, -0.4, 1, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, LM.slimSpire.cx, LM.slimSpire.top - 30, 70, [255, 150, 60], 0.35);
    ctx.restore();
    ctx.restore();
  };

  function lantern(ctx, x, y, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, x, y, 60 * s, [255, 150, 60], 0.45);
    ctx.globalCompositeOperation = 'source-over';
    const gr = ctx.createLinearGradient(x, y - 22 * s, x, y + 18 * s);
    gr.addColorStop(0, '#ffcf80');
    gr.addColorStop(0.7, '#ff8a2a');
    gr.addColorStop(1, '#a8320c');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x - 11 * s, y - 20 * s);
    ctx.lineTo(x + 11 * s, y - 20 * s);
    ctx.lineTo(x + 8 * s, y + 16 * s);
    ctx.lineTo(x - 8 * s, y + 16 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,230,0.9)';
    ctx.fillRect(x - 4 * s, y + 10 * s, 8 * s, 5 * s);
    ctx.restore();
  }

  // ------------------------------------------------------------- the front: people, ember rain
  PU.renderStoriesFront = function (ctx, S, seed, g, city) {
    const rng = PU.rngFor(seed, 'front');
    const noise = PU.makeNoise(PU.hashStr(seed + 'front'));
    const LM = PU.LM;
    const Q = PU.QUAY;
    ctx.save();

    // STRIP 1 — the lamplighter on his ladder
    {
      const px = LM.lamp.x,
        top = Q - 190;
      ctx.fillStyle = '#060307';
      ctx.fillRect(px - 3, top, 6, Q - top);
      ctx.fillRect(px - 9, Q - 14, 18, 14);
      // lantern head
      ctx.beginPath();
      ctx.moveTo(px - 14, top);
      ctx.lineTo(px + 14, top);
      ctx.lineTo(px + 9, top - 30);
      ctx.lineTo(px - 9, top - 30);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px - 12, top - 30);
      ctx.lineTo(px, top - 44);
      ctx.lineTo(px + 12, top - 30);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, px, top - 15, 110, [255, 160, 70], 0.55);
      glowDot(ctx, px, top - 15, 20, [255, 240, 200], 1);
      ctx.globalCompositeOperation = 'source-over';
      // ladder
      ctx.strokeStyle = '#080408';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(px - 70, Q);
      ctx.lineTo(px - 10, top + 10);
      ctx.moveTo(px - 50, Q);
      ctx.lineTo(px + 6, top + 14);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      for (let t = 0.08; t < 1; t += 0.11) {
        ctx.beginPath();
        ctx.moveTo(lerp(px - 70, px - 10, t), lerp(Q, top + 10, t));
        ctx.lineTo(lerp(px - 50, px + 6, t), lerp(Q, top + 14, t));
        ctx.stroke();
      }
      figure(ctx, px - 30, lerp(Q, top + 10, 0.42), 74, 'ladder', { light: [1, -0.6], rim: 'rgba(255,190,110,0.95)' });
      // his lighting pole touching the lamp, a tiny flame at its tip
      ctx.strokeStyle = '#080408';
      ctx.lineWidth = 2;
      const hy = lerp(Q, top + 10, 0.42) - 74 * 1.05;
      ctx.beginPath();
      ctx.moveTo(px - 30 + 74 * 0.24, hy);
      ctx.lineTo(px - 4, top - 18);
      ctx.stroke();
    }

    // STRIP 2 — a small boat with a lantern on the river
    {
      const bx = 316,
        by = 3600;
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, bx + 40, by - 60, 120, [255, 160, 70], 0.35);
      // lantern reflection on the water
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = `rgba(255,170,80,${0.35 - i * 0.03})`;
        ctx.fillRect(bx + 40 - rng.r(4, 14), by + 20 + i * 14, rng.r(8, 28), 3);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#05030a';
      ctx.beginPath();
      ctx.moveTo(bx - 80, by - 10);
      ctx.quadraticCurveTo(bx - 60, by + 18, bx, by + 18);
      ctx.quadraticCurveTo(bx + 60, by + 18, bx + 86, by - 14);
      ctx.lineTo(bx + 70, by - 4);
      ctx.lineTo(bx - 66, by - 2);
      ctx.closePath();
      ctx.fill();
      // warm rim on the gunwale
      ctx.strokeStyle = 'rgba(255,160,80,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx - 78, by - 10);
      ctx.lineTo(bx + 84, by - 14);
      ctx.stroke();
      figure(ctx, bx - 20, by - 4, 52, 'sit', { flip: true, hood: true, light: [1, -1] });
      // oar
      ctx.strokeStyle = '#05030a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx - 30, by - 22);
      ctx.lineTo(bx - 110, by + 26);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + 40, by - 8);
      ctx.lineTo(bx + 40, by - 70);
      ctx.lineTo(bx + 52, by - 76);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, bx + 52, by - 66, 16, [255, 230, 170], 1);
      // oar ripples
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(160,140,190,0.25)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.ellipse(bx - 110, by + 28, 14 * i, 4 * i, 0, 0, TAU);
        ctx.stroke();
      }
    }

    // STRIP 3 — the astronomer has swung her telescope from the moon to the phoenix's eye
    {
      const x = LM.obs.cx - 46,
        y = LM.obs.balcony;
      const h = 56;
      const pivot = { x: x + 30, y: y - 46 };
      const ang = Math.atan2(PU.EYE.y - pivot.y, PU.EYE.x - pivot.x);
      // tripod
      ctx.strokeStyle = '#070308';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(pivot.x - 14, y);
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(pivot.x + 14, y);
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(pivot.x + 2, y);
      ctx.stroke();
      // tube
      ctx.save();
      ctx.translate(pivot.x, pivot.y);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255,170,90,0.9)';
      ctx.fillRect(-30, -8, 104, 2.5);
      ctx.fillStyle = '#070308';
      ctx.beginPath();
      ctx.moveTo(-30, -4);
      ctx.lineTo(70, -7);
      ctx.lineTo(70, 7);
      ctx.lineTo(-30, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(64, -9, 10, 18);
      ctx.restore();
      figure(ctx, x, y, h, 'scope', { robe: true, hair: true, light: [0.6, -1], rim: 'rgba(255,190,120,0.9)' });
      // a little brass lamp and the open star-book on the balustrade
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x - 26, y - 24, 30, [255, 170, 90], 0.55);
      glowDot(ctx, x - 26, y - 24, 4, [255, 240, 200], 1);
      // dome slit lit from inside
      ctx.fillStyle = 'rgba(255,190,110,0.8)';
      ctx.fillRect(LM.obs.cx + 6, LM.obs.dome - 26, 6, 36);
      ctx.globalCompositeOperation = 'source-over';
    }

    // STRIP 4 — under the moon, a cat sits in a lit tower window and watches the sky; a gargoyle leans out above
    {
      const wx = 700,
        wy = 2760;
      ctx.fillStyle = '#060307';
      PU.archPath(ctx, wx, wy - 52, 58, 96);
      ctx.fill();
      const wg = ctx.createLinearGradient(0, wy - 46, 0, wy + 40);
      wg.addColorStop(0, '#ffd890');
      wg.addColorStop(1, '#ff9a40');
      ctx.fillStyle = wg;
      PU.archPath(ctx, wx, wy - 46, 46, 86);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, wx, wy, 90, [255, 160, 70], 0.45);
      ctx.globalCompositeOperation = 'source-over';
      // sill
      ctx.fillStyle = '#060307';
      ctx.fillRect(wx - 34, wy + 38, 68, 7);
      // the cat (sitting on the sill, head turned up toward the moon)
      const cx = wx + 4,
        cy = wy + 38;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 15, 10, 16, -0.08, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 2, cy - 33, 8, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 37);
      ctx.lineTo(cx - 5, cy - 47);
      ctx.lineTo(cx + 1, cy - 40);
      ctx.moveTo(cx + 3, cy - 40);
      ctx.lineTo(cx + 9, cy - 47);
      ctx.lineTo(cx + 10, cy - 36);
      ctx.fill();
      ctx.strokeStyle = '#060307';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); // tail curling over the sill edge
      ctx.moveTo(cx - 8, cy - 3);
      ctx.quadraticCurveTo(cx - 26, cy + 2, cx - 24, cy + 20);
      ctx.stroke();
      // the window's cross mullion behind the cat
      ctx.fillStyle = 'rgba(40,12,6,0.6)';
      ctx.fillRect(wx - 1.5, wy - 44, 3, 30);
      // gargoyle under the parapet, leaning out toward the bird
      const gx = 742,
        gy = 2470;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.scale(0.8, 0.8);
      ctx.fillStyle = '#0b0610';
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.lineTo(40, -10);
      ctx.quadraticCurveTo(58, -18, 62, -4);
      ctx.lineTo(54, 2);
      ctx.lineTo(60, 10);
      ctx.lineTo(40, 6);
      ctx.lineTo(20, 16);
      ctx.lineTo(-10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,90,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(40, -10);
      ctx.quadraticCurveTo(58, -18, 62, -4);
      ctx.stroke();
      ctx.restore();
    }

    // STRIP 5 — the monk rings the bell in the open belfry
    {
      const bx = LM.belfry.cx,
        fy = LM.belfry.floor - 12;
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, bx, fy - 40, 70, [255, 160, 70], 0.45);
      ctx.globalCompositeOperation = 'source-over';
      // bell
      const by = fy - 92;
      ctx.fillStyle = '#0a0508';
      ctx.beginPath();
      ctx.moveTo(bx - 8, by - 22);
      ctx.quadraticCurveTo(bx - 16, by - 20, bx - 18, by);
      ctx.quadraticCurveTo(bx - 20, by + 16, bx - 28, by + 22);
      ctx.lineTo(bx + 28, by + 22);
      ctx.quadraticCurveTo(bx + 20, by + 16, bx + 18, by);
      ctx.quadraticCurveTo(bx + 16, by - 20, bx + 8, by - 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(bx - 34, by - 28, 68, 5);
      ctx.strokeStyle = 'rgba(255,190,110,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx + 9, by - 20);
      ctx.quadraticCurveTo(bx + 17, by - 18, bx + 18, by);
      ctx.quadraticCurveTo(bx + 20, by + 16, bx + 28, by + 22);
      ctx.stroke();
      // rope
      ctx.strokeStyle = '#0a0508';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx + 6, by + 20);
      ctx.quadraticCurveTo(bx + 14, by + 40, bx + 10, fy - 54);
      ctx.stroke();
      figure(ctx, bx + 4, fy, 50, 'pull', { robe: true, hood: true, light: [1, -0.5], rim: 'rgba(255,170,90,0.9)' });
      // sound: faint arcs of light
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 3; i++) {
        ctx.strokeStyle = `rgba(255,190,120,${0.18 / i})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, 40 + i * 22, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx, by, 40 + i * 22, Math.PI - 0.6, Math.PI + 0.6);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // STRIP 6 — a child on a balcony points at the sky; a lit doorway behind
    {
      const x = LM.balcony.x,
        y = LM.balcony.y;
      ctx.fillStyle = '#ffb35c';
      PU.archPath(ctx, x - 20, y - 74, 30, 74);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x - 20, y - 36, 70, [255, 150, 60], 0.5);
      ctx.globalCompositeOperation = 'source-over';
      figure(ctx, x - 22, y, 62, 'stand', { robe: true, robeW: 0.8, light: [-0.4, -1] }); // parent
      figure(ctx, x + 14, y, 38, 'point', { light: [0.5, -1], rim: 'rgba(255,200,130,0.95)' }); // child
      // railing over them
      ctx.fillStyle = '#060307';
      for (let xx = x - 36; xx <= x + 36; xx += 8) ctx.fillRect(xx, y - 18, 2.5, 18);
      ctx.fillRect(x - 38, y - 20, 76, 3);
    }

    // STRIP 9 — the woman who released the lantern
    figure(ctx, LM.lanternRoof.x + 6, LM.lanternRoof.y - 10, 60, 'reachUp', { robe: true, hair: true, light: [0.2, -1] });

    // STRIP 10 — a pilgrim kneels at the river steps with a candle
    {
      const x = LM.steps.x,
        y = Q;
      ctx.fillStyle = '#060307';
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 70 + i * 6, y + i * 7, 140 - i * 12, 8);
      figure(ctx, x - 10, y, 58, 'kneel', { robe: true, hood: true, light: [0, -1] });
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x + 2, y - 24, 40, [255, 170, 80], 0.6);
      glowDot(ctx, x + 2, y - 24, 6, [255, 245, 210], 1);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(255,180,90,${0.3 - i * 0.04})`;
        ctx.fillRect(x - 4 - rng.r(0, 6), y + 40 + i * 16, rng.r(6, 18), 2.5);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // STRIP 11 — a paper boat with a candle drifts over the reflected (blue, unburned) eye
    {
      const x = 2100,
        y = 3470;
      ctx.fillStyle = 'rgba(230,220,210,0.9)';
      ctx.beginPath();
      ctx.moveTo(x - 26, y - 8);
      ctx.lineTo(x + 26, y - 8);
      ctx.lineTo(x + 16, y + 4);
      ctx.lineTo(x - 16, y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(190,170,165,0.95)';
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 8);
      ctx.lineTo(x + 2, y - 30);
      ctx.lineTo(x + 12, y - 8);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x + 2, y - 36, 34, [255, 170, 80], 0.6);
      glowDot(ctx, x + 2, y - 36, 5, [255, 250, 220], 1);
      ctx.fillStyle = 'rgba(255,190,110,0.25)';
      ctx.fillRect(x - 6, y + 10, 14, 3);
      ctx.fillRect(x - 3, y + 20, 9, 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(200,190,220,0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 44, 6, 0, 0, TAU);
      ctx.stroke();
    }

    // STRIP 12 — lovers on the bridge, a lamp beside them
    {
      const y = LM.bridge.deck;
      const x = 2296;
      ctx.fillStyle = '#060307';
      ctx.fillRect(2356, y - 120, 5, 120);
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, 2358, y - 128, 60, [255, 170, 80], 0.6);
      glowDot(ctx, 2358, y - 128, 9, [255, 245, 215], 1);
      ctx.globalCompositeOperation = 'source-over';
      figure(ctx, x - 12, y, 64, 'hug', { light: [0.8, -0.6] });
      figure(ctx, x + 14, y, 58, 'hug', { flip: true, robe: true, robeW: 0.7, hair: true, light: [0.8, -0.6] });
    }

    // STRIP 14 — on the cathedral parapet, someone catches a falling ember
    {
      const x = LM.rightCath.cx - 60,
        y = LM.rightCath.parapet - 10;
      figure(ctx, x, y, 56, 'offer', { robe: true, light: [-0.6, -1] });
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x + 56 * 0.33, y - 56 * 0.92, 26, [255, 170, 70], 0.8);
      glowDot(ctx, x + 56 * 0.33, y - 56 * 0.92, 4, [255, 250, 220], 1);
      ctx.globalCompositeOperation = 'source-over';
      // rose window
      roseWindow(ctx, LM.rightCath.rose.x, LM.rightCath.rose.y, 50);
    }

    // STRIP 15 — a violinist plays to the falling fire
    {
      const x = LM.violinRoof.x,
        y = LM.violinRoof.y - 10;
      figure(ctx, x, y, 62, 'violin', {
        light: [-0.5, -1],
        extra: (c, T, grow) => {
          const a = T([-0.08, -0.8]);
          c.save();
          c.translate(a.x, a.y);
          c.rotate(0.5);
          c.beginPath();
          c.ellipse(0, 0, 9 + grow, 5 + grow, 0, 0, TAU);
          c.fill();
          c.restore();
          c.lineWidth = 1.5 + grow;
          c.beginPath();
          const b0 = T([0.26, -0.74]);
          c.moveTo(b0.x - 30, b0.y - 18);
          c.lineTo(b0.x + 14, b0.y + 8);
          c.stroke();
        },
      });
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x + 40, y - 8, 30, [255, 170, 80], 0.5);
      ctx.globalCompositeOperation = 'source-over';
    }

    // STRIP 17 — a girl with an umbrella in the ember rain
    {
      const x = LM.umbrellaRoof.x,
        y = LM.umbrellaRoof.y - 10;
      figure(ctx, x, y, 48, 'hold', { robe: true, robeW: 0.75, light: [0, -1] });
      ctx.strokeStyle = '#070308';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 26);
      ctx.lineTo(x + 6, y - 78);
      ctx.stroke();
      ctx.fillStyle = '#0a0508';
      ctx.beginPath();
      ctx.moveTo(x - 42, y - 66);
      ctx.quadraticCurveTo(x + 6, y - 112, x + 54, y - 66);
      for (let k = 0; k < 6; k++) ctx.quadraticCurveTo(x + 54 - k * 16 - 8, y - 72, x + 54 - (k + 1) * 16, y - 66);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,180,90,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 40, y - 68);
      ctx.quadraticCurveTo(x + 6, y - 112, x + 52, y - 68);
      ctx.stroke();
      // embers bouncing off the umbrella as sparks
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) {
        const side = rng.chance(0.5) ? -1 : 1;
        const sx = x + 6 + side * rng.r(20, 46),
          sy = y - 84 + Math.abs(sx - x - 6) * 0.5;
        const ex = sx + side * rng.r(10, 30),
          ey = sy + rng.r(6, 26);
        ctx.strokeStyle = PU.rgba(PU.fire(rng.r(0.75, 1)), 0.55);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + side * 6, sy - rng.r(8, 16), ex, ey);
        ctx.stroke();
        glowDot(ctx, ex, ey, 4, PU.fire(0.9), 0.8);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // STRIP 13 (cont.) — the liquid light seen through the bridge arch, splashing into the canal
    {
      const br = LM.bridge;
      const aw = (br.x1 - br.x0) / 2;
      const ax = br.x0 + aw * 1.5,
        r = (aw * 0.8) / 2,
        ay = br.deck + 26;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ax - r, Q + 30);
      ctx.lineTo(ax - r, ay + r * 0.9);
      ctx.ellipse(ax, ay + r * 0.9, r, r * 0.9, 0, Math.PI, TAU);
      ctx.lineTo(ax + r, Q + 30);
      ctx.closePath();
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      const xb = LM.fall.x;
      for (let i = 0; i < 26; i++) {
        const o = rng.g() * 6;
        ctx.strokeStyle = PU.rgba(PU.fire(rng.r(0.75, 1)), rng.r(0.12, 0.3));
        ctx.lineWidth = rng.r(1.2, 3.5);
        ctx.beginPath();
        ctx.moveTo(xb + o, ay - 10);
        ctx.lineTo(xb + o * 1.1, Q + 22);
        ctx.stroke();
      }
      glowDot(ctx, xb, Q + 20, 70, [255, 160, 70], 0.55);
      glowDot(ctx, xb, Q + 20, 22, [255, 240, 200], 0.9);
      for (let i = 0; i < 18; i++) {
        const a = -Math.PI / 2 + rng.r(-1.3, 1.3);
        const len = rng.r(12, 40);
        ctx.strokeStyle = PU.rgba(PU.fire(rng.r(0.8, 1)), 0.5);
        ctx.lineWidth = rng.r(1.2, 2.4);
        ctx.beginPath();
        ctx.moveTo(xb, Q + 20);
        ctx.quadraticCurveTo(xb + Math.cos(a) * len, Q + 20 + Math.sin(a) * len, xb + Math.cos(a) * len * 1.5, Q + 20 + Math.sin(a) * len * 0.5 + 14);
        ctx.stroke();
      }
      ctx.restore();
    }

    // STRIP 18 — a boy fills a jar with fallen embers, his mother's doorway lit behind him
    {
      const x = LM.jarQuay.x,
        y = Q;
      ctx.fillStyle = '#ffae58';
      PU.archPath(ctx, x - 34, y - 96, 40, 96);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x - 34, y - 50, 90, [255, 150, 60], 0.45);
      ctx.globalCompositeOperation = 'source-over';
      figure(ctx, x - 40, y, 70, 'stand', { robe: true, robeW: 0.85, hair: true, light: [1, -0.5] });
      figure(ctx, x, y, 52, 'bow', { light: [-1, -0.6], rim: 'rgba(255,200,120,0.95)' });
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x + 16, y - 10, 46, [255, 170, 70], 0.7);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,200,120,0.95)';
      ctx.beginPath();
      ctx.roundRect(x + 8, y - 22, 16, 22, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,250,220,1)';
      for (let i = 0; i < 5; i++) ctx.fillRect(x + 10 + rng.r(0, 10), y - 18 + rng.r(0, 14), 2.5, 2.5);
      ctx.fillStyle = '#070308';
      ctx.fillRect(x + 7, y - 25, 18, 4);
      // embers lying on the stones around him
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) glowDot(ctx, x + rng.r(-70, 80), y - rng.r(0, 4), rng.r(5, 10), [255, 150, 60], 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }

    // STRIP 19 — where embers land on a rooftop garden, flowers of fire bloom
    {
      const x = LM.gardenRoof.x,
        y = LM.gardenRoof.y - 10;
      for (let i = 0; i < 16; i++) {
        const fx = x - 70 + i * 9.5 + rng.r(-3, 3);
        const fh = rng.r(14, 46);
        ctx.strokeStyle = '#0a0508';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(fx, y);
        ctx.quadraticCurveTo(fx + rng.r(-6, 6), y - fh / 2, fx + rng.r(-4, 4), y - fh);
        ctx.stroke();
        if (rng.chance(0.75)) {
          ctx.globalCompositeOperation = 'lighter';
          glowDot(ctx, fx, y - fh, 14, PU.fire(0.75), 0.6);
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * TAU + rng.r(0, 1);
            ctx.fillStyle = PU.rgba(PU.fire(rng.r(0.75, 1)), 0.9);
            ctx.beginPath();
            ctx.ellipse(fx + Math.cos(a) * 3.5, y - fh + Math.sin(a) * 3.5, 3.4, 1.8, a, 0, TAU);
            ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      figure(ctx, x + 60, y, 54, 'bow', { flip: true, robe: true, hair: true, light: [0, -1] });
    }

    // STRIP 20 — the payoff: a nest on the last spire, an egg of white fire about to hatch
    {
      const x = LM.nest.cx,
        y = LM.nest.top - 8;
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x, y - 30, 260, [255, 130, 40], 0.4);
      glowDot(ctx, x, y - 30, 90, [255, 200, 110], 0.6);
      ctx.globalCompositeOperation = 'source-over';
      // nest of dark twigs
      ctx.strokeStyle = '#0c0608';
      ctx.lineCap = 'round';
      for (let i = 0; i < 70; i++) {
        const a = rng.r(-0.3, 0.3);
        const cx = x + rng.r(-34, 34),
          cy = y + rng.r(-10, 6);
        const l = rng.r(18, 40);
        ctx.lineWidth = rng.r(1.5, 3.2);
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * l, cy - Math.sin(a) * l);
        ctx.quadraticCurveTo(cx, cy + 6, cx + Math.cos(a) * l, cy + Math.sin(a) * l);
        ctx.stroke();
      }
      // egg
      const ey = y - 34;
      const gr = ctx.createRadialGradient(x - 5, ey - 8, 2, x, ey, 30);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.4, '#fff0c0');
      gr.addColorStop(0.8, '#ffb040');
      gr.addColorStop(1, '#e06010');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, ey, 19, 26, 0, 0, TAU);
      ctx.fill();
      // hairline crack, light bleeding from it
      ctx.strokeStyle = 'rgba(120,30,0,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 17, ey - 4);
      ctx.lineTo(x - 8, ey - 10);
      ctx.lineTo(x - 2, ey - 2);
      ctx.lineTo(x + 6, ey - 12);
      ctx.lineTo(x + 12, ey - 5);
      ctx.lineTo(x + 18, ey - 9);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x, ey, 60, [255, 240, 200], 0.6);
      // twigs in front of the egg
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 26; i++) {
        const cx = x + rng.r(-32, 32),
          cy = y - rng.r(4, 16);
        const l = rng.r(14, 30),
          a = rng.r(-0.25, 0.25);
        ctx.lineWidth = rng.r(1.5, 2.8);
        ctx.strokeStyle = '#0c0608';
        ctx.beginPath();
        ctx.moveTo(cx - l, cy - a * l);
        ctx.lineTo(cx + l, cy + a * l);
        ctx.stroke();
      }
      // rim light on the twigs
      ctx.strokeStyle = 'rgba(255,170,80,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y - 6, 36, 10, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      // two ember birds arriving to watch over it
      emberBird(ctx, x - 60, y - 120, 9, 0.6, 1, 1);
      emberBird(ctx, x + 54, y - 170, 7, 2.4, 0.95, 0.9);
    }

    // ---- ember rain over the right side (the swipe payoff)
    emberRain(ctx, seed);
    landedEmbers(ctx, seed, city, S);
    ctx.restore();
  };

  function roseWindow(ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = '#060307';
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, TAU);
    ctx.fill();
    const cols = ['#ff7a2a', '#c8304a', '#ffb347', '#7a3fa0', '#ff5520', '#ffd27a'];
    for (let ring = 0; ring < 3; ring++) {
      const n = [6, 12, 16][ring];
      const r0 = [0, r * 0.32, r * 0.66][ring],
        r1 = [r * 0.3, r * 0.64, r][ring];
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU + 0.02,
          a1 = ((i + 1) / n) * TAU - 0.02;
        ctx.fillStyle = cols[(i + ring * 2) % cols.length];
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(x, y, r1 - 1.5, a0, a1);
        ctx.arc(x, y, r0 + 1.5, a1, a0, true);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, x, y, r * 2.4, [255, 130, 60], 0.35);
    ctx.restore();
  }

  function emberRain(ctx, seed) {
    const rng = PU.rngFor(seed, 'rain');
    const noise = PU.makeNoise(PU.hashStr(seed + 'rain'));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    let placed = 0;
    for (let i = 0; i < 40000 && placed < 3000; i++) {
      const x = rng.r(2300, 4020);
      const y = rng.r(600, 3320);
      const dens = smooth(2450, 3800, x) * smooth(450, 1250, y);
      // curtains: clustered by low-frequency noise, leaning with the wind
      const curtain = 0.5 + 0.5 * noise.n(x * 0.0035 - y * 0.0009, y * 0.00035);
      if (rng.next() > dens * curtain * curtain * 1.7) continue;
      placed++;
      const depth = rng.next(); // 0 far, 1 near
      let r, len, a;
      if (depth < 0.6) {
        r = rng.r(0.7, 1.4); len = rng.r(3, 9); a = 0.5;
      } else if (depth < 0.94) {
        r = rng.r(1.3, 2.4); len = rng.r(10, 26); a = 0.75;
      } else {
        r = rng.r(2.6, 4.6); len = rng.r(30, 70); a = 0.9;
      }
      const heat = rng.r(0.55, 1);
      // gently curving fall (wind + turbulence)
      const sway = noise.n(x * 0.01, y * 0.01);
      const dx = (0.16 + 0.12 * sway) * len,
        cx = x - dx * 0.5 + sway * len * 0.15;
      const gr = ctx.createLinearGradient(x - dx, y - len, x, y);
      gr.addColorStop(0, PU.rgba(PU.fire(heat * 0.6), 0));
      gr.addColorStop(1, PU.rgba(PU.fire(heat * 0.9), 0.45 * a));
      ctx.strokeStyle = gr;
      ctx.lineWidth = r * 1.1;
      ctx.beginPath();
      ctx.moveTo(x - dx, y - len);
      ctx.quadraticCurveTo(cx, y - len * 0.5, x, y);
      ctx.stroke();
      ctx.fillStyle = PU.rgba(PU.fire(Math.min(1, heat + 0.12)), 0.95 * a);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.75, 0, TAU);
      ctx.fill();
      if (depth > 0.94) glowDot(ctx, x, y, r * 7, PU.fire(heat * 0.8), 0.22);
      // a few embers become birds
      if (rng.chance(0.01) && y < 2700) emberBird(ctx, x, y, rng.r(8, 15), rng.r(-0.6, 0.6) + (rng.chance(0.5) ? 0 : Math.PI), 0.82, 0.9);
    }
    ctx.restore();
  }

  // embers that have landed glitter along the actual rooftops (found from the city silhouettes)
  function landedEmbers(ctx, seed, city, S) {
    const rng = PU.rngFor(seed, 'landed');
    const w = 1000,
      h = 1000;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cc = c.getContext('2d', { willReadFrequently: true });
    cc.drawImage(city.mid, 0, 0, w, h);
    cc.drawImage(city.near, 0, 0, w, h);
    const a = cc.getImageData(0, 0, w, h).data;
    const k = PU.W / w;
    // skyline: first opaque row per column, plus ledges (opaque below transparent)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 1300; i++) {
      const x = rng.r(2550, 4000);
      const dens = smooth(2550, 3700, x) * (0.4 + 0.6 * Math.max(0, Math.sin(x * 0.013 + Math.sin(x * 0.0041) * 3)));
      if (rng.next() > dens) continue;
      const col = Math.floor(x / k);
      // walk down from a random height to find an edge
      let y0 = Math.floor(rng.r(1900, 3200) / k);
      let found = -1;
      for (let y = y0; y < h - 1; y++) {
        if (a[(y * w + col) * 4 + 3] < 128 && a[((y + 1) * w + col) * 4 + 3] >= 128) {
          found = y + 1;
          break;
        }
      }
      if (found < 0) continue;
      const yy = found * k + rng.r(-1, 3);
      const r = rng.r(2, 5.5);
      glowDot(ctx, x, yy, r * 3, [255, 130, 40], rng.r(0.12, 0.32));
      ctx.fillStyle = PU.rgba(PU.fire(rng.r(0.75, 1)), 0.9);
      ctx.beginPath();
      ctx.arc(x, yy, r * 0.35, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
})(typeof window !== 'undefined' ? window : globalThis);
