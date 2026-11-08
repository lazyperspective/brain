// squeegee.js — large horizontal pulls of a loaded rubber blade across the (partly wet) realist painting.
// Per blade cell we carry a paint load (amount + colour). At each step the blade level rests on the dry
// peaks (a stiff blade: max-plus envelope), scrapes wet paint standing above it into the load, and lets its
// bead fill the gap below it when the bead can reach. Skips, ridges, smears, chatter and drips emerge.
(function () {
  'use strict';
  const N = P8.noise, FB = P8.fbm, SM = P8.smooth, CL = P8.clamp, mixKM = P8.mixKM;

  P8.squeegee = function (pt, sc, W, H, seed, log, passesOverride) {
    const S = W / 2160, n = W * H, R = P8.rng(seed);
    const C = pt.C, Hh = pt.Hh;
    // layered state: dry under-colour Cd (the realist painting), dry height D, wet film Ws with colour Cw
    const Cd = P8.copyImg(C), D = new Float32Array(n), Ws = pt.Hw.slice(), Cw = P8.copyImg(C);
    for (let i = 0; i < n; i++) { Ws[i] *= 0.15; D[i] = Hh[i] - Ws[i]; }
    const fresh = new Float32Array(n); // squeegee paint amount (for gloss)
    const TAU = 0.07;
    const Dsm = D.slice(); P8.blur(Dsm, W, H, 4 * S, 4 * S);
    const Deff = new Float32Array(n); for (let i = 0; i < n; i++) Deff[i] = 0.85 * Dsm[i] + 0.15 * D[i];

    function palette(name) {
      const P = {
        red: [[0.60, 0.04, 0.03], [0.34, 0.012, 0.035], [0.74, 0.14, 0.04], [0.55, 0.03, 0.14], [0.62, 0.05, 0.035], [0.05, 0.04, 0.07], [0.10, 0.2, 0.5]],
        white: [[0.86, 0.85, 0.80], [0.80, 0.72, 0.18], [0.34, 0.58, 0.72], [0.9, 0.88, 0.84], [0.62, 0.62, 0.6], [0.75, 0.3, 0.42]],
        green: [[0.02, 0.10, 0.08], [0.82, 0.82, 0.78], [0.55, 0.05, 0.30], [0.05, 0.22, 0.30], [0.03, 0.03, 0.04], [0.85, 0.62, 0.12]],
        pale: [[0.84, 0.84, 0.80], [0.66, 0.70, 0.72], [0.36, 0.56, 0.68], [0.86, 0.80, 0.42], [0.88, 0.86, 0.82], [0.72, 0.52, 0.56], [0.22, 0.25, 0.3]],
        deep: [[0.03, 0.035, 0.09], [0.06, 0.09, 0.32], [0.18, 0.03, 0.22], [0.02, 0.02, 0.025], [0.10, 0.22, 0.42], [0.55, 0.05, 0.10]],
        grey: [[0.7, 0.7, 0.68], [0.12, 0.12, 0.13], [0.45, 0.47, 0.5], [0.85, 0.82, 0.76]]
      };
      return P[name];
    }

    // place wet paint blobs on the canvas in a pull's path (the painter's dabs before pulling)
    function blob(x, y, rx, ry, col, amt) {
      const x0 = Math.max(0, Math.floor(x - rx)), x1 = Math.min(W - 1, Math.ceil(x + rx));
      const y0 = Math.max(0, Math.floor(y - ry)), y1 = Math.min(H - 1, Math.ceil(y + ry));
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx - x) / rx, dy = (yy - y) / ry, d = dx * dx + dy * dy + 0.25 * N(xx / (6 * S), yy / (6 * S), 41);
        if (d > 1) continue;
        const i = yy * W + xx, a = amt * (1 - d);
        Cw.r[i] += (col[0] - Cw.r[i]) * Math.min(1, a / (Ws[i] + a)); Cw.g[i] += (col[1] - Cw.g[i]) * Math.min(1, a / (Ws[i] + a)); Cw.b[i] += (col[2] - Cw.b[i]) * Math.min(1, a / (Ws[i] + a));
        Ws[i] += a; fresh[i] += a;
      }
    }

    // one pull. p: {x0,x1,y0,Lb,pal,load,gap,press,lifts,seed,endRidge,blobs}
    function pull(p) {
      const r = P8.rng(p.seed);
      const Lb = Math.round(p.Lb * S), y0 = Math.round(p.y0 * S);
      const dir = p.x1 > p.x0 ? 1 : -1;
      const xs = Math.round(p.x0 * S), xe = Math.round(p.x1 * S);
      const pal = palette(p.pal);
      // load profile along the blade: broad colour zones blending into each other, a few soft streaks
      const A = new Float32Array(Lb), Lr = new Float32Array(Lb), Lg = new Float32Array(Lb), Lbb = new Float32Array(Lb);
      const knots = [];
      for (let v = -40 * S; v < Lb + 300 * S; v += (p.bandMin + r() * (p.bandMax - p.bandMin)) * S) {
        knots.push({ v: v, c: pal[(r() * pal.length) | 0], a: (0.45 + 0.8 * r()) * p.load * S, tw: (6 + r() * 50) * S });
      }
      let kn = 0;
      for (let v = 0; v < Lb; v++) {
        while (kn < knots.length - 2 && knots[kn + 1].v <= v) kn++;
        const k0 = knots[kn], k1 = knots[kn + 1];
        const t = SM(k1.v - k1.tw, k1.v + k1.tw * 0.2, v);
        Lr[v] = mixKM(k0.c[0], k1.c[0], t); Lg[v] = mixKM(k0.c[1], k1.c[1], t); Lbb[v] = mixKM(k0.c[2], k1.c[2], t);
        A[v] = k0.a + (k1.a - k0.a) * t;
        const jv = 1 + 0.035 * N(v / (2.3 * S), 1, p.seed + 3) + 0.025 * N(v / (11 * S), 2, p.seed + 4);
        Lr[v] = CL(Lr[v] * jv, 0, 0.95); Lg[v] = CL(Lg[v] * jv, 0, 0.95); Lbb[v] = CL(Lbb[v] * jv, 0, 0.95);
      }
      for (let k = 0; k < p.streaks; k++) {
        const c = pal[(r() * pal.length) | 0], vv = r() * Lb, w = (2 + r() * 9) * S, st = 0.35 + 0.5 * r();
        for (let j = Math.max(0, Math.floor(vv - w)); j < Math.min(Lb, Math.ceil(vv + w)); j++) {
          const t = st * SM(w, w * 0.4, Math.abs(j - vv));
          Lr[j] = mixKM(Lr[j], c[0], t); Lg[j] = mixKM(Lg[j], c[1], t); Lbb[j] = mixKM(Lbb[j], c[2], t);
        }
      }
      // blade geometry: bow (ends lift), nicks (fine grooves/raised lines), micro roughness
      const bow = new Float32Array(Lb), nick = new Float32Array(Lb);
      for (let j = 0; j < Lb; j++) {
        const t = Math.abs(2 * j / (Lb - 1) - 1);
        bow[j] = p.endLift * Math.pow(t, 5);
        nick[j] = 0.05 * N(j / (1.7 * S), p.seed % 97, 7) + 0.04 * N(j / (9 * S), 3, 8);
      }
      for (let k = 0; k < p.nicks; k++) { const j = (r() * Lb) | 0, w = 1 + ((r() * 3 * S) | 0), a = (r() < 0.5 ? -1 : 1) * (0.15 + 0.4 * r()); for (let q = j; q < Math.min(Lb, j + w); q++) nick[q] += a; }
      // dabs placed in the path
      for (let k = 0; k < (p.blobs || 0); k++) {
        const bx = (Math.min(p.x0, p.x1) + r() * Math.abs(p.x1 - p.x0) * 0.85) * S, by = y0 + (0.05 + 0.9 * r()) * Lb;
        blob(bx, by, (20 + r() * 50) * S, (6 + r() * 22) * S, pal[(r() * pal.length) | 0], 1.5 + r() * 2.5);
      }
      // pressure / gap along the pull, lifts and chatter
      const len = Math.abs(xe - xs);
      const gap = new Float32Array(len + 1), tilt = new Float32Array(len + 1);
      for (let k = 0; k <= len; k++) {
        const u = k / S;
        gap[k] = p.gap + p.press * FB(u / 260, p.seed % 31, 3, 11) + 0.06 * Math.max(0, Math.sin(u / (p.chatter || 23) * 6.283)) * (0.5 + 0.5 * N(u / 90, 1, 12));
        tilt[k] = p.tilt * FB(u / 400, 5, 2, 13);
      }
      const lifts = (p.lifts || []).map(function (lf, q) {
        return { c: lf[0] * S, w: lf[1] * S, a: lf[2], skew: (r() - 0.5) * 0.5, sd: p.seed + 200 + q };
      });
      const drag = [];
      for (let q = 0; q < (p.drags || 60); q++) {
        const j0 = (r() * Lb) | 0, h = 1 + ((r() * 3 * S) | 0), k0 = (r() * Math.abs(xe - xs)) | 0, k1 = k0 + ((40 + Math.pow(r(), 2) * 700) * S | 0), f = r() < 0.75 ? 0.05 * r() : 0.5;
        for (let jj = j0; jj < Math.min(Lb, j0 + h); jj++) { (drag[jj] = drag[jj] || []).push([k0, k1, f]); }
      }
      const endJ = new Float32Array(Lb);
      for (let j = 0; j < Lb; j++) endJ[j] = p.endRidge ? Math.max(0, (p.endJit || 70) * S * (0.5 + 0.9 * FB(j / (130 * S), 3.3, 3, p.seed + 81)) + 2.5 * S * N(j / (9 * S), 1, p.seed + 82)) : 0;
      const env = new Float32Array(Lb), Dcol = new Float32Array(Lb);
      const kb = p.stiff || 0.16;
      const yTop0 = y0; let yLast = y0;
      for (let k = 0; k <= len; k++) {
        const x = xs + dir * k;
        if (x < 0 || x >= W) continue;
        // blade envelope over dry peaks (max-plus with linear falloff = finite stiffness)
        const yTop = yTop0 + Math.round((p.drift || 10) * S * FB(k / S / 520, 4.4, 3, p.seed + 95) * 2);
        yLast = yTop;
        for (let j = 0; j < Lb; j++) { const y = yTop + j; Dcol[j] = (y >= 0 && y < H) ? Dsm[y * W + x] : 0; }
        let m = -1e9; for (let j = 0; j < Lb; j++) { m = Math.max(m - kb, Dcol[j]); env[j] = m; }
        m = -1e9; for (let j = Lb - 1; j >= 0; j--) { m = Math.max(m - kb, Dcol[j]); env[j] = Math.max(env[j], m); }
        const g = gap[k], tl = tilt[k];
        const u = k / S;
        const cov = CL(p.cov[0] + (p.cov[1] - p.cov[0]) * k / len + 0.22 * FB(u / 320, 9.1, 3, p.seed + 91), 0, 1);
        const thr = -0.42 + 0.84 * cov;
        const jT = Math.max(0, (p.edge || 14) * S * (0.5 + 1.2 * FB(u / 110, 1.5, 4, p.seed + 61))), jB = Math.max(0, (p.edge || 14) * S * (0.5 + 1.2 * FB(u / 110, 7.5, 4, p.seed + 62)));
        for (let j = 0; j < Lb; j++) {
          const y = yTop + j; if (y < 0 || y >= H) continue;
          if (j < jT || j > Lb - 1 - jB) continue;
          if (k > len - endJ[j]) continue;
          const i = y * W + x;
          let lift = 0;
          for (let q = 0; q < lifts.length; q++) {
            const lf = lifts[q], cc = lf.c + lf.skew * (j - Lb * 0.5) + 28 * S * N(j / (45 * S), q, lf.sd);
            const t = Math.abs(k - cc) / lf.w; if (t < 1.4) lift += lf.a * SM(1.3, 0.75, t) * (0.6 + 0.6 * N(j / (90 * S), q + 7, lf.sd));
          }
          const Lv = env[j] + g + bow[j] + nick[j] + tl * (j / Lb - 0.5) + p.float * A[j] / S + Math.max(0, lift);
          let ws = Ws[i];
          const top = Deff[i] + ws;
          if (top > Lv && ws > 0) { // scrape wet paint standing above the blade into the load
            const rm = Math.min(ws, (top - Lv) * 0.93);
            const t = rm / (A[j] + rm + 1e-6);
            const tp = t * (p.tint || 0.35); Lr[j] += (Cw.r[i] - Lr[j]) * tp; Lg[j] += (Cw.g[i] - Lg[j]) * tp; Lbb[j] += (Cw.b[i] - Lbb[j]) * tp;
            A[j] += rm; ws -= rm;
          }
          // viscous fingering / rips: lacy, horizontally drawn-out, more of them as the pull runs out
          const wu = u + 40 * N(u / 300, y / (60 * S), p.seed + 70);
          const sf = 0.75 * FB(wu / 230, y / (14 * S), 4, p.seed + 71) + 0.35 * FB(wu / 520, y / (45 * S), 2, p.seed + 74) + 0.04 * N(wu / 60, y / (2.0 * S), p.seed + 72);
          let fing = SM(-0.025, 0.03, thr - sf) * (0.8 + 0.2 * SM(-0.3, 0.3, N(u / 26, y / (1.1 * S), p.seed + 73)));
          if (drag[j] !== undefined) { const dd = drag[j]; for (let q = 0; q < dd.length; q++) if (k >= dd[q][0] && k < dd[q][1]) fing *= dd[q][2]; }
          const reach = p.bead * A[j] / S;
          const gp = Lv - (Deff[i] + ws);
          if (gp < reach && A[j] > 0) {
            const wsPre = ws;
            const te0 = fing;
            if (ws > 0) { // the moving bead shears the top of the wet layer along (drag / smear)
              const sh = ws * (p.shear || 0.2) * te0;
              const t0 = sh / (A[j] + sh + 1e-6);
              const tp = t0 * (p.tint || 0.35); Lr[j] += (Cw.r[i] - Lr[j]) * tp; Lg[j] += (Cw.g[i] - Lg[j]) * tp; Lbb[j] += (Cw.b[i] - Lbb[j]) * tp;
              A[j] += sh; ws -= sh;
            }
            const gp2 = Math.max(0, Lv - (Deff[i] + ws));
            const gpR = Math.max(0, Lv - (D[i] + ws)); // fill the real (weave) valleys -> smooth skin
            const te = fing * SM(reach, reach * 0.45, gp2);
            const tm = CL(0.7 + 0.5 * FB(u / 380, y / (1.8 * S), 3, p.seed + 101) + 0.15 * N(u / 90, y / (0.8 * S), p.seed + 102), 0.15, 1.4);
            const dep = Math.min((gpR * 0.95 + (p.skin || 0.12) * tm * 1.6) * te, A[j] * p.rate);
            // incomplete mixing of the bead with the paint it drags: marbled, striated
            const mu = (p.marble || 0.45) * SM(0.05, 0.5, wsPre) * SM(-0.15, 0.45, FB(u / 300, y / (4 * S), 3, p.seed + 111) + 0.15 * N(u / 60, y / (1.2 * S), p.seed + 112));
            const cr = mixKM(Lr[j], Cw.r[i], mu), cg = mixKM(Lg[j], Cw.g[i], mu), cb = mixKM(Lbb[j], Cw.b[i], mu);
            const t = te * dep / (ws * 0.1 + dep + 1e-6);
            Cw.r[i] += (cr - Cw.r[i]) * t; Cw.g[i] += (cg - Cw.g[i]) * t; Cw.b[i] += (cb - Cw.b[i]) * t;
            const rb = (p.ripRidge || 0.5) * 4 * fing * (1 - fing) * te;
            if (P8.DBG && y === P8.DBG.y && (k % 25) === 0) P8.DBG.out.push([k, +Lv.toFixed(2), +Deff[i].toFixed(2), +ws.toFixed(2), +gp2.toFixed(2), +reach.toFixed(2), +fing.toFixed(2), +te.toFixed(2), +dep.toFixed(2), +A[j].toFixed(0), [Lr[j], Lg[j], Lbb[j]].map(v => +v.toFixed(2)).join('/')]);
            ws += dep + rb; A[j] -= dep + rb; fresh[i] += dep + rb;
          }
          Ws[i] = ws;
        }
        // paint bead flows a little along the blade
        for (let j = 1; j < Lb - 1; j++) A[j] += 0.06 * (A[j - 1] + A[j + 1] - 2 * A[j]);
        // squeezed-out paint at the blade ends forms thin ridges along the band edges
        if ((k & 3) === 0) {
          [[Math.min(Lb - 1, Math.ceil(jT)), -1], [Math.max(0, Math.floor(Lb - 1 - jB)), 1]].forEach(function (e) {
            const j = e[0], a = A[j] * 0.006 * Math.max(0, N(k / (55 * S), j, 21) - 0.15);
            if (a <= 0) return;
            for (let q = 1; q <= 3; q++) {
              const y = yTop + j + e[1] * q; if (y < 0 || y >= H) continue;
              for (let dx = 0; dx < 4; dx++) {
                const xx = x + dir * dx; if (xx < 0 || xx >= W) continue;
                const i = y * W + xx, aa = a * (1 - q / 4);
                Cw.r[i] += (Lr[j] - Cw.r[i]) * Math.min(1, aa / (Ws[i] + aa)); Cw.g[i] += (Lg[j] - Cw.g[i]) * Math.min(1, aa / (Ws[i] + aa)); Cw.b[i] += (Lbb[j] - Cw.b[i]) * Math.min(1, aa / (Ws[i] + aa));
                Ws[i] += aa; fresh[i] += aa;
              }
            }
            A[j] *= 0.995;
          });
        }
      }
      // end of the pull: the blade lifts and leaves the remaining bead as a ragged ridge
      if (p.endRidge && xe >= 0 && xe < W) {
        for (let j = 0; j < Lb; j++) {
          const y = yLast + j; if (y < 0 || y >= H) continue;
          const amt = A[j] * 0.08 * (0.6 + 0.8 * Math.max(0, N(j / (14 * S), 9, 31)));
          const wd = (4 + 10 * Math.max(0, N(j / (30 * S), 2, 32)) + 3 * N(j / (4 * S), 3, 33)) * S;
          const xr = Math.round(xe - dir * endJ[j]);
          for (let q = 0; q < wd + 2; q++) {
            const x = xr + dir * q; if (x < 0 || x >= W) continue;
            const i = y * W + x, a = amt * SM(wd + 1, wd * 0.3, q) / Math.max(1, wd * 0.5);
            Cw.r[i] += (Lr[j] - Cw.r[i]) * Math.min(1, a / (Ws[i] * 0.3 + a + 1e-6)); Cw.g[i] += (Lg[j] - Cw.g[i]) * Math.min(1, a / (Ws[i] * 0.3 + a + 1e-6)); Cw.b[i] += (Lbb[j] - Cw.b[i]) * Math.min(1, a / (Ws[i] * 0.3 + a + 1e-6));
            Ws[i] += a; fresh[i] += a;
          }
        }
      }
    }

    // drips: run down from thick fresh paint at a band's lower edge
    function drips(yEdge, xa, xb, count, sd) {
      const r = P8.rng(sd);
      for (let k = 0; k < count; k++) {
        let x = (xa + r() * (xb - xa)) * S;
        let y = yEdge * S + (r() * 10 - 6) * S;
        const i0 = CL(y | 0, 0, H - 1) * W + CL(x | 0, 0, W - 1);
        if (fresh[i0] < 0.5) continue;
        const col = [Cw.r[i0], Cw.g[i0], Cw.b[i0]];
        const L = (50 + Math.pow(r(), 1.7) * 330) * S, w0 = (2.2 + r() * 3.0) * S;
        for (let s = 0; s < L; s += 0.5) {
          const t = s / L;
          const w = w0 * (1 - 0.45 * t) + (t > 0.93 ? w0 * 0.9 * SM(0.93, 0.985, t) * SM(1.0, 0.985, t) * 2 : 0);
          x += 0.06 * N(s / (25 * S), k, 51);
          const yy = (y + s) | 0; if (yy >= H) break;
          for (let dx = -Math.ceil(w) - 1; dx <= Math.ceil(w) + 1; dx++) {
            const xx = (x + dx) | 0; if (xx < 0 || xx >= W) continue;
            const d = Math.abs(xx + 0.5 - x) / Math.max(0.5, w); if (d > 1) continue;
            const i = yy * W + xx, a = 1.2 * Math.sqrt(1 - d * d) * (0.9 + 0.8 * SM(0.9, 1, t));
            const tt = a / (Ws[i] * 0.2 + a);
            Cw.r[i] += (col[0] - Cw.r[i]) * Math.min(1, tt); Cw.g[i] += (col[1] - Cw.g[i]) * Math.min(1, tt); Cw.b[i] += (col[2] - Cw.b[i]) * Math.min(1, tt);
            Ws[i] += a * 0.5; fresh[i] += a * 0.5;
          }
        }
      }
    }

    const passes = passesOverride || P8.PASSES;
    passes.forEach(function (p, k) {
      if (p.drips) drips(p.drips[0], p.drips[1], p.drips[2], p.drips[3], seed + 100 + k);
      else pull(p);
      log && log('pass ' + k);
    });

    // compose: visible = dry under-colour seen through the wet film
    const gloss = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const op = 1 - Math.exp(-Ws[i] / TAU);
      C.r[i] = Cd.r[i] + (Cw.r[i] - Cd.r[i]) * op;
      C.g[i] = Cd.g[i] + (Cw.g[i] - Cd.g[i]) * op;
      C.b[i] = Cd.b[i] + (Cw.b[i] - Cd.b[i]) * op;
      Hh[i] = D[i] + Ws[i];
      gloss[i] = 0.35 + 0.65 * SM(0.0, 0.6, fresh[i]);
    }
    pt.gloss = gloss;
    pt.fresh = fresh; pt._Ws = Ws; pt._D = D; pt._Cw = Cw; pt._Cd = Cd;
  };

  // the composition's pulls (2160-px units)
  P8.PASSES = [
    // top: deep blues / violet, off the top edge, ends mid-canvas
    { x0: -60, x1: 1500, y0: -60, Lb: 380, pal: 'deep', load: 2200, bandMin: 60, bandMax: 220, streaks: 10, nicks: 18, endLift: 0.6, gap: 0.03, press: 0.2, tilt: 0.4,
      bead: 0.0016, rate: 0.03, float: 0.00035, lifts: [[900, 40, 1.4]], seed: 21, cov: [0.95, 0.55], endRidge: true, blobs: 2, chatter: 25, edge: 18, drift: 8 },
    // the big red pull right across
    { x0: -60, x1: 2240, y0: 150, Lb: 560, pal: 'red', load: 2600, bandMin: 60, bandMax: 260, streaks: 12, nicks: 18, endLift: 0.9, gap: 0.02, press: 0.25, tilt: 0.5,
      bead: 0.0016, rate: 0.03, float: 0.00035, lifts: [[640, 30, 1.5], [1420, 70, 0.9]], seed: 11, cov: [1.0, 0.7], endRidge: false, blobs: 4, chatter: 27, edge: 18, drift: 12 },
    // whites / lemon / cerulean skimmed back from the right, ends with a ridge
    { x0: 2240, x1: 640, y0: 360, Lb: 500, pal: 'white', load: 1500, bandMin: 50, bandMax: 220, streaks: 12, nicks: 24, endLift: 1.2, gap: 0.45, press: 0.3, tilt: 0.8, skin: 0.22,
      bead: 0.0016, rate: 0.03, float: 0.00025, shear: 0.06, lifts: [[520, 40, 1.2], [1180, 25, 2.0]], seed: 12, cov: [0.72, 0.3], endRidge: true, blobs: 3, chatter: 19, edge: 22, drift: 10 },
    // lower pull across the wet street: pale greys/whites, left -> right, ends with a ridge
    { x0: -60, x1: 1680, y0: 1880, Lb: 420, pal: 'pale', load: 1700, bandMin: 50, bandMax: 220, streaks: 12, nicks: 20, endLift: 1.0, gap: 0.05, press: 0.3, tilt: 0.6,
      bead: 0.0016, rate: 0.03, float: 0.0003, lifts: [[380, 50, 1.4], [1050, 30, 1.0]], seed: 13, cov: [0.95, 0.35], endRidge: true, blobs: 2, chatter: 31, edge: 18, drift: 10 },
    { drips: [705, 120, 2100, 14] },
    { drips: [858, 700, 2100, 8] },
    { drips: [2296, 80, 1650, 10] }
  ];
})();
