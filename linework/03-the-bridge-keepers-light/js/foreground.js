/* foreground.js: shore stones below the landing, big framing boulders,
   rocks in the river with ripple rings, reeds. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P, L = LW.L;
  const N = new LW.Noise(901);
  const N2 = new LW.Noise(902);

  /* A large boulder: dome shading from its distance field, concentric contour
     hatching that wraps the form, cracks, heavy base outline. */
  LW.drawBoulder = function (ctx, S, spec) {
    const pts = spec.pts || LW.blob(spec.x, spec.y, spec.rx, spec.ry, spec.seed, spec.rough || 0.16, 90);
    const path = LW.polyPath(pts);
    const bb = LW.bbox(pts, 6);
    const mask = new LW.Mask(bb, 3, (c) => c.fill(path));
    const R = Math.max(spec.rx, spec.ry) * 0.6;
    const kind = spec.kind || 'rock';
    const shade = (x, y) => {
      const e = mask.edtAt(x, y);
      const h = Math.sqrt(LW.clamp(e / R, 0, 1));
      const gx = mask.edtAt(x + 5, y) - mask.edtAt(x - 5, y);
      const gy = mask.edtAt(x, y + 5) - mask.edtAt(x, y - 5);
      const gl = Math.hypot(gx, gy) || 1;
      // normal leans outward near the rim, up at the top
      const tilt = 1 - h;
      const nx = (-gx / gl) * tilt, ny = (-gy / gl) * tilt, nz = h + 0.25;
      let lit = LW.lambert(nx, ny - 0.35, nz);
      let d = 1 - lit * 1.1 + (spec.dark || 0);
      d += 0.05 * N.fbm(x / 160, y / 160, 2);
      return LW.clamp(d, 0, 1);
    };
    const G = new LW.Grid(bb, 5, shade);
    const pal = spec.pal || [P.rock1, P.rock2, P.rock3, P.rock4, LW.mix(P.rock4, P.ink, 0.5)];
    const wet = spec.wetY ? (x, y) => (y > spec.wetY - 14 && y < spec.wetY + 4 ? 1 : 0) : null;
    LW.cellRock(ctx, S, {
      path, bbox: bb, mask, seed: 'b' + spec.seed,
      dark: (x, y) => G.at(x, y),
      size: () => LW.clamp(Math.min(spec.rx, spec.ry * 1.6) * 0.42, 22, 96),
      maxSize: 100,
      aniso: 0.8,
      kind, pal, ink: P.ink,
      lineW: [1.2, 2.9], step: spec.lineStep || 6.2,
      lumpRatio: 0.82, light: [0.5, -0.86], wedgeW: 9,
      rim: wet, rimCol: P.water2,
    });
    const ink = new LW.Ink(spec.seed * 7 + 3);
    ink.wobble = 0.9;
    // black shadow pocket under the overhang of the base
    const blk = (x, y) => (mask.in(x, y) ? G.at(x, y) - 0.92 : -1);
    LW.contours({ bbox: bb, step: 4, field: blk, levels: [0] }, (c) => {
      if (c.length > 5) ink.fill(LW.chaikin(c, 1, true), P.ink, 0.6);
    });
    // cracks
    const rng = new LW.RNG('crk' + spec.seed);
    const nc = spec.cracks === undefined ? 3 : spec.cracks;
    for (let k = 0; k < nc; k++) {
      let x = spec.x + (rng.next() - 0.5) * spec.rx, y = spec.y - spec.ry * (0.2 + rng.next() * 0.6);
      if (!mask.in(x, y)) continue;
      let a = Math.PI / 2 + (rng.next() - 0.5) * 1.2;
      const cp = [[x, y]];
      for (let i = 0; i < 60; i++) {
        a += (rng.next() - 0.5) * 0.9;
        x += Math.cos(a) * 6; y += Math.sin(a) * 6;
        if (!mask.in(x, y)) break;
        cp.push([x, y]);
        if (rng.next() < 0.04) {
          // branch
          const bp = [[x, y]];
          let bx = x, by = y, ba = a + rng.sign() * 0.9;
          for (let j = 0; j < 12; j++) { ba += (rng.next() - 0.5) * 0.6; bx += Math.cos(ba) * 5; by += Math.sin(ba) * 5; if (!mask.in(bx, by)) break; bp.push([bx, by]); }
          ink.line(bp, ink.st(ink.col(P.ink), 1.4), { taper: 12 });
        }
      }
      ink.line(cp, (xx, yy, i) => ink.st(ink.col(P.ink), 2.6 * Math.sin(Math.PI * Math.min(1, (i + 1) / cp.length)) + 0.8), { taper: 18 });
    }
    ctx.save();
    ctx.clip(path);
    ink.flush(ctx);
    ctx.restore();
    const o = new LW.Ink(spec.seed * 7 + 4);
    o.wobble = 0.7;
    o.line(pts.concat([pts[0]]), (x, y) => {
      const ny = (y - spec.y) / spec.ry, nx = (x - spec.x) / spec.rx;
      const sh = Math.max(0, ny * 0.8 - nx * 0.3);
      const b = LW.warmBand(LW.warm(x, y, kind) * (spec.warmK || 1), x, y);
      return o.st(o.col(LW.warmInkColor(b, P.ink)), (spec.outline || 3.2) + sh * 3);
    }, { taper: 0 });
    o.flush(ctx);
    return { pts, path };
  };

  // short downstream wake: nested crescents trailing below the stone
  function wakeV(ink, x, y, rx, col, seed) {
    for (let k = 1; k <= 4; k++) {
      const pts = [];
      const R = rx * (0.75 + k * 0.16), dy = 5 + k * Math.min(rx, 60) * 0.16;
      for (let a = 0.15; a <= Math.PI - 0.15; a += 0.05) pts.push([x + Math.cos(a) * R, y + dy + Math.sin(a) * R * 0.16]);
      ink.line(pts, (xx, yy, i) => (N.n2(i / 5 + seed * 3, k * 1.7) > 0.32 ? -1 : ink.st(col, 2.0 - k * 0.3)), { taper: 14 });
    }
  }
  function ripples(ink, x, y, rx, n, col, seed) {
    wakeV(ink, x, y, rx, col, seed);
    for (let k = 1; k <= n; k++) {
      const R0 = rx * (1 + k * 0.22), ry = R0 * 0.2;
      const pts = [];
      for (let a = -0.2; a <= Math.PI + 0.2; a += 0.03) pts.push([x + Math.cos(a) * R0, y + Math.sin(a) * ry]);
      ink.line(pts, (xx, yy) => (N.n2(xx / 30 + seed, k * 2.1) > 0.25 ? -1 : ink.st(col, Math.max(0.8, 2.2 - k * 0.15))), { taper: 12 });
    }
  }

  function reeds(ink, x, y, n, h, seed, lean = 0.3) {
    const rng = new LW.RNG('reed' + seed);
    for (let i = 0; i < n; i++) {
      const bx = x + (rng.next() - 0.5) * 40, by = y + (rng.next() - 0.5) * 8;
      const hh = h * (0.5 + rng.next() * 0.7);
      const bend = lean + (rng.next() - 0.5) * 0.8;
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.1) pts.push([bx + bend * hh * t * t, by - hh * t]);
      const b = LW.warmBand(LW.warm(bx, by - hh * 0.5, 'rock'), bx, by);
      ink.line(pts, ink.st(ink.col(b >= 3 ? P.warmInk2 : P.ink), 2.4), { taper: hh * 0.8, minScale: 0.15 });
    }
  }

  LW.drawForeground = function (ctx, S) {
    const t0 = performance.now();
    // the stony shore below the landing, running down into the river
    // clusters of half-sunk stones at the water's edge (not a bead string)
    {
      const rng = new LW.RNG('edge-clusters');
      const shoreP = [[990, 2930], [962, 3000], [884, 3094], [808, 3196], [734, 3314], [620, 3452], [520, 3570]];
      const spots = [0.05, 0.2, 0.33, 0.5, 0.62, 0.8, 0.93];
      for (let s = 0; s < spots.length; s++) {
        const f = spots[s] * (shoreP.length - 1);
        const i = Math.floor(f), tt = f - i;
        const a = shoreP[i], b = shoreP[Math.min(i + 1, shoreP.length - 1)];
        const cx = a[0] + (b[0] - a[0]) * tt, cy = a[1] + (b[1] - a[1]) * tt;
        const poly = [];
        const R0 = 40 + rng.next() * 50;
        for (let k = 0; k < 10; k++) {
          const ang = (k / 10) * Math.PI * 2;
          poly.push([cx + Math.cos(ang) * R0 * 1.3, cy + Math.sin(ang) * R0 * 0.55]);
        }
        LW.drawStonePile(ctx, S, poly, { rMin: 8, rMax: 26 + rng.next() * 12, seed: 'ec' + s, dark: 0.5, persp: true, tries: 60 + rng.int(0, 60), weight: 1.2 });
      }
    }
    // rocks in the river (behind the boulders)
    const ink = new LW.Ink(911);
    ink.wobble = 0.6;
    const rc = ink.col(P.waterInk);
    ripples(ink, 1560, 3302, 60, 6, rc, 1);
    ripples(ink, 1840, 3612, 170, 8, rc, 2);
    ripples(ink, 1160, 3150, 40, 5, rc, 3);
    ink.flush(ctx);
    LW.drawBoulder(ctx, S, { x: 1560, y: 3290, rx: 62, ry: 26, seed: 31, dark: 0.55, wetY: 3302, cracks: 1, outline: 2.6, lineStep: 6 });
    LW.drawBoulder(ctx, S, { x: 1160, y: 3140, rx: 40, ry: 17, seed: 33, dark: 0.55, wetY: 3150, cracks: 0, outline: 2.4, lineStep: 6 });
    LW.drawBoulder(ctx, S, { x: 1840, y: 3590, rx: 175, ry: 70, seed: 35, dark: 0.55, wetY: 3612, cracks: 2, outline: 3.2 });
    // a heron standing on one leg on the big rock, silhouetted against the glowing river
    {
      const hx = 0, hy = 0;
      const T = (p) => [p[0] + hx, p[1] + hy];
      const body = [[1852, 3446], [1838, 3416], [1818, 3400], [1797, 3398], [1782, 3406], [1776, 3420], [1784, 3440], [1806, 3452], [1830, 3453]].map(T);
      const hi = new LW.Ink(931);
      hi.wobble = 0.2;
      const cInk = hi.col(P.ink), cRim = hi.col(LW.mix(P.water4, P.star, 0.3));
      // leg and tucked foot
      hi.line([[1801, 3536], [1805, 3492], [1800, 3448]].map(T), hi.st(cInk, 3.2), { taper: 0 });
      hi.line([[1800, 3536], [1786, 3538]].map(T), hi.st(cInk, 2.2), { taper: 0 });
      hi.line([[1801, 3536], [1812, 3539]].map(T), hi.st(cInk, 2.0), { taper: 0 });
      hi.line([[1812, 3452], [1822, 3470], [1814, 3474]].map(T), hi.st(cInk, 2.6), { taper: 0 });
      // S-curved neck
      const neck = [[1786, 3410], [1778, 3394], [1783, 3378], [1792, 3367], [1789, 3354], [1779, 3346]].map(T);
      hi.flush(ctx);
      ctx.save();
      ctx.strokeStyle = LW.rgb(P.ink);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < neck.length - 1; i++) {
        ctx.lineWidth = 11 - i * 1.0;
        ctx.beginPath(); ctx.moveTo(neck[i][0], neck[i][1]); ctx.lineTo(neck[i + 1][0], neck[i + 1][1]); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = LW.rgb(P.ink);
      ctx.fill(LW.polyPath(LW.chaikin(body, 2, true)));
      ctx.beginPath(); ctx.ellipse(1773 + hx, 3343 + hy, 8, 5.5, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fill(LW.polyPath([[1767, 3339], [1732, 3347], [1767, 3347]].map(T)));
      // plumes: crest and drooping back feathers
      hi.line([[1777, 3339], [1796, 3333]].map(T), hi.st(cInk, 1.4), { taper: 8, wobble: 0 });
      for (let k = 0; k < 4; k++) hi.line([[1830 + k * 5, 3446], [1848 + k * 6, 3462 + k * 3]].map(T), hi.st(cInk, 1.6), { taper: 6, wobble: 0 });
      // cool rim light from the river along the back and neck
      const rimB = LW.chaikin(body, 2, true).filter((p) => p[1] < 3420 + hy);
      hi.line(rimB, hi.st(cRim, 1.5), { taper: 10 });
      hi.line(neck.map((p, i) => [p[0] + 5.5 - i * 0.5, p[1]]), hi.st(cRim, 1.3), { taper: 10 });
      hi.flush(ctx);
    }
    // dark rock bed under the framing boulders so no water shows through gaps
    {
      const bed = [[-40, 3200], [300, 3360], [560, 3480], [800, 3640], [1080, 3790], [1120, 3880], [-40, 3880]];
      ctx.fillStyle = LW.rgb(LW.mix(P.rock4, P.ink, 0.55));
      ctx.fill(LW.polyPath(LW.chaikin(bed, 2, true)));
    }
    // the framing boulders, back to front
    const bl = [
      { x: 60, y: 3300, rx: 250, ry: 150, seed: 47, dark: 0.48 },
      { x: 420, y: 3440, rx: 210, ry: 120, seed: 41, dark: 0.5 },
      { x: 700, y: 3600, rx: 190, ry: 110, seed: 42, dark: 0.52 },
      { x: 2120, y: 3800, rx: 290, ry: 170, seed: 43, dark: 0.6, outline: 4 },
      { x: 190, y: 3600, rx: 380, ry: 230, seed: 44, dark: 0.6, outline: 4.6 },
      { x: 740, y: 3820, rx: 360, ry: 170, seed: 45, dark: 0.66, outline: 4.6 },
      { x: 20, y: 3880, rx: 300, ry: 170, seed: 46, dark: 0.75, outline: 5 },
    ];
    for (const b of bl) LW.drawBoulder(ctx, S, Object.assign({ lineStep: 7, cracks: 3 }, b));
    const ink2 = new LW.Ink(912);
    ink2.wobble = 0.4;
    reeds(ink2, 640, 3352, 14, 70, 1, 0.35);
    reeds(ink2, 980, 2928, 9, 46, 2, 0.4);
    reeds(ink2, 330, 3285, 10, 55, 3, -0.2);
    reeds(ink2, 1010, 3690, 16, 120, 4, 0.25);
    reeds(ink2, 1960, 3650, 8, 60, 5, -0.3);
    reeds(ink2, 560, 3330, 12, 80, 6, 0.3);
    reeds(ink2, 160, 3110, 10, 60, 7, 0.15);
    reeds(ink2, 860, 3110, 8, 50, 8, 0.45);
    ink2.flush(ctx);
    LW.log('foreground ms', Math.round(performance.now() - t0));
  };
})();
