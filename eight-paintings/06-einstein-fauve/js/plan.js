// The painter's plan: regions, a modelled form for the head, and the Fauvist colour each plane takes.
(function (G) {
  'use strict';
  const PW = 1000, PH = 1250;
  const RG = { BG: 1, HAIR: 2, JACKET: 3, NECK: 4, CHEST: 5, COLL_L: 6, COLL_R: 7, EAR: 8, FACE: 9, MOUST: 10, BROW: 11, EYE: 12, LIP: 13 };
  const C = {
    lemonWhite: [1.0, 0.95, 0.70], warmWhite: [0.99, 0.95, 0.86], white: [0.97, 0.96, 0.93],
    lemon: [0.98, 0.90, 0.30], cadYellow: [0.99, 0.78, 0.13], cadOrange: [0.97, 0.52, 0.12], vermilion: [0.91, 0.24, 0.13],
    rose: [0.92, 0.42, 0.45], crimson: [0.70, 0.08, 0.22], pink: [0.98, 0.66, 0.62],
    emerald: [0.05, 0.60, 0.42], emeraldLt: [0.30, 0.74, 0.50], viridian: [0.0, 0.42, 0.36], sap: [0.45, 0.70, 0.22],
    turquoise: [0.12, 0.66, 0.66], cerulean: [0.25, 0.58, 0.85], cobalt: [0.10, 0.30, 0.78], ultramarine: [0.12, 0.13, 0.58],
    prussian: [0.04, 0.12, 0.30], violet: [0.45, 0.22, 0.62], lilac: [0.78, 0.68, 0.92], ink: [0.06, 0.05, 0.18],
    mint: [0.78, 0.94, 0.86], skyWhite: [0.84, 0.92, 0.98], pinkWhite: [1.0, 0.86, 0.84],
  };
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function distPoly(px, py, pl) { let m = 1e9; for (let i = 1; i < pl.length; i++) { const d = distSeg(px, py, pl[i - 1][0], pl[i - 1][1], pl[i][0], pl[i][1]); if (d < m) m = d; } return m; }

  function buildPlan() {
    const F = G.Face, Geo = G.Geom;
    const reg = new Uint8Array(PW * PH);
    reg.fill(RG.BG);
    const R = (poly, v) => Geo.rasterPoly(reg, PW, PH, 1, poly, v);
    R(F.hairSil, RG.HAIR);
    R(F.jacket, RG.JACKET);
    R(F.neck, RG.NECK);
    R(F.chest, RG.CHEST);
    R(F.collarL, RG.COLL_L); R(F.collarR, RG.COLL_R);
    R(F.earL, RG.EAR); R(F.earR, RG.EAR);
    R(F.face, RG.FACE);
    R(F.browL, RG.BROW); R(F.browR, RG.BROW);
    R(F.eyeL.almond, RG.EYE); R(F.eyeR.almond, RG.EYE);
    R(F.lowerLip, RG.LIP);
    R(F.moustache, RG.MOUST);

    // ---------- modelled form of the head (height field) ----------
    const Hh = new Float32Array(PW * PH);
    const feats = [];
    const g = (cx, cy, sx, sy, a) => feats.push({ k: 0, c: F.T([cx, cy]), sx, sy, a });
    const ln = (pl, w, a) => feats.push({ k: 1, pl, w, a });
    g(415, 375, 120, 80, 14); g(585, 380, 110, 80, 8);
    g(408, 488, 48, 15, 9); g(560, 487, 48, 15, 8); g(482, 494, 18, 18, 5);
    g(405, 527, 40, 25, -16); g(560, 527, 42, 25, -16);
    g(406, 530, 28, 13, 8); g(560, 530, 30, 13, 8);
    g(404, 559, 34, 9, 4.5); g(560, 560, 34, 9, 4.5); g(400, 578, 36, 9, 3.5); g(562, 580, 36, 9, 3.5);
    g(352, 590, 38, 40, 9); g(628, 595, 38, 40, 9);
    g(372, 655, 40, 45, 6); g(612, 660, 40, 45, 6);
    ln(F.noseRidge, 15, 26);
    g(468, 624, 25, 23, 13); g(438, 637, 16, 14, 8); g(507, 639, 17, 14, 8);
    g(478, 700, 95, 55, 11);
    g(480, 690, 80, 28, 7); // moustache volume
    g(480, 745, 42, 11, 5); g(480, 768, 40, 7, -4);
    g(488, 808, 42, 30, 12);
    g(368, 765, 30, 34, 6); g(597, 770, 30, 34, 6);
    g(330, 455, 26, 40, -6); g(675, 455, 26, 40, -7);
    ln(F.nlL, 5, -7); ln(F.nlR, 5, -7);
    ln(F.chinCrease, 6, -3); ln(F.jowlL, 7, -3); ln(F.jowlR, 7, -3);
    const head = { c: F.T([462, 560]), rxL: 200, rxR: 262, ry: 330 };
    const neckC = F.T([500, 860]);
    for (let y = 230; y < 1010; y++) {
      for (let x = 240; x < 780; x++) {
        const i = y * PW + x; const r = reg[i];
        if (!(r === RG.FACE || r === RG.EAR || r === RG.NECK || r === RG.MOUST || r === RG.BROW || r === RG.EYE || r === RG.LIP || r === RG.CHEST)) continue;
        let h;
        if (r === RG.NECK || r === RG.CHEST) {
          const dx = (x - neckC[0]) / 120; h = 60 * Math.sqrt(Math.max(0, 1 - dx * dx)) - 30;
        } else {
          const dx = (x - head.c[0]) / (x < head.c[0] ? head.rxL : head.rxR), dy = (y - head.c[1]) / head.ry;
          const q = dx * dx + dy * dy * 0.9; h = 200 * Math.pow(Math.max(0.0, 1 - q * q), 0.4);
        }
        if (r !== RG.NECK && r !== RG.CHEST) {
          for (const f of feats) {
            if (f.k === 0) {
              const ex = (x - f.c[0]) / f.sx, ey = (y - f.c[1]) / f.sy; const q = ex * ex + ey * ey; if (q < 9) h += f.a * Math.exp(-q * 0.5);
            } else {
              const d = distPoly(x, y, f.pl); if (d < f.w * 3) h += f.a * Math.exp(-(d * d) / (2 * f.w * f.w));
            }
          }
        }
        if (r === RG.EAR) h += 10;
        Hh[i] = h;
      }
    }
    // blur height a little
    const Hb = new Float32Array(PW * PH);
    const rad = 6;
    for (let pass = 0; pass < 4; pass++) {
      const src = pass ? Hb.slice() : Hh, dst = Hb;
      for (let y = 230; y < 1010; y++) for (let x = 240; x < 780; x++) {
        const i = y * PW + x; if (!src[i]) { dst[i] = 0; continue; }
        let s = 0, n = 0;
        for (let k = -rad; k <= rad; k++) {
          const j = (pass & 1) ? i + k * PW : i + k;
          if (src[j]) { s += src[j]; n++; }
        }
        dst[i] = s / n;
      }
    }
    // light and colour
    const L = [-0.60, -0.36, 0.72]; const lnn = Math.hypot(...L); L[0] /= lnn; L[1] /= lnn; L[2] /= lnn;
    const lum = new Float32Array(PW * PH);
    const col = new Float32Array(PW * PH * 3);
    const band = new Uint8Array(PW * PH);
    const nz = G.Noise(991);
    const cheekL = F.T([372, 618]), cheekR = F.T([622, 625]), noseT = F.T([468, 622]);
    for (let y = 231; y < 1009; y++) for (let x = 241; x < 779; x++) {
      const i = y * PW + x; if (!Hb[i]) continue;
      const hx = (Hb[i + 1] && Hb[i - 1]) ? (Hb[i + 1] - Hb[i - 1]) * 0.5 : 0;
      const hy = (Hb[i + PW] && Hb[i - PW]) ? (Hb[i + PW] - Hb[i - PW]) * 0.5 : 0;
      const nl = 1 / Math.hypot(hx, hy, 1);
      let l = (-hx * L[0] - hy * L[1] + L[2]) * nl;
      l += 0.02 * nz.fbm(x / 90, y / 90, 2);
      lum[i] = l;
      const r = reg[i];
      let c, bd;
      const lowF = smooth(560, 720, y); // lower face runs warmer
      if (l > 0.93 && x > 345) { c = mix(C.lemonWhite, C.pinkWhite, lowF); bd = 5; }
      else if (l > 0.83) { c = mix(C.lemon, C.cadYellow, lowF); bd = 4; }
      else if (l > 0.65) { c = mix(C.cadYellow, C.cadOrange, 0.25 + 0.75 * lowF); bd = 3; }
      else if (l > 0.55) { c = mix(C.vermilion, C.rose, 0.3); bd = 2; }
      else if (l > 0.36) { c = mix(C.emerald, C.viridian, 0.45); bd = 1; }
      else { c = mix(C.viridian, C.ultramarine, 0.35); bd = 0; }
      // local colour: hot cheeks, nose, ears; shadow side cools
      const dc1 = Math.hypot(x - cheekL[0], y - cheekL[1]), dc2 = Math.hypot(x - cheekR[0], y - cheekR[1]);
      if (bd >= 2 && bd <= 4) { const t = Math.max(0, 1 - dc1 / 70); c = mix(c, bd >= 3 ? C.vermilion : C.rose, t * 0.75); }
      if (bd >= 2) { const t = Math.max(0, 1 - Math.hypot(x - noseT[0], y - noseT[1]) / 30); c = mix(c, C.rose, t * 0.5); }
      if (bd <= 1) { const t = Math.max(0, 1 - dc2 / 55); c = mix(c, C.violet, t * 0.55); }
      if (bd <= 1 && r !== RG.NECK && r !== RG.CHEST) { const t = smooth(630, 720, y); c = mix(c, bd === 0 ? mix(C.crimson, C.rose, 0.45) : mix(C.rose, C.cadOrange, 0.4), t * 0.92); }
      if (r === RG.EAR) { c = bd >= 3 ? C.cadOrange : (bd >= 2 ? C.vermilion : C.crimson); }
      if (r === RG.NECK || r === RG.CHEST) {
        if (r === RG.NECK && y < 846 + (x - 400) * 0.12) { c = x > 470 ? mix(C.violet, C.crimson, 0.4) : mix(C.cobalt, C.violet, 0.5); bd = 0; }
        else if (bd <= 1) { c = C.cobalt; } else if (bd <= 3) { c = C.vermilion; } else c = C.cadOrange;
      }
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      band[i] = bd;
    }
    // form-following direction for face strokes: along the height contours (perpendicular to slope)
    const ang = new Float32Array(PW * PH);
    for (let y = 231; y < 1009; y++) for (let x = 241; x < 779; x++) {
      const i = y * PW + x; if (!Hb[i]) continue;
      const hx = (Hb[i + 2] || Hb[i]) - (Hb[i - 2] || Hb[i]);
      const hy = (Hb[i + 2 * PW] || Hb[i]) - (Hb[i - 2 * PW] || Hb[i]);
      ang[i] = Math.atan2(hy, hx) + Math.PI / 2;
    }
    // smooth the direction field on the doubled circle so strokes sweep across forms instead of ringing them
    {
      const vx = new Float32Array(PW * PH), vy = new Float32Array(PW * PH);
      for (let i = 0; i < PW * PH; i++) if (Hb[i]) { vx[i] = Math.cos(2 * ang[i]); vy[i] = Math.sin(2 * ang[i]); }
      const R = 14;
      for (let pass = 0; pass < 2; pass++) {
        const sx = vx.slice(), sy = vy.slice();
        for (let y = 231; y < 1009; y++) for (let x = 241; x < 779; x++) {
          const i = y * PW + x; if (!Hb[i]) continue;
          let ax = 0, ay = 0;
          for (let k = -R; k <= R; k += 2) { const j = pass ? i + k * PW : i + k; if (Hb[j]) { ax += sx[j]; ay += sy[j]; } }
          vx[i] = ax; vy[i] = ay;
        }
      }
      for (let i = 0; i < PW * PH; i++) if (Hb[i]) ang[i] = 0.5 * Math.atan2(vy[i], vx[i]);
    }
    return { PW, PH, reg, Hh: Hb, lum, col, band, ang, RG, C, mix };
  }
  G.buildPlan = buildPlan;
  G.PlanUtil = { mix, clamp, smooth, distPoly, RG };
})(window);
