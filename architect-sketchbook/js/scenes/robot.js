/* SHEET 5 — Ancient mechanical robot (brown ink only, no colour) */
(window.SCENES = window.SCENES || []).push({
  name: 'Mechanical Robot', seed: 53, ink: '#372a20',
  build(P, n, t) {
    const S = Sketch, TAU = S.TAU, lerp = S.lerp, CX = 430, GY = 902;
    P.frame('AUTOMATON', 'BRASS MAN, SPRING DRIVEN', n, t, { scale: 'SCALE  1 : 4', note: 'iron-gall ink, brass plate' });
    const mx = pts => pts.map(([x, y]) => [2 * CX - x, y]);

    /* ---------------- helpers ---------------- */
    const gear = (cx, cy, r, z, rot = 0, o = {}) => {
      const st = TAU / z, pts = [];
      for (let i = 0; i < z; i++) { const a = rot + i * st; [[0, 0.84], [0.13, 1], [0.37, 1], [0.5, 0.84]].forEach(([f, k]) => pts.push([cx + Math.cos(a + st * f) * r * k, cy + Math.sin(a + st * f) * r * k])); }
      P.pl(pts, { closed: true, w: o.w ?? 1.2, rough: 0.35, over: 0.1, passes: 1 });
      P.circle(cx, cy, r * 0.62, { w: 0.8, passes: 1 }); P.circle(cx, cy, r * 0.2, { w: 1, passes: 1 }); P.dot(cx, cy, r * 0.05 + 0.6, {});
      const sp = o.spokes ?? 5;
      for (let i = 0; i < sp; i++) { const a = rot + i * TAU / sp + 0.4; P.line(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2, cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, { w: 0.9, passes: 1, over: 0, rough: 0.2 }); }
      if (o.shade) { const d = []; for (let i = 0; i < 24; i++) d.push([cx + Math.cos(i * TAU / 24) * r * 0.84, cy + Math.sin(i * TAU / 24) * r * 0.84]); P.hatch(d, { ang: -50, gap: o.gap ?? 2.6, a: 0.45, w: 0.45, fade: (x, y) => Math.max(0, ((x - cx) + (y - cy)) / r * 0.5 + 0.35), piece: 6 }); }
    };
    const tube = (a, b, w0, w1, o = {}) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      const p = (tt, s) => [a[0] + dx * tt + nx * s * lerp(w0, w1, tt), a[1] + dy * tt + ny * s * lerp(w0, w1, tt)];
      const poly = [p(0, -1), p(1, -1), p(1, 1), p(0, 1)];
      if (!o.noErase) P.erase(poly);
      P.line(...p(0, -1), ...p(1, -1), { w: 1.6, rough: 0.35 }); P.line(...p(0, 1), ...p(1, 1), { w: 1.6, rough: 0.35 });
      (o.bands || []).forEach(tt => { const m = p(tt, 0); P.curve([p(tt, -1), [m[0] + ux * 4, m[1] + uy * 4], p(tt, 1)], { w: 1.1, rough: 0.25 }); const m2 = p(tt + 0.03, 0); P.curve([p(tt + 0.03, -1), [m2[0] + ux * 3, m2[1] + uy * 3], p(tt + 0.03, 1)], { w: 0.5, a: 0.6, rough: 0.2, passes: 1 }); });
      const sgn = nx > 0 ? 1 : -1, ang = Math.atan2(dy, dx) * 180 / Math.PI;
      P.hatch(poly, { ang, gap: 2.3, a: 0.5, w: 0.45, fade: (x, y) => { const s = ((x - a[0]) * nx + (y - a[1]) * ny) * sgn / lerp(w0, w1, 0.5); return Math.max(0, Math.min(1, (s + 0.15) / 1.0)); }, piece: 14, over: 0.2 });
      const dots = []; (o.rivets || []).forEach(tt => { dots.push([...p(tt, -0.72), 1.1]); dots.push([...p(tt, 0.72), 1.1]); }); if (dots.length) P.dots(dots, null, 0.85);
      return poly;
    };
    const ball = (cx, cy, r, o = {}) => {
      P.erase(P.sample([[cx - r, cy], [cx, cy - r], [cx + r, cy], [cx, cy + r]], true, 3));
      P.circle(cx, cy, r, { w: 1.6 }); P.circle(cx, cy, r * 0.62, { w: 0.9, passes: 1 });
      P.line(cx - r * 0.62, cy, cx + r * 0.62, cy, { w: 0.7, passes: 1, over: 0, rough: 0.1 }); P.line(cx, cy - r * 0.62, cx, cy + r * 0.62, { w: 0.7, passes: 1, over: 0, rough: 0.1 });
      P.dot(cx, cy, 1.6, {});
      const d = []; for (let i = 0; i < 20; i++) d.push([cx + Math.cos(i * TAU / 20) * r, cy + Math.sin(i * TAU / 20) * r]);
      P.hatch(d, { ang: -55, gap: 2.4, a: 0.5, w: 0.45, fade: (x, y) => Math.max(0, ((x - cx) + (y - cy) * 0.6) / r * 0.6 + 0.3), piece: 6 });
      if (o.pin) P.line(cx - r - 6, cy, cx + r + 6, cy, { w: 1.4, passes: 1, over: 0, rough: 0.2 });
    };
    const coil = (a, b, turns, amp, o = {}) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, pts = [a];
      for (let i = 0; i < turns * 2; i++) { const tt = (i + 0.5) / (turns * 2), s = i % 2 ? -1 : 1; pts.push([a[0] + dx * tt + nx * amp * s, a[1] + dy * tt + ny * amp * s]); }
      pts.push(b); P.pl(pts, { w: o.w ?? 0.9, rough: 0.25, over: 0, passes: 1 });
    };
    const rivetRow = (a, b, k, o = {}) => { const d = []; for (let i = 0; i <= k; i++) d.push([lerp(a[0], b[0], i / k), lerp(a[1], b[1], i / k), o.r ?? 1.1]); P.dots(d, null, 0.85); };

    /* ---------------- ground ---------------- */
    P.line(90, GY, 690, GY, { w: 1.8, rough: 0.6 });
    for (let x = 96; x < 686; x += 7 + P.r(0, 6)) P.line(x, GY + 2, x - 8, GY + 10 + P.r(0, 5), { w: 0.6, a: 0.5, passes: 1, over: 0, rough: 0.4 });
    P.hatch(P.sample([[330, GY - 2], [430, GY - 6], [540, GY - 2], [430, GY + 4]], true, 5), { ang: -10, gap: 2.4, a: 0.35, w: 0.45, piece: 20 });
    P.dashed(CX, 66, CX, GY + 22, [26, 6, 4, 6], { w: 0.7, a: 0.45 });

    /* ---------------- legs & feet ---------------- */
    const leg = sg => {
      const X = x => sg > 0 ? 2 * CX - x : x;
      const hip = [X(394), 562], knee = [X(388), 722], ank = [X(388), 856];
      tube(hip, [knee[0], knee[1] - 20], 27, 22, { bands: [0.2, 0.55, 0.85], rivets: [0.1, 0.4, 0.7] });
      // knee: ball with a visible gear
      P.erase(P.sample([[knee[0] - 26, knee[1]], [knee[0], knee[1] - 26], [knee[0] + 26, knee[1]], [knee[0], knee[1] + 26]], true, 3));
      P.circle(knee[0], knee[1], 25, { w: 1.7 }); P.circle(knee[0], knee[1], 20, { w: 0.8, passes: 1 });
      gear(knee[0], knee[1], 14, 11, sg * 0.3, { w: 1, spokes: 4 });
      P.line(knee[0] - 30, knee[1], knee[0] + 30, knee[1], { w: 1.4, passes: 1, over: 0, rough: 0.2 }); P.dot(knee[0] - 30, knee[1], 2.6, {}); P.dot(knee[0] + 30, knee[1], 2.6, {});
      tube([knee[0], knee[1] + 22], [ank[0], ank[1] - 12], 20, 16, { bands: [0.25, 0.7], rivets: [0.15, 0.5, 0.85] });
      // piston rods on the shin
      const px = knee[0] + (sg > 0 ? 32 : -32);
      P.line(px, knee[1] + 12, px, ank[1] - 30, { w: 1.1, rough: 0.3 }); P.line(px + 4, knee[1] + 12, px + 4, ank[1] - 30, { w: 0.7, rough: 0.3, a: 0.7 }); P.rect(px - 3, knee[1] + 48, 10, 40, { w: 1, rough: 0.2 });
      P.line(px, knee[1] + 12, knee[0] + (sg > 0 ? 18 : -18), knee[1] + 6, { w: 0.9, passes: 1, over: 0 }); P.dot(px, knee[1] + 12, 2, {}); P.dot(px, ank[1] - 30, 2, {});
      // ankle & boot
      ball(ank[0], ank[1], 14, { pin: true });
      const foot = [[X(346), 878], [X(418), 878], [X(432), GY], [X(340), GY]];
      P.erase(foot); P.poly(foot, { w: 1.7, rough: 0.4 });
      P.curve([[X(350), 884], [X(388), 888], [X(424), 884]], { w: 0.8, rough: 0.3 }); P.line(X(342), GY - 12, X(430), GY - 12, { w: 0.8, rough: 0.3 });
      rivetRow([X(354), 892], [X(422), 892], 6); rivetRow([X(346), GY - 5], [X(430), GY - 5], 7, { r: 0.9 });
      P.hatch([[X(400), 878], [X(418), 878], [X(432), GY], [X(400), GY]].map(p => p), { ang: 65, gap: 2.2, a: 0.5, w: 0.45 });
    };
    leg(-1); leg(1);
    // pelvis
    { const pel = [[368, 500], [492, 500], [484, 566], [376, 566]];
      P.erase(pel); P.poly(pel, { w: 1.7, rough: 0.4 });
      P.curve([[372, 530], [430, 538], [488, 530]], { w: 0.9, rough: 0.3 }); rivetRow([378, 508], [482, 508], 12);
      for (let x = 378; x < 470; x += 12) { P.pl([[x, 526], [x, 514], [x + 8, 514], [x + 8, 522], [x + 4, 522], [x + 4, 518]], { w: 0.6, a: 0.75, over: 0, rough: 0.15 }); }
      P.rrect(414, 520, 32, 32, 6, { w: 1 }); gear(430, 536, 10, 8, 0.2, { w: 0.8, spokes: 3 });
      ball(394, 562, 22); ball(466, 562, 22);
      P.hatch(pel, { ang: 70, gap: 2.4, a: 0.4, w: 0.45, fade: x => Math.max(0, (x - 420) / 70), piece: 8 });
    }

    /* ---------------- arms ---------------- */
    // left arm (viewer's left), hanging
    const SL = [332, 264], EL = [292, 404], WL = [298, 520];
    tube(SL, [EL[0] + 2, EL[1] - 16], 24, 20, { bands: [0.25, 0.6, 0.85], rivets: [0.1, 0.42, 0.72] });
    ball(EL[0], EL[1], 21, { pin: true });
    tube([EL[0], EL[1] + 20], [WL[0], WL[1] - 6], 20, 15, { bands: [0.3, 0.75], rivets: [0.15, 0.55] });
    // piston along forearm
    P.line(EL[0] - 28, EL[1] + 6, WL[0] - 24, WL[1] - 20, { w: 1.1, rough: 0.3 }); P.rect(EL[0] - 33, EL[1] + 36, 10, 46, { w: 1, rough: 0.2 });
    // right arm — raised forward, offering a small gear
    const SR = [528, 264], ER = [574, 396], WR = [632, 462];
    tube(SR, [ER[0] - 2, ER[1] - 16], 24, 20, { bands: [0.25, 0.6, 0.85], rivets: [0.1, 0.42, 0.72] });
    ball(ER[0], ER[1], 21, { pin: true });
    tube([ER[0] + 10, ER[1] + 14], [WR[0] - 8, WR[1] - 8], 20, 15, { bands: [0.3, 0.75], rivets: [0.15, 0.55] });

    // hands: palm + 4 fingers of 3 jointed segments (+ thumb)
    const hand = (cx, cy, ang, sc, curl, o = {}) => {
      const ca = Math.cos(ang), sa = Math.sin(ang), T = (x, y) => [cx + (x * ca - y * sa) * sc, cy + (x * sa + y * ca) * sc];
      const palm = [T(-15, -2), T(15, -2), T(17, 26), T(-17, 26)];
      P.erase(palm); P.poly(palm, { w: o.w ?? 1.5, rough: 0.35 });
      P.line(...T(-15, 4), ...T(15, 4), { w: 0.8, passes: 1, over: 0, rough: 0.2 });
      const dd = []; [[-12, 8], [12, 8], [-13, 20], [13, 20], [0, 22]].forEach(([x, y]) => dd.push([...T(x, y), 0.9 + sc * 0.12])); P.dots(dd, null, 0.85);
      const fx = [-12, -4, 4, 12], fl = [[11, 9, 7], [13, 10, 8], [12, 10, 7.5], [10, 8, 6]];
      fx.forEach((x, i) => {
        let px = x, py = 26, a = 0; const w = 3.1;
        fl[i].forEach((len, k) => {
          const bend = curl * (0.4 + k * 0.5) * (i === 3 ? 1.1 : 1);
          const na = a + bend, ex = px + Math.sin(-na) * len, ey = py + Math.cos(na) * len;
          const ux = Math.sin(-na), uy = Math.cos(na), nx = uy, ny = -ux;
          const seg = [T(px + nx * w, py + ny * w), T(ex + nx * w * 0.92, ey + ny * w * 0.92), T(ex - nx * w * 0.92, ey - ny * w * 0.92), T(px - nx * w, py - ny * w)];
          P.erase(seg); P.poly(seg, { w: o.fw ?? 0.95, rough: 0.2, over: 0, passes: 1 });
          if (sc > 2) { const j = T(ex, ey); P.circle(j[0], j[1], w * sc * 0.55, { w: 0.7, passes: 1 }); P.dot(j[0], j[1], 0.9, {}); }
          else { const j = T(ex, ey); P.dot(j[0], j[1], 1, { a: 0.9 }); }
          px = ex; py = ey; a = na;
        });
      });
      // thumb
      { const b = T(-16, 12), m = T(-27, 22), e = T(-31, 34); P.pl([b, m, e], { w: 1.2, rough: 0.2, over: 0 }); const b2 = T(-13, 18), m2 = T(-23, 27), e2 = T(-27, 38); P.pl([b2, m2, e2], { w: 1, rough: 0.2, over: 0 }); P.line(...e, ...e2, { w: 0.9, passes: 1, over: 0 }); P.circle(...m, 1.4 * sc * 0.3 + 1, { w: 0.6, passes: 1 }); }
      P.hatch(palm, { ang: 70, gap: 2.4 / Math.max(1, sc * 0.6), a: 0.45, w: 0.45, fade: (x) => Math.max(0, (x - cx) / (18 * sc) + 0.3), piece: 8 });
      return T;
    };
    hand(WL[0], WL[1] + 6, 0.06, 1.55, 0.18);
    hand(WR[0] + 4, WR[1] + 2, -1.05, 1.5, -0.25);
    // gear offered in the right palm
    gear(662, 496, 16, 12, 0.3, { w: 1.2, shade: true, spokes: 4 });

    /* ---------------- torso ---------------- */
    { const tor = [[350, 238], [510, 238], [502, 330], [494, 420], [488, 502], [372, 502], [366, 420], [358, 330]];
      P.erase(tor);
      P.curve([[350, 238], [356, 300], [362, 360], [368, 430], [372, 502]], { w: 1.8, rough: 0.5 }); P.curve([[510, 238], [504, 300], [498, 360], [492, 430], [488, 502]], { w: 1.8, rough: 0.5 });
      P.line(350, 238, 510, 238, { w: 1.6, rough: 0.4 }); P.line(372, 502, 488, 502, { w: 1.6, rough: 0.4 });
      P.hatch(tor, { ang: 80, gap: 2.5, a: 0.45, w: 0.45, fade: x => Math.max(0, (x - 440) / 62), piece: 10 });
      // cutaway window with the movement inside
      const win = [[384, 262], [476, 262], [476, 396], [384, 396]];
      P.erase(win); P.rrect(384, 262, 92, 134, 10, { w: 1.6 }); P.rrect(388, 266, 84, 126, 8, { w: 0.6, a: 0.6, passes: 1 });
      rivetRow([392, 258], [468, 258], 8); rivetRow([392, 400], [468, 400], 8);
      for (let y = 274; y < 390; y += 20) { P.dot(380, y, 1.2, {}); P.dot(480, y, 1.2, {}); }
      gear(414, 304, 27, 14, 0.2, { w: 1.2, spokes: 5 }); gear(460, 334, 21, 11, 0.55, { w: 1.1, spokes: 4 }); gear(420, 366, 15, 9, 0.1, { w: 1, spokes: 3 }); gear(459, 290, 11, 8, 0.3, { w: 0.9, spokes: 3 });
      // mainspring barrel with spiral
      P.circle(446, 376, 13, { w: 1.1, passes: 1 }); { const sp = []; for (let a = 0; a < 3.5 * TAU; a += 0.35) sp.push([446 + Math.cos(a) * (2 + a * 0.55), 376 + Math.sin(a) * (2 + a * 0.55)]); P.path(sp, { w: 0.6, rough: 0.2, passes: 1 }); }
      P.hatch(win.map(p => p), { ang: 45, gap: 5, a: 0.18, w: 0.4, fade: () => 0.4, piece: 20 });
      // bands, bellows, central seam
      [412, 428].forEach(y => { P.curve([[368, y], [430, y + 7], [492, y]], { w: 1.1, rough: 0.35 }); rivetRow([372, y + 1], [488, y + 1], 14, { r: 0.9 }); });
      for (let i = 0; i < 4; i++) { const y = 444 + i * 14, ins = i * 2; P.curve([[372 + ins, y], [430, y + 9], [488 - ins, y]], { w: 0.9, rough: 0.3 }); P.curve([[372 + ins, y + 3], [430, y + 12], [488 - ins, y + 3]], { w: 0.4, a: 0.5, rough: 0.2, passes: 1 }); }
      P.line(430, 238, 430, 262, { w: 0.9, rough: 0.2 }); P.circle(430, 250, 5, { w: 0.9, passes: 1 });
      // collar / chest medallion
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P.line(430 + Math.cos(a) * 3, 270 + Math.sin(a) * 3 - 20, 430 + Math.cos(a) * 9, 270 + Math.sin(a) * 9 - 20, { w: 0.7, passes: 1, over: 0, rough: 0.1 }); }
      P.curve([[360, 244], [430, 258], [500, 244]], { w: 1, rough: 0.3 });
      // winding key on the flank
      P.line(492, 470, 548, 470, { w: 1.6, rough: 0.2 }); P.circle(492, 470, 5, { w: 1, passes: 1 });
      P.ellipse(560, 456, 12, 8, { w: 1.3, passes: 1 }); P.ellipse(560, 484, 12, 8, { w: 1.3, passes: 1 }); P.line(548, 458, 548, 482, { w: 1.4, passes: 1, over: 0 }); P.line(568, 458, 568, 482, { w: 0.9, passes: 1, over: 0 });
    }
    // pauldrons
    const pauld = (cx, cy, sg) => {
      const d = []; for (let i = 0; i < 30; i++) d.push([cx + Math.cos(i * TAU / 30) * 45, cy + Math.sin(i * TAU / 30) * 45]);
      P.erase(d); P.circle(cx, cy, 45, { w: 1.8 });
      [36, 27].forEach(r => P.arc(cx, cy, r, r, Math.PI * (sg > 0 ? 1.15 : 0.15) + 0.2, Math.PI * (sg > 0 ? 1.15 : 0.15) + Math.PI + 0.2, { w: 1.1, passes: 1 }));
      P.circle(cx, cy, 10, { w: 1.2, passes: 1 }); P.dot(cx, cy, 2.2, {});
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10; P.line(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, cx + Math.cos(a) * 26, cy + Math.sin(a) * 26, { w: 0.5, a: 0.55, passes: 1, over: 0, rough: 0.15 }); }
      const rv = []; for (let i = 0; i < 12; i++) rv.push([cx + Math.cos(i * TAU / 12 + 0.2) * 40.5, cy + Math.sin(i * TAU / 12 + 0.2) * 40.5, 1.25]); P.dots(rv, null, 0.85);
      P.hatch(d, { ang: -55, gap: 2.4, a: 0.5, w: 0.45, fade: (x, y) => Math.max(0, ((x - cx) * sg * 0.6 + (y - cy) * 0.5) / 45 + 0.2), piece: 7 });
    };
    pauld(SL[0], SL[1], -1); pauld(SR[0], SR[1], 1);
    // tendon cables & pulleys from torso to arms
    [[[386, 340], [352, 318]], [[474, 340], [508, 318]]].forEach(([a, b]) => { P.curve([a, [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5) + 10], b], { w: 0.8, rough: 0.3, a: 0.8 }); P.circle(b[0], b[1], 4, { w: 0.8, passes: 1 }); });
    coil([SL[0] - 30, SL[1] + 62], [EL[0] - 22, EL[1] - 20], 7, 4);
    coil([SR[0] + 30, SR[1] + 60], [ER[0] + 22, ER[1] - 20], 7, 4);

    /* ---------------- neck & head ---------------- */
    for (let i = 0; i < 4; i++) { const y = 200 + i * 8; P.erase(P.sample([[402, y - 5], [458, y - 5], [458, y + 5], [402, y + 5]], true, 3)); P.arc(430, y, 27 + i * 1.5, 6, 0, Math.PI, { w: 1.1, passes: 1 }); P.arc(430, y, 27 + i * 1.5, 6, Math.PI, TAU, { w: 0.5, a: 0.4, passes: 1 }); }
    P.line(403, 198, 401, 236, { w: 1.4, rough: 0.3 }); P.line(457, 198, 459, 236, { w: 1.4, rough: 0.3 });
    { const head = [[370, 142], [376, 110], [402, 94], [430, 90], [458, 94], [484, 110], [490, 142], [488, 178], [470, 194], [430, 198], [390, 194], [372, 178]];
      P.erase(P.sample(head, true, 6)); P.curve(head, { closed: true, w: 1.9, rough: 0.5, passes: 2 });
      // crest gear
      gear(430, 82, 13, 10, 0.2, { w: 1.1, spokes: 3 }); P.line(422, 92, 438, 92, { w: 1, passes: 1, over: 0 });
      // visor & the two lens eyes
      P.rrect(384, 120, 92, 28, 12, { w: 1.5 });
      [[408, 134], [452, 134]].forEach(([x, y], i) => { P.circle(x, y, 10.5, { w: 1.3 }); P.circle(x, y, 7, { w: 0.9, passes: 1 }); P.circle(x, y, 3.2, { w: 1, passes: 1 }); P.dot(x + (i ? -1 : 1), y - 1, 1.1, {}); P.line(x - 14, y, x - 10.5, y, { w: 0.6, passes: 1, over: 0 }); P.line(x + 10.5, y, x + 14, y, { w: 0.6, passes: 1, over: 0 }); P.arc(x, y - 1, 12.5, 9, Math.PI * 1.1, Math.PI * 1.9, { w: 0.9, passes: 1 }); });
      P.line(430, 122, 430, 146, { w: 0.9, passes: 1, over: 0 });
      // mouth grille
      P.rrect(404, 162, 52, 22, 5, { w: 1.3 }); for (let x = 410; x < 454; x += 5.5) P.line(x, 165, x, 181, { w: 0.7, a: 0.85, passes: 1, over: 0, rough: 0.15 });
      // ears / speaking trumpets
      [366, 494].forEach((x, i) => { P.erase(P.sample([[x - 14, 150], [x, 136], [x + 14, 150], [x, 164]], true, 3)); P.circle(x, 150, 13, { w: 1.4 }); P.circle(x, 150, 8, { w: 0.8, passes: 1 }); P.dot(x, 150, 2, {}); for (let a = 0; a < 6; a++) P.line(x + Math.cos(a * 1.047) * 3, 150 + Math.sin(a * 1.047) * 3, x + Math.cos(a * 1.047) * 8, 150 + Math.sin(a * 1.047) * 8, { w: 0.5, passes: 1, over: 0 }); });
      // seams, rivets, brow
      P.curve([[374, 108], [430, 102], [486, 108]], { w: 0.9, rough: 0.3 }); P.curve([[372, 152], [378, 176], [392, 190]], { w: 0.6, a: 0.6, rough: 0.3 }); P.curve([[488, 152], [482, 176], [468, 190]], { w: 0.6, a: 0.6, rough: 0.3 });
      rivetRow([380, 114], [480, 114], 10);
      P.hatch(P.sample(head, true, 6), { ang: 80, gap: 2.4, a: 0.5, w: 0.45, fade: x => Math.max(0, (x - 432) / 52), piece: 8 });
    }

    /* ---------------- dimensions & notes on the figure ---------------- */
    P.dim(240, 82, 240, GY, '7 FT 6 IN', 74, { size: 17 });
    [[210, 'HEAD'], [262, 'SHOULDERS'], [502, 'WAIST'], [720, 'KNEE'], [860, 'ANKLE']].forEach(([y, l]) => { P.dashed(150, y, 300, y, [6, 4], { w: 0.5, a: 0.35 }); P.text(l, 148, y - 4, { size: 12, a: 0.6, align: 'right', font: S.HAND }); });
    P.note('LENS EYES - GROUND CRYSTAL', 84, 96, 396, 124, { size: 16 });
    P.note('BRASS GRILLE (SPEAKS)', 572, 168, 478, 172, { size: 16 });
    P.note('CREST GEAR = CLOCK', 520, 68, 442, 78, { size: 16 });
    P.note('MOVEMENT', 572, 300, 478, 312, { size: 17 });
    P.note('WINDING KEY', 588, 528, 566, 486, { size: 16 });
    P.note('PISTON + COIL SPRING', 84, 360, 262, 410, { size: 16 });
    P.note('CABLES + PULLEYS', 584, 220, 510, 318, { size: 16 });
    P.note('KNEE GEAR', 590, 748, 416, 722, { size: 16 });
    P.note('BELLOWS WAIST', 520, 616, 488, 462, { size: 16 });
    P.note('STEEL PINS', 84, 660, 356, 722, { size: 16 });
    P.text('7 X 8 IN. BRASS PLATE, RIVETED', 90, 936, { size: 15, a: 0.85 });
    P.text('WALKS 20 PACES, BOWS, WAVES', 90, 958 - 2, { size: 15, a: 0.85 });

    /* ---------------- DETAIL A : the chest movement, drawn large ---------------- */
    P.text('DETAIL A', 700, 84, { size: 20, font: S.HAND }); P.text('CHEST MOVEMENT - GOING TRAIN', 790, 84, { size: 16 });
    { const g1 = [770, 222, 64, 20], g2 = [770 + 99 * Math.cos(-0.52), 222 + 99 * Math.sin(-0.52), 44, 14];
      gear(g1[0], g1[1], g1[2], g1[3], 0.15, { w: 1.5, spokes: 6, shade: true, gap: 3 });
      gear(g2[0], g2[1], g2[2], g2[3], 0.2, { w: 1.4, spokes: 5, shade: true, gap: 2.8 });
      const g3c = [g2[0] + 67 * Math.cos(0.15), g2[1] + 67 * Math.sin(0.15)]; gear(g3c[0], g3c[1], 30, 10, 0.5, { w: 1.3, spokes: 4, shade: true, gap: 2.6 });
      const g4c = [770 + 96 * Math.cos(0.87), 222 + 96 * Math.sin(0.87)]; gear(g4c[0], g4c[1], 40, 13, 0.3, { w: 1.4, spokes: 5, shade: true, gap: 2.8 });
      const g5c = [g4c[0] + 61, g4c[1] + 4]; gear(g5c[0], g5c[1], 26, 9, 0.1, { w: 1.2, spokes: 4, shade: true, gap: 2.6 });
      // big barrel spring with ratchet
      const bx = 1040, by = 250, bR = 74;
      P.circle(bx, by, bR, { w: 1.8 }); P.circle(bx, by, bR - 8, { w: 0.8, passes: 1 });
      const sp = []; for (let a = 0; a < 5.2 * TAU; a += 0.22) sp.push([bx + Math.cos(a) * (14 + a * 1.9), by + Math.sin(a) * (14 + a * 1.9)]); P.path(sp, { w: 0.9, rough: 0.3, passes: 1 });
      P.circle(bx, by, 14, { w: 1.4, passes: 1 }); P.dot(bx, by, 2.5, {});
      // ratchet wheel & pawl
      const rk = [bx + 120, by - 20]; const rp = []; for (let i = 0; i < 16; i++) { const a = i * TAU / 16; rp.push([rk[0] + Math.cos(a) * 34, rk[1] + Math.sin(a) * 34]); rp.push([rk[0] + Math.cos(a + 0.28) * 44, rk[1] + Math.sin(a + 0.28) * 44]); } P.pl(rp, { closed: true, w: 1.2, rough: 0.3, passes: 1 }); P.circle(rk[0], rk[1], 22, { w: 0.8, passes: 1 }); P.dot(rk[0], rk[1], 2.2, {});
      P.pl([[rk[0] - 6, rk[1] - 62], [rk[0] + 6, rk[1] - 58], [rk[0] + 16, rk[1] - 40], [rk[0] + 4, rk[1] - 44]], { w: 1.1, closed: true, rough: 0.2 }); P.circle(rk[0] - 8, rk[1] - 64, 4, { w: 0.9, passes: 1 });
      coil([rk[0] - 8, rk[1] - 68], [rk[0] + 26, rk[1] - 76], 5, 3);
      // meshing links & centre lines
      P.dashed(g1[0], g1[1], g2[0], g2[1], [10, 4, 2, 4], { w: 0.5, a: 0.5 });
      P.dashed(g3c[0], g3c[1], bx - bR, by - 10, [8, 5], { w: 0.7, a: 0.6 });
      P.dashed(g5c[0], g5c[1], bx - bR, by + 30, [8, 5], { w: 0.7, a: 0.6 });
      P.dim(g1[0], g1[1] - 76, g2[0], g2[1] - 56, '', -14);
      P.text('20 : 14 : 10', 810, 120, { size: 14, a: 0.85 });
      P.note('MAIN GEAR  20 TEETH', 692, 306, 730, 262, { size: 15 });
      P.note('BARREL - MAINSPRING, 5 TURNS', 900, 158, 1000, 200, { size: 15 });
      P.note('RATCHET + PAWL', 1090, 130, 1150, 190, { size: 15, align: 'left' });
      P.text('TRAIN 1 : 9  -  LASTS 20 MIN', 700, 324, { size: 15, a: 0.85 });
      // Leonardo-style mirror writing
      P.text('SPRING TURNS THE BARREL, THE BARREL DRIVES ALL', 1140, 330, { size: 15, mirror: true, a: 0.8, align: 'right' });
    }
    P.line(690, 344, 1140, 344, { w: 0.7, a: 0.5, rough: 0.6, passes: 1 });

    /* ---------------- DETAIL B : the hand, drawn large ---------------- */
    P.text('DETAIL B', 700, 386, { size: 20, font: S.HAND }); P.text('THE HAND', 790, 386, { size: 16 });
    { const T = hand(796, 480, 0, 3.9, 0.22, { w: 2, fw: 1.3 });
      // tendon rods inside the palm converging on a plate
      const plate = [T(-10, 2), T(10, 2), T(10, 8), T(-10, 8)]; P.poly(plate, { w: 1, rough: 0.2 });
      [-12, -4, 4, 12].forEach((x, i) => { const a = T(x, 8), b = T(x * 0.4, -14); P.line(a[0], a[1], b[0], b[1], { w: 0.7, a: 0.85, passes: 1, over: 0, rough: 0.2 }); P.circle(...a, 3, { w: 0.8, passes: 1 }); });
      const w1 = T(0, -14); coil(T(-6, -14), T(-6, -30), 6, 3.5); coil(T(6, -14), T(6, -30), 6, 3.5); P.circle(w1[0], w1[1], 5, { w: 1, passes: 1 });
      P.note('FINGER JOINTS - PINNED', 926, 606, 862, 566, { size: 15 });
      P.note('TENDON RODS', 692, 548, 752, 506, { size: 15 });
      P.note('COIL RETURN SPRINGS', 700, 424, 772, 424, { size: 15 });
      P.text('ONE CRANK MOVES ALL FOUR:', 700, 846 - 4, { size: 14, a: 0.85 });
      P.text('FIST  <->  OPEN PALM', 700, 864 - 4, { size: 14, a: 0.85 });
    }

    /* ---------------- DETAIL C : head, sectioned, side view ---------------- */
    P.text('DETAIL C', 990, 386, { size: 20, font: S.HAND }); P.text('HEAD, SECTION', 1076, 386, { size: 15 });
    { const h = [[992, 440], [1004, 410], [1040, 394], [1084, 400], [1116, 430], [1124, 480], [1108, 526], [1064, 548], [1018, 538], [996, 500]];
      P.curve(h, { closed: true, w: 1.7, rough: 0.5 });
      // lens tube
      P.rrect(1064, 432, 56, 24, 8, { w: 1.3 }); P.ellipse(1120, 444, 5, 12, { w: 1, passes: 1 }); P.ellipse(1064, 444, 4, 10, { w: 0.9, passes: 1 }); P.line(1074, 436, 1074, 452, { w: 0.5, a: 0.6, passes: 1, over: 0 }); P.line(1092, 436, 1092, 452, { w: 0.5, a: 0.6, passes: 1, over: 0 });
      // cam + follower + jaw
      const cam = []; for (let i = 0; i < 24; i++) { const a = i * TAU / 24; cam.push([1044 + Math.cos(a) * (14 + 7 * Math.cos(a - 0.6)), 470 + Math.sin(a) * (14 + 7 * Math.cos(a - 0.6))]); }
      P.pl(cam, { closed: true, w: 1.3, rough: 0.25, passes: 1 }); P.dot(1044, 470, 2.4, {}); P.circle(1044, 470, 5, { w: 0.8, passes: 1 });
      P.line(1044, 491, 1044, 504, { w: 0.9, passes: 1, over: 0 }); P.line(1044, 504, 1076, 506, { w: 1.1, passes: 1, over: 0, rough: 0.2 }); P.circle(1076, 506, 3, { w: 0.9, passes: 1 });
      const jaw = [[1030, 512], [1100, 508], [1102, 532], [1040, 538]]; P.poly(jaw, { w: 1.3, rough: 0.25 }); for (let x = 1044; x < 1098; x += 6) P.line(x, 512, x - 1, 532, { w: 0.5, a: 0.7, passes: 1, over: 0 });
      coil([1096, 490], [1096, 508], 4, 3.2);
      P.hatch(P.sample(h, true, 6), { ang: 70, gap: 3, a: 0.32, w: 0.4, fade: x => Math.max(0, (x - 1040) / 100), piece: 10 });
      P.note('CAM MAKES IT TALK', 940, 578, 1036, 484, { size: 15 });
      P.note('LENS TUBE', 1040, 418, 1084, 436, { size: 14 }); P.note('JAW', 1130, 546, 1102, 526, { size: 14 });
    }

    /* ---------------- DETAIL D : escapement ---------------- */
    P.text('DETAIL D', 990, 626, { size: 20, font: S.HAND }); P.text('ESCAPEMENT', 1076, 626, { size: 15 });
    { const ex = 1042, ey = 728, R = 54, z = 15, pts = [];
      for (let i = 0; i < z; i++) { const a = i * TAU / z; pts.push([ex + Math.cos(a) * (R - 12), ey + Math.sin(a) * (R - 12)]); pts.push([ex + Math.cos(a + 0.36) * R, ey + Math.sin(a + 0.36) * R]); }
      P.pl(pts, { closed: true, w: 1.4, rough: 0.3, over: 0.1, passes: 1 });
      P.circle(ex, ey, R - 22, { w: 0.9, passes: 1 }); P.circle(ex, ey, 6, { w: 1.1, passes: 1 }); P.dot(ex, ey, 2, {});
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.2; P.line(ex + Math.cos(a) * 6, ey + Math.sin(a) * 6, ex + Math.cos(a) * (R - 22), ey + Math.sin(a) * (R - 22), { w: 0.8, passes: 1, over: 0, rough: 0.2 }); }
      // anchor
      const py = ey - R - 26; P.circle(ex, py, 5, { w: 1.1, passes: 1 }); P.dot(ex, py, 1.6, {});
      P.curve([[ex - 5, py + 2], [ex - 30, py + 16], [ex - 34, ey - R + 4]], { w: 1.5, rough: 0.25 }); P.curve([[ex + 5, py + 2], [ex + 30, py + 16], [ex + 34, ey - R + 12]], { w: 1.5, rough: 0.25 });
      P.pl([[ex - 34, ey - R + 4], [ex - 24, ey - R + 12], [ex - 20, ey - R + 6]], { w: 1.1, closed: true, rough: 0.2 }); P.pl([[ex + 34, ey - R + 12], [ex + 24, ey - R + 4], [ex + 20, ey - R + 10]], { w: 1.1, closed: true, rough: 0.2 });
      P.line(ex, py - 4, ex, py - 30, { w: 1.1, rough: 0.2 }); P.rect(ex - 3, py - 14, 6, 10, { w: 0.8, rough: 0.2 });
      P.hatch(P.sample(pts.concat([pts[0]]), false, 3), { ang: -50, gap: 2.6, a: 0.4, w: 0.4, fade: (x, y) => Math.max(0, ((x - ex) + (y - ey)) / R * 0.5 + 0.3), piece: 6 });
      P.note('ESCAPE WHEEL, 15 TEETH', 946, 838, 1010, 782, { size: 14 });
      P.note('ANCHOR RUNS THE BEAT', 1090, 664, 1074, py + 20, { size: 14 });
      P.text('TICK ... TICK ... TICK', 1080, 858, { size: 13, a: 0.8 });
    }
    // hidden Leonardo-style note
    P.text('THE BRASS MAN SHALL BOW TO THE KING', 690, 892, { size: 14, mirror: true, a: 0.8 });
  }
});
