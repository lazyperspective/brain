// III. THE SUN (panorama) — flat gouache, compass and ruler. On its left edge it
// shatters into the impasto of II, its rings continuing as paint; on its right
// it softens and dissolves into the dusk of IV.
SC.WORLD.geo = async function (S) {
  const DH = SC.DH, HZ = SC.HZ;
  const X0 = 1740, X1 = 3380;
  const Ly = SC.layer(X0, X1, S);
  const ctx = Ly.ctx;
  const R = new L.Rand(3301), N = L.noise2(13), N2 = L.noise2(14);
  const P = (h) => L.hex(h);
  const C = {
    white: P('#fbf5e6'), lemon: P('#f5dc45'), cad: P('#f0ad1c'), orange: P('#e9711b'), verm: P('#d5351f'),
    crimson: P('#9e1630'), magenta: P('#c0306b'), pink: P('#f0a39b'), cerul: P('#47a0c6'), cobalt: P('#1f4c9e'),
    ultra: P('#1a2766'), black: P('#151018'), cream: P('#efdfba'), violet: P('#47285f'), teal: P('#1f6f77'),
  };
  const CX = SC.SUN[0], CY = SC.SUN[1];
  // hand-cut edges: tiny wobble, plus a faint pigment rim where gouache dries
  const wob = (pts) => pts.map(([x, y]) => [x + N(x / 30, y / 30) * 0.8 + N(x / 6, y / 6) * 0.15, y + N2(x / 30, y / 30) * 0.8 + N2(x / 6, y / 6) * 0.15]);
  function shape(pts, col, rim = 0.22) {
    const w = wob(pts);
    ctx.fillStyle = L.css(col); L.path(ctx, w, true); ctx.fill();
    if (rim) { ctx.strokeStyle = L.css(L.mix(col, [20, 10, 20], 0.25), rim); ctx.lineWidth = 0.9; L.path(ctx, w, true); ctx.stroke(); }
  }
  const arcPts = (cx, cy, r, a0, a1, step = 0.01) => { const o = []; const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step)); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
  const sector = (cx, cy, r0, r1, a0, a1) => arcPts(cx, cy, r1, a0, a1).concat(arcPts(cx, cy, r0, a1, a0));
  const lens = (x, y, len, wid, rot) => {
    const o = [], c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i <= 24; i++) { const t = i / 24, px = (t - 0.5) * len, py = Math.sin(t * Math.PI) * wid / 2; o.push([x + px * c - py * s, y + px * s + py * c]); }
    for (let i = 24; i >= 0; i--) { const t = i / 24, px = (t - 0.5) * len, py = -Math.sin(t * Math.PI) * wid / 2 * 0.55; o.push([x + px * c - py * s, y + px * s + py * c]); }
    return o;
  };


  // ---------- background: an uneven sunburst, burning above, drowning below ----------
  {
    const n = 48; let a = -Math.PI / 2 - 0.03;
    const widths = []; for (let i = 0; i < n; i++) widths.push(i % 2 ? R.r(0.6, 0.9) : R.r(1.0, 1.5));
    const tot = widths.reduce((s, v) => s + v, 0);
    for (let i = 0; i < n; i++) {
      const da = widths[i] / tot * Math.PI * 2, mid = a + da / 2;
      const down = (Math.sin(mid) + 1) / 2;
      let col;
      if (down < 0.62) col = i % 2 ? (i % 6 === 1 ? C.cad : C.orange) : (i % 8 === 0 ? C.pink : C.verm);
      else if (down < 0.82) col = i % 2 ? C.magenta : C.crimson;
      else col = i % 2 ? (i % 4 === 1 ? C.ultra : C.violet) : C.crimson;
      shape([[CX, CY], [CX + Math.cos(a) * 2600, CY + Math.sin(a) * 2600], [CX + Math.cos(a + da) * 2600, CY + Math.sin(a + da) * 2600]], col, 0.15);
      a += da;
    }
    // the halo rings — the same rings II paints in impasto, here cut clean
    for (const [r0, r1, hex] of SC.HALO) {
      let a0 = R.r(0, Math.PI * 2);
      const parts = R.int(3, 5);
      for (let k = 0; k < parts; k++) {
        const span = (Math.PI * 2 / parts) * R.r(0.82, 0.97);
        shape(sector(CX, CY, r0, r1, a0, a0 + span), P(hex), 0.2);
        a0 += Math.PI * 2 / parts;
      }
    }
  }

  // ---------- the geometric sea ----------
  {
    shape([[X0 - 10, HZ], [X1 + 10, HZ], [X1 + 10, DH + 10], [X0 - 10, DH + 10]], C.ultra);
    const cols = [C.cobalt, C.teal, C.cobalt, C.black, C.teal, C.ultra];
    let y = HZ + 8, r = 24, ri = 0;
    while (y < DH + 20) {
      for (let x = X0 - r * 2 + (ri % 2) * r; x < X1 + r * 2; x += r * 2) shape(arcPts(x + r, y + r, r, Math.PI, Math.PI * 2, 0.05), cols[ri % cols.length], 0.2);
      y += r * 0.85; r *= 1.16; ri++;
    }
    shape([[X0 - 10, HZ - 6], [X1 + 10, HZ - 6], [X1 + 10, HZ + 4], [X0 - 10, HZ + 4]], C.cream);
  }

  // ---------- spikes from the rim ----------
  for (let k = 0; k < 64; k++) {
    const a = k / 64 * Math.PI * 2 + R.r(-0.02, 0.02), w = R.r(0.012, 0.04), r1 = 410 + R.r(40, 230) * (k % 2 ? 0.6 : 1) * (Math.sin(a) > 0.3 ? 0.55 : 1);
    const col = [C.white, C.lemon, C.black, C.cad, C.white, C.pink][k % 6];
    shape([[CX + Math.cos(a - w) * 395, CY + Math.sin(a - w) * 395], [CX + Math.cos(a) * r1, CY + Math.sin(a) * r1], [CX + Math.cos(a + w) * 395, CY + Math.sin(a + w) * 395]], col, 0.25);
  }

  // ---------- wax drips: the sun itself is melting ----------
  const drips = [];
  // ---------- the sun: eccentric rings, quartered, colours flipping across each axis ----------
  const radii = [400, 356, 314, 274, 236, 200, 166, 136, 112, 92];
  const ringCols = [
    [C.crimson, C.magenta, C.ultra, C.verm],
    [C.orange, C.cerul, C.verm, C.pink],
    [C.cad, C.verm, C.lemon, C.magenta],
    [C.pink, C.cad, C.cerul, C.orange],
    [C.lemon, C.orange, C.white, C.cad],
    [C.verm, C.lemon, C.orange, C.cerul],
    [C.white, C.pink, C.cad, C.lemon],
    [C.cad, C.white, C.lemon, C.orange],
    [C.lemon, C.cream, C.white, C.cad],
    [C.white, C.lemon, C.white, C.cream],
  ];
  const axis = -0.32;
  const ctr = (r) => [CX + (400 - r) * 0.02, CY - (400 - r) * 0.09];
  {
    const ringColAt = (i, x, y) => { const [cx, cy] = ctr(radii[i]); let a = Math.atan2(y - cy, x - cx) - axis; a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return ringCols[i][Math.floor(a / (Math.PI / 2))]; };
    const spec = [[228, 26, 200, 2], [300, 44, 520, 3], [372, 22, 300, 2], [430, 62, 820, 4], [512, 34, 430, 3], [575, 54, 690, 4], [648, 24, 260, 2], [712, 40, 470, 3], [776, 18, 140, 1]];
    for (const [x0d, w, len, nb] of spec) {
      const x = x0d + 2000;
      for (let j = 0; j < nb; j++) {
        const [cx0, cy0] = ctr(radii[0]);
        const top = cy0 + Math.sqrt(Math.max(0, radii[0] ** 2 - (x - cx0) ** 2)) - 40 + j * 54;
        const wj = w * (1 - j * 0.24), lj = len * (1 - j * 0.16);
        const col = ringColAt(Math.min(j * 2, radii.length - 1), x, (ctr(radii[Math.min(j * 2, 9)])[1] + radii[Math.min(j * 2, 9)]) - 6);
        const neck = top + 40 + wj * 0.9, end = top + 40 + lj;
        const fl = j === 0 ? 0.85 : 0;
        const pts = [[x - wj * (0.5 + fl), top - 4]];
        for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([x - wj / 2 - wj * fl * (1 - t) ** 2, top + (neck - top) * t]); }
        pts.push([x - wj / 2, end]);
        for (const p of arcPts(x, end, wj / 2, Math.PI, 0, 0.12)) pts.push(p);
        pts.push([x + wj / 2, end]);
        for (let k = 10; k >= 0; k--) { const t = k / 10; pts.push([x + wj / 2 + wj * fl * (1 - t) ** 2, top + (neck - top) * t]); }
        pts.push([x + wj * (0.5 + fl), top - 4]);
        shape(pts, col, 0.25);
        shape(arcPts(x, end + wj * 0.25, wj * 0.66, 0, Math.PI * 2, 0.1), col, 0.25);
      }
    }
  }

  for (let i = 0; i < radii.length; i++) {
    const r = radii[i], [cx, cy] = ctr(r);
    for (let q = 0; q < 4; q++) {
      const a0 = axis + q * Math.PI / 2, a1 = a0 + Math.PI / 2;
      shape(arcPts(cx, cy, r, a0, a1).concat([[cx, cy]]), ringCols[i][q], 0.2);
    }
  }
  // the white-hot core
  { const [cx, cy] = ctr(70); shape(arcPts(cx, cy, 70, 0, Math.PI * 2), C.white, 0.15); }
  // drips are painted over the lower rings, as if the disc were running
  // ---------- Icarus, a black glyph at the heart of the sun ----------
  const [fx, fy] = ctr(70);
  {
    const B = C.black;
    ctx.save(); ctx.translate(fx, fy); ctx.scale(1.55, 1.55); ctx.translate(-fx, -fy);
    shape(lens(fx, fy + 2, 46, 9, Math.PI / 2), B, 0);
    shape(arcPts(fx, fy - 26, 6.5, 0, Math.PI * 2, 0.2), B, 0);
    // wings already coming apart: the left whole, the right in pieces
    shape([[fx - 3, fy - 12], [fx - 44, fy - 40], [fx - 36, fy - 22], [fx - 48, fy - 22], [fx - 34, fy - 8], [fx - 40, fy - 2], [fx - 4, fy - 4]], B, 0);
    shape([[fx + 3, fy - 12], [fx + 30, fy - 30], [fx + 24, fy - 16], [fx + 4, fy - 4]], B, 0);
    shape(lens(fx + 38, fy - 34, 16, 5, -0.9), B, 0);
    shape(lens(fx + 47, fy - 20, 12, 4, -0.3), B, 0);
    shape(lens(fx + 44, fy - 4, 10, 3.5, 0.6), B, 0);
    shape([[fx - 2, fy + 18], [fx - 10, fy + 34], [fx - 6, fy + 35], [fx + 1, fy + 22]], B, 0);
    shape([[fx + 2, fy + 18], [fx + 9, fy + 33], [fx + 13, fy + 31], [fx + 4, fy + 20]], B, 0);
    ctx.restore();
  }

  // ---------- feathers: shards breaking from the sun and falling along the path ----------
  {
    const F = SC.FALL, nF = F.length;
    const shards = [];
    for (let k = 0; k < 120; k++) {
      const t = Math.pow(k / 119, 0.85);
      const p = F[Math.min(nF - 1, Math.floor(t * (nF - 1)))];
      if (p[0] > 3330) continue;
      const q = F[Math.min(nF - 1, Math.floor(t * (nF - 1)) + 3)], dir = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const sc = 20 + 140 * t, off = R.gauss(0, sc), along = R.gauss(0, sc * 0.6);
      const x = p[0] - Math.sin(dir) * off + Math.cos(dir) * along + (t < 0.08 ? 40 : 0), y = p[1] + Math.cos(dir) * off + Math.sin(dir) * along;
      const len = 12 + t * 120 * R.r(0.6, 1.2), wid = len * R.r(0.22, 0.36);
      const col = t < 0.2 ? R.pick([C.black, C.black, C.white]) : R.pick([C.white, C.cream, C.black, C.white, C.cobalt, C.pink]);
      shards.push({ x, y, len, wid, rot: R.r(0, Math.PI), col });
    }
    for (const s of shards) {
      shape(lens(s.x, s.y, s.len, s.wid, s.rot), s.col, 0.3);
      if (s.len > 30) {
        const c = Math.cos(s.rot), sn = Math.sin(s.rot), q = s.col === C.black ? C.cream : C.black;
        shape([[s.x - c * s.len * 0.62 - sn * 0.9, s.y - sn * s.len * 0.62 + c * 0.9], [s.x + c * s.len * 0.45, s.y + sn * s.len * 0.45], [s.x - c * s.len * 0.62 + sn * 0.9, s.y - sn * s.len * 0.62 - c * 0.9]], q, 0);
      }
    }
    const bx = 2930, by = 1215;
    shape(lens(bx, by, 170, 46, -1.05), C.white, 0.3);
    shape(lens(bx, by, 170, 46, -1.05).slice(0, 25).concat([[bx, by]]), C.cream, 0);
    const c = Math.cos(-1.05), sn = Math.sin(-1.05);
    shape([[bx - c * 105 - sn * 1.6, by - sn * 105 + c * 1.6], [bx + c * 80, by + sn * 80], [bx - c * 105 + sn * 1.6, by - sn * 105 - c * 1.6]], C.black, 0);
  }

  // ---------- pencil ----------
  {
    ctx.strokeStyle = 'rgba(40,35,45,0.22)'; ctx.lineWidth = 0.5;
    for (const r of radii) { const [cx, cy] = ctr(r); const a0 = R.r(0, 6); ctx.beginPath(); ctx.arc(cx, cy, r + R.r(-1, 1), a0, a0 + R.r(0.4, 1.4)); ctx.stroke(); }
    for (let q = 0; q < 2; q++) { const a = axis + q * Math.PI / 2; ctx.beginPath(); ctx.moveTo(CX - Math.cos(a) * 470, CY - Math.sin(a) * 470); ctx.lineTo(CX + Math.cos(a) * 470, CY + Math.sin(a) * 470); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(X0, HZ); ctx.lineTo(X1, HZ); ctx.stroke();
  }

  // ---------- gouache surface ----------
  const G = new L.Rand(77);
  L.post(ctx, (d, i, x, y) => {
    const ux = x / S + X0, uy = y / S;
    const tone = 1 + 0.035 * L.fbm(N, ux / 60, uy / 60, 3) + 0.018 * N2(ux / 1.8, uy / 26) + 0.012 * N2(ux / 22, uy / 1.6);
    const g = (G.next() - 0.5) * 7;
    d[i] = d[i] * tone + g; d[i + 1] = d[i + 1] * tone + g; d[i + 2] = d[i + 2] * tone + g;
  });
  return Ly;
};
