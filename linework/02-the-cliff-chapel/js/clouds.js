// clouds.js - engraved towering cumulus.
// A cloud is a silhouette of overlapping "mass" ellipses. Its rim is built from
// billows whose size depends on which way the rim faces: small cauliflower
// billows (with children and grandchildren) on the sunward edge, big soft ones
// on the shadow side; medium billows inside make the folds. Billows are drawn in
// painter's order (higher first, lower ones in front). Shading = local billow
// sphere + whole-mass shading + occlusion under the billows in front + height.
// Lines are tone contours (perpendicular to the shading gradient) so they wrap
// each billow as crescents and are cut by the billows in front. Flat ruled base.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C;
  const TONES = ['#f0e6c8', '#e0d6b6', '#cdc9aa', '#b4b6a2'];

  function makeBillow(rnd, cx, cy, r, kind) {
    const n = Math.max(40, Math.ceil(r * 0.8));
    const s1 = rnd() * 100, s2 = rnd() * 100;
    const R = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * LW.TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      let rr = r * (1 + 0.06 * LW.noise(ca * 1.3 + s1, sa * 1.3 + s2) + 0.02 * LW.noise(ca * 4 + s2, sa * 4 + s1));
      if (sa > 0) rr *= 1 - 0.1 * sa * sa;
      // a cauliflower rim: rounded bumps meeting in small cusps, strongest on the sunward top, calmer underneath
      if (r > 18) {
        const kb = Math.max(5, Math.round(r / 17));
        const ph = 0.9 * LW.noise(ca * 0.8 + s1 * 0.3, sa * 0.8);
        const bump = Math.sqrt(Math.abs(Math.sin(a * kb / 2 + ph + s1)));
        const top = 0.55 + 0.45 * Math.max(0, -sa * 0.8 - ca * 0.3);
        rr *= 1 + 0.075 * top * (bump - 0.62);
      }
      R.push(rr);
    }
    return { cx, cy, r, kind, R, n, seed: rnd() * 1000 };
  }
  const radAt = (b, a) => {
    const t = (((a / LW.TAU) % 1) + 1) % 1 * b.n;
    const i = Math.floor(t), f = t - i;
    return b.R[i % b.n] * (1 - f) + b.R[(i + 1) % b.n] * f;
  };
  const billowPts = (b) => b.R.map((rr, i) => { const a = (i / b.n) * LW.TAU; return [b.cx + Math.cos(a) * rr, b.cy + Math.sin(a) * rr]; });

  // the cloud's mass field: > 0 inside
  const massField = (masses) => (x, y) => {
    let v = -1e9;
    for (const [cx, cy, rx, ry] of masses) v = Math.max(v, 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2);
    return v;
  };

  function generate(rnd, o) {
    const F = massField(o.masses);
    const [lx, ly] = LW.LIGHT2;
    const S = o.scale || 1;
    const bb = o.bbox;
    const out = [];
    const gradN = (x, y) => {
      const e = 3, gx = F(x + e, y) - F(x - e, y), gy = F(x, y + e) - F(x, y - e);
      const l = Math.hypot(gx, gy) || 1;
      return [-gx / l, -gy / l]; // outward normal
    };
    // rim: march the F = 0 contour
    const grid = new LW.Grid(bb.x0, bb.y0, bb.x1, bb.y1, 6);
    const f = grid.fill(grid.field(), F);
    const rims = LW.marching(f, grid.w, grid.h, 0.0, grid.map());
    for (const rim of rims) {
      const dense = LW.resample(rim, 2);
      let acc = 0, next = 0;
      for (let i = 0; i < dense.length; i++) {
        if (i > 0) acc += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
        if (acc < next) continue;
        const [x, y] = dense[i];
        if (y > o.base + 10) { next = acc + 20; continue; }
        const n = gradN(x, y);
        const lit = n[0] * lx + n[1] * ly; // 1 = faces the sun
        const t = LW.clamp((lit + 0.35) / 1.2, 0, 1);
        const r = S * LW.lerp(o.rBig || 150, o.rSmall || 34, Math.pow(t, 0.8)) * rnd.range(0.65, 1.35);
        const cx = x - n[0] * r * rnd.range(0.45, 0.7), cy = y - n[1] * r * rnd.range(0.45, 0.7);
        out.push(makeBillow(rnd, cx, cy, r, 'rim'));
        // cauliflower detail on the sunward rim
        if (lit > 0.05 && o.children !== false) {
          const cnt = Math.round(3 + 7 * lit);
          for (let k = 0; k < cnt; k++) {
            const a = Math.atan2(n[1], n[0]) + rnd.gauss() * 0.9;
            const cr = r * rnd.range(0.28, 0.46);
            const dd = r - cr * rnd.range(0.2, 0.55);
            const bx = cx + Math.cos(a) * dd, by = cy + Math.sin(a) * dd;
            if (by > o.base - 10) continue;
            out.push(makeBillow(rnd, bx, by, cr, 'child'));
            if (lit > 0.25 && cr > 14 * S) {
              for (let m = 0; m < 3; m++) {
                const a2 = a + rnd.gauss() * 0.8, gr = cr * rnd.range(0.32, 0.5);
                const d2 = cr - gr * rnd.range(0.2, 0.5);
                out.push(makeBillow(rnd, bx + Math.cos(a2) * d2, by + Math.sin(a2) * d2, gr, 'grand'));
              }
            }
          }
        }
        next = acc + r * rnd.range(0.85, 1.25);
      }
    }
    // interior billows: the folds of the body
    const step = (o.inner || 150) * S;
    for (let y = bb.y0; y < o.base; y += step * 0.75) {
      for (let x = bb.x0; x < bb.x1; x += step * 1.0) {
        if (o.innerProb !== undefined && rnd() > o.innerProb) continue;
        const px = x + rnd.range(-0.4, 0.4) * step, py = y + rnd.range(-0.3, 0.3) * step;
        const v = F(px, py);
        if (v < 0.12 || py > o.base - 20) continue;
        const r = step * rnd.range(0.5, 0.95) * (0.75 + 0.5 * LW.smooth(bb.y0, o.base, py));
        out.push(makeBillow(rnd, px, py, r, 'inner'));
        if (rnd() < 0.5) { // a cluster on the inner billow's top makes the fold read
          for (let m = 0; m < 3; m++) {
            const a = -Math.PI / 2 - 0.5 + rnd.gauss() * 0.7, cr = r * rnd.range(0.3, 0.45);
            out.push(makeBillow(rnd, px + Math.cos(a) * (r - cr * 0.4), py + Math.sin(a) * (r - cr * 0.4), cr, 'child'));
          }
        }
      }
    }
    // painter: higher first; lower billows are nearer the viewer
    out.sort((a, b) => a.cy + a.r * 0.4 - (b.cy + b.r * 0.4));
    return { billows: out, F, gradN };
  }

  async function drawCloud(rnd, o) {
    const { billows, F, gradN } = generate(rnd, o);
    const base = o.base;
    const g = LW.fill, ink = LW.ink;
    const clip = new Path2D();
    clip.moveTo(-50, -50);
    clip.lineTo(LW.W + 50, -50);
    for (let x = LW.W + 50; x >= -50; x -= 20) clip.lineTo(x, base + LW.noise(x * 0.004, 3.3) * 6);
    clip.closePath();
    const ub = { x0: o.bbox.x0 - 200, y0: o.bbox.y0 - 200, x1: o.bbox.x1 + 200, y1: base + 10 };
    const res = 0.5;
    const iw = Math.ceil((ub.x1 - ub.x0) * res), ih = Math.ceil((ub.y1 - ub.y0) * res);
    // ---- id map & occlusion (AO) map, both in painter's order
    const idc = LW.canvas(iw, ih), aoc = LW.canvas(iw, ih);
    const ig = idc.getContext('2d', { willReadFrequently: true }), ag = aoc.getContext('2d', { willReadFrequently: true });
    for (const c of [ig, ag]) c.setTransform(res, 0, 0, res, -ub.x0 * res, -ub.y0 * res);
    const [lx, ly] = LW.LIGHT2;
    const unionPath = new Path2D();
    const polys = billows.map((b) => billowPts(b));
    billows.forEach((b, i) => {
      const k = i + 1;
      const path = LW.polyPath(polys[i]);
      unionPath.addPath(path);
      ig.fillStyle = `rgb(${k & 255},${(k >> 8) & 255},0)`;
      ig.fill(path);
      // the billow shades what is behind it just outside its rim, offset away from the sun
      const sx = b.cx - lx * b.r * 0.18, sy = b.cy - ly * b.r * 0.18;
      const gr = ag.createRadialGradient(sx, sy, b.r * 0.95, sx, sy, b.r * 1.3);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ag.fillStyle = gr;
      ag.beginPath(); ag.arc(sx, sy, b.r * 1.4, 0, LW.TAU); ag.fill();
      ag.save(); ag.globalCompositeOperation = 'destination-out'; ag.fill(path); ag.restore();
    });
    const idd = ig.getImageData(0, 0, iw, ih).data, aod = ag.getImageData(0, 0, iw, ih).data;
    const pix = (x, y) => {
      const i = ((x - ub.x0) * res) | 0, j = ((y - ub.y0) * res) | 0;
      if (i < 0 || j < 0 || i >= iw || j >= ih) return -1;
      return (j * iw + i) * 4;
    };
    const idRaw = (x, y) => { const q = pix(x, y); if (q < 0 || idd[q + 3] < 250) return 0; return idd[q] + (idd[q + 1] << 8); };
    const idAt = (x, y) => {
      let id = idRaw(x, y);
      if (id) return id;
      for (const [ox, oy] of [[2, 2], [-2, -2], [2, -2], [-2, 2], [4, 0], [0, 4], [-4, 0], [0, -4]]) { id = idRaw(x + ox, y + oy); if (id) return id; }
      return 0;
    };
    const aoAt = (x, y) => { const q = pix(x, y); return q < 0 ? 0 : aod[q + 3] / 255; };
    const L3 = (() => { const v = [-0.5, -0.66, 0.56]; const m = Math.hypot(...v); return v.map((a) => a / m); })();
    const localD = (b, x, y) => {
      const a = Math.atan2(y - b.cy, x - b.cx);
      const R = radAt(b, a) * 1.03;
      const dx = (x - b.cx) / R, dy = (y - b.cy) / R;
      const nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      return 1 - Math.max(0, -dx * L3[0] - dy * L3[1] + nz * L3[2]);
    };
    const yTop = o.bbox.y0, H = base - yTop;
    const globalD = (x, y) => {
      const n = gradN(x, y);
      const side = 0.24 * LW.smooth(o.bbox.x0 + (o.bbox.x1 - o.bbox.x0) * 0.3, o.bbox.x1 - (o.bbox.x1 - o.bbox.x0) * 0.2, x);
      const edge = LW.smooth(0.35, 0.0, F(x, y)); // only near the silhouette does the mass normal matter
      const g0 = 0.5 - 0.5 * (n[0] * lx + n[1] * ly);
      return g0 * (0.35 + 0.65 * edge) + 0.4 * LW.smooth(yTop + H * 0.25, base, y) + side;
    };
    const darkAt = (x, y, nz = 1) => {
      const id = idAt(x, y);
      if (!id || id > billows.length) return 0;
      const b = billows[id - 1];
      const d = 0.5 * localD(b, x, y) + 0.48 * globalD(x, y) + 0.75 * aoAt(x, y) - 0.3 + 0.05 * nz * LW.noise(x * 0.02, y * 0.02);
      return LW.clamp(d * (o.contrast || 1), 0, 1);
    };
    const mask = LW.Mask.fromPath(unionPath, ub, 0.5);
    g.save(); g.clip(clip); ink.save(); ink.clip(clip);
    LW.occlude(unionPath); // clear the sky's ink rules under the cloud (above the base only)
    // ---- tone plate
    {
      const tc = LW.canvas(iw, ih);
      const tg = tc.getContext('2d');
      const id = tg.createImageData(iw, ih);
      const cols = TONES.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      for (let j = 0; j < ih; j++) for (let i = 0; i < iw; i++) {
        const x = ub.x0 + i / res, y = ub.y0 + j / res;
        if (!mask.in(x, y)) continue;
        const d = darkAt(x, y, 0);
        const t = d < 0.5 ? 0 : d < 0.68 ? 1 : d < 0.84 ? 2 : 3;
        const q = (j * iw + i) * 4;
        id.data[q] = cols[t][0]; id.data[q + 1] = cols[t][1]; id.data[q + 2] = cols[t][2]; id.data[q + 3] = 255;
      }
      tg.putImageData(id, 0, 0);
      g.save(); g.clip(unionPath); g.drawImage(tc, ub.x0, ub.y0, iw / res, ih / res); g.restore();
    }
    await LW.tick();
    // ---- billow rims in painter's order (later ones cut earlier ones)
    const lwS = o.lw || 1;
    for (let i = 0; i < billows.length; i++) {
      const b = billows[i], pts = polys[i];
      const path = LW.polyPath(pts);
      LW.occlude(path); // (ink is clipped above the base here)
      const pen = new LW.Pen();
      const gs = b.seed;
      const wr = Math.min(1, 0.45 + b.r / 160) * lwS;
      LW.inkContour(pen, pts, (nx, ny, x, y) => {
        const sh = LW.shadowSide(nx, ny); // 1 on the side away from the sun
        const gd = globalD(x, y);
        if (sh < 0.3 && LW.noise3(x * 0.03 + gs, y * 0.03) > 0.42) return 0; // occasionally broken on the lit side
        return wr * (1.25 + 2.6 * sh * sh * (0.5 + gd));
      }, { taper: 0.12 });
      // one or two fine contour lines just inside the sunward rim
      if (b.r > 30 * (o.scale || 1)) {
        const thL = Math.atan2(ly, lx);
        for (let m = 1; m <= (b.r > 90 ? 2 : 1); m++) {
          const half = 0.5 + 0.6 * LW.noise(gs, m);
          const a0 = thL - half - 0.3, a1 = thL + half + 0.2;
          const q = [];
          for (let a = a0; a <= a1; a += 0.04) {
            const rr = radAt(b, a) - m * 6 * lwS;
            q.push([b.cx + Math.cos(a) * rr, b.cy + Math.sin(a) * rr]);
          }
          if (q.length > 3) pen.line(q, 0.8 * lwS, 0.45, 0.05);
        }
      }
      // cauliflower detail: small nested scallops just inside the sunward rim
      if (b.r > 22 * (o.scale || 1) && (o.scale || 1) > 0.5) {
        const thL = Math.atan2(ly, lx);
        const br = LW.rng('scal' + i + '_' + Math.floor(o.bbox.y0));
        const ns = Math.round(b.r / 14);
        for (let m = 0; m < ns; m++) {
          const a = thL + br.gauss() * 0.9;
          const rr = radAt(b, a);
          const sr = br.range(5, 11) * lwS;
          const cx2 = b.cx + Math.cos(a) * (rr - sr * br.range(1.4, 2.6)), cy2 = b.cy + Math.sin(a) * (rr - sr * br.range(1.4, 2.6));
          const q = [];
          for (let t = a - 1.3; t <= a + 1.3; t += 0.25) q.push([cx2 + Math.cos(t) * sr, cy2 + Math.sin(t) * sr]);
          pen.line(q, 0.6 * lwS, 0.45, 0.05);
        }
        // stipple: soft shadowed edge grains toward the rim on the side away from the sun
        const nd = Math.round(b.r * 2.2);
        for (let m = 0; m < nd; m++) {
          const a = br() * LW.TAU;
          const sh = LW.shadowSide(Math.cos(a), Math.sin(a));
          if (br() > sh * sh) continue;
          const rr = radAt(b, a) - Math.abs(br.gauss()) * 10 * lwS - 1.5;
          pen.dot(b.cx + Math.cos(a) * rr, b.cy + Math.sin(a) * rr, br.range(0.45, 1.0) * lwS);
        }
      }
      pen.draw(ink, C.ink);
    }
    await LW.tick();
    // ---- tone-contour hatching
    const dirAt = (x, y) => {
      const id = idAt(x, y);
      if (!id || id > billows.length) return null;
      const b = billows[id - 1];
      const e = Math.max(1.5, b.r * 0.03);
      const gx = localD(b, x + e, y) - localD(b, x - e, y), gy = localD(b, x, y + e) - localD(b, x, y - e);
      const l = Math.hypot(gx, gy);
      if (l < 1e-4) return null;
      return [-gy / l, gx / l];
    };
    const sp0 = o.sp0 || 2.5;
    const lines = LW.streamlines({
      bbox: ub, seed: Math.floor(o.bbox.y0),
      inside: (x, y) => mask.in(x, y) && y < base - 2,
      region: idAt,
      dir: dirAt,
      // lines run into the lit body too, sparse and fine, so the whole cloud is engraved rather than left blank
      sep: (x, y) => { const d = darkAt(x, y); return d < 0.08 ? 0 : sp0 + (o.spMax || 10) * 1.15 * Math.pow(1 - d, 1.35); },
      step: 2.0, minLen: 8, seedGrid: 12, cell: 5, test: 0.6,
    });
    const pen = new LW.Pen();
    LW.drawLines(pen, lines, (x, y) => (0.3 + 1.6 * Math.pow(darkAt(x, y), 1.3)) * lwS, 0.35, 0.05);
    pen.draw(ink, C.ink);
    // cross-hatching laid over the contour lines in the deepest folds
    if ((o.scale || 1) > 0.5) {
      LW.tex.deepHatch(pen, ub, (x, y) => mask.in(x, y) && y < base - 2, (x, y) => darkAt(x, y), 0, {
        seed: 71, lw: lwS, layers: [[0.62, 0.77, 3.3], [-0.55, 0.88, 3.9]],
      });
      // stippled grain in the shaded body of the cloud
      const sr = LW.rng('cstip' + Math.floor(o.bbox.y0));
      LW.tex.grain(pen, ub, (x, y) => mask.in(x, y) && y < base - 2, Math.floor((ub.x1 - ub.x0) * (ub.y1 - ub.y0) * 0.004), sr, [0.4, 0.9], (x, y) => LW.smooth(0.58, 0.9, darkAt(x, y)));
      pen.draw(ink, C.ink);
    }
    // ---- the flat, darker ruled base
    const band = o.baseBand || 80;
    const bb2 = { x0: ub.x0, y0: base - band, x1: ub.x1, y1: base + 8 };
    g.save(); g.clip(unionPath);
    LW.flat(LW.polyPath([[ub.x0, base - band * 0.4], [ub.x1, base - band * 0.4], [ub.x1, base + 10], [ub.x0, base + 10]]), TONES[2]);
    LW.flat(LW.polyPath([[ub.x0, base - band * 0.12], [ub.x1, base - band * 0.12], [ub.x1, base + 10], [ub.x0, base + 10]]), TONES[3]);
    g.restore();
    const bp = new LW.Pen();
    LW.hatchDither(bp, bb2, 0.0, {
      spacing: (o.baseSp || 3.0), step: 4, wob: 1.6, seed: 31, inside: (x, y) => mask.in(x, y), jitter: 0.1,
      dark: (x, y) => { const t = LW.clamp((y - (base - band)) / band, 0, 1); return t <= 0 ? 0 : 0.15 + 0.85 * Math.pow(t, 1.3) + 0.06 * LW.noise(x * 0.01, y * 0.03); },
      w: (x, y, d) => (0.5 + 1.6 * d) * lwS, taper: 0.35,
    });
    // a second, crossing ruling in the darkest bottom of the base
    LW.hatchDither(bp, bb2, 0.1, {
      spacing: (o.baseSp || 3.0) * 1.3, step: 4, wob: 1.2, seed: 37, inside: (x, y) => mask.in(x, y),
      dark: (x, y) => { const t = LW.clamp((y - (base - band * 0.55)) / (band * 0.55), 0, 1); return t * 0.9; },
      w: () => 0.8 * lwS, taper: 0.35,
    });
    // the base line itself
    const bl = [];
    for (let x = ub.x0; x <= ub.x1; x += 6) bl.push([x, base + LW.noise(x * 0.004, 3.3) * 6 - 1]);
    let run = [];
    for (const p of bl) { if (mask.in(p[0], p[1] - 3)) run.push(p); else { if (run.length > 2) bp.line(run, 2.6 * lwS, 0.1); run = []; } }
    if (run.length > 2) bp.line(run, 2.6 * lwS, 0.1);
    bp.draw(ink, C.ink);
    ink.restore(); g.restore();
    await LW.tick();
  }

  LW.drawClouds = async function () {
    const rnd = LW.rng('clouds2');
    // far bank on the horizon: low, pale, finely drawn
    await drawCloud(rnd, {
      masses: [[60, 2186, 170, 30], [300, 2184, 160, 40], [520, 2188, 150, 26], [760, 2183, 200, 38], [1020, 2188, 170, 28], [1250, 2186, 160, 30]],
      bbox: { x0: -150, y0: 2135, x1: 1450, y1: 2192 }, base: 2190, scale: 0.22, rBig: 120, rSmall: 60, inner: 160, children: false, innerProb: 0.4,
      sp0: 2.0, spMax: 7, lw: 0.7, baseBand: 22, baseSp: 2.4, contrast: 0.85,
    });
    // a second, smaller cumulus far off to the right, behind the headland
    await drawCloud(rnd, {
      masses: [[1930, 1060, 230, 80], [1790, 1100, 150, 50], [2060, 1040, 160, 95], [1990, 960, 110, 70]],
      bbox: { x0: 1550, y0: 860, x1: 2300, y1: 1150 }, base: 1140, scale: 0.6, rBig: 130, rSmall: 55, inner: 150, innerProb: 0.5, children: false,
      sp0: 2.1, spMax: 8, lw: 0.8, baseBand: 34, baseSp: 2.6, contrast: 0.9,
    });
    // the towering cumulus over the sea: broad base, body, a tower leaning right, crown
    await drawCloud(rnd, {
      masses: [
        [520, 1990, 600, 150], [480, 1800, 430, 210], [330, 1720, 230, 260],
        [560, 1530, 330, 250], [660, 1300, 260, 230], [600, 1110, 230, 170], [740, 1010, 190, 120], [560, 1290, 230, 190], [400, 1500, 200, 200],
      ],
      bbox: { x0: -120, y0: 860, x1: 1180, y1: 2140 }, base: 2128, scale: 1, rBig: 175, rSmall: 34, inner: 230, innerProb: 0.75,
      sp0: 2.4, spMax: 10, lw: 1, baseBand: 95, contrast: 1.22,
    });
  };
})();
