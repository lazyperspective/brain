// Phosphor: renderer. Everything is computed in JS float buffers (deterministic), then tone-mapped once.
//   1. trace: the display list -> beam samples (position, deposited energy, path-time)
//   2. splat: each sample deposits a small focus/astigmatism spot into the energy buffer
//   3. phosphor: saturation, grain, then a glow pyramid (phosphor scatter, faceplate halation, lens glare)
//   4. composite over the static instrument (panel, bezel, knobs, graticule, glass) and tone-map like a camera
(function () {
  const PH = window.PH;
  const { clamp, smooth, lerp, TAU } = PH;

  function Renderer(W, H) {
    this.W = W; this.H = H;
    const s = (this.s = W / 2160);
    this.cx = 1080 * s; this.cy = 1110 * s; this.R = 900 * s;
    this.E = new Float32Array(W * H);
    this.out = new Uint8ClampedArray(W * H * 4);
    this.levels = [];
    let w = W, h = H;
    for (let k = 1; k <= 6; k++) {
      w = Math.ceil(w / 2); h = Math.ceil(h / 2);
      this.levels.push({ w, h, a: new Float32Array(w * h), b: new Float32Array(w * h), acc: new Float32Array(w * h) });
    }
    this.P = Object.assign({}, Renderer.defaults);
    this.ready = false;
  }

  Renderer.defaults = {
    sigma: 2.25, // focused spot sigma at 4K (px)
    hstep: 0.55, // sample spacing along the path (px at 4K)
    jumpB: 0.014, // retrace brightness
    expo: 0.85,
    sat: 120, // phosphor saturation level
    halo: [0.26, 0.15, 0.09, 0.05, 0.022, 0.012], // glow pyramid weights (levels 1..6)
    glareFrom: 4, // levels >= this spill outside the glass (camera glare)
    tailA: 1.0, tailL: 0.05, headA: 6.0, headL: 0.0028,
    phos: [0.17, 1.0, 0.36],
    ringT: 4.0, ringK: 0.3,
  };

  // ------------------------------------------------------------------ trace
  Renderer.prototype.trace = function (t) {
    const P = this.P, sc = this.s, R = this.R, cx = this.cx, cy = this.cy;
    const list = PH.scene.build(t);
    const xs = [], ys = [], es = [], ds = []; // ds: energy per unit length (beam dwell)
    const h = P.hstep * sc;
    let last = null;
    const pushSeg = (pts, opt) => {
      // pts in px; resample by arc length with weights
      const n = pts.length;
      if (n === 1) { last = pts[0]; return; }
      const cum = [0];
      for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const Ltot = cum[n - 1];
      if (Ltot < 1e-6) { last = pts[n - 1]; return; }
      const m = Math.max(1, Math.ceil(Ltot / h));
      const step = Ltot / m;
      const sx = [], sy = [], sw = [];
      let j = 0;
      const ta = (opt.ta || 0) * R, tb = (opt.tb || 0) * R, tmin = opt.tmin == null ? 0.25 : opt.tmin;
      for (let k = 0; k < m; k++) {
        const d = (k + 0.5) * step;
        while (j < n - 2 && cum[j + 1] < d) j++;
        const f = (d - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
        const x = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f;
        let wgt = 1;
        if (ta > 0) wgt *= tmin + (1 - tmin) * smooth(0, ta, d);
        if (tb > 0) wgt *= tmin + (1 - tmin) * smooth(0, tb, Ltot - d);
        if (opt.prof) wgt *= opt.prof(d / Ltot);
        if (opt.profPts) wgt *= opt.profPts[j] + (opt.profPts[j + 1] - opt.profPts[j]) * f;
        sx.push(x); sy.push(y); sw.push(wgt);
      }
      if (opt.wob) {
        // analogue imperfection: the deflection is never perfectly clean; a slight, fixed wander along the stroke
        for (let k = 1; k < m - 1; k++) {
          const tx = sx[k + 1] - sx[k - 1], ty = sy[k + 1] - sy[k - 1], tl = Math.hypot(tx, ty) + 1e-9;
          const d = ((k + 0.5) * step) / sc;
          const o = opt.wob * sc * (0.7 * PH.vnoise(d / 23, 0.5, opt.seed) + 0.3 * PH.vnoise(d / 7, 0.5, opt.seed + 1));
          sx[k] += (-ty / tl) * o; sy[k] += (tx / tl) * o;
        }
      }
      // the beam slows at sharp turns (deflection amplifier slew): corners glow a little brighter
      if (!opt.noCorner) {
        const M = Math.max(2, Math.round(5 * sc / h * 0.55));
        const boost = new Float32Array(m);
        for (let k = 0; k < m; k++) {
          const a = Math.max(0, k - M), b = Math.min(m - 1, k + M);
          if (b - a < 2) continue;
          const ux = sx[k] - sx[a], uy = sy[k] - sy[a], vx = sx[b] - sx[k], vy = sy[b] - sy[k];
          const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
          if (lu < 1e-6 || lv < 1e-6) continue;
          const c = clamp((ux * vx + uy * vy) / (lu * lv), -1, 1);
          boost[k] = Math.acos(c) / Math.PI;
        }
        for (let k = 0; k < m; k++) sw[k] *= 1 + 0.9 * boost[k];
      }
      let total = 0;
      for (let k = 0; k < m; k++) total += sw[k] * step;
      const scale = opt.slot != null ? (opt.slot * R) / Math.max(1e-9, total) : opt.b;
      for (let k = 0; k < m; k++) { xs.push(sx[k]); ys.push(sy[k]); es.push(sw[k] * step * scale); ds.push(sw[k] * scale); }
      last = pts[n - 1];
    };
    // the drawing sits a little low on the screen so the horizon falls clear of the graticule's centre axis
    const DY = PH.scene.DY;
    const toPx = (p) => [cx + p[0] * R, cy - (p[1] + DY) * R];
    const jumpTo = (p, b) => {
      if (!last) { last = p; return; }
      const dx = p[0] - last[0], dy = p[1] - last[1], L = Math.hypot(dx, dy);
      if (L < 0.3 * sc) return;
      // straight retrace, overshooting slightly and settling (a small hook where the beam lands)
      const ov = Math.min(7 * sc, 0.05 * L), ux = dx / L, uy = dy / L;
      const pts = [last, p, [p[0] + ux * ov, p[1] + uy * ov], [p[0] - ux * ov * 0.35, p[1] - uy * ov * 0.35], p];
      const save = last;
      pushSeg(pts, { b: b == null ? P.jumpB : b, noCorner: true, prof: (f) => 1 + 3.0 * smooth(0.82, 1, f) * (L > 30 * sc ? 1 : 0) });
      last = p;
      return save;
    };
    let si = 0;
    for (const st of list) {
      if (st.spray) {
        for (const d of st.spray) {
          const c = toPx(d);
          jumpTo(c, 0.008);
          const pts = [];
          const r = 1.6 * this.s, air = d[2] == null ? 1 : d[2], ex = r + (1 - air) * 0.028 * this.R;
          for (let k = 0; k <= 12; k++) pts.push([c[0] + ex * Math.cos((TAU * k) / 12), c[1] + r * Math.sin((TAU * k) / 12)]);
          pushSeg(pts, { slot: 0.0045, noCorner: true });
        }
        continue;
      }
      const pts = st.pts.map(toPx);
      jumpTo(pts[0], st.hidden ? 0.05 : st.jb);
      if (!st.hidden && st.slot == null) { st.wob = 0.7; st.seed = 100 + (si * 7) % 997; }
      si++;
      pushSeg(pts, st);
    }
    // close the loop back to the first point
    const first = PH.scene.build(t)[0].pts[0];
    jumpTo(toPx(first));
    // path-time: cumulative energy (the beam's time is proportional to the energy it deposits)
    const n = es.length, u = new Float32Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) acc += es[i];
    let c = 0;
    for (let i = 0; i < n; i++) { u[i] = (c + es[i] * 0.5) / acc; c += es[i]; }
    return { xs, ys, es, ds, u, n, total: acc };
  };

  // ------------------------------------------------------------------ splat
  const WX = new Float32Array(128), WY = new Float32Array(128);
  Renderer.prototype.splat = function (x, y, e, sig) {
    const W = this.W, H = this.H, E = this.E;
    const R = Math.ceil(sig * 2.8);
    const ix = Math.round(x), iy = Math.round(y);
    if (ix + R < 0 || iy + R < 0 || ix - R >= W || iy - R >= H) return;
    const k2 = 1 / (2 * sig * sig);
    let sx = 0, sy = 0;
    for (let k = -R; k <= R; k++) {
      const dx = ix + k - x, dy = iy + k - y;
      const a = Math.exp(-dx * dx * k2), b = Math.exp(-dy * dy * k2);
      WX[k + R] = a; WY[k + R] = b; sx += a; sy += b;
    }
    const norm = e / (sx * sy);
    const x0 = Math.max(0, ix - R), x1 = Math.min(W - 1, ix + R), y0 = Math.max(0, iy - R), y1 = Math.min(H - 1, iy + R);
    for (let yy = y0; yy <= y1; yy++) {
      const wy = WY[yy - iy + R] * norm;
      if (wy < 1e-7) continue;
      const row = yy * W;
      for (let xx = x0; xx <= x1; xx++) E[row + xx] += WX[xx - ix + R] * wy;
    }
  };

  // ------------------------------------------------------------------ glow pyramid helpers
  function down(src, sw, sh, dst, dw, dh) {
    for (let y = 0; y < dh; y++) {
      const y0 = Math.min(sh - 1, 2 * y), y1 = Math.min(sh - 1, 2 * y + 1);
      for (let x = 0; x < dw; x++) {
        const x0 = Math.min(sw - 1, 2 * x), x1 = Math.min(sw - 1, 2 * x + 1);
        dst[y * dw + x] = 0.25 * (src[y0 * sw + x0] + src[y0 * sw + x1] + src[y1 * sw + x0] + src[y1 * sw + x1]);
      }
    }
  }
  const KC = {};
  function kernel(sig) {
    const key = sig.toFixed(3);
    if (KC[key]) return KC[key];
    const R = Math.ceil(sig * 3);
    const k = new Float32Array(2 * R + 1);
    let s = 0;
    for (let i = -R; i <= R; i++) { k[i + R] = Math.exp(-(i * i) / (2 * sig * sig)); s += k[i + R]; }
    for (let i = 0; i < k.length; i++) k[i] /= s;
    return (KC[key] = k);
  }
  function blur(a, tmp, w, h, sig) {
    const k = kernel(sig), R = (k.length - 1) >> 1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = -R; i <= R; i++) { const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i; s += a[row + xx] * k[i + R]; }
        tmp[row + x] = s;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = -R; i <= R; i++) { const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i; s += tmp[yy * w + x] * k[i + R]; }
        a[y * w + x] = s;
      }
    }
  }
  // bilinear sample of a level buffer at full-res pixel centre coords
  function upAdd(src, sw, sh, dst, dw, dh, scale) {
    // dst (dw x dh) += bilinear upsample of src (sw x sh), src texel = 2 dst texels
    for (let y = 0; y < dh; y++) {
      let fy = (y + 0.5) / 2 - 0.5; if (fy < 0) fy = 0; if (fy > sh - 1) fy = sh - 1;
      const y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < dw; x++) {
        let fx = (x + 0.5) / 2 - 0.5; if (fx < 0) fx = 0; if (fx > sw - 1) fx = sw - 1;
        const x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
        const a = src[y0 * sw + x0] + (src[y0 * sw + x1] - src[y0 * sw + x0]) * tx;
        const b = src[y1 * sw + x0] + (src[y1 * sw + x1] - src[y1 * sw + x0]) * tx;
        dst[y * dw + x] += (a + (b - a) * ty) * scale;
      }
    }
  }

  // ------------------------------------------------------------------ render
  Renderer.prototype.render = function (t) {
    const P = this.P, W = this.W, H = this.H, E = this.E, sc = this.s;
    const t0 = performance.now();
    E.fill(0);
    const tr = this.trace(t);
    // the bright head: the camera/refresh beat makes the beam's current position crawl round the drawing once a LAP
    const uh = (((t / PH.scene.LAP) % 1) + 1) % 1;
    const cx = this.cx, cy = this.cy, Rr = this.R;
    const sig0 = P.sigma * sc;
    const knorm = Math.sqrt(TAU) * sig0 * P.expo;
    for (let i = 0; i < tr.n; i++) {
      let a = uh - tr.u[i]; if (a < 0) a += 1;
      // the head and its fresh tail show where the beam lingers; where it races (fills, retraces) they are faint
      const cm = smooth(0.06, 0.45, tr.ds[i]);
      const comet = cm * (P.tailA * Math.exp(-a / P.tailL) + P.headA * Math.exp(-a / P.headL) * (a < 0.5 ? 1 : 0));
      const e = tr.es[i] * (1 + comet) * knorm;
      const x = tr.xs[i], y = tr.ys[i];
      const dx = x - cx, dy = y - cy, rho2 = (dx * dx + dy * dy) / (Rr * Rr);
      if (rho2 > 1.08) continue; // behind the bezel
      const sig = sig0 * (1 + 0.42 * rho2);
      // astigmatism: the spot stretches tangentially toward the edge (and a little everywhere)
      const rl = Math.sqrt(rho2) + 1e-6;
      let axx = (-dy / Rr / rl) * rho2 + 0.18 * 0.866, axy = (dx / Rr / rl) * rho2 + 0.18 * 0.5;
      const al = Math.hypot(axx, axy) + 1e-9;
      const d = sig0 * (0.25 + 1.2 * rho2) * 0.9;
      axx /= al; axy /= al;
      this.splat(x - axx * d, y - axy * d, e * 0.28, sig);
      this.splat(x, y, e * 0.44, sig);
      this.splat(x + axx * d, y + axy * d, e * 0.28, sig);
    }
    const tSplat = performance.now();
    // phosphor saturation + grain (in place): E becomes emitted radiance L
    const S = P.sat, mask = this.mask, grain = this.grain;
    for (let i = 0; i < W * H; i++) {
      const v = E[i];
      if (v > 0) E[i] = S * (1 - Math.exp(-v / S)) * grain[i] * mask[i];
    }
    // glow pyramid
    const L = this.levels;
    down(E, W, H, L[0].a, L[0].w, L[0].h);
    for (let k = 1; k < L.length; k++) down(L[k - 1].a, L[k - 1].w, L[k - 1].h, L[k].a, L[k].w, L[k].h);
    const sigs = [2.2, 2.2, 2.2, 2.4, 2.6, 3.0];
    // blur a copy into acc
    for (let k = 0; k < L.length; k++) { L[k].acc.set(L[k].a); blur(L[k].acc, L[k].b, L[k].w, L[k].h, sigs[k]); }
    // CRT halation ring: light from a very bright spot, totally reflected inside the faceplate, returns as a faint
    // ring about two glass thicknesses out (only the lamp's dwell spot is bright enough to show one)
    {
      const Lr = L[2], w = Lr.w, h = Lr.h, src = Lr.a;
      if (!this.ring) this.ring = new Float32Array(w * h);
      const ring = this.ring; ring.fill(0);
      const r0 = (215 * sc) / 8, rw = (26 * sc) / 8, T = P.ringT;
      const RR = Math.ceil(r0 + 3 * rw);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = src[y * w + x] / (sc * sc) - T;
        if (v <= 0) continue;
        const amp = (v * sc * sc * P.ringK) / (TAU * r0 * rw * Math.sqrt(Math.PI));
        for (let dy = -RR; dy <= RR; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -RR; dx <= RR; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const q = (Math.sqrt(dx * dx + dy * dy) - r0) / rw;
            if (q * q < 9) ring[yy * w + xx] += amp * Math.exp(-q * q);
          }
        }
      }
      blur(ring, Lr.b, w, h, 1.2);
      for (let i = 0; i < w * h; i++) Lr.acc[i] += ring[i] / P.halo[2];
    }
    // glare (outside too): levels >= glareFrom; halo (inside): all levels
    const gf = P.glareFrom;
    // build halo accumulation in place: from coarse to fine
    // keep a separate glare accumulation at level gf-1 resolution
    const halo = P.halo;
    // glare chain
    const G = L[gf - 1];
    if (!this.glare) this.glare = new Float32Array(G.w * G.h);
    const glare = this.glare;
    {
      const tmp = L[L.length - 1].b; // scratch
      let cur = new Float32Array(L[L.length - 1].acc.length);
      for (let i = 0; i < cur.length; i++) cur[i] = L[L.length - 1].acc[i] * halo[L.length - 1];
      for (let k = L.length - 2; k >= gf - 1; k--) {
        const nxt = new Float32Array(L[k].w * L[k].h);
        for (let i = 0; i < nxt.length; i++) nxt[i] = L[k].acc[i] * halo[k];
        upAdd(cur, L[k + 1].w, L[k + 1].h, nxt, L[k].w, L[k].h, 1);
        cur = nxt;
      }
      glare.set(cur);
      void tmp;
    }
    // halo chain (levels below gf), accumulated at level 0 (half res)
    let cur = null;
    for (let k = gf - 2; k >= 0; k--) {
      const nxt = L[k].b; // reuse scratch
      for (let i = 0; i < L[k].w * L[k].h; i++) nxt[i] = L[k].acc[i] * halo[k];
      if (cur) upAdd(cur.buf, cur.w, cur.h, nxt, L[k].w, L[k].h, 1);
      cur = { buf: nxt, w: L[k].w, h: L[k].h };
    }
    this.haloBuf = cur;
    // global & local light for the panel: total emission and the coarse glow
    let tot = 0; const top = L[L.length - 1];
    for (let i = 0; i < top.a.length; i++) tot += top.a[i];
    this.lightLevel = tot / top.a.length;
    const tGlow = performance.now();
    this.composite();
    this.lastMs = performance.now() - t0;
    this.timing = { splat: tSplat - t0, glow: tGlow - tSplat, comp: performance.now() - tGlow, samples: tr.n };
  };

  Renderer.prototype.composite = function () {
    const W = this.W, H = this.H, E = this.E, P = this.P, out = this.out;
    const hb = this.haloBuf, hw = hb.w, hh = hb.h, hbuf = hb.buf;
    const gw = this.levels[P.glareFrom - 1].w, gh = this.levels[P.glareFrom - 1].h, gbuf = this.glare;
    const gscale = W / gw; // glare level texel size in px
    const pr = P.phos[0], pg = P.phos[1], pb = P.phos[2];
    const fvig = this.fvig, stat = this.stat, lit = this.lit, mask = this.mask, gcov = this.gcov, vign = this.vign, dith = this.dith;
    const LUT = this.lut, LN = LUT.length - 1;
    const ll = this.lightLevel / this.refLight;
    const lipF = this.lipF, lipI = this.lipI, top = this.levels[5].acc;
    // per row interpolation helpers for the half-res halo and the glare level
    for (let y = 0; y < H; y++) {
      let fy = (y + 0.5) / 2 - 0.5; if (fy < 0) fy = 0; if (fy > hh - 1) fy = hh - 1;
      const hy0 = Math.floor(fy), hy1 = Math.min(hh - 1, hy0 + 1), hty = fy - hy0;
      let gy = (y + 0.5) / gscale - 0.5; if (gy < 0) gy = 0; if (gy > gh - 1) gy = gh - 1;
      const gy0 = Math.floor(gy), gy1 = Math.min(gh - 1, gy0 + 1), gty = gy - gy0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let fx = (x + 0.5) / 2 - 0.5; if (fx < 0) fx = 0; if (fx > hw - 1) fx = hw - 1;
        const hx0 = Math.floor(fx), hx1 = Math.min(hw - 1, hx0 + 1), htx = fx - hx0;
        const a0 = hbuf[hy0 * hw + hx0], a1 = hbuf[hy0 * hw + hx1], b0 = hbuf[hy1 * hw + hx0], b1 = hbuf[hy1 * hw + hx1];
        const halo = (a0 + (a1 - a0) * htx) * (1 - hty) + (b0 + (b1 - b0) * htx) * hty;
        let gx = (x + 0.5) / gscale - 0.5; if (gx < 0) gx = 0; if (gx > gw - 1) gx = gw - 1;
        const gx0 = Math.floor(gx), gx1 = Math.min(gw - 1, gx0 + 1), gtx = gx - gx0;
        const c0 = gbuf[gy0 * gw + gx0], c1 = gbuf[gy0 * gw + gx1], d0 = gbuf[gy1 * gw + gx0], d1 = gbuf[gy1 * gw + gx1];
        const glare = (c0 + (c1 - c0) * gtx) * (1 - gty) + (d0 + (d1 - d0) * gtx) * gty;
        const m = mask[i];
        // phosphor + faceplate halation (inside), lens glare (everywhere)
        const g = (E[i] + halo * m) * vign[i] + glare;
        let r = g * pr, gg = g * pg, b = g * pb;
        // graticule: engraved lines scatter the trace's own light
        const gc = gcov[i];
        if (gc > 0) { const q = gc * (halo * 0.9 + E[i] * 0.05 + glare * 2.0); r += q * 0.35; gg += q; b += q * 0.5; }
        const j = i * 3;
        r += stat[j] + lit[j] * ll; gg += stat[j + 1] + lit[j + 1] * ll; b += stat[j + 2] + lit[j + 2] * ll;
        const lf = lipF[i];
        if (lf > 0) { const lv = top[lipI[i]] * lf; r += lv * pr; gg += lv * pg; b += lv * pb; }
        // highlight bleed: an over-exposed green spills into the other channels (white-green core)
        const fv = fvig[i]; r *= fv; gg *= fv; b *= fv;
        const ex = gg - 0.75;
        if (ex > 0) { r += ex * 0.55; b += ex * 0.42; }
        const o = i * 4, dd = dith[i];
        let ur = r / (r + 1), ug = gg / (gg + 1), ub = b / (b + 1);
        out[o] = LUT[(ur * LN + 0.5) | 0] + dd;
        out[o + 1] = LUT[(ug * LN + 0.5) | 0] + dd;
        out[o + 2] = LUT[(ub * LN + 0.5) | 0] + dd;
        out[o + 3] = 255;
      }
    }
  };

  PH.Renderer = Renderer;
})();
