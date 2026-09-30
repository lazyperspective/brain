/* forms.js — the block-in. The skeleton is projected through a simple perspective view and
 * turned into flat 2D shapes: one outline per phalanx, one for the palm+forearm block, the
 * thumb segments, and small webs. Each shape remembers its centre-line, how wide it is
 * along it, and roughly how near it is — enough for the pen to know what overlaps what. */
(function () {
  'use strict';
  const HS = window.HS;
  const { clamp, lerp, smooth, sgnpow, V, TAU, PI } = HS;
  const cos = Math.cos, sin = Math.sin, sqrt = Math.sqrt;
  const RING = 22;

  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    const up = [];
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }

  HS._hull = hull;

  function makeCamera(pose, k, ox, oy) {
    const view = pose.view;
    const mir = pose.side < 0 ? -1 : 1;
    const wf = (pose.wrist && pose.wrist.flex) || 0, wd = (pose.wrist && pose.wrist.dev) || 0;
    const Rm = HS.viewMatrix(view.yaw || 0, view.pitch || 0, view.roll || 0);
    const D = view.dist || 55, pivot = view.pivot || [0, 4, 0];
    const cam = { k, ox, oy, D, Rm, mir };
    cam.toCam = (p) => {
      const x = p[0], y = p[1], z = p[2];
      const s = smooth(-3.5, 3, y);
      const a1 = -wf * s, c1 = cos(a1), s1 = sin(a1);
      let y1 = y * c1 - z * s1, z1 = y * s1 + z * c1;
      const a2 = wd * s, c2 = cos(a2), s2 = sin(a2);
      let x1 = x * c2 - y1 * s2; y1 = x * s2 + y1 * c2;
      x1 = x1 * mir - pivot[0]; y1 -= pivot[1]; z1 -= pivot[2];
      return [Rm[0] * x1 + Rm[1] * y1 + Rm[2] * z1, Rm[3] * x1 + Rm[4] * y1 + Rm[5] * z1, Rm[6] * x1 + Rm[7] * y1 + Rm[8] * z1];
    };
    cam.proj = (p) => {
      const q = cam.toCam(p), f = D / (D - q[2]);
      return [ox + k * q[0] * f, oy - k * q[1] * f, D - q[2]];
    };
    cam.dir = (p, d) => { const a = cam.toCam(p), b = cam.toCam(V.add(p, d)); return V.norm(V.sub(b, a)); };
    return cam;
  }

  /* generic tube-like form from a list of stations; ringFn(i, phi) gives a 3D rim point */
  function tubeForm(cam, o) {
    const N = o.centers.length;
    const cs = [], rings = [], zc = [], zf = [], rad = [];
    for (let i = 0; i < N; i++) {
      const c = cam.proj(o.centers[i]);
      const ring = [];
      let mind = 1e9, r = 0;
      for (let a = 0; a < RING; a++) {
        const p = cam.proj(o.ringFn(i, (TAU * a) / RING));
        ring.push(p);
        if (p[2] < mind) mind = p[2];
        r += Math.hypot(p[0] - c[0], p[1] - c[1]);
      }
      cs.push(c); rings.push(ring); zc.push(c[2]); zf.push(mind); rad.push(r / RING);
    }
    // axis directions (first station -> last)
    let ax = [];
    const win = Math.max(1, Math.round(N / 6));
    for (let i = 0; i < N; i++) {
      const a = cs[Math.max(0, i - win)], b = cs[Math.min(N - 1, i + win)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      ax.push(l > 0.12 * rad[i] ? [dx / l, dy / l] : null);
    }
    let fallback = null;
    for (const a of ax) if (a) { fallback = a; break; }
    if (!fallback) {
      const lp = cam.proj(V.add(o.centers[0], o.lat)), c0 = cs[0];
      const dx = lp[0] - c0[0], dy = lp[1] - c0[1], l = Math.hypot(dx, dy) || 1;
      fallback = [dy / l, -dx / l];
    }
    let last = fallback;
    for (let i = 0; i < N; i++) { if (ax[i]) last = ax[i]; else ax[i] = last; }
    for (let i = N - 1; i >= 0; i--) { if (!ax[i]) ax[i] = last; }
    // keep the axis direction continuous so left/right never swap along the tube
    for (let i = 1; i < N; i++) {
      if (ax[i][0] * ax[i - 1][0] + ax[i][1] * ax[i - 1][1] < 0.2) {
        const a = ax[i - 1], b = ax[i];
        const d = b[0] * a[0] + b[1] * a[1];
        let x = b[0] + a[0] * (0.5 - d), y = b[1] + a[1] * (0.5 - d);
        const l = Math.hypot(x, y) || 1;
        ax[i] = [x / l, y / l];
      }
    }
    const m = [], hw = [], perp = [], Lp = [], Rp = [], zr = [];
    for (let i = 0; i < N; i++) {
      const pr = [-ax[i][1], ax[i][0]];
      let mn = 1e9, mx = -1e9;
      for (const p of rings[i]) {
        const d = (p[0] - cs[i][0]) * pr[0] + (p[1] - cs[i][1]) * pr[1];
        if (d < mn) mn = d; if (d > mx) mx = d;
      }
      const mid = [cs[i][0] + pr[0] * (mn + mx) / 2, cs[i][1] + pr[1] * (mn + mx) / 2];
      m.push(mid); hw.push((mx - mn) / 2); perp.push(pr);
      Lp.push([cs[i][0] + pr[0] * mn, cs[i][1] + pr[1] * mn]);
      Rp.push([cs[i][0] + pr[0] * mx, cs[i][1] + pr[1] * mx]);
      zr.push(o.zr[i]);
    }
    // polygon: L chain, end cap, R chain reversed, start cap
    const poly = [];
    for (let i = 0; i < N; i++) poly.push(Lp[i]);
    const capPts = (i, sign, type, extra) => {
      const out = [];
      if (extra) { return extra; }
      if (type === 'sphere') {
        const h = hw[i], a = ax[i];
        for (let s = 0; s <= 10; s++) {
          const th = PI - (PI * s) / 10;
          const cx = cos(th), sy = sin(th);
          const pr = perp[i];
          // from L (-perp) over +sign*axis to R (+perp)
          out.push([m[i][0] + h * (pr[0] * cx + sign * a[0] * sy), m[i][1] + h * (pr[1] * cx + sign * a[1] * sy)]);
        }
        return out;
      }
      if (type === 'ring') {
        const a = ax[i], pr = perp[i], pts = [];
        for (const p of rings[i]) {
          const ax_ = (p[0] - cs[i][0]) * a[0] + (p[1] - cs[i][1]) * a[1] * 1;
          if (ax_ * sign >= 0) pts.push({ p, u: (p[0] - cs[i][0]) * pr[0] + (p[1] - cs[i][1]) * pr[1] });
        }
        pts.sort((u, v) => u.u - v.u);
        return pts.map((q) => q.p);
      }
      return out;
    };
    const ep = o.endPts ? o.endPts(cs, Lp, Rp, m, ax, perp, rings, hw) : null;
    poly.push(...capPts(N - 1, 1, o.cap1 || 'sphere', ep));
    const skipRange = ep ? [N, N + ep.length] : null;
    for (let i = N - 1; i >= 0; i--) poly.push(Rp[i]);
    const c0 = capPts(0, -1, o.cap0 || 'sphere');
    c0.reverse();
    const startSkip = o.openStart ? [poly.length, poly.length + c0.length] : null;
    poly.push(...c0);
    return {
      kind: 'tube', total: m.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - m[i - 1][0], p[1] - m[i - 1][1]) : 0), 0), name: o.name, group: o.group, N, m, hw, zc, zf, zr, perp, ax, poly,
      flat: o.flat || 1, faceN: o.faceN, tiltW: o.tiltW == null ? 0.5 : o.tiltW, cs, rings, Lp, Rp,
      linked: new Set(), skipRange, startSkip, digit: o.digit, seg: o.seg, ringFn: o.ringFn, bow: o.bow || 0,
    };
  }

  function bboxOf(poly) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return [x0, y0, x1, y1];
  }

  /* -------- assemble one hand -------- */
  function assemble(sk, pose, cam) {
    const forms = [];
    const add = (f) => { f.id = forms.length; forms.push(f); return f; };
    const link = (a, b) => { a.linked.add(b.id); b.linked.add(a.id); };
    const faceOf = (n3, at) => { const d = cam.dir(at, n3); return d; };

    /* palm + wrist + forearm */
    const P = sk.palm;
    const ys = [];
    const yEnd = 7.6;
    const nSt = Math.max(6, Math.round((yEnd - P.y0) / 0.8));
    for (let i = 0; i < nSt; i++) ys.push(lerp(P.y0, yEnd, i / (nSt - 1)));
    const e = 2 / P.pw;
    const ringBody = (i, phi) => {
      const y = ys[i], c = cos(phi), s = sin(phi);
      const xn = sgnpow(c, e), zn = sgnpow(s, e);
      const x = (xn >= 0 ? P.Wu(y) : P.Wr(y)) * xn;
      const H = P.H(y);
      return [x, y, P.zc(x, y) + (zn >= 0 ? 0.93 * H * zn : 1.07 * H * zn)];
    };
    const bodyNormal = cam.dir([0, 4, 0], [0, 0, 1]);
    const body = add(tubeForm(cam, {
      name: 'body', group: 'body', centers: ys.map((y) => [0, y, P.zc(0, y)]), ringFn: ringBody, lat: [1, 0, 0],
      zr: ys.map((y) => P.H(y)), cap0: 'ring', cap1: 'ring', openStart: true, flat: 2.3, tiltW: 0.85, faceN: bodyNormal,
      endPts: (cs, Lp, Rp, m, ax, perp, rings, hw) => {
        const Ne = cs.length - 1, pr = perp[Ne], out = [];
        // distal edge of the palm: hull of the last section and the knuckle arc, far half only
        const src = rings[Ne].map((p) => p.slice());
        for (let j = 0; j <= 12; j++) {
          const x = lerp(-4.3, 4.1, j / 12), y = P.Ymax(x) - 0.25;
          for (const top of [true, false]) src.push(cam.proj(P.face(x, y, top)));
        }
        const H = hull(src.map((p) => [p[0], p[1]]));
        const far = [];
        for (const p of H) {
          const a = (p[0] - m[Ne][0]) * ax[Ne][0] + (p[1] - m[Ne][1]) * ax[Ne][1];
          if (a >= -0.05 * hw[Ne]) far.push({ p, u: (p[0] - m[Ne][0]) * pr[0] + (p[1] - m[Ne][1]) * pr[1] });
        }
        far.sort((u, v) => u.u - v.u);
        for (const q of far) out.push(q.p);
        return out;
      },
    }));
    body.isBody = true;
    body.yOfSt = ys;
    /* digits */
    const digitForms = [];
    const mkDigit = (dg, di, isThumb) => {
      const segs = [];
      const tot = dg.L[0] + dg.L[1] + dg.L[2];
      for (let sgi = 0; sgi < 3; sgi++) {
        const N = 6, s0 = dg.L[0] * (sgi > 0 ? 1 : 0) + (sgi > 1 ? dg.L[1] : 0);
        const fr = dg.frames[sgi];
        let len = dg.L[sgi];
        if (sgi === 2) len -= 0.85 * dg.sec(tot).w; // tip cap gives the rest
        const sts = [];
        for (let i = 0; i < N; i++) {
          const t = i / (N - 1);
          const C = V.madd(dg.joints[sgi], fr.d, len * t);
          sts.push({ C, s: s0 + len * t, sec: dg.sec(s0 + len * t) });
        }
        const f = add(tubeForm(cam, {
          name: (isThumb ? 'thumb' : dg.def.name) + sgi, group: isThumb ? 'thumb' : 'f' + di, digit: dg, seg: sgi,
          centers: sts.map((s) => s.C), lat: fr.l,
          ringFn: (i, phi) => {
            const c = cos(phi), sn = sin(phi), sc = sts[i].sec, ee = 2 / sc.pw;
            const xn = sgnpow(c, ee), yn = sgnpow(sn, ee);
            return V.add(V.madd(sts[i].C, fr.l, sc.w * xn), V.mul(fr.n, (yn > 0 ? sc.hd : sc.hp) * yn));
          },
          zr: sts.map((s) => 0.5 * (s.sec.hd + s.sec.hp)), flat: 1.15, tiltW: 0.45,
          faceN: cam.dir(dg.joints[sgi], fr.n), bow: cam.dir(dg.joints[sgi], fr.d)[2],
        }));
        f.frame = fr; f.J0 = dg.joints[sgi]; f.J1 = dg.joints[sgi + 1]; f.sts = sts; f.len = len; f.isThumb = isThumb;
        segs.push(f);
        if (sgi > 0) link(segs[sgi - 1], f);
      }
      return segs;
    };
    const fingers = sk.fingers.map((dg, i) => mkDigit(dg, i, false));
    const thumb = mkDigit(sk.thumb, 4, true);
    for (const fs of fingers) link(fs[0], body);
    link(thumb[0], body);

    /* webs */
    const webs = [];
    const sidePt = (f, idx, toward) => {
      const a = f.Lp[idx], b = f.Rp[idx];
      const da = Math.hypot(a[0] - toward[0], a[1] - toward[1]), db = Math.hypot(b[0] - toward[0], b[1] - toward[1]);
      return da < db ? a : b;
    };
    const mkWeb = (fa, ia0, ia1, fb, ib0, ib1, arch, name) => {
      const A0 = sidePt(fa, ia0, fb.m[ib0]), A1 = sidePt(fa, ia1, fb.m[ib1]);
      const B0 = sidePt(fb, ib0, fa.m[ia0]), B1 = sidePt(fb, ib1, fa.m[ia1]);
      const mid = [(A1[0] + B1[0]) / 2, (A1[1] + B1[1]) / 2], base = [(A0[0] + B0[0]) / 2, (A0[1] + B0[1]) / 2];
      const ctrl = [lerp(mid[0], base[0], arch * 1.6), lerp(mid[1], base[1], arch * 1.6)];
      const poly = [A0];
      poly.push(A1);
      for (let s = 1; s < 10; s++) {
        const t = s / 10, u = 1 - t;
        poly.push([u * u * A1[0] + 2 * u * t * ctrl[0] + t * t * B1[0], u * u * A1[1] + 2 * u * t * ctrl[1] + t * t * B1[1]]);
      }
      poly.push(B1); poly.push(B0);
      const w = { kind: 'web', name, group: 'web', poly, linked: new Set(), A0, A1, B0, B1, zc: [(fa.zc[ia0] + fb.zc[ib0] + fa.zc[ia1] + fb.zc[ib1]) / 4], zr: [0.35], hw: [10], m: [mid], N: 1, flat: 1, tiltW: 0 };
      add(w); webs.push(w);
      link(w, fa); link(w, fb); link(w, body);
      return w;
    };
    const wl = pose.webLen == null ? 0.5 : pose.webLen;
    const curl = (i) => pose.fingers[i].mcp || 0;
    for (let i = 0; i < 3; i++) {
      const fa = fingers[i][0], fb = fingers[i + 1][0];
      if ((curl(i) + curl(i + 1)) / 2 > 0.8 || fa.total < 1.5 * fa.hw[0] || fb.total < 1.5 * fb.hw[0]) continue;
      const i1 = Math.round(wl * 5);
      mkWeb(fa, 0, i1, fb, 0, i1, pose.webArch == null ? 0.42 : pose.webArch, 'web' + i);
    }

    for (const f of forms) f.bbox = bboxOf(f.poly);
    return { forms, body, fingers, thumb, webs };
  }

  /* -------- scale and place -------- */
  HS.buildForms = function (sk, pose, rect) {
    let cam = makeCamera(pose, 1, 0, 0);
    let sc = assemble(sk, pose, cam);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const f of sc.forms) { x0 = Math.min(x0, f.bbox[0]); y0 = Math.min(y0, f.bbox[1]); x1 = Math.max(x1, f.bbox[2]); y1 = Math.max(y1, f.bbox[3]); }
    const k = Math.min(rect.w / (x1 - x0), rect.h / (y1 - y0)) * (rect.fit || 1);
    const ox = rect.x + rect.w / 2 - (k * (x0 + x1)) / 2, oy = rect.y + rect.h / 2 - (k * (y0 + y1)) / 2;
    cam = makeCamera(pose, k, ox, oy);
    sc = assemble(sk, pose, cam);
    sc.cam = cam; sc.k = k; sc.rect = rect;
    return sc;
  };
})();
