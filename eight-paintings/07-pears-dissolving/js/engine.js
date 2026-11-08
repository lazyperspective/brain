// Oil paint engine: colour + height buffers, bristle brush, palette knife,
// glazes, canvas weave and a raking-light finish. Deterministic (seeded).
(function (G) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function hash1(x, s) { return hash2(x, 917, s); }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function vnoise1(x, s) {
    const xi = Math.floor(x), xf = x - xi;
    const u = xf * xf * (3 - 2 * xf);
    const a = hash1(xi, s), b = hash1(xi + 1, s);
    return a + (b - a) * u;
  }
  function fbm(x, y, s, oct) {
    let a = 0.5, f = 1, sum = 0, n = 0;
    for (let i = 0; i < oct; i++) { sum += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; }
    return sum / n;
  }
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  // ---------------------------------------------------------------- Canvas
  class PaintCanvas {
    constructor(W, H, seed, opt) {
      opt = opt || {};
      this.W = W; this.H = H; this.seed = seed;
      this.S = opt.scale || 1;          // px scale relative to 2160 wide master
      this.col = new Float32Array(W * H * 3);
      this.hgt = new Float32Array(W * H);
      this.ground = new Float32Array(W * H * 3);
      this.weave = new Float32Array(W * H);
      this.buildWeave(opt.weavePeriod || 5.2);
      const n = W * H;
      this.sd = new Float32Array(n); this.ss = new Float32Array(n); this.su = new Float32Array(n);
      this.sd.fill(1e9);
    }

    buildWeave(P0) {
      const { W, H, weave, S } = this;
      const P = Math.max(2.2, P0 * S);
      const sd = this.seed + 991;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          // threads wobble slightly
          const xw = x + 0.6 * (vnoise(y * 0.013, x / P * 0.05, sd) - 0.5) * P;
          const yw = y + 0.6 * (vnoise(x * 0.013, y / P * 0.05, sd + 3) - 0.5) * P;
          const fx = xw / P, fy = yw / P;
          const i = Math.floor(fx), j = Math.floor(fy);
          const ux = fx - i, uy = fy - j;
          const thx = 0.75 + 0.5 * hash1(i, sd + 7) + 0.25 * (vnoise(i * 3.1, y / P * 0.21, sd + 9) - 0.5);
          const thy = 0.75 + 0.5 * hash1(j, sd + 11) + 0.25 * (vnoise(j * 2.7, x / P * 0.19, sd + 13) - 0.5);
          const over = ((i + j) & 1) === 0;
          // warp (vertical thread) profile across x, undulating along y
          const pw = Math.sqrt(Math.max(0, Math.sin(Math.PI * ux))) * thx;
          const pf = Math.sqrt(Math.max(0, Math.sin(Math.PI * uy))) * thy;
          const bw = over ? 0.55 + 0.45 * Math.sin(Math.PI * uy) : 0.55 - 0.35 * Math.sin(Math.PI * uy);
          const bf = over ? 0.55 - 0.35 * Math.sin(Math.PI * ux) : 0.55 + 0.45 * Math.sin(Math.PI * ux);
          weave[y * W + x] = Math.max(pw * bw, pf * bf);
        }
      }
    }

    fill(r, g, b) {
      const c = this.col, gr = this.ground;
      for (let i = 0; i < this.W * this.H; i++) {
        c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
        gr[i * 3] = r; gr[i * 3 + 1] = g; gr[i * 3 + 2] = b;
      }
    }
    snapshotGround() { this.ground.set(this.col); }

    sample(x, y, out) {
      const { W, H, col } = this;
      x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
      const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
      const i00 = (yi * W + xi) * 3, i10 = i00 + 3, i01 = i00 + W * 3, i11 = i01 + 3;
      for (let k = 0; k < 3; k++) {
        const a = col[i00 + k] + (col[i10 + k] - col[i00 + k]) * fx;
        const b = col[i01 + k] + (col[i11 + k] - col[i01 + k]) * fx;
        out[k] = a + (b - a) * fy;
      }
      return out;
    }

    // ------------------------------------------------------------ stroke
    // o: {pts:[x0,y0,...], w, col:[r,g,b], col2, alpha, load, run, bristle, bfreq,
    //     cjit, thick, ridge, pick, smear, dry, rag, taper0, taper1, knife, mode, seed,
    //     flatten, hard}
    stroke(o) {
      const { W, H, col, hgt, weave, sd, ss, su } = this;
      const pts = o.pts;
      const np = pts.length >> 1;
      if (np < 2) return;
      const w = o.w, hw0 = w * 0.5;
      const cum = new Float32Array(np);
      for (let i = 1; i < np; i++) {
        const dx = pts[2 * i] - pts[2 * i - 2], dy = pts[2 * i + 1] - pts[2 * i - 1];
        cum[i] = cum[i - 1] + Math.sqrt(dx * dx + dy * dy);
      }
      const L = cum[np - 1];
      if (L < 0.5) return;
      const knife = !!o.knife;
      const mode = o.mode || 0; // 0 paint, 1 glaze (multiply), 2 scrape
      const seed = (o.seed || 1) | 0;
      const alpha0 = o.alpha == null ? 1 : o.alpha;
      const load0 = o.load == null ? 1 : o.load;
      const run = o.run || 1e9;
      const bristle = o.bristle == null ? 0.6 : o.bristle;
      const bfreq = o.bfreq || Math.max(6, w * 0.45);
      const cjit = o.cjit == null ? 0.25 : o.cjit;
      const thick = o.thick == null ? 0.5 : o.thick;
      const ridge = o.ridge == null ? 0.5 : o.ridge;
      const pick = o.pick == null ? 0.15 : o.pick;
      const smear = o.smear == null ? 0.2 : o.smear;
      const dry = o.dry == null ? 0.3 : o.dry;
      const rag = o.rag == null ? 0.18 : o.rag;
      const t0 = o.taper0 == null ? 0.35 : o.taper0;
      const t1 = o.taper1 == null ? 0.6 : o.taper1;
      const flatten = o.flatten == null ? (knife ? 0.85 : 0.45) : o.flatten;
      const aa = knife ? 0.7 : 1.1;
      const c1 = o.col, c2 = o.col2 || [c1[0] * 1.12 + 0.03, c1[1] * 1.1 + 0.03, c1[2] * 1.06 + 0.02];
      const streakLen = o.streak || (knife ? w * 1.5 : w * 4);

      // width profile
      const hwAt = (s) => {
        let f = 1;
        if (t0 > 0) f *= 1 - t0 * (1 - smooth(0, Math.min(L * 0.4, w * 0.9), s));
        if (t1 > 0) f *= 1 - t1 * (1 - smooth(L, L - Math.min(L * 0.5, w * 1.6), s));
        return hw0 * f;
      };

      // pickup colours along spine (canvas before stroke)
      const nsp = Math.max(2, Math.ceil(L / Math.max(1, w * 0.25)));
      const spC = new Float32Array(nsp * 3);
      const tmp = [0, 0, 0];
      {
        let seg = 0;
        for (let k = 0; k < nsp; k++) {
          const s = (k / (nsp - 1)) * L;
          while (seg < np - 2 && cum[seg + 1] < s) seg++;
          const sl = cum[seg + 1] - cum[seg] || 1;
          const t = clamp((s - cum[seg]) / sl, 0, 1);
          const x = pts[2 * seg] + (pts[2 * seg + 2] - pts[2 * seg]) * t;
          const y = pts[2 * seg + 1] + (pts[2 * seg + 3] - pts[2 * seg + 1]) * t;
          this.sample(x, y, tmp);
          spC[k * 3] = tmp[0]; spC[k * 3 + 1] = tmp[1]; spC[k * 3 + 2] = tmp[2];
        }
      }

      // bbox
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < np; i++) {
        x0 = Math.min(x0, pts[2 * i]); x1 = Math.max(x1, pts[2 * i]);
        y0 = Math.min(y0, pts[2 * i + 1]); y1 = Math.max(y1, pts[2 * i + 1]);
      }
      const pad = hw0 + 2;
      const bx0 = Math.max(0, Math.floor(x0 - pad)), by0 = Math.max(0, Math.floor(y0 - pad));
      const bx1 = Math.min(W - 1, Math.ceil(x1 + pad)), by1 = Math.min(H - 1, Math.ceil(y1 + pad));
      if (bx1 < bx0 || by1 < by0) return;

      // nearest-segment pass
      for (let i = 0; i < np - 1; i++) {
        const ax = pts[2 * i], ay = pts[2 * i + 1], bxp = pts[2 * i + 2], byp = pts[2 * i + 3];
        const dx = bxp - ax, dy = byp - ay;
        const l2 = dx * dx + dy * dy;
        if (l2 < 1e-6) continue;
        const sl = Math.sqrt(l2);
        const hwm = Math.max(hwAt(cum[i]), hwAt(cum[i + 1])) + 1.5;
        const sx0 = Math.max(bx0, Math.floor(Math.min(ax, bxp) - hwm)), sx1 = Math.min(bx1, Math.ceil(Math.max(ax, bxp) + hwm));
        const sy0 = Math.max(by0, Math.floor(Math.min(ay, byp) - hwm)), sy1 = Math.min(by1, Math.ceil(Math.max(ay, byp) + hwm));
        const first = i === 0, last = i === np - 2;
        for (let y = sy0; y <= sy1; y++) {
          const py = y + 0.5 - ay;
          let idx = y * W + sx0;
          for (let x = sx0; x <= sx1; x++, idx++) {
            const px = x + 0.5 - ax;
            let t = (px * dx + py * dy) / l2;
            if (t < 0) { if (!first) continue; t = 0; }
            else if (t > 1) { if (!last) continue; t = 1; }
            const cx = px - dx * t, cy = py - dy * t;
            const d = Math.sqrt(cx * cx + cy * cy);
            if (d < sd[idx]) {
              sd[idx] = d;
              ss[idx] = cum[i] + t * sl;
              su[idx] = (dx * cy - dy * cx) >= 0 ? d : -d;
            }
          }
        }
      }

      // composite pass
      const sAll = o.wv == null ? 1 : o.wv;
      for (let y = by0; y <= by1; y++) {
        let idx = y * W + bx0;
        for (let x = bx0; x <= bx1; x++, idx++) {
          const d = sd[idx];
          if (d > 1e8) continue;
          sd[idx] = 1e9;
          const s = ss[idx];
          const hw = hwAt(s);
          if (hw <= 0.05) continue;
          let u = su[idx] / hw; // -1..1
          // ragged edge
          const side = u >= 0 ? 1 : 0;
          const edgeN = rag * (vnoise1(s / (w * 0.35 + 2) + side * 50, seed + 5) - 0.5) * 2
            + rag * 0.5 * (vnoise1(s / 3.1 + side * 70, seed + 6) - 0.5);
          const lim = 1 - Math.max(0, edgeN) * 0.6 + Math.min(0, edgeN) * 0.6;
          const au = Math.abs(u);
          let ae = clamp((lim - au) * hw / aa + 0.5, 0, 1);
          if (ae <= 0) continue;
          // bristles
          const drift = 0.06 * (vnoise1(s / (w * 1.7 + 4), seed + 9) - 0.5);
          const bu = (u + drift + 1) * 0.5 * bfreq;
          let b = vnoise1(bu, seed) * 0.65 + vnoise1(bu * 2.3, seed + 1) * 0.35;
          b = clamp((b - 0.5) * 1.8 + 0.5, 0, 1);
          // paint load along length
          const ld = load0 * Math.exp(-s / run);
          let P = ld * (1 - bristle * (1 - b));
          if (knife) {
            // knife skips: elongated holes along drag
            const sk = vnoise(s / streakLen, (u + 1) * 3.5, seed + 21);
            P *= smooth(0.12, 0.3, sk + 0.25 * (ld - 0.6));
          }
          const wv = weave[idx];
          let cov = smooth(0.06, 0.32, P - dry * (1 - wv) * 0.9 * sAll);
          let a = ae * cov * alpha0;
          if (a <= 0.002) continue;
          const o3 = idx * 3;
          const or = col[o3], og = col[o3 + 1], ob = col[o3 + 2];
          if (mode === 1) { // glaze: transparent multiply
            const gm = a;
            col[o3] = or * (1 - gm + gm * c1[0]);
            col[o3 + 1] = og * (1 - gm + gm * c1[1]);
            col[o3 + 2] = ob * (1 - gm + gm * c1[2]);
            hgt[idx] += thick * a * 0.1;
            continue;
          }
          if (mode === 2) { // scrape back toward ground
            const gr = this.ground;
            col[o3] = mix(or, gr[o3], a); col[o3 + 1] = mix(og, gr[o3 + 1], a); col[o3 + 2] = mix(ob, gr[o3 + 2], a);
            hgt[idx] *= 1 - a * 0.85;
            continue;
          }
          // streaky pigment mixing
          const sm = vnoise(s / streakLen, bu * 0.55, seed + 31);
          const m2 = clamp((sm - 0.5) * 2.2 + 0.5, 0, 1) * cjit;
          let pr = c1[0] + (c2[0] - c1[0]) * m2;
          let pg = c1[1] + (c2[1] - c1[1]) * m2;
          let pb = c1[2] + (c2[2] - c1[2]) * m2;
          // smear: colour carried from earlier along the spine
          if (smear > 0) {
            const lag = Math.max(0, s - w * 0.9);
            const k = Math.min(nsp - 1, Math.round((lag / L) * (nsp - 1))) * 3;
            const f = smear * (0.35 + 0.65 * (1 - ld / (load0 + 1e-6))) * (0.4 + 0.6 * (1 - b));
            pr += (spC[k] - pr) * f; pg += (spC[k + 1] - pg) * f; pb += (spC[k + 2] - pb) * f;
          }
          // wet-in-wet local pickup
          if (pick > 0) {
            const f = pick * (1 - b) * (0.5 + 0.5 * au);
            pr += (or - pr) * f; pg += (og - pg) * f; pb += (ob - pb) * f;
          }
          col[o3] = or + (pr - or) * a;
          col[o3 + 1] = og + (pg - og) * a;
          col[o3 + 2] = ob + (pb - ob) * a;
          // height
          let hp = thick * (0.55 + 0.45 * b) * Math.min(1.2, P + 0.2);
          hp += thick * ridge * Math.exp(-((au - 0.86) * (au - 0.86)) / 0.012) * (knife ? 1.3 : 1);
          hp += thick * 0.9 * Math.exp(-s / (w * 0.35 + 1)) * (knife ? 0.3 : 1);
          if (knife) {
            const e = (L - s) / (w * 0.06 + 1);
            hp += thick * 1.6 * Math.exp(-e * e) * (0.6 + 0.8 * vnoise1(u * 6, seed + 41));
            hp *= 0.75 + 0.5 * (s / L);
          }
          hgt[idx] = hgt[idx] * (1 - a * flatten) + hp * a;
        }
      }
    }

    // transparent glaze applied per pixel with a mask function m(x,y) in 0..1
    glazeField(colr, maskFn, strength, seed) {
      const { W, H, col } = this;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const m = maskFn(x, y);
        if (m <= 0) continue;
        const rag = 0.7 + 0.6 * fbm(x / (60 * this.S), y / (60 * this.S), seed, 3);
        const a = clamp(m * strength * rag, 0, 1);
        const o3 = (y * W + x) * 3;
        col[o3] *= 1 - a + a * colr[0]; col[o3 + 1] *= 1 - a + a * colr[1]; col[o3 + 2] *= 1 - a + a * colr[2];
      }
    }

    // ------------------------------------------------------------ finish
    finish(o) {
      o = o || {};
      const { W, H, col, hgt, weave, S } = this;
      const L = o.light || [-0.62, -0.48, 0.62];
      const ll = Math.hypot(L[0], L[1], L[2]);
      const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
      let hx = lx, hy = ly, hz = lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
      const relief = (o.relief || 2.2) / S;      // height-to-slope factor
      const weaveAmp = o.weaveAmp == null ? 0.35 : o.weaveAmp;
      const weaveFill = o.weaveFill || 0.6;
      const strength = o.strength == null ? 0.85 : o.strength;
      const spec = o.spec == null ? 0.07 : o.spec;
      const specPow = o.specPow || 28;
      const out = new Uint8ClampedArray(W * H * 4);
      const T = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const h = hgt[i];
        T[i] = h + weave[i] * weaveAmp * Math.exp(-Math.max(0, h) / weaveFill);
      }
      const base = Math.pow(hz, specPow);
      for (let y = 0; y < H; y++) {
        const ym = y > 0 ? y - 1 : 0, yp = y < H - 1 ? y + 1 : H - 1;
        for (let x = 0; x < W; x++) {
          const xm = x > 0 ? x - 1 : 0, xp = x < W - 1 ? x + 1 : W - 1;
          const i = y * W + x;
          const gx = (T[y * W + xp] - T[y * W + xm]) * 0.5 * relief;
          const gy = (T[yp * W + x] - T[ym * W + x]) * 0.5 * relief;
          const nl = Math.sqrt(gx * gx + gy * gy + 1);
          const nx = -gx / nl, ny = -gy / nl, nz = 1 / nl;
          let d = (nx * lx + ny * ly + nz * lz) / lz;
          d = clamp(d, 0.25, 1.9);
          const f = 1 + (d - 1) * strength;
          let sp = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), specPow) - base;
          sp = Math.max(0, sp) * spec;
          const o3 = i * 3, o4 = i * 4;
          const dith = (hash2(x, y, 77) - 0.5) / 255;
          const lum = 0.3 * col[o3] + 0.59 * col[o3 + 1] + 0.11 * col[o3 + 2];
          const spk = sp * (0.35 + 0.65 * Math.min(1, lum * 2.5));
          out[o4] = (clamp(col[o3] * f + spk + dith, 0, 1) * 255 + 0.5) | 0;
          out[o4 + 1] = (clamp(col[o3 + 1] * f + spk * 0.98 + dith, 0, 1) * 255 + 0.5) | 0;
          out[o4 + 2] = (clamp(col[o3 + 2] * f + spk * 0.94 + dith, 0, 1) * 255 + 0.5) | 0;
          out[o4 + 3] = 255;
        }
      }
      return out;
    }
  }

  // ------------------------------------------------------------ helpers
  function boxBlur3(src, W, H, r, ch) {
    // separable box blur run twice ~ gaussian; src Float32 with ch channels
    if (r < 1) return src.slice();
    let a = src.slice(), b = new Float32Array(src.length);
    for (let pass = 0; pass < 2; pass++) {
      // horizontal
      for (let y = 0; y < H; y++) {
        for (let c = 0; c < ch; c++) {
          let acc = 0; const row = y * W;
          for (let k = -r; k <= r; k++) acc += a[(row + clamp(k, 0, W - 1)) * ch + c];
          for (let x = 0; x < W; x++) {
            b[(row + x) * ch + c] = acc / (2 * r + 1);
            acc += a[(row + Math.min(W - 1, x + r + 1)) * ch + c] - a[(row + Math.max(0, x - r)) * ch + c];
          }
        }
      }
      // vertical
      for (let x = 0; x < W; x++) {
        for (let c = 0; c < ch; c++) {
          let acc = 0;
          for (let k = -r; k <= r; k++) acc += b[(clamp(k, 0, H - 1) * W + x) * ch + c];
          for (let y = 0; y < H; y++) {
            a[(y * W + x) * ch + c] = acc / (2 * r + 1);
            acc += b[(Math.min(H - 1, y + r + 1) * W + x) * ch + c] - b[(Math.max(0, y - r) * W + x) * ch + c];
          }
        }
      }
    }
    return a;
  }

  function sampleBuf(buf, W, H, x, y, ch, out) {
    x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
    const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
    const i00 = (yi * W + xi) * ch, i10 = i00 + ch, i01 = i00 + W * ch, i11 = i01 + ch;
    for (let k = 0; k < ch; k++) {
      const a = buf[i00 + k] + (buf[i10 + k] - buf[i00 + k]) * fx;
      const b = buf[i01 + k] + (buf[i11 + k] - buf[i01 + k]) * fx;
      out[k] = a + (b - a) * fy;
    }
    return out;
  }

  // structure-tensor orientation field (angle of isophotes), smoothed
  function orientationField(lum, W, H, r) {
    const n = W * H;
    const jxx = new Float32Array(n), jxy = new Float32Array(n), jyy = new Float32Array(n);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = (lum[i + 1 - W] + 2 * lum[i + 1] + lum[i + 1 + W] - lum[i - 1 - W] - 2 * lum[i - 1] - lum[i - 1 + W]);
      const gy = (lum[i + W - 1] + 2 * lum[i + W] + lum[i + W + 1] - lum[i - W - 1] - 2 * lum[i - W] - lum[i - W + 1]);
      jxx[i] = gx * gx; jxy[i] = gx * gy; jyy[i] = gy * gy;
    }
    const pack = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pack[i * 3] = jxx[i]; pack[i * 3 + 1] = jxy[i]; pack[i * 3 + 2] = jyy[i]; }
    const sm = boxBlur3(pack, W, H, r, 3);
    const ang = new Float32Array(n), coh = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = sm[i * 3], b = sm[i * 3 + 1], c = sm[i * 3 + 2];
      // gradient orientation
      const th = 0.5 * Math.atan2(2 * b, a - c);
      ang[i] = th + Math.PI / 2; // isophote
      const tr = a + c;
      coh[i] = tr > 1e-9 ? Math.sqrt((a - c) * (a - c) + 4 * b * b) / tr : 0;
    }
    return { ang, coh };
  }

  // trace a stroke spine along an orientation field
  // dirFn(x,y) -> angle; stopFn(x,y,len) -> true to stop
  function traceSpine(x, y, dirFn, maxLen, step, rnd, opt) {
    opt = opt || {};
    const pts = [x, y];
    let a = dirFn(x, y);
    let dx = Math.cos(a), dy = Math.sin(a);
    if (opt.flip != null ? opt.flip : rnd() < 0.5) { dx = -dx; dy = -dy; }
    const inertia = opt.inertia == null ? 0.55 : opt.inertia;
    const bend = opt.bend || 0;
    let len = 0;
    while (len < maxLen) {
      const na = dirFn(x, y) + bend * (len / maxLen);
      let nx = Math.cos(na), ny = Math.sin(na);
      if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
      dx = dx * inertia + nx * (1 - inertia); dy = dy * inertia + ny * (1 - inertia);
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      x += dx * step; y += dy * step; len += step;
      if (opt.stop && opt.stop(x, y, len)) break;
      pts.push(x, y);
    }
    return pts;
  }

  G.Paint = { mulberry32, hash2, hash1, vnoise, vnoise1, fbm, clamp, smooth, mix, PaintCanvas, boxBlur3, sampleBuf, orientationField, traceSpine };
})(typeof window !== 'undefined' ? window : globalThis);
