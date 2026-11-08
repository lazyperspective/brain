// Bristle-brush oil paint: loaded strokes that deplete, pick up wet paint, skip over the weave when dry,
// and leave ridged impasto height.
(function (G) {
  'use strict';
  function Painter(W, H, sc, seed) {
    const N = W * H;
    this.W = W; this.H = H; this.N = N; this.sc = sc;
    this.R = new Float32Array(N); this.Gc = new Float32Array(N); this.B = new Float32Array(N);
    this.Ht = new Float32Array(N);
    this.Wet = new Uint8Array(N);
    this.Vis = new Int32Array(N);
    this.sid = 0; this.session = 1;
    this.rng = G.RNG(seed);
    this.nz = G.Noise(seed + 17);
    this.tooth = G.makeWeave(W, H, sc, seed + 3);
    // what a dry brush catches on: the weave, plus the irregular grain of gesso and earlier paint
    this.grip = new Float32Array(N);
    { const gn = G.Noise(seed + 29);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        this.grip[i] = 0.5 * this.tooth[i] + 0.5 * (0.5 + 0.55 * gn.fbm(x / (7 * sc), y / (7 * sc), 3));
      } }
    // gesso ground: warm cream with faint unevenness
    const nz = this.nz;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; const v = 0.012 * nz.fbm(x / (300 * sc), y / (300 * sc), 3);
      this.R[i] = 0.925 + v; this.Gc[i] = 0.905 + v; this.B[i] = 0.845 + v * 0.8;
    }
    // per-stroke scratch
    this.binP = new Float32Array(160); this.binD = new Float32Array(160); this.binG = new Float32Array(160);
    this.cR = new Float32Array(160); this.cG = new Float32Array(160); this.cB = new Float32Array(160);
    this.eL = new Float32Array(8192); this.eR = new Float32Array(8192);
  }

  // xs, ys, ws: arrays in px (ws = full width).  o: options.
  Painter.prototype.stroke = function (xs, ys, ws, o) {
    const n = xs.length; if (n < 2) return;
    const W = this.W, H = this.H, R = this.R, Gc = this.Gc, B = this.B, Ht = this.Ht, Wet = this.Wet, Vis = this.Vis, tooth = this.grip;
    const rng = this.rng, nz = this.nz, sc = this.sc;
    const sid = ++this.sid, ses = this.session;
    const load = o.load != null ? o.load : 1;
    const opac = o.opac != null ? o.opac : 0.95;
    const imp = o.imp != null ? o.imp : 1;
    const pick = o.pick != null ? o.pick : 0.25;
    const rag = o.rag != null ? o.rag : 0.25;
    const bris = o.bristle != null ? o.bristle : 0.5;
    const ridgeAmt = o.ridge != null ? o.ridge : 0.6;
    const wash = !!o.wash;
    const dryK = o.dryK != null ? o.dryK : 0.55;
    let wMax = 0; for (let i = 0; i < n; i++) if (ws[i] > wMax) wMax = ws[i];
    // cumulative length
    const sK = new Float32Array(n);
    for (let i = 1; i < n; i++) sK[i] = sK[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    const Ltot = sK[n - 1];
    const reach = (o.reach != null ? o.reach : 1.2) * Math.max(wMax * 6, 380 * sc);
    // bristles
    const nb = Math.max(4, Math.min(150, Math.round(wMax / (1.25 * sc))));
    const P = this.binP, D = this.binD, Gg = this.binG, cR = this.cR, cG = this.cG, cB = this.cB;
    const off = rng.next() * 100;
    const c1 = o.col, c2 = o.col2 || o.col, mix2 = o.col2 ? (o.mix2 != null ? o.mix2 : 0.3) : 0;
    let gapRun = 0;
    const c2off = rng.next() * 50;
    for (let b = 0; b < nb; b++) {
      let p = 1 + bris * (0.55 * nz.n1(off + b * 0.31) + 0.35 * (rng.next() - 0.5));
      if (gapRun > 0) { p *= 0.25; gapRun--; } else if (rng.next() < 0.04 * bris) gapRun = 1 + (rng.next() * 2 | 0);
      P[b] = Math.max(0.05, p);
      D[b] = 0.55 + 0.6 * (0.5 + 0.5 * nz.n1(off + 30 + b * 0.5)) + 0.45 * rng.next();
      Gg[b] = 0.62 + 0.2 * nz.n1(off + 60 + b * 0.45) + 0.28 * rng.next();
      const use2 = mix2 > 0 && (0.5 + 0.5 * nz.n1(c2off + b * 0.22)) < mix2;
      const c = use2 ? c2 : c1;
      cR[b] = c[0]; cG[b] = c[1]; cB[b] = c[2];
    }
    // ragged edges along the stroke
    const ne = Math.min(8191, Math.ceil(Ltot) + 2);
    const eL = this.eL, eR = this.eR; const eo = rng.next() * 100; const ef = 1 / Math.max(3 * sc, wMax * 0.5);
    for (let s = 0; s <= ne; s++) {
      eL[s] = 1 - rag * (0.5 + 0.5 * nz.n1(eo + s * ef * 0.35)) - rag * 0.45 * (0.5 + 0.5 * nz.n1(eo + 20 + s * ef)) - rag * 0.3 * Math.max(0, nz.n1(eo + 70 + s * ef * 4));
      eR[s] = 1 - rag * (0.5 + 0.5 * nz.n1(eo + 40 + s * ef * 0.35)) - rag * 0.45 * (0.5 + 0.5 * nz.n1(eo + 60 + s * ef)) - rag * 0.3 * Math.max(0, nz.n1(eo + 90 + s * ef * 4));
    }
    const touch = o.touch != null ? o.touch : 0.35;
    const lift = o.lift != null ? o.lift : 0.3;
    const liftS = Ltot * (1 - lift);
    const liftInv = 1 / Math.max(1, Ltot * lift);
    const endPile = o.endPile != null ? o.endPile : 0.4;
    const touchL = Math.max(2, wMax * 0.5);
    const capF = o.cap != null ? o.cap : 0.55 + 0.45 * rng.next(), capMax = o.cap != null ? 1e9 : 30 * sc;
    for (let k = 0; k < n - 1; k++) {
      const ax = xs[k], ay = ys[k], bx = xs[k + 1], by = ys[k + 1];
      const dx = bx - ax, dy = by - ay; const len = Math.hypot(dx, dy); if (len < 1e-3) continue;
      const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      const hwA = ws[k] * 0.5, hwB = ws[k + 1] * 0.5;
      const hwM = Math.max(hwA, hwB) * 1.08 + 1.2;
      // pick up wet paint under the brush
      if (pick > 0 && (k & 1) === 0) {
        for (let b = 0; b < nb; b++) {
          const t = (b + 0.5) / nb * 2 - 1;
          const px = Math.round(ax + nx * t * hwA), py = Math.round(ay + ny * t * hwA);
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          const j = py * W + px;
          if (Wet[j] !== ses || Vis[j] === sid) continue;
          const f = pick * Math.min(1, Ht[j] * 1.5 + 0.2);
          cR[b] += (R[j] - cR[b]) * f; cG[b] += (Gc[j] - cG[b]) * f; cB[b] += (B[j] - cB[b]) * f;
        }
      }
      const first = k === 0, last = k === n - 2;
      const uMin = first ? -Math.min(hwA * capF, capMax) / len : -(hwM * 1.0) / len;
      const uMax = last ? 1 + Math.min(hwB * capF, capMax) / len : 1 + (hwM * 1.0) / len;
      const bb = hwM * 1.5 + 1;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - bb)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + bb));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by) - bb)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + bb));
      for (let y = y0; y <= y1; y++) {
        const ry = y + 0.5 - ay;
        let idx = y * W + x0;
        for (let x = x0; x <= x1; x++, idx++) {
          if (Vis[idx] === sid) continue;
          const rx = x + 0.5 - ax;
          const u = (rx * ux + ry * uy) / len;
          if (u < uMin || u > uMax) continue;
          const uc = u < 0 ? 0 : (u > 1 ? 1 : u);
          const hw = hwA + (hwB - hwA) * uc;
          if (hw < 0.3) continue;
          const d = rx * nx + ry * ny;
          const t = d / hw;
          const at = t < 0 ? -t : t;
          if (at > 1.02) continue;
          let s = sK[k] + u * len; if (s < 0) s = 0; if (s > Ltot) s = Ltot;
          const si = s | 0;
          const e = t < 0 ? eL[si] : eR[si];
          let aa = (e - at) * hw + 0.5; if (aa <= 0) continue; if (aa > 1) aa = 1;
          // rounded caps
          if (u < 0 && first) { const cd = -u * len / Math.max(1, hw); const r2 = cd * cd + t * t; if (r2 > 1) continue; aa *= 1 - r2 * r2; }
          else if (u > 1 && last) { const cd = (u - 1) * len / Math.max(1, hw); const r2 = cd * cd + t * t; if (r2 > 1) continue; aa *= 1 - r2 * r2; }
          Vis[idx] = sid;
          let b = ((t * 0.5 + 0.5) * nb) | 0; if (b < 0) b = 0; if (b >= nb) b = nb - 1;
          const rem = Math.exp(-s / (reach * D[b]));
          let amt = load * P[b] * rem * (1 + touch * Math.exp(-s / touchL));
          if (s > liftS) { const q = (s - liftS) * liftInv; amt *= 1 - 0.8 * q * q * D[b]; }
          amt *= 1 + 0.3 * (1 - rem) * nz.n2(s * 0.12 / sc, b * 0.9 + off);
          const th = tooth[idx];
          let cov = (amt * 1.25 - (1 - th) * dryK) * 1.8;
          if (cov <= 0) continue; if (cov > 1) cov = 1;
          cov *= aa;
          let a = cov * opac;
          if (wash) a *= 0.55 + 0.6 * (1 - th);
          if (a > 1) a = 1;
          R[idx] += (cR[b] - R[idx]) * a; Gc[idx] += (cG[b] - Gc[idx]) * a; B[idx] += (cB[b] - B[idx]) * a;
          const ridge = at > 0.72 ? (at - 0.72) * 3.6 * ridgeAmt : 0;
          let dh = amt * cov * imp * (Gg[b] + ridge);
          if (Ltot - s < touchL) dh *= 1 + endPile * (1 - (Ltot - s) / touchL);
          const wet = Wet[idx] === ses;
          Ht[idx] = Ht[idx] * (1 - (wet ? 0.5 : 0.12) * a * (imp > 0 ? 1 : 0)) + dh;
          Wet[idx] = ses;
        }
      }
    }
  };
  G.Painter = Painter;
})(window);
