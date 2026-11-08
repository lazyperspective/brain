// Shot 10 (78.6-92.0): low angle on the tower holding the caught ship against a deep blue
// sky with a faint moon; slow drift, dusk deepening, a beacon and first stars, then a
// dithered palette-step fade to black (~86.8-89.6) and black to the end.
(function () {
  'use strict';
  const { W, H, S, Wm, T, M, A, D, K, buf, P, Pd, rect, hl, vl, line, poly, disc, ring, pick, bth, hash, vnoise, fbm2,
    clamp, lerp, smooth, spline, ri, get, DARKER, fadeBlack } = PX;
  window.SHOTS = window.SHOTS || {};

  const FADE0 = 86.8, FADE1 = 89.8;
  // camera drift: the scene slides down-right as the camera tilts up and pans
  function drift(t) {
    const a = clamp((t - 78.6) / (92 - 78.6), 0, 1);
    const e = a * 0.75 + smooth(0, 1, a) * 0.25;
    return [e * 15, e * 30];
  }

  // ---- sky with cirrus hooks and the moon ----
  function sky(t, o) {
    const dusk = 1.7 * smooth(81.5, 89, t);
    const ox = o[0] * 0.85, oy = o[1] * 0.85;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const wx = x - ox, wy = y - oy;
      let v = 2.3 + 2.6 * (wy / H) + 1.0 * (wx / W) - dusk;
      // cirrus: long combed streaks curling at the ends
      const u = wx * 0.8 - wy * 0.6 + (t - 78.6) * 1.5, w = wx * 0.6 + wy * 0.8 + 14 * Math.sin(u * 0.012);
      const n = fbm2(u * 0.008, w * 0.07, 71, 3);
      const m = smooth(0.45, 0.85, vnoise(u * 0.004 + 3, 8)) * (0.7 + 0.3 * smooth(80, 0, y));
      if (n > 0.6) v += m * Math.min(1.5, (n - 0.6) * 7) * (1 - dusk * 0.25);
      buf[y * W + x] = pick(S, v, ri(wx), ri(wy));
    }
    // moon: a faint waxing gibbous, cool and translucent
    const mx = ri(250 - 9 + ox), my = ri(69 - 18 + oy), r = 5.5;
    const ml = 1 - 0.35 * smooth(84, 89, t);
    disc(mx, my, r, 0, (x, y, dx, dy) => {
      const lit = dx * 0.55 + dy * 0.25 > -r * 0.6;
      const maria = hash(ri(dx + 9), ri(dy + 9), 51) > 0.72 || (dx > 0 && dy > 0 && dx + dy < 4);
      if (!lit) { Pd(x, y, S[5], 0.5 * ml, 0, 0); return; }
      P(x, y, maria ? S[6] : (dx * dx + dy * dy > (r - 1.2) * (r - 1.2) ? S[6] : S[7]));
    });
  }
  // first stars in the deepening dusk
  function stars(t, o) {
    const a = smooth(85.2, 88.2, t);
    if (a <= 0) return;
    for (let i = 0; i < 26; i++) {
      const x = ri(hash(i, 1, 81) * 480 + o[0] * 0.85), y = ri(hash(i, 2, 81) * 120 + o[1] * 0.85);
      if (hash(i, 3, 81) > a) continue;
      if (get(x, y) > S[3] && get(x, y) <= S[9]) continue; // only in the darkest sky
      const tw = Math.sin(t * (2 + hash(i, 4, 81) * 3) + i);
      P(x, y, tw > 0.3 ? S[8] : S[6]);
    }
  }

  // ---- tower in perspective ----
  // edges of the two visible faces at t = 78.6 (screen), bottom point then top point
  const EA0 = [[135, 278], [165, 62]], EA1 = [[166, 278], [191, 57]], EB1 = [[192, 278], [214, 66]];
  const PD = 1.6;
  const fh = h => h * (1 + PD) / (h + PD);
  const ept = (E, h) => { const f = fh(h); return [lerp(E[0][0], E[1][0], f), lerp(E[0][1], E[1][1], f)]; };
  function fpt(face, s, h, o) {
    const a = ept(face === 0 ? EA0 : EA1, h), b = ept(face === 0 ? EA1 : EB1, h);
    return [lerp(a[0], b[0], s) + o[0], lerp(a[1], b[1], s) + o[1]];
  }
  // pixel-clean thick member: parallel Bresenham lines, colours listed from lit side to shade side
  function member(p0, p1, cols, perpX) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const vert = perpX !== undefined ? perpX : Math.abs(dy) > Math.abs(dx);
    for (let i = 0; i < cols.length; i++) {
      const ox = vert ? i : 0, oy = vert ? 0 : i;
      line(p0[0] + ox, p0[1] + oy, p1[0] + ox, p1[1] + oy, cols[i]);
    }
  }
  const NMOD = 10;
  function tower(o, t) {
    const hm = k => k / NMOD;
    // the tower's inside: back faces seen through the lit face (dark warm members, dense)
    for (let k = 0; k < NMOD; k++) {
      const h0 = hm(k), h1 = hm(k + 1), hh = (h0 + h1) / 2;
      member(fpt(0, 0.1, h0, o), fpt(0, 0.9, h1, o), [T[3], T[2]]);
      member(fpt(0, 0.9, h0, o), fpt(0, 0.1, h1, o), [M[2], T[2]]);
      member(fpt(0, 0.0, hh, o), fpt(0, 1, hh, o), [T[3]], false);
      member(fpt(0, 0.28, h0, o), fpt(0, 0.28, h1, o), [T[2]], true);
      member(fpt(0, 0.72, h0, o), fpt(0, 0.72, h1, o), [T[3]], true);
    }
    // ---- shadow face (B): warm-shaded lattice, dense ----
    for (let k = 0; k < NMOD; k++) {
      const h0 = hm(k), h1 = hm(k + 1);
      member(fpt(1, 0, h0, o), fpt(1, 1, h0, o), [M[4], T[4], T[2]], false);
      member(fpt(1, 0.06, h0 + 0.006, o), fpt(1, 0.94, h1 - 0.006, o), [M[4], T[4], T[2]]);
      member(fpt(1, 0.94, h0 + 0.006, o), fpt(1, 0.06, h1 - 0.006, o), [T[5], T[3]]);
      member(fpt(1, 0.5, h0, o), fpt(1, 0.5, h1, o), [T[4], T[3]], true);
    }
    // back corner column of face B
    member(fpt(1, 1, 0, o), fpt(1, 1, 1, o), [M[4], T[4], T[3], T[2]], true);
    // ---- lit face (A): girts, K-bracing, centre column ----
    for (let k = 0; k < NMOD; k++) {
      const h0 = hm(k), h1 = hm(k + 1), ht = h1 - h0;
      const th = 1 - fh(h0) * 0.45;
      const up = k & 1;
      const dl = th > 0.72 ? [Wm[6], Wm[6], T[8], T[6]] : th > 0.62 ? [Wm[6], T[8], T[6]] : [Wm[6], T[7]];
      const dr = th > 0.72 ? [T[8], T[8], T[7], T[5]] : th > 0.62 ? [T[8], T[7], T[5]] : [T[8], T[6]];
      member(fpt(0, 0.08, up ? h0 + ht * 0.1 : h1 - ht * 0.14, o), fpt(0, 0.48, up ? h1 - ht * 0.16 : h0 + ht * 0.1, o), dl, false);
      member(fpt(0, 0.92, up ? h0 + ht * 0.1 : h1 - ht * 0.14, o), fpt(0, 0.52, up ? h1 - ht * 0.16 : h0 + ht * 0.1, o), dr, false);
      // girt (a deep beam with a lit top and a shadowed belly)
      member(fpt(0, 0, h0, o), fpt(0, 1, h0, o), th > 0.72 ? [Wm[6], T[8], T[6], T[4]] : th > 0.6 ? [Wm[6], T[7], T[4]] : [Wm[6], T[5]], false);
      const n = fpt(0, 0.5, up ? h1 - ht * 0.16 : h0 + ht * 0.1, o);
      rect(ri(n[0]) - 2, ri(n[1]) - 1, 4, 3, Wm[6]); hl(ri(n[0]) - 2, ri(n[0]) + 1, ri(n[1]) + 2, T[6]);
    }
    // centre column
    member(fpt(0, 0.5, 0, o), fpt(0, 0.5, 1, o), [Wm[6], T[8], T[6]], true);
    // corner columns: left (lit, chunky), A/B corner (lit edge with a shade side)
    member(fpt(0, 0, 0, o), fpt(0, 0, 1, o), [T[6], Wm[6], Wm[6], Wm[6], T[8], T[7], T[5]], true);
    member(fpt(0, 1, 0, o), fpt(0, 1, 1, o), [T[8], Wm[6], Wm[6], T[8], T[6], T[4]], true);
    // top: railing and crown edge
    const a = fpt(0, 0, 1, o), b = fpt(0, 1, 1, o), c = fpt(1, 1, 1, o);
    member([a[0], a[1] - 1], [b[0] + 3, b[1] - 1], [Wm[6], T[7]], false);
    for (let i = 0; i <= 9; i++) { const p = [lerp(a[0], b[0], i / 9), lerp(a[1], b[1], i / 9)]; vl(ri(p[0]), ri(p[1]) - 4, ri(p[1]) - 2, T[7]); }
    line(ri(a[0]), ri(a[1]) - 4, ri(b[0]), ri(b[1]) - 4, T[8]);
    // top house on the shadow face: dark cladding with a lit roof edge
    const q0 = fpt(1, 0, 0.89, o), q1 = fpt(1, 1, 0.89, o);
    poly([[b[0] + 2, b[1]], [c[0] + 2, c[1]], [q1[0] + 2, q1[1] + 2], [q0[0] + 2, q0[1]]], T[3]);
    for (let i = 1; i < 8; i++) { const p = [lerp(b[0], c[0], i / 8), lerp(b[1], c[1], i / 8)], pq = [lerp(q0[0], q1[0], i / 8), lerp(q0[1], q1[1], i / 8)]; line(ri(p[0]) + 2, ri(p[1]) + 1, ri(pq[0]) + 2, ri(pq[1]), T[4]); }
    line(ri(q0[0]) + 2, ri(q0[1]), ri(q1[0]) + 2, ri(q1[1]) + 2, T[2]);
    line(ri(b[0]) + 2, ri(b[1]), ri(c[0]) + 2, ri(c[1]), M[5]);
    line(ri(b[0]) + 2, ri(b[1]) - 1, ri(c[0]) + 2, ri(c[1]) - 1, T[6]);
    for (let i = 0; i <= 7; i++) { const p = [lerp(b[0], c[0], i / 7), lerp(b[1], c[1], i / 7)]; vl(ri(p[0]) + 2, ri(p[1]) - 4, ri(p[1]) - 2, T[5]); }
    line(ri(b[0]) + 2, ri(b[1]) - 4, ri(c[0]) + 2, ri(c[1]) - 4, T[5]);
    // beacon on the crown, blinking as dusk falls
    if (t > 83.2) {
      const ph = (t - 83.2) % 1.6;
      const bx = ri(b[0]) + 1, by = ri(b[1]) - 7;
      vl(bx, by + 1, by + 3, T[5]);
      if (ph < 0.32) { P(bx, by, Wm[4]); P(bx - 1, by, Wm[2]); P(bx + 1, by, Wm[2]); P(bx, by - 1, Wm[2]); }
      else P(bx, by, Wm[1]);
    }
  }

  // ---- carriage, arms, QD gangway (base coords at t=78.6, shifted by o) ----
  function arms(o) {
    const X = x => ri(x + o[0]), Y = y => ri(y + o[1]);
    const Lm = (x0, y0, x1, y1, cols, v) => member([X(x0), Y(y0)], [X(x1), Y(y1)], cols, v);
    // carriage: a deep truss box wrapped on the shadow face
    poly([[X(193), Y(94)], [X(212), Y(98)], [X(211), Y(146)], [X(192), Y(143)]], 0, (x, y) => Pd(x, y, T[2], 0.5, 0, 0));
    for (let i = 0; i < 4; i++) {
      const y0 = 96 + i * 12.5, y1 = y0 + 12.5;
      Lm(193, y0, 211, y1 + 3, [T[4], T[2]], false);
      Lm(211, y0 + 3, 193, y1, [T[3]], false);
      Lm(193, y0, 211, y0 + 3, [T[5], T[3]], false);
    }
    Lm(193, 94, 212, 98, [T[7], T[5], T[3]], false);
    Lm(192, 143, 211, 146, [T[5], T[2]], false);
    Lm(193, 94, 192, 143, [T[5], T[3]], true);
    Lm(211, 97, 211, 147, [T[6], T[4], T[2]], true);
    // hoist cables to the top house
    Lm(200, 72, 200, 95, [T[4]], true); Lm(205, 74, 205, 96, [T[4]], true);
    // far arm (behind): top chord over the ship
    Lm(212, 99, 270, 104, [T[4], T[2]], false);
    // near arm truss
    Lm(205, 140, 262, 116, [T[7], T[5], T[3]], false);            // big lower diagonal
    const posts = [216, 225, 233, 241, 249, 257];
    for (let i = 0; i < posts.length; i++) {
      const px = posts[i], yt = 96 + (px - 204) * 0.13, yb = 140 - (px - 205) * 24 / 57;
      Lm(px, yt + 2, px - 1, yb, [T[6], T[3]], true);
      if (i + 1 < posts.length) {
        const nx = posts[i + 1], nyb = 140 - (nx - 205) * 24 / 57;
        Lm(px + 1, yt + 3, nx - 1, nyb - 1, [T[3]], false);
        Lm(px + 1, yb - 1, nx - 1, 96 + (nx - 204) * 0.13 + 3, [T[6], T[3]], false);
      }
    }
    Lm(204, 96, 266, 104, [Wm[6], T[7], T[4], T[2]], false);          // top chord, lit edge
    Lm(204, 117, 258, 121, [T[5], T[3]], false);                    // mid chord
    // pin rail tip past the ship
    Lm(266, 104, 274, 105, [T[7], T[4]], false);
    rect(X(272), Y(102), 3, 5, T[4]); P(X(272), Y(102), T[7]);
  }
  function qd(o) {
    const X = x => ri(x + o[0]), Y = y => ri(y + o[1]);
    const Lm = (x0, y0, x1, y1, cols, v) => member([X(x0), Y(y0)], [X(x1), Y(y1)], cols, v);
    // box truss across the lower tower
    const top = [[138, 166], [204, 152]], bot = [[140, 206], [204, 186]];
    // front face bracing
    for (let i = 0; i < 4; i++) {
      const f0 = i / 4, f1 = (i + 1) / 4;
      const a = [lerp(top[0][0], top[1][0], f0), lerp(top[0][1], top[1][1], f0)], b = [lerp(top[0][0], top[1][0], f1), lerp(top[0][1], top[1][1], f1)];
      const c = [lerp(bot[0][0], bot[1][0], f0), lerp(bot[0][1], bot[1][1], f0)], d = [lerp(bot[0][0], bot[1][0], f1), lerp(bot[0][1], bot[1][1], f1)];
      Lm(a[0], a[1], d[0], d[1], [T[8], T[5]], false);
      Lm(b[0], b[1], c[0], c[1], [T[6], T[3]], false);
      Lm(b[0], b[1], d[0], d[1], [T[7], T[4]], true);
    }
    Lm(top[0][0], top[0][1], bot[0][0], bot[0][1], [Wm[6], T[7], T[4]], true);
    Lm(bot[0][0], bot[0][1], bot[1][0], bot[1][1], [T[6], T[3]], false);
    // deck + railing
    Lm(top[0][0], top[0][1], top[1][0], top[1][1], [Wm[6], T[8], T[5], T[3]], false);
    Lm(top[0][0], top[0][1] - 5, top[1][0], top[1][1] - 5, [T[7]], false);
    for (let i = 0; i <= 12; i++) { const f = i / 12; vl(X(lerp(top[0][0], top[1][0], f)), Y(lerp(top[0][1], top[1][1], f) - 5), Y(lerp(top[0][1], top[1][1], f) - 1), T[6]); }
    // gangway swinging toward the ship
    const g0 = [204, 152], g1 = [232, 140];
    poly([[X(g0[0]), Y(g0[1])], [X(g1[0]), Y(g1[1])], [X(g1[0] + 2), Y(g1[1] + 9)], [X(g0[0]), Y(g0[1] + 12)]], T[4]);
    Lm(g0[0], g0[1], g1[0], g1[1], [Wm[6], T[7]], false);
    Lm(g0[0], g0[1] + 12, g1[0] + 2, g1[1] + 9, [T[3]], false);
    Lm(g0[0], g0[1] - 5, g1[0], g1[1] - 5, [T[7]], false);
    for (let i = 0; i <= 6; i++) { const f = i / 6; vl(X(lerp(g0[0], g1[0], f)), Y(lerp(g0[1], g1[1], f) - 5), Y(lerp(g0[1], g1[1], f) - 1), T[6]); }
    for (let i = 0; i < 4; i++) { const f = i / 4, f2 = (i + 1) / 4; Lm(lerp(g0[0], g1[0], f), lerp(g0[1] + 12, g1[1] + 9, f), lerp(g0[0], g1[0], f2), lerp(g0[1] + 1, g1[1] + 1, f2), [T[6]], false); }
    // small crane head at the end
    rect(X(229), Y(132), 4, 6, T[5]); P(X(229), Y(132), T[8]);
  }

  // ---- ship seen from below: silver lit side, black heat shield, aft dome ----
  const SCX = 256.5, SR = 13, STIP = 92, SBOT = 203, SLN = 20;
  const prof = s => Math.pow(1 - Math.pow(1 - clamp(s, 0, 1), 2), 0.55);
  function ship(o, t) {
    const X = x => ri(x + o[0]), Y = y => ri(y + o[1]);
    for (let y = STIP; y <= SBOT; y++) {
      const k = y - STIP;
      const hw = k < SLN ? Math.max(1.2, SR * prof((k + 0.8) / SLN)) : SR + (k > 90 ? 0.4 : 0);
      for (let x = Math.round(SCX - hw); x <= Math.round(SCX + hw) - 1; x++) {
        const u = (x + 0.5 - SCX) / hw;
        let c;
        const tile = u > 0.05 - (k < SLN ? 1.3 * Math.pow(1 - k / SLN, 1.6) : 0);
        if (tile) {
          const v = 1.1 + 0.9 * Math.exp(-(((u - 0.35) / 0.18) ** 2)) - (u > 0.85 ? 0.6 : 0);
          c = pick(T, v, X(x), Y(y));
          if (k % 3 === 0 && (x & 1)) c = DARKER[c];
        } else {
          // steel: bright sunlit band, cool sky reflection at the limb
          const v = u < -0.88 ? 5.0 : u < -0.7 ? 6.6 : u < -0.42 ? 8.0 : u < -0.22 ? 7.2 : 6.2;
          c = pick(T, v + 0.3 * Math.sin(k * 0.12), X(x), Y(y));
          if (u < -0.42 && u > -0.7 && k > 30 && k < 80) c = Wm[6];
          if (u < -0.92) c = S[5];
        }
        if (k < 5) c = k < 2 ? T[2] : T[3];
        P(X(x), Y(y), c);
      }
    }
    // raceway on the left
    vl(X(SCX - 9), Y(STIP + 26), Y(SBOT - 8), T[6]); vl(X(SCX - 8), Y(STIP + 26), Y(SBOT - 8), T[8]);
    // forward flap on the right (heat-shield side)
    poly([[X(SCX + 6), Y(STIP + 6)], [X(SCX + 13), Y(STIP + 16)], [X(SCX + 16), Y(STIP + 30)], [X(SCX + 11), Y(STIP + 30)]], T[1]);
    line(X(SCX + 6), Y(STIP + 6), X(SCX + 13), Y(STIP + 16), T[4]);
    // aft flap on the right
    poly([[X(SCX + 12), Y(SBOT - 46)], [X(SCX + 17), Y(SBOT - 40)], [X(SCX + 17), Y(SBOT - 8)], [X(SCX + 12), Y(SBOT - 6)]], T[1]);
    line(X(SCX + 17), Y(SBOT - 40), X(SCX + 17), Y(SBOT - 8), T[3]);
    // aft dome: ellipse seen from below with the engine bells' shadow
    for (let y = -6; y <= 6; y++) for (let x = -14; x <= 14; x++) {
      const e = (x + 0.5) * (x + 0.5) / (13.6 * 13.6) + (y + 0.5) * (y + 0.5) / (5.2 * 5.2);
      if (e > 1 || y < 0) continue;
      let c = e > 0.72 ? (x < -6 ? T[5] : T[3]) : D[1];
      if (e < 0.72 && e > 0.45 && x < 0) c = T[1];
      P(X(SCX + x), Y(SBOT + y), c);
    }
    hl(X(SCX - 13), X(SCX + 12), Y(SBOT), T[4]);
    hl(X(SCX - 12), X(SCX - 2), Y(SBOT), T[7]);
  }

  window.SHOTS.shot10 = function (t) {
    const o = drift(t);
    sky(t, o);
    stars(t, o);
    const oi = [ri(o[0]), ri(o[1])];
    tower(oi, t);
    qd(oi);
    ship(oi, t);
    arms(oi);
    if (t >= FADE0) fadeBlack(clamp((t - FADE0) / (FADE1 - FADE0), 0, 1), 11);
  };
})();
