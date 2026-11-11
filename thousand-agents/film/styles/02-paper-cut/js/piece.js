/* 1000 Agents — the film, section 3 of 7: MODULES (10.5–16.0 s, rendered 10.1–16.4 s), as a layered paper-cut diorama.
   Extended from the 3 s style preview; the set is kept minimal: a plain layered indigo backdrop, a ground sheet, a framing mat.
   The twelve files from CODE arrive as small paper cards where the pixel stacks stood; confetti agents carry them, two or three
   at a time, into five layered modules, each labelled by a cut-out shape, each clicking into place with a tiny settle.
   Canvas 2D, no assets. Every frame is a pure function of film time T. */
FILM.define('02-paper-cut', function (canvas, opts) {
  'use strict';
  const W = 1920, H = 1080;
  const cv = canvas; cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const PI = Math.PI, FM = FILM.m, A = FILM.ANCHOR;
  function prng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = FM.clamp, lerp = FM.lerp, sm = FM.ss;
  const backOut = (p) => { p = clamp(p, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function mix(a, b, p) { const A_ = hex(a), B = hex(b); return 'rgb(' + Math.round(lerp(A_[0], B[0], p)) + ',' + Math.round(lerp(A_[1], B[1], p)) + ',' + Math.round(lerp(A_[2], B[2], p)) + ')'; }
  const C = {
    coral: '#d97757', shade: '#a8553b', light: '#f2a585', dark: '#6e2a1a', cream: '#ffdcb8', ink: '#1c0b08',
    sky: '#0f0b2b', far: '#1a1442', ground: '#0d0828', front: '#070416',
    lilac: '#9585ee', lilacDeep: '#5a4cb4', lilacDim: '#4a3d9c', lilacHi: '#b7abff', tag: '#231a5c', teal: '#5fd6c4',
  };

  /* ------------------------------------------------------------------ paper grain */
  const grain = (function () {
    const n = 256, g = document.createElement('canvas'); g.width = g.height = n;
    const x = g.getContext('2d'), im = x.createImageData(n, n), r = prng(77);
    for (let i = 0; i < n * n; i++) {
      const v = r(), w = r(), up = v > 0.5, a = Math.pow(Math.abs(v - 0.5) * 2, 1.6) * (w > 0.8 ? 1 : 0.55);
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = up ? 255 : 0; im.data[i * 4 + 3] = Math.round(a * (up ? 150 : 190));
    }
    x.putImageData(im, 0, 0); x.lineCap = 'round';
    for (let i = 0; i < 150; i++) {
      const px = r() * n, py = r() * n, an = r() * PI, ln = 4 + r() * 16, wh = r() > 0.4;
      x.strokeStyle = wh ? 'rgba(255,255,255,' + (0.12 + r() * 0.2) + ')' : 'rgba(0,0,0,' + (0.12 + r() * 0.2) + ')'; x.lineWidth = 0.7 + r() * 0.5;
      for (let ox = -n; ox <= n; ox += n) for (let oy = -n; oy <= n; oy += n) { x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(px + ox + Math.cos(an) * ln * 0.5, py + oy + Math.sin(an) * ln * 0.5 + 2, px + ox + Math.cos(an) * ln, py + oy + Math.sin(an) * ln); x.stroke(); }
    }
    return ctx.createPattern(g, 'repeat');
  })();

  /* ------------------------------------------------------------------ camera: a slow sideways drift that rests on the anchor framing at both ends */
  let camX = 0, camY = 0;
  function layer(d) { ctx.setTransform(1, 0, 0, 1, -camX * (d - 1), -camY * (d - 1)); }
  function paper(path, color, sh, o) {
    o = o || {};
    ctx.save();
    if (sh) { ctx.shadowColor = 'rgba(2,1,10,' + sh.a + ')'; ctx.shadowBlur = sh.b; ctx.shadowOffsetX = sh.x; ctx.shadowOffsetY = sh.y; }
    ctx.fillStyle = color; ctx.fill(path, o.rule || 'nonzero'); ctx.restore();
    ctx.save(); ctx.clip(path, o.rule || 'nonzero');
    if (o.grad) { ctx.fillStyle = o.grad; ctx.fillRect(-4000, -4000, 8000, 8000); }
    ctx.globalAlpha = o.grain == null ? 0.2 : o.grain; ctx.fillStyle = grain; ctx.fillRect(-4000, -4000, 8000, 8000);
    const e = o.edge == null ? 1 : o.edge;
    if (e > 0) {
      const m = ctx.getTransform(), ew = (o.ew || 2.2) / Math.max(0.2, Math.hypot(m.a, m.b));
      ctx.lineWidth = ew; ctx.globalAlpha = 1;
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e + 1.6, m.f + 2.2); ctx.strokeStyle = 'rgba(255,255,255,' + (0.26 * e) + ')'; ctx.stroke(path);
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e - 1.6, m.f - 2.2); ctx.strokeStyle = 'rgba(0,0,0,' + (0.22 * e) + ')'; ctx.stroke(path);
    }
    ctx.restore();
  }
  function shadowOnly(path, sh) {
    ctx.save(); const m = ctx.getTransform(); ctx.setTransform(m.a, m.b, m.c, m.d, m.e - 6000, m.f);
    ctx.shadowColor = 'rgba(2,1,10,' + sh.a + ')'; ctx.shadowBlur = sh.b; ctx.shadowOffsetX = sh.x * m.a + 6000; ctx.shadowOffsetY = sh.y * m.d;
    ctx.fillStyle = '#000'; ctx.fill(path); ctx.restore();
  }
  function rr(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }

  /* ------------------------------------------------------------------ the set: back sheet, one far sheet, the ground, the mat */
  const GY = A.gy;
  function wave(base, waves, x0, x1) {
    const p = new Path2D(); p.moveTo(x0, 1500);
    for (let x = x0; x <= x1; x += 10) { let y = base; for (const w of waves) y += w[0] * Math.sin(x * w[1] + w[2]); p.lineTo(x, y); }
    p.lineTo(x1, 1500); p.closePath(); return p;
  }
  const P_FAR = wave(GY - 150, [[18, 0.0019, 0.6], [6, 0.0061, 2.0]], -500, 2420);
  const P_GROUND = wave(GY - 22, [[5, 0.0021, 2.2], [2, 0.0071, 0.4]], -500, 2420);
  const P_FRAME = (function () { const p = new Path2D(); p.rect(-600, -600, 3120, 2280); p.roundRect(-40, -60, 2000, 1080, 260); return p; })();
  const STARS = (function () { const r = prng(5), a = []; for (let i = 0; i < 22; i++) a.push([r() * 2100 - 90, r() * 520 - 20, 1.4 + r() * 1.8, r()]); return a; })();

  /* ------------------------------------------------------------------ the hero: the jointed paper puppet of the coral block */
  const PS = 1.06;                                           // puppet scale, to hold the anchor size
  function heroAt(T) {
    const s = FILM.heroAt(T);
    const h = { x: A.x + s.dx * 250, lift: s.lift * 175, tilt: s.lean, sq: -s.sq * 0.62, air: s.air, mouth: s.mouth, blink: s.blink };
    h.armL = 0.5 - 0.75 * s.air;
    h.armR = lerp(0.5 - 0.75 * s.air, -0.92, s.arm) + (-0.45 * s.point);
    h.ex = s.look[0] * 9; h.ey = -s.look[1] * 8;
    return h;
  }
  const BW = 232, BH = 152, LEG = 46;
  const P_BODY = rr(-BW / 2, -LEG - BH, BW, BH, 30);
  const P_BAND = (function () {
    const p = new Path2D(), y = -LEG - 30, n = 16, w = BW / n;
    p.moveTo(-BW / 2 - 4, y + 4);
    for (let i = 0; i < n; i++) { p.lineTo(-BW / 2 + (i + 0.5) * w, y - 4); p.lineTo(-BW / 2 + (i + 1) * w, y + 4); }
    p.lineTo(BW / 2 + 4, y + 4); p.lineTo(BW / 2 + 4, -LEG + 6); p.lineTo(-BW / 2 - 4, -LEG + 6); p.closePath(); return p;
  })();
  const P_TOP = rr(-BW / 2 - 4, -LEG - BH - 6, BW + 8, 22, 4);
  const P_LEG = rr(-19, -16, 38, LEG + 16, [6, 6, 11, 11]);
  const P_ARM = rr(-15, -21, 74, 42, 20);
  const P_BRAD = (function () { const p = new Path2D(); p.arc(0, 0, 5.2, 0, PI * 2); return p; })();
  const LEGX = [-86, -34, 34, 86];
  const S_IN = { x: 2.5, y: 3.5, b: 5, a: 0.38 };
  function heroPaths(h, fn) { for (const k of [1, 2, 0, 3]) { const inner = k === 1 || k === 2; const sw = h.air * (k % 2 ? 0.36 : -0.3) * (inner ? 0.7 : 1) + (k < 2 ? 0.02 : -0.02); fn(P_LEG, inner ? C.shade : C.coral, LEGX[k], -LEG - 4, sw, 1); } }
  function armPaths(h, fn) { fn(P_ARM, C.shade, -BW / 2 + 10, -LEG - 74, h.armL, -1); fn(P_ARM, C.light, BW / 2 - 10, -LEG - 74, h.armR, 1); }
  function drawHero(T) {
    const h = heroAt(T), gy = GY + 4;
    ctx.save(); ctx.translate(h.x + 6, GY + 2); ctx.scale(1, 0.13);
    const cs = 160 * (1 - 0.35 * clamp(h.lift / 74, 0, 1)), g = ctx.createRadialGradient(0, 0, cs * 0.2, 0, 0, cs);
    g.addColorStop(0, 'rgba(1,0,8,' + (0.6 - 0.3 * clamp(h.lift / 74, 0, 1)) + ')'); g.addColorStop(1, 'rgba(1,0,8,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, cs, 0, PI * 2); ctx.fill(); ctx.restore();
    ctx.save();
    ctx.translate(h.x, gy - h.lift); ctx.rotate(h.tilt); ctx.scale(PS * (1 - h.sq * 0.55), PS * (1 + h.sq));
    const big = { x: 13, y: 18, b: 22, a: 0.5 };
    heroPaths(h, (p, c, x, y, r, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(f, 1); ctx.rotate(r); shadowOnly(p, big); ctx.restore(); });
    armPaths(h, (p, c, x, y, r, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(f, 1); ctx.rotate(r); shadowOnly(p, big); ctx.restore(); });
    shadowOnly(P_BODY, big);
    heroPaths(h, (p, c, x, y, r, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(f, 1); ctx.rotate(r); paper(p, c, S_IN, { grain: 0.24 }); ctx.restore(); });
    const bg = ctx.createLinearGradient(0, -LEG - BH, 0, -LEG);
    bg.addColorStop(0, 'rgba(255,214,180,0.10)'); bg.addColorStop(1, 'rgba(110,42,26,0.10)');
    paper(P_BODY, C.coral, { x: 4, y: 5.5, b: 7, a: 0.42 }, { grain: 0.26, grad: bg });
    ctx.save(); ctx.clip(P_BODY);
    paper(P_BAND, C.shade, { x: 1.5, y: 2, b: 3, a: 0.3 }, { grain: 0.24, edge: 0.7 });
    paper(P_TOP, C.light, { x: 1.5, y: 2.5, b: 3.5, a: 0.3 }, { grain: 0.22, edge: 0.7 });
    ctx.restore();
    armPaths(h, (p, c, x, y, r, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(f, 1); ctx.rotate(r); paper(p, c, { x: 3, y: 4.5, b: 6, a: 0.42 }, { grain: 0.24 }); ctx.restore(); });
    const brad = (x, y) => { ctx.save(); ctx.translate(x, y); paper(P_BRAD, C.dark, { x: 1, y: 1.5, b: 2, a: 0.45 }, { grain: 0, edge: 0 }); ctx.fillStyle = 'rgba(255,210,180,0.75)'; ctx.beginPath(); ctx.arc(-1.4, -1.6, 1.5, 0, PI * 2); ctx.fill(); ctx.restore(); };
    brad(-BW / 2 + 10, -LEG - 74); brad(BW / 2 - 10, -LEG - 74);
    for (const x of [LEGX[0], LEGX[3]]) brad(x, -LEG - 11);
    const ex = h.ex, ey = h.ey, EW = 23, EH = 31;
    for (const s of [-1, 1]) {
      const cx = s * 50 + ex, cy = -LEG - 96 + ey, eh = Math.max(4, EH * (1 - h.blink));
      const p = rr(cx - EW / 2, cy - eh / 2 + (EH - eh) * 0.25, EW, eh, Math.min(7, eh / 2));
      paper(p, C.ink, { x: 1.5, y: 2, b: 2.5, a: 0.4 }, { grain: 0.1, edge: 0.5, ew: 1.5 });
      if (h.blink < 0.45) { ctx.fillStyle = '#fff6ea'; ctx.beginPath(); ctx.roundRect(cx - EW / 2 + 3.5, cy - EH / 2 + 4, 8, 8, 2.2); ctx.fill(); }
    }
    if (h.mouth > 0.02) {
      const mw = 62 * (0.55 + 0.45 * h.mouth), mh = 38 * h.mouth, p = rr(-mw / 2 + ex * 0.4, -LEG - 66 - mh * 0.35, mw, mh, Math.min(12, mh / 2));
      ctx.fillStyle = '#1d0806'; ctx.fill(p); ctx.save(); ctx.clip(p);
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 7; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 5; ctx.lineWidth = 6; ctx.strokeStyle = C.shade; ctx.stroke(p); ctx.restore();
    }
    ctx.restore();
    return h;
  }

  /* ------------------------------------------------------------------ files and modules
     Twelve file cards start where the pixel stacks stood. Five modules (a stack of two or three cards on a deeper base, a tab
     and a cut-out shape) assemble one after another; each click lands at MOD[k].t. */
  const FILES = [];
  {
    const COLS = [-4, 9, 22, 35], ROWS = [-50, -37.5, -25];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = COLS[c], y = ROWS[r];
      FILES.push({ x: (190 + x - y) * 5 - 2, y: (165 + (x + y) / 2 - 6) * 5, d: 0.92 + 0.04 * r + 0.02 * c });
    }
  }
  const MW = 196, MH = 132;
  const MOD = [
    { x: 1068, y: GY - MH / 2 - 4, t: 12.0, files: [8, 4, 0], shape: 'circle', d: 1.0 },
    { x: 1286, y: GY - MH / 2 - 4, t: 12.7, files: [9, 5], shape: 'triangle', d: 1.0 },
    { x: 1504, y: GY - MH / 2 - 4, t: 13.4, files: [10, 6, 1], shape: 'square', d: 1.0 },
    { x: 1177, y: GY - MH * 1.5 - 22, t: 14.1, files: [2, 11], shape: 'hex', d: 0.985 },
    { x: 1395, y: GY - MH * 1.5 - 22, t: 14.8, files: [3, 7], shape: 'bars', d: 0.985 },
  ];
  const FLY = 0.62;                                          // a card's flight
  MOD.forEach((m) => { m.files.forEach((fi, j) => { FILES[fi].mod = m; FILES[fi].slot = j; FILES[fi].t1 = m.t - 0.16 - (m.files.length - 1 - j) * 0.22; FILES[fi].t0 = FILES[fi].t1 - FLY; }); });
  function shapePath(kind, r) {
    const p = new Path2D();
    if (kind === 'circle') p.arc(0, 0, r, 0, PI * 2);
    else if (kind === 'triangle') { p.moveTo(0, -r * 1.1); p.lineTo(r * 1.05, r * 0.75); p.lineTo(-r * 1.05, r * 0.75); p.closePath(); }
    else if (kind === 'square') p.roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, 4);
    else if (kind === 'hex') { for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + PI / 6; if (i) p.lineTo(Math.cos(a) * r, Math.sin(a) * r); else p.moveTo(Math.cos(a) * r, Math.sin(a) * r); } p.closePath(); }
    else { for (let i = 0; i < 3; i++) p.roundRect(-r, -r * 0.8 + i * r * 0.62, r * 2 - i * r * 0.5, r * 0.36, 3); }
    return p;
  }
  const P_CARD = rr(-34, -24, 68, 48, 7);
  function cardLines(w, seed) {
    for (let i = 0; i < 3; i++) { const len = (0.4 + 0.5 * FM.hash(seed, i)) * (w - 20); ctx.fillStyle = i === 0 ? 'rgba(242,165,133,0.75)' : 'rgba(30,20,80,0.55)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 10, -14 + i * 11, len, 5, 2.5); ctx.fill(); }
  }
  function cardPos(f, T) {                                     // where a file card is, its scale and rotation
    if (T <= f.t0) return { x: f.x, y: f.y, s: 1, r: 0.03 * Math.sin(T * 2 + f.x), d: f.d, k: 0 };
    const m = f.mod, tx = m.x, ty = m.y + 18 - f.slot * 15, u = clamp((T - f.t0) / (f.t1 - f.t0), 0, 1), e = FM.eio(u);
    const mx = (f.x + tx) / 2, my = Math.min(f.y, ty) - 170 - 40 * FM.hash(f.x | 0, 3);
    const x = (1 - e) * (1 - e) * f.x + 2 * (1 - e) * e * mx + e * e * tx, y = (1 - e) * (1 - e) * f.y + 2 * (1 - e) * e * my + e * e * ty;
    return { x, y, s: lerp(1, 2.6, e), r: Math.sin(u * PI) * 0.35 * (FM.hash(f.x | 0, 4) - 0.5) * 2, d: lerp(f.d, m.d + 0.006 * f.slot, e), k: u };
  }
  function settle(T, t) { const a = T - t; return a < 0 ? 0 : Math.exp(-a * 9) * Math.sin(a * 34) * 0.06; }
  function drawModule(m, T) {
    const k = T - (m.t - 0.16 - (m.files.length - 1) * 0.22 - FLY - 0.25);
    if (k <= 0) return;
    const base = backOut(k / 0.35), st = settle(T, m.t);
    layer(m.d - 0.012);
    ctx.save(); ctx.translate(m.x, m.y + MH / 2); ctx.scale(1 + st * 0.6, base * (1 - st)); ctx.translate(0, -MH / 2);
    // the base: a deeper sheet with a notch tab on top
    const P_BASE = rr(-MW / 2, -MH / 2, MW, MH, 14);
    paper(P_BASE, C.lilacDim, { x: 9, y: 13, b: 16, a: 0.5 }, { grain: 0.22 });
    const P_TAB = rr(-MW / 2 + 14, -MH / 2 - 18, 62, 24, 7);
    paper(P_TAB, C.lilacDeep, { x: 3, y: 4, b: 5, a: 0.4 }, { grain: 0.22, edge: 0.7 });
    ctx.restore();
  }
  function drawCard(f, T) {
    const p = cardPos(f, T);
    const m = f.mod, landed = T >= f.t1;
    layer(p.d);
    ctx.save();
    if (landed) {                                           // settled in its module: a full-width sheet, offset by depth
      const st = settle(T, f.t1) + settle(T, m.t) * 0.5;
      ctx.translate(m.x - 6 + f.slot * 6, m.y + 16 - f.slot * 15); ctx.scale(1 + st * 0.5, 1 - st);
      const w = MW - 34 - f.slot * 10, h = MH - 46 - f.slot * 8;
      paper(rr(-w / 2, -h / 2, w, h, 10), f.slot % 2 ? C.lilac : mix(C.lilac, C.lilacHi, 0.35), { x: 4, y: 6, b: 7, a: 0.42 }, { grain: 0.2 });
      ctx.save(); ctx.scale(w / 160, 1); cardLines(160, FILES.indexOf(f)); ctx.restore();
    } else {
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(p.s * 0.62, p.s * 0.62);
      paper(P_CARD, mix(C.lilac, C.lilacHi, 0.2), { x: 4 + 6 * p.k, y: 6 + 10 * p.k, b: 6 + 10 * p.k, a: 0.45 }, { grain: 0.2 });
      cardLines(68, FILES.indexOf(f));
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ the agents: 1000 paper confetti
     They circle the set in a slow, breathing ring of lanes (each its own depth, so the ring has parallax); the ones near a
     flying card peel off and escort it. Shadows are offset copies, not blurs, so the swarm stays cheap. */
  const P_CONF = [rr(-0.62, -0.42, 1.24, 0.84, 0.2), rr(-0.45, -0.45, 0.9, 0.9, 0.12),
    (function () { const p = new Path2D(); p.moveTo(0, -0.6); p.lineTo(0.58, 0.42); p.lineTo(-0.58, 0.42); p.closePath(); return p; })(),
    (function () { const p = new Path2D(); p.arc(0, 0, 0.46, 0, PI * 2); return p; })()];
  const CC = [C.coral, C.coral, C.coral, C.light, C.light, C.shade, C.cream];
  const AGC = FILM.AG.map((g) => ({
    lane: Math.floor(g.r[0] * 6), a0: g.r[1] * PI * 2, sp: 0.16 + 0.02 * g.r[2], size: 5 + g.r[3] * 5, kind: Math.floor(g.r[4] * 4),
    col: CC[Math.floor(g.r[5] * CC.length)], fl: g.r[6] * 6.28, wf: 4 + g.r[7] * 7, rot: g.r[2] * 6.28,
    esc: Math.floor(g.r[3] * 12), escK: g.r[4],
  }));
  const RING = { cx: 1150, cy: 300 };
  function confettiPos(i, T) {
    const g = AGC[i], L = g.lane;
    const an = g.a0 + g.sp * (T - 10) * (L % 2 ? 1 : -1) * 0.9;
    const rx = 520 + L * 46 + 12 * Math.sin(an * 3 + T * 0.7), ry = 118 + L * 15 + 6 * Math.sin(an * 2 - T * 0.5);
    let x = RING.cx + Math.cos(an) * rx, y = RING.cy + Math.sin(an) * ry;
    const d = 0.86 + 0.06 * L + 0.18 * Math.sin(an);         // nearer at the bottom of the ring
    // escorts: one in twelve agents travels with a flying card
    const f = FILES[g.esc];
    if (g.escK < 0.09 && T > f.t0 - 0.35 && T < f.t1 + 0.4) {
      const p = cardPos(f, clamp(T, f.t0, f.t1)), w = FM.ss(f.t0 - 0.35, f.t0, T) * (1 - FM.ss(f.t1, f.t1 + 0.4, T));
      const ox = Math.cos(g.a0 + T * 6) * (40 + 30 * g.escK * 10), oy = Math.sin(g.a0 * 1.3 + T * 5) * (30 + 20 * g.escK * 10);
      x = lerp(x, p.x + ox, w); y = lerp(y, p.y + oy, w);
      return { x, y, d: lerp(d, p.d + 0.02, w) };
    }
    return { x, y, d };
  }
  function drawConfetti(T, near) {
    for (let i = 0; i < FILM.N; i++) {
      const g = AGC[i], p = confettiPos(i, T);
      if ((p.d > 1.0) !== near) continue;
      layer(p.d);
      const s = g.size * (0.7 + 0.3 * p.d), flip = Math.cos(g.fl + g.wf * T);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(g.rot + T * 1.3 * (g.wf - 7) * 0.2); ctx.scale(s, s * (0.25 + 0.75 * Math.abs(flip)));
      const sh = (3 + 6 * p.d) / s;
      ctx.translate(sh, sh * 1.4); ctx.fillStyle = 'rgba(2,1,10,0.32)'; ctx.fill(P_CONF[g.kind]); ctx.translate(-sh, -sh * 1.4);
      ctx.fillStyle = flip < 0 ? (g.col === C.shade ? C.dark : g.col === C.cream ? C.light : g.col === C.light ? C.coral : C.shade) : g.col;
      ctx.fill(P_CONF[g.kind]);
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------ one frame */
  function render(T) {
    camX = 46 * Math.sin(PI * FM.sat((T - 10.9) / 4.7)); camY = -8 * Math.sin(PI * FM.sat((T - 10.9) / 4.7));
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.sky; ctx.fillRect(0, 0, W, H);
    layer(0.15);
    ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = grain; ctx.fillRect(-300, -300, 2600, 1700); ctx.restore();
    for (const s of STARS) { ctx.fillStyle = 'rgba(176,160,255,' + (0.12 + 0.25 * s[3]) + ')'; ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, PI * 2); ctx.fill(); }
    // a soft lit centre on the back sheet
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let g = ctx.createRadialGradient(1060, 520, 60, 1060, 520, 900); g.addColorStop(0, 'rgba(70,52,150,0.24)'); g.addColorStop(1, 'rgba(20,12,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    layer(0.6); paper(P_FAR, C.far, { x: 6, y: -8, b: 40, a: 0.8 }, { grain: 0.2, edge: 0.5 });
    drawConfetti(T, false);
    layer(1); paper(P_GROUND, C.ground, { x: 6, y: -8, b: 38, a: 0.9 }, { grain: 0.2, edge: 0.6 });
    // modules and cards
    const order = MOD.slice().sort((a, b) => b.y - a.y);
    for (const m of order) drawModule(m, T);
    const cards = FILES.slice().sort((a, b) => cardPos(a, T).d - cardPos(b, T).d);
    for (const f of cards) drawCard(f, T);
    for (const m of order) { const lk = T - m.t; if (lk > -0.12) drawModuleLabel(m, T); }
    drawHero(T);
    drawConfetti(T, true);
    layer(1.75); paper(P_FRAME, C.front, { x: 14, y: 20, b: 40, a: 0.75 }, { grain: 0.18, rule: 'evenodd', edge: 0.25 });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const v = ctx.createRadialGradient(960, 560, 420, 960, 560, 1180);
    v.addColorStop(0, 'rgba(3,1,12,0)'); v.addColorStop(1, 'rgba(3,1,12,0.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  function drawModuleLabel(m, T) {
    const lk = T - m.t;
    layer(m.d + 0.02);
    const s = backOut((lk + 0.12) / 0.3);
    ctx.save(); ctx.translate(m.x + MW / 2 - 40, m.y - MH / 2 + 26); ctx.scale(s, s);
    paper(rr(-25, -25, 50, 50, 11), C.tag, { x: 3, y: 4, b: 5, a: 0.45 }, { grain: 0.2, edge: 0.6 });
    paper(shapePath(m.shape, 13), lk > 0.25 ? mix(C.teal, C.lilacHi, 0.25) : C.lilacHi, { x: 1.5, y: 2, b: 2, a: 0.4 }, { grain: 0.15, edge: 0.5 });
    ctx.restore();
  }
  return { renderAt: render, isReady: () => true };
});
