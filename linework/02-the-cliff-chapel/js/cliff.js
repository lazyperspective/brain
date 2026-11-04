// cliff.js - the sea cliff as an engraved relief: a displacement field over the
// (leaning) face plane gives buttresses, lumps and bedding ledges; it is shaded
// with streamlines that follow the relief's contour lines (form-following
// hatching), crossed in the darks, outlined with iso-contours on the shadow
// side, and darkened by the cast shadows of the stairs.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C, V = LW.V;
  const ROCK = ['#e6d4a6', '#d9c391', '#c9ae78', '#b09265'];

  LW.cliffGeom = function () {
    if (LW._cliffGeom) return LW._cliffGeom;
    const S = LW.scene;
    // skyline control points (u, h, d)
    const ctrl = [
      [0.25, 5.4, 0], [0.55, 6.3, -0.1], [0.8, 7.7, -0.2], [1.5, 8.2, -0.3], [2.0, 9.5, -0.4], [2.6, 10.2, -0.8],
      [3.4, 11.0, -1.3], [4.3, 11.5, -1.8], [5.2, S.summitH, -2.4], [13.6, S.summitH, -2.4], [14.3, S.summitH + 0.5, -2.1],
      [15.2, S.summitH + 0.9, -1.8], [16.2, S.summitH + 1.2, -1.6], [17.5, S.summitH + 1.5, -1.3], [19.5, S.summitH + 1.8, -1],
    ];
    const sky = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const a = ctrl[i], b = ctrl[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const m = Math.max(2, Math.ceil(L / 0.1));
      for (let k = 0; k < m; k++) {
        const t = k / m;
        const u = LW.lerp(a[0], b[0], t);
        let h = LW.lerp(a[1], b[1], t);
        const flat = u > 5.0 && u < 13.8;
        h += (flat ? 0.03 : 0.18) * LW.fbm(u * 1.7, 4.2, 3) + (flat ? 0 : 0.12 * LW.ridge(u * 3.1, 1.1, 2));
        sky.push(S.faceP(u, h, LW.lerp(a[2], b[2], t)));
      }
    }
    // corner profile (the headland's edge against the sea), multi-scale jagged
    const corner = [];
    for (let h = 5.4; h >= -19; h -= 0.1) {
      const u = 0.25 + 0.6 * Math.max(-0.3, LW.fbm(h * 0.16, 9.1, 2)) + 0.22 * LW.fbm(h * 0.7, 3.3, 2) + 0.05 * LW.noise2(h * 3.5, 1) + (h < -4 ? (h + 4) * -0.03 : 0);
      corner.push(S.faceP(u, h, 0));
    }
    const poly = sky.concat([[2400, sky[sky.length - 1][1]], [2400, 4000]], [[corner[corner.length - 1][0], 4000]], corner.slice().reverse());
    const path = LW.polyPath(poly);
    const bb = LW.bbox(poly);
    const mask = LW.Mask.fromPath(path, { x0: 600, y0: 0, x1: 2200, y1: 3900 }, 0.5);
    LW._cliffGeom = { poly, path, mask, sky, corner, bb };
    return LW._cliffGeom;
  };

  // relief (metres of displacement) in face coords
  function relief(u, h) {
    const wu = u + 0.6 * LW.fbm(h * 0.11, u * 0.09 + 3, 2);
    const butt = LW.ridge(wu * 0.36, h * 0.055 + 2.0, 3); // vertical buttresses
    const lump = LW.fbm(u * 0.62 + 11, h * 0.5, 3);
    const s = h / 2.3 + 0.35 * LW.fbm(u * 0.13, h * 0.08 + 5, 2);
    const fr = s - Math.floor(s);
    const strata = fr < 0.1 ? fr / 0.1 : 1 - (fr - 0.1) / 0.9;
    return 1.15 * butt + 0.5 * lump + 0.32 * strata;
  }

  LW.drawCliff = async function () {
    const S = LW.scene;
    const G = LW.cliffGeom();
    const rnd = LW.rng('cliff');
    const shadow = LW.zz.shadowMask();
    const nFace = V.norm(V.add(S.NF, [0, S.LEAN, 0]));
    const VA = V.norm([-S.LEAN * S.NF[0], 1, -S.LEAN * S.NF[2]]);

    // ---- precompute fields on a 4px grid
    const grid = new LW.Grid(600, 0, 2200, 3900, 4);
    const R = grid.field(), D = grid.field(), DX = grid.field(), DY = grid.field(), GX = grid.field(), GY = grid.field(), SL = grid.field();
    const e = 0.04;
    for (let j = 0; j < grid.h; j++) {
      for (let i = 0; i < grid.w; i++) {
        const k = j * grid.w + i;
        const x = grid.x0 + i * grid.cs, y = grid.y0 + j * grid.cs;
        const [u, h] = S.unproj(x, y, 0);
        const r0 = relief(u, h), ru = (relief(u + e, h) - r0) / e, rh = (relief(u, h + e) - r0) / e;
        R[k] = r0;
        const n = V.norm(V.sub(nFace, V.add(V.mul(S.U, ru * 0.9), V.mul(VA, rh * 0.9))));
        const lam = V.dot(n, LW.L3);
        // screen jacobian
        const p0 = S.faceP(u, h, 0), pu = S.faceP(u + 0.05, h, 0), ph = S.faceP(u, h + 0.05, 0);
        const ju = [(pu[0] - p0[0]) / 0.05, (pu[1] - p0[1]) / 0.05], jh = [(ph[0] - p0[0]) / 0.05, (ph[1] - p0[1]) / 0.05];
        // iso-line direction (perpendicular to gradient) in screen
        let tu = -rh, th = ru;
        const gl = Math.hypot(tu, th);
        // blend with vertical fall-line where the relief is flat
        const wv = LW.smooth(0.25, 0.0, gl);
        tu = tu / (gl || 1) * (1 - wv); th = th / (gl || 1) * (1 - wv) + wv;
        let dx = ju[0] * tu + jh[0] * th, dy = ju[1] * tu + jh[1] * th;
        let dl = Math.hypot(dx, dy) || 1;
        dx /= dl; dy /= dl;
        if (dy < 0) { dx = -dx; dy = -dy; }
        // engraver's compromise: mostly the fall line, bent by the form
        const fx = jh[0], fy = jh[1], fl = Math.hypot(fx, fy) || 1;
        dx = 0.42 * dx + 0.58 * (-fx / fl); dy = 0.42 * dy + 0.58 * (-fy / fl);
        dl = Math.hypot(dx, dy) || 1;
        DX[k] = dx / dl; DY[k] = dy / dl;
        // screen gradient direction (uphill)
        let gx = ju[0] * ru + jh[0] * rh, gy = ju[1] * ru + jh[1] * rh;
        const gg = Math.hypot(gx, gy) || 1;
        GX[k] = gx / gg; GY[k] = gy / gg;
        SL[k] = gl;
        let d = LW.clamp(1 - (lam - 0.08) / 0.8, 0, 1);
        d = 0.08 + 0.72 * Math.pow(d, 1.25);
        d += 0.28 * LW.smooth(0.42, 0.12, LW.ridge((u + 0.6 * LW.fbm(h * 0.11, u * 0.09 + 3, 2)) * 0.36, h * 0.055 + 2.0, 3)); // buttress valleys
        d += 0.3 * LW.smooth(2000, 3300, y);
        d += (shadow.at(x, y) / 255) * 0.42;
        d += 0.06 * LW.noise(x * 0.01, y * 0.01);
        D[k] = LW.clamp(d, 0, 1);
      }
      if (j % 120 === 0) await LW.tick();
    }
    const dAt = (x, y) => grid.get(D, x, y);

    LW.occlude(G.path);
    const fillG = LW.fill, inkG = LW.ink;
    // ---- flat plates: 4 rock tones from the value field (rendered at 2px)
    {
      const cw = Math.ceil(1600 / 2), chh = Math.ceil(3900 / 2);
      const c = LW.canvas(cw, chh);
      const g = c.getContext('2d');
      const id = g.createImageData(cw, chh);
      const cols = ROCK.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
        const x = 600 + i * 2, y = j * 2;
        const d = dAt(x, y) + 0.05 * LW.noise3(x * 0.03, y * 0.03);
        const t = d < 0.34 ? 0 : d < 0.55 ? 1 : d < 0.74 ? 2 : 3;
        const o = (j * cw + i) * 4;
        id.data[o] = cols[t][0]; id.data[o + 1] = cols[t][1]; id.data[o + 2] = cols[t][2]; id.data[o + 3] = 255;
      }
      g.putImageData(id, 0, 0);
      fillG.save();
      fillG.clip(G.path);
      fillG.imageSmoothingEnabled = true;
      fillG.drawImage(c, 600, 0, 1600, 3900);
      fillG.restore();
    }
    await LW.tick();
    inkG.save(); inkG.clip(G.path);
    let pen = new LW.Pen();
    // ---- form-following hatching
    const inside = (x, y) => G.mask.in(x, y);
    const lines = LW.streamlines({
      bbox: { x0: 600, y0: 0, x1: 2200, y1: 3900 }, seed: 11,
      inside,
      dir: (x, y) => [grid.get(DX, x, y), grid.get(DY, x, y)],
      sep: (x, y) => { const d = dAt(x, y); return d < 0.13 ? 0 : 2.7 + 12.5 * Math.pow(1 - d, 1.9); },
      step: 2.6, minLen: 14, seedGrid: 30, cell: 6,
    });
    LW.drawLines(pen, lines, (x, y) => 0.5 + 1.75 * dAt(x, y), 0.3, 0.1);
    pen.draw(inkG, C.ink);
    await LW.tick();
    // ---- cross-hatching in the darks (along the gradient)
    const lines2 = LW.streamlines({
      bbox: { x0: 600, y0: 0, x1: 2200, y1: 3900 }, seed: 12,
      inside,
      dir: (x, y) => [grid.get(GX, x, y), grid.get(GY, x, y)],
      sep: (x, y) => { const d = dAt(x, y); return d < 0.6 ? 0 : 3.2 + 16 * Math.pow(1 - d, 1.4); },
      step: 2.6, minLen: 8, seedGrid: 30, cell: 6,
    });
    LW.drawLines(pen, lines2, (x, y) => 0.5 + 1.1 * dAt(x, y), 0.35, 0.1);
    pen.draw(inkG, C.ink);
    await LW.tick();
    // ---- iso-contours of the relief: lump outlines, heavy on the shadow side
    for (let lv = 0.4; lv < 2.0; lv += 0.32) {
      const iso = LW.marching(R, grid.w, grid.h, lv + 0.03 * Math.sin(lv * 13), grid.map());
      for (const L of iso) {
        if (L.length < 4) continue;
        const pts = LW.spline(L.filter((_, i) => i % 2 === 0 || i === L.length - 1), 3);
        const seed = rnd() * 100;
        let run = [], ws = [];
        const flush = () => { if (run.length > 3) pen.line(run, ws, 0.25, 0.15); run = []; ws = []; };
        for (const p of pts) {
          if (!inside(p[0], p[1])) { flush(); continue; }
          const gx = grid.get(GX, p[0], p[1]), gy = grid.get(GY, p[0], p[1]);
          const sh = LW.shadowSide(-gx, -gy); // outward = downhill
          const sl = LW.smooth(0.3, 1.4, grid.get(SL, p[0], p[1]));
          const w = (0.3 + 2.8 * sh * sh * sh) * (0.4 + 0.8 * sl) * (1 + 0.3 * LW.noise3(p[0] * 0.03 + seed, p[1] * 0.03));
          if (sh < 0.55 || w < 0.75 || LW.noise3(p[0] * 0.012 + seed, p[1] * 0.012) < -0.2) { flush(); continue; }
          run.push(p); ws.push(w);
        }
        flush();
      }
      if (pen.n > 3000) pen.draw(inkG, C.ink);
    }
    pen.draw(inkG, C.ink);
    // ---- tafoni pocks
    for (let k = 0; k < 45; k++) {
      const cu = rnd.range(-0.3, 19), ch = rnd.range(-16, 11);
      const cluster = rnd.int(1, 5);
      for (let m = 0; m < cluster; m++) {
        const u = cu + rnd.gauss() * 0.35, h = ch + rnd.gauss() * 0.22;
        const r = rnd.range(0.04, 0.17);
        const pts = [];
        for (let a = 0; a < LW.TAU; a += 0.3) pts.push(S.faceP(u + Math.cos(a) * r * (1 + 0.25 * LW.noise(a, k + m)), h + Math.sin(a) * r * 0.65, 0));
        if (!inside(pts[0][0], pts[0][1])) continue;
        LW.flat(LW.polyPath(pts), '#6b5236');
        LW.inkContour(pen, pts, (nx, ny) => { const sh = 1 - LW.shadowSide(nx, ny); return 0.3 + 3.0 * sh * sh; }, { taper: 0.3 });
      }
    }
    pen.draw(inkG, C.ink);
    inkG.restore();
    // ---- silhouette contour of the headland
    pen = new LW.Pen();
    LW.inkContour(pen, G.sky, () => 3.0 + rnd() * 0.8, { closed: false, taper: 0.02 });
    LW.inkContour(pen, G.corner, () => 3.6 + rnd() * 1.0, { closed: false, taper: 0.02 });
    pen.draw(inkG, C.ink);
    LW.cliffDark = dAt;
    {
      const S = LW.scene;
      const rnd = LW.rng('capers');
      // ---- caper tufts in crevices of the far cliff (only where the cliff is visible)
    for (let k = 0; k < 26; k++) {
      const u = rnd.range(0.5, 16), h = rnd.range(-6, 10);
      const p = S.faceP(u, h, 0);
      if (!G.mask.in(p[0], p[1])) continue;
      LW.caper(p[0], p[1], rnd.range(28, 52), rnd);
    }
    }
  };
})();

