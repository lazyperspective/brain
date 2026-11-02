// Bougainvillea: clusters of papery three-bract flowers, stamped dark to light, on dark twigs.
// Each cluster is painted once into its own sprite (pivot = where it hangs from the vine) so it can sway alone.
(function () {
  const CY = window.CY;
    // deep oxblood -> vermilion -> coral: the red bougainvillea, loud against the blue lime
  CY.TONES = ['#3e070d', '#661013', '#8f1816', '#b3211b', '#cf2c20', '#e2402a', '#ec5e3d', '#f37a56'].map(CY.hex);
  CY.LEAF = ['#2f3a22', '#43502c', '#5a6436'].map(CY.hex);
  CY.TWIG = [52, 36, 30];
  const LX = -0.62, LY = -0.78; // light from the upper left (the moon)

  // one bract: an angular heart with a pointed tip, s = length in px
  CY.bractPath = function (g, x, y, ang, s, w) {
    const c = Math.cos(ang), sn = Math.sin(ang);
    const P = (u, v) => [x + c * u * s - sn * v * s, y + sn * u * s + c * v * s];
    const a = P(0, 0), b = P(0.32, -w), m1 = P(0.78, -w * 0.62), tip = P(1, 0), m2 = P(0.78, w * 0.62), d = P(0.32, w);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.quadraticCurveTo(m1[0], m1[1], tip[0], tip[1]);
    g.quadraticCurveTo(m2[0], m2[1], d[0], d[1]); g.closePath();
  };
  // a brushed bract: the heart outline sampled, nudged and drawn through midpoints, so every edge is a little
  // different and none is ruled; a darker rim where the pigment pooled, and a pale drag of the brush inside.
  CY.bractPoly = function (x, y, ang, s, w, R) {
    const c = Math.cos(ang), sn = Math.sin(ang), N = 7, pts = [];
    const prof = (u) => w * (u < 0.3 ? Math.sin((u / 0.3) * Math.PI / 2) * (0.72 + 0.28 * (u / 0.3)) : 1 - Math.pow((u - 0.3) / 0.7, 1.5));
    for (let k = 0; k <= N; k++) { const u = k / N; pts.push([u, -prof(u)]); }
    for (let k = N - 1; k >= 1; k--) { const u = k / N; pts.push([u, prof(u)]); }
    return pts.map(([u, v], k) => {
      const ju = k === N ? R.g() * 0.04 : R.g() * 0.05, jv = R.g() * 0.07 * (k ? 1 : 0.3);
      const U = (u + ju) * s, V = (v + jv) * s;
      return [x + c * U - sn * V, y + sn * U + c * V];
    });
  };
  CY.curvy = function (g, P) {
    const n = P.length;
    g.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    g.closePath();
  };
  CY.bract = function (g, x, y, ang, s, w, col, a, R) {
    R = R || CY.rng(((x * 73) | 0) ^ ((y * 151) | 0) ^ ((ang * 1000) | 0));
    col = CY.C(col);
    const P = CY.bractPoly(x, y, ang, s, w, R);
    g.fillStyle = CY.rgba(col, a); g.beginPath(); CY.curvy(g, P); g.fill();
    if (s > 4.5) {
      g.strokeStyle = CY.rgba(CY.mix(col, [40, 4, 20], 0.38), 0.22 * a); g.lineWidth = R.r(0.8, 1.3);
      g.beginPath(); CY.curvy(g, P); g.stroke();
      const c = Math.cos(ang), sn = Math.sin(ang), o = R.g() * s * w * 0.25;
      g.strokeStyle = CY.rgba(CY.mix(col, [255, 226, 236], 0.3), R.r(0.1, 0.22) * a); g.lineWidth = s * w * R.r(0.25, 0.45); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x + c * s * 0.18 - sn * o, y + sn * s * 0.18 + c * o); g.lineTo(x + c * s * R.r(0.55, 0.75) - sn * o * 0.6, y + sn * s * R.r(0.55, 0.75) + c * o * 0.6); g.stroke();
    }
  };
  // the pigment pass on a painted sprite: where the mass is dense the colour bleeds into the gaps (wet into wet,
  // a touch darker), where it thins the paint breaks up on the paper's tooth, and everywhere it granulates.
  CY.pigment = function (S, seed, o) {
    o = Object.assign({ blur: 2, bleed: 0.55, lo: 0.1, hi: 0.36, gran: 0.16 }, o);
    const B = CY.mk(S.w, S.h); B.g.filter = `blur(${o.blur}px)`; B.g.drawImage(S.c, 0, 0); B.g.filter = 'none';
    const bd = B.g.getImageData(0, 0, S.w, S.h).data;
    const img = S.g.getImageData(0, 0, S.w, S.h), d = img.data, sw = S.w;
    for (let p = 0, i = 0; i < d.length; p++, i += 4) {
      const ba = bd[i + 3] / 255;
      let al = d[i + 3] / 255;
      if (!al && ba < 0.5) { d[i + 3] = 0; continue; }
      const x = p % sw, y = (p / sw) | 0;
      const nm = CY.vnoise(x * 0.14, y * 0.14, seed), nf = CY.hash(x, y, seed + 3);
      let r = d[i], gg = d[i + 1], b = d[i + 2];
      if (ba > 0.5 && al < 1) {
        const f = ((ba - 0.5) / 0.5) * o.bleed * (0.55 + 0.9 * nm), fa = f * (1 - al), na = al + fa;
        r = (r * al + bd[i] * 0.8 * fa) / na; gg = (gg * al + bd[i + 1] * 0.8 * fa) / na; b = (b * al + bd[i + 2] * 0.82 * fa) / na;
        al = na;
      }
      const e = ba + (nm - 0.5) * 0.42 + (nf - 0.5) * 0.3;
      al *= CY.sm(o.lo, o.hi, e);
      if (nf > 0.988) al *= 0.3;
      const k = 1 - o.gran / 2 + o.gran * nf + 0.1 * (nm - 0.5);
      d[i] = r * k; d[i + 1] = gg * k; d[i + 2] = b * k; d[i + 3] = al * 255;
    }
    S.g.putImageData(img, 0, 0);
  };
  // a flower: three bracts around a tiny cream floret
  CY.floret = function (g, f, R) {
    const col = CY.TONES[f.tone];
    for (let k = 0; k < 3; k++) {
      const ang = f.rot + (k * Math.PI * 2) / 3 + R.g() * 0.18;
      const s = f.s * R.r(0.82, 1.12);
      const c = CY.jit(col, R, 0.05);
      CY.bract(g, f.x + Math.cos(ang) * 0.6, f.y + Math.sin(ang) * 0.6, ang, s, R.r(0.42, 0.58), c, R.r(0.8, 0.95), R);
      if (f.tone >= 3 && R.f() < 0.55) { // a darker vein, the papery look
        g.strokeStyle = CY.rgba(CY.TONES[Math.max(0, f.tone - 3)], 0.35); g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x + Math.cos(ang) * s * 0.75, f.y + Math.sin(ang) * s * 0.75); g.stroke();
      }
      if (f.tone >= 5 && R.f() < 0.35) { // light catching one edge
        g.strokeStyle = CY.rgba(CY.TONES[7], 0.5); g.lineWidth = 0.9;
        g.beginPath(); const e = ang - 0.35;
        g.moveTo(f.x + Math.cos(e) * s * 0.3, f.y + Math.sin(e) * s * 0.3); g.lineTo(f.x + Math.cos(ang - 0.12) * s * 0.85, f.y + Math.sin(ang - 0.12) * s * 0.85); g.stroke();
      }
    }
    if (f.tone >= 4 && R.f() < 0.12) { g.fillStyle = 'rgba(246,238,214,0.8)'; g.beginPath(); g.arc(f.x, f.y, R.r(0.9, 1.6), 0, 6.283); g.fill(); }
  };
  CY.leaf = function (g, x, y, ang, s, col, a) {
    const c = Math.cos(ang), sn = Math.sin(ang);
    const P = (u, v) => [x + c * u * s - sn * v * s, y + sn * u * s + c * v * s];
    const b = P(0.45, -0.33), tip = P(1, 0), d = P(0.45, 0.33);
    g.fillStyle = CY.rgba(col, a); g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(b[0], b[1], tip[0], tip[1]); g.quadraticCurveTo(d[0], d[1], x, y); g.fill();
  };

  // spec: { x, y (pivot, scene px), ang (radians, direction from pivot to the mass), len (pivot -> mass), r (mass
  //   radius), elong (stretch along ang), dens, depth 0 back..1 front, seed, kind 'mass'|'hang'|'spray', tipLen }
  CY.makeCluster = function (spec) {
    const R = CY.rng(spec.seed);
    const ca = Math.cos(spec.ang), sa = Math.sin(spec.ang);
    const kind = spec.kind || 'mass';
    const el = spec.elong || 1;
    // local frame: +u along ang, +v across. Pivot at (0,0).
    const toXY = (u, v) => [ca * u - sa * v, sa * u + ca * v];
    const twigs = [], florets = [], leaves = [];
    // main twig: pivot -> centre -> beyond
    const cu = spec.len;
    const main = [];
    const bend = R.g() * 0.25;
    for (let k = 0; k <= 12; k++) {
      const u = (k / 12) * (cu + spec.r * el * (kind === 'spray' ? 1.1 : 0.7));
      main.push(toXY(u, Math.sin((k / 12) * Math.PI) * bend * spec.r + R.g() * 1.5));
    }
    twigs.push({ pts: main, w: spec.tw || (kind === 'spray' ? 2.2 : 3), seed: spec.seed * 3 });
    spec.tip = main[main.length - 1];
    // sub-blobs: where the flowers gather
    const nb = kind === 'spray' ? R.i(4, 7) : R.i(3, 6);
    const blobs = [];
    for (let b = 0; b < nb; b++) {
      let u, v;
      if (kind === 'spray') { u = cu * 0.35 + R.f() * (cu * 0.65 + spec.r * 1.1); v = R.g() * spec.r * 0.45; }
      else { u = cu + R.g() * spec.r * 0.45 * el; v = R.g() * spec.r * 0.45; }
      const br = (kind === 'spray' ? R.r(0.24, 0.4) : R.r(0.42, 0.66)) * spec.r;
      blobs.push({ u, v, r: br });
      // a side twig from the main line to the blob
      const su = Math.min(u, cu) * R.r(0.5, 0.9);
      const pts = [toXY(su, bend * 0.3 * spec.r), toXY((su + u) / 2, v * 0.6 + R.g() * 3), toXY(u + R.g() * 4, v)];
      twigs.push({ pts, w: R.r(1.2, 2), seed: spec.seed * 5 + b });
      if (R.f() < 0.6) { // a bare twig end sticking out past the flowers
        const a2 = Math.atan2(v, u - cu * 0.5) + R.g() * 0.5, L2 = br * R.r(1.0, 1.8);
        twigs.push({ pts: [toXY(u, v), toXY(u + Math.cos(a2) * L2 * 0.5, v + Math.sin(a2) * L2 * 0.5 + R.g() * 2), toXY(u + Math.cos(a2) * L2, v + Math.sin(a2) * L2)], w: R.r(0.9, 1.4), seed: spec.seed * 7 + b, end: true });
      }
    }
    // florets: gaussian around blobs
    const area = blobs.reduce((s, b) => s + b.r * b.r * Math.PI, 0);
    const n = Math.round((area / 120) * (spec.dens || 1));
    const fs = spec.fs || 1;
    for (let i = 0; i < n; i++) {
      const b = blobs[Math.floor(R.f() * blobs.length)];
      const rr = Math.sqrt(-2 * Math.log(1 - R.f() * 0.92)) * 0.55;
      const th = R.f() * 6.283;
      const u = b.u + Math.cos(th) * rr * b.r * el, v = b.v + Math.sin(th) * rr * b.r;
      const [x, y] = toXY(u, v);
      const big = R.f() < 0.12 ? R.r(1.25, 1.5) : 1;
      florets.push({ x, y, s: (6 + 7.5 * Math.pow(R.f(), 1.4)) * (0.85 + 0.35 * Math.min(1, rr)) * big * fs, rot: R.f() * 6.283, rr, b });
    }
    // tone from light: facing the upper right and the outer layer are lighter; the core and back darker
    const cx = toXY(cu, 0);
    for (const f of florets) {
      const dx = f.x - cx[0], dy = f.y - cx[1], dl = Math.hypot(dx, dy) + 1e-3;
      const lit = ((dx * LX + dy * LY) / dl) * Math.min(1, dl / spec.r);
      let v = 2.35 + lit * 2.5 + (spec.depth - 0.5) * 2.6 + R.g() * 1.05 + (f.rr > 0.6 ? 0.4 : -0.6);
      f.tone = Math.round(CY.clamp(v, 0, 7));
      f.key = v + R.f() * 0.4;
    }
    florets.sort((a, b) => a.key - b.key);
    // leaves, mostly in the darker underside
    const nl = Math.round(n * (spec.leaves == null ? 0.17 : spec.leaves));
    for (let i = 0; i < nl; i++) {
      const f = florets[Math.floor(R.f() * R.f() * florets.length)];
      leaves.push({ x: f.x + R.g() * 6, y: f.y + R.g() * 6, ang: R.f() * 6.283, s: R.r(9, 16) * fs, col: R.pick(CY.LEAF) });
    }
    // bounds
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const ext = (x, y, m) => { x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m); x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m); };
    ext(0, 0, 8);
    for (const t of twigs) for (const p of t.pts) ext(p[0], p[1], 8);
    for (const f of florets) ext(f.x, f.y, f.s * 1.2 + 24 + 30 * (spec.fs || 1));
    for (const l of leaves) ext(l.x, l.y, l.s + 4);
    const ox = -Math.floor(x0), oy = -Math.floor(y0);
    const S = CY.mk(x1 - x0, y1 - y0), g = S.g;
    const TW = CY.mk(S.w, S.h), tg = TW.g;
    tg.translate(ox, oy);
    g.translate(ox, oy);
    // 1. twigs (ink, under the flowers) on their own sheet, so the pigment pass does not eat the fine lines
    for (const t of twigs) CY.ink(tg, t.pts, { w: t.w, col: CY.TWIG, a: 0.9, dry: 0.25, seed: t.seed, tin: 0.02, tout: t.end ? 0.8 : 0.4, wob: 0.6 });
    // 2. dark underpainting: a loose wash of the mass, then big shadowy bracts
    const RU = CY.rng(spec.seed + 999);
    for (const b of blobs) {
      const [bx, by] = toXY(b.u, b.v);
      g.fillStyle = CY.rgba(CY.TONES[spec.depth < 0.4 ? 0 : 1], 0.5);
      CY.path(g, [CY.blob(bx, by, b.r * 0.62 * el, b.r * 0.55, RU.i(1, 999), 0.35, 28)]); g.fill();
    }
    for (let i = 0; i < n * 0.55; i++) {
      const f = florets[Math.floor(RU.f() * florets.length)];
      if (f.rr > 0.95) continue;
      CY.bract(g, f.x + RU.g() * 3, f.y + RU.g() * 3, RU.f() * 6.283, f.s * RU.r(1.3, 1.9), 0.6, CY.TONES[RU.f() < 0.6 ? 0 : 1], RU.r(0.5, 0.82), RU);
    }
    for (const l of leaves.slice(0, Math.ceil(leaves.length * 0.6))) CY.leaf(g, l.x, l.y, l.ang, l.s, l.col, 0.92);
    // 3. flowers, dark to light
    const RF = CY.rng(spec.seed + 4242);
    for (const f of florets) CY.floret(g, f, RF);
    for (const l of leaves.slice(Math.ceil(leaves.length * 0.6))) CY.leaf(g, l.x, l.y, l.ang, l.s * 0.9, l.col, 0.85);
    for (let i = 0; i < n * 0.16; i++) {
      const f = florets[Math.floor(RF.f() * florets.length)];
      if (f.rr < 0.6) continue;
      const a = Math.atan2(f.y - cx[1], f.x - cx[0]) + RF.g() * 0.7, d = RF.r(6, 30) * (spec.fs || 1);
      CY.bract(g, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, RF.f() * 6.283, f.s * RF.r(0.8, 1.1), 0.52, CY.TONES[CY.clamp(f.tone + RF.i(-1, 1), 0, 7)], 0.88, RF);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // volume: the mass turns from the moonlit upper left into its own shadow at the lower right
    {
      const [mx, my] = toXY(cu, 0), r = spec.r * el;
      const gr = g.createLinearGradient(ox + mx + LX * r, oy + my + LY * r, ox + mx - LX * r * 1.1, oy + my - LY * r * 1.1);
      gr.addColorStop(0, 'rgba(60,0,10,0)'); gr.addColorStop(0.5, 'rgba(60,0,10,0.12)'); gr.addColorStop(1, 'rgba(40,0,12,0.5)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, S.w, S.h); g.globalCompositeOperation = 'source-over';
    }
    CY.pigment(S, spec.seed);
    // the twigs go under the paint, and a few twig ends are re-inked over it so the vine threads through
    g.globalCompositeOperation = 'destination-over'; g.drawImage(TW.c, 0, 0); g.globalCompositeOperation = 'source-over';
    g.translate(ox, oy);
    for (const t of twigs) if (t.end) CY.ink(g, t.pts.slice(1), { w: t.w * 0.8, col: CY.TWIG, a: 0.85, dry: 0.3, seed: t.seed + 1, tin: 0.05, tout: 0.8, wob: 0.4 });
    g.setTransform(1, 0, 0, 1, 0, 0);
    // cast-shadow silhouette, full resolution: the bracts merged (blur) and cut back to a crisp flat shape
    // (threshold), like a gouache shadow laid in one tone. Crisp edges also keep the codec honest: a soft,
    // slowly moving shadow changes large areas by sub-level amounts every frame, which smears the paper grain.
    const sh = CY.mk(S.w, S.h);
    sh.g.filter = 'blur(2.5px)'; sh.g.drawImage(S.c, 0, 0); sh.g.filter = 'none';
    const si = sh.g.getImageData(0, 0, sh.w, sh.h), sd = si.data;
    for (let i = 0; i < sd.length; i += 4) { const a = CY.clamp((sd[i + 3] / 255 - 0.36) / 0.1, 0, 1); sd[i] = sd[i + 1] = sd[i + 2] = 0; sd[i + 3] = a * 255; }
    sh.g.putImageData(si, 0, 0);
    return Object.assign(spec, { c: S.c, ox, oy, sh: sh.c, florets: florets.filter((f) => f.tone >= 2 && f.rr > 0.35) });
  };
})();
