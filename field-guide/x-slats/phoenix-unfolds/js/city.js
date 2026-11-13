// THE PHOENIX UNFOLDS — the gothic spire city: silhouettes, windows, rim light, depth layers.
(function (G) {
  const PU = G.PU;
  const { lerp, clamp, smooth } = PU;
  const TAU = Math.PI * 2;
  const QUAY = 3306; // top of the stone embankment
  PU.QUAY = QUAY;

  // landmark anchors used by the micro-stories (each inside one strip)
  PU.LM = {
    lamp: { x: 128, y: QUAY },
    obs: { cx: 500, balcony: 2604, dome: 2520 },
    towerA: { cx: 700, top: 2440, garg: { x: 760, y: 2650 } },
    belfry: { cx: 900, floor: 2470 },
    balcony: { x: 1100, y: 2990 },
    mainSpire: { cx: 1300, top: 1960 },
    stairTower: { cx: 1500, top: 2650 },
    lanternRoof: { x: 1700, y: 2950 },
    steps: { x: 1900, y: QUAY },
    bridge: { x0: 2216, x1: 2584, deck: 3226 },
    fall: { x: 2500 },
    rightCath: { cx: 2700, top: 2070, rose: { x: 2700, y: 2790 }, parapet: 2600 },
    violinRoof: { x: 2900, y: 2896 },
    slimSpire: { cx: 3100, top: 2330 },
    umbrellaRoof: { x: 3300, y: 2972 },
    jarQuay: { x: 3500, y: QUAY },
    gardenRoof: { x: 3700, y: 2880 },
    nest: { cx: 3900, top: 2296 },
  };

  class Builder {
    constructor(ctx, rng, fill) {
      this.ctx = ctx;
      this.rng = rng;
      this.fill = fill;
      this.windows = [];
      this.holes = [];
      this.edges = []; // highlight edges (spire ridges etc.)
    }
    P(pts) {
      const c = this.ctx;
      c.fillStyle = this.fill;
      PU.poly(c, pts, true);
      c.fill();
    }
    rect(x, y, w, h) {
      this.ctx.fillStyle = this.fill;
      this.ctx.fillRect(x, y, w, h);
    }
    // crocketed spire with finial
    spire(cx, by, w, h, o = {}) {
      const r = this.rng;
      const pts = [{ x: cx - w / 2, y: by }];
      const n = Math.max(3, Math.floor(h / (o.crock || 46)));
      const L = [];
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const x = lerp(cx - w / 2, cx, t),
          y = by - h * t;
        L.push({ x, y: y + 2 });
        if (o.crock !== 0) {
          const s = 2 + w * 0.05 * (1 - t) + 1.5;
          L.push({ x: x - s, y: y + 1 });
          L.push({ x: x - s * 0.3, y: y - s * 0.9 });
        }
      }
      for (const p of L) pts.push(p);
      const top = by - h;
      const fh = o.finial == null ? Math.max(14, h * 0.07) : o.finial;
      pts.push({ x: cx - 1.4, y: top });
      pts.push({ x: cx - 1.2, y: top - fh });
      pts.push({ x: cx + 1.2, y: top - fh });
      pts.push({ x: cx + 1.4, y: top });
      for (let i = L.length - 1; i >= 0; i--) pts.push({ x: 2 * cx - L[i].x, y: L[i].y });
      pts.push({ x: cx + w / 2, y: by });
      this.P(pts);
      if (fh > 10 && o.cross !== false) {
        const cy = top - fh * 0.72;
        this.rect(cx - fh * 0.22, cy - 1.3, fh * 0.44, 2.6);
      }
      if (o.orb) {
        this.ctx.beginPath();
        this.ctx.arc(cx, top - fh, Math.max(2.5, w * 0.04), 0, TAU);
        this.ctx.fill();
      }
      this.edges.push({ x0: cx, y0: top, x1: cx, y1: by, w: Math.max(1, w * 0.03) });
      // lucarnes (little gabled windows) on the spire
      if (h > 260 && o.lucarne !== false) {
        const ly = by - h * 0.22,
          lw = w * 0.22;
        this.P([
          { x: cx - lw / 2, y: ly },
          { x: cx, y: ly - lw * 1.4 },
          { x: cx + lw / 2, y: ly },
        ]);
        this.windows.push({ x: cx, y: ly - lw * 0.25, w: lw * 0.4, h: lw * 0.7, lit: r.chance(0.5) ? r.r(0.4, 0.9) : 0 });
      }
    }
    pinnacle(cx, by, w, h) {
      this.spire(cx, by, w, h, { crock: 0, finial: h * 0.18, cross: false, lucarne: false });
    }
    // gabled town house
    house(x, by, w, h, o = {}) {
      const r = this.rng;
      const roofH = o.roofH != null ? o.roofH : w * r.r(0.7, 1.25);
      this.rect(x, by - h, w, h + 1);
      if (o.stepped) {
        const steps = 4;
        const pts = [{ x, y: by - h }];
        for (let i = 0; i < steps; i++) {
          const x0 = x + (w / 2) * (i / steps),
            y0 = by - h - (roofH * (i + 1)) / steps;
          pts.push({ x: x0, y: y0 });
          pts.push({ x: x0 + (w / 2) / steps, y: y0 });
        }
        for (let i = steps - 1; i >= 0; i--) {
          const x0 = x + w - (w / 2) * (i / steps),
            y0 = by - h - (roofH * (i + 1)) / steps;
          pts.push({ x: x0 - (w / 2) / steps, y: y0 });
          pts.push({ x: x0, y: y0 });
        }
        pts.push({ x: x + w, y: by - h });
        this.P(pts);
      } else if (o.flat) {
        // parapet + crenels
        const ph = 10;
        this.rect(x - 3, by - h - ph, w + 6, ph);
      } else {
        this.P([
          { x: x - 4, y: by - h + 1 },
          { x: x + w / 2, y: by - h - roofH },
          { x: x + w + 4, y: by - h + 1 },
        ]);
        this.edges.push({ x0: x + w / 2, y0: by - h - roofH, x1: x - 4, y1: by - h + 1, w: 1.5 });
      }
      if (o.chimney !== false && r.chance(0.55) && !o.flat) {
        const cx = x + w * r.r(0.15, 0.75);
        const top = by - h - roofH * r.r(0.5, 0.9);
        this.rect(cx, top - r.r(14, 30), r.r(7, 12), 40);
      }
      if (!o.flat && !o.stepped && r.chance(0.45) && w > 50) {
        // dormer
        const dx = x + w * r.r(0.3, 0.6),
          dy = by - h - roofH * 0.3;
        this.rect(dx - 8, dy - 14, 16, 16);
        this.P([
          { x: dx - 11, y: dy - 13 },
          { x: dx, y: dy - 26 },
          { x: dx + 11, y: dy - 13 },
        ]);
        this.windows.push({ x: dx, y: dy - 7, w: 8, h: 10, lit: r.chance(0.5) ? r.r(0.4, 1) : 0 });
      }
      // windows: clustered lighting (whole floors lit or dark)
      const floors = Math.max(1, Math.floor(h / 44));
      const cols = Math.max(1, Math.floor(w / 30));
      const litBias = o.lit != null ? o.lit : 0.12;
      for (let f = 0; f < floors; f++) {
        const floorLit = r.chance(litBias);
        const litCol = r.i(0, cols - 1);
        for (let c = 0; c < cols; c++) {
          const wx = x + (w * (c + 0.5)) / cols;
          const wy = by - h + 22 + f * 44;
          if (wy > by - 18) continue;
          const lit = floorLit && (c === litCol || r.chance(0.3)) ? r.r(0.5, 1) : r.chance(0.02) ? r.r(0.3, 0.7) : 0;
          this.windows.push({ x: wx, y: wy, w: Math.min(12, w / cols - 10), h: 18, lit });
        }
      }
    }
    // tower with belfry/parapet/spire
    tower(cx, by, w, h, o = {}) {
      const r = this.rng;
      this.rect(cx - w * 0.58, by - h * 0.3, w * 1.16, h * 0.3 + 1); // buttressed base
      this.rect(cx - w / 2, by - h, w, h);
      // buttress offsets
      for (const s of [-1, 1]) {
        this.P([
          { x: cx + s * w * 0.58, y: by - h * 0.3 },
          { x: cx + s * w * 0.5, y: by - h * 0.42 },
          { x: cx + s * w * 0.5, y: by - h * 0.3 },
        ]);
      }
      const top = by - h;
      // parapet band
      this.rect(cx - w * 0.56, top - 8, w * 1.12, 10);
      if (o.pinnacles !== false) {
        for (const s of [-1, 1]) this.pinnacle(cx + s * w * 0.5, top - 6, w * 0.13, w * 0.75);
      }
      if (o.belfry) {
        // two tall pointed openings near the top
        const bh = Math.min(120, h * 0.28),
          bw = w * 0.22;
        for (const s of o.belfrySingle ? [0] : [-1, 1]) {
          this.holes.push({ type: 'arch', x: cx + s * w * 0.22, y: top + 18, w: o.belfrySingle ? w * 0.55 : bw, h: bh });
        }
      }
      // lancet windows down the tower
      const nw = Math.floor((h * 0.6) / 70);
      for (let i = 0; i < nw; i++) {
        const wy = top + (o.belfry ? 170 : 50) + i * 70;
        if (wy > by - 40) break;
        this.windows.push({ x: cx, y: wy, w: w * 0.16, h: 34, lit: r.chance(0.18) ? r.r(0.4, 1) : 0, arch: true });
      }
      if (o.spireH) this.spire(cx, top - 6, w * (o.spireW || 0.82), o.spireH, { orb: o.orb });
      if (o.dome) {
        this.ctx.fillStyle = this.fill;
        this.ctx.beginPath();
        this.ctx.ellipse(cx, top - 4, w * 0.52, w * 0.5, 0, Math.PI, TAU);
        this.ctx.fill();
        this.rect(cx - 1.5, top - w * 0.5 - 22, 3, 22);
      }
      return top;
    }
    // flying buttress from a pier at (x0) to the wall at (x1, y1)
    flyer(x0, by, pierH, x1, y1, t) {
      const c = this.ctx;
      const py = by - pierH;
      this.rect(x0 - t * 0.7, py, t * 1.4, pierH + 1);
      this.pinnacle(x0, py, t * 1.4, t * 4.2);
      c.strokeStyle = this.fill;
      c.lineWidth = t * 0.75;
      c.beginPath();
      c.moveTo(x0, py + t * 0.3);
      c.quadraticCurveTo(lerp(x0, x1, 0.55), py - (py - y1) * 1.05, x1, y1);
      c.stroke();
      c.lineWidth = t * 0.35;
      c.beginPath();
      c.moveTo(x0, py + t * 1.6);
      c.quadraticCurveTo(lerp(x0, x1, 0.5), py + t * 0.6 - (py - y1) * 0.7, x1, y1 + t * 1.8);
      c.stroke();
    }
    // nave with gabled roof and clerestory
    nave(x0, x1, by, h, roofH) {
      this.rect(x0, by - h, x1 - x0, h);
      this.P([
        { x: x0 - 6, y: by - h },
        { x: (x0 + x1) / 2, y: by - h - roofH },
        { x: x1 + 6, y: by - h },
      ]);
      // ridge cresting
      const n = Math.floor((x1 - x0) / 24);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const x = lerp(x0, x1, t);
        const ry = by - h - roofH * (1 - Math.abs(t - 0.5) * 2);
        this.rect(x - 1, ry - 7, 2, 8);
      }
      const nw = Math.floor((x1 - x0) / 46);
      for (let i = 0; i < nw; i++) {
        const lit = this.rng.chance(0.4) ? this.rng.r(0.4, 0.9) : 0;
        this.windows.push({ x: x0 + 23 + i * 46, y: by - h + 40, w: 14, h: 46, lit, arch: true, col: 'stained' });
      }
    }
    bridge(x0, x1, deck, arches, by) {
      this.rect(x0, deck, x1 - x0, by - deck);
      // parapet with balusters
      this.rect(x0, deck - 22, x1 - x0, 6);
      for (let x = x0 + 4; x < x1; x += 11) this.rect(x, deck - 18, 4, 18);
      const aw = (x1 - x0) / arches;
      for (let i = 0; i < arches; i++) this.holes.push({ type: 'bridgeArch', x: x0 + aw * (i + 0.5), y: deck + 26, w: aw * 0.8, h: by - deck });
    }
  }

  function archPath(ctx, x, y, w, h) {
    // pointed (gothic) arch: top at y, bottom at y+h
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + h);
    ctx.lineTo(x - w / 2, y + w * 0.55);
    ctx.quadraticCurveTo(x - w / 2, y + w * 0.05, x, y);
    ctx.quadraticCurveTo(x + w / 2, y + w * 0.05, x + w / 2, y + w * 0.55);
    ctx.lineTo(x + w / 2, y + h);
    ctx.closePath();
  }
  PU.archPath = archPath;

  // turret: round tower with a witch-hat roof
  Builder.prototype.turret = function (cx, by, w, h, roofK = 2.2) {
    this.rect(cx - w / 2, by - h, w, h + 1);
    this.rect(cx - w * 0.62, by - h - 4, w * 1.24, 6);
    this.P([
      { x: cx - w * 0.62, y: by - h - 2 },
      { x: cx, y: by - h - w * roofK },
      { x: cx + w * 0.62, y: by - h - 2 },
    ]);
    this.rect(cx - 1, by - h - w * roofK - 12, 2, 14);
    if (this.rng.chance(0.4)) this.windows.push({ x: cx, y: by - h + 20, w: w * 0.22, h: 12, lit: this.rng.chance(0.5) ? this.rng.r(0.5, 1) : 0, arch: true });
  };

  // dense gothic roofscape: back row taller with turrets & spirelets, front row lower
  function roofscape(b, x0, x1, by, hmin, hmax, o = {}) {
    const r = b.rng;
    for (const row of [0, 1]) {
      let x = x0 - r.r(0, 30);
      while (x < x1) {
        const w = r.r(o.wmin || 42, o.wmax || 96);
        const ww = Math.min(w, x1 - x + 8);
        if (ww < 22) break;
        const h = row === 0 ? r.r(hmin, hmax) : r.r(hmin * 0.55, hmax * 0.75);
        const roofH = ww * r.r(0.9, 1.9);
        b.house(x, by, ww, h, { stepped: r.chance(0.16), lit: (o.lit || 0.1) * (row ? 0.8 : 0.45), roofH });
        if (row === 0 && r.chance(o.turrets || 0.22)) {
          const tw = r.r(22, 36);
          b.turret(x + (r.chance(0.5) ? 0 : ww), by - h * r.r(0.2, 0.5), tw, h * r.r(0.55, 0.8), r.r(1.8, 2.8));
        }
        if (row === 0 && r.chance(o.spirelets || 0.18)) b.pinnacle(x + ww / 2, by - h - roofH * 0.7, r.r(8, 16), r.r(90, 240));
        x += ww - r.r(2, 10);
      }
    }
  }

  // ---------------- layers
  function farLayer(b) {
    const r = b.rng;
    const by = 3270;
    // forest of distant spires first
    for (let i = 0; i < 46; i++) {
      const x = r.r(-40, 4040);
      const h = r.r(300, 820) * (1 - 0.25 * Math.exp(-Math.pow((x - 1950) / 400, 2)));
      const w = r.r(26, 48);
      b.tower(x, by, w, h * 0.5, { spireH: h * 0.55, pinnacles: r.chance(0.6), spireW: r.r(0.7, 0.95) });
    }
    for (let i = 0; i < 9; i++) {
      const x = r.r(0, 4000),
        w = r.r(70, 110);
      b.tower(x, by, w, r.r(260, 420), { dome: true, pinnacles: false });
    }
    roofscape(b, -40, 4040, by, 160, 360, { lit: 0.06, turrets: 0.25, spirelets: 0.25 });
  }

  function midLayer(b) {
    const r = b.rng;
    const by = QUAY;
    const LM = PU.LM;
    // background roofscape across the whole river front, low in the centre so the tail glows through
    roofscape(b, 330, 640, by, 360, 620, { lit: 0.14 });
    roofscape(b, 1540, 1790, by, 380, 560, { lit: 0.14, turrets: 0.35 });
    roofscape(b, 1790, 2240, by, 180, 330, { lit: 0.16, turrets: 0.15, spirelets: 0.3 });
    roofscape(b, 2560, 2620, by, 300, 420, {});
    roofscape(b, 2940, 3330, by, 360, 640, { lit: 0.14, turrets: 0.35 });
    // left cathedral: west towers A (700) and B (900), nave 960–1460, crossing spire 1300
    b.nave(960, 1460, by, 560, 170);
    for (let x = 1000; x <= 1440; x += 88) {
      if (Math.abs(x - 1300) < 50) continue;
      b.flyer(x, by, 360, x + (x < 1300 ? 44 : -44), by - 510, 18);
    }
    b.rect(760, by - 700, 80, 700); // facade between towers
    b.P([
      { x: 752, y: by - 700 },
      { x: 800, y: by - 830 },
      { x: 848, y: by - 700 },
    ]);
    b.pinnacle(800, by - 826, 12, 90);
    b.tower(LM.towerA.cx, by, 136, by - LM.towerA.top, { spireH: 400, belfry: true });
    b.tower(LM.belfry.cx, by, 136, by - (LM.belfry.floor - 150), { spireH: 330, belfry: true, belfrySingle: true });
    b.tower(LM.mainSpire.cx, by, 116, by - 2560, { spireH: 2560 - LM.mainSpire.top - 6, spireW: 0.86, belfry: true });
    for (const s of [-1, 1]) b.pinnacle(LM.mainSpire.cx + s * 70, by - 600, 18, 170);
    // observatory tower with dome
    b.tower(LM.obs.cx, by, 104, by - LM.obs.balcony, { dome: true, pinnacles: false });
    b.rect(LM.obs.cx - 74, LM.obs.balcony, 148, 10);
    for (let x = LM.obs.cx - 70; x <= LM.obs.cx + 70; x += 10) b.rect(x, LM.obs.balcony - 16, 3, 16);
    b.rect(LM.obs.cx - 74, LM.obs.balcony - 18, 148, 4);
    // stair-landing tower (flat roof) in strip 8
    b.tower(LM.stairTower.cx, by, 112, by - LM.stairTower.top, { pinnacles: true });
    // right cathedral (strip 14): west front with rose window + great spire
    const rc = LM.rightCath;
    b.rect(rc.cx - 110, rc.parapet, 220, by - rc.parapet);
    b.rect(rc.cx - 118, rc.parapet - 10, 236, 12);
    for (let x = rc.cx - 112; x <= rc.cx + 112; x += 16) b.rect(x - 3, rc.parapet - 22, 6, 14);
    b.tower(rc.cx - 92, by, 46, by - (rc.parapet - 130), { spireH: 240, pinnacles: false });
    b.tower(rc.cx + 92, by, 46, by - (rc.parapet - 130), { spireH: 240, pinnacles: false });
    b.P([
      { x: rc.cx - 70, y: rc.parapet - 8 },
      { x: rc.cx, y: rc.parapet - 170 },
      { x: rc.cx + 70, y: rc.parapet - 8 },
    ]);
    b.tower(rc.cx, rc.parapet - 140, 70, 170, { spireH: rc.parapet - 310 - rc.top, spireW: 0.95, belfry: true });
    b.nave(rc.cx + 112, rc.cx + 240, by, 460, 120);
    for (let x = rc.cx + 140; x <= rc.cx + 230; x += 80) b.flyer(x + 30, by, 280, x - 10, by - 410, 15);
    // slender spire (strip 16)
    b.tower(LM.slimSpire.cx, by, 54, by - 2740, { spireH: 2740 - LM.slimSpire.top - 10, spireW: 0.9, pinnacles: true });
    // flat roofs for stories
    b.house(2826, by, 148, by - LM.violinRoof.y, { flat: true, lit: 0.3 });
    b.house(1636, by, 128, by - LM.lanternRoof.y, { flat: true, lit: 0.3 });
  }

  function nearLayer(b) {
    const r = b.rng;
    const by = QUAY;
    const LM = PU.LM;
    // left quay houses (strips 1–3): tall, close, framing
    b.house(-10, by, 150, 640, { stepped: true, lit: 0.18 });
    b.turret(140, by - 300, 34, 420, 2.6);
    b.house(140, by, 104, 470, { lit: 0.2, roofH: 170 });
    b.house(236, by, 120, 360, { lit: 0.25, roofH: 160 });
    b.house(350, by, 64, 260, { lit: 0.2, roofH: 110 });
    // balcony house (strip 6)
    b.house(1040, by, 120, by - LM.balcony.y + 40, { lit: 0.1, roofH: 150 });
    b.rect(1062, LM.balcony.y, 76, 7);
    for (let x = 1064; x <= 1136; x += 8) b.rect(x, LM.balcony.y - 18, 2.5, 18);
    b.rect(1062, LM.balcony.y - 20, 76, 3);
    // canal-mouth bridge (strips 12–13)
    const br = LM.bridge;
    b.bridge(br.x0, br.x1, br.deck, 2, by + 30);
    b.rect(br.x0 - 40, by - 120, 44, 150);
    b.rect(br.x1 - 4, by - 120, 44, 150);
    // right quay (strips 17–20)
    b.house(3236, by, 132, by - LM.umbrellaRoof.y, { flat: true, lit: 0.25 });
    b.house(3366, by, 90, 300, { lit: 0.25, roofH: 140 });
    b.house(3450, by, 112, 250, { lit: 0.25, stepped: true });
    b.house(3556, by, 62, 400, { lit: 0.25, roofH: 120 });
    b.house(3616, by, 172, by - LM.gardenRoof.y, { flat: true, lit: 0.3 });
    b.tower(LM.nest.cx, by, 92, by - 2720, { spireH: 2720 - LM.nest.top - 30, spireW: 0.8, pinnacles: true, belfry: true });
    b.house(3790, by, 62, 480, { lit: 0.25, roofH: 140 });
    b.house(3952, by, 70, 560, { lit: 0.25, roofH: 160 });
    b.turret(3958, by - 380, 30, 330, 2.6);
    // quay wall
    b.rect(-20, by, 4040, 28);
  }

  // painterly facade texture: vertical ribs and stone courses, very low contrast
  function facadeTexture(L, rng, base, light) {
    const ctx = L.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.lineCap = 'round';
    for (let i = 0; i < 5000; i++) {
      const x = rng.r(0, PU.W),
        y = rng.r(1900, PU.QUAY + 30);
      const li = PU.lightAt(x, y - 200);
      const up = rng.chance(0.7);
      const c = PU.mix3(base, li, rng.r(0.02, 0.12));
      ctx.strokeStyle = PU.rgba(rng.chance(0.4) ? [0, 0, 0] : c, rng.r(0.15, 0.4));
      ctx.lineWidth = rng.r(1.5, 5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      if (up) ctx.lineTo(x + rng.r(-1, 1), y - rng.r(20, 140));
      else ctx.lineTo(x + rng.r(10, 50), y + rng.r(-1, 1));
      ctx.stroke();
    }
    ctx.restore();
  }

  function cutHoles(ctx, holes) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    for (const h of holes) {
      if (h.type === 'bridgeArch') {
        const r = h.w / 2;
        ctx.beginPath();
        ctx.moveTo(h.x - r, h.y + h.h);
        ctx.lineTo(h.x - r, h.y + r * 0.9);
        ctx.ellipse(h.x, h.y + r * 0.9, r, r * 0.9, 0, Math.PI, TAU);
        ctx.lineTo(h.x + r, h.y + h.h);
        ctx.closePath();
      } else archPath(ctx, h.x, h.y, h.w, h.h);
      ctx.fill();
    }
    ctx.restore();

  }

  function shadeArches(ctx, holes) {
    // shadowed water under bridge arches
    ctx.save();
    for (const h of holes) {
      if (h.type !== 'bridgeArch') continue;
      const r = h.w / 2;
      const gr = ctx.createLinearGradient(0, h.y, 0, h.y + h.h);
      gr.addColorStop(0, 'rgba(8,4,12,0.75)');
      gr.addColorStop(1, 'rgba(8,4,12,0.35)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(h.x - r, h.y + h.h);
      ctx.lineTo(h.x - r, h.y + r * 0.9);
      ctx.ellipse(h.x, h.y + r * 0.9, r, r * 0.9, 0, Math.PI, Math.PI * 2);
      ctx.lineTo(h.x + r, h.y + h.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWindows(ctx, wins, rng, glowCtx, dim) {
    for (const w of wins) {
      if (w.lit <= 0) {
        if (rng.chance(0.5)) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        archPath(ctx, w.x, w.y - w.h / 2, w.w, w.h);
        ctx.fill();
        continue;
      }
      const warm = w.col === 'stained' ? (rng.chance(0.5) ? [255, 120, 60] : [200, 90, 140]) : rng.chance(0.85) ? [255, 176, 92] : [255, 214, 150];
      ctx.fillStyle = PU.rgba(PU.mix3([60, 25, 20], warm, w.lit * dim), 1);
      archPath(ctx, w.x, w.y - w.h / 2, w.w, w.h);
      ctx.fill();
      // mullion
      ctx.fillStyle = 'rgba(20,8,6,0.6)';
      ctx.fillRect(w.x - 0.6, w.y - w.h / 2 + 3, 1.2, w.h - 3);
      if (glowCtx) {
        const R = 6 + w.w * 1.3;
        const gr = glowCtx.createRadialGradient(w.x, w.y, 0, w.x, w.y, R);
        gr.addColorStop(0, PU.rgba(warm, 0.12 * w.lit * dim));
        gr.addColorStop(1, PU.rgba(warm, 0));
        glowCtx.fillStyle = gr;
        glowCtx.fillRect(w.x - R, w.y - R, 2 * R, 2 * R);
      }
    }
  }

  // rim light: edges facing the bird pick up its colour
  PU.rimLight = function (layer, light, S, d, strength) {
    if (!light.bright) {
      const B = PU.layer(S);
      B.ctx.setTransform(1, 0, 0, 1, 0, 0);
      B.ctx.filter = 'brightness(2.6)';
      B.ctx.drawImage(light, 0, 0);
      light.bright = B;
    }
    light = light.bright;
    const rim = PU.layer(S);
    const rc = rim.ctx;
    rc.setTransform(1, 0, 0, 1, 0, 0);
    rc.drawImage(layer, 0, 0);
    rc.globalCompositeOperation = 'destination-out';
    const band = 100;
    for (let x0 = 0; x0 < PU.W; x0 += band) {
      const cx = x0 + band / 2;
      // main light source direction for this column
      let lx = 1900 - cx,
        ly = 1700 - 2900;
      if (cx > 3000) {
        lx = (3500 - cx) * 0.3;
        ly = -600;
      }
      const l = Math.hypot(lx, ly);
      const sx = (-lx / l) * d,
        sy = (-ly / l) * d;
      rc.save();
      rc.beginPath();
      rc.rect(x0 * S, 0, band * S + 1, rim.height);
      rc.clip();
      rc.drawImage(layer, sx * S, sy * S);
      rc.restore();
    }
    rc.globalCompositeOperation = 'source-in';
    rc.drawImage(light, 0, 0);
    const lc = layer.ctx;
    lc.save();
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'lighter';
    let s = strength;
    while (s > 0) {
      lc.globalAlpha = Math.min(1, s);
      lc.drawImage(rim, 0, 0);
      s -= 1;
    }
    lc.restore();
  };

  // cool moon rim on the left half: edges facing the moon (upper-left) catch a blue line
  PU.rimLightMoon = function (layer, S, d, strength) {
    const rim = PU.layer(S);
    const rc = rim.ctx;
    rc.setTransform(1, 0, 0, 1, 0, 0);
    rc.drawImage(layer, 0, 0);
    rc.globalCompositeOperation = 'destination-out';
    const band = 100;
    for (let x0 = 0; x0 < 2000; x0 += band) {
      const cx = x0 + band / 2;
      let lx = PU.MOON.x - cx,
        ly = PU.MOON.y - 2800;
      const l = Math.hypot(lx, ly);
      rc.save();
      rc.beginPath();
      rc.rect(x0 * S, 0, band * S + 1, rim.height);
      rc.clip();
      rc.drawImage(layer, (-lx / l) * d * S, (-ly / l) * d * S);
      rc.restore();
    }
    rc.fillRect(2000 * S, 0, rim.width, rim.height);
    rc.globalCompositeOperation = 'source-in';
    rc.setTransform(S, 0, 0, S, 0, 0);
    const gr = rc.createLinearGradient(0, 0, 1900, 0);
    gr.addColorStop(0, 'rgba(150,180,255,0.9)');
    gr.addColorStop(0.5, 'rgba(130,160,240,0.6)');
    gr.addColorStop(1, 'rgba(120,150,230,0)');
    rc.fillStyle = gr;
    rc.fillRect(0, 0, PU.W, PU.H);
    const lc = layer.ctx;
    lc.save();
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'lighter';
    lc.globalAlpha = strength;
    lc.drawImage(rim, 0, 0);
    lc.restore();
  };

  PU.buildCity = function (S, seed, light) {
    const out = { glow: PU.layer(S * 0.5) };
    const defs = [
      { name: 'far', fill: '#2a1622', fn: farLayer, tint: 0.5, rim: [3, 0.8, 10, 0.35], dim: 0.5 },
      { name: 'mid', fill: '#100811', fn: midLayer, tint: 0.16, rim: [2.5, 2.2, 9, 0.9], dim: 0.9 },
      { name: 'near', fill: '#060307', fn: nearLayer, tint: 0.1, rim: [2.5, 2.4, 8, 0.8], dim: 1 },
    ];
    for (const d of defs) {
      const L = PU.layer(S);
      const rng = PU.rngFor(seed, 'city-' + d.name);
      const b = new Builder(L.ctx, rng, d.fill);
      d.fn(b, seed);
      cutHoles(L.ctx, b.holes);
      facadeTexture(L, rng, PU.hex(d.fill), light);
      // facade tint by the light field (atmosphere + moon/ember fill)
      L.ctx.save();
      L.ctx.setTransform(1, 0, 0, 1, 0, 0);
      L.ctx.globalCompositeOperation = 'source-atop';
      L.ctx.globalAlpha = d.tint;
      L.ctx.drawImage(light, 0, 0);
      L.ctx.restore();
      // vertical form: slightly darker at the base
      L.ctx.save();
      L.ctx.globalCompositeOperation = 'source-atop';
      const gr = L.ctx.createLinearGradient(0, 2000, 0, QUAY);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.35)');
      L.ctx.fillStyle = gr;
      L.ctx.fillRect(0, 1800, PU.W, 1600);
      L.ctx.restore();
      // spire ridges catch light
      L.ctx.save();
      L.ctx.globalCompositeOperation = 'source-atop';
      for (const e of b.edges) {
        const li = PU.lightAt(e.x0, e.y0);
        L.ctx.strokeStyle = PU.rgba(li, 0.25);
        L.ctx.lineWidth = e.w;
        L.ctx.beginPath();
        L.ctx.moveTo(e.x0, e.y0);
        L.ctx.lineTo(e.x1, e.y1);
        L.ctx.stroke();
      }
      L.ctx.restore();
      // ember rain lights the upper facades on the right; moonlight cools the left
      L.ctx.save();
      L.ctx.globalCompositeOperation = 'source-atop';
      {
        L.ctx.save();
        L.ctx.translate(3550, 2450);
        L.ctx.scale(1.4, 1);
        const eg = L.ctx.createRadialGradient(0, 0, 0, 0, 0, 900);
        eg.addColorStop(0, 'rgba(255,125,45,0.22)');
        eg.addColorStop(0.6, 'rgba(255,120,40,0.1)');
        eg.addColorStop(1, 'rgba(255,120,40,0)');
        L.ctx.fillStyle = eg;
        L.ctx.fillRect(-900, -900, 1800, 1800);
        L.ctx.restore();
        const vg = L.ctx.createLinearGradient(0, 2700, 0, 3300);
        vg.addColorStop(0, 'rgba(255,120,40,0.08)');
        vg.addColorStop(1, 'rgba(255,120,40,0)');
        L.ctx.fillStyle = vg;
        L.ctx.fillRect(2600, 2700, 1400, 600);
        const mg = L.ctx.createLinearGradient(0, 0, 1600, 0);
        mg.addColorStop(0, 'rgba(110,140,220,0.1)');
        mg.addColorStop(1, 'rgba(110,140,220,0)');
        L.ctx.fillStyle = mg;
        L.ctx.fillRect(0, 1900, 1600, 1500);
      }
      L.ctx.restore();
      PU.rimLight(L, light, S, d.rim[0], d.rim[1]);
      PU.rimLight(L, light, S, d.rim[2], d.rim[3]);
      PU.rimLightMoon(L, S, 2.2, d.name === 'far' ? 0.25 : 0.55);
      L.ctx.save();
      L.ctx.globalCompositeOperation = 'source-atop';
      drawWindows(L.ctx, b.windows, rng, out.glow.ctx, d.dim);
      L.ctx.restore();
      shadeArches(L.ctx, b.holes);
      out[d.name] = L;
      out[d.name + 'Windows'] = b.windows;
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
