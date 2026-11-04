// sea.js - the sea far below: tone bands, perspective ripple dashes (world-spaced
// rows that compress toward the horizon), the cloud's broken reflection, a far
// island, and two sea stacks wreathed in surf.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C;

  LW.drawSea = async function () {
    const S = LW.scene, HY = LW.HORIZON;
    const rnd = LW.rng('sea');
    const g = LW.fill;
    const W = LW.W, H = LW.H;
    const seaPath = new Path2D();
    seaPath.rect(-10, HY, W + 20, H - HY + 10);
    LW.occlude(seaPath);
    LW.flat(seaPath, C.sea);
    // deeper water lower down, joined by ruled transitions
    g.fillStyle = C.seaDeep;
    g.fillRect(-10, HY + 330, W + 20, H);
    {
      const pen = new LW.Pen();
      for (let y = HY + 120; y < HY + 330; y += 7) {
        const t = (y - (HY + 120)) / 210;
        const pts = [];
        for (let x = -10; x <= W + 10; x += 30) pts.push([x, y + LW.noise3(x * 0.01, y * 0.1) * 1.2]);
        pen.line(pts, 7 * t * 1.05, 0);
      }
      pen.draw(g, C.seaDeep);
    }
    // pale band at the horizon (haze / glitter)
    g.fillStyle = C.seaLight;
    g.fillRect(-10, HY, W + 20, 22);
    {
      const pen = new LW.Pen();
      for (let y = HY + 22; y < HY + 90; y += 4.5) {
        const t = 1 - (y - HY - 22) / 68;
        const pts = [];
        for (let x = -10; x <= W + 10; x += 30) pts.push([x, y]);
        pen.line(pts, 4.5 * t, 0);
      }
      pen.draw(g, C.seaLight);
    }
    // ---- cat's-paw patches (darker water) as a flat plate
    {
      const res = 0.25, x0 = -10, y0 = HY, w = W + 20, h = H - HY;
      const c = LW.canvas(w * res, h * res);
      const cg = c.getContext('2d');
      const id = cg.createImageData(c.width, c.height);
      for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) {
        const x = x0 + i / res, yy = y0 + j / res;
        const depth = LW.clamp((yy - HY) / 900, 0, 1);
        const v = LW.fbm(x * 0.0022 + 4, (yy - HY) * 0.006 / (0.25 + depth), 3);
        const q = (j * c.width + i) * 4;
        if (v > 0.18) { id.data[q] = 0x1d; id.data[q + 1] = 0x56; id.data[q + 2] = 0x60; id.data[q + 3] = 255; }
      }
      cg.putImageData(id, 0, 0);
      g.drawImage(c, x0, y0, w, h);
    }
    // ---- ripple rows at world spacing
    const pen = new LW.Pen();
    const lit = new LW.Pen();
    const reflX0 = 360, reflX1 = 980; // where the cloud reflects
    let y = HY + 3;
    while (y < H + 20) {
      const depth = LW.clamp((y - HY) / 900, 0, 1);
      let x = -20 - rnd() * 80;
      while (x < W + 20) {
        const L = (rnd.range(14, 60) + 220 * depth * rnd()) * (0.6 + depth);
        const gap = rnd.range(6, 40) * (0.5 + depth * 1.5);
        const amp = 0.6 + 4 * depth;
        const pts = [];
        const m = Math.max(3, Math.ceil(L / 6));
        for (let k = 0; k <= m; k++) {
          const xx = x + (L * k) / m;
          pts.push([xx, y + Math.sin((xx * 0.02) / (0.3 + depth) + y) * amp * Math.sin((k / m) * Math.PI)]);
        }
        const inRefl = x > reflX0 + LW.noise(y * 0.01, 1) * 60 && x < reflX1 + LW.noise(y * 0.01, 2) * 60 && y < HY + 420;
        if (inRefl && rnd() < 0.55) {
          lit.line(pts, 1.6 + 3 * depth, 0.4);
        } else {
          const patch = LW.fbm(x * 0.0022 + 4, (y - HY) * 0.006 / (0.25 + depth), 3); // wind patches
          const w = (0.55 + 2.2 * depth) * (0.55 + 0.6 * rnd()) * (1 + 0.9 * Math.max(0, patch));
          if (rnd() < 0.8 + 0.2 * patch - (inRefl ? 0.35 : 0)) pen.line(pts, w, 0.45);
          else lit.line(pts.map(([a, b]) => [a, b - 2]), 1.2 + 1.8 * depth, 0.45);
        }
        x += L + gap;
      }
      y += 2.6 + (y - HY) * 0.022 + rnd() * (0.5 + depth * 3);
    }
    lit.draw(g, '#bcd3c4');
    pen.draw(LW.ink, '#14343a');
    await LW.tick();

    // ---- far island on the horizon
    {
      const pts = [[520, HY + 1]];
      for (let x = 520; x <= 790; x += 6) {
        const t = (x - 520) / 270;
        const h = Math.sin(t * Math.PI) ** 0.7 * 38 + LW.noise(x * 0.03, 5) * 6 + (t > 0.3 && t < 0.55 ? 12 : 0) * Math.sin((t - 0.3) / 0.25 * Math.PI);
        pts.push([x, HY - h]);
      }
      pts.push([790, HY + 1]);
      const p = LW.polyPath(pts);
      LW.occlude(p);
      LW.flat(p, '#6fa19b');
      const ip = new LW.Pen();
      const bb = LW.bbox(pts);
      LW.hatchDither(ip, bb, 0.05, { spacing: 3, step: 3, wob: 0.5, seed: 3, inside: (x, y) => LW.pointInPoly(x, y, pts), dark: (x) => 0.25 + 0.45 * LW.clamp((x - 520) / 270, 0, 1), w: () => 0.8 });
      ip.line(pts.slice(1, -1), 1.4, 0.1);
      ip.draw(LW.ink, '#1d4a50');
    }
    // ---- sea stacks with surf
    const stacks = [
      { x: 520, y: 2610, w: 150, h: 120, seed: 1 },
      { x: 612, y: 2600, w: 54, h: 40, seed: 2 },
      { x: 905, y: 2770, w: 80, h: 58, seed: 3 },
    ];
    for (const st of stacks) {
      const top = [];
      const n = 30;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const xx = st.x - st.w / 2 + st.w * t;
        const sides = LW.smooth(0, 0.16, t) * LW.smooth(1, 0.8, t);
        const prof = st.h * (0.25 + 0.75 * Math.pow(sides, 0.6)) * (0.9 + 0.1 * LW.noise(t * 3 + st.seed, st.seed)) - (t > 0.55 ? (t - 0.55) * st.h * 0.35 : 0);
        top.push([xx, st.y - prof + 2 * LW.noise2(t * 20, st.seed)]);
      }
      const poly = top.concat([[st.x + st.w / 2, st.y + 4], [st.x - st.w / 2, st.y + 4]]);
      const p = LW.polyPath(poly);
      LW.occlude(p);
      LW.flat(p, '#c4a978');
      const sp = new LW.Pen();
      const bb = LW.bbox(poly);
      const inS = (x, y) => LW.pointInPoly(x, y, poly);
      // shadowed right flank as a darker flat
      LW.clipDo(g, p, () => LW.flat(LW.polyPath([[st.x + st.w * 0.12, bb.y0 - 5], [bb.x1 + 5, bb.y0 - 5], [bb.x1 + 5, bb.y1 + 5], [st.x + st.w * 0.05, bb.y1 + 5]]), '#9c8158'));
      LW.hatchDither(sp, bb, Math.PI / 2 + 0.1, { spacing: 2.6, step: 2, wob: 0.8, seed: st.seed, inside: inS, dark: (x, y) => 0.15 + 0.75 * LW.smooth(st.x - st.w * 0.1, st.x + st.w * 0.3, x) + 0.25 * LW.clamp((y - bb.y0) / bb.h, 0, 1), w: (x, y, d) => 0.6 + 1.3 * d });
      for (let k = 1; k < 4; k++) { // strata
        const yy = bb.y0 + bb.h * (k / 4) + 4;
        const q = [];
        for (let x = bb.x0; x <= bb.x1; x += 4) if (inS(x, yy)) q.push([x, yy + 2 * LW.noise(x * 0.05, k)]);
        if (q.length > 2) sp.line(q, 1.3, 0.3);
      }
      LW.outline(sp, poly, 2.2, 1.4);
      sp.draw(LW.ink, C.ink);
      // surf: foam rings at the waterline
      const fp = new LW.Pen();
      const foam = new LW.Pen();
      for (let k = 0; k < 4; k++) {
        const rx = st.w * (0.6 + k * 0.28), ry = 6 + k * 4;
        const arc = [];
        for (let a = 0.05; a < Math.PI - 0.05; a += 0.08) arc.push([st.x + Math.cos(a) * rx + LW.noise(a * 3, k) * 4, st.y + 2 + Math.sin(a) * ry]);
        foam.line(arc, 5 - k, 0.3);
        fp.line(arc.map(([x, y]) => [x, y + 2.5]), 1.0, 0.4);
      }
      foam.draw(g, '#e9e6d0');
      fp.draw(LW.ink, '#14343a');
    }
  };
})();
