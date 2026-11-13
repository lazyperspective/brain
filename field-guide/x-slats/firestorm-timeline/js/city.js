// City: tower builders, far/mid/near layers, rim light, windows, the citadel.
(function () {
  'use strict';
  const FS = window.FS;
  const { clamp, sstep, mix } = FS;

  // ---------------------------------------------------------------- builder
  class B {
    constructor(x, base) {
      this.x = x;
      this.base = base;
      this.path = new Path2D();
      this.wins = [];
      this.roofs = [];
      this.tip = [x, base];
      this.minX = 1e9;
      this.maxX = -1e9;
      this.top = base;
      this.maxY = base;
    }
    _ext(pts) {
      for (const p of pts) {
        if (p[0] < this.minX) this.minX = p[0];
        if (p[0] > this.maxX) this.maxX = p[0];
        if (p[1] > this.maxY) this.maxY = p[1];
        if (p[1] < this.top) {
          this.top = p[1];
          this.tip = [p[0], p[1]];
        }
      }
    }
    poly(pts) {
      let a = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i],
          q = pts[(i + 1) % pts.length];
        a += p[0] * q[1] - q[0] * p[1];
      }
      if (a < 0) pts = pts.slice().reverse();
      this.path.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) this.path.lineTo(pts[i][0], pts[i][1]);
      this.path.closePath();
      this._ext(pts);
      return this;
    }
    rect(x, y, w, h) {
      return this.poly([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ]);
    }
    trap(cx, yb, wb, wt, h) {
      return this.poly([
        [cx - wb / 2, yb],
        [cx - wt / 2, yb - h],
        [cx + wt / 2, yb - h],
        [cx + wb / 2, yb],
      ]);
    }
    tri(cx, yb, wb, h) {
      return this.poly([
        [cx - wb / 2, yb],
        [cx, yb - h],
        [cx + wb / 2, yb],
      ]);
    }
    ell(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 28) {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
      }
      return this.poly(pts);
    }
    onion(cx, yb, R, h) {
      const pts = [];
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const rx = R * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.25 + 0.12)), 0.85) * Math.pow(1 - u, 0.35);
        pts.push([cx - rx, yb - u * h]);
      }
      for (let i = n; i >= 0; i--) {
        const u = i / n;
        const rx = R * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.25 + 0.12)), 0.85) * Math.pow(1 - u, 0.35);
        pts.push([cx + rx, yb - u * h]);
      }
      return this.poly(pts);
    }
    winGrid(x0, y0, w, h, sx, sy, ww, wh, p = 1) {
      for (let y = y0 + sy * 0.5; y + wh < y0 + h - 4; y += sy) {
        const n = Math.max(1, Math.floor((w - 6) / sx));
        const off = x0 + (w - (n - 1) * sx) / 2 - ww / 2;
        for (let i = 0; i < n; i++) this.wins.push({ x: off + i * sx, y, w: ww, h: wh, p });
      }
      return this;
    }
  }
  FS.Builder = B;

  // ---------------------------------------------------------------- tower types
  const T = {};
  T.needle = (x, b, w, h, r) => {
    const t = new B(x, b);
    const bh = h * r.range(0.3, 0.42);
    t.trap(x, b, w, w * 0.86, bh);
    t.winGrid(x - w * 0.43, b - bh, w * 0.86, bh, 13, 24, 5, 10);
    t.rect(x - w * 0.6, b - bh - 9, w * 1.2, 9);
    const sh = h * 0.82 - bh;
    t.trap(x, b - bh - 9, w * 0.6, w * 0.3, sh);
    t.winGrid(x - w * 0.25, b - bh - sh, w * 0.5, sh, 12, 34, 4, 9, 0.6);
    t.rect(x - w * 0.36, b - h * 0.82 - 7, w * 0.72, 7);
    t.ell(x, b - h * 0.86, w * 0.2, w * 0.28);
    t.tri(x, b - h * 0.84, w * 0.13, h * 0.16);
    t.roofs.push([x, b - bh - 9, w * 1.1], [x, b - h * 0.82 - 7, w * 0.6]);
    return t;
  };
  T.tiered = (x, b, w, h, r) => {
    const t = new B(x, b);
    const n = r.int(4, 6);
    let y = b,
      tw = w;
    const spike = h * 0.16;
    const each = (h - spike) / (n + 0.5);
    for (let i = 0; i < n; i++) {
      const th = each * (1.25 - i * 0.12);
      t.rect(x - tw / 2, y - th, tw, th);
      t.winGrid(x - tw / 2, y - th, tw, th, 15, 22, 5, 9);
      y -= th;
      // eave with upturned tips
      const ew = tw * 1.45,
        eh = Math.max(7, th * 0.16);
      t.poly([
        [x - ew / 2 - 6, y - eh - 7],
        [x - ew / 2 + 6, y - eh * 0.4],
        [x - tw * 0.3, y - eh * 1.5],
        [x + tw * 0.3, y - eh * 1.5],
        [x + ew / 2 - 6, y - eh * 0.4],
        [x + ew / 2 + 6, y - eh - 7],
        [x + ew / 2 - 4, y + 2],
        [x - ew / 2 + 4, y + 2],
      ]);
      t.roofs.push([x, y - eh, ew * 0.8]);
      y -= eh * 1.5;
      tw *= 0.8;
    }
    t.tri(x, y, tw * 0.28, spike);
    return t;
  };
  T.dome = (x, b, w, h, r) => {
    const t = new B(x, b);
    const bh = h * 0.5;
    t.rect(x - w / 2, b - bh, w, bh);
    t.winGrid(x - w / 2, b - bh, w, bh, 14, 26, 5, 11);
    t.rect(x - w * 0.38, b - bh - h * 0.08, w * 0.76, h * 0.08 + 1);
    const dh = h * 0.3;
    t.onion(x, b - bh - h * 0.08 + 2, w * 0.56, dh);
    t.rect(x - 1.5, b - h, 3, h * 0.14);
    t.ell(x, b - h * 0.9, 5, 5);
    t.roofs.push([x, b - bh - h * 0.08, w * 0.7]);
    if (w > 55) {
      for (const sx of [-1, 1]) {
        const mx = x + sx * w * 0.62;
        t.rect(mx - 6, b - h * 0.62, 12, h * 0.62);
        t.tri(mx, b - h * 0.62, 14, h * 0.18);
      }
    }
    return t;
  };
  T.bulb = (x, b, w, h, r) => {
    const t = new B(x, b);
    const sw = w * 0.24;
    const sh = h * 0.66;
    t.trap(x, b, sw * 1.6, sw, sh);
    t.poly([
      [x - sw / 2, b - sh],
      [x - w * 0.58, b - sh - h * 0.08],
      [x + w * 0.58, b - sh - h * 0.08],
      [x + sw / 2, b - sh],
    ]);
    const hh = h * 0.12;
    t.rect(x - w * 0.55, b - sh - h * 0.08 - hh, w * 1.1, hh);
    t.winGrid(x - w * 0.55, b - sh - h * 0.08 - hh, w * 1.1, hh, 13, 20, 5, 9);
    t.tri(x, b - sh - h * 0.08 - hh, w * 1.25, h - sh - h * 0.08 - hh);
    t.roofs.push([x, b - sh - h * 0.2, w]);
    return t;
  };
  T.stack = (x, b, w, h, r) => {
    const t = new B(x, b);
    const n = r.int(3, 5);
    let y = b;
    let cx = x;
    for (let i = 0; i < n; i++) {
      const bw = w * r.range(0.6, 1.25) * (1 - i * 0.06);
      const bh = (h * 0.85 / n) * r.range(0.7, 1.3);
      cx = x + r.range(-0.3, 0.3) * w;
      t.rect(cx - bw / 2, y - bh, bw, bh);
      t.winGrid(cx - bw / 2, y - bh, bw, bh, 13, 21, 5, 9);
      // little cantilever beams
      t.rect(cx - bw / 2 - 6, y - bh, bw + 12, 5);
      y -= bh;
    }
    t.roofs.push([cx, y, w * 0.8]);
    if (r.chance(0.6)) {
      t.rect(cx - 1.5, y - h * 0.15, 3, h * 0.15);
      t.rect(cx + 1.5, y - h * 0.15, 16, 9);
    } else t.tri(cx, y, w * 0.6, h * 0.15);
    return t;
  };
  T.house = (x, b, w, h, r) => {
    const t = new B(x, b);
    t.rect(x - w / 2, b - h, w, h);
    t.winGrid(x - w / 2, b - h, w, h, 16, 22, 6, 10);
    const rh = w * r.range(0.35, 0.7);
    t.poly([
      [x - w / 2 - 5, b - h],
      [x - w * 0.15, b - h - rh],
      [x + w * 0.15, b - h - rh],
      [x + w / 2 + 5, b - h],
    ]);
    if (r.chance(0.7)) {
      const cx = x + r.range(-0.3, 0.3) * w;
      t.rect(cx - 5, b - h - rh * 0.9, 10, rh * 0.6);
    }
    t.roofs.push([x, b - h - rh * 0.5, w * 0.8]);
    return t;
  };
  FS.TOWER = T;

  // ---------------------------------------------------------------- painting
  // light for a tower at x: returns {dir:[dx,dy] toward light, col, a}
  function lightAt(x, y) {
    const calm = FS.calm(x),
      heat = FS.heat(x);
    const M = FS.MOON;
    if (calm > heat) {
      let dx = M.x - x,
        dy = (M.y - y) * 0.5;
      const d = Math.hypot(dx, dy) || 1;
      return { dir: [dx / d, dy / d], col: [175, 185, 245], a: 0.55 * calm };
    }
    // fire light: from below and from the cyclone side
    const v = FS.vortexW(x);
    let dx = 0.75 + 0.2 * v,
      dy = 0.65;
    if (x > 3500) dx = -0.8; // right of the cyclone axis: lit from the left
    const d = Math.hypot(dx, dy);
    return { dir: [dx / d, dy / d], col: FS.fire(0.72 + 0.15 * heat), a: 0.9 * heat };
  }
  FS.lightAt = lightAt;

  FS.paintTower = function (g, t, o) {
    const x = t.x;
    const L = lightAt(x, t.top);
    const heat = FS.heat(x);
    g.save();
    const body = o.body;
    const under = FS.fire(0.6);
    const gr = g.createLinearGradient(0, t.top, 0, Math.max(t.base, t.maxY, t.top + 1));
    gr.addColorStop(0, FS.css(body));
    gr.addColorStop(0.6, FS.css(mix(body, under, 0.18 * heat * o.under)));
    gr.addColorStop(1, FS.css(mix(body, under, 0.5 * heat * o.under)));
    g.fillStyle = gr;
    g.fill(t.path);
    if (o.rim > 0 && L.a > 0.02) {
      g.clip(t.path);
      g.fillStyle = FS.css(L.col, L.a * o.rim);
      g.fill(t.path);
      g.translate(-L.dir[0] * o.rimW, -L.dir[1] * o.rimW);
      g.fillStyle = gr;
      g.fill(t.path);
      g.setTransform(FS.S, 0, 0, FS.S, 0, 0);
      // soft secondary rim
      g.fillStyle = FS.css(L.col, L.a * o.rim * 0.25);
      g.fill(t.path);
      g.translate(-L.dir[0] * o.rimW * 3, -L.dir[1] * o.rimW * 3);
      g.fillStyle = gr;
      g.fill(t.path);
    }
    g.restore();
    if (o.windows) paintWindows(g, t, o);
  };

  function paintWindows(g, t, o) {
    const r = FS.rng('win' + Math.round(t.x) + '_' + Math.round(t.base));
    const heat = FS.heat(t.x);
    const calm = FS.calm(t.x);
    g.save();
    for (const w of t.wins) {
      const lit = r.f() < (o.winP || 0.35) * w.p * (0.6 + 0.8 * heat);
      if (!lit) continue;
      const hot = r.f() < heat * 0.85;
      let c;
      if (hot) c = FS.fire(0.62 + r.f() * 0.3);
      else c = r.chance(0.82) ? [255, 196, 120] : [150, 190, 255];
      const a = hot ? 0.95 : 0.55 + 0.35 * r.f();
      g.fillStyle = FS.css(c, a * (o.winA || 1));
      g.fillRect(w.x, w.y, w.w, w.h);
      if (hot && heat > 0.4 && r.f() < 0.25) {
        g.globalCompositeOperation = 'lighter';
        FS.glow(g, w.x + w.w / 2, w.y + w.h / 2, 18, c, 0.25);
        g.globalCompositeOperation = 'source-over';
      } else if (!hot && calm > 0.3 && r.f() < 0.15) {
        g.globalCompositeOperation = 'lighter';
        FS.glow(g, w.x + w.w / 2, w.y + w.h / 2, 12, c, 0.18);
        g.globalCompositeOperation = 'source-over';
      }
      if (hot) FS.hotWindows.push({ x: w.x + w.w / 2, y: w.y, w: w.w, h: w.h, k: heat });
    }
    g.restore();
  }

  // ---------------------------------------------------------------- far layers
  FS.drawFarLayer = function (g, k) {
    const r = FS.rng('far' + k);
    const N = FS.makeNoise(FS.seed * 7 + k);
    FS.reset(g);
    const base = k === 0 ? 3245 : 3262;
    const dark = k === 0 ? 0.38 : 0.62;
    let x = -60;
    const items = [];
    while (x < 4060) {
      const w = r.range(16, k === 0 ? 46 : 60);
      const env = 0.5 + 0.5 * N.fbm(x * 0.0012, k * 3.3, 3);
      let h = (k === 0 ? 260 : 180) + env * (k === 0 ? 780 : 640) * r.range(0.4, 1.1);
      if (r.chance(0.12)) h *= 1.6;
      // the district under the floating citadel has been swept away
      if (x > 3250 && x < 3750) h *= 0.5;
      if (x > 3340 && x < 3640) h *= 0.35;
      const type = r.pick(['spire', 'spire', 'block', 'dome', 'needle', 'step']);
      items.push({ x, w, h, type });
      x += w * r.range(0.55, 1.05);
    }
    for (const it of items) {
      const cx = it.x + it.w / 2;
      const hz = FS.skyAt(cx, 3050);
      const heat = FS.heat(cx);
      let col = mix(hz, [10, 7, 14], dark);
      col = mix(col, [70, 18, 10], heat * (k === 0 ? 0.2 : 0.35));
      const t = new B(cx, base);
      const w = it.w,
        h = it.h;
      if (it.type === 'spire') {
        t.rect(cx - w / 2, base - h * 0.7, w, h * 0.7);
        t.tri(cx, base - h * 0.7, w * 0.9, h * 0.3);
      } else if (it.type === 'needle') {
        t.trap(cx, base, w * 0.6, w * 0.3, h * 0.85);
        t.tri(cx, base - h * 0.85, w * 0.16, h * 0.4);
      } else if (it.type === 'dome') {
        t.rect(cx - w / 2, base - h * 0.6, w, h * 0.6);
        t.onion(cx, base - h * 0.6 + 1, w * 0.55, h * 0.3);
        t.rect(cx - 1, base - h * 1.02, 2, h * 0.14);
      } else if (it.type === 'step') {
        t.rect(cx - w / 2, base - h * 0.5, w, h * 0.5);
        t.rect(cx - w * 0.35, base - h * 0.8, w * 0.7, h * 0.3);
        t.rect(cx - w * 0.18, base - h, w * 0.36, h * 0.2);
      } else {
        t.rect(cx - w / 2, base - h * 0.55, w, h * 0.55);
      }
      // occasional sky bridge on the far layer
      g.fillStyle = FS.css(col);
      g.fill(t.path);
      // haze toward the base
      // tiny window dots
      const nw = Math.floor((h * w) / 900);
      for (let i = 0; i < nw; i++) {
        if (!r.chance(0.35)) continue;
        const wx = cx + (r.f() - 0.5) * w * 0.7,
          wy = base - r.f() * h * 0.55;
        const hot = r.f() < heat;
        g.fillStyle = FS.css(hot ? FS.fire(0.7 + r.f() * 0.2) : [255, 200, 130], hot ? 0.8 : 0.45);
        g.fillRect(wx, wy, 3, 4);
      }
    }
    // low haze band over the far layer base
    const gr = g.createLinearGradient(0, base - 500, 0, base + 10);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    for (let x0 = 0; x0 < 4000; x0 += 50) {
      const c = FS.skyAt(x0 + 25, 3200);
      const lg = g.createLinearGradient(0, base - 420, 0, base);
      lg.addColorStop(0, FS.css(c, 0));
      lg.addColorStop(1, FS.css(c, k === 0 ? 0.55 : 0.3));
      g.fillStyle = lg;
      g.fillRect(x0, base - 420, 50, 430);
    }
    g.restore();
  };

  // ---------------------------------------------------------------- mid layer
  FS.midTowers = [];
  FS.hotWindows = [];

  FS.buildMid = function () {
    const r = FS.rng('mid');
    const N = FS.makeNoise(FS.seed * 11);
    const towers = [];
    const base = 3285;
    let x = -30;
    // landmark reserve zones [x0,x1,maxH]
    const reserve = [
      [40, 160, 600],
      [420, 580, 420],
      [840, 960, 560],
      [1240, 1360, 500],
      [1420, 1580, 460],
      [1640, 1760, 520],
      [2040, 2160, 260],
      [2240, 2360, 500],
      [2430, 2570, 320],
      [2640, 2760, 260],
      [3380, 3620, 0],
    ];
    while (x < 4040) {
      const w = r.range(40, 104);
      const env = 0.5 + 0.5 * N.fbm(x * 0.0019, 1.7, 3);
      let h = 240 + env * env * 1150 * r.range(0.45, 1.15);
      if (r.chance(0.08)) h *= 1.4;
      let cx = x + w / 2;
      for (const z of reserve) if (cx > z[0] - 30 && cx < z[1] + 30) h = Math.min(h, z[2] || 0);
      if (h > 480) cx = FS.safeX(cx, 34);
      if (h > 120) {
        let type = r.pick(['needle', 'tiered', 'tiered', 'dome', 'dome', 'bulb', 'stack', 'stack']);
        if (h < 380) type = r.pick(['stack', 'dome', 'house']);
        const t = T[type](cx, base + r.range(-8, 6), type === 'house' ? w * 1.2 : w, type === 'house' ? h * 0.4 : h, r);
        t.type = type;
        t.burn = r.f() < FS.heat(cx) * 0.5 && cx > 1300;
        towers.push(t);
      }
      x += w * r.range(0.75, 1.35);
    }
    FS.midTowers = towers;
    return towers;
  };

  FS.drawMid = function (g, towers) {
    FS.reset(g);
    const r = FS.rng('shatter');
    for (const t of towers) {
      const o = {
        body: mix([16, 15, 30], [24, 10, 8], sstep(0.25, 0.5, FS.tt(t.x))),
        under: 1,
        rim: 1,
        rimW: 4.5,
        windows: true,
        winP: 0.32,
      };
      const h = t.base - t.top;
      if (t.x > 3080 && h > 380) {
        // the vortex pulls the tower apart: the crown floats free, pieces lifting toward the axis
        t.burn = false;
        const cut = t.top + h * r.range(0.3, 0.5);
        g.save();
        g.beginPath();
        g.rect(t.minX - 50, cut, t.maxX - t.minX + 100, 4000);
        g.clip();
        FS.paintTower(g, t, o);
        g.restore();
        const pieces = 3;
        let prev = cut;
        for (let k = 0; k < pieces; k++) {
          const y1 = prev,
            y0 = k === pieces - 1 ? t.top - 10 : prev - (cut - t.top) / pieces;
          const lift = 30 + k * 45 + r.f() * 40;
          const toward = (t.x < 3500 ? 1 : -1) * (6 + k * 10);
          g.save();
          g.translate(t.x + toward, (y0 + y1) / 2 - lift);
          g.rotate((r.f() - 0.5) * 0.25 + toward * 0.004);
          g.translate(-t.x, -(y0 + y1) / 2);
          g.beginPath();
          g.rect(t.minX - 50, y0, t.maxX - t.minX + 100, y1 - y0);
          g.clip();
          FS.paintTower(g, t, o);
          g.restore();
          prev = y0;
        }
        // glowing seam where it tore
        g.save();
        g.globalCompositeOperation = 'lighter';
        FS.glow(g, t.x, cut, (t.maxX - t.minX) * 0.8, [255, 140, 50], 0.35, 0.35);
        g.restore();
      } else FS.paintTower(g, t, o);
    }
  };

  // sky bridges between neighbouring mid towers
  FS.drawSkyBridges = function (g, towers) {
    const r = FS.rng('bridges');
    FS.reset(g);
    for (let i = 0; i < towers.length - 1; i++) {
      const a = towers[i],
        b = towers[i + 1];
      if (!r.chance(0.28)) continue;
      if (b.x - a.x > 170 || b.x - a.x < 60) continue;
      if (a.x > 3000) continue;
      const yTop = Math.max(a.top, b.top) + 80;
      const y = yTop + r.f() * (a.base - yTop) * 0.5;
      const x0 = a.x,
        x1 = b.x;
      const sag = r.range(-30, 18);
      const col = mix([16, 15, 30], [24, 10, 8], sstep(0.25, 0.5, FS.tt(a.x)));
      g.strokeStyle = FS.css(col);
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(x0, y);
      g.quadraticCurveTo((x0 + x1) / 2, y + sag, x1, y);
      g.stroke();
      // railing
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x0, y - 12);
      g.quadraticCurveTo((x0 + x1) / 2, y + sag - 12, x1, y - 12);
      g.stroke();
      for (let k = 1; k < 8; k++) {
        const u = k / 8;
        const px = x0 + (x1 - x0) * u;
        const py = (1 - u) * (1 - u) * y + 2 * u * (1 - u) * (y + sag) + u * u * y;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px, py - 12);
        g.stroke();
      }
      const L = lightAt(a.x, y);
      g.strokeStyle = FS.css(L.col, L.a * 0.7);
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(x0, y + 4.5);
      g.quadraticCurveTo((x0 + x1) / 2, y + sag + 4.5, x1, y + 4.5);
      g.stroke();
    }
  };

  // ---------------------------------------------------------------- near shore houses + quay
  FS.drawNear = function (g) {
    const r = FS.rng('near');
    FS.reset(g);
    const base = 3302;
    let x = -20;
    const gaps = [
      [2445, 2560],
      [3330, 3670],
    ]; // waterfall splash, citadel lake
    FS.nearHouses = [];
    while (x < 4030) {
      const w = r.range(40, 95);
      const cx = x + w / 2;
      let skip = false;
      for (const gp of gaps) if (cx > gp[0] - w / 2 && cx < gp[1] + w / 2) skip = true;
      if (!skip) {
        const h = r.range(50, 150) * (cx > 3000 ? 0.7 : 1);
        const t = T.house(cx, base, w, h, r);
        t.burn = r.f() < FS.heat(cx) * 0.7 && cx > 900;
        FS.nearHouses.push(t);
        FS.paintTower(g, t, { body: mix([9, 9, 18], [14, 6, 5], sstep(0.25, 0.5, FS.tt(cx))), under: 1.2, rim: 0.8, rimW: 3.5, windows: true, winP: 0.45 });
      }
      x += w * r.range(0.8, 1.05);
    }
    // quay wall
    for (let x0 = 0; x0 < 4000; x0 += 40) {
      const heat = FS.heat(x0);
      g.fillStyle = FS.css(mix([12, 12, 24], [16, 7, 5], heat));
      g.fillRect(x0, base - 6, 41, 18);
      g.fillStyle = FS.css(heat > FS.calm(x0) ? FS.fire(0.7) : [150, 160, 220], 0.35 * Math.max(heat, FS.calm(x0) * 0.6));
      g.fillRect(x0, base - 6, 41, 2);
    }
  };

  // ---------------------------------------------------------------- the floating citadel (strip 18)
  FS.drawCitadel = function (g) {
    const r = FS.rng('citadel');
    FS.reset(g);
    const x = 3500;
    const top = 2790;
    // floating rock: jagged inverted cone
    const rock = new B(x, top);
    const pts = [];
    // jagged inverted crag: a lumpy profile with a few hanging spurs
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const env = Math.pow(Math.sin(Math.PI * u), 0.9);
      let depth = 190 * env * (0.7 + 0.5 * r.f());
      if (i === 7 || i === 15) depth += 50; // spurs
      if (i === 11) depth = 245;
      const px = x - 98 + 196 * u + (r.f() - 0.5) * 8;
      pts.push([px, top + 8 + depth]);
      if (i % 3 === 1 && i < n) pts.push([px + 4, top + 8 + depth * 0.82]);
    }
    pts.push([x + 96, top]);
    pts.unshift([x - 96, top]);
    rock.poly(pts);
    // towers of the citadel
    const cit = new B(x, top);
    cit.rect(x - 84, top - 70, 168, 72);
    // crenellations
    for (let k = -84; k < 84; k += 14) cit.rect(x + k, top - 82, 8, 13);
    cit.rect(x - 38, top - 260, 76, 200);
    cit.tri(x, top - 258, 92, 120);
    cit.rect(x - 6, top - 560, 12, 200);
    cit.trap(x, top - 380, 30, 12, 60);
    cit.ell(x, top - 470, 15, 20);
    cit.tri(x, top - 488, 10, 160);
    for (const sx of [-1, 1]) {
      const tx = x + sx * 62;
      cit.rect(tx - 15, top - 170, 30, 110);
      cit.tri(tx, top - 168, 38, 85);
    }
    cit.winGrid(x - 30, top - 240, 60, 150, 18, 34, 6, 14);
    FS.paintTower(g, rock, { body: [20, 10, 9], under: 0.4, rim: 1.2, rimW: 5 });
    // underside lit by the burning lake
    g.save();
    g.clip(rock.path);
    const ug = g.createLinearGradient(0, top + 280, 0, top);
    ug.addColorStop(0, FS.css(FS.fire(0.7), 0.45));
    ug.addColorStop(0.5, FS.css(FS.fire(0.45), 0.1));
    ug.addColorStop(1, FS.css(FS.fire(0.4), 0));
    g.fillStyle = ug;
    g.fillRect(x - 120, top, 240, 300);
    // cracks
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      let cx = x + r.range(-70, 70),
        cy = top + 10;
      g.beginPath();
      g.moveTo(cx, cy);
      for (let s2 = 0; s2 < 6; s2++) {
        cx += r.range(-10, 10);
        cy += r.range(15, 35);
        g.lineTo(cx, cy);
      }
      g.stroke();
    }
    g.restore();
    FS.paintTower(g, cit, { body: [14, 8, 10], under: 0.6, rim: 1.4, rimW: 4 });
    // blue ward-light windows: the last calm place
    g.save();
    for (const w of cit.wins) {
      if (r.f() < 0.55) continue;
      g.fillStyle = 'rgba(150,200,255,0.9)';
      g.fillRect(w.x, w.y, w.w, w.h);
    }
    g.globalCompositeOperation = 'lighter';
    FS.glow(g, x, top - 160, 70, [90, 150, 255], 0.25);
    g.restore();
    // hanging roots / chains below the rock with a drip of fire
    g.save();
    g.strokeStyle = 'rgba(20,10,8,0.9)';
    g.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      const sx = x + r.range(-60, 60);
      const sy = top + 120 + r.f() * 80;
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + r.range(-10, 10), sy + 50, sx + r.range(-6, 6), sy + 60 + r.f() * 90);
      g.stroke();
    }
    g.restore();
    FS.citadel = { x, top, keepTop: top - 260, spire: top - 648 };
  };
})();
