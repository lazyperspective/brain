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
    const touched = new Float32Array(n); // where a blade dragged across
    const TAU = 0.17;
    const Dsm = D.slice(); P8.blur(Dsm, W, H, 4 * S, 4 * S);
    const Deff = new Float32Array(n); for (let i = 0; i < n; i++) Deff[i] = 0.85 * Dsm[i] + 0.15 * D[i];

    function palette(name) {
      const P = {
        red: [[0.60, 0.04, 0.03], [0.30, 0.012, 0.03], [0.74, 0.14, 0.04], [0.36, 0.02, 0.06], [0.62, 0.05, 0.035], [0.05, 0.035, 0.08], [0.08, 0.14, 0.34]],
        white: [[0.78, 0.76, 0.68], [0.80, 0.68, 0.2], [0.3, 0.52, 0.68], [0.62, 0.6, 0.58], [0.72, 0.36, 0.42], [0.45, 0.6, 0.62]],
        green: [[0.02, 0.10, 0.08], [0.82, 0.82, 0.78], [0.55, 0.05, 0.30], [0.05, 0.22, 0.30], [0.03, 0.03, 0.04], [0.85, 0.62, 0.12]],
        pale: [[0.72, 0.72, 0.68], [0.18, 0.38, 0.58], [0.76, 0.6, 0.24], [0.42, 0.5, 0.52], [0.62, 0.26, 0.34], [0.1, 0.14, 0.2], [0.16, 0.34, 0.3], [0.8, 0.74, 0.6]],
        deep: [[0.015, 0.03, 0.08], [0.025, 0.045, 0.12], [0.01, 0.01, 0.013], [0.04, 0.06, 0.12], [0.015, 0.035, 0.1], [0.1, 0.04, 0.025], [0.3, 0.31, 0.33], [0.01, 0.012, 0.02]],
        ember: [[0.42, 0.03, 0.03], [0.6, 0.06, 0.03], [0.02, 0.02, 0.025], [0.8, 0.78, 0.72], [0.15, 0.02, 0.06], [0.05, 0.08, 0.2]],
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
      const Ar = new Float32Array(Lb), Ag = new Float32Array(Lb), Ab = new Float32Array(Lb);
      { let kk = 0; const kn2 = [];
        for (let v = -40 * S; v < Lb + 300 * S; v += (p.bandMin + r() * (p.bandMax - p.bandMin)) * S * 0.8) kn2.push({ v: v, c: pal[(r() * pal.length) | 0], tw: (10 + r() * 40) * S });
        for (let v = 0; v < Lb; v++) {
          while (kk < kn2.length - 2 && kn2[kk + 1].v <= v) kk++;
          const t = SM(kn2[kk + 1].v - kn2[kk + 1].tw, kn2[kk + 1].v, v);
          Ar[v] = mixKM(kn2[kk].c[0], kn2[kk + 1].c[0], t); Ag[v] = mixKM(kn2[kk].c[1], kn2[kk + 1].c[1], t); Ab[v] = mixKM(kn2[kk].c[2], kn2[kk + 1].c[2], t);
        }
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
        nick[j] = 0.04 * N(j / (7 * S), p.seed % 97, 7) + 0.04 * N(j / (19 * S), 3, 8);
      }
      for (let k = 0; k < Math.min(8, p.nicks); k++) { const j = (r() * Lb) | 0, w = Math.round((4 + r() * 6) * S), a = (r() < 0.5 ? -1 : 1) * (0.1 + 0.25 * r()); for (let q = j; q < Math.min(Lb, j + w); q++) nick[q] += a * Math.sin(Math.PI * (q - j + 0.5) / w); }
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
        gap[k] = p.gap + p.press * FB(u / 260, p.seed % 31, 3, 11) + 0.03 * Math.max(0, Math.sin(u / (p.chatter || 23) * 6.283 + 3 * N(u / 200, 2, 14))) * Math.max(0, N(u / 140, 1, 12));
        tilt[k] = p.tilt * FB(u / 400, 5, 2, 13);
      }
      const lifts = (p.lifts || []).map(function (lf, q) {
        return { c: lf[0] * S, w: lf[1] * S, a: lf[2], skew: (r() - 0.5) * 0.5, sd: p.seed + 200 + q };
      });
      const drag = [];
      for (let q = 0; q < (p.drags || 0); q++) {
        const j0 = (r() * Lb) | 0, h = Math.round((4 + r() * 8) * S), k0 = (r() * Math.abs(xe - xs)) | 0, k1 = k0 + ((40 + Math.pow(r(), 2) * 700) * S | 0), f = r() < 0.4 ? 0.1 * r() : 0.35 + 0.4 * r();
        for (let jj = j0; jj < Math.min(Lb, j0 + h); jj++) { (drag[jj] = drag[jj] || []).push([k0, k1, f]); }
      }
      const HFj = function (j) { return P8.hashf(j, 5, p.seed); };
      const endJ = new Float32Array(Lb);
      for (let j = 0; j < Lb; j++) endJ[j] = p.endRidge ? Math.max(0, (p.endJit || 22) * S * (0.5 + 0.7 * FB(j / (210 * S), 3.3, 3, p.seed + 81)) + 0.35 * (p.endJit || 22) * S * FB(j / (38 * S), 1.3, 4, p.seed + 82) + 2.5 * S * N(j / (6 * S), 2.2, p.seed + 83)) : 0;
      const env = new Float32Array(Lb), Dcol = new Float32Array(Lb);
      const kb = p.stiff || 0.16;
      const yTop0 = y0; let yLast = y0;
      for (let k = 0; k <= len; k++) {
        const x = xs + dir * k;
        if (x < 0 || x >= W) continue;
        // blade envelope over dry peaks (max-plus with linear falloff = finite stiffness)
        const yTop = yTop0 + Math.round((p.drift || 0) * S * FB(k / S / 520, 4.4, 3, p.seed + 95) * 2);
        yLast = yTop;
        for (let j = 0; j < Lb; j++) { const y = yTop + j; Dcol[j] = (y >= 0 && y < H) ? Dsm[y * W + x] : 0; }
        let m = -1e9; for (let j = 0; j < Lb; j++) { m = Math.max(m - kb, Dcol[j]); env[j] = m; }
        m = -1e9; for (let j = Lb - 1; j >= 0; j--) { m = Math.max(m - kb, Dcol[j]); env[j] = Math.max(env[j], m); }
        const g = gap[k], tl = tilt[k];
        const u = k / S;
        const cov = CL(p.cov[0] + (p.cov[1] - p.cov[0]) * k / len + 0.22 * FB(u / 320, 9.1, 3, p.seed + 91), 0, 1);
        const thr = -0.42 + 0.84 * cov + (p.endRidge ? 0.45 * SM(len - 260 * S, len - 30 * S, k) : 0);
        const jT = Math.max(0, (p.edge || 14) * S * (0.6 + 1.1 * FB(u / 170, 1.5, 2, p.seed + 61) + 0.12 * N(u / 25, 2.5, p.seed + 63))), jB = Math.max(0, (p.edge || 14) * S * (0.6 + 1.1 * FB(u / 170, 7.5, 2, p.seed + 62) + 0.12 * N(u / 25, 8.5, p.seed + 64)));
        for (let j = 0; j < Lb; j++) {
          const y = yTop + j; if (y < 0 || y >= H) continue;
          if (j < jT || j > Lb - 1 - jB) continue;
          if (k > len - endJ[j]) continue;
          const i = y * W + x;
          touched[i] = Math.max(touched[i], 1 - SM(0.6, 2.5, Math.max(0, (env[j] + g + bow[j] - Deff[i]))));
          let lift = 0;
          for (let q = 0; q < lifts.length; q++) {
            const lf = lifts[q], cc = lf.c + lf.skew * (j - Lb * 0.5) + 30 * S * FB(j / (60 * S), q, 4, lf.sd) + 10 * S * N(j / (9 * S), q + 3, lf.sd);
            const t = Math.abs(k - cc) / lf.w; if (t < 1.4) lift += 0.6 * lf.a * SM(1.3, 0.6, t) * Math.max(0, 0.5 + 0.8 * FB(j / (50 * S), q + 7, 3, lf.sd));
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
          const sf = 0.55 * FB(wu / 320, y / (28 * S), 4, p.seed + 71) + 0.3 * (0.35 - Math.abs(FB(wu / 460, y / (20 * S), 3, p.seed + 75))) + 0.32 * FB(wu / 650, y / (70 * S), 2, p.seed + 74) + 0.035 * N(wu / 70, y / (7 * S), p.seed + 72);
          const veil = p.veil === undefined ? 0.1 : p.veil;
          let fing = veil * SM(-0.35, -0.05, thr - sf) + (1 - veil) * SM(-0.04, 0.04, thr - sf + 0.04 * N(u / 14, y / (5 * S), p.seed + 73) + 0.02 * N(u / 5, y / (3 * S), p.seed + 76));
          if (p.noRidge) fing *= SM(len - endJ[j], len - endJ[j] - 70 * S * (0.4 + 0.6 * HFj(j)), k);
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
            const tm = CL(0.85 + 0.6 * FB(u / 420, y / (16 * S), 3, p.seed + 101) + 0.2 * N(u / 160, y / (6 * S), p.seed + 102), 0.3, 1.8);
            const dep = Math.min((gpR * 0.97 + (p.skin || 0.2) * tm * 1.6) * te, A[j] * p.rate);
            // incomplete mixing of the bead with the paint it drags: marbled, striated
            const mu = (p.marble || 0.45) * SM(0.05, 0.5, wsPre) * SM(-0.2, 0.4, FB(u / 260, y / (14 * S), 3, p.seed + 111) + 0.15 * N(u / 70, y / (6 * S), p.seed + 112));
            const jj = CL(j + Math.round(7 * S * N(u / 140, j / (35 * S), p.seed + 121) + 2 * S * N(u / 30, j / (6 * S), p.seed + 122)), 0, Lb - 1);
            const al = (p.alt || 0.85) * SM(-0.15, 0.35, FB(u / 260, y / (34 * S), 3, p.seed + 141) + 0.15 * N(u / 70, y / (12 * S), p.seed + 142));
            const lr0 = mixKM(Lr[jj], Ar[jj], al), lg0 = mixKM(Lg[jj], Ag[jj], al), lb0 = mixKM(Lbb[jj], Ab[jj], al);
            const cr = mixKM(lr0, Cw.r[i], mu), cg = mixKM(lg0, Cw.g[i], mu), cb = mixKM(lb0, Cw.b[i], mu);
            const mot = (1 + 0.1 * FB(u / 300, y / (22 * S), 3, p.seed + 131)) * (0.9 + 0.12 * Math.min(1.5, tm));
            const t = te * dep / (ws * 0.1 + dep + 1e-6);
            Cw.r[i] += (cr * mot - Cw.r[i]) * t; Cw.g[i] += (cg * mot - Cw.g[i]) * t; Cw.b[i] += (cb * mot - Cw.b[i]) * t;
            const rb = (p.ripRidge || 1.1) * 4 * fing * (1 - fing) * te;
            if (P8.DBG && y === P8.DBG.y && (k % 25) === 0) P8.DBG.out.push([k, +Lv.toFixed(2), +Deff[i].toFixed(2), +ws.toFixed(2), +gp2.toFixed(2), +reach.toFixed(2), +fing.toFixed(2), +te.toFixed(2), +dep.toFixed(2), +A[j].toFixed(0), [Lr[j], Lg[j], Lbb[j]].map(v => +v.toFixed(2)).join('/')]);
            ws += dep + rb; A[j] -= dep + rb; fresh[i] += dep + rb;
          }
          Ws[i] = ws;
        }
        // paint bead flows a little along the blade
        for (let it = 0; it < 2; it++) {
          for (let j = 1; j < Lb - 1; j++) A[j] += 0.2 * (A[j - 1] + A[j + 1] - 2 * A[j]);
          for (let j = 1; j < Lb - 1; j++) { Lr[j] += 0.12 * (Lr[j - 1] + Lr[j + 1] - 2 * Lr[j]); Lg[j] += 0.12 * (Lg[j - 1] + Lg[j + 1] - 2 * Lg[j]); Lbb[j] += 0.12 * (Lbb[j - 1] + Lbb[j + 1] - 2 * Lbb[j]); }
        }
        // squeezed-out paint at the blade ends forms thin ridges along the band edges
        if (p.beads && (k & 3) === 0) {
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
      // end of the pull: the blade lifts and leaves the remaining bead as a ragged ridge of mixed paint
      if (p.endRidge && !p.noRidge && xe >= 0 && xe < W) {
        for (let j = 0; j < Lb; j++) {
          const y = yLast + j; if (y < 0 || y >= H) continue;
          const wd = Math.max(8 * S, (28 + 30 * FB(j / (60 * S), 9.2, 3, p.seed + 31) + 8 * FB(j / (14 * S), 3.7, 3, p.seed + 33)) * S);
          const hgt = CL(A[j] / S * 0.0022, 0.4, 2.0) * (0.7 + 0.5 * Math.max(0, N(j / (16 * S), 5, p.seed + 34)));
          const xr = Math.round(xe - dir * endJ[j]);
          for (let q = -Math.round(wd * 0.3); q < wd + 2; q++) {
            const x = xr + dir * q; if (x < 0 || x >= W) continue;
            const t = q / wd;
            const prof = t < 0 ? SM(-0.3, 0, t) * 0.4 : (0.4 + 0.6 * SM(0, 0.35, t)) * SM(1.0, 0.85, t);
            if (prof <= 0.01) continue;
            const i = y * W + x, a = hgt * prof;
            const mx = 0.35 * SM(0.2, 1, t) * (0.5 + 0.5 * N(q / (3 * S), j / (2 * S), p.seed + 35));
            const cr = Lr[j] + (Cw.r[i] - Lr[j]) * mx, cg = Lg[j] + (Cw.g[i] - Lg[j]) * mx, cb = Lbb[j] + (Cw.b[i] - Lbb[j]) * mx;
            const k2 = Math.min(1, a / (Ws[i] * 0.2 + a + 1e-6));
            Cw.r[i] += (cr - Cw.r[i]) * k2; Cw.g[i] += (cg - Cw.g[i]) * k2; Cw.b[i] += (cb - Cw.b[i]) * k2;
            Ws[i] += a; fresh[i] += a;
          }
        }
      }
    }

    // drips: runs of fluid paint from a band's lower edge; thin films are translucent, the bead at the end is thick
    function drips(yEdge, xa, xb, count, sd) {
      const r = P8.rng(sd);
      for (let k = 0; k < count; k++) {
        let x = (xa + r() * (xb - xa)) * S;
        // start where the band really ends at this x: scan down for the last fresh paint
        let y = (yEdge - 60) * S;
        for (let yy = Math.round((yEdge - 60) * S); yy < Math.round((yEdge + 40) * S) && yy < H; yy++) if (fresh[yy * W + (x | 0)] > 0.4) y = yy;
        const i0 = CL(y | 0, 0, H - 1) * W + CL(x | 0, 0, W - 1);
        if (fresh[i0] < 0.4) continue;
        const col = [Cw.r[i0], Cw.g[i0], Cw.b[i0]];
        const L = (16 + Math.pow(r(), 2.4) * 95) * S, w0 = (3.2 + r() * 3.4) * S;
        let vx = 0;
        for (let s = 0; s < L; s += 0.5) {
          const t = s / L;
          // neck thins after leaving the band, the run swells toward an elongated bead
          const neck = 1 - 0.3 * SM(0.0, 0.3, t);
          const bead = 0.28 * Math.exp(-Math.pow((t - 0.86) / 0.12, 2));
          const w = w0 * (neck + bead + 0.1 * N(s / (9 * S), k, 52)) * SM(1.0, 0.985, t);
          vx += 0.004 * N(s / (40 * S), k, 51); vx *= 0.98; x += vx;
          const yy = (y + s) | 0; if (yy >= H) break;
          const thick = 0.25 + 0.9 * bead + 0.3 * (1 - SM(0, 0.2, t));
          for (let dx = -Math.ceil(w) - 1; dx <= Math.ceil(w) + 1; dx++) {
            const xx = (x + dx) | 0; if (xx < 0 || xx >= W) continue;
            const d = Math.abs(xx + 0.5 - x) / Math.max(0.6, w); if (d > 1) continue;
            const i = yy * W + xx, prof = Math.sqrt(1 - d * d);
            const a = thick * prof * 0.5; // per half-pixel step
            const tt = Math.min(1, a / (Ws[i] * 0.25 + a)) * SM(1, 0.6, d);
            Cw.r[i] += (col[0] - Cw.r[i]) * tt; Cw.g[i] += (col[1] - Cw.g[i]) * tt; Cw.b[i] += (col[2] - Cw.b[i]) * tt;
            if (Ws[i] < thick * prof) { const add = (thick * prof - Ws[i]) * 0.5; Ws[i] += add; fresh[i] += add; }
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

    // the image under the pulls is dragged: horizontally smeared, softened and shifted toward the paint
    {
      P8.blur(touched, W, H, 3 * S, 2 * S);
      const sm = P8.copyImg(Cd); P8.blurImg(sm, 9 * S, 3.5 * S);
      const tint = P8.copyImg(Cw); P8.blurImg(tint, 40 * S, 10 * S);
      for (let i = 0; i < n; i++) {
        const t = touched[i]; if (t <= 0.001) continue;
        const k = 0.7 * t, kt = 0.25 * t;
        Cd.r[i] += (sm.r[i] * 0.9 + tint.r[i] * 0.1 - Cd.r[i]) * k; Cd.g[i] += (sm.g[i] * 0.9 + tint.g[i] * 0.1 - Cd.g[i]) * k; Cd.b[i] += (sm.b[i] * 0.9 + tint.b[i] * 0.1 - Cd.b[i]) * k;
        Cd.r[i] = mixKM(Cd.r[i], tint.r[i], kt); Cd.g[i] = mixKM(Cd.g[i], tint.g[i], kt); Cd.b[i] = mixKM(Cd.b[i], tint.b[i], kt);
      }
      // wet paint flows a little: soften the pulled film across rows (no single-pixel streaks)
      const msk = new Float32Array(n); for (let i = 0; i < n; i++) msk[i] = Math.min(1, fresh[i] * 3);
      P8.blur(msk, W, H, 2 * S, 2 * S);
      const cw2 = P8.copyImg(Cw); P8.blurImg(cw2, 2.2 * S, 1.6 * S);
      const ws2 = Ws.slice(); P8.blur(ws2, W, H, 1.6 * S, 1.3 * S);
      for (let i = 0; i < n; i++) {
        const m = msk[i]; if (m <= 0.001) continue;
        Cw.r[i] += (cw2.r[i] - Cw.r[i]) * m; Cw.g[i] += (cw2.g[i] - Cw.g[i]) * m; Cw.b[i] += (cw2.b[i] - Cw.b[i]) * m;
        Ws[i] += (ws2[i] - Ws[i]) * m;
      }
    }
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
    pt.fresh = fresh; pt._Ws = Ws; pt._touched = touched; pt._D = D; pt._Cw = Cw; pt._Cd = Cd;
  };

  // the composition's pulls (2160-px units)
  P8.PASSES = [
    // top: deep blues / violet, a narrow pull off the top edge, breaking up toward the right
    { x0: -60, x1: 2240, y0: -50, Lb: 230, pal: 'deep', load: 2400, bandMin: 60, bandMax: 220, streaks: 10, nicks: 8, endLift: 0.6, gap: 0.03, press: 0.2, tilt: 0.4,
      bead: 0.0016, rate: 0.03, float: 0.00035, lifts: [[900, 40, 1.4]], seed: 21, cov: [0.85, 0.3], endRidge: false, chatter: 25, edge: 18 },
    // red pull, narrower, from the left; runs thin and ends with a raised ridge before the right-hand facades
    { x0: -60, x1: 1640, y0: 255, Lb: 330, pal: 'red', load: 2600, bandMin: 50, bandMax: 200, streaks: 10, nicks: 8, endLift: 0.9, gap: 0.02, press: 0.25, tilt: 0.5,
      bead: 0.0016, rate: 0.03, float: 0.00035, lifts: [[640, 30, 1.5], [1180, 50, 0.9]], seed: 11, cov: [0.92, 0.5], endRidge: true, endJit: 150, chatter: 27, edge: 20 },
    // pale lemon / cerulean / rose skimmed back from the right, partly over the red
    { x0: 2240, x1: 980, y0: 470, Lb: 280, pal: 'white', load: 1900, bandMin: 50, bandMax: 200, streaks: 10, nicks: 8, endLift: 1.2, gap: 0.12, press: 0.3, tilt: 0.8, skin: 0.22,
      bead: 0.0016, rate: 0.03, float: 0.00025, shear: 0.06, lifts: [[700, 60, 0.5]], seed: 12, cov: [0.95, 0.68], endRidge: true, endJit: 90, veil: 0.2, chatter: 19, edge: 22 },
    // lower pull across the wet street, left -> right, ends with a ridge
    { x0: -60, x1: 1760, y0: 1650, Lb: 400, pal: 'pale', load: 1700, bandMin: 50, bandMax: 220, streaks: 10, nicks: 8, endLift: 1.0, gap: 0.05, press: 0.3, tilt: 0.6,
      bead: 0.0016, rate: 0.03, float: 0.0003, lifts: [[380, 50, 1.4], [1050, 30, 1.0]], seed: 13, cov: [0.97, 0.55], endRidge: true, endJit: 90, chatter: 31, edge: 18 },
    // a narrow late pull low on the canvas, from the right edge, running out of paint
    { x0: 2240, x1: 860, y0: 2380, Lb: 210, pal: 'ember', load: 1500, bandMin: 30, bandMax: 120, streaks: 8, nicks: 8, endLift: 0.8, gap: 0.05, press: 0.3, tilt: 0.4,
      bead: 0.0016, rate: 0.03, float: 0.0003, lifts: [[520, 30, 1.2]], seed: 17, cov: [0.85, 0.12], endRidge: true, noRidge: true, endJit: 140, chatter: 29, edge: 26, alt: 0.5 },
    { drips: [590, 120, 1600, 7] },
    { drips: [2046, 80, 1700, 5] }
  ];
})();
