/* SketchZoom — an infinite zoom through nested hand-drawn worlds.
   Every world is an ordinary Sketch.Page drawing on a 1600×1000 sheet. Each one holds a "portal": a rotated
   16:10 rectangle where the next world lives. Worlds are baked to bitmaps with the next worlds already drawn
   inside their portals (three deep), then every frame is composited along a logarithmic spiral into the portal.
   The last world's portal holds the first one, so the zoom never ends. */
(function (g) {
  'use strict';
  const S = g.Sketch, W = 1600, H = 1000, TAU = Math.PI * 2;
  const C = {
    mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
    div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
    pow: (a, t) => { const r = Math.pow(Math.hypot(a[0], a[1]), t), th = Math.atan2(a[1], a[0]) * t; return [r * Math.cos(th), r * Math.sin(th)]; },
    abs: a => Math.hypot(a[0], a[1]), sc: (a, k) => [a[0] * k, a[1] * k]
  };
  const setX = (ctx, A, B) => ctx.setTransform(A[0], A[1], -A[1], A[0], B[0], B[1]);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const defs = [];
  const SZ = g.SketchZoom = { defs, W, H, C, lib: {} };
  SZ.world = d => { defs.push(d); return d; };

  /* the portal: centre (cx, cy), width w (so scale s = w / 1600), rotation in degrees */
  function portalOf(d) {
    const p = d.portal, s = p.w / W, th = (p.rot || 0) * Math.PI / 180, a = [s * Math.cos(th), s * Math.sin(th)];
    const o = C.sub([p.cx, p.cy], C.mul(a, [W / 2, H / 2])), c = C.div(o, C.sub([1, 0], a));
    const corners = [[0, 0], [W, 0], [W, H], [0, H]].map(y => C.add(o, C.mul(a, y)));
    return { s, th, a, o, c, corners, feather: p.feather ?? 24, w: p.w, h: p.w * H / W, cx: p.cx, cy: p.cy };
  }
  SZ.portalOf = portalOf;

  /* ops → drawable geometry (Path2D in world units) with bounding boxes for culling */
  function compile(ops) {
    const out = [];
    for (const op of ops) {
      const path = new Path2D(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const inc = (x, y, r) => { if (x - r < x0) x0 = x - r; if (y - r < y0) y0 = y - r; if (x + r > x1) x1 = x + r; if (y + r > y1) y1 = y + r; };
      const it = { k: op.k, path, blend: op.blend };
      if (op.k === 's') {
        const p = op.p; if (p.length < 2) continue; const L = [], R = [];
        for (let n = 0; n < p.length; n++) { const q = p[n], a = p[Math.max(0, n - 1)], b = p[Math.min(p.length - 1, n + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; const hw = q[2] * 0.68; L.push(q[0] - ty * hw, q[1] + tx * hw); R.push(q[0] + ty * hw, q[1] - tx * hw); inc(q[0], q[1], hw + 0.5); }
        path.moveTo(L[0], L[1]); for (let n = 2; n < L.length; n += 2) path.lineTo(L[n], L[n + 1]); for (let n = R.length - 2; n >= 0; n -= 2) path.lineTo(R[n], R[n + 1]); path.closePath();
        it.fill = S.rgba(op.c, op.a);
      } else if (op.k === 'f' || op.k === 'e') {
        const rings = op.rings || [op.poly]; for (const pl of rings) { if (pl.length < 3) continue; path.moveTo(pl[0][0], pl[0][1]); for (let n = 1; n < pl.length; n++) path.lineTo(pl[n][0], pl[n][1]); path.closePath(); pl.forEach(q => inc(q[0], q[1], 1)); }
        if (x1 < x0) continue; if (op.rings) it.eo = true;
        if (op.k === 'f') { if (op.g) it.g = op.g; else it.fill = S.rgba(op.c, op.a); if (op.edge) it.edge = S.rgba(op.g ? op.g.c1 : op.c, Math.min(1, (op.g ? op.g.a1 : op.a) * 0.55)); }
      } else if (op.k === 'd') { path.arc(op.x, op.y, op.r, 0, TAU); inc(op.x, op.y, op.r); it.fill = S.rgba(op.c, op.a); }
      else if (op.k === 'i') { it.img = op.img; it.r = [op.x, op.y, op.w, op.h]; it.a = op.a ?? 1; inc(op.x, op.y, 0); inc(op.x + op.w, op.y + op.h, 0); }
      else if (op.k === 'D') { for (const q of op.p) { path.moveTo(q[0] + q[2], q[1]); path.arc(q[0], q[1], q[2], 0, TAU); inc(q[0], q[1], q[2]); } if (!op.p.length) continue; it.fill = S.rgba(op.c, op.a); }
      else continue;
      it.bb = [x0, y0, x1, y1]; out.push(it);
    }
    return out;
  }
  function drawGeo(ctx, geo, view, i0 = 0, i1 = geo.length) {
    for (let i = i0; i < i1; i++) {
      const o = geo[i];
      if (view && (o.bb[2] < view[0] || o.bb[0] > view[2] || o.bb[3] < view[1] || o.bb[1] > view[3])) continue;
      if (o.k === 'e') { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000'; ctx.fill(o.path); ctx.restore(); continue; }
      if (o.k === 'i') { ctx.save(); if (o.blend) ctx.globalCompositeOperation = o.blend; ctx.globalAlpha = o.a; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(o.img, o.r[0], o.r[1], o.r[2], o.r[3]); ctx.restore(); continue; }
      if (o.blend) { ctx.save(); ctx.globalCompositeOperation = o.blend; }
      if (o.g) { const gg = o.g, gr = gg.r1 !== undefined ? ctx.createRadialGradient(gg.x0, gg.y0, gg.r0 || 0, gg.x0, gg.y0, gg.r1) : ctx.createLinearGradient(gg.x0, gg.y0, gg.x1, gg.y1); gr.addColorStop(0, S.rgba(gg.c0, gg.a0)); gr.addColorStop(1, S.rgba(gg.c1, gg.a1)); ctx.fillStyle = gr; }
      else ctx.fillStyle = o.fill;
      ctx.fill(o.path, o.eo ? 'evenodd' : 'nonzero');
      if (o.edge) { ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.strokeStyle = o.edge; ctx.stroke(o.path); }
      if (o.blend) ctx.restore();
    }
  }
  SZ.compile = compile; SZ.drawGeo = drawGeo;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  function feathered(src, px) {
    const c = mk(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0);
    if (px > 0.5) { const w = c.width, h = c.height; x.globalCompositeOperation = 'destination-out';
      [[0, 0, px, 0, 0, 0, px, h], [w, 0, w - px, 0, w - px, 0, px, h], [0, 0, 0, px, 0, 0, w, px], [0, h, 0, h - px, 0, h - px, w, px]].forEach(([a, b, cc, d, rx, ry, rw, rh]) => { const gr = x.createLinearGradient(a, b, cc, d); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(rx, ry, rw, rh); }); }
    return c;
  }

  /* ---------------------------------------------------------------- the engine ---------------------------------------------------------------- */
  SZ.engine = function (opts = {}) {
    const N = defs.length, q = opts.q ?? 1, beta = opts.beta ?? 1.5, D0 = q * beta, spd = opts.speed ?? 1.35, ease = opts.ease ?? 0.55;
    const P = defs.map(portalOf);
    const worlds = defs.map((d, k) => ({ d, k, P: P[k], L: Math.max(1, Math.ceil(Math.log2(1 / P[k].s) - 1e-6)), levels: [], queued: [], live: d.live || [] }));
    /* from the level where the crossfade begins, a world's over-layer is kept on bitmaps of its own, so it can stay on top of the next
       world and be taken away through a soft hole that opens from the middle of the portal and reaches its edges only at the very end */
    worlds.forEach(w => { w.mx = Math.max(1, Math.floor(0.8 * Math.log2(1 / w.P.s) + 1e-9)); });
    const HM = mk(320, 200), hmx = HM.getContext('2d'), hmi = hmx.createImageData(320, 200), HN = new Float32Array(320 * 200);
    { const h = (x, y) => { let v = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; }, vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return lerp(lerp(h(xi, yi), h(xi + 1, yi), su), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), su), sv); };
      for (let j = 0; j < 200; j++) for (let i = 0; i < 320; i++) HN[j * 320 + i] = (vn(i / 22, j / 22) * 0.65 + vn(i / 9 + 50, j / 9) * 0.35) - 0.5; }
    const holeMask = al => { const q = Math.pow(1 - al, 0.75), df = 0.3125 * q, b = 0.12 * q + 0.003, A = 0.12 * q, d = hmi.data; // a ragged front sweeps from the middle of the portal to its edges
      for (let j = 0; j < 200; j++) for (let i = 0; i < 320; i++) { const u = (i + 0.5) / 320, v = (j + 0.5) / 200, e = Math.min(u, 1 - u, v * 0.625, (1 - v) * 0.625) + A * HN[j * 320 + i], o = (j * 320 + i) * 4; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(255 * smooth(df, df + b, e)); }
      hmx.putImageData(hmi, 0, 0); return HM; };
    let scratch = null;
    const E = { N, worlds, ready: false, status: '', D0 };
    const ctxOf = w => { const par = P[(w.k - 1 + N) % N], me = w.P; return { k: w.k, W, H, portal: me, parent: par, lib: SZ.lib, C,
      toChild: z => C.div(C.sub(z, me.o), me.a), fromChild: y => C.add(me.o, C.mul(me.a, y)), fromParent: z => C.div(C.sub(z, par.o), par.a), toParent: y => C.add(par.o, C.mul(par.a, y)) }; };
    E.ctxOf = k => ctxOf(worlds[k]);
    function build(w) {
      const t0 = performance.now(), seed = w.d.seed ?? (1 + w.k * 101), ink = w.d.ink || '#1a1410';
      const Pu = new S.Page(seed, { ink }); w.d.build(Pu, ctxOf(w));
      const Po = new S.Page(seed + 7, { ink }); if (w.d.over) w.d.over(Po, ctxOf(w));
      w.nU = Pu.ops.length; w.nO = Po.ops.length; w.geoU = compile(Pu.ops); w.geoO = compile(Po.ops); w.ops = Pu.ops; w.opsO = Po.ops;
      w.bbO = w.geoO.reduce((b, o) => [Math.min(b[0], o.bb[0]), Math.min(b[1], o.bb[1]), Math.max(b[2], o.bb[2]), Math.max(b[3], o.bb[3])], [1e9, 1e9, -1e9, -1e9]);
      w.buildMs = performance.now() - t0;
    }
    const fullF = w => w.fullF || (w.fullF = feathered(w.full, w.parentFeather * D0));
    worlds.forEach(w => { w.parentFeather = P[(w.k - 1 + N) % N].feather; });
    function bake(x, R0, D, inner, pp) { // the next world, feathered, into this world's portal; canvas maps world z → (z − R0)·D
      setX(x, C.sc(pp.a, D / D0), C.sc(C.sub(pp.o, R0), D)); x.drawImage(inner, 0, 0);
    }
    function* renderUnder(w) { const c = mk(W * D0, H * D0), x = c.getContext('2d'); x.setTransform(D0, 0, 0, D0, 0, 0); for (let i = 0; i < w.geoU.length; i += 2500) { drawGeo(x, w.geoU, null, i, Math.min(w.geoU.length, i + 2500)); yield; } w.under = c; }
    function composeFull(w) {
      const c = w.full || mk(W * D0, H * D0), x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); x.drawImage(w.under, 0, 0);
      const nx = worlds[(w.k + 1) % N]; if (nx.full) bake(x, [0, 0], D0, fullF(nx), w.P);
      x.setTransform(D0, 0, 0, D0, 0, 0); drawGeo(x, w.geoO, null); w.full = c; w.fullF = null;
    }
    function levelRegion(w, m) {
      const { s, a, c } = w.P, Z0 = Math.pow(2, m), Z1 = m === w.L - 1 ? 1 / s : Math.pow(2, m + 1), lz = Math.log(1 / s); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i <= 10; i++) { const Zm = Z0 * Math.pow(Z1 / Z0, i / 10), Af = C.pow(a, Math.log(Zm) / lz); for (const u of [[0, 0], [W, 0], [W, H], [0, H]]) { const z = C.add(c, C.mul(Af, C.sub(u, c))); x0 = Math.min(x0, z[0]); x1 = Math.max(x1, z[0]); y0 = Math.min(y0, z[1]); y1 = Math.max(y1, z[1]); } }
      const px = (x1 - x0) * 0.02, py = (y1 - y0) * 0.02; return [Math.max(0, x0 - px), Math.max(0, y0 - py), Math.min(W, x1 + px), Math.min(H, y1 + py)];
    }
    function* levelJob(w, m) {
      const R = levelRegion(w, m), D = D0 * Math.pow(2, m), c = mk((R[2] - R[0]) * D, (R[3] - R[1]) * D), x = c.getContext('2d');
      x.setTransform(D, 0, 0, D, -R[0] * D, -R[1] * D);
      for (let i = 0; i < w.geoU.length; i += 2500) { drawGeo(x, w.geoU, R, i, Math.min(w.geoU.length, i + 2500)); yield; }
      bake(x, [R[0], R[1]], D, fullF(worlds[(w.k + 1) % N]), w.P);
      let o = null;
      if (w.geoO.length && m >= w.mx) { const b = w.bbO, Ro = [Math.max(R[0], b[0]), Math.max(R[1], b[1]), Math.min(R[2], b[2]), Math.min(R[3], b[3])];
        if (Ro[2] > Ro[0] && Ro[3] > Ro[1]) { // additive light gets a bitmap of its own, so it is added back rather than laid over
          const paint = geo => { if (!geo.length) return null; const oc = mk((Ro[2] - Ro[0]) * D, (Ro[3] - Ro[1]) * D), ox = oc.getContext('2d'); ox.setTransform(D, 0, 0, D, -Ro[0] * D, -Ro[1] * D); drawGeo(ox, geo, Ro); return oc; };
          o = { R: Ro, c: paint(w.geoO.filter(g => g.blend !== 'lighter')), add: paint(w.geoO.filter(g => g.blend === 'lighter')) }; } }
      else { x.setTransform(D, 0, 0, D, -R[0] * D, -R[1] * D); drawGeo(x, w.geoO, R); }
      w.levels[m] = { c, R, D, o };
    }
    function* prepare() {
      for (const w of worlds) { E.status = 'drawing ' + w.d.name; yield; build(w); }
      for (const w of worlds) { E.status = 'inking ' + w.d.name; yield* renderUnder(w); }
      for (let pass = 0; pass < 3; pass++) for (let k = N - 1; k >= 0; k--) { composeFull(worlds[k]); yield; }
      worlds.forEach(w => { w.under = null; });
      E.ready = true; E.status = '';
    }
    const prep = prepare(), jobs = [];
    E.need = k => { const w = worlds[((k % N) + N) % N]; if (!E.ready) return; for (let m = 1; m < w.L; m++) if (!w.levels[m] && !w.queued[m]) { w.queued[m] = true; jobs.push({ k: w.k, g: levelJob(w, m) }); } };
    /* keep the sharp levels only for the worlds in view; the rest are dropped, with any work still queued for them */
    E.release = keep => { worlds.forEach(w => { if (!keep.includes(w.k)) { w.levels = []; w.queued = []; if (!keep.includes((w.k - 1 + N) % N)) w.fullF = null; } }); for (let i = jobs.length - 1; i >= 0; i--) if (!keep.includes(jobs[i].k)) jobs.splice(i, 1); };
    E.pump = (budget = 8) => { const t0 = performance.now(); while (performance.now() - t0 < budget) { if (!E.ready) { if (prep.next().done) continue; continue; } if (!jobs.length) return true; const j = jobs[0]; if (j.g.next().done) jobs.shift(); } return E.ready && !jobs.length; };
    E.finish = () => { while (!E.pump(1e9)); };
    /* timeline: equal time per doubling of zoom; each world lingers a little when it fills the page */
    const dur = worlds.map(w => spd * Math.log2(1 / w.P.s)); E.total = dur.reduce((a, b) => a + b, 0); E.dur = dur;
    E.at = t => { let u = ((t % E.total) + E.total) % E.total, k = 0; while (u >= dur[k]) { u -= dur[k]; k++; } const v = u / dur[k]; return { k, f: v - ease * Math.sin(TAU * v) / TAU }; };
    /* draw one frame: world k, depth f ∈ [0,1) */
    E.draw = (ctx, k, f, outW, outH, t = 0, o = {}) => {
      const w = worlds[k], pp = w.P, qo = outW / W, Af = C.pow(pp.a, -f), Zm = C.abs(Af);
      ctx.setTransform(1, 0, 0, 1, 0, 0); if (!o.keep) ctx.clearRect(0, 0, outW, outH); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      let m = Math.max(0, Math.min(w.L - 1, Math.floor(Math.log2(Zm) + 1e-9))); while (m > 0 && !w.levels[m]) m--;
      const lv = m === 0 ? { c: w.full, R: [0, 0], D: D0 } : w.levels[m];
      setX(ctx, C.sc(Af, qo / lv.D), C.sc(C.add(pp.c, C.mul(Af, C.sub([lv.R[0], lv.R[1]], pp.c))), qo)); ctx.drawImage(lv.c, 0, 0);
      const Aw = C.sc(Af, qo), Bw = C.sc(C.sub(pp.c, C.mul(Af, pp.c)), qo);
      if (w.live.length && !o.noLive) drawLive(ctx, w, t, Aw, Bw, 1);
      const al = smooth(0.8, 1, f), nx = worlds[(k + 1) % N];
      const Ai = C.mul(Aw, pp.a), Bi = C.add(Bw, C.mul(Aw, pp.o));
      if (al > 0) { // the next world arrives through its soft-edged image; its hard edge comes in only as that edge reaches the frame
        const hf = smooth(0.93, 1, f); setX(ctx, C.sc(Ai, 1 / D0), Bi); ctx.globalAlpha = al; ctx.drawImage(fullF(nx), 0, 0); if (hf > 0) { ctx.globalAlpha = hf; ctx.drawImage(nx.full, 0, 0); } ctx.globalAlpha = 1;
        if (nx.live.length && !o.noLive) drawLive(ctx, nx, t, Ai, Bi, al); }
      if (lv.o) { const Ao = C.sc(Af, qo / lv.D), Bo = C.sc(C.add(pp.c, C.mul(Af, C.sub([lv.o.R[0], lv.o.R[1]], pp.c))), qo);
        const hole = al > 0 ? holeMask(al) : null, lay = (img, mode) => { if (!img) return; if (al <= 0) { ctx.globalCompositeOperation = mode; setX(ctx, Ao, Bo); ctx.drawImage(img, 0, 0); ctx.globalCompositeOperation = 'source-over'; return; }
          if (!scratch || scratch.width !== outW || scratch.height !== outH) scratch = mk(outW, outH);
          const tx = scratch.getContext('2d');
          tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, outW, outH); tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
          setX(tx, Ao, Bo); tx.drawImage(img, 0, 0); tx.globalCompositeOperation = 'destination-out'; setX(tx, C.sc(Ai, W / 320), Bi); tx.drawImage(hole, 0, 0); tx.globalCompositeOperation = 'source-over';
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = mode; ctx.drawImage(scratch, 0, 0); ctx.globalCompositeOperation = 'source-over'; };
        lay(lv.o.c, 'source-over'); lay(lv.o.add, 'lighter'); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    function drawLive(ctx, w, t, A, B, alpha) {
      const Q = new S.Page(9 + Math.floor(t * 6) % 3, { ink: w.d.ink || '#1a1410' }), cx = ctxOf(w); w.live.forEach(fn => fn(Q, t, cx)); if (!Q.ops.length) return;
      const geo = compile(Q.ops); ctx.save(); ctx.globalAlpha = alpha; setX(ctx, A, B); drawGeo(ctx, geo, null); ctx.restore();
    }
    /* how far the visible region ever strays outside a world's sheet, in world units (0 = never) */
    E.coverage = () => worlds.map(w => { const { a, c } = w.P; let worst = 0; for (let i = 0; i <= 200; i++) { const f = i / 200, Af = C.pow(a, f); for (const u of [[0, 0], [W, 0], [W, H], [0, H]]) { const z = C.add(c, C.mul(Af, C.sub(u, c))); worst = Math.max(worst, -z[0], z[0] - W, -z[1], z[1] - H); } } return Math.round(worst * 10) / 10; });
    E.frame = (ctx, t, outW, outH, o = {}) => {
      if (!E.ready) return false; const { k, f } = E.at(t); if (E.last && E.last.k !== k) E.release([k, (k + 1) % N]); E.need(k); if (f > 0.35) E.need(k + 1);
      if (o.sync) E.finish(); E.draw(ctx, k, f, outW, outH, t, o); E.last = { k, f }; return true;
    };
    return E;
  };
})(window);
