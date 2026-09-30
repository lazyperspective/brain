/* SHEET 16 — "The Well of Small Weathers": a dense automatic ink doodle.
   Vocabulary studied from pen-and-ink doodling: white forms carved from black ground, dotted inner borders,
   hanging droplet tendrils, beaded spires, puffy contour-hatched masses, ripples, lightning. Original composition. */
(window.SCENES = window.SCENES || []).push({
  name: 'Ink Garden', seed: 909, ink: '#0b0b0b', theme: 'pencil',
  build(P, n, t) {
    const S = Sketch, TAU = S.TAU, lerp = S.lerp, K = '#0b0b0b', Wh = '#ffffff', R = (a, b) => P.r(a, b);
    const X0 = 250, X1 = 1350, Y0 = 50, Y1 = 950, HZ = 470;           // the panel, and the horizon between sky and underworld
    const black = pts => P.wash(pts, '#050505', 1, { edge: 0, jit: 0, steps: 1 });
    const white = pts => P.occlude(pts, Wh);
    const line = (a, b, w = 1, c = K) => P.line(a[0], a[1], b[0], b[1], { w, c, passes: 1, over: 0, rough: 0.2 });
    const ol = (pts, w = 1.4, c = K) => P.path(pts.concat([pts[0]]), { w, c, a: 0.97, rough: 0.3, passes: 1 });
    const circ = (x, y, r, k = 14) => Array.from({ length: k }, (_, i) => [x + Math.cos(i * TAU / k) * r, y + Math.sin(i * TAU / k) * r]);
    const blob = (cx, cy, rx, ry, k = 10, j = 0.22) => P.sample(Array.from({ length: k }, (_, i) => { const a = i * TAU / k; return [cx + Math.cos(a) * rx * R(1 - j, 1 + j), cy + Math.sin(a) * ry * R(1 - j, 1 + j)]; }), true, 3);
    const offset = (pts, d) => { const n = pts.length; return pts.map((p, i) => { const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; return [p[0] + ty / l * d, p[1] - tx / l * d]; }); };
    const inward = pts => { let A = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p[0] * q[1] - q[0] * p[1]; } return A > 0 ? -1 : 1; };
    const dotRow = (pts, d, gap = 7, r = 1.2, c = K) => { let o = offset(pts, d); const mid = o[Math.floor(o.length / 3)]; if (!S.pip(pts, mid[0], mid[1])) o = offset(pts, -d); let acc = 0; const D = []; for (let i = 1; i < o.length; i++) { acc += Math.hypot(o[i][0] - o[i - 1][0], o[i][1] - o[i - 1][1]); if (acc > gap) { acc = 0; D.push([o[i][0], o[i][1], r]); } } P.dots(D, c, 0.95); };
    const puffShade = (pts, cx, cy, r) => { for (let i = 0; i < pts.length; i += 2) { const [x, y] = pts[i], a = Math.atan2(y - cy, x - cx), lit = Math.cos(a + 2.4); if (lit > -0.1) continue; const L = r * 0.22 * -lit; for (let k = 0; k < 3; k++) { const s = 2 + k * 3.2; P.curve([[x - Math.cos(a) * s, y - Math.sin(a) * s], [x - Math.cos(a) * (s + L * 0.5) + Math.sin(a) * 2, y - Math.sin(a) * (s + L * 0.5) - Math.cos(a) * 2], [x - Math.cos(a) * (s + L), y - Math.sin(a) * (s + L)]], { w: 0.55, c: K, rough: 0.1, passes: 1 }); } } P.stipple(pts, Math.round(r * r * 0.25), { a: 0.9, r: 0.7, c: K, fade: (x, y) => Math.max(0, ((x - cx) + (y - cy)) / (r * 1.4)) }); };

    /* ===== 1. the underworld: solid black ground ===== */
    black([[X0, HZ], [X1, HZ], [X1, Y1], [X0, Y1]]);
    // lightning cracks through the dark
    for (let k = 0; k < 7; k++) { let x = R(X0 + 30, X1 - 30), y = Y1 - 4; const pts = [[x, y]]; while (y > HZ + 60) { x += R(-18, 18); y -= R(10, 24); pts.push([x, y]); if (P.R() > 0.88) { let bx = x, by = y; const br = [[bx, by]]; for (let q = 0; q < 5; q++) { bx += R(-22, 22); by += R(4, 16); br.push([bx, by]); } P.pl(br, { w: 0.7, c: Wh, a: 0.9, rough: 0.2, over: 0, passes: 1 }); } } P.pl(pts, { w: 1.1, c: Wh, a: 0.95, rough: 0.2, over: 0, passes: 1 }); }

    /* ===== 3. the ledge at the horizon, with droplet tendrils hanging into the dark ===== */
    { const ledge = [[X0, HZ - 10], [X1, HZ - 10], [X1, HZ + 12], [X0, HZ + 12]]; white(ledge); ol(ledge, 1.8); dotRow(ledge, 5, 8, 1.2);
      for (let x = X0 + 30; x < X1 - 20; x += R(18, 34)) { const L = R(40, 170), sway = R(-10, 10), pts = [[x, HZ + 12], [x + sway * 0.5, HZ + 12 + L * 0.5], [x + sway, HZ + 12 + L]]; P.curve(pts, { w: 2.6, c: Wh, rough: 0.1, passes: 1 }); P.curve(pts.map(([a, b]) => [a + 1.4, b]), { w: 0.8, c: K, rough: 0.1, passes: 1 }); const tx = x + sway, ty = HZ + 12 + L, drop = [[tx, ty - 6], [tx + 5, ty + 2], [tx + 4.2, ty + 8], [tx, ty + 11], [tx - 4.2, ty + 8], [tx - 5, ty + 2]]; const dd = P.sample(drop, true, 2); white(dd); ol(dd, 1.2); P.arc(tx - 1.2, ty + 5, 2, 2.6, 3.4, 4.6, { w: 0.6, c: K, passes: 1 }); } }

    /* ===== 2. the dense organic mass: packed white forms carved out of the dark ===== */
    const used = [];
    const free = (x, y, r) => x - r > X0 + 6 && x + r < X1 - 6 && y - r > HZ + 16 && y + r < Y1 - 6 && used.every(([a, b, c]) => Math.hypot(x - a, y - b) > c + r + 3);
    const FORMS = {
      puff: (x, y, r) => { const pts = blob(x, y, r, r * R(0.75, 1), 12, 0.2); white(pts); puffShade(pts, x, y, r); ol(pts, 1.4); },
      ripple: (x, y, r) => { white(circ(x, y, r, 28)); for (let k = 1; k <= 7; k++) P.circle(x, y, r * k / 7, { w: k === 7 ? 1.5 : 0.8, c: K, passes: 1 }); P.dot(x, y, r * 0.08, { c: K }); },
      eye: (x, y, r) => { const pts = blob(x, y, r, r * 0.8, 12, 0.12); white(pts); ol(pts, 1.5); dotRow(pts, 4, 6, 1); P.circle(x, y, r * 0.42, { w: 1.2, c: K, passes: 1 }); for (let k = 0; k < 24; k++) { const a = k * TAU / 24; line([x + Math.cos(a) * r * 0.18, y + Math.sin(a) * r * 0.18], [x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4], 0.5); } black(circ(x, y, r * 0.16, 12)); P.dot(x - r * 0.06, y - r * 0.06, r * 0.05, { c: Wh, a: 1 }); },
      pod: (x, y, r) => { const pts = blob(x, y, r * 0.55, r, 12, 0.08); white(pts); ol(pts, 1.4); dotRow(pts, 4, 7, 1.1); const inn = blob(x, y, r * 0.22, r * 0.62, 10, 0.05); black(inn); P.dots(Array.from({ length: 6 }, (_, i) => [x, y - r * 0.45 + i * r * 0.18, 1.2]), Wh, 1); },
      cells: (x, y, r) => { const pts = blob(x, y, r, r * 0.85, 12, 0.16); white(pts); ol(pts, 1.4); for (let i = 0; i < 40; i++) { const a = R(0, TAU), d = Math.sqrt(R(0, 1)) * r * 0.7, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d, rr = R(2.5, r * 0.18); P.circle(cx, cy, rr, { w: 0.8, c: K, passes: 1 }); P.dot(cx, cy, rr * 0.35, { c: K }); } },
      comb: (x, y, r) => { const pts = blob(x, y, r * 0.5, r, 10, 0.1); white(pts); ol(pts, 1.4); for (let k = -6; k <= 6; k++) { const yy = y + k * r / 7.5, hw = r * 0.5 * Math.sqrt(Math.max(0, 1 - Math.pow(k / 7, 2))) * 0.8; line([x - hw, yy], [x + hw, yy], 0.7); P.dot(x - hw, yy, 1.1, { c: K }); P.dot(x + hw, yy, 1.1, { c: K }); } line([x, y - r * 0.9], [x, y + r * 0.9], 1); },
    };
    const kinds = ['puff', 'puff', 'puff', 'ripple', 'eye', 'pod', 'cells', 'comb', 'puff', 'cells'];
    [64, 48, 36, 27, 20, 15, 11, 8, 6].forEach(r0 => { for (let i = 0; i < 1600; i++) { const r = r0 * R(0.85, 1.15), x = R(X0, X1), y = R(HZ, Y1); if (!free(x, y, r)) continue; used.push([x, y, r]); FORMS[kinds[Math.floor(P.R() * kinds.length)]](x, y, r); } });
    // bead chains and wavy ribbons snaking through the gaps, drawn last so they weave over
    for (let k = 0; k < 14; k++) { let x = R(X0 + 20, X1 - 20), y = Y1 - 10, a = -Math.PI / 2 + R(-0.5, 0.5), pts = []; for (let i = 0; i < 60; i++) { a += R(-0.18, 0.18); x += Math.cos(a) * 7; y += Math.sin(a) * 7; if (y < HZ + 20 || x < X0 + 10 || x > X1 - 10) break; pts.push([x, y]); } if (pts.length < 8) continue;
      if (k % 2) pts.forEach(([px, py], i) => { if (i % 2) return; white(circ(px, py, 4.4, 10)); P.circle(px, py, 4.4, { w: 0.9, c: K, passes: 1 }); P.dot(px, py, 1.3, { c: K }); });
      else { const L = [], Rr = []; pts.forEach((p, i) => { const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], tx = q[0] - o[0], ty = q[1] - o[1], l = Math.hypot(tx, ty) || 1, w = 6 + 2 * Math.sin(i * 0.5); L.push([p[0] - ty / l * w, p[1] + tx / l * w]); Rr.push([p[0] + ty / l * w, p[1] - tx / l * w]); }); const poly = L.concat(Rr.slice().reverse()); white(poly); ol(poly, 1.2); P.path(pts, { w: 0.6, c: K, rough: 0.2, passes: 1 }); P.dots(pts.filter((_, i) => i % 2).map(([a2, b2]) => [a2, b2, 1.2]), K, 0.9); } }

    /* ===== 4. the sky: a domed shrine, beaded spires, a looping orbit, a cloud ===== */
    { const cx = 800, base = HZ - 10, w = 150, top = 118;
      // the orbit ring behind everything (long thin loop), drawn as a double line
      [0, 8].forEach(d => { const pts = []; for (let k = 0; k <= 60; k++) { const a = Math.PI + k * Math.PI / 60; pts.push([cx + Math.cos(a) * (410 - d), 190 + Math.sin(a) * (110 - d) + (k / 60) * 40]); } P.path(pts, { w: d ? 1 : 1.8, c: K, rough: 0.3, passes: 1 }); });
      // the shrine: tall capsule with dotted rim, arched window with a veiled figure, stippled shading
      const cap = []; cap.push([cx - w / 2, base]); for (let k = 0; k <= 20; k++) { const a = Math.PI + k * Math.PI / 20; cap.push([cx + Math.cos(a) * w / 2, top + w / 2 + Math.sin(a) * w / 2]); } cap.push([cx + w / 2, base]);
      white(cap); ol(cap, 2.2); dotRow(cap, 7, 8, 1.4); dotRow(cap, 16, 11, 1);
      P.stipple(cap, 1600, { a: 0.9, r: 0.7, c: K, fade: (x, y) => Math.max(0, (x - cx) / (w * 0.5)) * 0.9 });
      for (let x = cx + w * 0.18; x < cx + w / 2 - 4; x += 3) P.line(x, top + w / 2 - Math.sqrt(Math.max(0, Math.pow(w / 2, 2) - Math.pow(x - cx, 2))) + 8, x, base - 4, { w: 0.5, c: K, passes: 1, over: 0, rough: 0.2 });
      const win = []; win.push([cx - 28, base - 30]); for (let k = 0; k <= 16; k++) { const a = Math.PI + k * Math.PI / 16; win.push([cx + Math.cos(a) * 28, top + 90 + Math.sin(a) * 28]); } win.push([cx + 28, base - 30]); black(win); ol(win, 1.6);
      const fig = [[cx, top + 78], [cx + 8, top + 96], [cx + 12, top + 150], [cx + 18, base - 34], [cx - 18, base - 34], [cx - 12, top + 150], [cx - 8, top + 96]]; const fp = P.sample(fig, true, 3); white(fp); ol(fp, 1); for (let y = top + 110; y < base - 40; y += 7) P.curve([[cx - 10, y], [cx, y + 4], [cx + 10, y]], { w: 0.5, c: K, passes: 1, rough: 0.2 });
      { const dots = []; for (let k = 0; k <= 26; k++) { const a = Math.PI + k * Math.PI / 26; dots.push([cx + Math.cos(a) * (w / 2 - 8), top + w / 2 + Math.sin(a) * (w / 2 - 8), 1.6]); } for (let y = top + w / 2; y < base - 6; y += 9) { dots.push([cx - w / 2 + 8, y, 1.5]); dots.push([cx + w / 2 - 8, y, 1.5]); } P.dots(dots, K, 0.95); for (let k = 0; k <= 12; k++) { const a = Math.PI + k * Math.PI / 12, x = cx + Math.cos(a) * (w / 2 + 9), y = top + w / 2 + Math.sin(a) * (w / 2 + 9); white(circ(x, y, 6, 12)); P.circle(x, y, 6, { w: 1.1, passes: 1 }); P.dot(x, y, 1.8, { c: K }); } }
      // crown finial
      const fin = P.sample([[cx - 22, top + 6], [cx, top - 30], [cx + 22, top + 6], [cx, top + 14]], true, 3); white(fin); ol(fin, 1.4); P.circle(cx, top - 6, 7, { w: 1.1, c: K, passes: 1 }); P.dot(cx, top - 6, 2.2, { c: K }); P.line(cx, top - 30, cx, top - 52, { w: 1.2, passes: 1, over: 0 });
      // beaded spires either side, each different
      [[cx - 250, 250], [cx - 190, 200], [cx - 135, 160], [cx + 150, 170], [cx + 215, 230], [cx + 290, 150]].forEach(([sx, h], i) => { const y0 = base, y1 = base - h; P.line(sx, y0, sx, y1, { w: 1.4, passes: 1, over: 0, rough: 0.2 }); for (let y = y0 - 14; y > y1 + 14; y -= 18 + (i % 3) * 4) { const kind = (Math.floor(y / 18) + i) % 3; if (kind === 0) { white(circ(sx, y, 7, 14)); P.circle(sx, y, 7, { w: 1.1, passes: 1 }); P.dot(sx, y, 2.4, { c: K }); } else if (kind === 1) { const d = [[sx, y - 9], [sx + 6, y], [sx, y + 9], [sx - 6, y]]; white(d); P.poly(d, { w: 1.1, passes: 1, over: 0 }); } else { P.rect(sx - 4, y - 6, 8, 12, { w: 1, passes: 1, over: 0 }); P.line(sx - 4, y, sx + 4, y, { w: 0.6, passes: 1, over: 0 }); } } const tip = [[sx, y1 - 22], [sx + 7, y1], [sx, y1 + 4], [sx - 7, y1]]; white(tip); P.poly(tip, { w: 1.2, passes: 1, over: 0 }); P.dot(sx, y1 - 6, 1.6, { c: K }); });
      // a puffy cloud leaking out of the orbit's apex
      const cl = blob(cx + 120, 95, 70, 34, 14, 0.25); white(cl); puffShade(cl, cx + 120, 95, 60); ol(cl, 1.4);
      P.stipple([[cx + 40, 60], [cx + 230, 55], [cx + 240, 150], [cx + 50, 140]], 180, { a: 0.7, r: 0.8, c: K });
    }

    /* ===== 5. the horizon mound: bulbous growths heaped along the ledge, and hanging bells from the orbit ===== */
    { const used2 = [];
      for (let i = 0; i < 4000; i++) { const r = R(8, 44), x = R(X0 + 20, X1 - 20), edge = Math.min(x - X0, X1 - x), cap = Math.max(0, 300 - edge * 0.9), y = HZ - 12 - r * 0.7 - Math.pow(P.R(), 1.6) * cap; if (y - r < Y0 + 60) continue; const below = y + r > HZ - 14 || used2.some(([a, b, c]) => b > y && Math.hypot(x - a, y - b) < c + r + 2); if (!below) continue; if (Math.abs(x - 800) < 90 + r) continue; if (used2.some(([a, b, c]) => Math.hypot(x - a, y - b) < c + r - 4)) continue; if ([[550, 250], [610, 200], [665, 160], [950, 170], [1015, 230], [1090, 150]].some(([sx]) => Math.abs(x - sx) < r * 0.5)) continue; used2.push([x, y, r]); }
      used2.sort((a, b) => a[1] - b[1]).forEach(([x, y, r], i) => { const pts = blob(x, y, r, r * 0.8, 11, 0.18); white(pts); if (i % 4 === 0) { for (let k = 1; k < 5; k++) ol(blob(x, y, r * k / 5, r * 0.8 * k / 5, 10, 0.05), 0.6); } else puffShade(pts, x, y, r); ol(pts, 1.4); if (i % 3 === 0) dotRow(pts, 4, 7, 1); });
      // bells hanging from the orbit loop on thread
      for (let k = 0; k < 9; k++) { const a = Math.PI + (k + 1) * Math.PI / 10, cx = 800, ox = cx + Math.cos(a) * 410, oy = 190 + Math.sin(a) * 110 + ((k + 1) / 10) * 40; if (Math.abs(ox - cx) < 110) continue; const L = R(30, 80); P.line(ox, oy, ox, oy + L, { w: 0.7, passes: 1, over: 0 }); const b = P.sample([[ox - 7, oy + L + 10], [ox - 5, oy + L], [ox, oy + L - 3], [ox + 5, oy + L], [ox + 7, oy + L + 10]], true, 2); white(b); ol(b, 1.1); P.dot(ox, oy + L + 12, 1.6, { c: K }); }
      // birds / seeds drifting in the sky, stippled haze at the top
      for (let k = 0; k < 14; k++) { const x = R(X0 + 40, X1 - 40), y = R(80, 260); if (Math.abs(x - 800) < 120) continue; P.curve([[x - 6, y], [x - 2, y - 4], [x, y]], { w: 0.9, passes: 1, rough: 0.1 }); P.curve([[x, y], [x + 2, y - 4], [x + 6, y]], { w: 0.9, passes: 1, rough: 0.1 }); }
      P.stipple([[X0, Y0], [X1, Y0], [X1, Y0 + 70], [X0, Y0 + 40]], 900, { a: 0.8, r: 0.7, c: K, fade: (x, y) => 1 - (y - Y0) / 70 });
    }
    // panel border
    P.rect(X0, Y0, X1 - X0, Y1 - Y0, { w: 2, c: K, rough: 0.4, passes: 1, over: 0 });
    P.text('THE WELL OF SMALL WEATHERS', X1, Y1 + 20, { size: 10, align: 'right', a: 0.7 });
  }
});
