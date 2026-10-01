/* WORLD 11 — THE GALAXY.
   A spiral seen from above and a little aslant: an old yellow bulge, two arms of young blue stars strung with pink
   nebulae, dark dust along their inner edges, globular clusters swarming in the halo, other galaxies far behind.
   The light that is too far to resolve is painted as a glow; the stars near enough are drawn as points, and there
   are more of them the closer you look. Out in a spur between the arms, circled: you are here. Around it, small
   enough to miss, the famous neighbours. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#d8e0ff', C0 = [790, 500], TILT = 0.78, ROT = 0.35;
  const toW = (r, t) => { const x = Math.cos(t) * r, y = Math.sin(t) * r * TILT; return [C0[0] + x * Math.cos(ROT) - y * Math.sin(ROT), C0[1] + x * Math.sin(ROT) + y * Math.cos(ROT)]; };
  const toG = (x, y) => { const dx = x - C0[0], dy = y - C0[1], u = dx * Math.cos(ROT) + dy * Math.sin(ROT), v = (-dx * Math.sin(ROT) + dy * Math.cos(ROT)) / TILT; return [Math.hypot(u, v), Math.atan2(v, u)]; };
  const HERE = toW(372, 2.46);
  const sm = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  /* signed distance (in the plane of the disc) from a point to the arm r = 120·e^{0.36(θ − φ)} */
  const armD = (r, t, ph) => { if (r < 40) return 1e9; const ta = Math.log(r / 120) / 0.36 + ph; let d = ((t - ta) % TAU + TAU) % TAU; if (d > Math.PI) d -= TAU; return d * r; };
  const ARMS = [[0, 1, 0.2, 4.3], [Math.PI, 1, 0.2, 4.3], [Math.PI * 0.5, 0.32, 1.2, 4.1], [Math.PI * 1.5, 0.32, 1.2, 4.1], [-0.68, 0.1, 2.5, 3.6]]; // phase, strength, extent in θ
  const armAt = (r, t) => { let a = 0; for (const [ph, st, t0, t1] of ARMS) { const tr = Math.log(Math.max(r, 1) / 120) / 0.36; if (tr < t0 - 0.3 || tr > t1 + 0.3) continue; const d = armD(r, t, ph), w = 12 + r * 0.055; a += st * Math.exp(-(d * d) / (2 * w * w)) * sm(t0 - 0.3, t0 + 0.2, tr) * (1 - sm(t1 - 0.2, t1 + 0.3, tr)); } return a; };
  const dustAt = (r, t) => { let a = 0; for (const [ph, st, t0, t1] of ARMS.slice(0, 2)) { const tr = Math.log(Math.max(r, 1) / 120) / 0.36; if (tr < t0 || tr > t1 - 0.4) continue; const w = 12 + r * 0.055, d = armD(r, t, ph) + w * 1.05; a += Math.exp(-(d * d) / (2 * (w * 0.32) ** 2)) * sm(t0, t0 + 0.4, tr); } return Math.min(1, a); };

  Z.world({
    name: 'The galaxy', scale: '100,000 light years', seed: 1111, ink: K,
    portal: { cx: HERE[0], cy: HERE[1], w: 160, rot: -35, feather: 90 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.1 }), R = (a, b) => P.r(a, b), pick = a => a[Math.floor(P.R() * a.length)], gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += P.R(); return (s - 2) / 0.58; };
      const buckets = new Map(), put = (col, a, p) => { const key = col + '|' + a; (buckets.get(key) || buckets.set(key, []).get(key)).push(p); };
      // the inside of the nucleus this galaxy sits in: dark, warming to violet at its rim
      k.fill(L.rect(-40, -40, 1640, 1040), '#02030a'); k.rad(L.rect(-40, -40, 1640, 1040), 800, 500, 1333, '#02030a', 1, '#2a1030', 1);
      /* the light too far away to resolve: bulge, disc, arms, and the dust that eats it */
      L.blend(P, 'lighter', () => k.img(L.raster(-40, -40, 1640, 1040, 0.5, (x, y) => {
        const [r, t] = toG(x, y), bul = Math.exp(-r / 38) * 1.5 + Math.exp(-(r * r) / (2 * 105 * 105)) * 0.42, disc = Math.exp(-r / 220) * 0.3 * (1 - sm(560, 700, r)), arm = armAt(r, t) * sm(70, 160, r) * (1 - sm(560, 660, r)) * 0.55, mott = Math.pow(0.3 + 1.1 * L.fbm(x / 16, y / 16, 4, 41), 1.6);
        const dust = dustAt(r, t) * (0.55 + 0.45 * sm(0.42, 0.62, L.fbm(x / 9, y / 9, 3, 43))), lanes = 1 - 0.8 * dust;
        const R_ = (bul * 255 + disc * 120 + arm * 120 * mott) * lanes, G_ = (bul * 222 + disc * 132 + arm * 158 * mott) * lanes, B_ = (bul * 170 + disc * 210 + arm * 255 * mott) * lanes;
        const bub = 1 - 0.6 * Math.exp(-((x - HERE[0]) ** 2 + (y - HERE[1]) ** 2) / (2 * 85 * 85)); // the Sun sits in a bubble of thin hot gas
        return [R_ * bub, G_ * bub, B_ * bub, 255]; }), -40, -40, 1680, 1080));
      /* the stars near enough to see one by one: in clumps along the arms, spread thinner through the disc, and thicker around the Sun */
      const dustW = (x, y) => { const [r, t] = toG(x, y); return dustAt(r, t); }, star = (x, y, c, big = 0) => { if (P.R() < dustW(x, y) * 0.85) return; const dh = Math.hypot(x - HERE[0], y - HERE[1]); if (dh < 150 && P.R() < (1 - sm(88, 150, dh)) * 0.8) return; const s = Math.pow(P.R(), 3.4 - big), rr = 0.11 + s * 0.52; put(c, s > 0.6 ? 1 : s > 0.2 ? 0.85 : 0.62, [x, y, rr]); };
      const blue = ['#ffffff', '#e4ecff', '#c4d4ff', '#a8c0ff'], warm = ['#fff4e0', '#ffe6c0', '#ffd8a8'];
      [[0, 1], [Math.PI, 1], [Math.PI * 0.5, 0.3], [Math.PI * 1.5, 0.3], [-0.68, 0.35]].forEach(([ph, st]) => { const [, , t0, t1] = ARMS.find(a => a[0] === ph);
        for (let i = 0; i < 26000 * st; i++) { const t = R(t0, t1), r = 120 * Math.exp(0.36 * t), w = 12 + r * 0.055, p = toW(r + gauss() * w * 0.5, t + ph + gauss() * w / r); star(p[0], p[1], pick(blue)); }
        for (let c = 0; c < 420 * st; c++) { const t = R(t0 + 0.1, t1 - 0.1), r = 120 * Math.exp(0.36 * t), w = 12 + r * 0.055, cp = toW(r + gauss() * w * 0.45, t + ph + gauss() * w * 0.8 / r), sg = R(1.5, 6), n = Math.floor(R(15, 110)); for (let q = 0; q < n; q++) star(cp[0] + gauss() * sg, cp[1] + gauss() * sg * 0.8, pick(blue), q < 2 ? 1.5 : 0); } });
      for (let i = 0; i < 30000; i++) { const r = -220 * Math.log(1 - P.R() * 0.95), t = R(0, TAU), p = toW(r, t); star(p[0] + gauss() * 3, p[1] + gauss() * 3, P.R() < 0.6 ? pick(warm) : pick(blue)); }
      for (let i = 0; i < 14000; i++) { const x = HERE[0] + gauss() * 170, y = HERE[1] + gauss() * 170; star(x, y, P.R() < 0.5 ? pick(warm) : pick(blue)); }
      for (let i = 0; i < 2500; i++) put('#dfe6ff', 0.5, [R(-20, 1620), R(-20, 1020), R(0.12, 0.35)]);
      // the bulge resolved: a dense haze of old stars
      { for (let i = 0; i < 9000; i++) { const r = Math.abs(gauss()) * 60, t = R(0, TAU), p = toW(r, t); put(pick(['#ffe8c0', '#ffd8a0', '#fff4e0']), 0.6, [p[0], p[1], 0.12 + Math.pow(P.R(), 3) * 0.35]); } }
      buckets.forEach((pts, key) => { const [col, a] = key.split('|'); L.blend(P, 'lighter', () => k.dots(pts, col, +a)); });
      // star-forming nebulae, pink, strung along the arms, each with its knot of young blue stars
      [[0, 30], [Math.PI, 30], [Math.PI * 0.5, 8], [Math.PI * 1.5, 8], [-0.68, 7]].forEach(([ph, n]) => { for (let i = 0; i < n; i++) { const t = R(0.7, 3.8), r = 120 * Math.exp(0.36 * t) + gauss() * 10, p = toW(r, t + ph), s = R(2.5, 8);
        L.blend(P, 'lighter', () => { k.rad(L.ell(p[0], p[1], s * 2.4, s * 2, 24, R(0, 3)), p[0], p[1], s * 2.4, '#ff5a90', 0.5, '#ff5a90', 0); k.rad(L.ell(p[0], p[1], s, s * 0.8, 20), p[0], p[1], s, '#ffc0d8', 0.45, '#ff80b0', 0); });
        const cl = []; for (let q = 0; q < 16; q++) cl.push([p[0] + gauss() * s * 0.7, p[1] + gauss() * s * 0.6, R(0.12, 0.4)]); L.blend(P, 'lighter', () => k.dots(cl, '#d8e8ff', 0.9)); } });
      // globular clusters swarming in the halo, each a ball of stars that resolves as you come close
      for (let i = 0; i < 30; i++) { const t = R(0, TAU), r = R(230, 640), p = [C0[0] + Math.cos(t) * r, C0[1] + Math.sin(t) * r * 0.86], s = R(2, 4), g = []; for (let q = 0; q < 140; q++) { const d = Math.abs(gauss()) * s * 0.6, a = R(0, TAU); g.push([p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d, R(0.1, 0.3)]); } L.blend(P, 'lighter', () => { k.glow(p[0], p[1], s * 2.2, '#ffe0a8', 0.3); k.dots(g, '#ffe8c8', 0.8); }); }
      // other galaxies, far behind
      for (let i = 0; i < 16; i++) { const x = R(0, 1600), y = R(0, 1000), r = R(3, 12), a = R(0, Math.PI), q = R(0.25, 0.8); if (Math.hypot(x - C0[0], (y - C0[1]) / 0.8) < 640) continue; L.blend(P, 'lighter', () => { k.rad(L.ell(x, y, r, r * q, 20, a), x, y, r, pick(['#ffe0b0', '#c8d8ff', '#ffc8d8']), 0.45, '#000000', 0); k.dot(x, y, r * 0.15, '#fff4e0', 0.8); }); }
      // bright foreground stars with their spikes
      for (let i = 0; i < 22; i++) { const x = R(0, 1600), y = R(0, 1000), s = R(2, 6), col = pick(['#ffffff', '#c8d8ff', '#ffe0b0']); L.blend(P, 'lighter', () => { k.glow(x, y, s * 2.2, col, 0.5); k.line([x - s * 2.6, y], [x + s * 2.6, y], 0.3, col, 0.6); k.line([x, y - s * 2.6], [x, y + s * 2.6], 0.3, col, 0.6); }); k.dot(x, y, 0.6, '#ffffff'); }

      /* the neighbourhood of the Sun, small enough to miss: the famous objects, each drawn to be found up close */
      const at = (d, a) => [HERE[0] + Math.cos(a) * d, HERE[1] + Math.sin(a) * d], tag = (s, p, dx, dy, c = '#c8b8e8') => { k.line(p, [p[0] + dx * 0.8, p[1] + dy * 0.8], 0.18, c, 0.5); k.text(s, p[0] + dx, p[1] + dy, 2.4, c, { a: 0.85, fine: true }); };
      { // the Orion Nebula: a pink-and-teal glow round four hot stars
        const p = at(112, -2.2); L.blend(P, 'lighter', () => { k.rad(L.ell(p[0], p[1], 7, 5.5, 24, 0.4), p[0], p[1], 7, '#ff6aa0', 0.55, '#ff6aa0', 0); k.rad(L.ell(p[0] + 1, p[1] - 0.5, 3.5, 2.6, 20), p[0] + 1, p[1], 3.5, '#6affe0', 0.4, '#6affe0', 0); k.dots([[p[0], p[1], 0.2], [p[0] + 0.5, p[1] + 0.3, 0.18], [p[0] - 0.3, p[1] + 0.5, 0.16], [p[0] + 0.2, p[1] - 0.4, 0.15]], '#ffffff', 1); });
        L.blend(P, 'multiply', () => k.fill(L.blob(p[0] - 3, p[1] + 2, 1.6, 10, 0.4, P.R, 0.6), '#2a1830', 0.6)); tag('ORION NEBULA', p, 6, -9); }
      { // the Pillars of Creation: three dark fingers against a glowing wall
        const p = at(150, -0.9); L.blend(P, 'lighter', () => k.rad(L.ell(p[0], p[1], 8, 7, 24), p[0], p[1], 8, '#e8c060', 0.5, '#50c8b0', 0));
        [[-2.4, 3.2, 1.1], [0.2, 4.6, 1.3], [2.6, 2.6, 0.9]].forEach(([dx, h, w]) => { const b = [p[0] + dx, p[1] + 4], tp = [p[0] + dx + 0.6, p[1] + 4 - h]; k.fill([[b[0] - w, b[1]], [tp[0] - w * 0.6, tp[1] + 0.4], [tp[0], tp[1] - 0.2], [tp[0] + w * 0.5, tp[1] + 0.5], [b[0] + w, b[1]]], '#4a3020', 0.95); k.line([tp[0] - w * 0.4, tp[1]], [tp[0] + w * 0.4, tp[1]], 0.25, '#ffe0a0', 0.8); });
        tag('PILLARS OF CREATION', p, 8, 11, '#e8d0a0'); }
      { // the Crab: what is left of a star seen to explode in 1054
        const p = at(128, 0.45); L.blend(P, 'lighter', () => { k.rad(L.ell(p[0], p[1], 4.2, 3, 22, 0.5), p[0], p[1], 4.2, '#5a8aff', 0.5, '#5a8aff', 0); for (let i = 0; i < 26; i++) { const a = R(0, TAU), r0 = R(1.2, 2), r1 = r0 + R(1, 2.2); k.line([p[0] + Math.cos(a) * r0, p[1] + Math.sin(a) * r0 * 0.75], [p[0] + Math.cos(a + R(-0.2, 0.2)) * r1, p[1] + Math.sin(a) * r1 * 0.75], 0.2, pick(['#ff7040', '#ffb050', '#ff5060']), 0.8); } k.dot(p[0], p[1], 0.2, '#ffffff', 1); });
        tag('THE CRAB, A STAR THAT BLEW UP IN 1054', p, 6, 8, '#ffb890'); }
      { // the Pleiades: seven blue sisters in a veil
        const p = at(104, 2.3); L.blend(P, 'lighter', () => { k.rad(L.ell(p[0], p[1], 4.5, 3.6, 20), p[0], p[1], 4.5, '#6a9aff', 0.3, '#6a9aff', 0); [[0, 0], [1.4, -0.6], [2.2, 0.4], [-1.2, 0.8], [0.6, 1.5], [-0.4, -1.4], [1.8, 1.6]].forEach(([dx, dy], i) => { k.dot(p[0] + dx, p[1] + dy, i < 3 ? 0.32 : 0.22, '#e0ecff', 1); k.line([p[0] + dx - 0.9, p[1] + dy], [p[0] + dx + 0.9, p[1] + dy], 0.08, '#c8dcff', 0.7); }); });
        tag('PLEIADES', p, -14, 7, '#b8c8ff'); }
      { // Betelgeuse: a red giant, swollen and near its end
        const p = at(118, -1.5); L.blend(P, 'lighter', () => { k.glow(p[0], p[1], 5, '#ff7a3a', 0.6); k.dot(p[0], p[1], 0.9, '#ffb070', 1); k.dot(p[0] - 0.2, p[1] - 0.2, 0.4, '#ffe0b0', 0.9); }); tag('BETELGEUSE, ALMOST DONE', p, 5, -6, '#ffb080'); }
      { // Cygnus X-1: a black hole eating its blue companion
        const p = at(170, 1.25); L.blend(P, 'lighter', () => { k.glow(p[0] + 3.2, p[1] - 1, 3, '#8ab0ff', 0.6); k.dot(p[0] + 3.2, p[1] - 1, 0.55, '#e0ecff', 1); k.curve([[p[0] + 2.8, p[1] - 0.8], [p[0] + 1.6, p[1] - 0.2], [p[0] + 0.9, p[1] + 0.1]], 0.25, '#9ac0ff', 0.7); k.ink(L.ell(p[0], p[1], 1.6, 0.5, 30, -0.3), 0.35, '#ffa040', 0.9, true); k.ink(L.ell(p[0], p[1], 2.3, 0.75, 30, -0.3), 0.2, '#ff7030', 0.6, true); });
        k.dot(p[0], p[1], 0.5, '#000000', 1); tag('CYGNUS X-1, A BLACK HOLE', p, -10, 8, '#ffc090'); }
      { // Omega Centauri: ten million stars in a ball
        const p = at(210, 3.1), g = []; for (let q = 0; q < 700; q++) { const d = Math.abs(gauss()) * 2.2, a = R(0, TAU); g.push([p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d, R(0.05, 0.16)]); } L.blend(P, 'lighter', () => { k.glow(p[0], p[1], 6, '#ffe0a8', 0.35); k.dots(g, '#fff0d0', 0.9); }); tag('OMEGA CENTAURI', p, 6, 9, '#ffe0a8'); }
      { const p = at(100, 0.95); k.text('THE LOCAL BUBBLE, EMPTIED BY OLD SUPERNOVAE', p[0] + 4, p[1] + 5, 2.6, '#c8b8e8', { a: 0.75, fine: true }); }
      { // the Sun's own spur, named along its length
        const sp = []; for (let t = 2.7; t < 3.5; t += 0.02) sp.push(toW(120 * Math.exp(0.36 * t) + 0, t - 0.68)); for (let i = 0; i + 1 < sp.length; i += 3) k.line(sp[i], sp[i + 1], 0.25, '#c8b890', 0.35); }
      // the edge of this world is the inside of the nucleus it sits in
      k.rad(L.rect(-40, -40, 1640, 1040), 800, 500, 960, '#1e0c24', 0, '#1e0c24', 1, 640);
      // you are here
      { const [x, y] = HERE; k.circle(x, y, 108, 1, '#ffd070', 0.55); P.label('YOU ARE HERE', x - 250, y + 190, { size: 18, c: '#ffd070', a: 0.9 }); k.curve([[x - 160, y + 176], [x - 120, y + 140], [x - 80, y + 90]], 1.2, '#ffd070', 0.8); k.line([x - 80, y + 90], [x - 92, y + 96], 1.2, '#ffd070', 0.8); k.line([x - 80, y + 90], [x - 80, y + 104], 1.2, '#ffd070', 0.8); P.label('ORION SPUR, 26,000 LIGHT YEARS OUT', x - 250, y + 214, { size: 11, c: '#c8b890', a: 0.7 }); }
      P.label('A SPIRAL, LIKE OURS', 90, 110, { size: 20, c: '#9aa8e0', a: 0.6 }); P.label('200 BILLION SUNS', 94, 136, { size: 12, c: '#9aa8e0', a: 0.5 });
      { const b = toW(0, 0); k.text('A BLACK HOLE FOUR MILLION SUNS HEAVY SITS IN THE MIDDLE', b[0] - 62, b[1] + 64, 3.2, '#fff0d0', { a: 0.6, fine: true }); }
      k.line([1320, 930], [1500, 930], 1.2, '#9aa8e0', 0.6); P.label('20,000 LIGHT YEARS', 1330, 920, { size: 10, c: '#9aa8e0', a: 0.6 });
    }
    ,
    /* ================================ the galaxy, turning ================================ */
    live: [(Q, t) => {
      const k = L.kit(Q, K, { rough: 0.05 }), H = L.hash, cyc = (per, ph = 0) => (L.cyc(t, per) + ph) % 1, osc = (per, ph = 0) => L.osc(t, per, ph), at = (d, a) => [HERE[0] + Math.cos(a) * d, HERE[1] + Math.sin(a) * d];
      // stars on their orbits, the inner ones overtaking the outer
      { const B = new Map(), put = (c, p) => (B.get(c) || B.set(c, []).get(c)).push(p), cols = ['#ffffff', '#dfe8ff', '#b8ccff', '#ffe6c0'];
        for (let i = 0; i < 700; i++) { const t0 = 0.3 + H(i, 1) * 3.9, r = 120 * Math.exp(0.36 * t0) + (H(i, 2) - 0.5) * 40, th = t0 + (i % 2 ? Math.PI : 0) + (H(i, 3) - 0.5) * 0.25 + TAU * cyc(57 * Math.max(0.5, r / 260), H(i, 4)) * -1, p = toW(r, th); if (Math.hypot(p[0] - HERE[0], p[1] - HERE[1]) < 110) continue; put(cols[i % 4], [p[0], p[1], 0.3 + H(i, 5) * 0.6]); }
        B.forEach((pts, c) => L.blend(Q, 'lighter', () => k.dots(pts, c, 0.9))); }
      L.blend(Q, 'lighter', () => {
        // the core breathes
        k.glow(C0[0], C0[1], 120, '#fff0c8', 0.12 + 0.06 * osc(4.4));
        // stars twinkling in front of it all
        for (let i = 0; i < 26; i++) { const x = H(i, 6) * 1600, y = H(i, 7) * 1000, g = Math.max(0, osc(1.2 + H(i, 8) * 2, H(i, 9))); if (Math.hypot(x - HERE[0], y - HERE[1]) < 120 || g < 0.2) continue; const s = 2 + H(i, 10) * 3, c = ['#ffffff', '#c8d8ff', '#ffe0b0'][i % 3]; k.glow(x, y, s * 2 * g, c, 0.6 * g); k.line([x - s * 2.4 * g, y], [x + s * 2.4 * g, y], 0.3, c, 0.7 * g); k.line([x, y - s * 2.4 * g], [x, y + s * 2.4 * g], 0.3, c, 0.7 * g); }
        // a supernova, once a loop
        { const u = cyc(57, 0.35), p = toW(330, 2.9), f = u < 0.02 ? u / 0.02 : Math.exp(-(u - 0.02) * 30); if (f > 0.02) { k.glow(p[0], p[1], 50 * f + 6, '#ffffff', 0.9 * f); k.glow(p[0], p[1], 120 * f, '#aac8ff', 0.4 * f); k.line([p[0] - 60 * f, p[1]], [p[0] + 60 * f, p[1]], 0.6, '#ffffff', 0.8 * f); k.line([p[0], p[1] - 60 * f], [p[0], p[1] + 60 * f], 0.6, '#ffffff', 0.8 * f); } }
        // the Crab's pulsar sweeping its beams; the black hole's disc turning
        { const p = at(128, 0.45), a = TAU * cyc(0.4); [-1, 1].forEach(sd => k.line(p, [p[0] + Math.cos(a) * 7 * sd, p[1] + Math.sin(a) * 2.5 * sd], 0.35, '#c8e0ff', 0.9)); k.dot(p[0], p[1], 0.35, '#ffffff', 1); }
        { const p = at(170, 1.25), a = TAU * cyc(0.8), r = 0.3; for (let q = 0; q < 3; q++) { const b = a - q * 0.4, x = Math.cos(b) * 1.6, y = Math.sin(b) * 0.5; k.dot(p[0] + x * Math.cos(-r) - y * Math.sin(-r), p[1] + x * Math.sin(-r) + y * Math.cos(-r), 0.35 - q * 0.08, '#ffe0a0', 0.9 - q * 0.25); } }
      });
    }]
  });
})();
