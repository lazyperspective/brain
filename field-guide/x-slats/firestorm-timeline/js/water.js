// The sky-lake: reflection of everything above the shoreline, ripples, glints,
// and the long foreground bridge whose piers sit on the strip boundaries.
(function () {
  'use strict';
  const FS = window.FS;
  const { clamp, sstep, mix } = FS;

  FS.drawReflection = function (g) {
    const S = FS.S,
      PX = FS.PX;
    const N = FS.makeNoise(FS.seed * 19);
    // snapshot, vertically smeared (ripples stretch reflections)
    const smear = FS.canvas(PX, Math.max(8, Math.round(PX / 7)));
    const sg = smear.getContext('2d');
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(g.canvas, 0, 0, PX, PX, 0, 0, PX, smear.height);
    const sharp = FS.canvas(PX, PX);
    sharp.getContext('2d').drawImage(g.canvas, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const y0 = Math.round(FS.HZ * S),
      y1 = PX;
    const ky = smear.height / PX;
    for (let yp = y0; yp < y1; yp++) {
      const ym = yp / S; // master
      const dist = ym - FS.HZ;
      const src = FS.HZ - dist * 0.92 - 2;
      if (src < 0) break;
      const amp = (1.5 + dist * 0.035) * (0.6 + 0.8 * Math.abs(N.n2(ym * 0.03, 0.5)));
      const dx = N.fbm(ym * 0.045, 3.3, 3) * amp * S;
      // mix sharp near the shore, smeared further out
      const mixk = clamp(dist / 140);
      g.globalAlpha = 1;
      g.drawImage(sharp, 0, Math.round(src * S), PX, 1, dx, yp, PX, 1);
      g.globalAlpha = mixk * 0.85;
      g.drawImage(smear, 0, src * S * ky, PX, Math.max(1, ky), dx * 1.6, yp, PX, 1);
    }
    g.globalAlpha = 1;
    FS.reset(g);
    // darken + tint the water; darker toward the viewer
    g.save();
    g.globalCompositeOperation = 'multiply';
    const wg = g.createLinearGradient(0, FS.HZ, 0, 4000);
    wg.addColorStop(0, 'rgb(190,180,200)');
    wg.addColorStop(0.25, 'rgb(150,135,160)');
    wg.addColorStop(1, 'rgb(80,70,90)');
    g.fillStyle = wg;
    g.fillRect(0, FS.HZ, 4000, 700);
    g.restore();
    // a thin bright shoreline seam
    g.save();
    for (let x = 0; x < 4000; x += 20) {
      const heat = FS.heat(x),
        calm = FS.calm(x);
      g.fillStyle = FS.css(heat > calm ? FS.fire(0.75) : [160, 170, 230], 0.25 + 0.4 * Math.max(heat, calm * 0.5));
      g.fillRect(x, FS.HZ + 10, 21, 2);
    }
    g.restore();
    waterStrokes(g);
    moonGlitter(g);
  };

  function waterStrokes(g) {
    const r = FS.rng('water');
    const SN = 800;
    const cell = 4000 / SN;
    const small = FS.canvas(SN, SN);
    const sg = small.getContext('2d');
    sg.drawImage(g.canvas, 0, 0, SN, SN);
    const img = sg.getImageData(0, 0, SN, SN).data;
    const sample = (x, y) => {
      const i = clamp(Math.floor(x / cell), 0, SN - 1),
        j = clamp(Math.floor(y / cell), 0, SN - 1);
      const p = (j * SN + i) * 4;
      return [img[p], img[p + 1], img[p + 2]];
    };
    g.save();
    // horizontal painterly ripples
    for (let y = FS.HZ + 16; y < 4000; y += 7) {
      const dist = y - FS.HZ;
      for (let x = 0; x < 4000; x += 26 + dist * 0.06) {
        const px = x + r.f() * 20,
          py = y + r.f() * 6;
        const c = sample(px, py);
        const lum = (c[0] + c[1] + c[2]) / 765;
        const len = 18 + r.f() * (30 + dist * 0.15);
        const w = 2 + r.f() * (2 + dist * 0.008);
        const k = r.f() < 0.5 ? 0.82 : 1.18 + lum * 0.4;
        g.strokeStyle = FS.css(FS.mul(c, k), 0.35 + 0.3 * r.f());
        g.lineWidth = w;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(px - len / 2, py);
        g.quadraticCurveTo(px, py + (r.f() - 0.5) * 3, px + len / 2, py);
        g.stroke();
      }
    }
    // bright glints where the reflection is hot
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 9000; k++) {
      const px = r.f() * 4000,
        py = FS.HZ + 14 + Math.pow(r.f(), 1.3) * 690;
      const c = sample(px, py);
      const lum = (c[0] * 0.4 + c[1] * 0.5 + c[2] * 0.1) / 255;
      if (lum < 0.35 || r.f() > lum) continue;
      const len = 6 + r.f() * 26;
      g.strokeStyle = FS.css(FS.mix(c, [255, 240, 200], 0.5), 0.25 + 0.4 * lum);
      g.lineWidth = 1.2 + r.f() * 1.6;
      g.beginPath();
      g.moveTo(px - len / 2, py);
      g.lineTo(px + len / 2, py);
      g.stroke();
    }
    g.restore();
  }

  function moonGlitter(g) {
    const r = FS.rng('glitter');
    const M = FS.MOON;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 520; k++) {
      const u = Math.pow(r.f(), 0.8);
      const y = FS.HZ + 12 + u * 690;
      const spread = 30 + u * 150;
      const x = M.x + r.gauss() * spread * 0.45;
      const len = 6 + r.f() * (10 + u * 40);
      g.strokeStyle = FS.css([225, 225, 255], (0.2 + 0.5 * r.f()) * (1 - u * 0.5));
      g.lineWidth = 1.2 + r.f() * 2.4;
      g.beginPath();
      g.moveTo(x - len / 2, y);
      g.lineTo(x + len / 2, y);
      g.stroke();
    }
    g.restore();
  }

  // ---------------------------------------------------------------- the foreground bridge
  FS.drawBridge = function (g) {
    const r = FS.rng('bridge');
    FS.reset(g);
    const D = FS.DECK;
    const PW = 26; // pier half width
    const crown = D + 82,
      spring = D + 190;
    const spanPath = (x0, x1) => {
      const p = new Path2D();
      const a = x0 + PW,
        b = x1 - PW;
      const mid = (a + b) / 2,
        rx = (b - a) / 2;
      p.moveTo(x0, D);
      p.lineTo(x1, D);
      p.lineTo(x1, 4000);
      p.lineTo(b, 4000);
      p.lineTo(b, spring);
      // arch (elliptical)
      for (let i = 0; i <= 24; i++) {
        const ang = (i / 24) * Math.PI;
        p.lineTo(mid + Math.cos(ang) * rx, spring - Math.sin(ang) * (spring - crown));
      }
      p.lineTo(a, 4000);
      p.lineTo(x0, 4000);
      p.closePath();
      return p;
    };
    const bodyCol = (x) => mix([12, 11, 22], [17, 8, 6], sstep(0.2, 0.5, FS.tt(x)));
    FS.bridgeBroken = [];
    for (let k = 0; k < 20; k++) {
      const x0 = k * 200,
        x1 = x0 + 200;
      const broken = k >= 16 && k <= 18;
      const p = spanPath(x0, x1);
      const col = bodyCol(x0 + 100);
      if (!broken) {
        paintSpan(g, p, x0, x1, col, D);
      } else {
        // the span tears free and floats upward toward the citadel; pier stumps stay in the water
        const lift = k === 17 ? 150 : 70;
        const rot = k === 16 ? -0.05 : k === 18 ? 0.06 : 0.015;
        g.save();
        g.fillStyle = FS.css(col);
        for (const px of [x0, x1 - PW]) {
          const topY = D + 150 + r.f() * 60;
          g.beginPath();
          g.moveTo(px, 4000);
          g.lineTo(px, topY + r.f() * 20);
          g.lineTo(px + PW * 0.5, topY - 14 + r.f() * 14);
          g.lineTo(px + PW, topY + r.f() * 20);
          g.lineTo(px + PW, 4000);
          g.closePath();
          g.fill();
        }
        g.restore();
        g.save();
        g.translate(x0 + 100, D + 120);
        g.rotate(rot);
        g.translate(-(x0 + 100), -(D + 120) - lift);
        // the lifted span is cut off below (torn from its piers)
        g.beginPath();
        g.moveTo(x0 - 10, D - 40);
        g.lineTo(x1 + 10, D - 40);
        g.lineTo(x1 + 10, D + 150);
        for (let i = 0; i <= 10; i++) g.lineTo(x1 + 10 - (i * (x1 - x0 + 20)) / 10, D + 135 + r.f() * 40);
        g.closePath();
        g.clip();
        paintSpan(g, p, x0, x1, col, D, true);
        // glowing torn edge
        g.restore();
        g.save();
        g.globalCompositeOperation = 'lighter';
        FS.glow(g, x0 + 100, D + 150 - lift, 120, [255, 120, 40], 0.25, 0.35);
        g.restore();
        // stones crumbling upward out of the tear
        for (let i = 0; i < 9; i++) {
          const sx = x0 + 20 + r.f() * 160;
          const sy = D + 170 - lift - r.f() * (lift + 120);
          const sz = 6 + r.f() * 14;
          g.save();
          g.translate(sx, sy);
          g.rotate(r.f() * 3);
          g.fillStyle = FS.css(col);
          g.fillRect(-sz / 2, -sz / 2, sz, sz * 0.7);
          g.fillStyle = FS.css(FS.fire(0.75), 0.7);
          g.fillRect(-sz / 2, sz * 0.2 - 1.5, sz, 1.5);
          g.restore();
        }
        FS.bridgeBroken.push([x0 + 100, D - lift]);
      }
    }
    // railings and lamps on intact spans
    g.save();
    for (let k = 0; k < 20; k++) {
      if (k >= 16 && k <= 18) continue;
      const x0 = k * 200,
        x1 = x0 + 200;
      const col = bodyCol(x0 + 100);
      g.strokeStyle = FS.css(col);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x0, D - 32);
      g.lineTo(x1, D - 32);
      g.stroke();
      g.lineWidth = 2;
      for (let x = x0 + 4; x < x1; x += 11) {
        g.beginPath();
        g.moveTo(x, D);
        g.lineTo(x, D - 32);
        g.stroke();
      }
      const L = FS.lightAt(x0 + 100, D);
      g.strokeStyle = FS.css(L.col, 0.35 * L.a + 0.08);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x0, D - 33.5);
      g.lineTo(x1, D - 33.5);
      g.stroke();
    }
    g.restore();
  };

  function paintSpan(g, p, x0, x1, col, D, chunk) {
    g.save();
    g.fillStyle = FS.css(col);
    g.fill(p);
    g.clip(p);
    // top coping lit from the city behind
    const L = FS.lightAt(x0 + 100, D);
    g.fillStyle = FS.css(L.col, 0.25 + 0.5 * L.a);
    g.fillRect(x0, D, 200, 3);
    // stone courses
    g.strokeStyle = 'rgba(255,255,255,0.035)';
    g.lineWidth = 1.5;
    for (let y = D + 22; y < 4000; y += 22) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.stroke();
    }
    // warm reflected light on the arch intrados from the water
    const heat = FS.heat(x0 + 100);
    const ig = g.createLinearGradient(0, D + 200, 0, D + 80);
    ig.addColorStop(0, FS.css(FS.fire(0.6), 0.25 * heat));
    ig.addColorStop(1, FS.css(FS.fire(0.6), 0));
    g.fillStyle = ig;
    g.fillRect(x0, D + 60, 200, 260);
    g.restore();
  }
})();
