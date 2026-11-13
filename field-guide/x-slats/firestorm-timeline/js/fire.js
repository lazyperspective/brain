// Fire: flame masses, the burning skyline, tower fires, the fire waterfall, embers.
(function () {
  'use strict';
  const FS = window.FS;
  const { clamp, sstep, mix } = FS;

  // a mass of flame tongues rising from a base line centred at x
  FS.fireMass = function (g, x, y, w, h, I, r, o = {}) {
    if (h < 4) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, x, y - h * 0.35, Math.max(w, h) * 1.05, [255, 100, 25], 0.16 * I, 0.8);
    FS.glow(g, x, y - h * 0.1, w * 0.8, [255, 170, 70], 0.2 * I, 0.6);
    const lean = o.lean || 0.12;
    // outer dark-red tongues
    const n1 = Math.round(5 + w / 9);
    for (let i = 0; i < n1; i++) {
      const dx = (r.f() - 0.5) * w;
      const hk = Math.pow(1 - Math.abs(dx) / (w / 2 + 1), 0.6);
      FS.tongue(g, x + dx, y, h * (0.45 + 0.6 * r.f()) * (0.35 + 0.65 * hk), w * (0.18 + 0.2 * r.f()), {
        sway: w * 0.12 + h * 0.05,
        phase: r.f() * 6.3,
        lean: lean + (r.f() - 0.5) * 0.25,
        freq: 1.5 + r.f() * 1.5,
        c0: [230, 80, 18],
        c1: [170, 40, 10],
        c2: [90, 16, 6],
        alpha: 0.55 * I,
      });
    }
    // mid orange
    const n2 = Math.round(4 + w / 12);
    for (let i = 0; i < n2; i++) {
      const dx = (r.f() - 0.5) * w * 0.8;
      const hk = Math.pow(1 - Math.abs(dx) / (w * 0.4 + 1), 0.7);
      FS.tongue(g, x + dx, y, h * (0.3 + 0.45 * r.f()) * (0.4 + 0.6 * hk), w * (0.12 + 0.14 * r.f()), {
        sway: w * 0.08 + h * 0.04,
        phase: r.f() * 6.3,
        lean: lean + (r.f() - 0.5) * 0.2,
        c0: [255, 190, 80],
        c1: [255, 110, 25],
        c2: [190, 50, 10],
        alpha: 0.6 * I,
      });
    }
    // hot core
    const n3 = Math.round(2 + w / 20);
    for (let i = 0; i < n3; i++) {
      const dx = (r.f() - 0.5) * w * 0.55;
      FS.tongue(g, x + dx, y + 2, h * (0.12 + 0.25 * r.f()), w * (0.1 + 0.1 * r.f()), {
        sway: w * 0.05,
        phase: r.f() * 6.3,
        lean: lean,
        c0: [255, 250, 220],
        c1: [255, 210, 120],
        c2: [255, 140, 40],
        alpha: 0.55 * I,
      });
    }
    g.restore();
  };

  // flames that sit behind the mid city: the burning skyline
  FS.drawFireWall = function (g) {
    const r = FS.rng('firewall');
    const N = FS.makeNoise(FS.seed * 13);
    FS.reset(g);
    const district = (x) => 0.3 + 0.7 * sstep(-0.35, 0.4, N.fbm(x * 0.0021, 2.2, 3));
    // backlight: the sky glowing over burning districts
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let x0 = 0; x0 < 4000; x0 += 20) {
      const heat = FS.heat(x0 + 10);
      if (heat < 0.02) continue;
      const k = Math.pow(heat, 1.3) * district(x0 + 10);
      const hh = 300 + 900 * k;
      const lg = g.createLinearGradient(0, 3280, 0, 3280 - hh);
      lg.addColorStop(0, FS.css(FS.fire(0.78), 0.55 * k));
      lg.addColorStop(0.3, FS.css(FS.fire(0.6), 0.3 * k));
      lg.addColorStop(1, FS.css(FS.fire(0.4), 0));
      g.fillStyle = lg;
      g.fillRect(x0, 3280 - hh, 20, hh);
    }
    g.restore();
    for (let x = 760; x < 3440; x += 34 + r.f() * 40) {
      const heat = FS.heat(x);
      if (heat < 0.05) continue;
      const d = district(x);
      let h = Math.pow(heat, 1.5) * (120 + 820 * d * r.range(0.55, 1.15));
      if (x > 3300) h *= 0.55;
      const w = 70 + h * 0.42;
      FS.fireMass(g, x, 3275, w, h, 0.6 + 0.4 * heat, r, { lean: 0.2 });
    }
  };

  // fires on mid towers / near houses
  FS.drawTowerFires = function (g, towers, scale = 1) {
    const r = FS.rng('towerfire' + scale);
    FS.reset(g);
    for (const t of towers) {
      if (!t.burn) continue;
      const heat = FS.heat(t.x);
      // never a candle on the tip: burn lower roofs and the flanks
      const spots = t.roofs.filter((s) => s[1] > t.top + 120);
      if (spots.length && r.chance(0.7)) {
        const s = r.pick(spots);
        const h = (110 + r.f() * 320) * heat * scale;
        FS.fireMass(g, s[0] + (r.f() - 0.5) * s[2] * 0.3, s[1] + 4, s[2] * 1.5, h, 0.8 + 0.2 * heat, r, { lean: 0.3 });
      }
      if (r.chance(0.55)) {
        // a sheet of flame climbing one side, bent by the wind toward the vortex
        const side = r.chance(0.7) ? t.maxX - 6 : t.minX + 6;
        const y = t.base - (t.base - t.top) * r.range(0.15, 0.55);
        const h = (160 + r.f() * 360) * heat * scale;
        FS.fireMass(g, side, y, 40 + h * 0.25, h, 0.85, r, { lean: 0.45 });
      }
    }
  };

  // flames licking out of hot windows
  FS.drawWindowFlames = function (g) {
    const r = FS.rng('winflames');
    FS.reset(g);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const w of FS.hotWindows) {
      if (r.f() > 0.18 * w.k) continue;
      const h = 14 + r.f() * 40 * w.k;
      FS.tongue(g, w.x, w.y + 3, h, w.w * 1.8, {
        sway: 3,
        phase: r.f() * 6,
        lean: 0.2,
        c0: [255, 220, 140],
        c1: [255, 120, 30],
        c2: [160, 40, 10],
        alpha: 0.7,
      });
    }
    g.restore();
  };

  // the aqueduct and the waterfall of liquid fire (strip 13)
  FS.drawAqueduct = function (g) {
    const r = FS.rng('aqueduct');
    FS.reset(g);
    const y = 2470,
      X = 2500;
    const col = [22, 9, 7];
    g.save();
    // channel + arches, broken at X
    const segs = [
      [2210, X - 6],
      [X + 70, 2790],
    ];
    for (const sgm of segs) {
      const b = new FS.Builder((sgm[0] + sgm[1]) / 2, 3290);
      b.rect(sgm[0], y, sgm[1] - sgm[0], 30);
      for (let px = sgm[0] + 8; px < sgm[1] - 8; px += 58) {
        b.rect(px - 7, y + 28, 14, 3290 - y - 28);
      }
      // jagged broken ends
      if (sgm[1] === X - 6) b.poly([[X - 10, y], [X + 4, y + 6], [X - 2, y + 14], [X + 6, y + 22], [X - 10, y + 30]]);
      FS.paintTower(g, b, { body: col, under: 1.4, rim: 1, rimW: 3 });
      // arch curves between piers
      g.strokeStyle = FS.css(col);
      g.lineWidth = 7;
      for (let px = sgm[0] + 8; px < sgm[1] - 66; px += 58) {
        g.beginPath();
        g.arc(px + 29, y + 58, 29, Math.PI, 0);
        g.stroke();
      }
    }
    // the molten channel glowing on top
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = FS.css([255, 150, 50], 0.55);
    g.fillRect(2210, y - 3, X - 2216, 5);
    g.restore();

    // ---- the pour: smooth like water, made of fire
    const top = y + 6,
      bot = FS.HZ + 6;
    const cxF = (yy) => X + 4 + 26 * Math.sqrt(clamp((yy - top) / (bot - top))) + 4 * Math.sin(yy * 0.02);
    const wF = (yy) => 30 + 22 * clamp((yy - top) / (bot - top));
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let yy = top; yy < bot; yy += 60) FS.glow(g, cxF(yy), yy, 110, [255, 110, 25], 0.08, 1.4);
    g.globalCompositeOperation = 'source-over';
    // body
    const L = [],
      R = [];
    for (let yy = top; yy <= bot; yy += 10) {
      L.push([cxF(yy) - wF(yy) / 2, yy]);
      R.push([cxF(yy) + wF(yy) / 2, yy]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (const p of L) g.lineTo(p[0], p[1]);
    for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
    const lg = g.createLinearGradient(X - 20, 0, X + 60, 0);
    lg.addColorStop(0, '#c2340a');
    lg.addColorStop(0.35, '#ff9a2a');
    lg.addColorStop(0.55, '#ffc66a');
    lg.addColorStop(0.8, '#ff8a20');
    lg.addColorStop(1, '#a8280a');
    g.fillStyle = lg;
    g.fill();
    // glossy streaks running down
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 70; k++) {
      const off = r.f() - 0.5;
      const y0 = top + r.f() * (bot - top) * 0.9;
      const len = 60 + r.f() * 300;
      const pts = [];
      for (let yy = y0; yy < Math.min(bot, y0 + len); yy += 8) pts.push([cxF(yy) + off * wF(yy) * 0.85, yy]);
      if (pts.length < 3) continue;
      FS.bristle(g, pts, 2 + r.f() * 4, r.chance(0.3) ? [255, 225, 170] : [255, 150, 50], 0.28, r, { n: 2, taper: true });
    }
    // edge spray: little tongues peeling sideways
    for (let k = 0; k < 40; k++) {
      const yy = top + 30 + r.f() * (bot - top - 60);
      const side = r.sign();
      const x0 = cxF(yy) + (side * wF(yy)) / 2;
      FS.tongue(g, x0, yy, 18 + r.f() * 36, 8 + r.f() * 8, {
        sway: 4,
        lean: side * 0.9,
        phase: r.f() * 6,
        c0: [255, 200, 110],
        c1: [255, 110, 25],
        c2: [150, 30, 8],
        alpha: 0.5,
      });
    }
    g.restore();
    FS.pour = { x: cxF(bot), y: bot };
  };

  // splash where the fire waterfall meets the lake (drawn after the reflection)
  FS.drawPourSplash = function (g) {
    const r = FS.rng('splash');
    FS.reset(g);
    const P = FS.pour;
    g.save();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, P.x, P.y + 10, 170, [255, 140, 40], 0.5, 0.35);
    // fire floating on water, spreading in rings
    for (let k = 0; k < 5; k++) {
      g.strokeStyle = FS.css(FS.fire(0.85 - k * 0.08), 0.5 - k * 0.07);
      g.lineWidth = 4 - k * 0.5;
      g.beginPath();
      g.ellipse(P.x, P.y + 14 + k * 5, 40 + k * 18, 7 + k * 4, 0, 0, Math.PI * 2);
      g.stroke();
    }
    FS.fireMass(g, P.x, P.y + 10, 80, 90, 1, r);
    g.restore();
  };

  // falling / rising embers across the timeline
  FS.drawEmbers = function (g, layer) {
    const r = FS.rng('embers' + layer);
    const N = FS.makeNoise(FS.seed * 17 + layer);
    FS.reset(g);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const count = layer === 0 ? 2600 : 900;
    for (let k = 0; k < count; k++) {
      const x = r.f() * FS.W;
      const t = x / FS.W;
      const heat = FS.heat(x);
      const y = 200 + r.f() * (FS.HZ - 200);
      // embers travel in gusts: clustered bands, not uniform rain
      const gust = sstep(0.05, 0.5, N.fbm(x * 0.0011 - y * 0.0006, y * 0.0013 + x * 0.0004, 3));
      const nearFire = 0.35 + 0.65 * sstep(1600, 3200, y);
      const dens = (t < 0.12 ? 0.004 : Math.pow(heat, 0.9) * 0.7 + (t > 0.14 ? 0.04 : 0)) * gust * nearFire * 1.5;
      if (r.f() > dens) continue;
      // motion: falling in strips 4-9, rising with the updraft later
      const rising = sstep(0.42, 0.58, t);
      const ang0 = Math.PI / 2 - 0.5; // falling down-right
      const ang1 = -Math.PI / 2 + 0.55 + N.n2(x * 0.002, y * 0.002) * 0.8; // rising, drifting toward vortex
      const a = rising > 0.5 ? ang1 : ang0 + N.n2(x * 0.003, y * 0.003) * 0.6;
      const big = r.f() < 0.05;
      const len = big ? 2 : 4 + Math.pow(r.f(), 2) * (layer === 0 ? 26 : 50);
      const c = FS.fire(0.72 + r.f() * 0.28);
      const sz = layer === 0 ? 0.9 + r.f() * 1.6 : 1.6 + r.f() * 2.6;
      g.strokeStyle = FS.css(c, 0.5 + 0.5 * r.f());
      g.lineWidth = sz;
      // curved streak
      const cx = x + Math.cos(a) * len * 0.5 + Math.cos(a + 1.4) * len * 0.15;
      const cy = y + Math.sin(a) * len * 0.5 + Math.sin(a + 1.4) * len * 0.15;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(cx, cy, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
      if (big || r.f() < 0.08) FS.glow(g, x, y, sz * (big ? 9 : 5), c, big ? 0.35 : 0.22);
    }
    g.restore();
  };

  // a few first sparks in the calm city (hand placed)
  FS.drawFirstSparks = function (g) {
    FS.reset(g);
    const sp = [
      [538, 2470, 2.2],
      [470, 2160, 1.6],
      [610, 1980, 1.4],
      [312, 1700, 1.1],
      [700, 1720, 2.0],
      [742, 2100, 1.6],
      [655, 2360, 1.8],
      [140, 2550, 1.0],
    ];
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const s of sp) {
      FS.glow(g, s[0], s[1], 26 * s[2], [255, 150, 60], 0.35);
      g.fillStyle = 'rgba(255,230,170,0.95)';
      g.beginPath();
      g.arc(s[0], s[1], 2.2 * s[2], 0, Math.PI * 2);
      g.fill();
      // a short fading trail
      g.strokeStyle = 'rgba(255,140,50,0.4)';
      g.lineWidth = 1.4 * s[2];
      g.beginPath();
      g.moveTo(s[0], s[1]);
      g.quadraticCurveTo(s[0] - 10, s[1] - 22, s[0] - 4, s[1] - 46);
      g.stroke();
    }
    g.restore();
  };

  // dark smoke plumes in front of the mid city (integration)
  FS.drawFrontSmoke = function (g) {
    const r = FS.rng('frontsmoke');
    FS.reset(g);
    g.save();
    for (const S of FS.SMOKE) {
      if (S.s < 0.5) continue;
      for (let k = 0; k < 60 * S.s; k++) {
        const rise = r.f() * 900;
        const y = S.y - rise;
        const x = S.x + 0.0008 * Math.pow(rise, 1.35) + (r.f() - 0.5) * (30 + rise * 0.3);
        if (FS.smokeAt(x, y) < 0.45) continue;
        const pts = FS.trace(x, y, 40 + r.f() * 80, 8, FS.flowAngle);
        const lit = Math.exp(-rise / 400) * FS.heat(x);
        const c = mix([30, 16, 13], FS.fire(0.5), lit * 0.6);
        FS.bristle(g, pts, 8 + r.f() * 16, c, 0.3, r, { jitter: 0.2 });
      }
    }
    g.restore();
  };
})();
