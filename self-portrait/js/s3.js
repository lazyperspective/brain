// s3.js — THE MIRROR. Glyphs gather before a tall gilt mirror and try to be a face.
// They never settle; they fall, and what gets back up is a small lantern.
(function (g) {
  'use strict';
  const P = g.PX, C = P.C, L = P.LUT, G = g.GLY, TL = g.TL, S2 = g.S2, LAN = g.LAN;
  const W = 480, H = 270, HY = 178, CX = 240;
  const GX0 = 204, GX1 = 276, GSP = 76, GB = 196, GR = 36, FT = 9, FLOOR = 214;
  const VP = { x: 240, y: 178 };
  const FC = { x: 240, y: 108 };       // face centre
  const LPOS = { x: 240, y: 150 };     // where the lantern floats
  let mir, mirRef, glass, built = false, parts = [], faces = [];

  function inShape(x, y, gr) {
    if (y >= GB + gr) return false;
    if (y >= GSP) return x >= GX0 - gr && x < GX1 + gr;
    const dx = x + 0.5 - CX, dy = y + 0.5 - GSP, r = GR + gr;
    return dx * dx + dy * dy <= r * r;
  }
  // colour of the gilt frame at distance band d (1..FT) from the glass
  function frameCol(x, y, d) {
    const right = x > CX, top = y < GSP;
    // perimeter parameter for carved beads
    let s;
    if (y >= GSP) s = y; else s = Math.round(Math.atan2(GSP - y, x - CX) * (GR + 5));
    const m = ((s % 6) + 6) % 6;
    switch (d) {
      case 1: return C.A1;
      case 2: return right ? C.A4 : C.A3;
      case 3: return right ? C.A6 : C.A4;
      case 4: return m < 3 ? C.A4 : C.A2;
      case 5: return m < 3 ? (m === 1 ? C.A6 : C.A5) : C.A1;
      case 6: return m < 3 ? C.A3 : C.A2;
      case 7: return C.A1;
      case 8: return right || (top && x > CX - 20) ? C.A4 : C.A3;
      default: return right || (top && x > CX - 24) ? C.A5 : C.A2;
    }
  }
  function frameD(x, y, g0) {
    if (!inShape(x, y, g0 + FT) || inShape(x, y, g0)) return 0;
    let d = 1; while (d < FT && !inShape(x, y, g0 + d)) d++;
    return d;
  }
  function buildGlass() {
    glass = P.mk(W, H);
    const r = P.rng(3003);
    // what the mirror sees behind us: night, the avenue of shelves, and far away the doorway of light
    const hgt = [];
    for (let x = GX0; x < GX1; x++) {
      const ar = Math.abs(x - VP.x), col = Math.floor(Math.log(ar / 4 + 1) * 5.2);
      hgt.push(ar < 4 ? 0 : Math.round(3 + ar * 0.7 + P.hash(col, x < VP.x ? 1 : 2, 61) * 9));
    }
    P.shade(glass, GX0, GSP - GR, GX1, GB, (x, y) => {
      if (!inShape(x, y, 0)) return -1;
      const ar = Math.abs(x - VP.x), q = y - VP.y, h = hgt[x - GX0];
      if (q >= 0) { // mirror floor
        if (ar < 2 + q * 0.12) return P.bay(x, y) < 11 - q / 3 ? C.A2 : C.A1;
        const hr = P.hash(x, 400 - y, 71);
        return (q < h && hr < 0.05) ? C.A0 : P.bay(x, y) < 5 ? C.N2 : C.N1;
      }
      if (-q <= h) { // shelf towers
        const col = Math.floor(Math.log(ar / 4 + 1) * 5.2), coln = Math.floor(Math.log((ar + 1) / 4 + 1) * 5.2);
        if (-q === h) return C.N3;
        if (col !== coln) return C.N3;
        if ((-q) % 4 === 0) return C.N3;
        const hr = P.hash(x, y, 72);
        return hr < 0.10 ? (ar > 20 && hr < 0.03 ? C.A2 : C.A1) : hr < 0.13 ? C.T0 : C.N2;
      }
      const hs = P.hash(x, y, 73);
      return hs < 0.010 ? C.N5 : hs < 0.016 ? C.N7 : (y > 150 && P.bay(x, y) < (y - 150) / 2.2 ? C.N2 : C.N1);
    });
    P.rect(glass, VP.x - 1, VP.y - 9, 3, 9, C.A5); P.vl(glass, VP.x, VP.y - 8, 7, C.A7);
    P.px(glass, VP.x - 2, VP.y - 1, C.A2); P.px(glass, VP.x + 2, VP.y - 1, C.A2); P.hl(glass, VP.x - 1, VP.y - 10, 3, C.A3);
    // frame shadow on the glass + glare streaks
    P.shade(glass, GX0, GSP - GR, GX1, GB, (x, y, c) => {
      if (c === P.TR) return -1;
      if (!inShape(x - 2, y - 2, 0) || !inShape(x - 1, y - 3, 0)) return L.dn1[c];
      const dgl = (x - GX0) + (y - 40);
      if ((dgl > 46 && dgl < 54 && y < 112 && P.bay(x, y) < 5) || (dgl > 58 && dgl < 61 && y < 104 && P.bay(x, y) < 4)) return L.up1[c];
      const d2 = (x - GX0) + (y - 40);
      if (d2 > 196 && d2 < 204 && y > 150 && P.bay(x, y) < 3) return L.up1[c];
      return -1;
    });
  }
  function buildMirror() {
    mir = P.mk(W, H);
    P.shade(mir, GX0 - FT - 2, GSP - GR - FT - 2, GX1 + FT + 2, GB + FT + 1, (x, y) => {
      const d = frameD(x, y, 0);
      return d ? frameCol(x, y, d) : -1;
    });
    // corner rosettes at the spring line
    const ros = (x, y) => { P.rect(mir, x - 3, y - 3, 7, 7, C.A2); P.rect(mir, x - 2, y - 2, 5, 5, C.A4); P.rect(mir, x - 1, y - 1, 3, 3, C.A5); P.px(mir, x, y, C.A7); P.px(mir, x - 3, y - 3, P.TR); P.px(mir, x + 3, y - 3, P.TR); P.px(mir, x - 3, y + 3, P.TR); P.px(mir, x + 3, y + 3, P.TR); };
    ros(GX0 - 5, GSP); ros(GX1 + 4, GSP); ros(GX0 - 5, GB - 4); ros(GX1 + 4, GB - 4);
    // crest: an empty oval cartouche where a portrait should be, with scroll wings
    const cy = 22;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 26; i++) { // wing: a tapering S-curve
        const f = i / 25, x = CX + s * (9 + i), y = Math.round(cy + 3 + Math.sin(f * 3.6) * 4 + f * 5), th = f < 0.75 ? 3 : 2;
        P.rect(mir, x, y, 1, th, C.A3); P.px(mir, x, y, s > 0 ? C.A5 : C.A4); P.px(mir, x, y + th, C.A1);
      }
      P.disc(mir, CX + s * 36, cy + 8, 3.2, C.A3); P.disc(mir, CX + s * 36, cy + 8, 1.6, C.A1); P.px(mir, CX + s * 36, cy + 8, C.A6);
      P.px(mir, CX + s * 20, cy + 1, C.A5); P.px(mir, CX + s * 21, cy, C.A4); P.px(mir, CX + s * 22, cy - 1, C.A3);
    }
    P.ell(mir, CX, cy, 10.5, 9.5, C.A2); P.ell(mir, CX, cy, 9.4, 8.4, C.A4); P.ell(mir, CX, cy, 7.6, 6.6, C.A1); P.ell(mir, CX, cy, 6.6, 5.6, C.N1);
    for (let a = 0; a < 14; a++) { const th = -2.4 + a * 0.12; P.px(mir, Math.round(CX + Math.cos(th) * 8.6), Math.round(cy + Math.sin(th) * 7.6), C.A6); }
    P.px(mir, CX + 2, cy - 2, C.N3); P.px(mir, CX + 3, cy - 1, C.N2);   // a glint on nothing
    P.vl(mir, CX, cy - 15, 5, C.A4); P.rect(mir, CX - 1, cy - 13, 3, 2, C.A5); P.px(mir, CX, cy - 16, C.A7); P.hl(mir, CX - 2, cy - 10, 5, C.A3);
    // plinth and feet
    P.rect(mir, GX0 - FT - 3, GB + FT - 1, GX1 - GX0 + 2 * FT + 6, 6, C.A3);
    P.hl(mir, GX0 - FT - 3, GB + FT - 1, GX1 - GX0 + 2 * FT + 6, C.A5); P.hl(mir, GX0 - FT - 3, GB + FT + 4, GX1 - GX0 + 2 * FT + 6, C.A1);
    for (let x = GX0 - FT - 1; x < GX1 + FT + 2; x += 4) P.rect(mir, x, GB + FT + 1, 2, 2, C.A2);
    P.rect(mir, CX + 20, GB + FT - 1, GX1 + FT + 3 - CX - 20, 1, C.A6);
    for (let s = -1; s <= 1; s += 2) {
      const fx = s < 0 ? GX0 - FT - 5 : GX1 + FT - 5;
      P.rect(mir, fx, GB + FT + 5, 10, 4, C.A2); P.hl(mir, fx, GB + FT + 5, 10, C.A4); P.rect(mir, fx + (s < 0 ? -1 : 9), GB + FT + 7, 2, 2, C.A3);
    }
    // its reflection in the floor
    mirRef = P.mk(W, H);
    for (let k = 0; k < H - FLOOR; k++) for (let x = 170; x < 310; x++) {
      const c = mir.d[(FLOOR - 1 - k) * W + x];
      if (c !== P.TR && (k < 14 || P.bay(x, FLOOR + k) < 16 - (k - 14) * 1.4) && (k % 7 !== 5 || k < 6)) mirRef.d[(FLOOR + k) * W + x] = L.dn3[c];
    }
  }

  // ---------- faces as point sets -------------------------------------------------------------
  const GROUPS = [['out', 56], ['eyeL', 9], ['eyeR', 9], ['browL', 5], ['browR', 5], ['nose', 8], ['mouth', 11], ['hair', 46], ['lines', 12], ['neck', 22], ['halo', 37]];
  function face(p, seed) {
    const r = P.rng(seed), pts = [];
    const loose = () => { const a = r.r(0, 6.28), d = r.r(40, 62); return [Math.cos(a) * d, Math.sin(a) * d * 1.1 - 4, 1]; };
    const add = (x, y) => pts.push([x, y, 0]);
    // outline
    for (let j = 0; j < 56; j++) {
      const th = -Math.PI / 2 + (j / 56) * Math.PI * 2, s = Math.sin(th), c = Math.cos(th);
      const ae = p.a * (s > 0 ? 1 - p.jaw * Math.pow(s, 1.6) : 1 - 0.06 * -s);
      add(ae * c, p.b * s * (s > 0 ? 1 : 0.92));
    }
    for (let sd = -1; sd <= 1; sd += 2) { // eyes
      for (let j = 0; j < 5; j++) { const u = j / 4 * 2 - 1; add(sd * p.ex + u * p.er, -p.ey - Math.round((1 - u * u) * p.eo)); }
      for (let j = 0; j < 4; j++) { const u = (j + 0.5) / 4 * 2 - 1; add(sd * p.ex + u * p.er * 0.8, -p.ey + (p.gl ? Math.round((1 - u * u) * 2) : 1)); }
    }
    for (let sd = -1; sd <= 1; sd += 2) for (let j = 0; j < 5; j++) { const u = j / 4; add(sd * (p.ex - p.er + u * p.er * 2.2), -p.ey - p.eo - 3 - (p.bt || 0) * (sd * (u - 0.5))); }
    for (let j = 0; j < 6; j++) add(p.nx || 0, -p.ey + 3 + j * (p.nl / 5));
    add(-2, -p.ey + 4 + p.nl); add(2, -p.ey + 4 + p.nl);
    for (let j = 0; j < 11; j++) { const u = j / 10 * 2 - 1; add(u * p.mw, p.my + p.mc * (1 - u * u)); }
    // hair
    const hp = [];
    if (p.hair === 'cap') for (let j = 0; j < 46; j++) { const row = j % 2, th = Math.PI * (1.05 + (j >> 1) / 22 * 0.9); hp.push([Math.cos(th) * (p.a + 3 + row * 4), Math.sin(th) * (p.b * 0.95 + 3 + row * 4)]); }
    else if (p.hair === 'long') for (let j = 0; j < 46; j++) {
      if (j < 18) { const th = Math.PI * (1.08 + j / 17 * 0.84); hp.push([Math.cos(th) * (p.a + 4), Math.sin(th) * (p.b + 4)]); }
      else { const k = j - 18, sd = k % 2 ? 1 : -1, row = (k >> 1) % 2, i = k >> 2; hp.push([sd * (p.a + 3 + row * 4 + Math.sin(i * 0.9) * 2), -8 + i * 7.5]); }
    }
    else if (p.hair === 'bun') for (let j = 0; j < 46; j++) {
      if (j < 24) { const th = Math.PI * (1.06 + j / 23 * 0.88); hp.push([Math.cos(th) * (p.a + 3), Math.sin(th) * (p.b + 3)]); }
      else { const k = j - 24, th = k / 22 * 6.28, rr = k % 2 ? 9 : 5; hp.push([Math.cos(th) * rr, -p.b - 12 + Math.sin(th) * rr * 0.8]); }
    }
    else if (p.hair === 'curl') for (let j = 0; j < 46; j++) { const th = Math.PI * (0.92 + j / 45 * 1.16), rr = 1 + (j % 3) * 0.13 + 0.06; hp.push([Math.cos(th) * (p.a + 2) * rr + Math.sin(j * 2.4) * 2, Math.sin(th) * (p.b + 2) * rr + Math.cos(j * 1.7) * 2]); }
    else for (let j = 0; j < 46; j++) { const q = loose(); hp.push([q[0], q[1], 1]); }
    hp.forEach(q => pts.push([q[0], q[1], q[2] || 0]));
    // age lines
    for (let j = 0; j < 12; j++) {
      if (!p.lines) { pts.push(loose()); continue; }
      if (j < 8) add((j % 4 - 1.5) * 5, -p.ey - p.eo - 9 - (j >> 2) * 4 + (j % 4 === 0 || j % 4 === 3 ? 1 : 0));
      else { const sd = j % 2 ? 1 : -1, i = (j - 8) >> 1; add(sd * (p.ex + 3 + i * 2), -p.ey + 9 + i * 5); }
    }
    // neck + shoulders
    for (let j = 0; j < 22; j++) {
      const sd = j % 2 ? 1 : -1, i = j >> 1;
      if (i < 4) add(sd * p.a * 0.36, p.b - 2 + i * 3.4);
      else { const u = (i - 4) / 6; add(sd * (p.a * 0.36 + u * p.sh), p.b + 10 + Math.round(u * u * 12) + 2); }
    }
    for (let j = 0; j < 37; j++) pts.push(loose());
    // half-formed: knock parts of it loose
    pts.forEach((q, i) => {
      if (q[2]) return;
      if (p.miss && p.miss(q[0], q[1], r)) { const a = r.r(0, 6.28), d = r.r(6, 22); q[0] += Math.cos(a) * d; q[1] += Math.sin(a) * d; q[2] = 1; }
    });
    return pts.map(q => [Math.round(FC.x + q[0] * 1.18), Math.round(FC.y + q[1] * 1.18), q[2]]);
  }
  function buildFaces() {
    faces = [
      face({ a: 20, b: 23, jaw: 0.22, ex: 8, ey: 1, er: 4, eo: 3, nl: 5, mw: 5, my: 13, mc: 2, hair: 'cap', sh: 16, miss: (x, y, r) => r() < 0.12 }, 11),          // a child
      face({ a: 21, b: 33, jaw: 0.5, ex: 8, ey: 6, er: 4, eo: 1, nl: 13, mw: 8, my: 21, mc: -1, hair: 'long', lines: true, sh: 26, bt: 2, miss: (x, y, r) => x > 6 && y > 4 && r() < 0.7 }, 12),   // someone old
      face({ a: 27, b: 28, jaw: 0.3, ex: 11, ey: 4, er: 5, eo: 2, nl: 9, mw: 11, my: 17, mc: 3, hair: 'curl', sh: 30, gl: 1, miss: (x, y, r) => y < -18 && x < 0 && r() < 0.6 }, 13),            // broad, laughing
      face({ a: 18, b: 31, jaw: 0.62, ex: 7, ey: 5, er: 3, eo: 2, nl: 11, mw: 6, my: 19, mc: 0, hair: 'bun', sh: 22, miss: (x, y, r) => x < -3 && r() < 0.8 }, 14),                            // narrow; only half arrives
      face({ a: 25, b: 30, jaw: 0.36, ex: 10, ey: 3, er: 5, eo: 1, nl: 10, mw: 9, my: 18, mc: -2, hair: 'none', lines: true, sh: 30, bt: -3, miss: (x, y, r) => y > 12 && r() < 0.55 }, 15),       // bald, stern, dissolving chin
      face({ a: 22, b: 27, jaw: 0.4, ex: 9, ey: 3, er: 4, eo: 2, nl: 8, mw: 7, my: 16, mc: 1, hair: 'long', sh: 24, miss: (x, y, r) => r() < 0.34 }, 16)                                         // nobody in particular
    ];
  }
  function buildParts() {
    const r = P.rng(4242); parts = []; let i = 0;
    for (const [name, n] of GROUPS) for (let j = 0; j < n; j++, i++) {
      const rk = S2.pickRamp(r()), rp = P.RAMP[rk];
      let kind, c, c2;
      if (name === 'out') { kind = 3; c = r.chance(0.35) ? C.A5 : C.A4; }
      else if (name === 'eyeL' || name === 'eyeR') { kind = 1; c = j < 5 ? C.A7 : C.A5; }
      else if (name === 'mouth') { kind = 1; c = C.A6; }
      else if (name === 'nose' || name === 'browL' || name === 'browR') { kind = 1; c = C.A5; }
      else if (name === 'lines') { kind = 1; c = C.A3; }
      else if (name === 'hair') { kind = 3; c = rk === 'A' ? (r.chance(0.5) ? C.A3 : C.A4) : rp[3]; }
      else if (name === 'neck') { kind = 2; c = C.A3; }
      else { kind = 3; c = rk === 'A' ? C.A3 : rp[2]; }
      parts.push({
        i, name, kind, c, g3: r.pick(G.G3), g2: r.pick(G.G2), ph: r.r(0, 6.28), ph2: r.r(0, 6.28), h: r(), h2: r(), h3: r(),
        sx: r.i(30, 450), sy: r.i(-60, 150), land: FLOOR + 3 + r.i(0, 12), keep: r.chance(0.3)
      });
    }
  }
  const FD = (TL.faces[1] - TL.faces[0]) / 6;
  function partPos(p, t) {
    const wob = (amp) => [Math.round(Math.sin(t * 2.3 + p.ph) * amp), Math.round(Math.cos(t * 1.9 + p.ph2) * amp)];
    if (t < TL.faces[0]) {
      const a = P.ease(P.prog(t, TL.gather[0] + p.h * 0.5, TL.faces[0] - 0.1 + p.h2 * 0.1));
      const sy = p.sy + (t - 15) * 9, f = faces[0][p.i], w = wob(1.5);
      const sw = Math.sin(a * Math.PI) * (p.h3 - 0.5) * 40;
      return [Math.round(P.lerp(p.sx, f[0], a) + sw) + w[0], Math.round(P.lerp(sy, f[1], a)) + w[1], a, f[2]];
    }
    if (t < TL.collapse[0]) {
      const u = (t - TL.faces[0]) / FD, k = Math.min(5, Math.floor(u)), fr = u - k;
      const B = faces[k][p.i], w = wob(B[2] ? 2.5 : 1.2);
      if (k === 0) return [B[0] + w[0], B[1] + w[1], 1, B[2]];
      const A = faces[k - 1][p.i];
      const a = P.smooth(P.prog(fr, p.h * 0.12, 0.42 + p.h * 0.12));
      const sw = Math.sin(a * Math.PI) * (p.h3 - 0.5) * 16;
      return [Math.round(P.lerp(A[0], B[0], a) + sw) + w[0], Math.round(P.lerp(A[1], B[1], a) - Math.sin(a * Math.PI) * 3) + w[1], 1, a > 0.5 ? B[2] : A[2]];
    }
    // collapse: a soft fall, lower pieces first
    const F = faces[5][p.i];
    const delay = p.h * 0.3 + P.sat((FC.y + 40 - F[1]) / 90) * 0.35;
    const tt = Math.max(0, t - TL.collapse[0] - delay);
    const x = F[0] + (F[0] - CX) * 0.35 * Math.min(tt, 0.9) + Math.sin(tt * 5 + p.ph) * 1.5 * Math.min(1, tt * 2);
    let y = F[1] + 95 * tt * tt + 6 * tt;
    const landed = y >= p.land;
    if (landed) y = p.land;
    if (t < TL.lantern[0] || p.keep) return [Math.round(x), Math.round(y), 1, 0, landed];
    // rise into the lantern
    const lx = F[0] + (F[0] - CX) * 0.35 * 0.9;
    const a = P.ease(P.prog(t, TL.lantern[0] + p.h2 * 0.45, TL.lantern[0] + 0.5 + p.h2 * 0.45));
    if (a >= 1) return null;
    if (a <= 0) return [Math.round(lx), p.land, 1, 0, true];
    const sw = Math.sin(a * Math.PI) * (p.h3 - 0.5) * 30;
    return [Math.round(P.lerp(lx, LPOS.x, a) + sw), Math.round(P.lerp(p.land, LPOS.y, a * a)), 1, 0, false, a];
  }
  function drawPart(b, p, q) {
    const x = q[0], y = q[1];
    if (q[4]) { // lying on the mirror floor: squashed + dim
      const gl = p.kind === 2 ? p.g2 : p.g3, c = L.dn1[p.c];
      for (let yy = 0, oy = 0; yy < gl.h; yy += 2, oy++) for (let xx = 0; xx < gl.w; xx++) if (gl.b[yy * gl.w + xx]) P.px(b, x + xx, y + oy, c);
      return;
    }
    if (q[5] !== undefined) { P.px(b, x, y, q[5] > 0.6 ? C.A6 : C.A5); if (q[5] < 0.6) P.px(b, x, y + 1, C.A3); return; }
    const loose = q[3];
    if (p.kind === 1) {
      if (loose) { P.px(b, x, y, C.A3); return; }
      if (p.name === 'lines') { P.px(b, x, y, p.c); P.px(b, x + 1, y, p.c); return; }
      P.rect(b, x, y, 2, 2, p.c); P.px(b, x + 1, y + 1, p.c === C.A7 ? C.A5 : C.A4);
    } else if (p.kind === 2) P.glyph(b, p.g2, x - 1, y - 1, loose ? C.A3 : p.c);
    else P.glyph(b, p.g3, x - 1, y - 2, loose ? L.dn1[p.c] : p.c);
  }

  function init() {
    if (built) return; built = true;
    S2.init(); buildGlass(); buildMirror(); buildFaces(); buildParts();
  }
  // lantern "regress" inside the glass: the reflection is many lanterns, receding to the far door
  function regress(b, t) {
    const n = 12, V2 = { x: 213, y: 78 };
    for (let i = n; i >= 1; i--) {
      const a = P.prog(t, TL.regress[0] + (i - 1) * 0.1, TL.regress[0] + (i - 1) * 0.1 + 0.3);
      if (a <= 0) continue;
      const k = 1 - Math.pow(0.775, i), bend = Math.sin(k * Math.PI) * 7;
      const x = P.lerp(LPOS.x, V2.x, k) - bend * 0.6, y = P.lerp(LPOS.y, V2.y, k) - bend;
      const s = i <= 2 ? 4 : i <= 4 ? 3 : i <= 7 ? 2 : i <= 9 ? 1 : 0;
      const bob = Math.round(Math.sin(t * 1.6 - i * 0.7) * (i < 5 ? 1 : 0));
      LAN.draw(b, Math.round(x), Math.round(y) + bob, s, { lit: a, glow: a * 0.5, noGlow: i > 2, clip: [GX0, GSP - GR, GX1, GB] });
    }
  }
  function render(b, t) {
    init();
    const u = 1.22 + (t - TL.s23[0]) * 0.016;
    S2.render(b, t, { u, noNear: true, dimLayers: true, moonDx: 44, moonDy: -4 });
    P.layer(b, mirRef, 0, 0);
    // glass
    P.layer(b, glass, 0, 0);
    if (t >= TL.regress[0]) regress(b, t);
    const lit = P.prog(t, TL.lantern[0] + 0.35, TL.lantern[1]);
    const lp = lanternPos(t);
    P.layer(b, mir, 0, 0);
    // light of the lantern on the frame and the floor (bands)
    if (lit > 0 && lp.s >= 3) {
      P.glow(b, CX, FLOOR + 3, [16, 30, 46], [L.warm3, L.warm2, L.warm1].slice(0, Math.max(1, Math.round(lit * 3))), { sq: 0.3, dw: 3 });
    }
    // the swarm
    if (t >= TL.gather[0]) {
      for (let pass = 0; pass < 3; pass++) for (const p of parts) {
        const order = p.name === 'halo' || p.name === 'hair' ? 0 : p.kind !== 1 ? 1 : 2;
        if (order !== pass) continue;
        const q = partPos(p, t); if (!q) continue;
        if (t < TL.faces[0] && q[2] <= 0) continue;
        drawPart(b, p, q);
      }
    }
    if (t >= TL.glassCity[0]) { // the reflections become windows: the glass opens on the city
      const B2 = g.S3._B || (g.S3._B = P.mk(W, H, 0));
      g.S4.render(B2, t);
      const lv = Math.round(16 * P.ease(P.prog(t, TL.glassCity[0], TL.glassCity[1])));
      const gr = t >= TL.mIris[0] ? grow(t) : 0;
      const x0 = Math.max(0, GX0 - gr), x1 = Math.min(W, GX1 + gr), y0 = Math.max(0, GSP - GR - gr), y1 = Math.min(H, GB + gr);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (P.bay(x, y) < lv && inShape(x, y, gr)) b.d[y * W + x] = B2.d[y * W + x];
      if (gr > 0) {
        const fx0 = Math.max(0, GX0 - gr - FT), fx1 = Math.min(W, GX1 + gr + FT), fy0 = Math.max(0, GSP - GR - gr - FT), fy1 = Math.min(H, GB + gr + FT);
        for (let y = fy0; y < fy1; y++) for (let x = fx0; x < fx1; x++) {
          const d = frameD(x, y, gr); if (d) b.d[y * W + x] = frameCol(x, y, d);
        }
      }
    }
    if (t >= TL.mIris[0] && grow(t) < 26) { // crest + plinth ride outward with the frame
      const gr = grow(t);
      P.blit(b, mir, 0, -gr, { sy: 0, sh: GSP - GR - FT + 2 }); P.blit(b, mir, 0, GB + FT - 1 + gr, { sy: GB + FT - 1, sh: 12 });
    }
    if (lit > 0 && lp.on) LAN.draw(b, lp.x, lp.y, lp.s, { lit: lit, glow: lit, noGlow: lp.s < 5 });
  }
  function grow(t) { const k = P.prog(t, TL.mIris[0], TL.mIris[1]); return Math.round(Math.pow(k, 2.2) * 330); }
  function lanternPos(t) {
    const hero = g.S4.HERO;
    const k = P.ease(P.prog(t, TL.mIris[0] - 0.2, TL.mIris[1] - 0.25));
    const bob = k > 0 ? 0 : Math.round(Math.sin(t * 1.6) * 1.4);
    const s = k < 0.3 ? 5 : k < 0.6 ? 4 : k < 0.85 ? 3 : 2;
    return { x: Math.round(P.lerp(LPOS.x, hero.x, k)), y: Math.round(P.lerp(LPOS.y, hero.y, k)) + bob, s, on: k < 1 };
  }
  g.S3 = { init, render, inShape };
})(typeof window !== 'undefined' ? window : globalThis);
