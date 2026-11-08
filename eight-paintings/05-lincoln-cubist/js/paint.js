// The oil-paint engine. Paint lives in three per-pixel fields: colour (linear reflectance), height (thickness of
// the paint film) and wetness. Each stroke is a real brush pass along a centreline:
//  - a bundle of bristles, each with its own load and its own tint (imperfectly mixed paint on the palette),
//    leaving parallel striations in colour and in height
//  - the load runs out along the stroke; a starved brush only touches the high points (canvas weave, the ridges of
//    paint underneath) and breaks up into dry-brush scumble with ragged ends
//  - wet paint underneath is dragged along and streaked into the new colour (wet-in-wet)
//  - a loaded brush leaves ridges at its edges, a blob where it lands and a lip where it lifts
// At the end, the height field (plus the canvas weave showing through thin paint) is lit by a raking light from the
// upper left: diffuse relief, a little oil sheen on the crests, occlusion in the furrows.
(function (G) {
  'use strict';
  const R = G.R;
  const { clamp, sstep } = R;

  function Painter(W, H, k) {
    this.W = W; this.H = H; this.k = k;
    const N = W * H;
    this.col = new Float32Array(N * 3);
    this.h = new Float32Array(N);
    this.wet = new Float32Array(N);
    this.weave = new Float32Array(N);
    this.clipIds = null; this.clipW = 0;
    const MAXB = 1 << 20;
    this.MAXB = MAXB;
    this.su = new Float32Array(MAXB); this.sv = new Float32Array(MAXB); this.sd = new Float32Array(MAXB);
    this.stx = new Float32Array(MAXB); this.sty = new Float32Array(MAXB); this.sc = new Float32Array(MAXB * 3);
    this.count = 0; this.area = 0;
  }

  // plain-weave canvas: warp and weft threads with slubs and wander, over/under alternation
  Painter.prototype.makeWeave = function (period, seed) {
    const W = this.W, H = this.H, wv = this.weave, P = period;
    const thrW = new Float32Array(Math.ceil(W / P) + 16), thrH = new Float32Array(Math.ceil(H / P) + 16);
    const rr = R.rng(seed);
    for (let i = 0; i < thrW.length; i++) thrW[i] = 0.6 + 0.55 * rr();
    for (let i = 0; i < thrH.length; i++) thrH[i] = 0.6 + 0.55 * rr();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wx = x + (R.vnoise(x * 0.01, y * 0.0035, seed + 1) - 0.5) * P * 1.6 + (R.vnoise(x / (P * 2.7), y / (P * 9), seed + 5) - 0.5) * P * 0.7;
        const wy = y + (R.vnoise(x * 0.0035, y * 0.01, seed + 2) - 0.5) * P * 1.6 + (R.vnoise(x / (P * 9), y / (P * 2.7), seed + 6) - 0.5) * P * 0.7;
        const fx = wx / P + 4, fy = wy / P + 4;
        const i = Math.floor(fx), j = Math.floor(fy), ax = fx - i, ay = fy - j;
        const tw = thrW[i] * (0.85 + 0.3 * R.vnoise(i * 3.1, y / (P * 3.5), seed + 3));
        const tf = thrH[j] * (0.85 + 0.3 * R.vnoise(x / (P * 3.5), j * 3.1, seed + 4));
        let pw = 1 - Math.pow((ax - 0.5) * 2 / tw, 2); pw = pw > 0 ? Math.sqrt(pw) : 0;
        let pf = 1 - Math.pow((ay - 0.5) * 2 / tf, 2); pf = pf > 0 ? Math.sqrt(pf) : 0;
        const sw = (i & 1) ? -1 : 1, sf = (j & 1) ? -1 : 1;
        const ew = sw * Math.cos(Math.PI * (fy - 0.5)), ef = -sf * Math.cos(Math.PI * (fx - 0.5));
        const hw = pw * (0.62 + 0.38 * ew), hf = pf * (0.62 + 0.38 * ef);
        let v = hw > hf ? hw : hf;
        v += (R.hash2(x, y, seed + 7) - 0.5) * 0.12;
        wv[y * W + x] = v;
      }
    }
  };

  Painter.prototype.fillGround = function (fn) {
    const W = this.W, H = this.H, col = this.col;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = fn(x, y), p = (y * W + x) * 3;
      col[p] = c[0]; col[p + 1] = c[1]; col[p + 2] = c[2];
    }
  };

  Painter.prototype.setClip = function (ids, gw) { this.clipIds = ids; this.clipW = gw; };

  // stroke centreline helpers
  function bentPts(x, y, ang, len, bend, w) {
    const n = Math.max(2, Math.min(24, Math.ceil(len / Math.max(6, w * 0.6)) + 1));
    const pts = [];
    // centred arc: heading changes linearly by `bend` radians over the length
    let a = ang - bend / 2, px = 0, py = 0;
    const raw = [[0, 0]];
    const ds = len / (n - 1);
    for (let i = 1; i < n; i++) { const aa = a + (bend * (i - 0.5)) / (n - 1); px += Math.cos(aa) * ds; py += Math.sin(aa) * ds; raw.push([px, py]); }
    const mx = raw[n - 1][0] / 2, my = raw[n - 1][1] / 2;
    for (const p of raw) pts.push([x + p[0] - mx, y + p[1] - my]);
    return pts;
  }

  // s: {pts, w, c, c2, mixAmt, load, fade, op, hs, pickup, drag, clip, brush ('flat'|'round'), seed, rough, wetness, scrape}
  Painter.prototype.stroke = function (s) {
    const W = this.W, H = this.H, pts = s.pts, n = pts.length;
    if (n < 2) return;
    const r = Math.max(0.6, s.w * 0.5);
    const cum = new Float64Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const L = Math.max(1, cum[n - 1]);
    const round = s.brush === 'round';
    const capS = round ? 1.0 : 0.22, capE = round ? 1.0 : 0.3;
    const pad = r * 1.15 + 3;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of pts) { if (p[0] < xmin) xmin = p[0]; if (p[0] > xmax) xmax = p[0]; if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }
    const x0 = Math.max(0, Math.floor(xmin - pad)), x1 = Math.min(W - 1, Math.ceil(xmax + pad));
    const y0 = Math.max(0, Math.floor(ymin - pad)), y1 = Math.min(H - 1, Math.ceil(ymax + pad));
    if (x1 < x0 || y1 < y0) return;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, B = bw * bh;
    if (B > this.MAXB) return;
    const su = this.su, sv = this.sv, sd = this.sd, stx = this.stx, sty = this.sty, sc = this.sc;
    for (let i = 0; i < B; i++) sd[i] = 1e9;
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const ux = dx / len, uy = dy / len;
      const first = i === 0, last = i === n - 2;
      const ex = pad + (first || last ? r * 0.4 : 0);
      const sx0 = Math.max(x0, Math.floor(Math.min(a[0], b[0]) - ex)), sx1 = Math.min(x1, Math.ceil(Math.max(a[0], b[0]) + ex));
      const sy0 = Math.max(y0, Math.floor(Math.min(a[1], b[1]) - ex)), sy1 = Math.min(y1, Math.ceil(Math.max(a[1], b[1]) + ex));
      for (let py = sy0; py <= sy1; py++) {
        const qy = py + 0.5 - a[1];
        let k = (py - y0) * bw + (sx0 - x0);
        for (let px = sx0; px <= sx1; px++, k++) {
          const qx = px + 0.5 - a[0];
          const t = qx * ux + qy * uy;
          const tcl = t < 0 ? 0 : t > len ? len : t;
          const ddx = qx - ux * tcl, ddy = qy - uy * tcl;
          const d = Math.sqrt(ddx * ddx + ddy * ddy);
          if (d < sd[k]) {
            sd[k] = d;
            const cross = qx * -uy + qy * ux;
            if ((first && t < 0) || (last && t > len)) { su[k] = cum[i] + t; sv[k] = cross; }
            else { su[k] = cum[i] + tcl; sv[k] = cross < 0 ? -d : d; }
            stx[k] = ux; sty[k] = uy;
          }
        }
      }
    }
    // snapshot colour under the stroke (for wet pickup)
    const col = this.col, hgt = this.h, wet = this.wet, wv = this.weave;
    for (let py = y0; py <= y1; py++) {
      let k = (py - y0) * bw * 3, p = (py * W + x0) * 3;
      for (let px = x0; px <= x1; px++, k += 3, p += 3) { sc[k] = col[p]; sc[k + 1] = col[p + 1]; sc[k + 2] = col[p + 2]; }
    }
    // bristles
    const rng = R.rng((s.seed || 1) * 7919 + 13);
    const nb = Math.max(5, Math.min(90, Math.round((2 * r) / (s.bristle || Math.max(0.9, 2.0 * this.k)))));
    const bri = new Float32Array(nb + 2), str = new Float32Array(nb + 2), pk = new Float32Array(nb + 2), tail = new Float32Array(nb + 2);
    let prev = rng(), prevS = rng();
    for (let i = 0; i < nb + 2; i++) {
      prev = prev * 0.45 + rng() * 0.55; bri[i] = nb < 12 ? 0.55 + 0.45 * prev : prev;
      prevS = prevS * 0.55 + rng() * 0.45; str[i] = prevS;
      pk[i] = rng(); tail[i] = rng();
    }
    const c1 = s.c, c2 = s.c2 || s.c, mixAmt = s.c2 ? (s.mixAmt === undefined ? 0.8 : s.mixAmt) : 0;
    const load = s.load === undefined ? 1 : s.load, fade = s.fade === undefined ? 0.6 : s.fade;
    const op = s.op === undefined ? 1 : s.op, hs = s.hs === undefined ? 1 : s.hs;
    const pickup = s.pickup || 0, drag = s.drag === undefined ? r * 0.8 : s.drag;
    const rough = s.rough === undefined ? 1 : s.rough;
    const wetness = s.wetness === undefined ? 1 : s.wetness, scrape = s.scrape === undefined ? 0.75 : s.scrape;
    const wanderA = 0.035 + 0.05 * rng(), wanderF = (0.6 + rng()) / Math.max(4, r), wanderP = rng() * 6.28;
    const clip = s.clip, clipIds = this.clipIds, cw = this.clipW;
    const clipLut = clip && typeof clip === 'object';
    const blob = s.blob === undefined ? 0.15 : s.blob, lip = s.lip === undefined ? 0.25 : s.lip;
    const taper = s.taper || 0;
    const seed = s.seed | 0;
    let touched = 0;
    for (let py = y0; py <= y1; py++) {
      let k = (py - y0) * bw + 0;
      for (let px = x0; px <= x1; px++, k++) {
        if (sd[k] > r * 1.15 + 2) continue;
        const u = su[k], v = sv[k];
        const t = u / L;
        let rE = r;
        if (round || taper) {
          const tp = round ? (s.taper === undefined ? 0.55 : s.taper) : taper;
          rE = r * (1 - tp * (1 - sstep(-0.05, 0.22, t)) * 0.6) * (1 - tp * (1 - sstep(1.05, 0.62, t)) * 0.75);
        } else rE = r * (1 - 0.1 * clamp(t, 0, 1));
        const s1 = v / rE;
        const as = s1 < 0 ? -s1 : s1;
        const bf = (clamp(s1, -1, 1) * 0.5 + 0.5) * (nb - 1) + 1 + Math.sin(u * wanderF + wanderP) * wanderA * nb;
        const bi = bf < 0 ? 0 : bf > nb ? nb : bf;
        const i0 = Math.floor(bi), fr = bi - i0, i1 = i0 + 1 > nb + 1 ? nb + 1 : i0 + 1;
        const b = bri[i0] * (1 - fr) + bri[i1] * fr;
        const st = str[i0] * (1 - fr) + str[i1] * fr;
        const pkb = pk[i0] * (1 - fr) + pk[i1] * fr;
        const tl = tail[i0] * (1 - fr) + tail[i1] * fr;
        const q = 1 - (as > 1 ? 1 : as * as);
        const side = rE - (v < 0 ? -v : v) + (b - 0.5) * rough * Math.min(3, r * 0.25);
        const startE = u + capS * rE * (round ? Math.sqrt(q) : q);
        const P = Math.max(0, load * (1 - fade * clamp(t, 0, 1.1)));
        const endE = L - u + capE * rE * (round ? Math.sqrt(q) : q) + (tl - 0.5) * rE * rough * (1.4 - Math.min(1, load)) * 1.2;
        let m = side < startE ? side : startE; if (endE < m) m = endE;
        const shapeCov = m > 0.6 ? 1 : m < -0.6 ? 0 : (m + 0.6) / 1.2;
        if (shapeCov <= 0) continue;
        const p = py * W + px;
        let clipM = 1;
        if (clip) {
          const g = 2 * py * cw + 2 * px;
          if (clipLut) clipM = (clip[clipIds[g]] + clip[clipIds[g + 1]] + clip[clipIds[g + cw]] + clip[clipIds[g + cw + 1]]) * 0.25;
          else clipM = ((clipIds[g] === clip) + (clipIds[g + 1] === clip) + (clipIds[g + cw] === clip) + (clipIds[g + cw + 1] === clip)) * 0.25;
          if (clipM <= 0) continue;
        }
        const hOld = hgt[p];
        const bump = wv[p] * 0.55 / (1 + 4 * hOld) + (hOld > 1.6 ? 1.6 : hOld) * 0.32;
        const avail = P * (0.4 + 0.8 * b);
        const hn = R.hash2(px, py, seed);
        const contact = sstep(0.18, 0.5, avail + 0.55 * bump - 0.22 + (hn - 0.5) * 0.16);
        if (contact <= 0) continue;
        const cov = shapeCov * contact * clipM * op;
        // colour: bristle streak between the two paints, then wet pickup dragged from upstream
        const ms = st * mixAmt;
        let cr = c1[0] + (c2[0] - c1[0]) * ms, cg = c1[1] + (c2[1] - c1[1]) * ms, cb = c1[2] + (c2[2] - c1[2]) * ms;
        if (pickup > 0) {
          const dd = drag * (0.6 + 0.8 * pkb);
          let ux = Math.round(px - stx[k] * dd), uy = Math.round(py - sty[k] * dd);
          if (ux < 0) ux = 0; else if (ux >= W) ux = W - 1;
          if (uy < 0) uy = 0; else if (uy >= H) uy = H - 1;
          let ur, ug, ub;
          if (ux >= x0 && ux <= x1 && uy >= y0 && uy <= y1) { const kk = ((uy - y0) * bw + ux - x0) * 3; ur = sc[kk]; ug = sc[kk + 1]; ub = sc[kk + 2]; }
          else { const pp = (uy * W + ux) * 3; ur = col[pp]; ug = col[pp + 1]; ub = col[pp + 2]; }
          const wp = pickup * wet[uy * W + ux] * (0.35 + 0.65 * (1 - (P > 1 ? 1 : P))) * (0.25 + 0.75 * pkb * pkb);
          cr += (ur - cr) * wp; cg += (ug - cg) * wp; cb += (ub - cb) * wp;
        }
        const p3 = p * 3;
        col[p3] += (cr - col[p3]) * cov; col[p3 + 1] += (cg - col[p3 + 1]) * cov; col[p3 + 2] += (cb - col[p3 + 2]) * cov;
        // height: striated deposit, edge ridges, landing blob, lifting lip
        const ridge = 0.8 + 0.5 * sstep(0.6, 0.97, as);
        const pf = load > 0 ? P / load : 0;
        const endsF = sstep(-0.4 * rE, 0.9 * rE, u) * sstep(-0.2 * rE, 0.6 * rE, L - u + (tl - 0.5) * rE);
        let dep = hs * Math.pow(load, 0.8) * (0.5 + 0.5 * pf) * (0.72 + 0.28 * b) * ridge * endsF;
        if (blob > 0) dep += hs * blob * load * Math.exp(-((u / (0.55 * rE)) ** 2)) * 0.7 * (0.6 + 0.4 * b);
        if (lip > 0) dep += hs * lip * P * Math.exp(-(((L - u) / (0.4 * rE)) ** 2)) * (0.5 + 0.5 * b);
        dep *= shapeCov * contact * clipM;
        hgt[p] = hOld * (1 - scrape * cov * endsF * (0.3 + 0.7 * wet[p])) + dep * (op < 1 ? 0.6 + 0.4 * op : 1);
        const wn = cov * wetness;
        if (wn > wet[p]) wet[p] = wn;
        touched++;
      }
    }
    this.count++; this.area += touched;
  };

  Painter.prototype.dry = function (f) { const w = this.wet; for (let i = 0; i < w.length; i++) w[i] *= f; };

  // light the paint: relief from height + weave, raking light from upper left, oil sheen, occlusion
  Painter.prototype.render = function (out, o) {
    o = o || {};
    const W = this.W, H = this.H, N = W * H, h = this.h, wv = this.weave, col = this.col;
    const k = this.k;
    const HS = (o.heightScale || 2.2) , WS = (o.weaveScale || 0.9);
    const S = new Float32Array(N);
    for (let i = 0; i < N; i++) { const hh = h[i]; S[i] = hh * HS + wv[i] * WS / (1 + hh * 12); }
    // blurred surface for occlusion (box blur x2)
    const Bl = new Float32Array(N), T = new Float32Array(N);
    const rad = Math.max(2, Math.round(5 * k));
    boxBlur(S, T, Bl, W, H, rad); boxBlur(Bl, T, Bl, W, H, rad);
    let lx = -0.62, ly = -0.68, lz = 0.42; const ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; lz /= ln;
    let hx = lx, hy = ly, hz = lz + 1; const hn = Math.hypot(hx, hy, hz); hx /= hn; hy /= hn; hz /= hn;
    const relief = (o.relief || 1.0) * (1 / Math.max(0.5, k)) * 0.5;
    const spec = o.spec === undefined ? 0.11 : o.spec, aoK = o.ao === undefined ? 0.5 : o.ao;
    const diffAmt = o.diffuse === undefined ? 0.75 : o.diffuse;
    const lut = new Uint8ClampedArray(4096);
    for (let i = 0; i < 4096; i++) lut[i] = Math.round(R.toSrgb(i / 4095) * 255);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const xl = x > 0 ? i - 1 : i, xr = x < W - 1 ? i + 1 : i, yu = y > 0 ? i - W : i, yd = y < H - 1 ? i + W : i;
        const gx = (S[xr] - S[xl]) * relief, gy = (S[yd] - S[yu]) * relief;
        const nn = Math.sqrt(gx * gx + gy * gy + 1);
        const nx = -gx / nn, ny = -gy / nn, nz = 1 / nn;
        const d = (nx * lx + ny * ly + nz * lz) / lz;
        let shade = 1 + diffAmt * (d - 1);
        if (shade < 0.25) shade = 0.25;
        const occ = Bl[i] - S[i];
        const ao = occ > 0 ? Math.max(0.72, 1 - occ * aoK) : 1;
        const gloss = sstep(0.05, 0.6, h[i]);
        const nh = nx * hx + ny * hy + nz * hz;
        const sp = spec * gloss * Math.pow(nh > 0 ? nh : 0, 36) + spec * 0.2 * gloss * Math.pow(nh > 0 ? nh : 0, 6) - spec * 0.2 * gloss * 0.6;
        const m = shade * ao;
        const i3 = i * 3, o4 = i * 4;
        let r = col[i3] * m + (sp > 0 ? sp : 0), g = col[i3 + 1] * m + (sp > 0 ? sp : 0), b = col[i3 + 2] * m + (sp > 0 ? sp : 0);
        out[o4] = lut[Math.min(4095, Math.max(0, Math.round(r * 4095)))];
        out[o4 + 1] = lut[Math.min(4095, Math.max(0, Math.round(g * 4095)))];
        out[o4 + 2] = lut[Math.min(4095, Math.max(0, Math.round(b * 4095)))];
        out[o4 + 3] = 255;
      }
    }
  };
  // flat (unlit) colour, for the plan check
  Painter.prototype.renderFlat = function (out, src) {
    const N = this.W * this.H; src = src || this.col;
    for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(R.toSrgb(clamp(src[i * 3 + c], 0, 1)) * 255);
    for (let i = 0; i < N; i++) out[i * 4 + 3] = 255;
  };
  function boxBlur(src, tmp, dst, W, H, r) {
    const inv = 1 / (2 * r + 1);
    for (let y = 0; y < H; y++) {
      const row = y * W; let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, W - 1)];
      for (let x = 0; x < W; x++) { tmp[row + x] = acc * inv; acc += src[row + Math.min(W - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) { dst[y * W + x] = acc * inv; acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; }
    }
  }
  G.Painter = Painter;
  G.PaintUtil = { bentPts, boxBlur };
})(typeof window !== 'undefined' ? window : globalThis);
