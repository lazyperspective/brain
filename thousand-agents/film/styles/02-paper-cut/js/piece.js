/* 1000 Agents - the first 3 seconds as a layered paper-cut diorama.
   Canvas 2D, no assets, no libraries. Every frame is a pure function of t.

   The scene is a stack of cut paper sheets at different depths. Each sheet is drawn as:
   a soft drop shadow on whatever lies behind it, a flat fill, paper grain (a seeded noise tile, clipped
   to the sheet and moving with it), and a lit / shaded cut edge. A slow camera drift shifts the sheets
   against each other in proportion to their depth. */
(function () {
  'use strict';
  const W = 1920, H = 1080, DUR = 3;
  const cv = document.getElementById('c');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const PI = Math.PI;

  /* ------------------------------------------------------------------ helpers */
  function prng(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, p) => a + (b - a) * p;
  const sm = (a, b, x) => { const p = clamp((x - a) / (b - a), 0, 1); return p * p * (3 - 2 * p); };
  const backOut = (p) => { p = clamp(p, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function mix(a, b, p) {
    const A = hex(a), B = hex(b);
    return 'rgb(' + Math.round(lerp(A[0], B[0], p)) + ',' + Math.round(lerp(A[1], B[1], p)) + ',' + Math.round(lerp(A[2], B[2], p)) + ')';
  }

  const C = {
    coral: '#d97757', shade: '#a8553b', light: '#f2a585', dark: '#6e2a1a', cream: '#ffdcb8',
    ink: '#1c0b08',
    sky: '#1b1447', moon: '#2a1f68', hillC: '#16103f', hillB: '#110b33', ground: '#0c0724', front: '#070416',
    lilac: '#9585ee', lilacDeep: '#5a4cb4', lilacDim: '#4a3d9c', tag: '#231a5c', tagInk: '#b9abff',
  };

  /* ------------------------------------------------------------------ paper grain: a seeded tile of fine speckle and fibres */
  const grain = (function () {
    const n = 256, g = document.createElement('canvas');
    g.width = g.height = n;
    const x = g.getContext('2d'), im = x.createImageData(n, n), r = prng(77);
    for (let i = 0; i < n * n; i++) {
      const v = r(), w = r();
      const up = v > 0.5, a = Math.pow(Math.abs(v - 0.5) * 2, 1.6) * (w > 0.8 ? 1 : 0.55);
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = up ? 255 : 0;
      im.data[i * 4 + 3] = Math.round(a * (up ? 150 : 190));
    }
    x.putImageData(im, 0, 0);
    x.lineCap = 'round';
    for (let i = 0; i < 150; i++) {                        // fibres
      const px = r() * n, py = r() * n, an = r() * PI, ln = 4 + r() * 16, wh = r() > 0.4;
      x.strokeStyle = wh ? 'rgba(255,255,255,' + (0.12 + r() * 0.2) + ')' : 'rgba(0,0,0,' + (0.12 + r() * 0.2) + ')';
      x.lineWidth = 0.7 + r() * 0.5;
      for (let ox = -n; ox <= n; ox += n) for (let oy = -n; oy <= n; oy += n) {
        x.beginPath(); x.moveTo(px + ox, py + oy);
        x.quadraticCurveTo(px + ox + Math.cos(an) * ln * 0.5 + (r() - 0.5) * 0, py + oy + Math.sin(an) * ln * 0.5 + 2, px + ox + Math.cos(an) * ln, py + oy + Math.sin(an) * ln);
        x.stroke();
      }
    }
    return ctx.createPattern(g, 'repeat');
  })();

  /* ------------------------------------------------------------------ the camera: a slow sideways drift and a slight push in.
     depth 1 is the plane the hero stands on; smaller is further away, larger is nearer. */
  let camX = 0, camY = 0, push = 0;
  function layer(d) {
    const s = 1 + push * d;
    ctx.setTransform(s, 0, 0, s, 960 * (1 - s) - camX * (d - 1), 600 * (1 - s) - camY * (d - 1));
  }

  /* one sheet of paper. sh = {x, y, b, a} drop shadow (device px); o.grain, o.edge */
  function paper(path, color, sh, o) {
    o = o || {};
    ctx.save();
    if (sh) { ctx.shadowColor = 'rgba(2,1,10,' + sh.a + ')'; ctx.shadowBlur = sh.b; ctx.shadowOffsetX = sh.x; ctx.shadowOffsetY = sh.y; }
    ctx.fillStyle = color;
    ctx.fill(path, o.rule || 'nonzero');
    ctx.restore();
    ctx.save();
    ctx.clip(path, o.rule || 'nonzero');
    if (o.grad) { ctx.fillStyle = o.grad; ctx.fillRect(-4000, -4000, 8000, 8000); }
    ctx.globalAlpha = o.grain == null ? 0.2 : o.grain;
    ctx.fillStyle = grain;
    ctx.fillRect(-4000, -4000, 8000, 8000);
    const e = o.edge == null ? 1 : o.edge;
    if (e > 0) {
      const m = ctx.getTransform(), ew = (o.ew || 2.2) / Math.max(0.2, Math.hypot(m.a, m.b));
      ctx.lineWidth = ew;
      ctx.globalAlpha = 1;
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e + 1.6, m.f + 2.2);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.26 * e) + ')';
      ctx.stroke(path);
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e - 1.6, m.f - 2.2);
      ctx.strokeStyle = 'rgba(0,0,0,' + (0.22 * e) + ')';
      ctx.stroke(path);
    }
    ctx.restore();
  }
  /* only the shadow of a shape (the shape itself is drawn far off-canvas) */
  function shadowOnly(path, sh) {
    ctx.save();
    const m = ctx.getTransform();
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e - 6000, m.f);
    ctx.shadowColor = 'rgba(2,1,10,' + sh.a + ')'; ctx.shadowBlur = sh.b; ctx.shadowOffsetX = sh.x + 6000; ctx.shadowOffsetY = sh.y;
    ctx.fillStyle = '#000';
    ctx.fill(path);
    ctx.restore();
  }
  function rr(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }

  /* ------------------------------------------------------------------ static sheets */
  function hill(base, waves, x0, x1) {
    const p = new Path2D();
    p.moveTo(x0, 1500);
    for (let x = x0; x <= x1; x += 10) {
      let y = base;
      for (const w of waves) y += w[0] * Math.sin(x * w[1] + w[2]);
      p.lineTo(x, y);
    }
    p.lineTo(x1, 1500); p.closePath();
    return p;
  }
  const GW = [[13, 0.0021, 2.2], [4, 0.0061, 0.4]];
  const groundY = (x) => { let y = 846; for (const w of GW) y += w[0] * Math.sin(x * w[1] + w[2]); return y; };
  const P_HILLC = hill(676, [[46, 0.0024, 0.6], [14, 0.0071, 2.0]], -500, 2420);
  const P_HILLB = hill(760, [[30, 0.0031, 3.6], [9, 0.0083, 1.0]], -500, 2420);
  const P_GROUND = hill(846, GW, -500, 2420);
  const P_MOON = (function () { const p = new Path2D(); p.arc(1075, 462, 335, 0, PI * 2); return p; })();
  const P_FRAME = (function () {                           // the nearest sheet: a dark mat with a big rounded window cut in it
    const p = new Path2D();
    p.rect(-600, -600, 3120, 2280);
    p.roundRect(-40, -70, 2000, 1096, 250);
    return p;
  })();
  const STARS = (function () { const r = prng(5), a = []; for (let i = 0; i < 26; i++) a.push([r() * 2100 - 90, r() * 560 - 20, 1.6 + r() * 2.2, r()]); return a; })();
  const HANG = [                                           // little shapes on threads, each on its own depth
    { x: 318, len: 318, d: 0.62, k: 0, ph: 0.3, s: 1 },
    { x: 498, len: 196, d: 0.5, k: 1, ph: 1.9, s: 0.8 },
    { x: 1668, len: 262, d: 0.58, k: 2, ph: 4.0, s: 0.95 },
    { x: 1512, len: 128, d: 0.46, k: 0, ph: 2.7, s: 0.62 },
  ];
  const P_HANG = [
    (function () { const p = new Path2D(); p.arc(0, 0, 21, 0, PI * 2); return p; })(),
    (function () { const p = new Path2D(); p.moveTo(0, -26); p.lineTo(19, 0); p.lineTo(0, 26); p.lineTo(-19, 0); p.closePath(); return p; })(),
    (function () {                                         // crescent
      const p = new Path2D(); p.arc(0, 0, 25, -PI * 0.42, PI * 1.08, false);
      p.arc(9, -9, 19, PI * 0.96, -PI * 0.30, true); p.closePath(); return p;
    })(),
  ];

  /* ------------------------------------------------------------------ the hero: a jointed paper puppet of the coral block */
  const HX = 742, FX = 1075;
  const HY = groundY(HX) + 26, FY = groundY(FX) + 20;
  const LOOK = [                                           // [t, eye x, eye y]
    [0, 5, 1], [1.12, 5, 1], [1.3, 9, 3], [1.5, 9, 3], [1.6, -9, 0], [1.74, -9, 0], [1.86, 6, 0], [1.96, 4, -2], [2.2, 4, -2], [2.42, 8, -8], [3.1, 6, -9],
  ];
  function key(K, t, j) {
    for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1][0]) return lerp(K[i][j], K[i + 1][j], sm(K[i][0], K[i + 1][0], t));
    return K[K.length - 1][j];
  }
  function heroAt(t) {
    const h = { x: HX, lift: 0, tilt: 0, sq: 0, air: 0, armR: 0.5, armL: 0.5, mouth: 0, blink: 0 };
    const t0 = 0.0, t1 = 1.25, NH = 4;
    if (t < t1) {
      const p = clamp((t - t0) / (t1 - t0), 0, 1), hp = (p * NH) % 1;
      h.x = lerp(-150, HX, p);
      const arc = 4 * hp * (1 - hp);
      h.lift = 74 * arc; h.air = arc;
      h.tilt = 0.075 * Math.cos(hp * PI) + 0.02;
      h.sq = 0.06 * arc - 0.09 * Math.max(0, 1 - arc * 3.2);
      h.armR = h.armL = 0.5 - 0.75 * arc;
    } else if (t < 1.84) {
      const a = t - t1;
      h.sq = -0.09 * Math.exp(-a * 11) * Math.cos(a * 26);
      h.armR = h.armL = 0.5 + 0.25 * Math.exp(-a * 9) * Math.cos(a * 22);
    }
    // the signal: a squat, a hop, the arm nearest the folder flung up, mouth open
    const sq0 = sm(1.8, 1.9, t) * (1 - sm(1.9, 1.95, t));
    h.sq -= 0.1 * sq0;
    if (t >= 1.9 && t < 2.3) {
      const hp = (t - 1.9) / 0.4, arc = 4 * hp * (1 - hp);
      h.lift = 66 * arc; h.air = arc; h.sq += 0.07 * arc; h.tilt -= 0.05 * arc;
    } else if (t >= 2.3) {
      const a = t - 2.3;
      h.sq += -0.1 * Math.exp(-a * 10) * Math.cos(a * 24);
      h.tilt -= 0.035 * sm(2.3, 2.6, t);                   // leans back to watch the fountain
      const b = Math.abs(Math.sin((a - 0.12) * 7.5)) * sm(2.42, 2.55, t);
      h.lift = 9 * b; h.air = 0.25 * b;
    }
    const up = backOut((t - 1.88) / 0.2);
    if (t > 1.88) {
      h.armR = lerp(0.5, -0.92, up) + 0.4 * sm(2.5, 2.8, t) + 0.1 * Math.sin(t * 9) * sm(2.5, 2.7, t);
      h.armL = lerp(0.5, -0.15, up) + 0.3 * sm(2.5, 2.8, t);
    }
    h.mouth = sm(1.92, 1.99, t) * (1 - sm(2.4, 2.56, t));
    h.ex = key(LOOK, t, 1); h.ey = key(LOOK, t, 2);
    h.tilt += h.ex * 0.0035 * sm(1.2, 1.3, t);
    const bl = (c, w) => Math.max(0, 1 - Math.abs(t - c) / w);
    h.blink = Math.min(1, Math.max(bl(1.42, 0.075), bl(1.82, 0.08), bl(2.72, 0.07)) * 1.6);
    return h;
  }

  const BW = 232, BH = 152, LEG = 46;                      // body size, visible leg length
  const P_BODY = rr(-BW / 2, -LEG - BH, BW, BH, 30);
  const P_BAND = (function () {                            // the darker base strip, with a pinked (zigzag) top edge
    const p = new Path2D(), y = -LEG - 30, n = 16, w = BW / n;
    p.moveTo(-BW / 2 - 4, y + 4);
    for (let i = 0; i < n; i++) { p.lineTo(-BW / 2 + (i + 0.5) * w, y - 4); p.lineTo(-BW / 2 + (i + 1) * w, y + 4); }
    p.lineTo(BW / 2 + 4, y + 4); p.lineTo(BW / 2 + 4, -LEG + 6); p.lineTo(-BW / 2 - 4, -LEG + 6); p.closePath();
    return p;
  })();
  const P_TOP = rr(-BW / 2 - 4, -LEG - BH - 6, BW + 8, 22, 4);
  const P_LEG = rr(-19, -16, 38, LEG + 16, [6, 6, 11, 11]);
  const P_ARM = rr(-15, -21, 74, 42, 20);
  const P_BRAD = (function () { const p = new Path2D(); p.arc(0, 0, 5.2, 0, PI * 2); return p; })();
  const LEGX = [-86, -34, 34, 86];
  const S_IN = { x: 2.5, y: 3.5, b: 5, a: 0.38 };          // shadow between sheets glued close together

  function heroPaths(h, fn) {                              // parts behind the body, in drawing order
    for (const k of [1, 2, 0, 3]) {
      const inner = k === 1 || k === 2;
      const sw = h.air * (k % 2 ? 0.36 : -0.3) * (inner ? 0.7 : 1) + (k < 2 ? 0.02 : -0.02);
      fn(P_LEG, inner ? C.shade : C.coral, LEGX[k], -LEG - 4, sw, 1);
    }
  }
  function armPaths(h, fn) {                               // the arms are pinned on the front of the body
    fn(P_ARM, C.shade, -BW / 2 + 10, -LEG - 74, h.armL, -1);
    fn(P_ARM, C.light, BW / 2 - 10, -LEG - 74, h.armR, 1);
  }
  function drawHero(t) {
    const h = heroAt(t);
    const gy = h.x === HX ? HY : groundY(h.x) + 26;
    // contact shadow on the ground sheet
    ctx.save();
    ctx.translate(h.x + 6, gy + 4); ctx.scale(1, 0.13);
    const cs = 150 * (1 - 0.35 * clamp(h.lift / 74, 0, 1));
    const g = ctx.createRadialGradient(0, 0, cs * 0.2, 0, 0, cs);
    g.addColorStop(0, 'rgba(1,0,8,' + (0.6 - 0.3 * clamp(h.lift / 74, 0, 1)) + ')'); g.addColorStop(1, 'rgba(1,0,8,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, cs, 0, PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(h.x, gy - h.lift);
    ctx.rotate(h.tilt);
    ctx.scale(1 - h.sq * 0.55, 1 + h.sq);
    // the whole puppet's shadow on the scenery behind, cast as one
    const big = { x: 13, y: 18, b: 22, a: 0.5 };
    heroPaths(h, (p, c, x, y, r, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(f, 1); ctx.rotate(r); shadowOnly(p, big); ctx.restore(); });
    armPaths(h, (p, c, x, y, r, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(f, 1); ctx.rotate(r); shadowOnly(p, big); ctx.restore(); });
    shadowOnly(P_BODY, big);
    // limbs behind the body
    heroPaths(h, (p, c, x, y, r, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(f, 1); ctx.rotate(r); paper(p, c, S_IN, { grain: 0.24 }); ctx.restore(); });
    // body, with a glued lighter top strip and a darker base strip
    const bg = ctx.createLinearGradient(0, -LEG - BH, 0, -LEG);
    bg.addColorStop(0, 'rgba(255,214,180,0.10)'); bg.addColorStop(1, 'rgba(110,42,26,0.10)');
    paper(P_BODY, C.coral, { x: 4, y: 5.5, b: 7, a: 0.42 }, { grain: 0.26, grad: bg });
    ctx.save(); ctx.clip(P_BODY);
    paper(P_BAND, C.shade, { x: 1.5, y: 2, b: 3, a: 0.3 }, { grain: 0.24, edge: 0.7 });
    paper(P_TOP, C.light, { x: 1.5, y: 2.5, b: 3.5, a: 0.3 }, { grain: 0.22, edge: 0.7 });
    ctx.restore();
    armPaths(h, (p, c, x, y, r, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(f, 1); ctx.rotate(r); paper(p, c, { x: 3, y: 4.5, b: 6, a: 0.42 }, { grain: 0.24 }); ctx.restore(); });
    // brads at the joints
    const brad = (x, y) => {
      ctx.save(); ctx.translate(x, y); paper(P_BRAD, C.dark, { x: 1, y: 1.5, b: 2, a: 0.45 }, { grain: 0, edge: 0 });
      ctx.fillStyle = 'rgba(255,210,180,0.75)'; ctx.beginPath(); ctx.arc(-1.4, -1.6, 1.5, 0, PI * 2); ctx.fill(); ctx.restore();
    };
    brad(-BW / 2 + 10, -LEG - 74); brad(BW / 2 - 10, -LEG - 74);
    for (const x of [LEGX[0], LEGX[3]]) brad(x, -LEG - 11);
    // face
    const ex = h.ex, ey = h.ey, EW = 23, EH = 31;
    for (const s of [-1, 1]) {
      const cx = s * 50 + ex, cy = -LEG - 96 + ey;
      const eh = Math.max(4, EH * (1 - h.blink));
      const p = rr(cx - EW / 2, cy - eh / 2 + (EH - eh) * 0.25, EW, eh, Math.min(7, eh / 2));
      paper(p, C.ink, { x: 1.5, y: 2, b: 2.5, a: 0.4 }, { grain: 0.1, edge: 0.5, ew: 1.5 });
      if (h.blink < 0.45) {
        ctx.fillStyle = '#fff6ea';
        ctx.beginPath(); ctx.roundRect(cx - EW / 2 + 3.5, cy - EH / 2 + 4, 8, 8, 2.2); ctx.fill();
      }
    }
    if (h.mouth > 0.02) {                                  // the mouth is a hole cut through the body
      const mw = 62 * (0.55 + 0.45 * h.mouth), mh = 38 * h.mouth;
      const p = rr(-mw / 2 + ex * 0.4, -LEG - 66 - mh * 0.35, mw, mh, Math.min(12, mh / 2));
      ctx.fillStyle = '#1d0806'; ctx.fill(p);
      ctx.save(); ctx.clip(p);
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 7; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 5;
      ctx.lineWidth = 6; ctx.strokeStyle = C.shade; ctx.stroke(p);
      ctx.restore();
    }
    ctx.restore();
    return h;
  }
  /* the call: three small cream paper ticks by the raised arm */
  function drawCall(t, h) {
    const p = (t - 1.96) / 0.42;
    if (p <= 0 || p >= 1) return;
    const k = backOut(p * 2.2) * (1 - sm(0.62, 1, p));
    if (k <= 0.01) return;
    ctx.save();
    ctx.translate(h.x + BW / 2 + 52, HY - h.lift - LEG - 160);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(-1.25 + i * 0.52);
      ctx.translate(24 + 16 * p, 0);
      ctx.scale(k, k);
      paper(rr(0, -4.5, 30 - (i === 1 ? 0 : 7), 9, 4.5), C.cream, { x: 4, y: 6, b: 6, a: 0.45 }, { grain: 0.12, edge: 0.5, ew: 1.4 });
      ctx.restore();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ the folder: folded paper that pops up, then hinges open */
  const FW = 168, FBH = 206, FTAB = 34, FFH = 176;
  const P_FBACK = (function () {
    const p = new Path2D(), r = 15, y = -FBH;
    p.moveTo(-FW, 0); p.lineTo(-FW, y - FTAB + r); p.quadraticCurveTo(-FW, y - FTAB, -FW + r, y - FTAB);
    p.lineTo(-52, y - FTAB); p.quadraticCurveTo(-38, y - FTAB, -30, y - FTAB + 11); p.lineTo(-18, y - 9);
    p.quadraticCurveTo(-11, y, 2, y); p.lineTo(FW - r, y); p.quadraticCurveTo(FW, y, FW, y + r); p.lineTo(FW, 0); p.closePath();
    return p;
  })();
  function flapPath(o) {
    const th = o * 0.96, ht = FFH * Math.cos(th), w = FW * (1 + 0.1 * Math.sin(th)), r = 15, p = new Path2D();
    const rb = 9;
    p.moveTo(-FW + rb, 0); p.quadraticCurveTo(-FW, 0, lerp(-FW, -w, rb / ht), -rb);
    p.lineTo(lerp(-FW, -w, 1 - r / ht), -ht + r); p.quadraticCurveTo(-w, -ht, -w + r, -ht);
    p.lineTo(w - r, -ht); p.quadraticCurveTo(w, -ht, lerp(FW, w, 1 - r / ht), -ht + r);
    p.lineTo(lerp(FW, w, rb / ht), -rb); p.quadraticCurveTo(FW, 0, FW - rb, 0); p.closePath();
    return { p, ht, w };
  }
  const openAt = (t) => { const p = clamp((t - 2.04) / 0.5, 0, 1); return p <= 0 ? 0 : clamp(1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2), 0, 1.08); };
  const popAt = (t) => backOut((t + 0.07) / 0.52);
  function beamPath(w, h) {                                // a rounded fan of vellum rising from the folder's mouth
    const p = new Path2D(), y0 = -70;
    p.moveTo(-118, y0);
    p.bezierCurveTo(-150, y0 - h * 0.35, -w, y0 - h * 0.62, -w * 0.78, y0 - h * 0.86);
    p.bezierCurveTo(-w * 0.5, y0 - h * 1.06, w * 0.5, y0 - h * 1.06, w * 0.78, y0 - h * 0.86);
    p.bezierCurveTo(w, y0 - h * 0.62, 150, y0 - h * 0.35, 118, y0);
    p.closePath();
    return p;
  }
  function drawFolderBack(t) {
    const k = popAt(t), o = openAt(t);
    ctx.save();
    ctx.translate(FX, FY); ctx.scale(1, k);
    const lift = 0.35 + 0.65 * clamp(k, 0, 1);
    paper(P_FBACK, C.lilacDeep, { x: 10 * lift, y: 14 * lift, b: 20, a: 0.5 }, { grain: 0.22 });
    if (o > 0) {                                           // warm light on the inside face
      ctx.save(); ctx.clip(P_FBACK);
      const g = ctx.createRadialGradient(0, -96, 10, 0, -96, 290);
      const a = Math.min(1, o);
      g.addColorStop(0, 'rgba(255,226,186,' + 0.98 * a + ')'); g.addColorStop(0.28, 'rgba(255,186,128,' + 0.86 * a + ')');
      g.addColorStop(0.62, 'rgba(226,120,92,' + 0.5 * a + ')'); g.addColorStop(1, 'rgba(160,90,160,0)');
      ctx.fillStyle = g; ctx.fillRect(-300, -400, 600, 500);
      ctx.restore();
    }
    ctx.restore();
  }
  function drawBeams(t) {
    const o = openAt(t);
    if (o <= 0) return;
    ctx.save();
    ctx.translate(FX, FY);
    const B = [[120, 250, 0.0, 0.06]];
    for (const b of B) {
      const g = sm(2.08 + b[2], 2.62 + b[2], t);
      if (g <= 0) continue;
      const p = beamPath(b[0] * (0.5 + 0.5 * g), b[1] * g);
      ctx.save();
      ctx.shadowColor = 'rgba(2,1,10,0.22)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 7;
      ctx.fillStyle = 'rgba(255,170,120,' + b[3] * Math.min(1, g * 2) + ')';
      ctx.fill(p);
      ctx.restore();
      ctx.save(); ctx.clip(p); ctx.globalAlpha = 0.07; ctx.fillStyle = grain; ctx.fillRect(-900, -900, 1800, 1800); ctx.restore();
    }
    ctx.restore();
  }
  function drawFolderFront(t) {
    const k = popAt(t), o = openAt(t), oc = clamp(o, 0, 1);
    ctx.save();
    ctx.translate(FX, FY); ctx.scale(1, k);
    const f = flapPath(o);
    const g = ctx.createLinearGradient(0, -f.ht, 0, 0);
    g.addColorStop(0, 'rgba(255,190,140,' + 0.34 * oc + ')'); g.addColorStop(0.3, 'rgba(255,170,130,0)'); g.addColorStop(1, 'rgba(10,4,40,' + 0.12 * oc + ')');
    paper(f.p, mix(C.lilac, '#6c5ecb', oc * 0.9), { x: 4 + 5 * oc, y: 5 + 13 * oc, b: 7 + 14 * oc, a: 0.46 }, { grain: 0.22, grad: g });
    // the fold: a scored crease near the hinge
    ctx.save(); ctx.clip(f.p);
    ctx.strokeStyle = 'rgba(20,10,60,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-FW, -13); ctx.lineTo(FW, -13); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-FW, -11); ctx.lineTo(FW, -11); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  function label(txt, x, y, w, hgt, rot, k, parts) {
    if (k <= 0.01) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, k);
    paper(rr(-w / 2, -hgt / 2, w, hgt, 9), C.tag, { x: 4, y: 6, b: 8, a: 0.5 }, { grain: 0.2, edge: 0.8 });
    ctx.font = '700 25px monospace';
    try { ctx.letterSpacing = '3px'; } catch (e) { /* older engines */ }
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let tw = 0; for (const p of parts) tw += ctx.measureText(p[0]).width;
    let px = -tw / 2 + 1.5;
    for (const p of parts) { ctx.fillStyle = p[1]; ctx.fillText(p[0], px, 1.5); px += ctx.measureText(p[0]).width; }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ the agents: paper confetti */
  const NA = 250, T_OPEN = 2.1;
  const AG = (function () {
    const r = prng(1000), a = [];
    const gauss = () => (r() + r() + r() + r() - 2) * 0.87;
    const cols = [C.coral, C.coral, C.coral, C.light, C.light, C.shade, C.cream];
    for (let i = 0; i < NA + 30; i++) {
      const ang = gauss() * 0.3, sp = 1080 + r() * 720;
      const bin = r();
      a.push({
        born: T_OPEN + 0.9 * Math.pow((i + 0.5) / NA, 1 / 1.35),
        x0: gauss() * 44, vx: Math.sin(ang) * sp * 0.92, vy: -Math.cos(ang) * sp,
        d: bin < 0.34 ? 0.84 : bin < 0.76 ? 1 : 1.26,
        size: 9 + r() * 8, kind: Math.floor(r() * 5), col: cols[Math.floor(r() * cols.length)],
        rot: r() * 6.28, w: (r() - 0.5) * 9, fl: r() * 6.28, wf: 5 + r() * 9, ph: r() * 6.28, drag: 0.8 + r() * 0.5,
      });
    }
    return a;
  })();
  const countAt = (t) => t <= T_OPEN ? 0 : Math.min(NA, Math.floor(NA * Math.pow((t - T_OPEN) / 0.9, 1.35)));
  const P_CONF = [
    rr(-0.62, -0.42, 1.24, 0.84, 0.2), rr(-0.62, -0.42, 1.24, 0.84, 0.2), rr(-0.45, -0.45, 0.9, 0.9, 0.12),
    (function () { const p = new Path2D(); p.moveTo(0, -0.6); p.lineTo(0.58, 0.42); p.lineTo(-0.58, 0.42); p.closePath(); return p; })(),
    (function () { const p = new Path2D(); p.arc(0, 0, 0.46, 0, PI * 2); return p; })(),
  ];
  function drawAgents(t, pass) {                            // pass 0: behind the front flap, 1: in front of everything
    const G = 1500;
    for (let i = 0; i < AG.length; i++) {
      const p = AG[i], a = t - p.born;
      if (a <= 0) continue;
      const near = p.d > 1.1 && a > 0.13;
      if ((pass === 1) !== near) continue;
      const k = p.drag, e = (1 - Math.exp(-k * a)) / k;
      const x = FX + p.x0 + p.vx * e + Math.sin(a * 6 + p.ph) * 10 * a;
      const y = FY - 84 + (G / k) * a + (p.vy - G / k) * e;
      const d = 1 + (p.d - 1) * sm(0.02, 0.45, a);
      layer(d);
      const s = p.size * (0.72 + 0.28 * d) * (0.35 + 0.65 * sm(0, 0.1, a));
      const flip = Math.cos(p.fl + p.wf * a);
      ctx.translate(x, y); ctx.rotate(p.rot + p.w * a); ctx.scale(s, s * (0.25 + 0.75 * Math.abs(flip)));
      const far = sm(0, 0.5, a);
      ctx.shadowColor = 'rgba(2,1,10,' + (0.5 - 0.12 * far) + ')';
      ctx.shadowBlur = 3 + 5 * far * d; ctx.shadowOffsetX = (3 + 5 * far) * d; ctx.shadowOffsetY = (4 + 8 * far) * d;
      ctx.fillStyle = flip < 0 ? (p.col === C.shade ? C.dark : p.col === C.cream ? C.light : p.col === C.light ? C.coral : C.shade) : p.col;
      ctx.fill(P_CONF[p.kind]);
      ctx.shadowColor = 'transparent';
      if (flip >= 0) { ctx.fillStyle = 'rgba(255,240,220,0.22)'; ctx.save(); ctx.clip(P_CONF[p.kind]); ctx.fillRect(-1, -1, 2, 0.72); ctx.restore(); }
    }
    ctx.shadowColor = 'transparent';
  }

  /* ------------------------------------------------------------------ one frame */
  function render(t) {
    t = clamp(t, 0, DUR);
    const u = t / DUR;
    camX = lerp(-46, 46, u); camY = lerp(7, -9, u) - 10 * sm(2.1, 3, t); push = 0.012 + 0.03 * u;
    const o = clamp(openAt(t), 0, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.sky; ctx.fillRect(0, 0, W, H);

    // the back sheet: night-coloured paper with a few pin holes
    layer(0.12);
    ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = grain; ctx.fillRect(-300, -300, 2600, 1700); ctx.restore();
    for (const s of STARS) {
      ctx.fillStyle = 'rgba(176,160,255,' + (0.25 + 0.4 * s[3]) + ')';
      ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, PI * 2); ctx.fill();
    }
    layer(0.26);
    paper(P_MOON, C.moon, { x: 12, y: 16, b: 30, a: 0.5 }, { grain: 0.2, edge: 0.7 });
    layer(0.44);
    paper(P_HILLC, C.hillC, { x: 6, y: -8, b: 44, a: 0.85 }, { grain: 0.2, edge: 0.5 });
    // hanging shapes on threads
    for (const g of HANG) {
      layer(g.d);
      const an = Math.sin(t * 1.9 + g.ph) * 0.06 + Math.sin(t * 3.1 + g.ph * 2) * 0.015;
      ctx.save(); ctx.translate(g.x, -60); ctx.rotate(an);
      ctx.strokeStyle = 'rgba(150,135,235,0.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, g.len + 60 - 16 * g.s); ctx.stroke();
      ctx.translate(0, g.len + 60); ctx.scale(g.s, g.s); ctx.rotate(Math.sin(t * 2.3 + g.ph) * 0.12);
      paper(P_HANG[g.k], C.lilacDim, { x: 9, y: 13, b: 14, a: 0.5 }, { grain: 0.22 });
      ctx.restore();
    }
    layer(0.7);
    paper(P_HILLB, C.hillB, { x: 6, y: -8, b: 40, a: 0.85 }, { grain: 0.2, edge: 0.55 });
    layer(1);
    paper(P_GROUND, C.ground, { x: 6, y: -8, b: 38, a: 0.9 }, { grain: 0.2, edge: 0.6 });

    // the folder, the light, the agents, the hero: all on or near the main plane
    drawFolderBack(t);
    layer(0.97); drawBeams(t);
    drawAgents(t, 0);
    layer(1);
    drawFolderFront(t);
    const lk = backOut((t - 0.3) / 0.3) * (1 - sm(2.08, 2.22, t));
    label('0 items', FX, FY + 62, 176, 46, -0.03, lk, [['0', C.light], [' items', C.tagInk]]);
    const h = drawHero(t);
    drawCall(t, h);
    drawAgents(t, 1);

    // warm light spilling over the whole set
    if (o > 0) {
      layer(1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const fl = 1 + 0.03 * Math.sin(t * 23);
      const g = ctx.createRadialGradient(FX, FY - 110, 20, FX, FY - 110, 820);
      g.addColorStop(0, 'rgba(255,160,100,' + 0.2 * o * fl + ')'); g.addColorStop(0.35, 'rgba(230,110,80,' + 0.075 * o + ')'); g.addColorStop(1, 'rgba(120,40,80,0)');
      ctx.fillStyle = g; ctx.fillRect(-200, -200, 2400, 1500);
      ctx.restore();
    }
    // the counter: a small paper label
    const n = countAt(t);
    layer(1.3);
    label('', 262, 150, 262, 50, -0.02, backOut((t - 2.1) / 0.3), [['AGENTS ', C.tagInk], [String(n).padStart(4, '0'), C.light]]);
    // the nearest sheet: a dark mat framing the set
    layer(1.75);
    paper(P_FRAME, C.front, { x: 14, y: 20, b: 40, a: 0.75 }, { grain: 0.18, rule: 'evenodd', edge: 0.25 });

    // vignette
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const v = ctx.createRadialGradient(960, 560, 420, 960, 560, 1180);
    v.addColorStop(0, 'rgba(3,1,12,0)'); v.addColorStop(1, 'rgba(3,1,12,0.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------------------------ run */
  const q = new URLSearchParams(location.search);
  if (q.has('export')) {
    document.body.classList.add('export');
    render(0);
    window.__piece = { renderAt: (t) => { render(t); return true; }, duration: DUR, isReady: () => true };
  } else if (q.has('t')) {
    render(parseFloat(q.get('t')) || 0);
  } else {
    let start = null;
    const tick = (ms) => { if (start === null) start = ms; render(((ms - start) / 1000) % DUR); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
})();