// Generic screen-space engraved rock: poly (screen), relief(x,y) (in px units of height),
// opts: light (3D screen light), base (darkness bias), tones, sp scale.
(function () {
  const LW = window.LW, C = LW.C;
  LW.reliefRock = async function (poly, relief, o = {}) {
    const path = LW.polyPath(poly);
    const bb = LW.bbox(poly, 4);
    const mask = LW.Mask.fromPath(path, bb, 0.5);
    const grid = new LW.Grid(bb.x0, bb.y0, bb.x1, bb.y1, o.cell || 4);
    const R = grid.field(), D = grid.field(), DX = grid.field(), DY = grid.field(), GX = grid.field(), GY = grid.field(), SL = grid.field();
    const L = (() => { const l = o.light || [-0.55, -0.6, 0.6]; const m = Math.hypot(l[0], l[1], l[2]); return [l[0] / m, l[1] / m, l[2] / m]; })();
    const e = 2;
    const k = o.k || 1;
    for (let j = 0; j < grid.h; j++) for (let i = 0; i < grid.w; i++) {
      const q = j * grid.w + i;
      const x = grid.x0 + i * grid.cs, y = grid.y0 + j * grid.cs;
      const r0 = relief(x, y), rx = (relief(x + e, y) - r0) / e * k, ry = (relief(x, y + e) - r0) / e * k;
      R[q] = r0;
      const nl = Math.hypot(rx, ry, 1);
      const lam = (-rx * L[0] - ry * L[1] + L[2]) / nl;
      let d = LW.clamp(1 - (lam - 0.1) / 0.85, 0, 1);
      d = (o.base || 0) + (1 - (o.base || 0)) * Math.pow(d, 1.2);
      if (o.dark) d += o.dark(x, y, r0);
      D[q] = LW.clamp(d, 0, 1);
      const gl = Math.hypot(rx, ry) || 1e-6;
      let tx = -ry / gl, ty = rx / gl;
      const wv = LW.smooth(0.15, 0.0, gl);
      tx = tx * (1 - wv); ty = ty * (1 - wv) + wv;
      const tl = Math.hypot(tx, ty) || 1;
      DX[q] = tx / tl; DY[q] = ty / tl;
      GX[q] = rx / gl; GY[q] = ry / gl;
      SL[q] = gl;
    }
    const dAt = (x, y) => grid.get(D, x, y);
    LW.occlude(path);
    const tones = o.tones || ['#d9c391', '#c9ae78', '#b09265', '#977b52'];
    // flats
    {
      const cw = Math.ceil(bb.w / 2), ch = Math.ceil(bb.h / 2);
      const c = LW.canvas(cw, ch);
      const g = c.getContext('2d');
      const id = g.createImageData(cw, ch);
      const cols = tones.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const x = bb.x0 + i * 2, y = bb.y0 + j * 2;
        const d = dAt(x, y) + 0.05 * LW.noise3(x * 0.03, y * 0.03);
        const t = d < 0.35 ? 0 : d < 0.56 ? 1 : d < 0.76 ? 2 : 3;
        const q = (j * cw + i) * 4;
        id.data[q] = cols[t][0]; id.data[q + 1] = cols[t][1]; id.data[q + 2] = cols[t][2]; id.data[q + 3] = 255;
      }
      g.putImageData(id, 0, 0);
      LW.fill.save(); LW.fill.clip(path); LW.fill.drawImage(c, bb.x0, bb.y0, cw * 2, ch * 2); LW.fill.restore();
    }
    const ink = LW.ink;
    ink.save(); ink.clip(path);
    const pen = new LW.Pen();
    const inside = (x, y) => mask.in(x, y);
    const sps = o.sp || 1;
    const lines = LW.streamlines({
      bbox: bb, seed: o.seed || 5, inside,
      dir: (x, y) => [grid.get(DX, x, y), grid.get(DY, x, y)],
      sep: (x, y) => { const d = dAt(x, y); return d < 0.12 ? 0 : (2.6 + 12 * Math.pow(1 - d, 1.8)) * sps; },
      step: 2.6, minLen: 12, seedGrid: 26, cell: 6,
    });
    LW.drawLines(pen, lines, (x, y) => (0.5 + 1.9 * dAt(x, y)) * (o.lw || 1), 0.3, 0.1);
    pen.draw(ink, C.ink);
    await LW.tick();
    const lines2 = LW.streamlines({
      bbox: bb, seed: (o.seed || 5) + 1, inside,
      dir: (x, y) => [grid.get(GX, x, y), grid.get(GY, x, y)],
      sep: (x, y) => { const d = dAt(x, y); return d < 0.58 ? 0 : (3.2 + 15 * Math.pow(1 - d, 1.4)) * sps; },
      step: 2.6, minLen: 8, seedGrid: 26, cell: 6,
    });
    LW.drawLines(pen, lines2, (x, y) => (0.5 + 1.2 * dAt(x, y)) * (o.lw || 1), 0.35, 0.1);
    pen.draw(ink, C.ink);
    const lv0 = o.isoStep || 0.2;
    let rmin = Infinity, rmax = -Infinity;
    for (let q = 0; q < R.length; q++) { if (R[q] < rmin) rmin = R[q]; if (R[q] > rmax) rmax = R[q]; }
    for (let lv = rmin + lv0; lv < rmax; lv += lv0) {
      const iso = LW.marching(R, grid.w, grid.h, lv, grid.map());
      for (const Lq of iso) {
        if (Lq.length < 4) continue;
        const pts = LW.spline(Lq.filter((_, i) => i % 2 === 0 || i === Lq.length - 1), 3);
        let run = [], ws = [];
        const flush = () => { if (run.length > 3) pen.line(run, ws, 0.25, 0.15); run = []; ws = []; };
        const sd = lv * 13.7;
        for (const p of pts) {
          if (!inside(p[0], p[1])) { flush(); continue; }
          const gx = grid.get(GX, p[0], p[1]), gy = grid.get(GY, p[0], p[1]);
          const sh = LW.shadowSide(-gx, -gy);
          const sl = LW.smooth(0.1, 0.8, grid.get(SL, p[0], p[1]));
          const w = (0.3 + 3.0 * sh * sh * sh) * (0.4 + 0.8 * sl) * (o.lw || 1);
          if (sh < 0.45 || w < 0.5 || LW.noise3(p[0] * 0.012 + sd, p[1] * 0.012) < -0.35) { flush(); continue; }
          run.push(p); ws.push(w);
        }
        flush();
      }
      if (pen.n > 3000) pen.draw(ink, C.ink);
    }
    pen.draw(ink, C.ink);
    ink.restore();
    const op = new LW.Pen();
    LW.outline(op, poly, (o.outlineW || 3.4), 1.0);
    op.draw(ink, C.ink);
    return { path, mask, dAt };
  };
})();
