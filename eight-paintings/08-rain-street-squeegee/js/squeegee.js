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
    for (let i = 0; i < n; i++) { Ws[i] *= 0.35; D[i] = Hh[i] - Ws[i]; }
    const fresh = new Float32Array(n); // squeegee paint amount (for gloss)
    const TAU = 0.13;
    const Dsm = D.slice(); P8.blur(Dsm, W, H, 4 * S, 4 * S);
    const Deff = new Float32Array(n); for (let i = 0; i < n; i++) Deff[i] = 0.85 * Dsm[i] + 0.15 * D[i];

    function palette(name) {
      const P = {
        red: [[0.60, 0.04, 0.03], [0.34, 0.012, 0.035], [0.74, 0.14, 0.04], [0.55, 0.03, 0.14], [0.62, 0.05, 0.035], [0.05, 0.04, 0.07], [0.10, 0.2, 0.5]],
        white: [[0.86, 0.85, 0.80], [0.80, 0.72, 0.18], [0.34, 0.58, 0.72], [0.9, 0.88, 0.84], [0.62, 0.62, 0.6], [0.75, 0.3, 0.42]],
        green: [[0.02, 0.10, 0.08], [0.82, 0.82, 0.78], [0.55, 0.05, 0.30], [0.05, 0.22, 0.30], [0.03, 0.03, 0.04], [0.85, 0.62, 0.12]],
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
        Cw.r[i] = mixKM(Cw.r[i], col[0], a / (Ws[i] + a)); Cw.g[i] = mixKM(Cw.g[i], col[1], a / (Ws[i] + a)); Cw.b[i] = mixKM(Cw.b[i], col[2], a / (Ws[i] + a));
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
      const env = new Float32Array(Lb), Dcol = new Float32Array(Lb);
      const kb = p.stiff || 0.05;
      const yTop = y0;
      for (let k = 0; k <= len; k++) {
        const x = xs + dir * k;
        if (x < 0 || x >= W) continue;
        // blade envelope over dry peaks (max-plus with linear falloff = finite stiffness)
        for (let j = 0; j < Lb; j++) { const y = yTop + j; Dcol[j] = (y >= 0 && y < H) ? Dsm[y * W + x] : 0; }
        let m = -1e9; for (let j = 0; j < Lb; j++) { m = Math.max(m - kb, Dcol[j]); env[j] = m; }
        m = -1e9; for (let j = Lb - 1; j >= 0; j--) { m = Math.max(m - kb, Dcol[j]); env[j] = Math.max(env[j], m); }
        const g = gap[k], tl = tilt[k];
        const u = k / S;
        const jT = Math.max(0, (p.edge || 14) * S * (0.35 + 0.65 * FB(u / 70, 1.5, 3, p.seed + 61))), jB = Math.max(0, (p.edge || 14) * S * (0.35 + 0.65 * FB(u / 70, 7.5, 3, p.seed + 62)));
        for (let j = 0; j < Lb; j++) {
          const y = yTop + j; if (y < 0 || y >= H) continue;
          if (j < jT || j > Lb - 1 - jB) continue;
          const i = y * W + x;
          let lift = 0;
          for (let q = 0; q < lifts.length; q++) {
            const lf = lifts[q], cc = lf.c + lf.skew * (j - Lb * 0.5) + 28 * S * N(j / (45 * S), q, lf.sd);
            const t = Math.abs(k - cc) / lf.w; if (t < 1.4) lift += lf.a * SM(1.3, 0.75, t) * (0.6 + 0.6 * N(j / (90 * S), q + 7, lf.sd));
          }
          const Lv = env[j] + g + bow[j] + nick[j] + tl * (j / Lb - 0.5) + p.float * A[j] / S + Math.max(0, lift);
          let ws = Ws[i];
          const top = Deff[i] + ws;
          if (top > Lv && ws > 0) {
            const rm = Math.min(ws, (top - Lv) * 0.93);
            const t = rm / (A[j] + rm + 1e-6);
            Lr[j] = mixKM(Lr[j], Cw.r[i], t); Lg[j] = mixKM(Lg[j], Cw.g[i], t); Lbb[j] = mixKM(Lbb[j], Cw.b[i], t);
            A[j] += rm; ws -= rm;
          }
          const gp = Lv - (Deff[i] + ws);
          // viscous fingering where contact is marginal: lacy, horizontally drawn-out skips
          const fing = 0.12 + 1.25 * SM(-0.12, 0.22, FB(u / 70, y / (8 * S), 4, p.seed + 71) + 0.12 * N(u / 9, y / (2.5 * S), p.seed + 72));
          const reach = p.bead * A[j] / S * fing;
          if (gp > 0 && gp < reach) {
            // the moving bead shears the top of the wet layer along with it (drag / smear)
            if (ws > 0) {
              const sh = ws * (p.shear || 0.35);
              const t0 = sh / (A[j] + sh + 1e-6);
              Lr[j] = mixKM(Lr[j], Cw.r[i], t0); Lg[j] = mixKM(Lg[j], Cw.g[i], t0); Lbb[j] = mixKM(Lbb[j], Cw.b[i], t0);
              A[j] += sh; ws -= sh;
            }
            const gp2 = Lv - (Deff[i] + ws);
            const dep = Math.min(gp2 * 0.92, A[j] * p.rate);
            const t = dep / (ws * 0.12 + dep + 1e-6);
            Cw.r[i] = mixKM(Cw.r[i], Lr[j], t); Cw.g[i] = mixKM(Cw.g[i], Lg[j], t); Cw.b[i] = mixKM(Cw.b[i], Lbb[j], t);
            ws += dep; A[j] -= dep; fresh[i] += dep;
          }
          Ws[i] = ws;
        }
        // paint bead flows a little along the blade
        for (let j = 1; j < Lb - 1; j++) A[j] += 0.06 * (A[j - 1] + A[j + 1] - 2 * A[j]);
        // squeezed-out paint at the blade ends forms thin ridges along the band edges
        if ((k & 3) === 0) {
          [[Math.min(Lb - 1, Math.ceil(jT)), -1], [Math.max(0, Math.floor(Lb - 1 - jB)), 1]].forEach(function (e) {
            const j = e[0], a = A[j] * 0.0035 * (0.5 + N(k / (40 * S), j, 21));
            if (a <= 0) return;
            for (let q = 1; q <= 3; q++) {
              const y = yTop + j + e[1] * q; if (y < 0 || y >= H) continue;
              for (let dx = 0; dx < 4; dx++) {
                const xx = x + dir * dx; if (xx < 0 || xx >= W) continue;
                const i = y * W + xx, aa = a * (1 - q / 4);
                Cw.r[i] = mixKM(Cw.r[i], Lr[j], aa / (Ws[i] + aa)); Cw.g[i] = mixKM(Cw.g[i], Lg[j], aa / (Ws[i] + aa)); Cw.b[i] = mixKM(Cw.b[i], Lbb[j], aa / (Ws[i] + aa));
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
          const y = yTop + j; if (y < 0 || y >= H) continue;
          const amt = A[j] * 0.08 * (0.6 + 0.8 * Math.max(0, N(j / (14 * S), 9, 31)));
          const wd = (4 + 10 * Math.max(0, N(j / (30 * S), 2, 32)) + 3 * N(j / (4 * S), 3, 33)) * S;
          for (let q = 0; q < wd + 2; q++) {
            const x = xe + dir * q; if (x < 0 || x >= W) continue;
            const i = y * W + x, a = amt * SM(wd + 1, wd * 0.3, q) / Math.max(1, wd * 0.5);
            Cw.r[i] = mixKM(Cw.r[i], Lr[j], a / (Ws[i] * 0.3 + a + 1e-6)); Cw.g[i] = mixKM(Cw.g[i], Lg[j], a / (Ws[i] * 0.3 + a + 1e-6)); Cw.b[i] = mixKM(Cw.b[i], Lbb[j], a / (Ws[i] * 0.3 + a + 1e-6));
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
            Cw.r[i] = mixKM(Cw.r[i], col[0], tt); Cw.g[i] = mixKM(Cw.g[i], col[1], tt); Cw.b[i] = mixKM(Cw.b[i], col[2], tt);
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
    // upper band, pass 1: reds/alizarin/black, left -> right, heavy load
    { x0: -40, x1: 1900, y0: 300, Lb: 520, pal: 'red', load: 2400, bandMin: 50, bandMax: 240, streaks: 12, nicks: 18, endLift: 0.9, gap: 0.02, press: 0.25, tilt: 0.5,
      bead: 0.0016, rate: 0.03, float: 0.00035, lifts: [[620, 30, 1.5], [1350, 70, 0.9]], seed: 11, endRidge: true, blobs: 4, chatter: 27, edge: 16 },
    // upper band, pass 2: whites/lemon/cerulean, right -> left, lighter load, offset down
    { x0: 2200, x1: 380, y0: 390, Lb: 460, pal: 'white', load: 900, bandMin: 40, bandMax: 200, streaks: 14, nicks: 24, endLift: 1.2, gap: 0.42, press: 0.6, tilt: 0.8,
      bead: 0.0013, rate: 0.03, float: 0.0002, lifts: [[500, 40, 1.2], [1100, 25, 2.0]], seed: 12, endRidge: true, blobs: 3, chatter: 19, edge: 20 },
    // lower band: green/white/magenta, right -> left, thin load, mostly smear of the reflections
    { x0: 2200, x1: 520, y0: 1690, Lb: 380, pal: 'green', load: 1100, bandMin: 40, bandMax: 180, streaks: 12, nicks: 20, endLift: 1.0, gap: 0.04, press: 0.35, tilt: 0.6,
      bead: 0.0015, rate: 0.03, float: 0.0003, lifts: [[300, 50, 1.4], [900, 30, 1.0]], seed: 13, endRidge: true, blobs: 2, chatter: 31, edge: 16 },
    { drips: [818, 200, 1880, 16] },
    { drips: [2068, 560, 2150, 9] }
  ];
})();
