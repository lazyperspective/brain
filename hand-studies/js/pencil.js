/* pencil.js — the hand that holds the pen. Everything below is a stroke placed on the sheet:
 * an underdrawing of joint circles and bone axes, form-following cross-contour hatching,
 * the habitual diagonal hatching (cross-hatched as it darkens), stippling in the half-tones,
 * lost-and-found contours, creases, nails and veins. */
(function () {
  'use strict';
  const HS = window.HS;
  const { clamp, lerp, smooth, V, PI, sgnpow } = HS;
  const cos = Math.cos, sin = Math.sin, sqrt = Math.sqrt, abs = Math.abs, floor = Math.floor;

  /* ---------------- ink ---------------- */
  class Ink {
    constructor(ctx) { this.ctx = ctx; this.n = 0; this.count = 0; ctx.beginPath(); }
    stroke(pts, ws) {
      const n = pts.length >> 1;
      if (n < 2) return;
      const ctx = this.ctx, L = new Array(n * 2), R = new Array(n * 2);
      for (let i = 0; i < n; i++) {
        const i0 = i > 0 ? i - 1 : i, i1 = i < n - 1 ? i + 1 : i;
        let tx = pts[i1 * 2] - pts[i0 * 2], ty = pts[i1 * 2 + 1] - pts[i0 * 2 + 1];
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        const hw = ws[i] * 0.5;
        L[i * 2] = pts[i * 2] - ty * hw; L[i * 2 + 1] = pts[i * 2 + 1] + tx * hw;
        R[i * 2] = pts[i * 2] + ty * hw; R[i * 2 + 1] = pts[i * 2 + 1] - tx * hw;
      }
      ctx.moveTo(L[0], L[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(L[i * 2], L[i * 2 + 1]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i * 2], R[i * 2 + 1]);
      ctx.closePath();
      this.count++;
      if (++this.n >= 2500) this.flush();
    }
    flush() { if (this.n) { this.ctx.fill(); this.ctx.beginPath(); this.n = 0; } }
  }
  HS.Ink = Ink;

  /* one pen stroke with the small failures of a hand: wobble, bow, taper, pressure, overshoot */
  function drawStroke(ink, rng, noise, X, Y, W, o) {
    o = o || {};
    let n = X.length;
    if (n < 2) return;
    // decimate to ~2.4px spacing
    const px = [X[0]], py = [Y[0]], pw = [W[0]];
    let acc = 0;
    for (let i = 1; i < n; i++) {
      acc += Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
      if (acc >= 2.4 || i === n - 1) { px.push(X[i]); py.push(Y[i]); pw.push(W[i]); acc = 0; }
    }
    n = px.length;
    if (n < 2) return;
    let len = 0;
    for (let i = 1; i < n; i++) len += Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]);
    if (len < 1.6) return;
    const ph = rng() * 200, wob = o.wob == null ? 0.3 : o.wob;
    const bow = (rng() - 0.5) * 0.05 * Math.min(len, 60) * (o.bow == null ? 1 : o.bow);
    const off0 = (rng() - 0.5) * (o.jit == null ? 0.7 : o.jit);
    const ov = o.overshoot == null ? rng() * 1.6 : o.overshoot;
    const pts = [], ws = [];
    let d = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) d += Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]);
      const u = d / len;
      const i0 = i > 0 ? i - 1 : i, i1 = i < n - 1 ? i + 1 : i;
      let tx = px[i1] - px[i0], ty = py[i1] - py[i0];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      let x = px[i], y = py[i];
      if (i === 0) { x -= tx * ov; y -= ty * ov; }
      if (i === n - 1) { x += tx * ov; y += ty * ov; }
      const off = off0 + wob * noise(d / 16 + ph, ph * 0.37, 1.7) + bow * Math.sin(PI * u);
      x += -ty * off; y += tx * off;
      const ramp = Math.min(1, 0.32 + u / 0.10 * 0.68) * Math.min(1, 0.16 + (1 - u) / (o.tail == null ? 0.38 : o.tail) * 0.84);
      const press = 0.86 + 0.28 * noise(d / 24 + ph, 4.4, ph * 0.1);
      pts.push(x, y); ws.push(Math.max(0.26, pw[i] * ramp * press));
    }
    ink.stroke(pts, ws);
  }

  /* assembles stroke pieces from a stream of samples along a path */
  class Pen {
    constructor(ink, rng, noise, lenLo, lenHi, opt) {
      this.ink = ink; this.rng = rng; this.noise = noise; this.lo = lenLo; this.hi = lenHi; this.opt = opt || {};
      this.X = []; this.Y = []; this.W = []; this.acc = 0; this.target = this._t();
    }
    _t() { return this.lo + (this.hi - this.lo) * (0.2 + 0.8 * this.rng()) * (0.45 + 0.55 * this.rng()); }
    add(x, y, w) {
      const X = this.X;
      if (X.length) {
        const dx = x - X[X.length - 1], dy = y - this.Y[X.length - 1], d2 = dx * dx + dy * dy;
        if (d2 < 1.7) return;
        this.acc += Math.sqrt(d2);
      }
      X.push(x); this.Y.push(y); this.W.push(w);
      if (this.acc >= this.target) {
        const ex = x, ey = y, ew = w;
        this.lift();
        if (this.rng() < 0.55) { X.push(ex); this.Y.push(ey); this.W.push(ew); }
      }
    }
    lift() {
      if (this.X.length >= 2 && this.acc > 2.2) drawStroke(this.ink, this.rng, this.noise, this.X, this.Y, this.W, this.opt);
      this.X = []; this.Y = []; this.W = []; this.acc = 0; this.target = this._t();
    }
  }

  /* ---------------- hatching ---------------- */
  /* walk a hatch line; ink goes down where this unit holds the point and the tone asks for it */
  function runLine(S, C, L, getPoint, u0, u1, step, unit, lseed, thrLine) {
    const pen = C.pen, noise = C.noise;
    const toneBoost = S.pose.toneBoost || 0;
    for (let u = u0; u <= u1; u += step) {
      const p = getPoint(u), x = p[0], y = p[1];
      const f = HS.owner(S, x, y);
      if (!f || !unit.forms.has(f.id)) { pen.lift(); continue; }
      const tn = clamp(HS.tone(S, f, x, y) * (f.toneMul || 1) + toneBoost, 0, 1);
      const thr = thrLine + 0.1 * noise(x * 0.021 + lseed, y * 0.021, lseed);
      const w = L.w * smooth(thr - 0.07, thr + 0.3, tn);
      if (w < 0.3) pen.lift(); else pen.add(x, y, w);
    }
    pen.lift();
  }

  function stationAt(f, T) {
    const m = f.m, N = f.N, tot = f.total;
    if (T < 0) {
      const h0 = f.hw[0], r = Math.min(1, -T / h0), a = f.ax[0], p = f.perp[0];
      return [m[0][0] + a[0] * T, m[0][1] + a[1] * T, h0 * sqrt(1 - r * r), p[0], p[1], a[0], a[1]];
    }
    if (T > tot) {
      const h1 = f.hw[N - 1], r = Math.min(1, (T - tot) / h1), a = f.ax[N - 1], p = f.perp[N - 1];
      return [m[N - 1][0] + a[0] * (T - tot), m[N - 1][1] + a[1] * (T - tot), h1 * sqrt(1 - r * r), p[0], p[1], a[0], a[1]];
    }
    let i = 0;
    while (i < N - 2 && f.cum[i + 1] < T) i++;
    const t = (T - f.cum[i]) / (f.cum[i + 1] - f.cum[i] || 1);
    const a = f.ax[i], p = f.perp[i];
    return [lerp(m[i][0], m[i + 1][0], t), lerp(m[i][1], m[i + 1][1], t), lerp(f.hw[i], f.hw[i + 1], t), p[0], p[1], a[0], a[1]];
  }

  /* form-following cross-contour lines (arcs around the form) */
  function crossFamily(S, C, L, u, opt) {
    const { rng } = C;
    const tot = u.total, h0 = u.hw[0], h1 = u.hw[u.N - 1];
    const sp = L.sp * (opt.spScale || 1), lseed = rng() * 50;
    for (let T = -h0 * 0.95 + rng() * sp; T < tot + h1 * 0.95; T += sp * (0.85 + 0.3 * rng())) {
      const st = stationAt(u, T), hw = st[2];
      if (hw < 1.5) continue;
      const dir = rng() < 0.5 ? 1 : -1, bow = u.bow * 0.35 * hw, tilt = (rng() - 0.5) * 0.12;
      C.pen = new Pen(C.ink, rng, C.noise, L.len[0], L.len[1], { wob: 0.28 });
      const thrLine = L.thr + opt.thrShift + (rng() - 0.5) * 0.07;
      runLine(S, C, L, (q) => {
        const s = (q / hw) * dir, w = 1 - s * s;
        return [st[0] + st[3] * s * hw * cos(tilt) + st[5] * (bow * w + s * hw * tilt), st[1] + st[4] * s * hw * cos(tilt) + st[6] * (bow * w + s * hw * tilt)];
      }, -hw * 1.04, hw * 1.04, 1.2, u, lseed, thrLine);
    }
  }

  /* parallel hatching at a fixed angle to the form's axis, drawn in the form's own (along, across) frame */
  function angledFamily(S, C, L, u, opt) {
    const { rng } = C;
    const tot = u.total, h0 = u.hw[0], h1 = u.hw[u.N - 1];
    let hwMax = 0;
    for (const h of u.hw) hwMax = Math.max(hwMax, h);
    const Tmin = -h0, Tmax = tot + h1;
    const ang = ((L.a + (rng() - 0.5) * 8) * PI) / 180, ca = cos(ang), sa = sin(ang), nx = -sa, ny = ca;
    const sp = L.sp * (opt.spScale || 1), lseed = rng() * 50;
    let cmin = 1e9, cmax = -1e9;
    for (const [T, S2] of [[Tmin, -hwMax], [Tmax, -hwMax], [Tmin, hwMax], [Tmax, hwMax]]) { const c = T * nx + S2 * ny; cmin = Math.min(cmin, c); cmax = Math.max(cmax, c); }
    for (let c = cmin + rng() * sp; c < cmax; c += sp * (0.85 + 0.3 * rng())) {
      // clip the line to the rectangle
      let t0 = -1e9, t1 = 1e9;
      const bx = nx * c, by = ny * c;
      const clip = (b, dv, lo, hi) => {
        if (abs(dv) < 1e-9) { if (b < lo || b > hi) { t0 = 1; t1 = 0; } return; }
        let ta = (lo - b) / dv, tb = (hi - b) / dv;
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      };
      clip(bx, ca, Tmin, Tmax); clip(by, sa, -hwMax, hwMax);
      if (t1 <= t0) continue;
      const da = (rng() - 0.5) * 0.06, cd = cos(da), sd = sin(da);
      C.pen = new Pen(C.ink, rng, C.noise, L.len[0], L.len[1], { wob: 0.3 });
      const thrLine = L.thr + opt.thrShift + (rng() - 0.5) * 0.07;
      runLine(S, C, L, (q) => {
        const T = bx + ca * q, S2 = by + sa * q;
        const st = stationAt(u, T);
        const s = clamp(S2 / hwMax, -1, 1);
        const jx = S2 * (cd - 1) - T * 0 + q * sd * 0.02;
        return [st[0] + st[3] * s * st[2] + jx * st[3], st[1] + st[4] * s * st[2] + jx * st[4]];
      }, t0, t1, 1.2, u, lseed, thrLine);
    }
  }

  function stipple(S, C, finish) {
    const { rng, ink } = C;
    const w = S.gx1 - S.gx0, h = S.gy1 - S.gy0;
    const tries = floor(w * h * 0.075 * finish);
    for (let n = 0; n < tries; n++) {
      const x = S.gx0 + rng() * w, y = S.gy0 + rng() * h;
      const f = HS.owner(S, x, y);
      if (!f) continue;
      const t = HS.tone(S, f, x, y);
      const p = 0.22 * smooth(0.06, 0.2, t) * (1 - smooth(0.32, 0.5, t)) * smooth(-0.15, 0.45, C.noise(x * 0.018, y * 0.018, 21.3));
      if (rng() > p) continue;
      const r = 0.55 + rng() * 0.5, a = rng() * PI, dx = cos(a) * r, dy = sin(a) * r;
      ink.stroke([x - dx, y - dy, x, y, x + dx, y + dy], [0.4, r * 1.3, 0.4]);
    }
  }

  /* ---------------- contours ---------------- */
  function chaikin(pts, flags, iters) {
    for (let it = 0; it < iters; it++) {
      const out = [], of = [], n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        of.push(flags[i], flags[i]);
      }
      pts = out; flags = of;
    }
    return { pts, flags };
  }

  function contourVisible(S, f, x, y, nx, ny) {
    const px = x - nx * 1.9, py = y - ny * 1.9;
    const list = S.at(px, py);
    if (!list) return 1;
    let occl = 0, joint = 0;
    for (let i = 0; i < list.length; i++) {
      const B = list[i];
      if (B === f || !S.inside(B, px, py)) continue;
      const dA = HS.depthOf(S, f, px, py), dB = HS.depthOf(S, B, px, py);
      if (f.linked.has(B.id) && abs(dA - dB) < 0.9) return 0;
      if (dB < dA - 0.02) return 0;
      if (f.linked.has(B.id) && B.kind === 'tube') joint = 1;
    }
    if (joint) return 3;
    // occluding edge: something lies farther behind just outside
    const qx = x + nx * 2.6, qy = y + ny * 2.6, l2 = S.at(qx, qy);
    if (l2) for (let i = 0; i < l2.length; i++) {
      const B = l2[i];
      if (B === f || !S.inside(B, qx, qy)) continue;
      if (HS.depthOf(S, B, qx, qy) > HS.depthOf(S, f, px, py) + 0.15 && !f.linked.has(B.id)) { occl = 1; break; }
    }
    return occl ? 2 : 1;
  }

  function contourForm(S, C, f) {
    const { rng, noise, ink } = C;
    const inR = (r, i) => r && i >= r[0] && i < r[1];
    const flags = f.skipFlags ? f.skipFlags.slice() : f.poly.map((_, i) => (inR(f.skipRange, i) || inR(f.startSkip, i) ? 1 : 0));
    const sm = chaikin(f.poly, flags, 2);
    const pts = sm.pts, n = pts.length;
    const sgn = f.area >= 0 ? 1 : -1;
    const ss = S.toLight2;
    const runs = [];
    let cur = null;
    const fadeStation = (x, y) => 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], c0 = pts[(i + n - 1) % n];
      const tx = b[0] - c0[0], ty = b[1] - c0[1], tl = Math.hypot(tx, ty) || 1;
      const nx = sgn * (ty / tl), ny = sgn * (-tx / tl);
      const el = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.round(el / 1.5));
      for (let s = 0; s < steps; s++) {
        const t = s / steps, x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t);
        let vis = sm.flags[i] ? 0 : contourVisible(S, f, x, y, nx, ny);
        let w = 0;
        if (vis) {
          const lit = nx * ss[0] + ny * ss[1]; // +1 facing the light
          const shade = clamp(0.5 - 0.5 * lit, 0, 1);
          const lost = 0.4 + 0.6 * smooth(-0.7 + 0.7 * lit, 0.2, noise(x * 0.012, y * 0.012, 9.1));
          w = (1.05 + 1.7 * Math.pow(shade, 1.2)) * (vis === 2 ? 1.3 : vis === 3 ? 0.5 : 1) * lost * (C.pose.line || 1) * 1.15;
          if (f.isBody && S.fadeY) {
            HS.owner(S, x - nx * 2, y - ny * 2);
            w *= S.ev.fade;
          }
        }
        if (w > 0.28) {
          if (!cur) { cur = { x: [], y: [], w: [] }; runs.push(cur); }
          cur.x.push(x); cur.y.push(y); cur.w.push(w);
        } else cur = null;
      }
    }
    for (const r of runs) {
      let i0 = 0;
      const n2 = r.x.length;
      while (i0 < n2 - 2) {
        const seg = 34 + floor(rng() * 72);
        const i1 = Math.min(n2 - 1, i0 + seg);
        const X = r.x.slice(i0, i1 + 1), Y = r.y.slice(i0, i1 + 1), W = r.w.slice(i0, i1 + 1);
        drawStroke(ink, rng, noise, X, Y, W, { wob: 0.42, overshoot: rng() * 2.2, tail: 0.3 });
        if (rng() < 0.3 && X.length > 8) {
          const a = floor(rng() * (X.length / 2)), b = Math.min(X.length, a + 10 + floor(rng() * 30));
          const off = (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.5);
          const XX = X.slice(a, b), YY = Y.slice(a, b);
          for (let q = 0; q < XX.length; q++) {
            const qa = Math.max(0, q - 1), qb = Math.min(XX.length - 1, q + 1);
            const tx = XX[qb] - XX[qa], ty = YY[qb] - YY[qa], tl = Math.hypot(tx, ty) || 1;
            XX[q] += (-ty / tl) * off; YY[q] += (tx / tl) * off;
          }
          drawStroke(ink, rng, noise, XX, YY, W.slice(a, b).map((w) => w * 0.5), { wob: 0.35, overshoot: 0.5 });
        }
        i0 = i1 - (rng() < 0.6 ? 2 : 0);
        if (i1 >= n2 - 1) break;
      }
    }
  }

  /* ---------------- features: creases, wrinkles, nails, veins ---------------- */
  function buildFeatures(S, forms) {
    const { cam, sk, sc } = S;
    const F = [];
    const rng = HS.rng(4242);
    const digits = [];
    sc.fingers.forEach((segs, i) => digits.push({ segs, dg: sk.fingers[i], isThumb: false }));
    digits.push({ segs: sc.thumb, dg: sk.thumb, isThumb: true });
    const parentSet = (segs) => new Set(segs.map((s) => s.id));
    const ringPt = (dg, seg, t, phi, out) => {
      const fr = dg.frames[seg];
      const tot = dg.L[0] + dg.L[1] + dg.L[2];
      let len = dg.L[seg];
      const s0 = dg.L.slice(0, seg).reduce((a, b) => a + b, 0);
      const lenEff = seg === 2 ? len - 0.85 * dg.sec(tot).w : len;
      const C = V.madd(dg.joints[seg], fr.d, lenEff * t);
      const sc2 = dg.sec(s0 + lenEff * t), ee = 2 / sc2.pw;
      const xn = sgnpow(cos(phi), ee), yn = sgnpow(sin(phi), ee);
      let p = V.add(V.madd(C, fr.l, sc2.w * xn), V.mul(fr.n, (yn > 0 ? sc2.hd : sc2.hp) * yn));
      const c = V.sub(p, C), l = V.len(c) || 1;
      p = V.madd(p, c, (0.03 / l));
      return cam.proj(p);
    };
    digits.forEach((D, di) => {
      const { segs, dg } = D;
      const par = parentSet(segs);
      const dorsalFacing = segs[0].faceN[2];
      for (let j = 0; j < 2; j++) {
        const jf = 0.5 * (segs[j].faceN[2] + segs[j + 1].faceN[2]);
        const lenJ = dg.L[j];
        // palmar creases across the joint
        const offs = j === 0 ? [-0.18, 0.02, 0.24] : [-0.1, 0.14];
        offs.forEach((so, k) => {
          const pts = [];
          const span = 0.55 + rng() * 0.08;
          for (let a = 0; a <= 12; a++) {
            const ph = PI + span + (a / 12) * (PI - 2 * span);
            const seg = so <= 0 ? j : j + 1, t = so <= 0 ? 1 + so / lenJ : so / dg.L[j + 1];
            pts.push(ringPt(dg, seg, clamp(t, 0, 1), ph + 0.03 * Math.sin(a)));
          }
          F.push({ pts, w: (k === 0 ? 1.9 : 1.3), kind: 'crease', par, face: -jf });
        });
        // dorsal knuckle wrinkles
        const nw = j === 0 ? 4 : 3;
        for (let k = 0; k < nw; k++) {
          const so = (k - (nw - 1) / 2) * 0.17 + (rng() - 0.5) * 0.05;
          const pts = [], a0 = 0.55 + rng() * 0.3, a1 = PI - 0.55 - rng() * 0.3;
          for (let a = 0; a <= 8; a++) {
            const ph = lerp(a0, a1, a / 8), bow = 0.05 * (1 - ((ph - PI / 2) / 1.1) ** 2);
            const so2 = so + bow;
            const seg = so2 <= 0 ? j : j + 1, t = so2 <= 0 ? 1 + so2 / lenJ : so2 / dg.L[j + 1];
            pts.push(ringPt(dg, seg, clamp(t, 0, 1), ph));
          }
          F.push({ pts, w: 1.05, kind: 'wrinkle', par, face: jf });
        }
      }
      if (!D.isThumb) {
        const pts = [];
        for (let a = 0; a <= 12; a++) { const ph = PI + 0.7 + (a / 12) * (PI - 1.4); pts.push(ringPt(dg, 0, 0.19 + 0.02 * Math.sin((a / 12) * PI), ph)); }
        F.push({ pts, w: 1.2, kind: 'crease', par, face: -dorsalFacing });
      }
      // nail
      const nail = [], tot = dg.L[0] + dg.L[1] + dg.L[2];
      const t0 = 0.4, t1 = 0.94;
      const halfAng = (t) => 0.78 * Math.pow(smooth(0, 0.16, (t - t0) / (t1 - t0)), 0.55) * (1 - 0.08 * smooth(0.7, 1, (t - t0) / (t1 - t0)));
      for (let a = 0; a <= 14; a++) { const t = lerp(t0, t1, a / 14); nail.push(ringPt(dg, 2, t, PI / 2 + halfAng(t))); }
      for (let a = 1; a <= 6; a++) { const th = (a / 7) * 2 - 1; nail.push(ringPt(dg, 2, t1 + 0.012 * (1 - th * th), PI / 2 - halfAng(t1) * th)); }
      for (let a = 14; a >= 0; a--) { const t = lerp(t0, t1, a / 14); nail.push(ringPt(dg, 2, t, PI / 2 - halfAng(t))); }
      for (let a = 1; a <= 8; a++) { const th = (a / 9) * 2 - 1; const tt = t0 - 0.05 * (1 - th * th); nail.push(ringPt(dg, 2, tt, PI / 2 + halfAng(t0 + 0.14) * th)); }
      F.push({ pts: nail, w: 1.35, kind: 'nail', closed: true, par: parentSet([segs[2]]), face: segs[2].faceN[2] });
      const fe = [];
      for (let a = 0; a <= 10; a++) { const th = (a / 10) * 1.7 - 0.85; fe.push(ringPt(dg, 2, t1 - 0.1 + 0.02 * th * th, PI / 2 - halfAng(t1) * th)); }
      F.push({ pts: fe, w: 0.85, kind: 'nailfine', par: parentSet([segs[2]]), face: segs[2].faceN[2] });
      const lun = [];
      for (let a = 0; a <= 10; a++) { const th = (a / 10) * 1.7 - 0.85; lun.push(ringPt(dg, 2, t0 + 0.2 - 0.09 * th * th, PI / 2 - halfAng(t1) * th * 0.8)); }
      F.push({ pts: lun, w: 0.7, kind: 'nailfine', par: parentSet([segs[2]]), face: segs[2].faceN[2] });
    });

    // palm / wrist / dorsal
    const P = sk.palm, bodyPar = new Set([S.body.id]);
    const bodyDorsal = S.body.faceN[2];
    const spl = (pts, top) => HS.catmull(pts, 8).map((p) => cam.proj(P.face(p[0], p[1], top)));
    const pal = (pts, w) => F.push({ pts: spl(pts, false), w, kind: 'crease', par: bodyPar, face: -bodyDorsal });
    pal([[4.0, 6.25], [3.0, 6.7], [1.7, 7.0], [0.4, 7.5], [-0.8, 8.15], [-1.3, 8.8]], 1.6);   // heart line
    pal([[-3.55, 6.45], [-2.3, 5.95], [-0.8, 5.55], [0.7, 5.05], [2.0, 4.35]], 1.45);          // head line
    pal([[-3.35, 6.55], [-3.8, 5.3], [-3.5, 3.7], [-2.75, 2.2], [-1.8, 1.05], [-1.1, 0.35]], 1.7); // life line
    pal([[0.5, 1.0], [0.3, 2.6], [0.05, 4.2], [-0.2, 5.5]], 0.8);                             // fate line, faint
    pal([[-2.3, 0.2], [-1.2, 0.45], [0.1, 0.45], [1.3, 0.35], [2.3, 0.05]], 1.25);            // wrist creases
    pal([[-2.0, -0.85], [-0.8, -0.7], [0.4, -0.72], [1.7, -0.9]], 0.85);
    pal([[-3.0, 4.0], [-2.4, 4.6], [-1.7, 5.3]], 0.8);
    pal([[2.9, 3.0], [2.2, 3.9], [1.6, 4.6]], 0.75);
    for (let q = 0; q < 16; q++) {                                                          // fine skin lines
      const onThenar = q < 9;
      const cx = onThenar ? lerp(-3.4, -1.5, rng()) : lerp(1.4, 3.4, rng());
      const cy = onThenar ? lerp(1.4, 4.8, rng()) : lerp(1.2, 5.0, rng());
      const a = (onThenar ? 0.55 : -0.4) + (rng() - 0.5) * 0.9, l = 0.22 + rng() * 0.3;
      pal([[cx - cos(a) * l, cy - sin(a) * l], [cx + 0.05 * (rng() - 0.5), cy + 0.05 * (rng() - 0.5)], [cx + cos(a) * l, cy + sin(a) * l]], 0.45 + rng() * 0.2);
    }
    const dor = (pts, w, kind) => F.push({ pts: spl(pts, true), w, kind, par: bodyPar, face: bodyDorsal });
    dor([[-2.3, -0.4], [-1.0, -0.2], [0.6, -0.2], [2.1, -0.4]], 0.85, 'crease');
    dor([[-2.0, -1.5], [-0.8, -1.38], [0.6, -1.4], [1.9, -1.55]], 0.7, 'crease');
    const nv = 3 + floor(rng() * 2);
    for (let v = 0; v < nv; v++) {
      let x = lerp(-2.8, 2.6, (v + rng() * 0.7) / nv), y = 7.8 + rng() * 0.6, vx = (rng() - 0.5) * 0.5;
      const pts = [[x, y]];
      for (let k = 0; k < 9; k++) { y -= 0.8 + rng() * 0.25; vx += (rng() - 0.5) * 0.35 - x * 0.05; x += vx * 0.5; pts.push([clamp(x, -3.2, 3.2), y]); }
      F.push({ pts: spl(pts, true), w: 0.8, kind: 'vein', par: bodyPar, face: bodyDorsal });
    }
    // tendons and knuckle arcs on the back of the hand, drawn on the shadow side of each ridge
    const away = S.away;
    S.sk.MCP.forEach((m, i) => {
      const ext = 1 - clamp((S.pose.fingers[i].mcp || 0) / 1.0, 0, 0.8);
      const cand = [-1, 1].map((sg) => {
        const pts = [];
        for (let j = 0; j <= 9; j++) { const t = 0.12 + 0.72 * (j / 9); pts.push(cam.proj(P.face(lerp(m.x * 0.5, m.x, t) + sg * 0.34, lerp(1.8, 8.4, t), true))); }
        return pts;
      });
      const mid = (c) => c[4];
      const a = cand[0][4], b = cand[1][4];
      const pick = ((a[0] - b[0]) * away[0] + (a[1] - b[1]) * away[1]) > 0 ? cand[0] : cand[1];
      F.push({ pts: pick, w: 1.2 + 0.9 * ext, kind: 'tendon', par: bodyPar, face: bodyDorsal });
      // knuckle arcs
      const fl = clamp((S.pose.fingers[i].mcp || 0) / 1.2, 0, 1), na = fl > 0.45 ? 2 : 1;
      for (let q = 0; q < na; q++) {
        const pts = [];
        for (let j = 0; j <= 8; j++) { const dx = lerp(-0.85, 0.85, j / 8); pts.push(cam.proj(P.face(m.x + dx, m.y - 0.75 - q * 0.42 + 0.3 * (1 - (dx / 0.85) ** 2), true))); }
        F.push({ pts, w: 0.9, kind: 'wrinkle', par: bodyPar, face: bodyDorsal * (0.6 + 0.4 * fl) });
      }
    });
    return F;
  }

  function drawFeature(S, C, ft) {
    const { rng, noise, ink } = C;
    const fw = smooth(0.06, 0.42, ft.face);
    if (fw < 0.05) return;
    let pts = ft.pts.map((p) => [p[0], p[1]]);
    if (ft.closed) pts.push(pts[0].slice());
    const dense = [];
    const cat = HS.catmull(pts, 4);
    for (const p of cat) dense.push(p);
    const n = dense.length;
    const seed = rng() * 10;
    const doubleLine = ft.kind === 'vein';
    for (const side of doubleLine ? [-1, 1] : [0]) {
      let X = [], Y = [], W = [];
      const flush = () => { if (X.length >= 3) drawStroke(ink, rng, noise, X, Y, W, { wob: 0.25, overshoot: rng() * 0.8, tail: 0.5 }); X = []; Y = []; W = []; };
      for (let i = 0; i < n; i++) {
        const a = dense[Math.max(0, i - 1)], b = dense[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let x = dense[i][0], y = dense[i][1];
        if (side) { const e = sin(PI * i / (n - 1)) ** 0.5 * 0.11 * S.k * 0.5; x += -ty * e * side; y += tx * e * side; }
        const o = HS.owner(S, x, y);
        let ok = o && ft.par.has(o.id);
        if (ok && !ft.closed && ft.kind !== 'vein' && noise(i * 0.09 + seed * 7, seed, 11.7) < -0.42) ok = false;
        if (ok) {
          const prof = ft.closed ? 1 : 0.35 + 0.65 * sin(PI * clamp(i / (n - 1), 0.02, 0.98)) ** 0.6;
          const w = ft.w * (0.7 + 0.45 * noise(i * 0.3 + seed, seed, 3)) * prof * fw * (side ? 0.55 : 1) * (C.pose.line || 1);
          X.push(x); Y.push(y); W.push(w);
        } else flush();
      }
      flush();
    }
  }

  /* ---------------- underdrawing ---------------- */
  function underdrawing(S, C, strong) {
    const { rng, noise, ink } = C;
    const ctx = ink.ctx;
    ctx.save(); ctx.globalAlpha = strong ? 0.5 : 0.22;
    const cam = S.cam, k = S.k;
    const line = (a, b, w) => {
      const X = [], Y = [], W = [], n = Math.max(3, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
      for (let i = 0; i <= n; i++) { const t = i / n; X.push(lerp(a[0], b[0], t)); Y.push(lerp(a[1], b[1], t)); W.push(w); }
      drawStroke(ink, rng, noise, X, Y, W, { wob: 0.7, overshoot: 3 + rng() * 4, jit: 1.2, tail: 0.25 });
    };
    const circle = (c, r, w) => {
      for (let pass = 0; pass < 1; pass++) {
        const X = [], Y = [], W = [];
        const a0 = rng() * 6.28, sq = 0.9 + rng() * 0.2, rot = rng() * 0.6;
        for (let i = 0; i <= 26; i++) {
          const a = a0 + (i / 26) * (6.28 + 0.5), rr = r * (1 + (rng() - 0.5) * 0.08);
          X.push(c[0] + cos(a) * rr * cos(rot) - sin(a) * rr * sq * sin(rot)); Y.push(c[1] + cos(a) * rr * sin(rot) + sin(a) * rr * sq * cos(rot)); W.push(w);
        }
        drawStroke(ink, rng, noise, X, Y, W, { wob: 0.6, overshoot: 1.5, jit: 1 });
      }
    };
    const digs = S.sc.fingers.concat([S.sc.thumb]);
    const dgs = S.sk.fingers.concat([S.sk.thumb]);
    digs.forEach((segs, i) => {
      const J = dgs[i].joints.map((j) => cam.proj(j));
      if (!strong) {
        const o = HS.owner(S, J[1][0], J[1][1]);
        if (!o || !(segs[0] === o || segs[1] === o || segs[2] === o) || rng() < 0.55) return;
      }
      for (let s = 0; s < 3; s++) {
        const dx = J[s + 1][0] - J[s][0], dy = J[s + 1][1] - J[s][1], l = Math.hypot(dx, dy) || 1, ex = 0.12 * l + 4;
        if (l > 5) line([J[s][0] - dx / l * ex, J[s][1] - dy / l * ex], [J[s + 1][0] + dx / l * ex, J[s + 1][1] + dy / l * ex], strong ? 0.8 : 0.6);
      }
      J.forEach((p, jn) => { const seg = segs[Math.min(jn, 2)]; const hw = seg.hw[jn > 2 ? seg.N - 1 : 0]; if (jn < (strong ? 3 : 2) && (strong || rng() < 0.6)) circle(p, hw * (jn === 0 ? 1.05 : 0.85), strong ? 0.75 : 0.55); });
    });
    const P = S.sk.palm;
    const c = [[-3.3, 0.5], [3.1, 0.5], [3.5, 8.6], [-3.9, 9.2]].map((q) => cam.proj(P.face(q[0], q[1], true)));
    if (strong) for (let i = 0; i < 4; i++) line(c[i], c[(i + 1) % 4], 0.6);

    ink.flush();
    ctx.restore();
  }

  /* ---------------- the study ---------------- */
  const DIGIT_LAYERS = [
    { kind: 'cross', thr: 0.17, sp: 4.3, w: 1.4, len: [14, 46] },
    { kind: 'ang', a: 52, thr: 0.36, sp: 4.6, w: 1.3, len: [10, 32] },
    { kind: 'ang', a: -34, thr: 0.6, sp: 4.2, w: 1.25, len: [10, 28] },
    { kind: 'ang', a: 84, thr: 0.78, sp: 3.6, w: 1.2, len: [8, 22] },
  ];
  const BODY_LAYERS = [
    { kind: 'ang', a: 64, thr: 0.26, sp: 4.9, w: 1.35, len: [12, 40] },
    { kind: 'cross', thr: 0.34, sp: 6.5, w: 1.25, len: [12, 40] },
    { kind: 'ang', a: -30, thr: 0.58, sp: 4.4, w: 1.25, len: [10, 30] },
    { kind: 'ang', a: 88, thr: 0.78, sp: 3.8, w: 1.2, len: [8, 22] },
  ];

  HS.drawStudy = function* (sc, sk, pose, ctx, seed) {
    const S = HS.makeScene(sc, sk, pose);
    const rng = HS.rng(seed), noise = HS.makeNoise(seed + 5), ink = new Ink(ctx);
    const C = { rng, noise, ink, pose, pen: null };
    const finish = pose.finish == null ? 1 : pose.finish;
    const opt = { thrShift: (1 - finish) * 0.16, spScale: pose.spScale || 1 };
    const nLayers = finish > 0.85 ? 4 : finish > 0.65 ? 3 : finish > 0.4 ? 2 : 1;
    S.features = buildFeatures(S, sc.forms);
    for (const f of sc.forms) f.toneMul = f.isBody ? 0.8 : 1;

    underdrawing(S, C, !!pose.construction);
    yield;

    if (finish > 0.5) {
      for (const u of S.units) {
        const L = u.isBody ? { kind: 'ang', a: 70, thr: 0.07, sp: 6.8, w: 0.8, len: [24, 70] } : { kind: 'cross', thr: 0.07, sp: 6.2, w: 0.75, len: [16, 50] };
        if (L.kind === 'cross') crossFamily(S, C, L, u, opt); else angledFamily(S, C, L, u, opt);
      }
      ink.flush(); yield;
    }
    for (let li = 0; li < nLayers; li++) {
      for (const u of S.units) {
        const L = (u.isBody ? BODY_LAYERS : DIGIT_LAYERS)[li];
        if (L.kind === 'cross') crossFamily(S, C, L, u, opt); else angledFamily(S, C, L, u, opt);
      }
      ink.flush(); yield;
    }
    if (finish > 0.3) { stipple(S, C, finish); ink.flush(); yield; }

    for (const f of sc.forms) contourForm(S, C, f);
    ink.flush(); yield;
    for (const ft of S.features) drawFeature(S, C, ft);
    ink.flush(); yield;
  };
})();
