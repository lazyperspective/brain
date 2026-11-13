// Landmarks and the twenty hand-placed micro-stories (one per strip).
(function () {
  'use strict';
  const FS = window.FS;
  const { clamp, sstep, mix } = FS;
  const B = () => FS.Builder;
  const INK = [8, 6, 9];

  // ---------------------------------------------------------------- figure kit
  // y = feet. arms: [shoulder, elbow] angles in radians from hanging straight down,
  // positive = forward (+x). Returns hand positions.
  FS.figure = function (g, x, y, h, o = {}) {
    const col = o.col || INK;
    g.save();
    g.translate(x, y);
    if (o.flip) g.scale(-1, 1);
    g.rotate(o.lean || 0);
    g.fillStyle = FS.css(col, o.alpha === undefined ? 1 : o.alpha);
    g.strokeStyle = g.fillStyle;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const hip = -h * 0.47,
      sh = -h * 0.79;
    const lw = h * 0.085;
    // legs
    const st = o.stride === undefined ? 0.12 : o.stride;
    g.lineWidth = lw;
    for (const s of [-1, 1]) {
      const a = s * st;
      const kx = Math.sin(a) * h * 0.24 + (s > 0 ? h * 0.02 : 0),
        ky = hip + Math.cos(a) * h * 0.24;
      const fx = kx + Math.sin(a * (o.run ? 1.8 : 0.6) - (o.run && s < 0 ? 0.6 : 0)) * h * 0.23;
      g.beginPath();
      g.moveTo(s * h * 0.035, hip);
      g.lineTo(kx, ky);
      g.lineTo(fx, -1);
      g.stroke();
    }
    // torso / robe
    g.beginPath();
    if (o.robe) {
      g.moveTo(-h * 0.1, sh);
      g.lineTo(h * 0.1, sh);
      g.lineTo(h * 0.19, -2);
      g.lineTo(-h * 0.19, -2);
    } else {
      g.moveTo(-h * 0.105, sh);
      g.lineTo(h * 0.105, sh);
      g.lineTo(h * 0.075, hip + h * 0.02);
      g.lineTo(-h * 0.075, hip + h * 0.02);
    }
    g.closePath();
    g.fill();
    // cloak flowing back
    if (o.cloak) {
      g.beginPath();
      g.moveTo(-h * 0.08, sh);
      g.quadraticCurveTo(-h * 0.35, sh + h * 0.3, -h * 0.42 * o.cloak, -h * 0.06);
      g.lineTo(-h * 0.05, hip);
      g.closePath();
      g.fill();
    }
    // head
    const hr = h * 0.078;
    g.beginPath();
    g.arc(0, -h * 0.885, hr, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = h * 0.05;
    g.beginPath();
    g.moveTo(0, -h * 0.82);
    g.lineTo(0, sh);
    g.stroke();
    if (o.hat === 'wizard') {
      g.beginPath();
      g.moveTo(-hr * 1.9, -h * 0.9);
      g.lineTo(hr * 1.9, -h * 0.9);
      g.lineTo(-hr * 0.6, -h * 1.18);
      g.closePath();
      g.fill();
    } else if (o.hat === 'hood') {
      g.beginPath();
      g.arc(0, -h * 0.89, hr * 1.25, Math.PI * 0.9, Math.PI * 2.1);
      g.fill();
    } else if (o.hat === 'cap') {
      g.fillRect(-hr * 1.6, -h * 0.94, hr * 3.2, hr * 0.45);
      g.fillRect(-hr * 0.9, -h * 1.02, hr * 1.8, hr * 0.9);
    }
    // arms
    const hands = [];
    g.lineWidth = h * 0.065;
    const arms = [o.armB || [0.15, 0.2], o.armF || [0.25, 0.3]];
    for (let i = 0; i < 2; i++) {
      const [a1, a2] = arms[i];
      const sx = (i === 0 ? -1 : 1) * h * 0.07;
      const ex = sx + Math.sin(a1) * h * 0.2,
        ey = sh + h * 0.02 + Math.cos(a1) * h * 0.2;
      const hx = ex + Math.sin(a1 + a2) * h * 0.19,
        hy = ey + Math.cos(a1 + a2) * h * 0.19;
      g.beginPath();
      g.moveTo(sx, sh + h * 0.02);
      g.lineTo(ex, ey);
      g.lineTo(hx, hy);
      g.stroke();
      hands.push([hx, hy]);
    }
    // hand coords in the caller's coordinate space
    const ca = Math.cos(o.lean || 0),
      sa = Math.sin(o.lean || 0);
    const out = hands.map(([hx, hy]) => {
      const rx = hx * ca - hy * sa,
        ry = hx * sa + hy * ca;
      return [x + (o.flip ? -rx : rx), y + ry];
    });
    g.restore();
    return { back: out[0], front: out[1] };
  };

  FS.cat = function (g, x, y, s, col = INK) {
    g.save();
    g.translate(x, y);
    g.fillStyle = FS.css(col);
    g.strokeStyle = FS.css(col);
    // body (sitting, seen from the side, facing right)
    g.beginPath();
    g.ellipse(0, -s * 0.32, s * 0.24, s * 0.34, 0.12, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(-s * 0.04, -s * 0.07, s * 0.3, s * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    // head, looking up at the spark
    g.beginPath();
    g.arc(s * 0.1, -s * 0.72, s * 0.16, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.0, -s * 0.8);
    g.lineTo(s * 0.0, -s * 1.0);
    g.lineTo(s * 0.1, -s * 0.85);
    g.moveTo(s * 0.13, -s * 0.86);
    g.lineTo(s * 0.24, -s * 1.03);
    g.lineTo(s * 0.26, -s * 0.8);
    g.fill();
    // tail curling over the edge
    g.lineWidth = s * 0.07;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-s * 0.25, -s * 0.08);
    g.quadraticCurveTo(-s * 0.55, 0, -s * 0.45, s * 0.35);
    g.quadraticCurveTo(-s * 0.4, s * 0.5, -s * 0.28, s * 0.45);
    g.stroke();
    g.restore();
  };

  function tower(build, o) {
    return (g) => {
      const t = build();
      FS.paintTower(g, t, Object.assign({ body: [16, 15, 30], under: 1, rim: 1.1, rimW: 5, windows: true, winP: 0.45 }, o || {}));
      return t;
    };
  }

  // ---------------------------------------------------------------- landmarks (mid layer)
  FS.drawLandmarks = function (g) {
    FS.reset(g);
    const r = FS.rng('landmarks');
    const Bd = FS.Builder;
    const base = 3285;
    const night = [14, 14, 32];
    const warm = [22, 10, 8];

    // S1 observatory needle
    {
      const x = 100;
      const t = new Bd(x, base);
      t.trap(x, base, 84, 60, 700);
      t.winGrid(x - 30, base - 700, 60, 700, 15, 30, 5, 11);
      t.rect(x - 40, base - 712, 80, 12);
      t.trap(x, base - 712, 52, 34, 812);
      t.winGrid(x - 18, base - 1520, 36, 800, 12, 46, 4, 10, 0.7);
      t.rect(x - 56, 1755, 112, 9);
      t.ell(x, 1755, 36, 36, Math.PI, Math.PI * 2);
      FS.paintTower(g, t, { body: night, under: 0, rim: 1.2, rimW: 5, windows: true, winP: 0.5 });
      // balcony railing
      g.strokeStyle = FS.css(night);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 56, 1738);
      g.lineTo(x + 56, 1738);
      for (let k = -56; k <= 56; k += 8) {
        g.moveTo(x + k, 1755);
        g.lineTo(x + k, 1738);
      }
      g.stroke();
      // dome slit glowing + telescope aimed at the ringed moon
      g.save();
      g.globalCompositeOperation = 'lighter';
      FS.glow(g, x + 6, 1735, 40, [255, 200, 120], 0.35);
      g.restore();
      g.fillStyle = 'rgba(255,205,130,0.95)';
      g.fillRect(x + 2, 1724, 8, 30);
      g.save();
      g.translate(x + 8, 1726);
      g.rotate(-1.62);
      g.fillStyle = FS.css([40, 34, 50]);
      g.fillRect(0, -5, 92, 10);
      g.fillRect(84, -7, 12, 14);
      g.fillStyle = 'rgba(200,170,110,0.9)';
      g.fillRect(30, -5, 4, 10);
      g.restore();
      // the astronomer on the balcony, pointing at the second moon
      FS.figure(g, x - 32, 1755, 38, { flip: false, armF: [2.7, 0.15], armB: [0.2, 0.3], robe: true, hat: 'wizard', col: [10, 9, 16] });
      FS.figure(g, x - 32, 1755, 38, { flip: false, armF: [2.7, 0.15], armB: [0.2, 0.3], robe: true, hat: 'wizard', col: [180, 190, 255], alpha: 0.0 });
    }

    // S3 twin needles against the moon, joined by a bridge; the cat watches the first spark
    {
      for (const x of [448, 556]) {
        const t = new Bd(x, base);
        const h = x < 500 ? 1320 : 1250;
        t.trap(x, base, 58, 46, h * 0.5);
        t.winGrid(x - 22, base - h * 0.5, 44, h * 0.5, 13, 26, 4, 9);
        t.rect(x - 32, base - h * 0.5 - 8, 64, 8);
        t.trap(x, base - h * 0.5 - 8, 34, 18, h * 0.38);
        t.ell(x, base - h * 0.9, 12, 17);
        t.tri(x, base - h * 0.89, 9, h * 0.13);
        FS.paintTower(g, t, { body: night, under: 0, rim: 1.2, rimW: 5, windows: true, winP: 0.4 });
      }
      const by = 2566;
      g.fillStyle = FS.css(night);
      g.beginPath();
      g.moveTo(462, by);
      g.quadraticCurveTo(502, by + 18, 542, by);
      g.lineTo(542, by + 10);
      g.quadraticCurveTo(502, by + 30, 462, by + 10);
      g.closePath();
      g.fill();
      g.fillRect(460, by - 3, 84, 5);
      g.strokeStyle = 'rgba(180,190,250,0.5)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(462, by - 3);
      g.lineTo(542, by - 3);
      g.stroke();
      FS.cat(g, 506, by - 2, 40, [10, 10, 22]);
    }

    // S5 bell tower
    {
      const x = 900;
      const t = new Bd(x, base);
      t.rect(x - 44, 2085, 88, base - 2085);
      t.winGrid(x - 44, 2100, 88, 900, 22, 44, 7, 14, 0.8);
      t.rect(x - 52, 2075, 104, 12);
      // belfry pillars
      t.rect(x - 48, 1935, 14, 142);
      t.rect(x + 34, 1935, 14, 142);
      t.rect(x - 52, 1925, 104, 14);
      // roof + spire
      t.trap(x, 1925, 96, 40, 90);
      t.rect(x - 16, 1760, 32, 76);
      t.tri(x, 1760, 30, 150);
      FS.paintTower(g, t, { body: mix(night, warm, 0.25), under: 0.8, rim: 1.1, rimW: 5, windows: true, winP: 0.5 });
      // warm interior of the belfry
      g.save();
      const ig = g.createRadialGradient(x, 2010, 5, x, 2010, 60);
      ig.addColorStop(0, 'rgba(255,190,110,0.95)');
      ig.addColorStop(1, 'rgba(160,70,30,0.6)');
      g.fillStyle = ig;
      g.fillRect(x - 34, 1939, 68, 136);
      // the bell
      g.fillStyle = FS.css([30, 18, 12]);
      g.beginPath();
      g.moveTo(x - 4, 1952);
      g.bezierCurveTo(x - 22, 1956, x - 18, 1990, x - 28, 2010);
      g.lineTo(x + 28, 2010);
      g.bezierCurveTo(x + 18, 1990, x + 22, 1956, x + 4, 1952);
      g.closePath();
      g.fill();
      g.fillRect(x - 2, 1940, 4, 14);
      g.beginPath();
      g.arc(x + 6, 2014, 5, 0, Math.PI * 2);
      g.fill();
      // rope and the ringer hauling it
      g.strokeStyle = FS.css([30, 18, 12]);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x + 18, 1990);
      g.lineTo(x + 20, 2042);
      g.stroke();
      FS.figure(g, x + 14, 2075, 34, { armF: [2.9, -0.1], armB: [2.6, 0.2], lean: -0.12, col: [30, 16, 10], stride: 0.25 });
      g.restore();
      // the toll made visible: rings of light rolling out
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let k = 1; k <= 4; k++) {
        g.strokeStyle = `rgba(255,200,130,${0.24 - k * 0.045})`;
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(x, 2000, 40 + k * 14, 20 + k * 10, 0, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      }
      g.restore();
    }

    // S7 stilt watchtower with the firewatcher blowing a horn
    {
      const x = 1300;
      const top = 2270;
      g.save();
      const col = mix(night, warm, 0.5);
      g.strokeStyle = FS.css(col);
      g.lineCap = 'square';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x - 50, base);
      g.lineTo(x - 22, top);
      g.moveTo(x + 50, base);
      g.lineTo(x + 22, top);
      g.stroke();
      g.lineWidth = 2;
      g.beginPath();
      for (let y = top + 60; y < base; y += 110) {
        const u0 = (y - top) / (base - top),
          u1 = (y + 110 - top) / (base - top);
        const l0 = x - 22 - 28 * u0,
          r0 = x + 22 + 28 * u0,
          l1 = x - 22 - 28 * u1,
          r1 = x + 22 + 28 * u1;
        g.moveTo(l0, y);
        g.lineTo(r1, Math.min(base, y + 110));
        g.moveTo(r0, y);
        g.lineTo(l1, Math.min(base, y + 110));
        g.moveTo(l0, y);
        g.lineTo(r0, y);
      }
      g.stroke();
      g.restore();
      const t = new Bd(x, top);
      t.rect(x - 44, top - 8, 88, 10);
      t.rect(x - 22, top - 60, 44, 52);
      t.poly([
        [x - 34, top - 58],
        [x, top - 120],
        [x + 34, top - 58],
      ]);
      FS.paintTower(g, t, { body: col, under: 1.5, rim: 1.3, rimW: 4 });
      g.fillStyle = 'rgba(255,190,110,0.9)';
      g.fillRect(x - 8, top - 48, 16, 22);
      // rail
      g.strokeStyle = FS.css(col);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x - 44, top - 24);
      g.lineTo(x + 44, top - 24);
      g.stroke();
      // the watcher + horn toward the fire
      const hd = FS.figure(g, x + 31, top - 8, 34, { armF: [1.75, 0.35], armB: [1.6, 0.6], col: [16, 8, 8], hat: 'cap' });
      g.fillStyle = FS.css([60, 30, 14]);
      g.beginPath();
      g.moveTo(x + 32, top - 37);
      g.lineTo(x + 66, top - 52);
      g.lineTo(x + 68, top - 40);
      g.closePath();
      g.fill();
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let k = 1; k <= 3; k++) {
        g.strokeStyle = `rgba(255,190,120,${0.3 - k * 0.07})`;
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(x + 66, top - 46, 6 + k * 7, -0.9, 0.6);
        g.stroke();
      }
      g.restore();
    }

    // S8 two needles + high bridge with a fleeing family
    {
      const col = mix(night, warm, 0.62);
      for (const x of [1436, 1566]) {
        const t = new Bd(x, base);
        const h = x < 1500 ? 1240 : 1330;
        t.trap(x, base, 62, 44, h * 0.55);
        t.winGrid(x - 22, base - h * 0.55, 44, h * 0.55, 13, 26, 4, 9);
        t.rect(x - 34, base - h * 0.55 - 8, 68, 8);
        t.trap(x, base - h * 0.55 - 8, 36, 16, h * 0.32);
        t.ell(x, base - h * 0.9, 13, 18);
        t.tri(x, base - h * 0.89, 8, h * 0.12);
        FS.paintTower(g, t, { body: col, under: 1, rim: 1.1, rimW: 5, windows: true, winP: 0.45 });
      }
      const by = 2350;
      g.fillStyle = FS.css(col);
      g.beginPath();
      g.moveTo(1450, by);
      g.quadraticCurveTo(1501, by - 22, 1552, by);
      g.lineTo(1552, by + 12);
      g.quadraticCurveTo(1501, by - 8, 1450, by + 12);
      g.closePath();
      g.fill();
      g.strokeStyle = FS.css(FS.fire(0.75), 0.6);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(1450, by + 12);
      g.quadraticCurveTo(1501, by - 8, 1552, by + 12);
      g.stroke();
      // family running left (away from the fire)
      FS.figure(g, 1478, by - 15, 34, { flip: true, run: true, stride: 0.5, armF: [1.0, 0.6], armB: [-0.8, 0.5], col: [12, 6, 6], lean: -0.15 });
      FS.figure(g, 1500, by - 17, 22, { flip: true, run: true, stride: 0.5, armF: [1.4, 0.2], armB: [-0.6, 0.4], col: [12, 6, 6], lean: -0.15 });
      FS.figure(g, 1526, by - 15, 35, { flip: true, run: true, stride: 0.45, armF: [1.3, 0.8], armB: [-0.5, 0.4], col: [12, 6, 6], lean: -0.1, cloak: 0.8 });
    }

    // S9 onion-dome palace, burning
    {
      const x = 1700;
      const t = new Bd(x, base);
      t.rect(x - 58, 2560, 116, base - 2560);
      t.winGrid(x - 58, 2580, 116, 600, 18, 34, 6, 13);
      t.rect(x - 46, 2500, 92, 62);
      t.onion(x, 2502, 66, 230);
      t.rect(x - 2, 2180, 4, 100);
      for (const sx of [-1, 1]) {
        const mx = x + sx * 76;
        t.rect(mx - 7, 2500, 14, base - 2500);
        t.onion(mx, 2502, 14, 60);
        t.tri(mx, 2448, 6, 70);
      }
      FS.paintTower(g, t, { body: mix(night, warm, 0.7), under: 1.3, rim: 1.2, rimW: 5, windows: true, winP: 0.6 });
      FS.fireMass(g, x + 26, 2420, 60, 130, 1, r);
      FS.fireMass(g, x - 70, 2560, 40, 90, 1, r);
    }

    // S11 library under the wizard's ward
    {
      const x = 2100;
      const t = new Bd(x, base);
      t.rect(x - 50, 3080, 100, base - 3080);
      // columns
      for (let k = -40; k <= 40; k += 20) t.rect(x + k - 4, 3080, 8, 120);
      t.poly([
        [x - 58, 3082],
        [x, 3040],
        [x + 58, 3082],
      ]);
      t.rect(x - 3, 3000, 6, 42);
      FS.paintTower(g, t, { body: warm, under: 1.3, rim: 1, rimW: 4 });
      g.fillStyle = 'rgba(150,200,255,0.9)';
      for (let k = -30; k <= 30; k += 20) g.fillRect(x + k - 4, 3100, 8, 70);
      // the wizard on the pediment, staff raised
      const hd = FS.figure(g, x - 2, 3040, 38, { robe: true, hat: 'wizard', armF: [2.6, 0.2], armB: [1.2, 0.5], col: [10, 8, 18], cloak: 0.7 });
      g.strokeStyle = FS.css([20, 14, 26]);
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(hd.front[0] - 3, hd.front[1] + 22);
      g.lineTo(hd.front[0] + 3, hd.front[1] - 20);
      g.stroke();
      FS.ward = { x, y: 3080, r: 82, sx: hd.front[0] + 3, sy: hd.front[1] - 20 };
    }

    // S12 banner tower
    {
      const x = 2300;
      const t = new Bd(x, base);
      t.trap(x, base, 80, 64, 900);
      t.winGrid(x - 30, base - 900, 60, 900, 16, 30, 5, 11);
      t.rect(x - 40, base - 912, 80, 12);
      t.trap(x, base - 912, 50, 36, 300);
      t.rect(x - 70, 2050, 140, 7); // banner crossbar
      t.ell(x, 2020, 20, 26);
      t.tri(x, 2010, 12, 230);
      FS.paintTower(g, t, { body: warm, under: 1.3, rim: 1.2, rimW: 5, windows: true, winP: 0.55 });
      FS.bannerTower = t;
    }
  };

  // ---------------------------------------------------------------- the ward dome (after fires so it sits on top)
  FS.drawWard = function (g) {
    const W = FS.ward;
    if (!W) return;
    const r = FS.rng('ward');
    FS.reset(g);
    g.save();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, W.x, W.y - 20, W.r * 1.6, [80, 140, 255], 0.22);
    g.beginPath();
    g.ellipse(W.x, W.y, W.r, W.r * 1.05, 0, Math.PI, Math.PI * 2);
    const gr = g.createRadialGradient(W.x, W.y, W.r * 0.5, W.x, W.y, W.r * 1.05);
    gr.addColorStop(0, 'rgba(60,110,255,0.04)');
    gr.addColorStop(0.85, 'rgba(90,150,255,0.18)');
    gr.addColorStop(1, 'rgba(180,220,255,0.5)');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(170,215,255,0.8)';
    g.lineWidth = 2.5;
    g.stroke();
    // hex-lattice hint
    g.strokeStyle = 'rgba(140,190,255,0.16)';
    g.lineWidth = 1.2;
    for (let a = Math.PI * 1.1; a < Math.PI * 1.95; a += 0.18) {
      g.beginPath();
      g.moveTo(W.x, W.y);
      g.lineTo(W.x + Math.cos(a) * W.r, W.y + Math.sin(a) * W.r * 1.05);
      g.stroke();
    }
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.ellipse(W.x, W.y, W.r * k / 4 * 1.0, W.r * 1.05 * (k / 4) * 1.0, 0, Math.PI, Math.PI * 2);
      g.stroke();
    }
    // staff light
    FS.glow(g, W.sx, W.sy, 30, [150, 200, 255], 0.9);
    FS.glow(g, W.sx, W.sy, 8, [255, 255, 255], 1);
    // embers deflecting off the dome
    for (let k = 0; k < 12; k++) {
      const a = Math.PI * (1.15 + r.f() * 0.7);
      const px = W.x + Math.cos(a) * W.r,
        py = W.y + Math.sin(a) * W.r * 1.05;
      FS.glow(g, px, py, 10, [255, 200, 120], 0.6);
      g.strokeStyle = 'rgba(255,200,120,0.7)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.cos(a) * 18, py + Math.sin(a) * 18);
      g.stroke();
    }
    g.restore();
  };

  // ---------------------------------------------------------------- the burning banner (strip 12)
  FS.drawBanner = function (g) {
    const r = FS.rng('banner');
    FS.reset(g);
    const x0 = 2300,
      y0 = 2056;
    g.save();
    // hanging banner: torn, flapping toward the vortex
    const L = [],
      R = [];
    const len = 330;
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const sway = Math.sin(u * 4.2) * 10 * u + u * u * 36;
      L.push([x0 - 26 + sway, y0 + u * len]);
      R.push([x0 + 26 + sway + u * 4, y0 + u * len * 0.95]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (const p of L) g.lineTo(p[0], p[1]);
    // torn burning edge
    const e = L[L.length - 1],
      f = R[R.length - 1];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      g.lineTo(e[0] + (f[0] - e[0]) * u, e[1] + (f[1] - e[1]) * u - (k % 2 ? 26 : 0) - r.f() * 14);
    }
    for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
    const bg = g.createLinearGradient(x0 - 30, 0, x0 + 40, 0);
    bg.addColorStop(0, '#0e1638');
    bg.addColorStop(0.5, '#22306e');
    bg.addColorStop(1, '#0a1030');
    g.fillStyle = bg;
    g.fill();
    // fire light on the cloth
    const fg = g.createLinearGradient(0, y0 + len, 0, y0 + len * 0.4);
    fg.addColorStop(0, 'rgba(255,120,30,0.55)');
    fg.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = fg;
    g.fill();
    // the crescent sigil
    const sx = x0 + 6 + 10 * 0.35,
      sy = y0 + 110;
    g.fillStyle = 'rgba(240,200,110,0.95)';
    g.beginPath();
    g.arc(sx, sy, 15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a2560';
    g.beginPath();
    g.arc(sx + 7, sy - 4, 13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(240,200,110,0.95)';
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(sx - 10 + k * 10, sy + 34, 2.5, 0, Math.PI * 2);
      g.fill();
    }
    // flames eating the bottom edge
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) {
      const u = k / 6;
      const px = e[0] + (f[0] - e[0]) * u,
        py = e[1] + (f[1] - e[1]) * u - 10;
      FS.tongue(g, px, py + 6, 30 + r.f() * 46, 14, { sway: 6, phase: r.f() * 6, lean: 0.3, c0: [255, 230, 150], c1: [255, 120, 30], c2: [150, 30, 8], alpha: 0.8 });
    }
    FS.glow(g, (e[0] + f[0]) / 2, e[1] - 10, 60, [255, 130, 40], 0.4);
    g.globalCompositeOperation = 'source-over';
    // a torn scrap drifting away, burning
    g.save();
    g.translate(2350, 2520);
    g.rotate(0.6);
    g.fillStyle = '#1a2560';
    g.beginPath();
    g.moveTo(-14, -18);
    g.lineTo(16, -14);
    g.lineTo(10, 18);
    g.lineTo(-12, 12);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, 6, 14, 22, [255, 140, 40], 0.6);
    g.restore();
    g.restore();
  };

  // ---------------------------------------------------------------- sky stories
  FS.drawFloatingIsland = function (g) {
    // S4: a floating island with a cottage; water spills off its edge into nothing
    const r = FS.rng('island');
    FS.reset(g);
    const x = 700,
      y = 1960;
    const col = [16, 16, 34];
    const t = new FS.Builder(x, y);
    const pts = [[x - 78, y]];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      pts.push([x - 74 + 148 * u + (r.f() - 0.5) * 6, y + 12 + 150 * Math.pow(Math.sin(Math.PI * u), 1.4) * (0.8 + 0.35 * r.f())]);
    }
    pts.push([x + 78, y]);
    t.poly(pts);
    // grass lip
    t.rect(x - 80, y - 4, 160, 6);
    // the upside-down tower hanging beneath
    t.trap(x + 6, y + 150, 26, 18, -110);
    t.rect(x - 4, y + 255, 20, 10);
    t.tri(x + 6, y + 255, 14, -60);
    // cottage
    t.rect(x - 30, y - 52, 46, 50);
    t.poly([
      [x - 38, y - 50],
      [x - 7, y - 86],
      [x + 24, y - 50],
    ]);
    t.rect(x + 6, y - 90, 8, 22);
    // tree
    t.rect(x + 46, y - 50, 5, 50);
    t.ell(x + 48, y - 64, 22, 22);
    t.ell(x + 36, y - 52, 14, 13);
    FS.paintTower(g, t, { body: col, under: 0.3, rim: 1.3, rimW: 4 });
    g.fillStyle = 'rgba(255,200,120,0.95)';
    g.fillRect(x - 20, y - 36, 10, 12);
    g.fillRect(x + 1, y + 192, 6, 9);
    g.save();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, x - 15, y - 30, 26, [255, 190, 110], 0.35);
    // first ember has landed on the roof
    FS.fireMass(g, x - 18, y - 68, 14, 20, 1, r);
    g.restore();
    // a figure at the door, looking at the roof
    FS.figure(g, x + 26, y - 2, 26, { flip: true, armF: [2.4, 0.4], col: [10, 10, 24] });
    // water spilling off the edge and dissolving into mist
    g.save();
    for (let k = 0; k < 26; k++) {
      const x0 = x - 76 + r.f() * 8;
      const pts = [];
      for (let yy = 0; yy < 220; yy += 10) pts.push([x0 - Math.sqrt(yy) * 1.6 - k * 0.1, y + 4 + yy]);
      g.strokeStyle = `rgba(170,190,255,${0.25 * (1 - k / 30)})`;
      g.lineWidth = 1.4;
      FS.smoothLine(g, pts);
      g.stroke();
    }
    FS.glow(g, x - 92, y + 220, 50, [140, 160, 230], 0.15);
    g.restore();
  };

  FS.drawLanterns = function (g) {
    // floating paper lanterns rising over the calm city (strips 1-6), the last ones catching fire
    const r = FS.rng('lanterns');
    FS.reset(g);
    g.save();
    const placed = [];
    for (let k = 0; k < 120 && placed.length < 46; k++) {
      let x = Math.pow(r.f(), 1.35) * 1250;
      x = FS.safeX(x, 14);
      const y = 1400 + r.f() * 1700;
      if (Math.hypot(x - FS.MOON.x, y - FS.MOON.y) < FS.MOON.r + 20) continue;
      if (placed.some((p) => Math.hypot(p[0] - x, p[1] - y) < 70)) continue;
      placed.push([x, y]);
      const s = 7 + r.f() * 9 * (1 - y / 4000);
      const burning = x > 950 && r.f() < 0.7;
      g.globalCompositeOperation = 'lighter';
      FS.glow(g, x, y, s * 4, burning ? [255, 120, 40] : [255, 170, 90], 0.3);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = burning ? 'rgba(255,170,70,0.95)' : 'rgba(255,205,140,0.95)';
      g.beginPath();
      g.moveTo(x - s * 0.55, y - s);
      g.lineTo(x + s * 0.55, y - s);
      g.lineTo(x + s * 0.42, y + s * 0.6);
      g.lineTo(x - s * 0.42, y + s * 0.6);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,245,215,0.9)';
      g.fillRect(x - s * 0.2, y - s * 0.4, s * 0.4, s * 0.8);
      if (burning) {
        g.globalCompositeOperation = 'lighter';
        FS.tongue(g, x, y - s * 0.8, s * 2.5, s * 1.1, { sway: 3, lean: 0.3, phase: r.f() * 6, c0: [255, 220, 140], c1: [255, 110, 25], c2: [140, 30, 8], alpha: 0.8 });
        g.globalCompositeOperation = 'source-over';
      }
    }
    g.restore();
  };

  FS.drawBirds = function (g) {
    // S6 (sky): a flock of birds fleeing west, away from the first glow
    const r = FS.rng('birds');
    FS.reset(g);
    g.save();
    g.fillStyle = FS.css([14, 10, 22]);
    g.strokeStyle = FS.css([14, 10, 22]);
    g.lineCap = 'round';
    const cx = 1100,
      cy = 1520;
    for (let k = 0; k < 17; k++) {
      // loose V heading left
      const row = Math.floor(k / 2) * (k % 2 ? 1 : -1);
      const x = cx - 50 + Math.abs(row) * 11 + r.range(-6, 6) + k * 0.5;
      const y = cy + row * 13 + r.range(-6, 6);
      if (x < 1022 || x > 1178) continue;
      const s = 5 + r.f() * 4;
      const flap = r.f();
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(x - s * 1.6, y - s * (0.4 + flap));
      g.quadraticCurveTo(x - s * 0.6, y - s * 0.3, x, y);
      g.quadraticCurveTo(x + s * 0.6, y - s * 0.3, x + s * 1.6, y - s * (0.4 + flap));
      g.stroke();
      g.beginPath();
      g.ellipse(x, y + 0.5, s * 0.5, s * 0.22, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };

  FS.drawAirship = function (g) {
    // S10: an airship fleeing the fire, tail alight
    const r = FS.rng('airship');
    FS.reset(g);
    const x = 1902,
      y = 1520;
    g.save();
    g.translate(x, y);
    g.rotate(-0.16);
    // smoke trail
    for (let k = 0; k < 18; k++) {
      const pts = [];
      for (let u = 0; u < 1; u += 0.1) pts.push([58 + u * 160 + r.f() * 4, 6 + Math.sin(u * 3 + k) * 8 - u * 20 + (r.f() - 0.5) * 30 * u]);
      FS.bristle(g, pts, 6 + r.f() * 10, [40, 22, 18], 0.25, r);
    }
    const col = [20, 12, 12];
    g.fillStyle = FS.css(col);
    // envelope
    g.beginPath();
    g.ellipse(0, 0, 66, 21, 0, 0, Math.PI * 2);
    g.fill();
    // fins
    g.beginPath();
    g.moveTo(46, -6);
    g.lineTo(74, -28);
    g.lineTo(70, -4);
    g.closePath();
    g.moveTo(46, 6);
    g.lineTo(74, 26);
    g.lineTo(70, 4);
    g.closePath();
    g.fill();
    // gondola
    g.fillRect(-26, 23, 44, 12);
    g.strokeStyle = FS.css(col);
    g.lineWidth = 1.2;
    g.beginPath();
    for (const k of [-22, -6, 10]) {
      g.moveTo(k, 18);
      g.lineTo(k, 24);
    }
    g.stroke();
    // propeller
    g.fillRect(-30, 26, 4, 6);
    g.fillRect(-36, 20, 3, 18);
    // rim light from the fire below/right
    g.strokeStyle = FS.css(FS.fire(0.8), 0.8);
    g.lineWidth = 2.2;
    g.beginPath();
    g.ellipse(0, 0, 66, 21, 0, -0.2, Math.PI * 0.95);
    g.stroke();
    // ribs
    g.strokeStyle = 'rgba(255,150,70,0.25)';
    g.lineWidth = 1;
    for (let k = -50; k <= 50; k += 14) {
      g.beginPath();
      g.ellipse(k, 0, 3, 20 * Math.sqrt(1 - (k / 66) ** 2), 0, -Math.PI / 2, Math.PI / 2);
      g.stroke();
    }
    // lit gondola windows
    g.fillStyle = 'rgba(255,215,140,0.95)';
    for (let k = -22; k < 14; k += 9) g.fillRect(k, 26, 5, 4);
    // tail fire
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, 66, 0, 50, [255, 120, 30], 0.45);
    for (let k = 0; k < 6; k++)
      FS.tongue(g, 58 + r.f() * 14, 8 - r.f() * 14, 26 + r.f() * 30, 12, { sway: 5, lean: 0.9, phase: r.f() * 6, c0: [255, 230, 150], c1: [255, 120, 30], c2: [150, 30, 8], alpha: 0.75 });
    g.restore();
  };

  FS.drawPhoenix = function (g) {
    // S16: a bird made of fire rising into the cyclone; embers fall upward around it
    const r = FS.rng('phoenix');
    FS.reset(g);
    const x = 3098,
      y = 2040;
    g.save();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, x, y, 150, [255, 120, 30], 0.35);
    // tail plumes
    for (let k = 0; k < 7; k++) {
      const pts = [];
      const sp = (k - 3) * 0.12;
      for (let u = 0; u <= 1; u += 0.06) pts.push([x - 4 + Math.sin(u * 3 + k) * 10 * u + sp * u * 200, y + 18 + u * 210]);
      FS.bristle(g, pts, 10 - Math.abs(k - 3) * 1.5, FS.fire(0.7), 0.5, r);
    }
    // wings swept up
    for (const s of [-1, 1]) {
      for (let k = 0; k < 9; k++) {
        const pts = [];
        const ang = -0.5 - k * 0.07;
        for (let u = 0; u <= 1; u += 0.07) {
          const px = x + s * u * (70 - k * 2.5);
          const py = y - 4 + Math.sin(u * Math.PI) * -26 * (1 - k * 0.06) - u * u * (36 + k * 5) + k * 3;
          pts.push([px, py]);
        }
        FS.bristle(g, pts, 5 + (9 - k) * 0.8, FS.fire(0.72 + k * 0.025), 0.55, r);
      }
    }
    // body + head
    FS.glow(g, x, y + 2, 30, [255, 230, 170], 0.8, 1.4);
    g.fillStyle = 'rgba(255,245,220,0.95)';
    g.beginPath();
    g.ellipse(x, y + 4, 7, 20, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(x + 1, y - 20, 6, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(x + 5, y - 22);
    g.lineTo(x + 14, y - 18);
    g.lineTo(x + 5, y - 17);
    g.fill();
    // upward-falling embers
    for (let k = 0; k < 70; k++) {
      const px = 3020 + r.f() * 160,
        py = 1500 + r.f() * 1500;
      const len = 6 + r.f() * 22;
      g.strokeStyle = FS.css(FS.fire(0.75 + r.f() * 0.25), 0.7);
      g.lineWidth = 1.2 + r.f() * 1.8;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + 2, py - len);
      g.stroke();
    }
    g.restore();
  };

  FS.drawStairClimber = function (g) {
    // S17: a small figure climbing the staircase of flame
    const steps = (FS.stairSteps || []).filter((s) => s.z > 0.2 && s.x > 3232 && s.x < 3370 && s.y > 1100 && s.y < 2600);
    console.log('climber candidates', steps.length);
    if (!steps.length) return;
    steps.sort((a, b) => Math.abs(a.y - 2050) - Math.abs(b.y - 2050));
    const s = steps[0];
    FS.reset(g);
    FS.figure(g, s.x, s.y - 1, 40, { flip: true, stride: 0.45, armF: [0.9, 0.6], armB: [-0.4, 0.4], cloak: 0.8, col: [14, 6, 6], lean: -0.1 });
    g.save();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, s.x - 12, s.y - 34, 26, [150, 200, 255], 0.75);
    FS.glow(g, s.x - 12, s.y - 34, 6, [235, 245, 255], 1);
    g.restore();
    FS.climber = s;
  };

  FS.drawFloatingHouse = function (g) {
    // S19: a whole house, its window still lit, lifted into the vortex
    const r = FS.rng('fhouse');
    FS.reset(g);
    const x = 3708,
      y = 1700;
    g.save();
    g.translate(x, y);
    g.rotate(0.38);
    const t = new FS.Builder(0, 0);
    t.rect(-34, -30, 68, 52);
    t.poly([
      [-42, -28],
      [0, -66],
      [42, -28],
    ]);
    t.rect(16, -62, 9, 22);
    // clump of earth under it
    t.poly([
      [-40, 22],
      [40, 22],
      [26, 40],
      [6, 64],
      [-14, 44],
      [-30, 36],
    ]);
    FS.paintTower(g, t, { body: [18, 8, 7], under: 0, rim: 1.4, rimW: 4 });
    g.fillStyle = 'rgba(255,220,150,0.95)';
    g.fillRect(-20, -14, 12, 14);
    g.fillRect(6, -14, 12, 14);
    g.fillStyle = 'rgba(30,14,10,1)';
    g.fillRect(-15, -14, 2, 14);
    g.fillRect(-20, -8, 12, 2);
    // dangling roots
    g.strokeStyle = 'rgba(18,8,7,1)';
    g.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.moveTo(-20 + k * 10, 40);
      g.quadraticCurveTo(-24 + k * 12, 60, -18 + k * 10, 70 + r.f() * 20);
      g.stroke();
    }
    g.restore();
    // a tree and a chair orbiting with it
    g.save();
    g.translate(3654, 1600);
    g.rotate(-0.9);
    g.fillStyle = FS.css([18, 8, 7]);
    g.fillRect(-2, -26, 4, 30);
    g.beginPath();
    g.arc(0, -32, 13, 0, Math.PI * 2);
    g.arc(-8, -24, 8, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.save();
    g.translate(3752, 1806);
    g.rotate(1.1);
    g.fillStyle = FS.css([18, 8, 7]);
    g.fillRect(-7, -2, 14, 3);
    g.fillRect(-7, -14, 3, 22);
    g.fillRect(4, -2, 3, 10);
    g.restore();
  };

  FS.drawCitadelKeeper = function (g) {
    // S18: the keeper on the battlements raises a blue lamp at the foot of the storm
    const C = FS.citadel;
    FS.reset(g);
    const x = 3456,
      y = C.top - 82;
    const hd = FS.figure(g, x, y, 30, { robe: true, hood: true, hat: 'hood', armF: [2.8, 0.1], armB: [0.3, 0.2], col: [10, 6, 10] });
    g.save();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, hd.front[0], hd.front[1] - 4, 40, [110, 170, 255], 0.75);
    FS.glow(g, hd.front[0], hd.front[1] - 4, 7, [230, 245, 255], 1);
    g.restore();
  };

  // ---------------------------------------------------------------- lake + bridge stories
  FS.drawBoat = function (g) {
    // S6: a boatman poles away across the lake, lantern at the bow
    const r = FS.rng('boat');
    FS.reset(g);
    const x = 1100,
      y = 3520;
    g.save();
    // reflection of the lantern
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `rgba(255,190,110,${0.35 - k * 0.022})`;
      g.lineWidth = 2;
      const yy = y + 10 + k * 7;
      const w = 6 + k * 1.5;
      g.beginPath();
      g.moveTo(x - 48 - w + r.f() * 4, yy);
      g.lineTo(x - 48 + w, yy);
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    // lantern light around the boat and a pale wake
    FS.glow(g, x - 30, y - 20, 110, [255, 170, 90], 0.3, 0.6);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(200,190,230,0.35)';
    g.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(x + 58, y - 2 + k * 3);
      g.quadraticCurveTo(x + 110, y + 4 + k * 6, x + 170 - k * 18, y + 8 + k * 8);
      g.stroke();
    }
    // hull
    g.fillStyle = FS.css([10, 8, 14]);
    g.beginPath();
    g.moveTo(x - 62, y - 12);
    g.quadraticCurveTo(x - 50, y + 6, x, y + 6);
    g.quadraticCurveTo(x + 48, y + 6, x + 60, y - 16);
    g.lineTo(x + 52, y - 4);
    g.lineTo(x - 54, y - 4);
    g.closePath();
    g.fill();
    // bow post + lantern
    g.strokeStyle = FS.css([10, 8, 14]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 56, y - 6);
    g.lineTo(x - 50, y - 46);
    g.lineTo(x - 44, y - 46);
    g.stroke();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, x - 46, y - 38, 40, [255, 180, 100], 0.5);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(255,220,150,1)';
    g.fillRect(x - 49, y - 44, 7, 10);
    // the boatman with a long pole
    const hd = FS.figure(g, x + 34, y - 4, 40, { armF: [1.0, -0.4], armB: [0.7, 0.2], col: [10, 8, 14], hat: 'cap', lean: 0.1 });
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(hd.front[0] - 30, hd.front[1] - 40);
    g.lineTo(hd.front[0] + 34, y + 30);
    g.stroke();
    g.restore();
  };

  FS.drawBridgeStories = function (g) {
    const r = FS.rng('bstories');
    FS.reset(g);
    const D = FS.DECK;
    const night = [8, 8, 16];
    // S2: the lantern-seller releasing lanterns toward the moon
    {
      g.save();
      g.translate(300, D);
      g.scale(1.3, 1.3);
      g.translate(-300, -D);
      const x = 300;
      g.save();
      g.globalCompositeOperation = 'lighter';
      FS.glow(g, x - 14, D - 40, 70, [255, 170, 90], 0.35);
      g.restore();
      const hd = FS.figure(g, x - 8, D, 52, { armF: [2.6, 0.3], armB: [0.6, 0.6], col: night, hat: 'hood', robe: true });
      // pole over the shoulder with lanterns
      g.strokeStyle = FS.css(night);
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(x - 40, D - 66);
      g.lineTo(x + 18, D - 32);
      g.stroke();
      const lan = [
        [x - 34, D - 56],
        [x - 22, D - 49],
        [x - 10, D - 42],
      ];
      for (const [lx, ly] of lan) {
        g.globalCompositeOperation = 'lighter';
        FS.glow(g, lx, ly + 6, 18, [255, 170, 90], 0.35);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = 'rgba(255,205,140,0.95)';
        g.fillRect(lx - 3.5, ly + 2, 7, 9);
      }
      // two just released
      const rel = [
        [hd.front[0] + 6, hd.front[1] - 28, 6],
        [hd.front[0] - 12, hd.front[1] - 70, 7],
      ];
      for (const [lx, ly, s] of rel) {
        g.globalCompositeOperation = 'lighter';
        FS.glow(g, lx, ly, s * 4, [255, 170, 90], 0.4);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = 'rgba(255,210,150,1)';
        g.beginPath();
        g.moveTo(x - 0 + lx - x - s * 0.55, ly - s);
        g.lineTo(lx + s * 0.55, ly - s);
        g.lineTo(lx + s * 0.42, ly + s * 0.6);
        g.lineTo(lx - s * 0.42, ly + s * 0.6);
        g.fill();
      }
      g.restore();
    }
    // S9: a bucket chain on the bridge
    {
      g.save();
      g.translate(1700, D);
      g.scale(1.3, 1.3);
      g.translate(-1700, -D);
      const xs = [1640, 1678, 1716, 1756];
      const col = [12, 6, 6];
      FS.figure(g, xs[0], D, 50, { armF: [1.4, 0.3], armB: [1.2, 0.5], col, stride: 0.2 });
      FS.figure(g, xs[1], D, 47, { flip: true, armF: [1.3, 0.2], armB: [1.1, 0.4], col, stride: 0.15, hat: 'cap' });
      FS.figure(g, xs[2], D, 51, { armF: [1.5, 0.1], armB: [1.4, 0.3], col, stride: 0.2 });
      const hd = FS.figure(g, xs[3], D, 48, { armF: [2.4, 0.4], armB: [2.2, 0.5], col, stride: 0.35, lean: 0.12 });
      // buckets
      g.fillStyle = FS.css(col);
      for (const bx of [1659, 1697]) {
        g.beginPath();
        g.moveTo(bx - 6, D - 30);
        g.lineTo(bx + 6, D - 30);
        g.lineTo(bx + 4.5, D - 19);
        g.lineTo(bx - 4.5, D - 19);
        g.fill();
      }
      // water thrown in an arc, catching the firelight
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 30; k++) {
        const u = r.f();
        const px = hd.front[0] + u * 30,
          py = hd.front[1] - Math.sin(u * Math.PI) * 30 - 6 + u * 20 + (r.f() - 0.5) * 6;
        g.fillStyle = `rgba(170,210,255,${0.5 + 0.4 * r.f()})`;
        g.beginPath();
        g.arc(px, py, 1 + r.f() * 1.8, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      g.restore();
    }
    // S15: someone walks the bridge under an umbrella through the ember rain
    {
      g.save();
      g.translate(2906, D);
      g.scale(1.3, 1.3);
      g.translate(-2906, -D);
      const x = 2906;
      const col = [12, 5, 4];
      const hd = FS.figure(g, x, D, 52, { flip: true, stride: 0.3, armF: [2.5, 0.6], armB: [0.3, 0.3], col, cloak: 0.6 });
      g.fillStyle = FS.css(col);
      g.strokeStyle = FS.css(col);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(hd.front[0], hd.front[1]);
      g.lineTo(hd.front[0] + 3, hd.front[1] - 30);
      g.stroke();
      const ux = hd.front[0] + 3,
        uy = hd.front[1] - 30;
      g.beginPath();
      g.moveTo(ux - 36, uy + 10);
      g.quadraticCurveTo(ux, uy - 26, ux + 36, uy + 10);
      for (let k = 0; k < 4; k++) g.quadraticCurveTo(ux + 27 - k * 18, uy + 4, ux + 18 - k * 18, uy + 10);
      g.closePath();
      g.fill();
      g.strokeStyle = FS.css(FS.fire(0.8), 0.8);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(ux - 36, uy + 10);
      g.quadraticCurveTo(ux, uy - 26, ux + 36, uy + 10);
      g.stroke();
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI * (0.15 + r.f() * 0.7);
        const px = ux + Math.cos(a) * 34,
          py = uy + 6 + Math.sin(a) * 16;
        FS.glow(g, px, py, 6, [255, 200, 120], 0.7);
        g.strokeStyle = 'rgba(255,190,110,0.6)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(a) * 10, py + Math.sin(a) * 10 - 4);
        g.stroke();
      }
      g.restore();
      g.restore();
    }
    // S20: the observer at the end of the bridge, a blue lamp raised to the storm
    {
      g.save();
      g.translate(3884, D);
      g.scale(1.3, 1.3);
      g.translate(-3884, -D);
      const x = 3884;
      const col = [10, 5, 5];
      const hd = FS.figure(g, x, D, 54, { flip: true, stride: 0.1, armF: [2.75, 0.15], armB: [0.25, 0.2], col, cloak: 1, hat: 'hood' });
      g.save();
      g.globalCompositeOperation = 'lighter';
      FS.glow(g, hd.front[0], hd.front[1] - 6, 56, [110, 170, 255], 0.7);
      FS.glow(g, hd.front[0], hd.front[1] - 6, 9, [235, 245, 255], 1);
      g.restore();
      g.strokeStyle = FS.css(col);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(hd.front[0], hd.front[1]);
      g.lineTo(hd.front[0], hd.front[1] - 4);
      g.stroke();
      // a dog beside them
      g.fillStyle = FS.css(col);
      g.save();
      g.translate(x + 26, D);
      g.beginPath();
      g.ellipse(0, -14, 12, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(-12, -22, 5, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-14, -27);
      g.lineTo(-11, -33);
      g.lineTo(-9, -26);
      g.fill();
      g.lineWidth = 2.4;
      g.lineCap = 'round';
      g.beginPath();
      for (const lx of [-8, -4, 6, 10]) {
        g.moveTo(lx, -12);
        g.lineTo(lx, -1);
      }
      g.moveTo(11, -16);
      g.quadraticCurveTo(18, -22, 17, -28);
      g.stroke();
      g.restore();
      g.restore();
    }
  };

  // S14: a lit doorway with a figure watching the fire whirl
  FS.drawDoorway = function (g) {
    FS.reset(g);
    const x = 2752,
      base = 3302;
    const t = new FS.Builder(x, base);
    t.rect(x - 36, base - 120, 72, 120);
    t.poly([
      [x - 44, base - 118],
      [x, base - 160],
      [x + 44, base - 118],
    ]);
    FS.paintTower(g, t, { body: [14, 6, 5], under: 1.2, rim: 1, rimW: 3.5 });
    g.fillStyle = 'rgba(255,170,80,1)';
    g.fillRect(x - 14, base - 58, 28, 58);
    g.save();
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, x, base - 30, 50, [255, 150, 60], 0.45);
    g.restore();
    FS.figure(g, x - 2, base, 44, { flip: true, armF: [2.1, 0.9], armB: [0.2, 0.2], col: [20, 8, 4], stride: 0.08 });
  };
})();
