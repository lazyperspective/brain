/* WORLD 12 — EARTH, AT NIGHT.
   From orbit, facing the dark side. Continents traced by their coasts and by the light of their towns and the roads
   between them; clouds silver in moonlight; a storm flickering; squid boats lit green far out at sea. Where night
   meets day the terminator burns, the twilight bands are ruled off like a chart, and the sunset catches the tops of
   the clouds. Under a gap in them there is a city at dusk. That is where we started. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#cfe0ff', EC = [760, 1760], ER = 1320, PC = [980, 720];
  const S = (() => { const v = [0.95, 0.1, -0.134], l = Math.hypot(...v); return v.map(x => x / l); })();
  const sm = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const nrm = (x, y) => { const dx = (x - EC[0]) / ER, dy = (y - EC[1]) / ER, d2 = dx * dx + dy * dy; return d2 >= 1 ? null : [dx, dy, Math.sqrt(1 - d2)]; };
  const nrmC = (x, y) => { const dx = (x - EC[0]) / ER, dy = (y - EC[1]) / ER, d2 = dx * dx + dy * dy; if (d2 < 1) return [dx, dy, Math.sqrt(1 - d2)]; const d = Math.sqrt(d2); return [dx / d, dy / d, 0]; };
  const sunN = n => n[0] * S[0] + n[1] * S[1] + n[2] * S[2], sunAt = (x, y) => sunN(nrmC(x, y));
  /* the ground's own coordinates (stereographic), so features crowd together towards the limb */
  const geo = n => [2 * n[0] / (1 + n[2]), 2 * n[1] / (1 + n[2])];
  const bump = (x, y, cx, cy, r) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r));
  const coastY = x => 818 + 26 * Math.sin(x / 130 + 0.6) + 14 * Math.sin(x / 47 + 2);
  const landF = (x, y) => { const n = nrm(x, y); if (!n) return -1; const [X, Y] = geo(n), v = L.fbm(X * 1.8 + 11.6, Y * 1.8 + 18.8, 8, 4242) * 1.3 - 0.68, w = bump(x, y, PC[0], PC[1] + 40, 260); return v * (1 - 0.55 * w) + 0.16 * Math.tanh((coastY(x) - y) / 40) * w; };
  const gapD = (x, y) => Math.hypot(x - PC[0], (y - PC[1]) / 0.64);
  const cloudF = (x, y) => { const n = nrm(x, y); if (!n) return 0; const [X, Y] = geo(n), w = L.fbm(X * 2.2 + 16, Y * 2.2 + 2, 3, 9) - 0.5, g = gapD(x, y); return L.fbm(X * 2.6 + w * 3, Y * 3.4 + w * 2, 7, 142) - 0.4 * sm(135, 95, g) + 0.1 * Math.exp(-(((g - 150) / 40) ** 2)); };
  /* what the light leaves of every colour, from deep night through the sunset into full day */
  const SH = [[-0.4, [0.09, 0.11, 0.22]], [-0.25, [0.12, 0.13, 0.27]], [-0.15, [0.19, 0.16, 0.34]], [-0.09, [0.34, 0.22, 0.42]], [-0.045, [0.58, 0.33, 0.42]], [-0.015, [0.84, 0.48, 0.40]], [0.01, [0.98, 0.64, 0.42]], [0.05, [1, 0.8, 0.6]], [0.12, [1, 0.92, 0.82]], [0.25, [1, 0.98, 0.95]], [0.4, [1, 1, 1]]];
  const shade = s => { if (s <= SH[0][0]) return SH[0][1]; for (let i = 1; i < SH.length; i++) if (s <= SH[i][0]) { const t = (s - SH[i - 1][0]) / (SH[i][0] - SH[i - 1][0]); return SH[i - 1][1].map((v, j) => lerp(v, SH[i][1][j], t)); } return SH[SH.length - 1][1]; };
  const dusk = s => Math.exp(-(((s + 0.01) / 0.036) ** 2)), DG = 0.42;
  /* a cloud's colour where it stands: its whiteness times the light, plus the sunset it catches */
  const cloudCol = (x, y, lum) => { const s = sunAt(x, y), m = shade(s), g = dusk(s) * 0.82 * DG; return '#' + [m[0] * 238 * lum + 255 * g, m[1] * 240 * lum + 130 * g, m[2] * 248 * lum + 60 * g].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); };

  /* a heap of cumulus: lumps lit on the sunward side, the tallest in the middle drawn last, its shadow thrown away from the sun */
  const heap = (k, R, cx, cy, R0, colOf, o = {}) => {
    const n = o.n ?? (4 + Math.floor(R0 / 2)), ls = [];
    for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.sqrt(R()) * R0 * 0.8, r = R0 * (0.3 + 0.45 * (1 - d / R0)) * (0.75 + 0.5 * R()); ls.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, r, d]); }
    ls.sort((p, q) => q[3] - p[3]);
    if (o.shadow !== false) k.fill(L.ell(cx - R0 * 1.35, cy + R0 * 0.3, R0 * 1.7, R0 * 0.55, 24), o.sc || '#0c1024', o.sa ?? 0.22);
    ls.forEach(([x, y, r]) => { const [lit, dark] = colOf(x, y), e = L.ell(x, y, r, r * 0.82, 28); k.lin(e, lit, 1, dark, 1, x + r * 0.85, y - r * 0.55, x - r * 0.75, y + r * 0.5); });
  };
  const ALB = () => ['#f6f7fb', '#8e96ac'];

  /* the space station, crossing in sunlight: truss, eight gold wings, white radiators */
  const iss = (k, ix, iy) => { k.glow(ix, iy, 34, '#ffffff', 0.12);
        [-30, -21, 21, 30].forEach(d => [-1, 1].forEach(sg => { const r = L.rect(ix + d - 3.3, iy + sg * 2.2, ix + d + 3.3, iy + sg * 18); k.fill(r, '#a8781e'); k.lin(r, '#ffe4a0', 0.7, '#a8781e', 0, ix + d + 3, iy, ix + d - 3, iy + sg * 18); for (let q = 1; q < 7; q++) k.line([ix + d - 3.3, iy + sg * (2.2 + q * 2.25)], [ix + d + 3.3, iy + sg * (2.2 + q * 2.25)], 0.2, '#4a2e08', 0.6); k.line([ix + d, iy + sg * 2.2], [ix + d, iy + sg * 18], 0.25, '#4a2e08', 0.5); }));
        k.line([ix - 36, iy], [ix + 36, iy], 1.5, '#e0e0e0', 0.95); [-11, 11].forEach(d => { const r = L.rect(ix + d - 2.2, iy - 12, ix + d + 2.2, iy - 2); k.fill(r, '#f4f4f4', 0.95); for (let q = 1; q < 4; q++) k.line([ix + d - 2.2, iy - 2 - q * 2.5], [ix + d + 2.2, iy - 2 - q * 2.5], 0.2, '#9a9a9a', 0.7); });
        k.fill(L.rect(ix - 4, iy - 2.6, ix + 4, iy + 2.6), '#ececec'); k.fill(L.rect(ix - 1.7, iy + 2.6, ix + 1.7, iy + 15), '#dadada'); k.fill(L.rect(ix - 1.7, iy - 14, ix + 1.7, iy - 2.6), '#cfcfcf'); k.fill(L.rect(ix - 7, iy + 8, ix - 1.7, iy + 10.6), '#d4d4d4'); k.dot(ix, iy + 16.5, 1.4, '#f0f0f0');
        k.text('THE SPACE STATION, 400 KM UP', ix + 44, iy - 16, 7, '#9ab0e0', { a: 0.65, fine: true }); };
  const LV = {};
  Z.world({
    name: 'Earth, at night', scale: '12,000 km', seed: 1212, ink: K,
    portal: { cx: PC[0], cy: PC[1], w: 1600 / 9, rot: 0, feather: 60 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.1 }), R = (a, b) => P.r(a, b), pick = a => a[Math.floor(P.R() * a.length)], gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += P.R(); return (s - 2) / 0.58; };
      const X0 = -60, Y0 = 420, X1 = 1660, Y1 = 1062;
      /* ================================ the sky above the limb ================================ */
      k.fill(L.rect(-40, -40, 1640, 1040), '#020308');
      const band = x => lerp(300, 10, (x + 40) / 1680) + Math.sin(x / 90) * 18;
      L.blend(P, 'lighter', () => k.img(L.raster(-40, -40, 1640, 720, 0.25, (x, y) => { const d = (y - band(x)) / 150, core = Math.exp(-d * d), dust = sm(0.46, 0.62, L.fbm(x / 70, y / 40, 4, 31)) * Math.exp(-(((y - band(x) - 10) / 46) ** 2)), v = core * (0.5 + 0.5 * L.fbm(x / 120, y / 60, 4, 5)) * (1 - 0.5 * dust), neb = 0.5 * sm(0.62, 0.8, L.fbm(x / 200 + 7, y / 150, 3, 8)) * core; return [lerp(40, 118, core) * v + 90 * neb, lerp(40, 100, core) * v + 30 * neb, lerp(80, 128, core) * v + 70 * neb, 255]; }), -40, -40, 1680, 760));
      { const st = []; for (let i = 0; i < 5200; i++) st.push([R(-20, 1620), R(-20, 760), 0.22 + Math.pow(P.R(), 3) * 0.8]); for (let i = 0; i < 4200; i++) { const x = R(-20, 1620); st.push([x, band(x) + gauss() * 70, 0.2 + Math.pow(P.R(), 4) * 0.6]); } k.dots(st, '#dfe6ff', 0.55); }
      for (let i = 0; i < 46; i++) { const x = R(0, 1600), y = R(0, 620), c = pick(['#ffffff', '#c8d8ff', '#ffe0b0', '#ffc8a0', '#b8c8ff']), s = R(0.7, 1.5); k.glow(x, y, s * 6, c, 0.3); k.dot(x, y, s * 0.55, '#ffffff', 0.95); if (s > 1.3) { k.line([x - s * 7, y], [x + s * 7, y], 0.35, c, 0.5); k.line([x, y - s * 7], [x, y + s * 7], 0.35, c, 0.5); } }
      // the Moon, a crescent lit from the same side as the Earth, its dark part faintly earthlit
      { const mx = 1420, my = 150, mr = 26, disc = L.ell(mx, my, mr, mr, 60); k.glow(mx, my, 95, '#f4f0e0', 0.12); k.fill(disc, '#1a1e2e'); k.rad(disc, mx - 6, my, mr * 1.1, '#34405c', 0.7, '#1a1e2e', 0);
        const lit = []; for (let i = 0; i <= 36; i++) { const t = -Math.PI / 2 + Math.PI * i / 36; lit.push([mx + mr * Math.cos(t), my + mr * Math.sin(t)]); } for (let i = 36; i >= 0; i--) { const t = -Math.PI / 2 + Math.PI * i / 36; lit.push([mx + mr * 0.22 * Math.cos(t), my + mr * Math.sin(t)]); }
        k.fill(lit, '#efe9d4'); k.lin(lit, '#ffffff', 0.55, '#b8b090', 0.25, mx + mr, my - mr * 0.6, mx, my + mr);
        [[12, -9, 5], [17, 5, 4.5], [9, 13, 3], [20, -3, 2.6], [14, 18, 2]].forEach(([dx, dy, r]) => k.fill(L.blob(mx + dx, my + dy, r, 10, 0.25, P.R), '#a8a088', 0.5));
        for (let i = 0; i < 16; i++) { const a = R(-1.35, 1.35), rr = R(0.3, 0.95) * mr, x = mx + Math.cos(a) * rr, y = my + Math.sin(a) * rr; if (x > mx + mr * 0.28) k.circle(x, y, R(0.5, 1.7), 0.35, '#7a7460', 0.6); }
        k.text('THE MOON, 384,000 KM', mx - 50, my + 52, 7, '#9ab0e0', { a: 0.6, fine: true }); }
      // (the space station and the train of satellites move: they are drawn by the live layer)

      /* ================================ the planet: ground, water, weather ================================ */
      k.fill(L.ell(EC[0], EC[1], ER, ER, 1440), '#173866');
      // the sea floor shows through the shallows; then the land, its deserts and its forests
      k.rings(L.regions(landF, X0, Y0, X1, Y1, 3, -0.04), '#2a6a86', 0.55);
      k.rings(L.regions(landF, X0, Y0, X1, Y1, 2, 0), '#4a6a3c');
      const G = (x, y) => { const g = geo(nrmC(x, y)); return [g[0] * 1050, g[1] * 1050]; };
      k.rings(L.regions((x, y) => { const g = G(x, y); return Math.min(landF(x, y) - 0.015, L.fbm(g[0] / 150 + 3, g[1] / 105, 4, 606) - 0.54); }, X0, Y0, X1, Y1, 3, 0), '#8e7c52', 0.85);
      k.rings(L.regions((x, y) => { const g = G(x, y); return Math.min(landF(x, y) - 0.02, L.fbm(g[0] / 60 + 9, g[1] / 44, 5, 707) - 0.555); }, X0, Y0, X1, Y1, 3, 0), '#2c4a2a', 0.8);
      // fields near the city, a patchwork only the sun side shows
      { const cols = ['#5a7a3c', '#66863f', '#7a8646', '#8a8650', '#58743a', '#94905a', '#6e8e46', '#a09a62']; L.gridVoronoi(1068, 600, 1300, 812, 3.4, 0.9, 1212, s => landF(s[0], s[1]) > 0.035 && gapD(s[0], s[1]) > 112 && L.noise(s[0] / 40, s[1] / 40, 17) > 0.35).forEach(c => k.fill(L.shrink(c.poly, 0.88), pick(cols), 0.4)); }
      // the river the city stands on, from the hills down to its delta
      const RIV = [[548, 516], [640, 566], [742, 612], [846, 660], [930, 694], [984, 724], [1006, 764], [998, 808], [1004, 832]];
      const meander = (ctrl, amp, sd) => { const out = []; for (let i = 0; i + 1 < ctrl.length; i++) { const a = ctrl[i], b = ctrl[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); for (let q = 0; q < 14; q++) { const t = q / 14, m = (L.noise(i * 3.1 + t * 3.2, sd, 55) - 0.5) * 2 * amp * Math.sin(Math.PI * t) + Math.sin((i + t) * 5.3 + sd) * amp * 0.4; out.push([lerp(a[0], b[0], t) - dy / l * m, lerp(a[1], b[1], t) + dx / l * m]); } } out.push(ctrl[ctrl.length - 1]); return out; };
      k.curve(meander(RIV, 7, 1), 1.5, '#b8d4ec', 0.9);
      [[[700, 520], [728, 560], [742, 612]], [[880, 600], [872, 640], [846, 660]], [[1080, 640], [1040, 700], [984, 724]], [[1120, 760], [1060, 770], [1006, 764]]].forEach((c, i) => k.curve(meander(c, 4, i + 3), 0.8, '#a8c8e4', 0.8));
      [[996, 820, 12, -0.4], [1008, 826, 10, 0.2], [1018, 822, 8, 0.7]].forEach(([x, y, l, a]) => k.line([x, y], [x + Math.cos(a + 1.3) * l, y + Math.sin(a + 1.3) * l], 0.6, '#b8d4ec', 0.8));
      // lakes
      [[760, 700, 9, 5], [1150, 700, 7, 4], [1210, 760, 5, 3.5], [640, 640, 11, 6]].forEach(([x, y, a, b]) => { if (landF(x, y) < 0.02) return; const e = L.blob(x, y, a, 16, 0.25, P.R, b / a); k.fill(e, '#2a5a8a'); k.lin(e, '#c8e0f4', 0.5, '#2a5a8a', 0, x + a, y - b, x, y + b); k.outline(e, 0.3, '#1a3a5a', 0.6); });
      // a mountain range on the sunward side: jagged crests, lit faces towards the sun, long shadows thrown away from it
      { const pk = []; for (let r = 0; r < 3; r++) for (let i = 0; i < 70; i++) { const t = i / 69, x = lerp(1172, 1470, t) + R(-6, 6) + r * 10, y = lerp(708, 586, t) + R(-6, 6) + Math.sin(t * 8 + r) * 9 + r * 9, h = (R(2.5, 9) + 5 * Math.pow(Math.sin(t * Math.PI), 2)) * (1 - r * 0.25) * (0.6 + 0.8 * L.noise(t * 9, r, 31)); if (landF(x, y) > 0.03) pk.push([x, y, h]); }
        pk.sort((a, b) => a[1] - b[1]);
        pk.forEach(([x, y, h]) => { const w = h * 1.5, top = [x + R(-0.2, 0.2) * h, y - h], sh = [x - w - h * 3.6, y + h * 0.3]; k.fill([[x - w * 0.5, y + 0.5], top, sh], '#101830', 0.3);
          const lf = [[x - w, y + 0.6], top, [x + h * 0.1, y + 0.8]], rt = [[x + h * 0.1, y + 0.8], top, [x + w * 0.9, y + 0.5]]; k.fill(lf, '#4c4038'); k.lin(rt, '#b89c7c', 1, '#806a58', 1, top[0], top[1], x + w, y); k.line(top, [x + h * 0.1, y + 0.8], 0.25, '#2c241e', 0.5);
          if (h > 8) k.fill([[top[0] - h * 0.15, top[1] + h * 0.24], top, [top[0] + h * 0.22, top[1] + h * 0.26], [top[0] + h * 0.05, top[1] + h * 0.34]], '#fbf4ec', 0.95); }); }
      // the clouds: their shadows first, cast away from the low sun, then the decks in layers
      const CL = [0.565, 0.59, 0.615, 0.64, 0.665, 0.69, 0.715, 0.745, 0.78], cr = L.regions(cloudF, X0, Y0, X1, Y1, 2.5, CL);
      cr.forEach((rg, i) => { L.blend(P, 'multiply', () => k.rings(rg.map(r => r.map(([x, y]) => [x - 5 - i * 1.6, y + 1.2])), '#141c38', 0.13)); k.rings(rg, '#eef2fa', 0.2 + i * 0.03); });
      // cumulus heaps along the edges of the decks, thickest around the clearing
      { const pf = []; for (let i = 0; i < 12000 && pf.length < 420; i++) { const a = R(0, TAU), d = 104 + Math.pow(P.R(), 1.6) * 320, x = PC[0] + Math.cos(a) * d, y = PC[1] + Math.sin(a) * d * 0.64, c = cloudF(x, y); if (c < 0.52 || c > 0.63) continue; pf.push([x, y, R(1.8, 5.5) * (1 - 0.4 * sm(150, 400, d))]); } pf.sort((a, b) => a[1] - b[1]).forEach(([x, y, r]) => heap(k, P.R, x, y, r, ALB)); }
      // a thunderstorm on the night side: a boiling cumulonimbus
      const STORM = [806, 606]; heap(k, P.R, STORM[0] - 26, STORM[1] + 4, 16, ALB); heap(k, P.R, STORM[0] + 24, STORM[1] - 2, 18, ALB); heap(k, P.R, STORM[0], STORM[1], 30, ALB, { n: 34 });

      /* ================================ the light ================================ */
      L.blend(P, 'multiply', () => k.img(L.raster(-40, 400, 1640, 1040, 0.5, (x, y) => { const h = Math.hypot(x - EC[0], y - EC[1]) - ER, m = shade(sunAt(x, y)), f = sm(0, 16, h); return [lerp(m[0], 1, f) * 255, lerp(m[1], 1, f) * 255, lerp(m[2], 1, f) * 255, 255]; }), -40, 400, 1680, 640));
      L.blend(P, 'lighter', () => k.img(L.raster(-40, 380, 1640, 1040, 0.5, (x, y) => {
        const d = Math.hypot(x - EC[0], y - EC[1]), h = d - ER, lx = (x - EC[0]) / d, ly = (y - EC[1]) / d, sl = lx * S[0] + ly * S[1], lit = sm(-0.16, 0.3, sl);
        let r = 0, g = 0, b = 0; const shell = h > 0 ? Math.exp(-h / 5) : Math.exp(h / 24);
        r += 46 * lit * shell; g += 116 * lit * shell; b += 250 * lit * shell;                                                              // the air, blue where the sun reaches it
        const ss = Math.exp(-(((sl + 0.03) / 0.075) ** 2)) * (h > 0 ? Math.exp(-h / 3.5) : Math.exp(h / 12)); r += 255 * ss; g += 104 * ss; b += 36 * ss; // a sunset all along the rim of the world
        const ag = (1 - lit) * 0.2 * Math.exp(-(((h - 8) / 2) ** 2)); r += 110 * ag; g += 255 * ag; b += 140 * ag;                          // airglow, ninety kilometres up
        if (h < 0) { const tg = dusk(sunAt(x, y)) * (0.1 + 0.72 * sm(0.56, 0.7, cloudF(x, y))) * DG; r += 255 * tg; g += 130 * tg; b += 60 * tg; } // the sunset on the cloud tops
        return [r, g, b, 255]; }), -40, 380, 1680, 660));

      /* ================================ the lights of the night side ================================ */
      const buckets = new Map(), put = (col, a, p) => { const key = col + '|' + Math.max(1, Math.round(a * 8)); (buckets.get(key) || buckets.set(key, []).get(key)).push(p); };
      const vis = (x, y) => sm(0.015, -0.05, sunAt(x, y)) * (1 - 0.85 * sm(0.58, 0.72, cloudF(x, y)));
      const towns = LV.towns = L.poisson([0, 440, 1600, 1000], 12, P.R, () => true, 30000).filter(p => landF(p[0], p[1]) > 0.02).map(p => ({ p, pop: Math.pow(L.noise(p[0] / 64, p[1] / 64, 99), 2.6) * 1.5 + 1.4 * bump(p[0], p[1], PC[0] - 10, PC[1], 70) + 0.8 * bump(p[0], p[1], 700, 640, 30) }));
      const roads = []; towns.forEach((t, i) => { towns.map((u, j) => [j, Math.hypot(u.p[0] - t.p[0], u.p[1] - t.p[1])]).filter(([j, d]) => j > i && d < 30).sort((a, b) => a[1] - b[1]).slice(0, 2).forEach(([j]) => { if (t.pop + towns[j].pop > 0.12) roads.push([t.p, towns[j].p, t.pop + towns[j].pop]); }); });
      roads.forEach(([a, b, w]) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(l / 2.1), bend = R(-3, 3); for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(a[0], b[0], t) - (b[1] - a[1]) / l * bend * Math.sin(Math.PI * t), y = lerp(a[1], b[1], t) + (b[0] - a[0]) / l * bend * Math.sin(Math.PI * t), v = vis(x, y); if (v > 0.04 && P.R() < 0.85) put('#ffae48', v * Math.min(0.8, 0.35 + w * 0.4), [x + R(-0.4, 0.4), y + R(-0.4, 0.4), R(0.28, 0.46)]); } });
      towns.forEach(({ p, pop }) => { const v = vis(p[0], p[1]), s = sunAt(p[0], p[1]);
        if (v > 0.04) { const n = Math.round(2 + pop * 34), sg = 0.7 + 2.4 * Math.sqrt(pop); for (let i = 0; i < n; i++) { const r = Math.abs(gauss()) * sg, a = R(0, TAU); put(r < sg * 0.5 && pop > 0.5 ? '#fff0c8' : '#ffb24c', v * 0.9, [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * 0.8, R(0.3, 0.7)]); } if (pop > 0.45) L.blend(P, 'lighter', () => k.glow(p[0], p[1], 4 + pop * 9, '#ff9a3a', 0.14 * v)); }
        else if (s > 0.02) { for (let i = 0; i < 2 + pop * 10; i++) k.dot(p[0] + gauss() * (0.6 + pop * 1.6), p[1] + gauss() * (0.5 + pop * 1.2), R(0.3, 0.6), '#8a8274', 0.4); } });
      // at sea: a shipping lane, and a squid fleet whose lamps are green
      const SQ = [690, 900];
      { for (let i = 0; i < 40; i++) { const t = i / 39, x = lerp(160, 900, t) + R(-6, 6), y = lerp(980, 870, t) + Math.sin(t * 5) * 14 + R(-4, 4); if (landF(x, y) < -0.02 && vis(x, y) > 0.1) put('#fff4e0', 0.7 * vis(x, y), [x, y, R(0.3, 0.5)]); }
        for (let i = 0; i < 70; i++) { const x = SQ[0] + gauss() * 22, y = SQ[1] + gauss() * 7 + (x - SQ[0]) * 0.18; if (landF(x, y) < -0.03) put('#b8ffd0', 0.9, [x, y, R(0.35, 0.65)]); } L.blend(P, 'lighter', () => k.glow(SQ[0], SQ[1], 40, '#60ffa0', 0.1)); }
      buckets.forEach((pts, key) => { const [col, a] = key.split('|'); L.blend(P, 'lighter', () => k.dots(pts, col, Math.min(1, +a / 8))); });
      // the storm's lightning: flashes inside the anvil, one bolt caught in the act
      L.blend(P, 'lighter', () => { [[-14, -3, 22, 0.4], [12, 4, 16, 0.32], [26, -6, 10, 0.28], [-30, 6, 9, 0.22]].forEach(([dx, dy, r, a]) => { k.glow(STORM[0] + dx, STORM[1] + dy, r, '#b8c8ff', a); k.glow(STORM[0] + dx, STORM[1] + dy, r * 0.3, '#ffffff', a); });
        const bolt = (x, y, ang, len, w, depth) => { let px = x, py = y; const pts = [[x, y]]; for (let i = 0; i < 7; i++) { ang += R(-0.5, 0.5); px += Math.cos(ang) * len / 7; py += Math.sin(ang) * len / 7; pts.push([px, py]); if (depth < 2 && P.R() < 0.3) bolt(px, py, ang + R(-0.9, 0.9), len * 0.45, w * 0.6, depth + 1); } k.ink(pts, w, '#e8f0ff', 0.9); };
        bolt(STORM[0] - 12, STORM[1] - 2, 1.35, 22, 0.55, 0); });
      // the aurora over the pole: folded curtains, green below, red above
      L.blend(P, 'lighter', () => { for (let c = 0; c < 2; c++) for (let i = 0; i < 720; i++) { const u = i / 720, t = lerp(-2.3, -1.66, u) + Math.sin(u * 30 + c * 2) * 0.006, b0 = 14 + c * 8 + 6 * Math.sin(u * 17 + c), h = (26 + 40 * L.noise(u * 26, c, 21)) * (0.5 + 0.5 * Math.sin(u * Math.PI)), base = [EC[0] + Math.cos(t) * (ER + b0), EC[1] + Math.sin(t) * (ER + b0)], top = [EC[0] + Math.cos(t) * (ER + b0 + h), EC[1] + Math.sin(t) * (ER + b0 + h)], wd = 1.1, a = 0.05 + 0.12 * L.noise(u * 60, c + 5, 22);
        k.lin([[base[0] - wd, base[1]], [top[0] - wd, top[1]], [top[0] + wd, top[1]], [base[0] + wd, base[1]]], '#50ff90', a, '#ff5a8a', 0, base[0], base[1], top[0], top[1]); } });
      // a crisp rim of air on the day side
      L.blend(P, 'lighter', () => { const arc = []; for (let t = -1.64; t < -0.6; t += 0.004) arc.push([EC[0] + Math.cos(t) * ER, EC[1] + Math.sin(t) * ER]); k.ink(arc, 1.1, '#a8d0ff', 0.6); });
      // the twilight, ruled off like a chart: sunset, and the sun six, twelve and eighteen degrees down
      { const u = (() => { const d = S[2], w = [-d * S[0], -d * S[1], 1 - d * S[2]], l = Math.hypot(...w); return w.map(q => q / l); })(), v = [S[1] * u[2] - S[2] * u[1], S[2] * u[0] - S[0] * u[2], S[0] * u[1] - S[1] * u[0]];
        const small = c => { const r = Math.sqrt(1 - c * c), pts = []; for (let i = 0; i <= 2880; i++) { const ph = i / 2880 * TAU, n = [0, 1, 2].map(j => c * S[j] + r * (Math.cos(ph) * u[j] + Math.sin(ph) * v[j])); if (n[2] > 0) { const x = EC[0] + n[0] * ER, y = EC[1] + n[1] * ER; if (y < 1060 && x > -40 && x < 1640) pts.push([x, y]); } } return pts.sort((a, b) => a[1] - b[1]); };
        [[0, 'SUNSET', '#ffc890'], [-Math.sin(6 * Math.PI / 180), 'CIVIL TWILIGHT', '#e0b8e8'], [-Math.sin(12 * Math.PI / 180), 'NAUTICAL', '#b8b0f0'], [-Math.sin(18 * Math.PI / 180), 'ASTRONOMICAL', '#98a8f0']].forEach(([c, name, col]) => { const pts = small(c); for (let i = 0; i + 6 < pts.length; i += 12) { if (gapD(pts[i][0], pts[i][1]) < 170 || pts[i][1] > 820) continue; k.line(pts[i], pts[i + 6], 0.6, col, 0.32 * (1 - sm(640, 820, pts[i][1]))); }
          const j = pts.findIndex(p => p[1] > 520); if (j > 0) { const p = pts[j], q = pts[Math.min(pts.length - 1, j + 10)], a = Math.atan2(q[1] - p[1], q[0] - p[0]); k.text(name, p[0] + 5, p[1] + 2, 7, col, { a: 0.75, rot: a, fine: true }); } }); }
      // the edge of this world is the dark between the galaxy's arms
      k.rad(L.rect(-40, -40, 1640, 1040), 800, 500, 960, '#18142b', 0, '#18142b', 1, 520);
      P.label('HOME', 96, 330, { size: 24, c: '#9ab0e0', a: 0.6 }); P.label('ONE CITY UNDER A GAP IN THE CLOUDS, AT DUSK', 100, 358, { size: 11, c: '#9ab0e0', a: 0.55 });
      k.text('SQUID BOATS, LIT GREEN', SQ[0] - 50, SQ[1] + 30, 6, '#a8f0c0', { a: 0.7, fine: true }); k.text('A STORM', STORM[0] - 20, STORM[1] - 34, 6, '#c8d0ff', { a: 0.7, fine: true });
      P.label('AIRGLOW', 120, 668, { size: 9, c: '#90e8a0', a: 0.55 }); P.label('AURORA', 300, 402, { size: 10, c: '#90f0b0', a: 0.6 });
    },
    over(P, cx) {
      // the clearing: cumulus heaped all round the way back in, lit from the sunset side, moonlit on the night side
      const k = L.kit(P, K, { rough: 0.1 }), R = (a, b) => P.r(a, b), hw = 800 / 9, hh = 500 / 9, rr = 16, col = (x, y) => [cloudCol(x, y, 1.04), cloudCol(x, y, 0.46)];
      const edge = []; [[hw - rr, -hh + rr, -Math.PI / 2], [hw - rr, hh - rr, 0], [-hw + rr, hh - rr, Math.PI / 2], [-hw + rr, -hh + rr, Math.PI]].forEach(([ox, oy, a0]) => { for (let i = 0; i <= 12; i++) { const a = a0 + i / 12 * Math.PI / 2; edge.push([PC[0] + ox + Math.cos(a) * rr, PC[1] + oy + Math.sin(a) * rr, Math.cos(a), Math.sin(a)]); } });
      // walk the rounded edge in even steps, with its outward normal
      const walk = step => { const out = []; let carry = 0; for (let i = 0; i < edge.length; i++) { const a = edge[i], b = edge[(i + 1) % edge.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = carry; while (t < l) { const u = t / l, nx = lerp(a[2], b[2], u), ny = lerp(a[3], b[3], u), nl = Math.hypot(nx, ny) || 1; out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u), nx / nl, ny / nl]); t += step; } carry = t - l; } return out; };
      const heaps = [];
      walk(8.5).forEach(([x, y, nx, ny]) => { const o = R(-6, 2); heaps.push([x + nx * o, y + ny * o, R(10, 15.5)]); if (P.R() < 0.75) { const o2 = R(12, 26); heaps.push([x + nx * o2 + R(-4, 4), y + ny * o2 * 0.8, R(6.5, 12)]); } if (P.R() < 0.3) { const o3 = R(28, 44); heaps.push([x + nx * o3, y + ny * o3 * 0.7, R(4, 7)]); } });
      heaps.sort((a, b) => a[1] - b[1]).forEach(([x, y, r]) => heap(k, P.R, x, y, r, col, { sa: 0.28, sc: '#06081a' }));
      // thin veils drifting across the edge of the clearing
      for (let i = 0; i < 12; i++) { const e = walk(8.5)[Math.floor(P.R() * 70)], x = e[0] - e[2] * R(4, 10), y = e[1] - e[3] * R(3, 7), v = L.ell(x, y, R(16, 30), R(3, 6), 20, Math.atan2(e[3], e[2]) + Math.PI / 2); k.fill(v, cloudCol(x, y, 0.98), 0.14); }
    },
    live: [(Q, t) => {
      const k = L.kit(Q, K, { rough: 0.05 }), H = L.hash, cyc = (per, ph = 0) => (L.cyc(t, per) + ph) % 1, osc = (per, ph = 0) => L.osc(t, per, ph);
      // the space station crossing, the satellites following each other in a line
      { const x = lerp(-180, 1780, cyc(57, 0.12)), y = 330 - Math.sin((x + 180) / 1960 * Math.PI) * 90; iss(k, x, y); }
      { const d = [226, -82], l = Math.hypot(...d), u = [d[0] / l, d[1] / l], s0 = lerp(-500, 2300, cyc(57, 0.6)); for (let i = 0; i < 28; i++) { const s = s0 - i * 8.6, x = 700 + u[0] * s, y = 375 + u[1] * s; if (y < 0 || x > 1640) continue; k.dot(x, y, 0.7, '#ffffff', 0.85); } }
      L.blend(Q, 'lighter', () => {
        // meteors burning up above the limb
        for (let i = 0; i < 4; i++) { const u = cyc(57 / 4, H(i, 1)); if (u > 0.04) continue; const f = u / 0.04, x0 = 200 + H(i, 2) * 1200, y0 = 120 + H(i, 3) * 200, x = x0 + f * 120, y = y0 + f * 50; for (let q = 0; q < 8; q++) k.line([x - q * 8, y - q * 3.3], [x - (q + 1) * 8, y - (q + 1) * 3.3], 1.4 - q * 0.15, '#fff4d0', (0.9 - q * 0.1) * Math.sin(f * Math.PI)); }
        // the night side's lights: towns breathing, a plane blinking across
        (LV.towns || []).forEach(({ p, pop }, i) => { if (pop < 0.35 || H(i, 4) > 0.5) return; const [x, y] = p; if (sunAt(x, y) > -0.02 || (Math.abs(x - PC[0]) < 100 && Math.abs(y - PC[1]) < 70)) return; const g = 0.5 + 0.5 * osc(1.5 + H(i, 5) * 3, H(i, 6)); k.glow(x, y, 3 + pop * 4, '#ffc860', 0.25 * g); });
        { const u = cyc(57 / 2, 0.2), x = lerp(80, 860, u), y = lerp(760, 560, u); if (cyc(1) < 0.12) k.glow(x, y, 4, '#ff4040', 0.9); else if (cyc(1, 0.5) < 0.08) k.glow(x, y, 4, '#ffffff', 0.9); k.dot(x, y, 0.6, '#ffffff', 0.6); }
        for (let i = 0; i < 6; i++) { const u = cyc(57, i / 6), x = lerp(160, 900, u), y = lerp(980, 870, u) + Math.sin(u * 5) * 14; k.dot(x, y, 0.5, '#fff4e0', 0.8); }
        // the aurora's curtains folding and refolding
        for (let c = 0; c < 2; c++) for (let i = 0; i < 160; i++) { const u2 = i / 160, wv = Math.sin(TAU * (u2 * 3 + cyc(9, c * 0.3))) * 0.5 + Math.sin(TAU * (u2 * 7 - cyc(5, c * 0.2))) * 0.3, tt = lerp(-2.3, -1.66, u2) + wv * 0.004, b0 = 18 + c * 8, h = (30 + 36 * (0.5 + 0.5 * wv)) * (0.5 + 0.5 * Math.sin(u2 * Math.PI)), base = [EC[0] + Math.cos(tt) * (ER + b0), EC[1] + Math.sin(tt) * (ER + b0)], top = [EC[0] + Math.cos(tt) * (ER + b0 + h), EC[1] + Math.sin(tt) * (ER + b0 + h)];
          k.lin([[base[0] - 1.6, base[1]], [top[0] - 1.6, top[1]], [top[0] + 1.6, top[1]], [base[0] + 1.6, base[1]]], '#60ffa0', 0.05 + 0.08 * (0.5 + 0.5 * wv), '#ff6aa0', 0, base[0], base[1], top[0], top[1]); }
      });
    }, (Q, t) => { // the storm keeps flashing
      const k = L.kit(Q, K), ph = Math.floor(t * 9), h = L.noise(ph * 1.37, 3.1, 5);
      if (h > 0.62) { const cells = [[-14, -3], [12, 4], [26, -6], [-2, 8]], c = cells[ph % 4]; L.blend(Q, 'lighter', () => { k.glow(806 + c[0], 606 + c[1], 16 + 20 * (h - 0.62), '#d8e4ff', 0.55); k.glow(806 + c[0], 606 + c[1], 5, '#ffffff', 0.7); }); } }]
  });
})();
