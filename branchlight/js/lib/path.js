/* Branchlight — the cream path in perspective, with marbled veins, cracked plates and grit.
 *
 * Screen row y maps to a depth u = (y - horizon) / (H - horizon) (1 at the bottom edge,
 * 0 at the horizon) and world distance z = 1/u. The path's world centre X(z) meanders;
 * on screen it converges on the vanishing point. Textures are computed in world space
 * (lateral w, distance z) so plates and veins foreshorten correctly.
 */
(function () {
  'use strict';
  const BL = window.BL;
  const { clamp, mix, smooth } = BL;

  BL.path = function (S, seed, o) {
    const n1 = BL.noise(seed), n2 = BL.noise(seed + 7), n3 = BL.noise(seed + 13);
    const rnd = BL.rng(seed + 99);
    const H = S.H, W = S.W, yH = o.horizon, span = H - yH;
    const C = BL.C;
    const cream = o.cream || C.cream, cream2 = o.cream2 || C.cream2, edgeCol = o.edge || C.sand;
    const veinCol = o.vein || C.orange, veinDark = o.veinDark || C.darkOchre, crackCol = o.crack || C.lightOrange;
    const tint = o.tint || C.apricot;

    // Voronoi points cached per cell
    const cellPt = (ix, iz) => {
      const h = Math.sin(ix * 127.1 + iz * 311.7 + seed * 0.013) * 43758.5453;
      const h2 = Math.sin(ix * 269.5 + iz * 183.3 + seed * 0.017) * 43758.5453;
      return [ix + 0.15 + 0.7 * (h - Math.floor(h)), iz + 0.15 + 0.7 * (h2 - Math.floor(h2))];
    };
    function voronoi(x, z) {
      const ix = Math.floor(x), iz = Math.floor(z);
      let f1 = 9, f2 = 9, id = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const p = cellPt(ix + i, iz + j);
        const d = Math.hypot(p[0] - x, p[1] - z);
        if (d < f1) { f2 = f1; f1 = d; id = (ix + i) * 7919 + (iz + j) * 104729; }
        else if (d < f2) f2 = d;
      }
      return [f1, f2, id];
    }

    const info = (y) => {
      const u = (y - yH) / span;
      const z = 1 / Math.max(u, 1e-4);
      const cx = o.vpX + o.centre(z) * u * o.scale;
      const hw = o.halfW * u * o.scale;
      return { u, z, cx, hw };
    };

    function marble(wx, wz) {
      const wq = n2.fbm(wx * 0.6, wz * 0.25, 3);
      return n1.fbm(wx * 1.1 + wq * 2.4, wz * 0.18 + wq, 4);
    }
    const edges = { left: [], right: [] };
    const y0 = Math.max(Math.ceil(o.top), Math.ceil(yH + 1));
    for (let y = y0; y < H; y++) {
      const { u, z, cx, hw } = info(y);
      if (hw < 0.3) continue;
      const cn = info(y + 1);
      const pxw = 1 / (u * o.scale); // world units per pixel (lateral)
      const raggedL = 1 + 0.1 * (n3(z * 3, 1.5) - 0.5) * 2 + 0.05 * (n3(z * 17, 4) - 0.5);
      const raggedR = 1 + 0.1 * (n3(z * 3, 8.5) - 0.5) * 2 + 0.05 * (n3(z * 17, 9) - 0.5);
      if (y % 3 === 0) {
        edges.left.push([cx - hw * raggedL, y, u]);
        edges.right.push([cx + hw * raggedR, y, u]);
      }
      const xa = Math.floor(cx - hw * raggedL), xb = Math.ceil(cx + hw * raggedR);
      for (let x = Math.max(0, xa); x <= Math.min(W - 1, xb); x++) {
        const q = (x - cx) / hw;
        const lim = q < 0 ? raggedL : raggedR;
        if (Math.abs(q) > lim) continue;
        const wx = q * o.halfW, wz = z;
        const edge = smooth(0.55, 1.0, Math.abs(q) / lim);
        // base cream with plate variation
        const warpX = (n3(wx * 2.2, wz * 0.9) - 0.5) * 0.45, warpZ = (n2(wx * 2.2 + 7, wz * 0.9) - 0.5) * 0.45;
        const vor = voronoi(wx * o.plate[0] + warpX, wz * o.plate[1] + warpZ);
        const cellV = ((vor[2] * 0.618) % 1 + 1) % 1;
        let c = mix(cream, cream2, 0.25 + 0.6 * cellV * n1(wx * 2, wz * 0.6));
        c = mix(c, edgeCol, edge * 0.8);
        // marbling: broad warm tint, warped
        const mv = marble(wx, wz);
        if (mv > 0.6) c = mix(c, tint, smooth(0.6, 0.75, mv) * (o.tintAmt || 0.5));
        // some plates carry a warm wash
        if (cellV > 0.78) c = mix(c, tint, 0.35 * (cellV - 0.78) / 0.22 + 0.15);
        if (o.shadow) { const sh = o.shadow(x, y, u); if (sh > 0) c = mix(c, o.shadowCol, sh); }
        // distance falls into the haze / light
        const far = o.farFade ? o.farFade(u, x, y) : 0;
        if (far > 0) c = mix(c, S.bgAt(x, y), far);
        S.soft(x, y, c);

        if (u < (o.detailFrom || 0.12)) continue;
        let crisp = null;
        // veins: 1-px contours of the marble field (width normalised by its gradient)
        const mx = marble(((x + 1 - cx) / hw) * o.halfW, wz);
        const my = marble(((x - cn.cx) / cn.hw) * o.halfW, cn.z);
        const g = Math.hypot(mx - mv, my - mv) + 1e-5;
        const dv = Math.abs(mv - 0.6) / g;
        if (dv < 0.5) crisp = veinCol;
        else if (Math.abs(mv - 0.45) / g < 0.5 && u > 0.3) crisp = veinDark;
        // cracks: gaps between plates, wide and orange near the viewer, a dark seam inside
        const gap = vor[1] - vor[0];
        const cw = Math.max(pxw * o.plate[0] * 1.2, o.crackW * u * u * (0.3 + 1.2 * n1(wx * 2.5, wz * 1.1)));
        if (gap < cw && n2(wx * 1.3, wz * 0.4) > 0.34) {
          const seam = gap < pxw * o.plate[0] * 0.8 && u > 0.35;
          crisp = seam ? veinDark : (n3(wx * 3, wz * 1.2) > 0.5 ? crackCol : veinCol);
        }
        if (crisp) {
          if (far > 0) crisp = mix(crisp, S.bgAt(x, y), far);
          if (o.shadow) { const sh = o.shadow(x, y, u); if (sh > 0) crisp = mix(crisp, o.shadowCol, sh * 0.6); }
          S.px(x, y, crisp);
        }
      }
    }
    // grit and paint flecks on the path, denser near the viewer
    const grit = o.grit || 0;
    for (let i = 0; i < grit; i++) {
      const y = Math.floor(yH + span * Math.pow(rnd(), 0.6));
      if (y < y0) continue;
      const { u, cx, hw } = info(y);
      const x = cx + (rnd() * 2 - 1) * hw * 0.95;
      let col = rnd.weighted(o.gritColours);
      const far = o.farFade ? o.farFade(u, x, y) : 0;
      if (far > 0) col = mix(col, S.bgAt(x, y), far);
      S.px(x, y, col);
      if (u > 0.6 && rnd() < 0.25) S.px(x + 1, y, col);
      if (u > 0.5 && rnd() < 0.12) for (let k = 1; k < rnd.int(2, 5); k++) S.px(x, y + k, col);
    }
    return { info, edges };
  };
})();
