/* WORLD 11 — THE GALAXY.
   A spiral seen face on: an old yellow bulge, arms of young blue stars strung with pink nebulae, dark dust lanes along
   their inner edges, globular clusters in a swarm around the disc, other galaxies far behind. Out in a minor arm,
   between the bright ones, a note: you are here. */
(function () {
  const Z = SketchZoom, L = Z.lib, TAU = L.TAU, lerp = L.lerp;
  const K = '#d8e0ff', C0 = [790, 500], TILT = 0.78, ROT = 0.35;
  const toW = (r, t) => { const x = Math.cos(t) * r, y = Math.sin(t) * r * TILT; return [C0[0] + x * Math.cos(ROT) - y * Math.sin(ROT), C0[1] + x * Math.sin(ROT) + y * Math.cos(ROT)]; };
  const HERE = toW(372, 2.46);

  Z.world({
    name: 'The galaxy', scale: '100,000 light years', seed: 1111, ink: K,
    portal: { cx: HERE[0], cy: HERE[1], w: 160, rot: -35, feather: 90 },
    build(P, cx) {
      const k = L.kit(P, K, { rough: 0.1 }), R = (a, b) => P.r(a, b), pick = a => a[Math.floor(P.R() * a.length)], gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += P.R(); return (s - 2) / 0.58; };
      // the inside of the nucleus this galaxy sits in: dark, warming to violet at its rim
      k.fill(L.rect(-40, -40, 1640, 1040), '#02030a'); k.rad(L.rect(-40, -40, 1640, 1040), 800, 500, 1333, '#02030a', 1, '#2a1030', 1);
      { const bg = []; for (let i = 0; i < 2600; i++) bg.push([R(-20, 1620), R(-20, 1020), R(0.3, 1)]); k.dots(bg, '#c8d0ff', 0.4); }
      for (let i = 0; i < 12; i++) { const x = R(0, 1600), y = R(0, 1000), r = R(4, 14), a = R(0, Math.PI); if (Math.hypot(x - C0[0], y - C0[1]) < 560) continue; L.blend(P, 'lighter', () => { k.rad(L.ell(x, y, r, r * R(0.3, 0.7), 16, a), x, y, r, pick(['#ffe0b0', '#c8d8ff', '#ffc8d8']), 0.5, '#000000', 0); }); }
      const add = (pts, col, a) => L.blend(P, 'lighter', () => k.dots(pts, col, a));
      // the disc's diffuse light and the bulge
      L.blend(P, 'lighter', () => { const disc = L.ell(C0[0], C0[1], 640, 640, 90); k.rad(disc, C0[0], C0[1], 640, '#5a68b0', 0.28, '#1a2040', 0); const bl = L.ell(C0[0], C0[1], 190, 190 * TILT, 60, ROT); k.rad(bl, C0[0], C0[1], 190, '#fff0c8', 0.95, '#ffb060', 0); k.rad(bl, C0[0], C0[1], 70, '#ffffff', 0.9, '#fff0c8', 0); });
      { const b = []; for (let i = 0; i < 16000; i++) { const r = Math.abs(gauss()) * 70, t = R(0, TAU); b.push([...toW(r, t), R(0.3, 0.9)]); } add(b, '#ffe0a8', 0.35); }
      // two arms and their spurs: logarithmic spirals
      const arm = (phase, n, spread, col, a, s1 = 1.0) => { const pts = []; for (let i = 0; i < n; i++) { const t = R(0.2, 4.3), r = 120 * Math.exp(0.36 * t), th = t * 1.0 * 1 + phase + gauss() * spread / r * 60, rr = r + gauss() * spread; pts.push([...toW(rr, th), R(0.4, s1)]); } add(pts, col, a); };
      [0, Math.PI].forEach(ph => { arm(ph, 22000, 26, '#a8c0ff', 0.4, 0.9); arm(ph, 8000, 12, '#f0f4ff', 0.5, 1.2); arm(ph + 0.35, 6000, 40, '#8aa0e8', 0.25, 0.8); });
      arm(Math.PI * 0.5, 5000, 30, '#9ab0f0', 0.2); arm(Math.PI * 1.5, 5000, 30, '#9ab0f0', 0.2);
      // dust lanes along the inner edges of the arms
      [0, Math.PI].forEach(ph => { for (let q = 0; q < 3; q++) { const lane = []; for (let t = 0.3; t < 3.5; t += 0.05) { const r = 120 * Math.exp(0.36 * t) - 18 - q * 6; lane.push(toW(r, t + ph - 0.08)); } L.blend(P, 'multiply', () => k.ink(lane, 6 - q, '#3a2a30', 0.5)); } });
      // star-forming nebulae, pink, along the arms
      [0, Math.PI].forEach(ph => { for (let i = 0; i < 26; i++) { const t = R(0.6, 3.5), r = 120 * Math.exp(0.36 * t) + gauss() * 14, p = toW(r, t + ph), s = R(3, 9); L.blend(P, 'lighter', () => { k.rad(L.ell(p[0], p[1], s * 2.2, s * 2.2, 16), p[0], p[1], s * 2.2, '#ff6a9a', 0.55, '#ff6a9a', 0); k.dot(p[0], p[1], s * 0.35, '#ffe0f0', 0.9); }); const cl = []; for (let q = 0; q < 12; q++) cl.push([p[0] + gauss() * s, p[1] + gauss() * s, R(0.5, 1.2)]); add(cl, '#d8e8ff', 0.8); } });
      // globular clusters swarming in the halo
      for (let i = 0; i < 26; i++) { const t = R(0, TAU), r = R(260, 620), p = [C0[0] + Math.cos(t) * r, C0[1] + Math.sin(t) * r * 0.9], s = []; for (let q = 0; q < 40; q++) s.push([p[0] + gauss() * 3, p[1] + gauss() * 3, R(0.3, 0.8)]); add(s, '#ffe8c0', 0.6); }
      // bright foreground stars with their spikes
      for (let i = 0; i < 22; i++) { const x = R(0, 1600), y = R(0, 1000), s = R(3, 9), col = pick(['#ffffff', '#c8d8ff', '#ffe0b0']); L.blend(P, 'lighter', () => { k.glow(x, y, s * 2.2, col, 0.6); k.line([x - s * 2.6, y], [x + s * 2.6, y], 0.5, col, 0.6); k.line([x, y - s * 2.6], [x, y + s * 2.6], 0.5, col, 0.6); }); k.dot(x, y, 0.9, '#ffffff'); }
      // the edge of this world is the inside of the nucleus it sits in
      k.rad(L.rect(-40, -40, 1640, 1040), 800, 500, 960, '#1e0c24', 0, '#1e0c24', 1, 640);
      // you are here
      { const [x, y] = HERE; k.circle(x, y, 108, 1, '#ffd070', 0.55); P.label('YOU ARE HERE', x - 250, y + 190, { size: 18, c: '#ffd070', a: 0.9 }); k.curve([[x - 160, y + 176], [x - 120, y + 140], [x - 80, y + 90]], 1.2, '#ffd070', 0.8); k.line([x - 80, y + 90], [x - 92, y + 96], 1.2, '#ffd070', 0.8); k.line([x - 80, y + 90], [x - 80, y + 104], 1.2, '#ffd070', 0.8); P.label('ORION SPUR, 26,000 LIGHT YEARS OUT', x - 250, y + 214, { size: 11, c: '#c8b890', a: 0.7 }); }
      P.label('A SPIRAL, LIKE OURS', 90, 110, { size: 20, c: '#9aa8e0', a: 0.6 }); P.label('200 BILLION SUNS', 94, 136, { size: 12, c: '#9aa8e0', a: 0.5 });
      k.line([1320, 930], [1500, 930], 1.2, '#9aa8e0', 0.6); P.label('20,000 LIGHT YEARS', 1330, 920, { size: 10, c: '#9aa8e0', a: 0.6 });
    }
  });
})();
