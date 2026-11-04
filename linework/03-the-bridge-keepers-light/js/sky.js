/* sky.js: stepped night sky, engraved sky rules, Milky Way stipple, stars, crescent moon. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P, L = LW.L;
  const N = new LW.Noise(301);
  const N2 = new LW.Noise(302);

  // Milky Way axis
  const MW_A = [430, 1500], MW_B = [1720, -60];
  const mwLen = Math.hypot(MW_B[0] - MW_A[0], MW_B[1] - MW_A[1]);
  const mwT = [(MW_B[0] - MW_A[0]) / mwLen, (MW_B[1] - MW_A[1]) / mwLen];
  const mwN = [-mwT[1], mwT[0]];
  LW.milky = function (x, y) {
    const dx = x - MW_A[0], dy = y - MW_A[1];
    const along = dx * mwT[0] + dy * mwT[1];
    let perp = dx * mwN[0] + dy * mwN[1];
    perp += N.fbm(along / 420, 3.3, 3) * 90;
    const w = 190 + 70 * N.fbm(along / 600, 9.1, 2);
    let m = Math.exp(-(perp * perp) / (w * w));
    const cloud = 0.55 + 0.45 * N.fbm(x / 150, y / 150, 4);
    const knots = Math.max(0, N2.fbm(x / 70, y / 70, 3)) * 0.6;
    m *= cloud + knots;
    // dark rift (dust lane) running along the band, slightly off-centre
    const rp = perp - 38 - 55 * N2.fbm(along / 260, 1.7, 3);
    const rift = Math.exp(-(rp * rp) / (34 * 34)) * LW.smooth(-0.3, 0.3, N2.fbm(along / 380, 7.7, 2));
    m *= 1 - 0.85 * rift;
    return { m: LW.clamp(m, 0, 1.4), rift };
  };

  function skyValue(x, y) {
    // 0 = darkest top, 1 = brightest glow low in the gorge
    let v = LW.smooth(-200, 2000, y) * 0.62;
    // glow in the far notch of the gorge
    const gx = x - 1160, gy = y - 1760;
    v += 0.38 * Math.exp(-(gx * gx) / (520 * 520) - (gy * gy) / (700 * 700));
    const mw = LW.milky(x, y);
    v += mw.m * 0.22;
    // moon halo steps
    const [mx, my, mr] = L.moon;
    const md = Math.hypot(x - mx, y - my);
    v += 0.16 * LW.smooth(420, 150, md) + 0.1 * LW.smooth(230, 120, md);
    return v;
  }
  LW.skyValue = skyValue;

  const pal = [P.sky0, P.sky1, P.sky2, P.sky3, P.sky4, P.sky5];
  function hash(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  LW.hash2 = hash;

  LW.drawSky = function (ctx, S) {
    const bbox = [0, 0, LW.W, 2300];
    const path = new Path2D();
    path.rect(0, 0, LW.W, 2300);
    LW.shadeFill(ctx, S, path, bbox, (x, y, out) => {
      let v = skyValue(x, y);
      // mezzotint dither at band edges: white-noise jitter per output pixel
      v += (hash(x * S, y * S) - 0.5) * 0.07 + N.n2(x / 23, y / 23) * 0.025;
      const t = LW.clamp(v, 0, 0.999);
      const c = pal[Math.floor(t * pal.length)];
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    }, [0, 0]);
  };

  // fine engraved rules across the darkest part of the sky
  LW.drawSkyRules = function (ctx, S) {
    const ink = new LW.Ink(311);
    ink.wobble = 0.6;
    const ci = ink.col(LW.mix(P.sky0, [0, 0, 0], 0.35));
    const ci2 = ink.col(LW.mix(P.sky1, P.sky0, 0.6));
    for (let y = 6; y < 1500; y += 8.5) {
      const pts = [];
      for (let x = 0; x <= LW.W; x += 12) pts.push([x, y + N.n2(x / 400, y / 90) * 5 + N2.n2(x / 90, y / 30) * 1.2]);
      ink.line(pts, (x, yy) => {
        const v = skyValue(x, yy);
        if (v > 0.36) return -1;
        const w = 1.3 * LW.smooth(0.38, 0.12, v) + 0.4;
        // gaps
        if (N.n2(x / 70, yy / 13) > 0.55) return -1;
        return ink.st(v < 0.22 ? ci : ci2, w);
      }, { taper: 30 });
    }
    // finer interleaved rules carried down through the brighter sky, one band darker than the ground
    const bandInk = pal.map((c, i) => ink.col(LW.mix(c, pal[Math.max(0, i - 1)], 0.75)));
    for (let y = 10.25; y < 2150; y += 8.5) {
      const pts = [];
      for (let x = 0; x <= LW.W; x += 12) pts.push([x, y + N.n2(x / 400, y / 90) * 5 + N2.n2(x / 90, y / 30) * 1.2]);
      ink.line(pts, (x, yy) => {
        const v = skyValue(x, yy);
        if (v < 0.3) return -1;
        if (N2.n2(x / 55, yy / 11) > 0.35 - 0.25 * LW.smooth(0.3, 0.75, v)) return -1;
        const t = LW.clamp(v, 0, 0.999);
        return ink.st(bandInk[Math.floor(t * pal.length)], 0.85);
      }, { taper: 26 });
    }
    ink.flush(ctx);
    LW.drawDustLanes(ctx, S);
  };

  // the Milky Way's dark rift drawn as broken engraved strokes running along the band
  LW.drawDustLanes = function (ctx, S) {
    const ink = new LW.Ink(331);
    ink.wobble = 0.5;
    const rng = new LW.RNG('dust');
    const cA = ink.col(LW.mix(P.sky1, P.sky0, 0.85)), cB = ink.col(LW.mix(P.sky2, P.sky1, 0.7));
    for (let along = 0; along < mwLen; along += 5) {
      const str = LW.smooth(-0.3, 0.3, N2.fbm(along / 380, 7.7, 2));
      if (str < 0.05) continue;
      const centre = 38 + 55 * N2.fbm(along / 260, 1.7, 3) - N.fbm(along / 420, 3.3, 3) * 90;
      const n = Math.round(str * 4.5);
      for (let k = 0; k < n; k++) {
        const off = centre + rng.gauss() * 17;
        const len = 60 + rng.next() * 190 * str;
        const pts = [];
        for (let t = 0; t <= len; t += 6) {
          const a = along + t;
          const pp = off + 3 * N.n2(a / 60, off / 30);
          pts.push([MW_A[0] + mwT[0] * a + mwN[0] * pp, MW_A[1] + mwT[1] * a + mwN[1] * pp]);
        }
        if (pts.length < 2) continue;
        const w = (0.45 + rng.next() * 0.55) * (0.6 + 0.6 * str);
        const ci = Math.abs(off - centre) < 14 ? cA : cB;
        ink.line(pts, (x, y) => (Math.hypot(x - L.moon[0], y - L.moon[1]) < L.moon[2] * 1.4 ? -1 : ink.st(ci, w)), { taper: len * 0.4, minScale: 0.2 });
      }
    }
    ink.flush(ctx);
  };

  LW.drawStars = function (ctx, S) {
    const rng = new LW.RNG('stars-03');
    const ctxS = ctx;
    const dots = []; // [x,y,r,color]
    const big = [];
    const [mx, my, mr] = L.moon;
    const cols = [P.star, P.star, P.star, P.starBlue, P.starBlue, P.starWarm];
    // main stars: jittered grid with clustered acceptance
    const g = 15;
    for (let y = 0; y < 2150; y += g) {
      for (let x = 0; x < LW.W; x += g) {
        const sx = x + rng.next() * g, sy = y + rng.next() * g;
        const mw = LW.milky(sx, sy);
        const clus = Math.max(0, N.fbm(sx / 260, sy / 260, 3)) * 0.22 + Math.max(0, N2.n2(sx / 55, sy / 55) - 0.45) * 0.5;
        const fade = LW.smooth(2150, 1500, sy); // fewer stars low in the glow
        const p = (0.075 + clus + mw.m * 0.28) * fade;
        if (rng.next() > p) continue;
        const md = Math.hypot(sx - mx, sy - my);
        if (md < mr * 1.45) continue;
        const u = rng.next();
        let r = 0.85 + 1.5 * u * u * u;
        if (rng.next() < 0.02) r += 1.2;
        const c = rng.pick(cols);
        dots.push([sx, sy, r, c]);
        if (r > 2.4 && rng.next() < 0.18 && md > 260) big.push([sx, sy, r, c]);
      }
    }
    // Milky Way micro-stipple
    const g2 = 4.4;
    for (let y = -40; y < 1700; y += g2) {
      for (let x = 300; x < 1900; x += g2) {
        const sx = x + rng.next() * g2, sy = y + rng.next() * g2;
        const mw = LW.milky(sx, sy);
        if (mw.m < 0.08) continue;
        const p = Math.pow(mw.m, 1.5) * 0.58;
        if (rng.next() > p) continue;
        if (Math.hypot(sx - mx, sy - my) < mr * 1.3) continue;
        dots.push([sx, sy, 0.42 + rng.next() * 0.5, rng.next() < 0.7 ? P.starBlue : P.star]);
      }
    }
    // bright knots: tight star clouds strung along the band
    {
      const kr = new LW.RNG('knots');
      for (let i = 0; i < 26; i++) {
        const a = 150 + kr.next() * (mwLen - 300);
        const pp = (kr.next() - 0.5) * 260;
        const kx = MW_A[0] + mwT[0] * a + mwN[0] * pp, ky = MW_A[1] + mwT[1] * a + mwN[1] * pp;
        const mw = LW.milky(kx, ky);
        if (mw.m < 0.35 || mw.rift > 0.4 || Math.hypot(kx - mx, ky - my) < mr * 3.6) continue;
        const R = 18 + kr.next() * 34;
        const cnt = Math.round(R * 2.2);
        for (let q = 0; q < cnt; q++) {
          const rr = Math.pow(kr.next(), 1.7) * R, aa = kr.next() * 6.283;
          dots.push([kx + Math.cos(aa) * rr * 1.5, ky + Math.sin(aa) * rr, 0.42 + kr.next() * 0.55 + (rr < R * 0.3 ? 0.25 : 0), kr.next() < 0.55 ? P.star : P.starBlue]);
        }
      }
    }
    // a few named-bright stars with glints
    const hero = [[880, 260, 4.4], [1460, 1060, 3.8], [1010, 1380, 3.2], [760, 820, 3.0], [1220, 160, 3.4], [1520, 300, 2.9], [930, 640, 2.7], [1300, 1450, 2.6]];
    for (const h of hero) big.push([h[0], h[1], h[2], P.star]);
    // draw (highlight plate slightly offset)
    ctxS.save();
    ctxS.translate(-0.8, 0.9);
    const byCol = new Map();
    for (const d of dots) {
      const k = LW.rgb(d[3]);
      if (!byCol.has(k)) byCol.set(k, []);
      byCol.get(k).push(d);
    }
    for (const [k, arr] of byCol) {
      ctxS.fillStyle = k;
      ctxS.beginPath();
      for (const d of arr) {
        // slightly irregular dots: little polygons
        const n = d[2] > 1.6 ? 7 : 5;
        const rot = (d[0] * 13.1 + d[1] * 7.7) % 6.28;
        for (let i = 0; i < n; i++) {
          const a = rot + (i / n) * Math.PI * 2;
          const rr = d[2] * (0.82 + 0.3 * LW.hash2(d[0] * 10 + i, d[1] * 10));
          const px = d[0] + Math.cos(a) * rr, py = d[1] + Math.sin(a) * rr;
          if (i === 0) ctxS.moveTo(px, py);
          else ctxS.lineTo(px, py);
        }
        ctxS.closePath();
      }
      ctxS.fill();
    }
    // glints
    ctxS.lineCap = 'round';
    for (const b of big) {
      const [x, y, r] = b;
      ctxS.strokeStyle = LW.rgb(b[3]);
      const L1 = r * 6.5, L2 = r * 3.2;
      for (const [ax, ay, len, w] of [[1, 0, L1, 0.9], [0, 1, L1 * 1.15, 0.9], [0.707, 0.707, L2, 0.6], [0.707, -0.707, L2, 0.6]]) {
        // tapered: draw in three widths
        for (let s = 0; s < 3; s++) {
          const f = (s + 1) / 3;
          ctxS.lineWidth = w * (1.6 - s * 0.5);
          ctxS.beginPath();
          ctxS.moveTo(x - ax * len * f, y - ay * len * f);
          ctxS.lineTo(x + ax * len * f, y + ay * len * f);
          ctxS.stroke();
        }
      }
      ctxS.fillStyle = LW.rgb(b[3]);
      ctxS.beginPath();
      ctxS.arc(x, y, r * 1.15, 0, Math.PI * 2);
      ctxS.fill();
      // tiny dark ring like an engraved star
      ctxS.strokeStyle = LW.rgb(LW.mix(P.sky0, P.sky1, 0.5), 0.0);
    }
    // star variety: small four-ray stars, ringed stars, doubles
    {
      const vr = new LW.RNG('star-variety');
      for (const d of dots) {
        if (d[2] < 1.55) continue;
        const u = vr.next();
        const [x, y, r] = d;
        if (Math.hypot(x - mx, y - my) < mr * 3.2) continue;
        ctxS.strokeStyle = LW.rgb(d[3]);
        if (u < 0.22) {
          const len = r * (3 + vr.next() * 2.5);
          ctxS.lineWidth = 0.7;
          ctxS.beginPath();
          ctxS.moveTo(x - len, y); ctxS.lineTo(x + len, y);
          ctxS.moveTo(x, y - len); ctxS.lineTo(x, y + len);
          ctxS.stroke();
        } else if (u < 0.255) {
          ctxS.lineWidth = 0.6;
          ctxS.beginPath();
          ctxS.arc(x, y, r + 1.6 + vr.next() * 0.8, 0, Math.PI * 2);
          ctxS.stroke();
        } else if (u < 0.42) {
          ctxS.fillStyle = LW.rgb(vr.next() < 0.5 ? P.starWarm : P.starBlue);
          const a = vr.next() * 6.283, dd = r * 2.6 + 2;
          ctxS.beginPath();
          ctxS.arc(x + Math.cos(a) * dd, y + Math.sin(a) * dd, r * 0.55, 0, Math.PI * 2);
          ctxS.fill();
        }
      }
    }
    ctxS.restore();
    LW.log('stars', dots.length, 'glints', big.length);
  };

  LW.drawMoon = function (ctx, S) {
    const [mx, my, r] = L.moon;
    const ink = new LW.Ink(321);
    ink.wobble = 0.4;
    // engraved halo rings (broken)
    const ringCol = ink.col(LW.mix(P.sky4, P.starBlue, 0.25));
    const ringCol2 = ink.col(LW.mix(P.sky3, P.sky5, 0.6));
    const rng = new LW.RNG('halo');
    for (let k = 0; k < 9; k++) {
      const rr = r * 1.32 + k * k * 3.1 + k * 9;
      const pts = [];
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.02) pts.push([mx + Math.cos(a) * rr, my + Math.sin(a) * rr]);
      const ph = rng.next() * 10;
      const w = 1.7 - k * 0.14;
      ink.line(pts, (x, y) => {
        const a = Math.atan2(y - my, x - mx);
        if (N.n2(a * 2.2 + ph, k) > 0.35 - k * 0.07) return -1;
        return ink.st(k < 4 ? ringCol : ringCol2, w);
      }, { taper: 26 });
    }
    ink.flush(ctx);

    // earthshine disc
    const disc = new Path2D();
    disc.arc(mx, my, r, 0, Math.PI * 2);
    // crescent: lit limb toward lower-right
    const off = [-r * 0.36, -r * 0.24];
    const cres = new Path2D();
    cres.arc(mx, my, r, 0, Math.PI * 2);
    const inner = new Path2D();
    inner.arc(mx + off[0], my + off[1], r * 0.97, 0, Math.PI * 2);
    const bb = [mx - r - 6, my - r - 6, mx + r + 6, my + r + 6];
    LW.shadeFill(ctx, S, disc, bb, (x, y, out) => {
      const dx = x - (mx + off[0]), dy = y - (my + off[1]);
      const inShadow = dx * dx + dy * dy < (r * 0.97) * (r * 0.97);
      let c;
      if (inShadow) c = P.moonDark;
      else {
        // depth across the crescent: inner edge (terminator) is greyer
        const dd = Math.sqrt(dx * dx + dy * dy) - r * 0.97;
        const t = dd + N.n2(x / 14, y / 14) * 3;
        c = t < 7 ? P.moonShade : P.moon;
        // maria
        if (N2.fbm(x / 38, y / 38, 3) > 0.32 && t > 9) c = LW.mix(P.moon, P.moonShade, 0.75);
      }
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    }, [0.6, -0.5]);
    // lines on the moon: earthshine hatching + crescent contour shading
    const ink2 = new LW.Ink(322);
    ink2.wobble = 0.35;
    const cDark = ink2.col(LW.mix(P.sky2, P.moonDark, 0.4));
    const cShade = ink2.col(LW.mix(P.moonShade, P.sky4, 0.55));
    for (let k = 0; k < 18; k++) {
      // arcs concentric with the shadow circle (follow terminator)
      const rr = r * 0.97 + 2 + k * 4.2;
      const pts = [];
      for (let a = 0; a <= Math.PI * 2; a += 0.015) pts.push([mx + off[0] + Math.cos(a) * rr, my + off[1] + Math.sin(a) * rr]);
      ink2.line(pts, (x, y) => {
        const d = Math.hypot(x - mx, y - my);
        if (d > r - 2.5) return -1;
        if (k > 2 && N.n2(x / 22 + k, y / 22) > 0.1 - k * 0.03) return -1;
        return ink2.st(cShade, Math.max(0.5, 1.35 - k * 0.07));
      }, { taper: 14 });
    }
    for (let y = my - r; y < my + r; y += 5.5) {
      const pts = [];
      for (let x = mx - r; x <= mx + r; x += 4) pts.push([x, y + N.n2(x / 40, y / 40) * 1.2]);
      ink2.line(pts, (x, yy) => {
        const d = Math.hypot(x - mx, yy - my);
        if (d > r - 3) return -1;
        const dx = x - (mx + off[0]), dy = yy - (my + off[1]);
        if (dx * dx + dy * dy > (r * 0.95) * (r * 0.95)) return -1;
        return ink2.st(cDark, 1.1);
      }, { taper: 6 });
    }
    // rim
    const cr = ink2.col(LW.mix(P.ink, P.sky1, 0.3));
    const rim = [];
    for (let a = 0; a <= Math.PI * 2 + 0.02; a += 0.02) rim.push([mx + Math.cos(a) * r, my + Math.sin(a) * r]);
    ink2.line(rim, (x, y) => {
      const lit = (x - mx) * 0.6 + (y - my) * 0.4 > 0;
      return ink2.st(cr, lit ? 1.8 : 1.1);
    }, { taper: 0 });
    ink2.flush(ctx);
    // ---- surface texture: maria stipple, craters on the crescent, earthshine on the dark disc
    const dots = new LW.Dots();
    const mr2 = new LW.RNG('moon-tex');
    const ink3 = new LW.Ink(323);
    ink3.wobble = 0.15;
    const inLit = (x, y) => {
      const dx = x - (mx + off[0]), dy = y - (my + off[1]);
      return Math.hypot(x - mx, y - my) < r - 2.5 && dx * dx + dy * dy > (r * 0.97 + 1.5) * (r * 0.97 + 1.5);
    };
    const mariaC = LW.rgb(LW.mix(P.moonShade, P.sky4, 0.45)), mariaC2 = LW.rgb(LW.mix(P.moonShade, P.moon, 0.3));
    const earthC = LW.rgb(LW.mix(P.moonDark, P.sky4, 0.55)), earthC2 = LW.rgb(LW.mix(P.moonDark, P.sky3, 0.6));
    for (let y = my - r; y < my + r; y += 2.6) {
      for (let x = mx - r; x < mx + r; x += 2.6) {
        const px = x + mr2.next() * 2.6, py = y + mr2.next() * 2.6;
        const u = mr2.next();
        if (Math.hypot(px - mx, py - my) > r - 3) continue;
        const m = N2.fbm(px / 38, py / 38, 3);
        if (inLit(px, py)) {
          if (u < LW.smooth(0.12, 0.45, m) * 0.6) dots.dot(px, py, 0.55 + mr2.next() * 0.5, mariaC);
          else if (u > 0.985) dots.dot(px, py, 0.6, mariaC2);
        } else {
          const dx = px - (mx + off[0]), dy = py - (my + off[1]);
          if (dx * dx + dy * dy > (r * 0.97) * (r * 0.97)) continue;
          // earthshine: highlands faintly lit, maria left dark
          if (u < LW.smooth(0.25, -0.15, m) * 0.18) dots.dot(px, py, 0.6 + mr2.next() * 0.4, mr2.next() < 0.5 ? earthC : earthC2);
        }
      }
    }
    // craters, foreshortened toward the limb, shadow inside the rim facing the sun
    const crC = ink3.col(LW.mix(P.moonShade, P.sky4, 0.6));
    const sunDir = [0.55, 0.83];
    for (let i = 0; i < 70; i++) {
      const a = mr2.next() * 6.283, rr = Math.sqrt(mr2.next()) * (r - 8);
      const x = mx + Math.cos(a) * rr, y = my + Math.sin(a) * rr;
      const lit = inLit(x, y);
      const cr0 = (1.6 + Math.pow(mr2.next(), 2.2) * 6.5);
      const q = Math.sqrt(Math.max(0.15, 1 - Math.pow(rr / r, 2)));
      const pts = [];
      for (let t = 0; t <= 6.35; t += 0.35) {
        const u = Math.cos(t) * cr0, v = Math.sin(t) * cr0;
        // squash along the radial direction
        const ux = Math.cos(a), uy = Math.sin(a);
        const pr = (u * ux + v * uy) * q, pt = -u * uy + v * ux;
        pts.push([x + pr * ux - pt * uy, y + pr * uy + pt * ux]);
      }
      if (lit) {
        ink3.line(pts, ink3.st(crC, 0.75), { taper: 0 });
        for (let k = 0; k < cr0 * 2.5; k++) {
          const t = Math.atan2(sunDir[1], sunDir[0]) + (mr2.next() - 0.5) * 2.2;
          const f = 0.45 + mr2.next() * 0.45;
          dots.dot(x + Math.cos(t) * cr0 * f * q, y + Math.sin(t) * cr0 * f, 0.5 + mr2.next() * 0.3, mariaC);
        }
      } else if (Math.hypot(x - mx, y - my) < r - 6 && mr2.next() < 0.5) {
        ink3.line(pts, ink3.st(ink3.col(LW.mix(P.moonDark, P.sky3, 0.5)), 0.7), { taper: 0 });
      }
    }
    ink3.flush(ctx);
    dots.flush(ctx);
  };
})();
