/* The Bridge — 01 · "The Bridge of Khazad-dûm"
 * An ink drawing made at runtime. A tone map and a flow map are painted first (how dark each
 * place should be, and which way the pen should travel there); then tens of thousands of pen
 * strokes are traced along the flow as evenly spaced streamlines whose width follows the tone,
 * in up to four crossing layers. Contours, stones, runes and figures are drawn as explicit pen
 * lines; then watercolour washes (gamboge, vermilion, madder), scratched-out lights and white
 * gouache. All randomness is seeded.
 */
(function () {
  'use strict';

  /* ================================================================ utilities */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;

  function makeNoise(rand) {
    const P = new Uint16Array(512), G = new Float32Array(256);
    for (let i = 0; i < 256; i++) { P[i] = i; G[i] = rand(); }
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = P[i]; P[i] = P[j]; P[j] = t; }
    for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    function v2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const X = xi & 255, Y = yi & 255;
      const a = G[P[X + P[Y]]], b = G[P[X + 1 + P[Y]]], c = G[P[X + P[Y + 1]]], d = G[P[X + 1 + P[Y + 1]]];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, o) {
      let s = 0, a = 0.5, f = 1, n = 0;
      for (let i = 0; i < (o || 4); i++) { s += a * v2(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; }
      return s / n;
    }
    return { v2, fbm };
  }

  /* Catmull-Rom resampling of a control polyline into a dense one. */
  function spline(pts, closed, per) {
    per = per || 8;
    const out = [], n = pts.length;
    const P = (i) => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let j = 0; j < per; j++) {
        const t = j / per, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }
  function polyPath(pts, open) {
    const p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    if (!open) p.closePath();
    return p;
  }
  function pointInPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }
  function plen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function sub(pts, a, b) { // portion of a polyline between fractions a..b of its length
    const L = plen(pts), out = [];
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const f = acc / L;
      if (f >= a && f <= b) out.push(pts[i]);
    }
    return out.length > 1 ? out : pts.slice(0, 2);
  }
  function offsetLine(pts, d) {
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const dd = typeof d === 'function' ? d(i / (pts.length - 1)) : d;
      return [p[0] - dy / l * dd, p[1] + dx / l * dd];
    });
  }

  /* ================================================================ the piece */
  (window.PIECES = window.PIECES || []).push({
    id: 'bridge',
    title: 'The Bridge of Khazad-dûm',
    medium: 'Pen and iron-gall ink, watercolour and white gouache on paper',
    note: 'Press and hold anywhere to look closer',
    about: 'An original interpretation of Tolkien’s scene on Durin’s Bridge, drawn from the book rather than any film: the grey wizard alone on a span without kerb or rail, the shadow and flame of the Balrog before him, and through the broken mountain the snows and a far, lidless eye. It is made the slow way, line by line: every tone is cross-hatching, every light is bare paper, a scratch or a touch of white gouache, and colour is kept for fire.',
    tone: 'dark',
    room: '#0d0b0a',
    mount,
  });

  function mount(el, api) {
    let alive = true, job = 0, lastKey = '', resizeTimer = 0;
    const qs = new URLSearchParams(location.search);
    const resOverride = +qs.get('bres') || 0;

    el.style.cssText += ';background:#0d0b0a;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;cursor:zoom-in';
    const wall = document.createElement('div');
    wall.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#211c18 0%,#13110f 52%,#090807 100%)';
    el.appendChild(wall);
    const frame = document.createElement('div');
    frame.style.cssText = 'position:absolute;opacity:0;transition:opacity .9s ease;box-shadow:0 1px 2px rgba(0,0,0,.55),0 16px 44px rgba(0,0,0,.6),0 0 140px rgba(0,0,0,.35)';
    el.appendChild(frame);
    const view = document.createElement('canvas');
    view.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    frame.appendChild(view);
    const lens = document.createElement('canvas');
    lens.style.cssText = 'position:absolute;pointer-events:none;border-radius:50%;display:none;box-shadow:0 0 0 1px rgba(40,32,24,.7),0 0 0 5px rgba(12,10,8,.55),0 14px 44px rgba(0,0,0,.65);z-index:3';
    el.appendChild(lens);

    let sheet = null;
    let fitScale = 1;

    function layoutFrame() {
      if (!sheet) return;
      const W = el.clientWidth, H = el.clientHeight;
      const portrait = sheet.portrait;
      const padX = portrait ? Math.max(10, W * 0.03) : Math.max(24, W * 0.035);
      const padY = portrait ? Math.max(30, H * 0.05) : Math.max(22, H * 0.045);
      const s = Math.min((W - 2 * padX) / sheet.CW, (H - 2 * padY) / sheet.CH);
      fitScale = s;
      const w = sheet.CW * s, h = sheet.CH * s;
      frame.style.left = ((W - w) / 2) + 'px';
      frame.style.top = ((H - h) / 2 - (portrait ? H * 0.02 : 0)) + 'px';
      frame.style.width = w + 'px';
      frame.style.height = h + 'px';
    }

    function wantKey() {
      const W = el.clientWidth || 1, H = el.clientHeight || 1;
      const portrait = H > W * 1.12;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let long = resOverride || (portrait ? 3000 : 3600);
      if (!resOverride && !portrait && Math.max(W, H) * dpr > 2700) long = 4200;
      return { portrait, long, key: (portrait ? 'P' : 'L') + long, preview: qs.get('bprev') || '' };
    }

    async function start() {
      const want = wantKey();
      if (want.key === lastKey) { layoutFrame(); return; }
      lastKey = want.key;
      const my = ++job;
      const t0 = performance.now();
      const res = await render(want, api.seed >>> 0, () => alive && my === job, qs.has('btime'));
      if (!res || !alive || my !== job) return;
      sheet = res;
      view.width = res.CW; view.height = res.CH;
      view.getContext('2d').drawImage(res.canvas, 0, 0);
      layoutFrame();
      frame.style.opacity = '1';
      if (qs.has('btime')) console.warn('bridge total ms', Math.round(performance.now() - t0));
      api.ready();
    }

    const ro = new ResizeObserver(() => {
      layoutFrame();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (alive) start(); }, 400);
    });
    ro.observe(el);
    start();

    /* ---------------- press-and-hold magnifier */
    let holding = false, holdTimer = 0, lastPt = null;
    function drawLens(cx, cy, isTouch) {
      if (!sheet) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const D = Math.round(Math.min(380, Math.max(190, Math.min(el.clientWidth, el.clientHeight) * 0.44)));
      if (lens.width !== D * dpr) { lens.width = D * dpr; lens.height = D * dpr; }
      lens.style.width = D + 'px'; lens.style.height = D + 'px';
      const ly = isTouch ? cy - D * 0.72 : cy;
      lens.style.left = (cx - D / 2) + 'px';
      lens.style.top = (ly - D / 2) + 'px';
      const fr = frame.getBoundingClientRect(), er = el.getBoundingClientRect();
      const sx = (cx + er.left - fr.left) / fitScale, sy = (cy + er.top - fr.top) / fitScale;
      // one sheet pixel per device pixel, and never less than 2.5x
      const mag = Math.max(2.5, 1 / (fitScale * dpr));
      const srcW = D / (fitScale * mag);
      const g = lens.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#0d0b0a'; g.fillRect(0, 0, lens.width, lens.height);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(sheet.canvas, sx - srcW / 2, sy - srcW / 2, srcW, srcW, 0, 0, lens.width, lens.height);
      lens.style.display = 'block';
    }
    const local = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.pointerType === 'touch' }; };
    function onDown(e) {
      if (!sheet || e.button > 0) return;
      lastPt = local(e);
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { holding = true; if (lastPt) drawLens(lastPt.x, lastPt.y, lastPt.t); }, e.pointerType === 'touch' ? 150 : 60);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    function onMove(e) {
      if (!lastPt) return;
      lastPt = local(e);
      if (holding) drawLens(lastPt.x, lastPt.y, lastPt.t);
    }
    function onUp() { clearTimeout(holdTimer); holding = false; lastPt = null; lens.style.display = 'none'; }
    const noMenu = (e) => e.preventDefault();
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('contextmenu', noMenu);

    return {
      destroy() {
        alive = false; job++;
        ro.disconnect();
        clearTimeout(resizeTimer); clearTimeout(holdTimer);
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        el.removeEventListener('contextmenu', noMenu);
        sheet = null;
      },
    };
  }

  /* ================================================================ renderer */
  const yieldNow = () => new Promise((r) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => r();
    ch.port2.postMessage(0);
  });

  async function render(want, seed, ok, debug) {
    let tSlice = performance.now();
    async function tick() {
      if (performance.now() - tSlice > 26) { await yieldNow(); tSlice = performance.now(); }
      if (!ok()) throw new Error('cancelled');
    }
    try {
      return await renderInner(want, seed, tick, debug);
    } catch (e) {
      if (e && e.message === 'cancelled') return null;
      throw e;
    }
  }

  async function renderInner(want, seed, tick, debug) {
    const tStart = performance.now();
    const stamp = (s) => { if (debug) console.warn('[bridge]', s, Math.round(performance.now() - tStart)); };
    const rand = mulberry32(seed ^ 0x9e3779b9);
    const R = () => rand();
    const RR = (a, b) => a + (b - a) * rand();
    const noise = makeNoise(mulberry32(seed + 11));
    const nz = noise.v2, fbm = noise.fbm;

    const portrait = want.portrait;
    const SW = portrait ? 1000 : 1500, SH = portrait ? 1500 : 1000; // sheet image units
    const long = want.long;
    const IW = portrait ? Math.round(long * SW / SH) : long;
    const k = IW / SW;
    const IH = Math.round(SH * k);
    const MX = Math.round(IW * (portrait ? 0.05 : 0.038)), MT = MX, MB = Math.round(MX * 1.45);
    const CW = IW + 2 * MX, CH = IH + MT + MB;
    const IX = MX, IY = MT;
    const N = CW * CH;

    // full-resolution buffers (whole sheet)
    const ink = new Float32Array(N);
    const sid = new Uint16Array(N);
    const gou = new Float32Array(N);
    const scr = new Float32Array(N);
    let strokeId = 1;

    // half-resolution maps (image area): tone, flow(+region), wash, object id, smoke owner
    const hw = Math.ceil(IW / 2), hh = Math.ceil(IH / 2), hk = k / 2;
    const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const cpu = (c) => c.getContext('2d', { willReadFrequently: true });
    const tcan = mkCanvas(hw, hh), fcan = mkCanvas(hw, hh), wcan = mkCanvas(hw, hh), ocan = mkCanvas(hw, hh), bcan = mkCanvas(hw, hh);
    const tctx = cpu(tcan), fctx = cpu(fcan), wctx = cpu(wcan), octx2 = cpu(ocan), bctx = cpu(bcan);
    for (const c of [tctx, fctx, wctx, octx2, bctx]) c.setTransform(hk, 0, 0, hk, 0, 0);
    wctx.fillStyle = '#000'; wctx.fillRect(0, 0, SW, SH);
    wctx.globalCompositeOperation = 'lighter';
    octx2.fillStyle = '#000'; octx2.fillRect(0, 0, SW, SH);
    bctx.fillStyle = '#000'; bctx.fillRect(0, 0, SW, SH);

    const gray = (v) => { const c = Math.round(255 * (1 - clamp(v, 0, 1))); return 'rgb(' + c + ',' + c + ',' + c + ')'; };
    const grayA = (v, a) => { const c = Math.round(255 * (1 - clamp(v, 0, 1))); return 'rgba(' + c + ',' + c + ',' + c + ',' + a + ')'; };
    const flowc = (th, id) => 'rgb(' + Math.round(128 + 127 * Math.cos(2 * th)) + ',' + Math.round(128 + 127 * Math.sin(2 * th)) + ',' + id + ')';
    // wash: R = gamboge yellow, G = vermilion, B = madder/crimson
    const washc = (y, o, c, a) => 'rgba(' + Math.round(255 * clamp(y, 0, 1)) + ',' + Math.round(255 * clamp(o, 0, 1)) + ',' + Math.round(255 * clamp(c, 0, 1)) + ',' + (a == null ? 1 : a) + ')';

    /* ---------- objects (for occlusion of pen work) and regions (how surfaces are hatched) */
    let OBJ = 1;
    const O = { ROCK: 1, RIFT: 2, TOWER: 3, WALL: 4, DEEP: 5, LBRIDGE: 6, PIER: 8, BRIDGE: 9, SMOKE: 10, WING: 11, BAL: 12, FIRE: 13, WIZ: 14, STAFF: 15, SWORD: 16, MOON: 17, PILLAR: 20 };
    const REG = new Array(256).fill(null);
    function reg(id, o) { REG[id] = Object.assign({ sp: 1, wt: 1, off: [0, 0.95, -0.8, 1.5708], minL: 14, maxL: 60, wob: 0.18, bow: 0.25, fn: null, lit: 1, layers: 15 }, o); return id; }
    function F(path, th, rid) { // flow + region + object id
      fctx.fillStyle = flowc(th, rid); fctx.fill(path);
      bctx.fillStyle = 'rgb(' + OBJ + ',0,0)'; bctx.fill(path);
    }

    /* ---------- camera (metres; the bridge runs along +z, its deck at y=0) */
    const cam = portrait
      ? { x: 2.0, y: 1.75, z: 0, yaw: -0.27, f: 1150, px: 460, py: 790 }
      : { x: 2.6, y: 1.75, z: 0, yaw: -0.36, f: 1100, px: 630, py: 560 };
    const cy0 = Math.cos(cam.yaw), sy0 = Math.sin(cam.yaw);
    const C3 = (x, y, z) => [(x - cam.x) * cy0 - (z - cam.z) * sy0, y - cam.y, (x - cam.x) * sy0 + (z - cam.z) * cy0];
    const PJ = (c) => [cam.px + cam.f * c[0] / c[2], cam.py - cam.f * c[1] / c[2], c[2]];
    const P = (x, y, z) => PJ(C3(x, y, z));
    const ZN = 0.6;
    function clipPoly(world) { // near-plane clip, returns projected polygon
      const cs = world.map((p) => C3(p[0], p[1], p[2]));
      const out = [];
      for (let i = 0; i < cs.length; i++) {
        const a = cs[i], b = cs[(i + 1) % cs.length];
        const ina = a[2] >= ZN, inb = b[2] >= ZN;
        if (ina) out.push(a);
        if (ina !== inb) { const t = (ZN - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, ZN]); }
      }
      return out.map(PJ);
    }
    function seg3(a, b) {
      let ca = C3(a[0], a[1], a[2]), cb = C3(b[0], b[1], b[2]);
      if (ca[2] < ZN && cb[2] < ZN) return null;
      if (ca[2] < ZN) { const t = (ZN - ca[2]) / (cb[2] - ca[2]); ca = [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ZN]; }
      if (cb[2] < ZN) { const t = (ZN - cb[2]) / (ca[2] - cb[2]); cb = [cb[0] + (ca[0] - cb[0]) * t, cb[1] + (ca[1] - cb[1]) * t, ZN]; }
      return [PJ(ca), PJ(cb)];
    }
    const VP1 = [cam.px - cam.f * sy0 / cy0, cam.py];   // direction of the bridge
    const VP2 = [cam.px + cam.f * cy0 / sy0, cam.py];   // across the chasm (far left)
    const HZ = cam.py;
    const toVPpx = (vx, vy) => { const X = IX + vx * k, Y = IY + vy * k; return (x, y) => Math.atan2(Y - y, X - x); };

    const L = {};
    const ZWIZ = portrait ? 4.9 : 5.2, ZBAL = portrait ? 19 : 20;
    L.wiz = P(0, 0, ZWIZ);
    L.wizS = (L.wiz[1] - P(0, 1.85, ZWIZ)[1]) / 100;     // units per wizard-unit (100 wu = 1.85 m)
    L.bal = P(0, 0, ZBAL);
    L.balS = (L.bal[1] - P(0, 9.4, ZBAL)[1]) / 100;      // 100 bu = 9.4 m

    /* ---------- the pen: rasterise capsules into a buffer, optionally masked by object */
    let OIDA = null;           // object ids at half resolution (filled after painting)
    let MASK = null;           // Uint8Array(256) of allowed objects, or null
    const X0 = IX, Y0 = IY, X1 = IX + IW - 1, Y1 = IY + IH - 1;
    let FREE = false;          // pen may leave the image (border only)
    function capsule(buf, x0, y0, x1, y1, r0, r1, a, id) {
      const rm = Math.max(r0, r1);
      let minx = Math.floor(Math.min(x0, x1) - rm - 1), maxx = Math.ceil(Math.max(x0, x1) + rm + 1);
      let miny = Math.floor(Math.min(y0, y1) - rm - 1), maxy = Math.ceil(Math.max(y0, y1) + rm + 1);
      const lx = FREE ? 0 : X0, ly = FREE ? 0 : Y0, hx = FREE ? CW - 1 : X1, hy = FREE ? CH - 1 : Y1;
      if (minx < lx) minx = lx; if (miny < ly) miny = ly; if (maxx > hx) maxx = hx; if (maxy > hy) maxy = hy;
      if (minx > maxx || miny > maxy) return;
      const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
      const isInk = buf === ink;
      for (let py = miny; py <= maxy; py++) {
        const yy = py + 0.5 - y0;
        let idx = py * CW + minx;
        const mrow = MASK ? ((py - IY) >> 1) * hw : 0;
        for (let px = minx; px <= maxx; px++, idx++) {
          if (MASK) { const mo = (px - IX) >> 1; if (mo < 0 || mo >= hw || mrow < 0 || !MASK[OIDA[mrow + mo]]) continue; }
          const xx = px + 0.5 - x0;
          let t = (xx * dx + yy * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = xx - t * dx, ey = yy - t * dy;
          const d = Math.sqrt(ex * ex + ey * ey);
          const r = r0 + (r1 - r0) * t;
          let c;
          if (r >= 0.5) { c = r + 0.5 - d; if (c <= 0) continue; if (c > 1) c = 1; }
          else { c = (1 - d) * 2 * r; if (c <= 0) continue; }
          c *= a;
          if (isInk) {
            if (sid[idx] === id) { if (c > ink[idx]) ink[idx] = c; }
            else { ink[idx] = 1 - (1 - ink[idx]) * (1 - c); sid[idx] = id; }
          } else if (c > buf[idx]) buf[idx] = c;
        }
      }
    }
    function strokePx(buf, xs, ys, rs, a) {
      strokeId = (strokeId + 1) & 0xffff; if (!strokeId) strokeId = 1;
      for (let i = 1; i < xs.length; i++) capsule(buf, xs[i - 1], ys[i - 1], xs[i], ys[i], rs[i - 1], rs[i], a, strokeId);
    }
    const maskCache = new Map();
    function maskOf(obj) {
      if (obj == null) return null;
      const key = Array.isArray(obj) ? obj.join(',') : String(obj);
      let m = maskCache.get(key);
      if (!m) { m = new Uint8Array(256); for (const o of [].concat(obj)) m[o] = 1; maskCache.set(key, m); }
      return m;
    }
    // pen in units: pts [[x,y]...]; opt {w, w1, taper:[a,b], a, wob, buf, pressure(f), obj}
    function pen(pts, opt) {
      if (!pts || pts.length < 2) return;
      opt = opt || {};
      const buf = opt.buf || ink;
      const w0 = opt.w == null ? 0.9 : opt.w, w1 = opt.w1 == null ? w0 : opt.w1;
      const a = opt.a == null ? 0.95 : opt.a;
      const wob = opt.wob == null ? 0.22 : opt.wob;
      const ta = opt.taper ? opt.taper[0] : 0.12, tb = opt.taper ? opt.taper[1] : 0.22;
      const src = pts.map((p) => [IX + p[0] * k, IY + p[1] * k]);
      const total = plen(src);
      if (!(total > 0.6) || total > 1e5) return;
      const step = opt.step || 1.5;
      const n = Math.max(2, Math.ceil(total / step) + 1);
      const xs = new Float32Array(n), ys = new Float32Array(n), rs = new Float32Array(n);
      let si = 1, acc = 0, segL = Math.hypot(src[1][0] - src[0][0], src[1][1] - src[0][1]);
      const ph = R() * 100;
      for (let i = 0; i < n; i++) {
        const s = (i / (n - 1)) * total;
        while (s > acc + segL && si < src.length - 1) { acc += segL; si++; segL = Math.hypot(src[si][0] - src[si - 1][0], src[si][1] - src[si - 1][1]); }
        const t = segL > 0 ? clamp((s - acc) / segL, 0, 1) : 0;
        const ax = src[si - 1][0], ay = src[si - 1][1], bx = src[si][0], by = src[si][1];
        let x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        const tl = Math.hypot(bx - ax, by - ay) || 1;
        const off = wob * k * (nz(ph + s / (7 * k), 3.3) - 0.5) * 2;
        x += -(by - ay) / tl * off; y += (bx - ax) / tl * off;
        const f = i / (n - 1);
        let taper = 1;
        if (ta > 0) taper *= smooth(0, ta, f) * 0.8 + 0.2;
        if (tb > 0) taper *= smooth(1, 1 - tb, f) * 0.92 + 0.08;
        xs[i] = x; ys[i] = y;
        rs[i] = 0.5 * k * (w0 + (w1 - w0) * f) * taper * (opt.pressure ? opt.pressure(f) : 1);
      }
      MASK = OIDA ? maskOf(opt.obj) : null;
      strokePx(buf, xs, ys, rs, a);
      MASK = null;
    }
    const gpen = (pts, opt) => pen(pts, Object.assign({ buf: gou, wob: 0.1 }, opt));
    const spen = (pts, opt) => pen(pts, Object.assign({ buf: scr, wob: 0.05 }, opt));
    function ticks(cx, cy, ang, n, len, gap, w, a, obj) {
      const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * gap + (R() - 0.5) * gap * 0.3;
        const l = len * (0.7 + 0.5 * R());
        const sx = cx + nx * o + ux * (R() - 0.5) * len * 0.3, sy = cy + ny * o + uy * (R() - 0.5) * len * 0.3;
        pen([[sx - ux * l / 2, sy - uy * l / 2], [sx + ux * l / 2, sy + uy * l / 2]], { w, a: a || 0.9, wob: 0.03, taper: [0.1, 0.4], obj });
      }
    }

    /* ---------- painting helpers (tone canvas, flow canvas, wash canvas) */
    function softDraw(ctx, pts, pad, blur, fn) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; }
      const m = pad + blur * 3 + 2;
      let px0 = Math.floor((x0 - m) * hk), py0 = Math.floor((y0 - m) * hk), px1 = Math.ceil((x1 + m) * hk), py1 = Math.ceil((y1 + m) * hk);
      px0 = Math.max(px0, -8); py0 = Math.max(py0, -8); px1 = Math.min(px1, hw + 8); py1 = Math.min(py1, hh + 8);
      const pw = px1 - px0, ph = py1 - py0;
      if (pw <= 0 || ph <= 0) return;
      const A = mkCanvas(pw, ph), B = mkCanvas(pw, ph);
      const ta = cpu(A), tb = cpu(B);
      ta.setTransform(hk, 0, 0, hk, -px0, -py0);
      fn(ta);
      tb.filter = 'blur(' + Math.max(0.01, blur * hk).toFixed(2) + 'px)';
      tb.drawImage(A, 0, 0);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(B, px0, py0);
      ctx.restore();
    }
    function tStroke(pts, v, w, blur, alpha) {
      const st = alpha == null ? gray(v) : grayA(v, alpha);
      const draw = (c) => { c.strokeStyle = st; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(polyPath(pts, true)); };
      if (blur) softDraw(tctx, pts, w, blur, draw); else { tctx.save(); draw(tctx); tctx.restore(); }
    }
    function tFill(pts, v, blur, alpha) {
      const st = alpha == null ? gray(v) : grayA(v, alpha);
      const draw = (c) => { c.fillStyle = st; c.fill(polyPath(pts)); };
      if (blur) softDraw(tctx, pts, 0, blur, draw); else { tctx.save(); draw(tctx); tctx.restore(); }
    }
    function flowAlong(pts, id, w, dth) {
      fctx.save(); fctx.lineCap = 'round'; fctx.lineWidth = w;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        fctx.strokeStyle = flowc(Math.atan2(b[1] - a[1], b[0] - a[0]) + (dth || 0), id);
        fctx.beginPath(); fctx.moveTo(a[0], a[1]); fctx.lineTo(b[0], b[1]); fctx.stroke();
      }
      fctx.restore();
    }
    function wFill(pts, y, o, c, a, blur) {
      const draw = (cx) => { cx.fillStyle = washc(y, o, c, a); cx.fill(polyPath(pts)); };
      if (blur) softDraw(wctx, pts, 0, blur, draw); else { wctx.save(); draw(wctx); wctx.restore(); }
    }
    function wStroke(pts, y, o, c, a, w, blur) {
      const draw = (cx) => { cx.strokeStyle = washc(y, o, c, a); cx.lineWidth = w; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.stroke(polyPath(pts, true)); };
      if (blur) softDraw(wctx, pts, w, blur, draw); else { wctx.save(); draw(wctx); wctx.restore(); }
    }
    function wRadial(x, y, r, y0, o0, c0, a0, sq) {
      wctx.save();
      wctx.translate(x, y); wctx.scale(1, sq || 1);
      const g = wctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, washc(y0, o0, c0, a0)); g.addColorStop(0.45, washc(y0, o0, c0, a0 * 0.45)); g.addColorStop(1, washc(y0, o0, c0, 0));
      wctx.fillStyle = g; wctx.fillRect(-r, -r, 2 * r, 2 * r);
      wctx.restore();
    }
    const xf = (o, s) => (pts) => pts.map((p) => [o[0] + p[0] * s, o[1] + p[1] * s]);

    /* ================================================================ REGIONS */
    const R_SKY = reg(1, { sp: 0.68, wt: 0.85, fn: (x, y) => -0.012 + 0.05 * (nz(x / 900, y / 500) - 0.5), maxL: 150, minL: 22, wob: 0.1, bow: 0.04, off: [0, 0.1, -0.09, 1.5708], lit: 0.25 });
    const R_CLOUD = reg(5, { sp: 0.66, wt: 0.85, maxL: 70, minL: 12, wob: 0.12, bow: 0.2, off: [0, 0.14, -0.12, 0.6], lit: 0.25 });
    const R_SNOW = reg(2, { sp: 0.55, wt: 0.62, maxL: 16, minL: 4, wob: 0.07, bow: 0.12, off: [0, 0.55, -0.45, 1.1], lit: 0.15 });
    const R_FAR = reg(3, { sp: 0.55, wt: 0.55, fn: () => 0.01, maxL: 50, wob: 0.06, off: [0, 0.12, -0.1, 1.5], lit: 0.1 });
    const R_TOWER = reg(4, { sp: 0.4, wt: 0.85, fn: () => Math.PI / 2, maxL: 70, wob: 0.03, bow: 0, off: [0, 0.35, -0.35, 1.5708], lit: 0 });
    const R_ROCK = reg(10, { sp: 1.1, wt: 1.0, fn: (x, y) => 2.0 + 1.6 * (nz(x / 380, y / 380) - 0.5) + 0.6 * (nz(x / 70, y / 70) - 0.5), maxL: 30, minL: 6, wob: 0.28, bow: 0.5 });
    const R_RIFTLIP = reg(11, { sp: 0.95, wt: 1.0, maxL: 26, minL: 5, wob: 0.25, bow: 0.4, off: [0, 0.8, -0.9, 1.5708] });
    const R_WALLF = reg(13, { sp: 0.85, wt: 0.85, fn: toVPpx(VP2[0], VP2[1]), maxL: 50, wob: 0.14, bow: 0.1, off: [0, 'V', 0.6, -0.6], lit: 0.75 });
    const R_ARCH = reg(14, { sp: 0.75, wt: 0.75, fn: () => 0.05, maxL: 40, wob: 0.1, off: [0, 0.3, -0.3, 1.5708], lit: 0.5 });
    const R_FACE_A = reg(20, { sp: 1.0, wt: 1.05, fn: toVPpx(VP1[0], VP1[1]), maxL: 60, wob: 0.16, bow: 0.2, off: [0, 0.85, -0.7, 'V'] });
    const R_FACE_B = reg(21, { sp: 1.0, wt: 1.05, fn: toVPpx(VP2[0], VP2[1]), maxL: 60, wob: 0.16, bow: 0.2, off: [0, -0.85, 0.7, 'V'] });
    const R_FACE_A2 = reg(22, { sp: 0.8, wt: 0.85, fn: toVPpx(VP1[0], VP1[1]), maxL: 50, wob: 0.14, off: [0, 0.85, -0.7, 'V'], lit: 0.7 });
    const R_FACE_B2 = reg(23, { sp: 0.8, wt: 0.85, fn: toVPpx(VP2[0], VP2[1]), maxL: 50, wob: 0.14, off: [0, -0.85, 0.7, 'V'], lit: 0.7 });
    const R_DEEP = reg(30, { sp: 0.85, wt: 0.85, fn: (x, y) => Math.PI / 2 + 0.25 * (nz(x / 300, y / 300) - 0.5), maxL: 60, wob: 0.22, bow: 0.15, lit: 0.4, off: [0, 0.45, -0.45, 1.5708] });
    const R_DECK = reg(40, { sp: 0.85, wt: 1.0, fn: toVPpx(VP1[0], VP1[1]), maxL: 40, wob: 0.1, bow: 0.1, off: [0, 1.3, -0.95, 'V'] });
    const R_BSIDE = reg(41, { sp: 0.8, wt: 1.0, fn: toVPpx(VP1[0], VP1[1]), maxL: 40, wob: 0.1, bow: 0.1, off: [0, 'V', 0.6, -0.6] });
    const R_PIER = reg(42, { sp: 0.85, wt: 1.0, fn: (x, y) => Math.PI / 2 + 0.5 * (nz(x / 90, y / 140) - 0.5), maxL: 26, minL: 6, wob: 0.3, bow: 0.5, off: [0, 0.9, -0.8, 1.5708] });
    const R_SMOKE = reg(50, { t0: 0.2, sp: 0.95, wt: 0.95, maxL: 30, minL: 6, wob: 0.18, bow: 0.3, lit: 0.85, off: [0, 0.8, -0.75, 1.5708] });
    const R_WING = reg(60, { sp: 0.9, wt: 1.15, maxL: 40, minL: 8, wob: 0.25, bow: 0.35, lit: 0.1, off: [0, 0.6, -0.55, 1.5708] });
    const R_WING2 = reg(61, Object.assign({}, REG[60]));
    const R_BAL = reg(70, { sp: 0.62, wt: 1.15, maxL: 30, minL: 6, wob: 0.1, bow: 0.3, lit: 0.08, off: [0, 0.85, -0.75, 1.5708] });
    const R_HORN = reg(72, { sp: 0.55, wt: 1.0, maxL: 12, minL: 3, wob: 0.06, bow: 0.3, lit: 0.3 });
    const R_FIRE = reg(80, { fn: (x, y) => -Math.PI / 2 + 0.5 * (nz(x / 120, y / 160) - 0.5), sp: 0.9, wt: 0.55, maxL: 40, minL: 8, wob: 0.2, bow: 0.5, lit: 0, layers: 0 });
    const R_CLOAK = reg(90, { lit: 0.12, sp: 0.68, wt: 1.0, maxL: 34, minL: 6, wob: 0.08, bow: 0.12, off: [0, 0.8, -0.75, 1.5708] });
    const R_HAT = reg(91, { lit: 0.12, sp: 0.6, wt: 1.0, maxL: 26, minL: 5, wob: 0.06, bow: 0.15, off: [0, 0.75, -0.75, 1.5708] });
    const R_HAIR = reg(92, { lit: 0.2, sp: 0.5, wt: 0.65, maxL: 40, minL: 6, wob: 0.06, bow: 0.1, layers: 3 });
    const R_SKIN = reg(93, { lit: 0.4, sp: 0.48, wt: 0.75, maxL: 10, minL: 3, wob: 0.04 });
    const R_STEEL = reg(94, { sp: 0.45, wt: 0.7, maxL: 20, minL: 3, wob: 0.02, layers: 1 });
    const R_STAFF = reg(95, { sp: 0.42, wt: 0.9, maxL: 14, minL: 3, wob: 0.05 });
    const R_SLEEVE = reg(97, { lit: 0.25, sp: 0.64, wt: 1.0, maxL: 30, minL: 5, wob: 0.08, bow: 0.15, off: [0, 0.8, -0.75, 1.5708] });

    /* ================================================================ SCENE LAYOUT */
    const lay = portrait ? {
      rift: [[110, -30], [204, 110], [168, 250], [222, 390], [186, 520], [236, 650], [214, 760], [270, 830], [372, 812], [392, 720], [430, 610], [410, 480], [462, 360], [440, 220], [500, 90], [470, -30]],
      eyeF: 0.55, glow: [600, 1420], glowR: 700, wallZ: 95,
      pillars: [
        { x: -8.0, z: 9.0, w: 2.8, near: true, rune: 1 },
        { x: 7.0, z: 17.0, w: 2.8, near: true, rune: 1 },
        { x: 12, z: 40, w: 3.0, rune: 0.6 },
      ],
    } : {
      rift: [[86, -30], [150, 90], [122, 214], [168, 330], [140, 440], [182, 540], [166, 612], [232, 660], [322, 642], [342, 560], [366, 470], [350, 350], [388, 240], [372, 110], [416, -30]],
      eyeF: 0.56, glow: [880, 1080], glowR: 760, wallZ: 90,
      pillars: [
        { x: -11.8, z: 10.5, w: 3.2, near: true, rune: 1 },
        { x: 7.8, z: 17.5, w: 3.0, near: true, rune: 1 },
        { x: 13, z: 36, w: 3.0, rune: 0.6 },
      ],
    };
    const B0 = L.bal, bs = L.balS;
    // the Balrog's own proportions: long legs, a short heavy trunk (all its drawing passes through BX)
    const BY = (y) => (y >= -36 ? y * 46 / 36 : y >= -92 ? -46 + (y + 36) * (46 / 56) : y);
    const BX = (pts) => pts.map((p) => [B0[0] + p[0] * bs, B0[1] + BY(p[1]) * bs]);
    // a small head on a giant's body: head features shrink toward the neck
    const HT = (p) => [-20 + (p[0] + 20) * 0.9, -95 + (p[1] + 95) * 0.9];
    const BXH = (pts) => BX(pts.map(HT));
    const W0 = L.wiz, ws = L.wizS, WX = xf(W0, ws);
    L.blaze = WX([[-43.4, -188]])[0];

    // base: cave darkness everywhere
    tctx.fillStyle = gray(0.95); tctx.fillRect(0, 0, SW, SH);
    OBJ = O.ROCK; { const p = new Path2D(); p.rect(-10, -10, SW + 20, SH + 20); F(p, 0, R_ROCK); }

    /* ---------------------------------------------------------- the far wall, and the abyss below the bridge */
    const ZW = lay.wallZ;
    const WP = (x, y) => P(x, y, ZW);
    {
      OBJ = O.WALL;
      const path = polyPath(clipPoly([[-260, 90, ZW], [140, 90, ZW], [140, -160, ZW], [-260, -160, ZW]]));
      const g = tctx.createLinearGradient(0, HZ - 300, 0, SH);
      g.addColorStop(0, gray(0.92)); g.addColorStop((300) / (SH - HZ + 300), gray(0.86)); g.addColorStop(0.75, gray(0.62)); g.addColorStop(1, gray(0.5));
      tctx.fillStyle = g; tctx.fill(path);
      F(path, 0, R_WALLF);
    }
    // arcades of the deeper halls, cut in the far wall: lit openings, dark piers between
    L.arcades = [];
    {
      OBJ = O.DEEP;
      const levels = portrait ? [-13, -27, -44, -64] : [-12, -25, -42, -62];
      levels.forEach((top, j) => {
        const hgt = 4.2 - j * 0.2, bot = top - hgt;
        let x = -200 + R() * 8;
        const arches = [];
        while (x < 120) {
          const runLen = RR(8, 34);
          const gap = RR(12, 48);
          const pitch = RR(3.0, 3.8);
          const hv = RR(0.75, 1.15);
          for (let xx = x; xx < x + runLen; xx += pitch) {
            if (R() < 0.15) continue;
            const w = pitch * 0.6, r = w / 2;
            const pts = [[xx, bot, ZW], [xx + w, bot, ZW]];
            const tp = bot + (top - bot) * hv;
            for (let a = 0; a <= 8; a++) { const t = a / 8 * Math.PI; pts.push([xx + r + r * Math.cos(t), tp - r + r * Math.sin(t) * 1.1, ZW]); }
            const pp = clipPoly(pts);
            if (pp.length < 3 || pp[0][0] < -30 || pp[0][0] > SW + 30) continue;
            const path = polyPath(pp);
            const v = clamp(0.72 - j * 0.08 + RR(-0.06, 0.06), 0.3, 0.85);
            tctx.fillStyle = gray(v); tctx.fill(path);
            F(path, 0, R_ARCH);
            arches.push(pp);
          }
          x += runLen + gap;
        }
        L.arcades.push({ top, bot, j, arches });
      });
    }

    /* ---------------------------------------------------------- the rift: sky, snows, eye */
    const rift = spline(lay.rift, true, 7);
    for (const p of rift) { p[0] += (nz(p[1] / 9, 3) - 0.5) * 16 + (R() - 0.5) * 5; p[1] += (R() - 0.5) * 5; }
    const riftPath = polyPath(rift);
    const rb = rift.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    const rw = rb[2] - rb[0];
    const RX = (f) => rb[0] + rw * f;
    L.rift = rift;
    {
      OBJ = O.WALL;
      tctx.save(); tctx.lineJoin = 'round'; tctx.strokeStyle = gray(0.7); tctx.lineWidth = 30; tctx.stroke(riftPath); tctx.restore();
      tStroke(rift.concat([rift[0]]), 0.5, 14, 7, 0.6);
      fctx.save(); fctx.lineWidth = 30; fctx.strokeStyle = flowc(1.3, R_RIFTLIP); fctx.stroke(riftPath); fctx.restore();
    }
    OBJ = O.RIFT;
    tctx.save(); tctx.clip(riftPath); fctx.save(); fctx.clip(riftPath);
    {
      const g = tctx.createLinearGradient(0, rb[1], 0, HZ);
      g.addColorStop(0, gray(0.66)); g.addColorStop(0.5, gray(0.44)); g.addColorStop(1, gray(0.24));
      tctx.fillStyle = g; tctx.fillRect(rb[0] - 10, rb[1] - 10, rw + 20, rb[3] - rb[1] + 20);
      const all = new Path2D(); all.rect(rb[0] - 10, rb[1] - 10, rw + 20, rb[3] - rb[1] + 20);
      F(all, 0, R_SKY);
      // the moon, low, veiled
      const mx = RX(0.3) + RR(-10, 10), my = lerp(rb[1], HZ, portrait ? 0.3 : 0.26);
      L.moon = [mx, my, portrait ? 13 : 14];
      const mg = tctx.createRadialGradient(mx, my, 6, mx, my, 230);
      mg.addColorStop(0, 'rgba(255,255,255,1)'); mg.addColorStop(0.12, 'rgba(255,255,255,0.8)'); mg.addColorStop(0.4, 'rgba(255,255,255,0.35)'); mg.addColorStop(1, 'rgba(255,255,255,0)');
      tctx.fillStyle = mg; tctx.fillRect(mx - 260, my - 260, 520, 520);
      // storm clouds: banks of billows, dark bellies, moonlit crowns
      const bands = [[rb[1] + 40, 0.72], [lerp(rb[1], HZ, 0.45), 0.55], [lerp(rb[1], HZ, 0.68), 0.42]];
      for (const [by, dark] of bands) {
        let x = rb[0] - 40;
        while (x < rb[2] + 40) {
          const r = RR(12, 30);
          const cx = x, cyy = by + RR(-20, 20);
          const dm = Math.hypot(cx - mx, cyy - my);
          const v = clamp(dark - 0.35 * (1 - smooth(30, 220, dm)) + RR(-0.08, 0.08), 0.1, 0.85);
          const gg = tctx.createLinearGradient(0, cyy - r, 0, cyy + r * 0.7);
          gg.addColorStop(0, grayA(v - 0.32, 0.9)); gg.addColorStop(0.45, grayA(v, 0.95)); gg.addColorStop(1, grayA(v + 0.1, 0.0));
          tctx.fillStyle = gg; tctx.beginPath(); tctx.ellipse(cx, cyy, r * 1.7, r * 0.72, 0, 0, TAU); tctx.fill();
          const ep = new Path2D(); ep.ellipse(cx, cyy, r * 1.7, r * 0.72, 0, 0, TAU);
          F(ep, 0.04 * (R() - 0.5), R_CLOUD);
          x += r * RR(1.3, 2.3);
        }
      }
      OBJ = O.MOON;
      tctx.fillStyle = gray(0); tctx.beginPath(); tctx.arc(mx, my, L.moon[2], 0, TAU); tctx.fill();
      const mp = new Path2D(); mp.arc(mx, my, L.moon[2] + 1, 0, TAU); F(mp, 0, 0);
      OBJ = O.RIFT;
    }
    tctx.restore(); fctx.restore();

    /* ---------------------------------------------------------- the snowy range (a heightfield, voxel-rendered) */
    L.tower = [RX(lay.eyeF), HZ + 1, portrait ? 50 : 54];
    async function mountainsVoxel() {
      const x0 = Math.max(0, Math.floor(rb[0] * hk)), x1 = Math.min(hw - 1, Math.ceil(rb[2] * hk));
      const y0 = Math.max(0, Math.floor(rb[1] * hk)), y1 = Math.min(hh - 1, Math.ceil(rb[3] * hk));
      const W2 = x1 - x0 + 1, H2 = y1 - y0 + 1;
      const mc = mkCanvas(W2, H2), mx = cpu(mc);
      mx.setTransform(hk, 0, 0, hk, -x0 / 1, -y0 / 1); mx.fill(riftPath);
      const mask = mx.getImageData(0, 0, W2, H2).data;
      const timg = tctx.getImageData(x0, y0, W2, H2), fimg = fctx.getImageData(x0, y0, W2, H2);
      const td = timg.data, fd = fimg.data;
      const Fz = (portrait ? 1250 : 1400) * hk;
      const hzp = HZ * hk - y0;
      const eyeH = 0.35;
      const towerX = L.tower[0] * hk - x0;
      const cxp = (rb[0] + rw * 0.45) * hk - x0;
      // peaks: [fraction across the rift, distance km, height km, half-width as a fraction of the rift]
      const peakF = portrait
        ? [[0.12, 28, 3.0, 0.2], [0.34, 44, 4.0, 0.22], [0.8, 32, 3.1, 0.18], [0.96, 56, 3.9, 0.2], [0.58, 84, 4.3, 0.14], [0.45, 62, 3.1, 0.16]]
        : [[0.1, 30, 3.0, 0.2], [0.3, 46, 4.2, 0.22], [0.8, 34, 3.2, 0.18], [0.98, 58, 4.0, 0.2], [0.6, 86, 4.4, 0.14], [0.45, 64, 3.2, 0.16]];
      const peaks = peakF.map(([f, z, h, w]) => [((rb[0] + rw * f) * hk - x0 - cxp) / Fz, z, h, w * rw * hk / Fz]);
      const towerAng = (towerX - cxp) / Fz;
      const ridged = (x, z, f0, oct) => {
        let h = 0, a = 1, f = f0, w = 1;
        for (let i = 0; i < oct; i++) {
          const n = nz(x * f + i * 31.7 + 100, z * f * 0.7 + i * 17.1);
          let r = 1 - Math.abs(2 * n - 1); r = r * r;
          h += r * a * w; w = clamp(r * 1.7, 0, 1); a *= 0.5; f *= 2.1;
        }
        return h;
      };
      const H = (x, z) => {
        const ang = x / z;
        let h = 0;
        // the main range: a broad band of ridged mountains
        const env = smooth(18, 32, z) * (1 - smooth(90, 125, z));
        if (env > 0) h += env * (0.8 + 2.2 * ridged(x, z, 0.1, 6) * (0.5 + 0.9 * nz(x * 0.05 + 3, z * 0.04)));
        // great summits
        for (const pk of peaks) {
          const d = Math.hypot((ang - pk[0]) / pk[3], (z - pk[1]) / (pk[1] * 0.14));
          if (d < 1.8) h += pk[2] * Math.pow(1 - d / 1.8, 1.4) * (0.8 + 0.35 * ridged(x * 1.7, z * 1.7, 0.3, 3));
        }
        // dark foothills close in front
        const fh = smooth(9.5, 12.5, z) * (1 - smooth(16, 21, z));
        if (fh > 0) h += fh * (0.12 + 0.38 * ridged(x * 1.3 + 50, z, 0.3, 4));
        const dv = (ang - towerAng) / 0.022;
        h *= 1 - 0.9 * Math.exp(-dv * dv);
        h *= 1 - smooth(110, 150, z) * 0.9;
        return h;
      };
      const Lx = -0.82, Ly = 0.32, Lz = 0.3; const Ll = Math.hypot(Lx, Ly, Lz);
      const sky = new Float32Array(W2).fill(H2);
      for (let c = 0; c < W2; c++) {
        let ymin = H2;
        const dirx = (c - cxp) / Fz;
        for (let z = 9; z < 240; z *= 1.008) {
          const x = dirx * z;
          const h = H(x, z);
          const v = hzp - Fz * (h - eyeH) / z + Fz * (z * z / 12742) / z;
          if (v < ymin) {
            const e = 0.02 + z * 0.0015;
            const hx = (H(x + e, z) - H(x - e, z)) / (2 * e), hzz = (H(x, z + e) - H(x, z - e)) / (2 * e);
            const nl = Math.hypot(hx, 1, hzz);
            const lam = (-hx * Lx + Ly - hzz * Lz) / (nl * Ll);
            const slope = Math.hypot(hx, hzz);
            const snowline = 1.45 + 0.6 * (nz(x * 3, z * 0.5) - 0.5);
            const snow = smooth(snowline - 0.2, snowline + 0.15, h) * (1 - smooth(1.9, 3.4, slope));
            const lit = clamp(lam, 0, 1);
            let tone = snow > 0.5 ? lerp(0.62, 0.0, smooth(0.05, 0.55, lit)) : lerp(0.94, 0.55, lit);
            const fog = clamp(smooth(30, 160, z) * 0.55 + (1 - smooth(0.15, 0.8, h)) * 0.4, 0, 0.75);
            tone = lerp(tone, 0.32, fog);
            const th = Math.atan2(1, -hx * 0.9);
            const top = Math.max(0, Math.floor(v));
            const tv = Math.round(255 * (1 - tone));
            const fr = Math.round(128 + 127 * Math.cos(2 * th)), fg = Math.round(128 + 127 * Math.sin(2 * th));
            const rid = z > 110 ? R_FAR : R_SNOW;
            for (let y = top; y < ymin; y++) {
              const i = y * W2 + c;
              if (mask[i * 4 + 3] < 128) continue;
              td[i * 4] = td[i * 4 + 1] = td[i * 4 + 2] = tv;
              fd[i * 4] = fr; fd[i * 4 + 1] = fg; fd[i * 4 + 2] = rid;
            }
            ymin = top;
          }
          if (ymin <= 0) break;
        }
        sky[c] = ymin;
        if ((c & 15) === 0) await tick();
      }
      tctx.putImageData(timg, x0, y0); fctx.putImageData(fimg, x0, y0);
      L.skyline = [];
      for (let c = 0; c < W2; c += 2) L.skyline.push([(c + x0) / hk, (sky[c] + y0) / hk]);
    }
    await mountainsVoxel();
    stamp('mountains');
    {
      OBJ = O.TOWER;
      const [tx, tb, th] = L.tower;
      const tw = th * 0.15;
      // a stepped, buttressed mass crowned with a broken parapet (no horns, no prongs)
      const tp = [[tx - tw * 2.3, tb + 3], [tx - tw * 1.7, tb - th * 0.16], [tx - tw * 1.35, tb - th * 0.2], [tx - tw * 1.2, tb - th * 0.46],
        [tx - tw * 0.95, tb - th * 0.5], [tx - tw * 0.85, tb - th * 0.78], [tx - tw * 0.98, tb - th * 0.8], [tx - tw * 0.92, tb - th * 0.88],
        [tx - tw * 0.7, tb - th * 0.87], [tx - tw * 0.7, tb - th * 0.92], [tx - tw * 0.45, tb - th * 0.91], [tx - tw * 0.42, tb - th * 0.95],
        [tx - tw * 0.15, tb - th * 0.93], [tx + tw * 0.12, tb - th * 0.96], [tx + tw * 0.35, tb - th * 0.92], [tx + tw * 0.55, tb - th * 0.93],
        [tx + tw * 0.62, tb - th * 0.88], [tx + tw * 0.86, tb - th * 0.86], [tx + tw * 0.8, tb - th * 0.78], [tx + tw * 0.95, tb - th * 0.52],
        [tx + tw * 1.25, tb - th * 0.48], [tx + tw * 1.4, tb - th * 0.22], [tx + tw * 1.85, tb - th * 0.15], [tx + tw * 2.4, tb + 3]];
      L.towerPoly = tp;
      tctx.save(); tctx.clip(riftPath); fctx.save(); fctx.clip(riftPath); bctx.save(); bctx.clip(riftPath);
      const tpp = polyPath(tp);
      tctx.fillStyle = gray(0.97); tctx.fill(tpp); F(tpp, Math.PI / 2, R_TOWER);
      L.eye = [tx + tw * 0.05, tb - th * 1.24, th * 0.2];
      const [ex, ey, er] = L.eye;
      // a slow dark wheel of storm round the eye
      for (let i = 0; i < 9; i++) {
        const a0 = i * 0.7 + R(), rr = er * (2.2 + i * 0.55);
        const arc = [];
        for (let t = 0; t < 1; t += 0.05) { const a = a0 + t * 2.2; arc.push([ex + Math.cos(a) * rr * (1 + t * 0.3), ey + Math.sin(a) * rr * 0.45 * (1 + t * 0.3)]); }
        tStroke(arc, 0.6 + 0.1 * R(), er * (0.5 + 0.5 * R()), er * 0.8, 0.3);
      }
      tctx.fillStyle = gray(0.0); tctx.beginPath(); tctx.ellipse(ex, ey, er * 1.35, er * 0.75, 0, 0, TAU); tctx.fill();
      const ep = new Path2D(); ep.ellipse(ex, ey, er * 1.3, er * 0.7, 0, 0, TAU); F(ep, 0, 0);
      tctx.restore(); fctx.restore(); bctx.restore();
    }

    /* ---------------------------------------------------------- the deep: lower bridges, haze, the glow */
    {
      OBJ = O.LBRIDGE;
      // a slender bridge far below, parallel to ours, and another crossing the abyss deeper still
      const lb = [];
      const mkArch = (pts3top, pts3bot, v) => {
        const top = pts3top.map((p) => P(...p)), bot = pts3bot.map((p) => P(...p));
        const poly = top.concat(bot.reverse());
        const path = polyPath(poly);
        tctx.fillStyle = gray(v); tctx.fill(path); F(path, 0, R_PIER);
        lb.push({ top, bot: bot.reverse() });
      };
      {
        const xA = portrait ? -9 : -13, y = portrait ? -24 : -22;
        const tops = [], bots = [];
        for (let z = 12; z <= 88; z += 1) { tops.push([xA, y, z]); bots.push([xA, y - 0.7 - 7 * Math.pow(Math.abs((z - 50) / 38), 4), z]); }
        mkArch(tops, bots, 0.84);
      }
      {
        const z = 58, y = portrait ? -42 : -40;
        const tops = [], bots = [];
        for (let x = -90; x <= 60; x += 1.5) { tops.push([x, y, z]); bots.push([x, y - 0.8 - 9 * Math.pow(Math.abs((x + 15) / 75), 5), z]); }
        mkArch(tops, bots, 0.78);
      }
      L.lowBridges = lb;
      // haze rising out of the deep
      for (let i = 0; i < 30; i++) {
        const x = RR(0, SW), y = RR(HZ + 80, SH + 60), r = RR(40, 120);
        const g = tctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, grayA(0.3, 0.35)); g.addColorStop(1, grayA(0.3, 0));
        tctx.save(); tctx.translate(x, y); tctx.scale(2.4, 0.55); tctx.translate(-x, -y);
        tctx.fillStyle = g; tctx.beginPath(); tctx.arc(x, y, r, 0, TAU); tctx.fill(); tctx.restore();
      }
      const [gx, gy] = lay.glow; L.glow = lay.glow;
      const rg = tctx.createRadialGradient(gx, gy, 10, gx, gy, lay.glowR * 0.75);
      rg.addColorStop(0, 'rgba(255,255,255,0.8)'); rg.addColorStop(0.3, 'rgba(255,255,255,0.45)'); rg.addColorStop(0.7, 'rgba(255,255,255,0.1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      tctx.fillStyle = rg; tctx.fillRect(0, HZ + 20, SW, SH);
    }

    /* ---------------------------------------------------------- pillars rising out of the deep */
    L.pillarFaces = [];
    function drawPillar(pl, idx) {
      OBJ = O.PILLAR + idx;
      const hw2 = pl.w / 2;
      const y0 = -90, y1 = pl.broken ? pl.broken : 50;
      const x0 = pl.x - hw2, x1 = pl.x + hw2, z0 = pl.z - hw2, z1 = pl.z + hw2;
      const faces = [];
      faces.push({ k: 'B', w: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], plane: 'z', x0, x1, z: z0 });
      if (cam.x > x1) faces.push({ k: 'A', w: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], plane: 'x', z0, z1, x: x1 });
      else if (cam.x < x0) faces.push({ k: 'A', w: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], plane: 'x', z0, z1, x: x0 });
      const isLeft = pl.x < 0;
      for (const f of faces) {
        const pp = clipPoly(f.w);
        if (pp.length < 3) continue;
        const path = polyPath(pp);
        let v;
        if (f.k === 'A') v = isLeft ? 0.62 : 0.8;
        else v = isLeft ? 0.84 : 0.66;
        if (!pl.near) v -= 0.06;
        const yb = P(pl.x, 0, pl.z)[1];
        const g = tctx.createLinearGradient(0, yb - 560, 0, yb + 700);
        g.addColorStop(0, gray(v + 0.14)); g.addColorStop(0.42, gray(v)); g.addColorStop(0.5, gray(v - 0.06)); g.addColorStop(0.75, gray(v + 0.06)); g.addColorStop(1, gray(v - 0.2));
        tctx.fillStyle = g; tctx.fill(path);
        const id = !pl.near ? (f.k === 'A' ? R_FACE_A2 : R_FACE_B2) : (f.k === 'A' ? R_FACE_A : R_FACE_B);
        F(path, 0, id);
        L.pillarFaces.push({ pl, f, path, obj: OBJ });
      }
    }
    const pillars = lay.pillars.map((p, i) => Object.assign({ idx: i }, p)).sort((p, q) => q.z - p.z);
    for (const pl of pillars) if (!pl.near) drawPillar(pl, pl.idx);

    /* ---------------------------------------------------------- the pier under the far end, and the bridge */
    const BW = 0.55;
    const zA = 1.2, zB = ZBAL + 4.2;
    const deckY = (z) => 0.2 * Math.sin(Math.PI * clamp((z + 3) / 30, 0, 1));
    const underY = (z) => deckY(z) - 0.6 - 7 * Math.pow(clamp((z - (zB - 12)) / 12, 0, 1), 2.6) - 5 * Math.pow(clamp((3 - z) / 8, 0, 1), 2);
    {
      OBJ = O.PIER;
      // the far landing stands on a crag of living rock that falls away into the glow
      const zc = zB + 0.6;
      const left = [], right = [];
      for (let y = -0.05; y > -70; y -= 0.9) {
        const d = -y;
        const wl = 2.4 + d * 0.025 + 0.9 * (nz(d / 6, 1.7) - 0.5) + (d % 11 < 1 ? 0.7 : 0);
        const wr = 2.4 + d * 0.04 + 1.2 * (nz(d / 5, 8.1) - 0.5) + (d % 13 < 1.2 ? 0.9 : 0);
        left.push([-wl, y, zc]); right.push([wr, y, zc]);
      }
      const crag = clipPoly(left.concat(right.reverse()));
      const cp = polyPath(crag);
      const g = tctx.createLinearGradient(0, B0[1], 0, SH);
      g.addColorStop(0, gray(0.95)); g.addColorStop(0.35, gray(0.8)); g.addColorStop(1, gray(0.5));
      tctx.fillStyle = g; tctx.fill(cp);
      F(cp, Math.PI / 2, R_PIER);
      // ledges and fissures on the crag
      tctx.save(); tctx.clip(cp);
      for (let i = 0; i < 16; i++) {
        const y = -RR(2, 60), x0 = -4, x1 = 4;
        const a = P(x0, y, zc), b = P(x1, y + RR(-1.5, 1.5), zc);
        tStroke([a, [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5) + RR(-4, 4)], b], RR(0.35, 0.6), RR(1.5, 4), 1.2, 0.6);
      }
      tctx.restore();
      // its right-hand edges catch the fire from below
      tStroke(right.map((q) => P(...q)).slice(4), 0.45, 5, 4, 0.6);
      L.pierFaces = [crag];
      const land = polyPath(clipPoly([[-3.6, 0, zB - 0.2], [3.6, 0, zB - 0.2], [3.6, 0, zB + 7], [-3.6, 0, zB + 7]]));
      tctx.fillStyle = gray(0.6); tctx.fill(land); F(land, 0, R_DECK);
    }
    OBJ = O.BRIDGE;
    const deckL = [], deckR = [], sideBot = [];
    for (let z = zA; z <= zB + 1e-6; z += 0.08) {
      const a = seg3([-BW, deckY(z), z], [BW, deckY(z), z]);
      if (!a) continue;
      deckL.push(a[0]); deckR.push(a[1]); sideBot.push(P(BW, underY(z), z));
    }
    L.deckL = deckL; L.deckR = deckR; L.sideBot = sideBot;
    {
      const deck = deckL.concat(deckR.slice().reverse());
      const side = deckR.concat(sideBot.slice().reverse());
      const sideP = polyPath(side), deckP = polyPath(deck);
      const g = tctx.createLinearGradient(W0[0] - 200, 0, B0[0], 0);
      g.addColorStop(0, gray(0.7)); g.addColorStop(0.55, gray(0.84)); g.addColorStop(1, gray(0.7));
      tctx.fillStyle = g; tctx.fill(sideP);
      F(sideP, 0, R_BSIDE);
      const g2 = tctx.createLinearGradient(W0[0] - 300, 0, B0[0], 0);
      g2.addColorStop(0, gray(0.55)); g2.addColorStop(0.3, gray(0.2)); g2.addColorStop(0.42, gray(0.12)); g2.addColorStop(0.7, gray(0.42)); g2.addColorStop(1, gray(0.3));
      tctx.fillStyle = g2; tctx.fill(deckP);
      F(deckP, 0, R_DECK);
      L.sideP = sideP; L.deckP = deckP;
      // the stones of the deck, laid in staggered courses two abreast; each a slightly different grey
      L.stones = [];
      let z = zA + 0.1, row = 0;
      tctx.save(); tctx.clip(deckP);
      while (z < zB - 0.15) {
        const len = RR(0.42, 0.6) * (1 + Math.max(0, z - 8) * 0.012);
        const zz = Math.min(zB, z + len);
        const xm = (row++ & 1 ? 0.12 : -0.1) + RR(-0.08, 0.08);
        const pieces = R() < 0.18 ? [[-BW, BW]] : [[-BW, xm], [xm, BW]];
        for (const [x0, x1] of pieces) {
          const st = { z0: z, z1: zz, x0, x1, dv: RR(-0.09, 0.09) };
          L.stones.push(st);
          const poly = clipPoly([[x0, deckY(z), z], [x1, deckY(z), z], [x1, deckY(zz), zz], [x0, deckY(zz), zz]]);
          if (poly.length > 2) { tctx.fillStyle = st.dv > 0 ? grayA(1, st.dv) : grayA(0, -st.dv); tctx.fill(polyPath(poly)); }
        }
        z = zz;
      }
      tctx.restore();
    }

    /* ---------------------------------------------------------- smoke: a column boiling up behind the demon */
    const billows = [];
    function billow(cx, cy, r, vTop, vBot, sq, lp) {
      OBJ = O.SMOKE;
      const idx = billows.length + 1;
      sq = sq || 1;
      billows.push({ cx, cy, r, sq });
      let gx0 = 0, gy0 = cy - r * sq, gx1 = 0, gy1 = cy + r * sq;
      if (lp) { const a = Math.atan2(lp[1] - cy, lp[0] - cx); gx1 = cx + Math.cos(a) * r; gy1 = cy + Math.sin(a) * r * sq; gx0 = cx - Math.cos(a) * r; gy0 = cy - Math.sin(a) * r * sq; }
      const g = tctx.createLinearGradient(gx0, gy0, gx1, gy1);
      g.addColorStop(0, gray(vTop)); g.addColorStop(0.6, gray(lerp(vTop, vBot, 0.55))); g.addColorStop(1, gray(vBot));
      const p = new Path2D(); p.ellipse(cx, cy, r, r * sq, 0, 0, TAU);
      tctx.fillStyle = g; tctx.fill(p);
      F(p, 0, R_SMOKE);
      octx2.fillStyle = 'rgb(' + (idx & 255) + ',' + (idx >> 8) + ',255)'; octx2.fill(p);
    }
    // smoke as a continuous, domain-warped density field: rolls and vortices rather than bubbles
    L.smokeFields = [];
    async function smokeField(o) {
      const ux0 = Math.max(0, o.x0), ux1 = Math.min(SW, o.x1), uy0 = Math.max(0, o.y0), uy1 = Math.min(SH, o.y1);
      const px0 = Math.floor(ux0 * hk), py0 = Math.floor(uy0 * hk), px1 = Math.ceil(ux1 * hk), py1 = Math.ceil(uy1 * hk);
      const W2 = px1 - px0, H2 = py1 - py0;
      if (W2 <= 2 || H2 <= 2) return;
      const Dn = new Float32Array(W2 * H2);
      const sc = o.scale || 60;
      for (let y = 0; y < H2; y++) {
        const v = (py0 + y + 0.5) / hk;
        for (let x = 0; x < W2; x++) {
          const u = (px0 + x + 0.5) / hk;
          const t = clamp((o.baseY - v) / (o.baseY - o.topY), -0.2, 1.2);
          const cxv = o.cx + o.drift * t + (nz(v / 140 + o.sd, 2.2) - 0.5) * o.w1 * 0.5;
          const hwid = lerp(o.w0, o.w1, clamp(t, 0, 1));
          // domain warp: the smoke curls on itself as it rises
          const wx = u / sc + 1.6 * (fbm(u / (sc * 2.2) + o.sd, v / (sc * 2.2) - t * 1.5, 3) - 0.5);
          const wy = v / sc + 1.6 * (fbm(u / (sc * 2.2) - 7 + o.sd, v / (sc * 2.2) + 3, 3) - 0.5) + t * 2.0;
          const n = fbm(wx, wy, 3);
          const roll = 1 - Math.abs(2 * nz(wx * 1.7 + 9, wy * 1.7) - 1);
          const ex = Math.abs(u - cxv) / hwid;
          const env = (1 - smooth(0.55, 1.05, ex + (n - 0.5) * 0.6)) * smooth(-0.15, 0.08, t) * (1 - smooth(0.92, 1.15, t + (n - 0.5) * 0.3));
          Dn[y * W2 + x] = env * (0.5 + 0.75 * n + 0.1 * roll);
        }
        if ((y & 7) === 0) await tick();
      }
      const timg = tctx.getImageData(px0, py0, W2, H2), fimg = fctx.getImageData(px0, py0, W2, H2), bimg = bctx.getImageData(px0, py0, W2, H2);
      const td = timg.data, fd = fimg.data, bd = bimg.data;
      for (let y = 1; y < H2 - 1; y++) {
        const v = (py0 + y + 0.5) / hk;
        for (let x = 1; x < W2 - 1; x++) {
          const i = y * W2 + x, d = Dn[i];
          const a = smooth(o.lo || 0.42, (o.lo || 0.42) + 0.12, d);
          if (a <= 0.01) continue;
          if (o.skip && o.skip(bd[i * 4])) continue;
          const u = (px0 + x + 0.5) / hk;
          const xa = Math.max(0, x - 4), xb = Math.min(W2 - 1, x + 4), ya = Math.max(0, y - 4), yb = Math.min(H2 - 1, y + 4);
          const gx = (Dn[y * W2 + xb] - Dn[y * W2 + xa]) / 4, gy = (Dn[yb * W2 + x] - Dn[ya * W2 + x]) / 4;
          const lit = o.lit(u, v);
          const fp = o.firePt(u, v);
          const fdx = fp[0] - u, fdy = fp[1] - v, fl = Math.hypot(fdx, fdy) || 1;
          // the side of each roll that faces the fire is lit; crowns away from it fall into shadow
          const facing = clamp(0.5 - (gx * fdx + gy * fdy) / fl * 18, 0, 1);
          const tone = clamp(o.dark - lit * (0.25 + 0.55 * facing) - 0.08 * (d - 0.6), 0.12, 0.98);
          const old = td[i * 4] / 255;
          const nv = 1 - tone;
          const tv = Math.round(255 * (old * (1 - a) + nv * a));
          td[i * 4] = td[i * 4 + 1] = td[i * 4 + 2] = tv;
          if (a > 0.5) { fd[i * 4] = 128; fd[i * 4 + 1] = 128; fd[i * 4 + 2] = R_SMOKE; bd[i * 4] = O.SMOKE; bd[i * 4 + 1] = 0; bd[i * 4 + 2] = 0; }
        }
        if ((y & 15) === 0) await tick();
      }
      tctx.putImageData(timg, px0, py0); fctx.putImageData(fimg, px0, py0); bctx.putImageData(bimg, px0, py0);
      L.smokeFields.push({ px0, py0, W2, H2, Dn, lo: o.lo || 0.42 });
    }
    {
      // "a great shadow": a dark column of smoke, lit only where it rolls over the fire
      const fireA = [B0[0] + 6 * bs, B0[1] - 124 * bs], fireB = [B0[0] - 4 * bs, B0[1] - 10 * bs];
      L.fireA = fireA; L.fireB = fireB;
      const litAt = (x, y) => Math.max(Math.exp(-((x - fireA[0]) ** 2 + (y - fireA[1]) ** 2) / (62 * bs) ** 2), Math.exp(-((x - fireB[0]) ** 2 + (y - fireB[1]) ** 2) / (52 * bs) ** 2));
      const nearest = (x, y) => (((x - fireA[0]) ** 2 + (y - fireA[1]) ** 2) < ((x - fireB[0]) ** 2 + (y - fireB[1]) ** 2) ? fireA : fireB);
      const notRift = (b) => b === O.RIFT || b === O.MOON || b === O.TOWER || b === O.BRIDGE;
      // the column behind the demon
      await smokeField({ cx: B0[0] + 14 * bs, baseY: B0[1] + 10 * bs, topY: -40, w0: 46 * bs, w1: 150 * bs, drift: 26 * bs, sd: 3.1, x0: B0[0] - 200 * bs, x1: SW, y0: 0, y1: B0[1] + 30 * bs,
        dark: 0.9, lit: litAt, firePt: nearest, skip: notRift, scale: 40 * bs });
    }

    /* ---------------------------------------------------------- the Balrog: geometry (bu: origin at its feet, 100 bu = 9.4 m) */
    const ell = (c, rx, ry, rot, n) => { n = n || 28; const out = []; const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0); for (let i = 0; i < n; i++) { const a = i / n * TAU; const x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push([c[0] + x * cr - y * sr, c[1] + x * sr + y * cr]); } return out; };
    const limb = (a, b, ra, rb, n) => {
      n = n || 10; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const out = [];
      for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + Math.PI * i / n; out.push([b[0] + Math.cos(ang + t) * rb, b[1] + Math.sin(ang + t) * rb]); }
      for (let i = 0; i <= n; i++) { const t = Math.PI / 2 + Math.PI * i / n; out.push([a[0] + Math.cos(ang + t) * ra, a[1] + Math.sin(ang + t) * ra]); }
      return out;
    };
    const axis = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
    // the pose: drawn up to a great height, head low and thrust forward on a bull neck;
    // the sword arm drives the flaming blade at the light, the far arm is raised with the whip
    const BP = {
      shN: [-26, -86], elbowN: [-42, -82], fistN: [-58, -87],
      shF: [22, -88], elbowF: [38, -95], fistF: [55, -106],
    };
    const mid = (a, b, t) => [lerp(a[0], b[0], t == null ? 0.5 : t), lerp(a[1], b[1], t == null ? 0.5 : t)];
    const BAL_SIL = [
      // skull and nape
      [-15, -106.5], [-9, -105.5], [-5, -102.5], [-3, -98.5], [1, -95.2],
      // the hump of the shoulders to the far shoulder
      [8, -93.6], [15, -93], [21, -92.4],
      // the far arm raised: top edge to the fist
      [28, -94.4], [34, -97.6], [40, -100.6], [46, -104.4], [50, -108.8], [54, -111.2], [58, -109.6], [58.4, -105], [55.6, -101.6],
      // underside of the far arm back to the armpit
      [50.6, -98.6], [44, -94.6], [37, -89.6], [30.6, -84.6], [25.6, -80.6],
      // far flank, narrowing to the waist
      [24.4, -73], [20.8, -64.4], [15.6, -56], [12.2, -49.4],
      // far hip and leg
      [18.4, -44], [23.4, -37], [25.4, -28.6], [24.6, -20.4], [25.6, -13], [24.4, -6.2], [29.6, -2.4], [29, 0.4], [20.6, 0.6], [16.6, -1.6],
      [15.6, -9], [14.4, -17.6], [11, -27], [4.6, -34.4], [0, -36],
      // near leg, striding forward
      [-4.4, -33.6], [-9.6, -25.4], [-13.4, -16.4], [-15.4, -8.4], [-16.6, -2.6], [-20, -0.2], [-29.4, 0.6], [-34, -0.6], [-31, -2.6],
      [-27.6, -4.4], [-26.6, -12], [-25, -21.6], [-23.6, -31.2], [-20.6, -40.6],
      // near flank to the armpit
      [-15.6, -48.4], [-19, -57.6], [-24.6, -66], [-30, -72.6],
      // the sword arm, underside out to the fist
      [-35.6, -75.6], [-41, -77.4], [-46.6, -80], [-52.4, -82.2], [-57.4, -82.4], [-62.2, -84.4], [-63.4, -88.6],
      // top of the sword arm back to the shoulder
      [-60, -91.6], [-54.4, -91.4], [-48.4, -89.2], [-42, -88.4], [-36, -90.2], [-30.2, -92],
      // throat and the open jaw
      [-25.6, -92], [-28.6, -92.2], [-32.4, -92.8], [-34.6, -94.2], [-33.4, -95.4], [-28.6, -96.4],
      // upper fangs, a short heavy muzzle, the overhanging brow
      [-33.8, -97.2], [-35.8, -98.4], [-34.8, -100.2], [-31.2, -101.2], [-28.8, -103.4], [-25.6, -104.4], [-21.4, -106.6], [-17.4, -107.6],
    ];
    const BAL_HORNS = [
      [[-17, -105.6], [-18.2, -114], [-23.6, -121.6], [-31.6, -125.4], [-39.4, -123.4], [-43.4, -117.6]],
      [[-10.6, -105], [-8.8, -113.6], [-11.2, -121.6], [-17.8, -127], [-25.4, -128.4], [-30.8, -125.4]],
    ];
    // anatomy as relief: [cx, cy, rx, ry, rotation, height] in bu; the silhouette is "inflated" and these
    // masses are raised on it, then lit by the staff (front left) and the fire (behind)
    const BAL_BUMPS = [
      [-15, -76, 12, 7.5, 0.3, 3.2], [7, -78, 11, 7, -0.25, 2.6],                     // pectorals
      [-28, -84, 7.5, 7, 0.5, 3.0], [21, -86, 7, 6.6, 0.3, 2.6],                      // deltoids
      [-36, -84, 8, 4.6, axis(BP.shN, BP.elbowN), 2.6], [-50, -85.5, 7, 3.6, axis(BP.elbowN, BP.fistN), 2.2],
      [30, -91.5, 8, 4.6, axis(BP.shF, BP.elbowF), 2.4], [46, -100.5, 7, 3.6, axis(BP.elbowF, BP.fistF), 2.0],
      [-58, -87, 4.4, 4.2, 0, 2.2], [55, -106, 4.2, 4, 0, 2.0],                         // fists
      [-8, -64, 5.6, 4.2, 0, 1.8], [3, -64, 5.6, 4.2, 0, 1.6], [-8, -57.4, 5.2, 3.6, 0, 1.6], [3, -57.4, 5.2, 3.6, 0, 1.4],
      [-7.6, -51, 5, 3.4, 0, 1.4], [2.6, -51, 5, 3.4, 0, 1.2],                          // abdomen
      [-21, -64, 4.4, 9, 0.35, 1.6], [16, -64, 4, 9, -0.3, 1.3],                       // obliques/serratus
      [4, -91, 13, 4.4, 0.1, 2.0],                                                      // trapezius hump
      [-15, -36, 7.6, 11, -0.35, 3.0], [13, -34, 7, 11, 0.3, 2.6],                      // thighs
      [-21, -22.6, 4.6, 3.6, 0, 1.6], [20, -21, 4.2, 3.4, 0, 1.4],                      // knees
      [-23, -13, 4.4, 6.4, 0.05, 2.0], [22, -12, 3.8, 6, -0.05, 1.6],                   // calves
      [-17, -96, 6, 6, 0, 2.4], [-25, -98.6, 6.6, 2.4, -0.25, 1.6], [-30, -97, 5.4, 3.2, -0.1, 1.4], [-28, -93.4, 6, 2.4, 0.15, 1.2], // skull, brow, muzzle, jaw
      [-10, -90, 6.4, 5.6, 0.6, 2.0],                                                   // neck
    ];
    const BAL_MUSCLE = [
      // [points, tone, width]: soft modelling strokes laid inside the black, clipped to it
      [[[-6, -72], [-15, -77], [-24, -80], [-30, -80]], 0.82, 7],
      [[[-4, -72], [5, -77], [14, -81], [21, -82]], 0.9, 6],
      [[BP.shN, BP.elbowN, BP.fistN], 0.78, 5],
      [[[-12, -60], [-4, -61], [6, -60]], 0.9, 4],
      [[[-11, -52], [-4, -53], [5, -52]], 0.9, 4],
      [[[-21, -38], [-22, -26], [-21, -14]], 0.86, 6],
    ];
    /* ---------------------------------------------------------- the Balrog: wings of shadow */
    function wingShape(side) {
      // a bat's plan: the arm runs from the shoulder to a wrist on the leading edge; fingers fan from the wrist
      // to the trailing edge, and the membrane is scalloped between them, fraying into smoke
      const L_ = side < 0;
      const root = L_ ? [0, -96] : [8, -94];
      const wrist = L_ ? (portrait ? [-36, -150] : [-42, -136]) : (portrait ? [56, -136] : [62, -122]);
      const tips = L_
        ? (portrait ? [[-92, -138], [-84, -122], [-70, -112], [-54, -106], [-38, -104], [-20, -104]] : [[-124, -120], [-108, -106], [-90, -99], [-70, -97], [-48, -99], [-22, -104]])
        : (portrait ? [[104, -124], [98, -108], [84, -96], [66, -88], [32, -80]] : [[128, -112], [120, -97], [102, -86], [80, -80], [34, -80]]);
      const lead = spline([root, [lerp(root[0], wrist[0], 0.5), lerp(root[1], wrist[1], 0.5) - 6], wrist, [lerp(wrist[0], tips[0][0], 0.5), lerp(wrist[1], tips[0][1], 0.5) - 4], tips[0]], false, 10);
      const trail = [];
      for (let i = 0; i < tips.length - 1; i++) {
        const A = tips[i], B = tips[i + 1];
        const d = Math.hypot(B[0] - A[0], B[1] - A[1]);
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
        const tr = Math.hypot(wrist[0] - mx, wrist[1] - my) || 1;
        const depth = d * RR(0.25, 0.38);
        const C = [mx + (wrist[0] - mx) / tr * depth, my + (wrist[1] - my) / tr * depth];
        const seg = spline([A, [lerp(A[0], C[0], 0.6) + (R() - 0.5) * 2, lerp(A[1], C[1], 0.6) + (R() - 0.5) * 2], C, [lerp(B[0], C[0], 0.6), lerp(B[1], C[1], 0.6)], B], false, 5);
        for (let j = i === 0 ? 0 : 1; j < seg.length; j++) trail.push(seg[j]);
      }
      trail.push(root);
      const outline = lead.concat(trail.slice(1));
      return { root, wrist, tip: tips[0], outline, fingers: tips.slice(0, -1), lead };
    }
    function wing(side) {
      OBJ = O.WING;
      const ws_ = wingShape(side);
      const W = BX(ws_.outline);
      const path = polyPath(W);
      const root = BX([ws_.root])[0];
      const g = tctx.createRadialGradient(root[0], root[1], 10, root[0], root[1], 110 * bs);
      g.addColorStop(0, gray(0.99)); g.addColorStop(0.6, gray(0.95)); g.addColorStop(1, gray(0.84));
      tctx.fillStyle = g; tctx.fill(path);
      const rid = side < 0 ? R_WING : R_WING2;
      F(path, Math.atan2(ws_.tip[1] - ws_.root[1], ws_.tip[0] - ws_.root[0]), rid);
      const wr = BX([ws_.wrist])[0], rpx = [IX + wr[0] * k, IY + wr[1] * k];
      REG[rid].fn = (x, y) => Math.atan2(y - rpx[1], x - rpx[0]) + 0.12 * (nz(x / 90, y / 90) - 0.5);
      fctx.save(); fctx.clip(path);
      const bones = [];
      bones.push(BX(spline([ws_.root, [lerp(ws_.root[0], ws_.wrist[0], 0.5), lerp(ws_.root[1], ws_.wrist[1], 0.5) - 5], ws_.wrist], false, 8)));
      for (const fp of ws_.fingers.slice(1)) {
        const bone = [ws_.wrist, [lerp(ws_.wrist[0], fp[0], 0.4) + side * 2, lerp(ws_.wrist[1], fp[1], 0.4)], [lerp(ws_.wrist[0], fp[0], 0.75), lerp(ws_.wrist[1], fp[1], 0.75)], fp];
        const bp = BX(spline(bone, false, 8));
        bones.push(bp);
        void bp;
      }
      fctx.restore();
      // the membrane thins toward the trailing edge: fire-lit smoke glimmers through
      tctx.save(); tctx.clip(path);
      for (let i = 1; i < bones.length; i++) {
        const a = bones[i - 1], b = bones[i];
        const mid = a.slice(Math.floor(a.length * 0.55)).map((p, j) => { const q = b[Math.min(b.length - 1, Math.floor(b.length * 0.55) + j)]; return [lerp(p[0], q[0], 0.5), lerp(p[1], q[1], 0.5)]; });
        void mid;
      }
      for (const bp of bones) tStroke(bp, 0.99, 3 * bs, 1.5 * bs, 0.9);
      tctx.restore();
      return { W, bones, path, lead: BX(ws_.lead) };
    }
    L.wingL = wing(-1);
    if (debug) { const W = L.wingL.W; const bb = W.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]); console.warn('[bridge] wingL bbox', bb.map(Math.round).join(','), 'n', W.length, 'B0', B0.map(Math.round).join(','), 'bs', bs.toFixed(2)); }
    L.wingR = wing(1);

    /* ---------------------------------------------------------- fire: the mane (behind the body) */
    const flames = [];
    function tongue(x, y, ang, len, wid, opt) {
      opt = opt || {};
      OBJ = O.FIRE;
      const n = 26, ph = R() * TAU, fr = RR(1.0, 2.0), bend = opt.bend == null ? RR(-0.5, 0.5) : opt.bend, amp = opt.amp == null ? 0.12 : opt.amp;
      const base = [];
      let px = x, py = y;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const a = ang + bend * t * t;
        if (i) { px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; }
        base.push([px, py, a, t]);
      }
      const pts = base.map(([bx, by, a, t]) => { const o = Math.sin(t * fr * TAU + ph) * amp * len * t; return [bx - Math.sin(a) * o, by + Math.cos(a) * o]; });
      const wf = (f) => wid * (f < 0.12 ? 0.55 + 0.45 * smooth(0, 0.12, f) : 1) * Math.pow(1 - f, 0.9);
      const outline = offsetLine(pts, (f) => wf(f)).concat(offsetLine(pts, (f) => -wf(f)).reverse());
      const fl = { pts, outline, wid, len, opt };
      flames.push(fl);
      const path = polyPath(outline);
      tctx.fillStyle = gray(opt.v != null ? opt.v : 0.03); tctx.fill(path);
      F(path, ang, R_FIRE);
      if (opt.fork && len > 18 * bs && R() < 0.45) {
        const at = pts[Math.floor(pts.length * RR(0.35, 0.6))];
        tongue(at[0], at[1], ang + (R() < 0.5 ? -1 : 1) * RR(0.3, 0.6), len * RR(0.3, 0.5), wid * 0.55, Object.assign({}, opt, { fork: false }));
      }
      return fl;
    }
    function fireMass(pts, w, v) {
      OBJ = O.FIRE; tStroke(pts, Math.max(v, 0.22), w, w * 0.45, 0.85);
      bctx.save(); bctx.lineWidth = w * 1.15; bctx.lineCap = 'round'; bctx.lineJoin = 'round'; bctx.strokeStyle = 'rgb(' + O.FIRE + ',0,0)'; bctx.stroke(polyPath(pts, true)); bctx.restore();
      fctx.save(); fctx.lineWidth = w * 1.15; fctx.lineCap = 'round'; fctx.lineJoin = 'round';
      fctx.strokeStyle = flowc(Math.atan2(pts[pts.length - 1][1] - pts[0][1], pts[pts.length - 1][0] - pts[0][0]), R_FIRE); fctx.stroke(polyPath(pts, true)); fctx.restore();
    }
    {
      // the mane: fire streaming up and back from skull, nape and hump, like hair in a gale
      // a burst of flame behind the head, so the horned skull stands black against it
      const roots = [[-20, -105.6], [-15.6, -106.2], [-11, -105], [-6.6, -102.8], [-3.6, -99], [0.6, -95.6], [6, -94], [12, -93.2], [18, -92.6], [24, -92.4]];
      L.maneMass = BX(spline([[-16, -104], [-6, -114], [8, -124], [24, -132], [42, -138]], false, 8));
      fireMass(L.maneMass, 22 * bs, 0.08);
      for (let pass = 0; pass < 3; pass++) {
        for (const r of roots) {
          const [x, y] = BX([(r[0] < -2 ? HT(r) : r).map((q) => q + RR(-1.5, 1.5))])[0];
          const ang = -1.2 + RR(-0.3, 0.3) + (r[0] + 5) / 80;
          const len = RR(26, 66) * bs * (pass === 0 ? 1 : pass === 1 ? 0.7 : 0.42);
          tongue(x, y, ang, len, RR(1.5, 3.4) * bs, { bend: RR(0.15, 0.8), amp: RR(0.06, 0.16), mane: true, fork: true });
        }
      }
      // the bridge burns where it stands: a sheet of flame behind its legs
      L.footMass = BX(spline([[-48, -6], [-30, -14], [-6, -18], [18, -14], [36, -6]], false, 8));
      fireMass(L.footMass, 9 * bs, 0.3);
      for (let i = 0; i < 40; i++) {
        const t = R();
        const [x, y] = BX([[lerp(-50, 40, t), RR(-4, 3)]])[0];
        const tall = 0.45 + Math.sin(t * Math.PI) * RR(0.5, 1.1);
        tongue(x, y, -Math.PI / 2 + RR(-0.35, 0.35) + (t - 0.5) * 0.5, RR(16, 40) * bs * tall, RR(1.4, 3.0) * bs, { bend: RR(-0.8, 0.8), amp: RR(0.1, 0.2), foot: true, fork: true });
      }
    }

    // inflate a silhouette into relief, raise muscle masses on it, light it and lay cross-contour flow
    async function shadeRelief(path, poly, bumps) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of poly) { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; }
      const px0 = Math.max(0, Math.floor(x0 * hk) - 2), py0 = Math.max(0, Math.floor(y0 * hk) - 2);
      const px1 = Math.min(hw - 1, Math.ceil(x1 * hk) + 2), py1 = Math.min(hh - 1, Math.ceil(y1 * hk) + 2);
      const W2 = px1 - px0 + 1, H2 = py1 - py0 + 1;
      const mc = mkCanvas(W2, H2), mx = cpu(mc);
      mx.setTransform(hk, 0, 0, hk, -px0, -py0); mx.fillStyle = '#fff'; mx.fill(path);
      const md = mx.getImageData(0, 0, W2, H2).data;
      const INF = 1e6, D = new Float32Array(W2 * H2);
      for (let i = 0; i < W2 * H2; i++) D[i] = md[i * 4 + 3] > 127 ? INF : 0;
      // chamfer distance (3-4), two passes
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
        const i = y * W2 + x; if (!D[i]) continue;
        let v = D[i];
        if (x > 0) v = Math.min(v, D[i - 1] + 3);
        if (y > 0) { v = Math.min(v, D[i - W2] + 3); if (x > 0) v = Math.min(v, D[i - W2 - 1] + 4); if (x < W2 - 1) v = Math.min(v, D[i - W2 + 1] + 4); }
        if (x === 0 || y === 0 || x === W2 - 1 || y === H2 - 1) v = Math.min(v, 3);
        D[i] = v;
      }
      for (let y = H2 - 1; y >= 0; y--) for (let x = W2 - 1; x >= 0; x--) {
        const i = y * W2 + x; if (!D[i]) continue;
        let v = D[i];
        if (x < W2 - 1) v = Math.min(v, D[i + 1] + 3);
        if (y < H2 - 1) { v = Math.min(v, D[i + W2] + 3); if (x < W2 - 1) v = Math.min(v, D[i + W2 + 1] + 4); if (x > 0) v = Math.min(v, D[i + W2 - 1] + 4); }
        D[i] = v;
      }
      await tick();
      const pxPerBu = bs * hk;
      const Hh = new Float32Array(W2 * H2);
      for (let i = 0; i < W2 * H2; i++) { if (!D[i]) continue; const d = D[i] / 3 / pxPerBu; Hh[i] = Math.sqrt(Math.min(d, 9) * 9) * 0.9; }
      for (const [cx, cy, rx, ry, rot, ht] of bumps) {
        const c = BX([[cx, cy]])[0];
        const ccx = c[0] * hk - px0, ccy = c[1] * hk - py0;
        const RX = rx * pxPerBu, RY = ry * pxPerBu * (46 / 56), cr = Math.cos(rot), sr = Math.sin(rot), rm = Math.max(RX, RY);
        for (let y = Math.max(0, Math.floor(ccy - rm)); y < Math.min(H2, Math.ceil(ccy + rm)); y++) for (let x = Math.max(0, Math.floor(ccx - rm)); x < Math.min(W2, Math.ceil(ccx + rm)); x++) {
          const i = y * W2 + x; if (!D[i]) continue;
          const dx = x - ccx, dy = y - ccy;
          const u = (dx * cr + dy * sr) / RX, v = (-dx * sr + dy * cr) / RY;
          const r2 = u * u + v * v;
          if (r2 < 1) Hh[i] += ht * (1 - r2) * (1 - r2);
        }
      }
      await tick();
      const timg = tctx.getImageData(px0, py0, W2, H2), fimg = fctx.getImageData(px0, py0, W2, H2), bimg = bctx.getImageData(px0, py0, W2, H2), wimg = wctx.getImageData(px0, py0, W2, H2);
      const td = timg.data, fd = fimg.data, bd = bimg.data, wd = wimg.data;
      const [bx, by] = L.blaze;
      for (let y = 1; y < H2 - 1; y++) {
        for (let x = 1; x < W2 - 1; x++) {
          const i = y * W2 + x; if (!D[i]) continue;
          const u = (px0 + x + 0.5) / hk, v = (py0 + y + 0.5) / hk;
          const gx = (Hh[i + 1] - Hh[i - 1]) * pxPerBu * 0.5, gy = (Hh[i + W2] - Hh[i - W2]) * pxPerBu * 0.5;
          let nx = -gx, ny = -gy, nzz = 1; const nl = Math.hypot(nx, ny, nzz); nx /= nl; ny /= nl; nzz /= nl;
          // the staff: cold light from in front and to the left
          let lx = bx - u, ly = by - v, lz = 260; const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
          const dif = Math.max(0, nx * lx + ny * ly + nzz * lz);
          // the fire: from behind, catching the turning edges
          const fp = (v < B0[1] - 60 * bs) ? L.fireA : L.fireB;
          let fx = fp[0] - u, fy = fp[1] - v; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
          const rim = Math.max(0, nx * fx + ny * fy) * (1 - nzz) * 2.2;
          const tone = clamp(0.99 - 0.42 * Math.pow(dif, 2.4) - 0.42 * rim, 0.35, 0.99);
          const tv = Math.round(255 * (1 - tone));
          td[i * 4] = td[i * 4 + 1] = td[i * 4 + 2] = tv;
          const gm = Math.hypot(gx, gy);
          const th = gm > 0.02 ? Math.atan2(gy, gx) + Math.PI / 2 : -0.85;
          fd[i * 4] = Math.round(128 + 127 * Math.cos(2 * th)); fd[i * 4 + 1] = Math.round(128 + 127 * Math.sin(2 * th)); fd[i * 4 + 2] = R_BAL;
          bd[i * 4] = O.BAL; bd[i * 4 + 1] = 0; bd[i * 4 + 2] = 0;
          if (rim > 0.08) { const r = Math.min(1, rim); wd[i * 4] = Math.min(255, wd[i * 4] + 120 * r); wd[i * 4 + 1] = Math.min(255, wd[i * 4 + 1] + 200 * r); wd[i * 4 + 2] = Math.min(255, wd[i * 4 + 2] + 90 * r); }
        }
        if ((y & 15) === 0) await tick();
      }
      tctx.putImageData(timg, px0, py0); fctx.putImageData(fimg, px0, py0); bctx.putImageData(bimg, px0, py0); wctx.putImageData(wimg, px0, py0);
    }

    /* ---------------------------------------------------------- the Balrog: body */
    const balShapes = {};
    {
      OBJ = O.BAL;
      const sil = BX(spline(BAL_SIL.map((q) => (q[1] < -92.1 && q[0] > -40 && q[0] < -2 ? HT(q) : q)), true, 5));
      balShapes.sil = sil;
      const silP = polyPath(sil);
      L.balClip = silP;
      await shadeRelief(silP, sil, BAL_BUMPS.map((q) => (q[1] < -92 && q[0] < -12 ? HT([q[0], q[1]]).concat([q[2] * 0.78, q[3] * 0.78, q[4], q[5] * 0.8]) : q)));
      // horns: ridged, curling forward
      balShapes.horns = [];
      for (const hc of BAL_HORNS) {
        const h = BXH(spline(hc, false, 8));
        const outline = offsetLine(h, (f) => (1 - Math.pow(f, 0.8) * 0.92) * 3.4 * bs).concat(offsetLine(h, (f) => -(1 - Math.pow(f, 0.8) * 0.92) * 3.4 * bs).reverse());
        const hp = polyPath(outline);
        const g = tctx.createLinearGradient(h[0][0], h[0][1], h[h.length - 1][0], h[h.length - 1][1]);
        g.addColorStop(0, gray(0.95)); g.addColorStop(1, gray(0.75));
        tctx.fillStyle = g; tctx.fill(hp);
        F(hp, 0, R_HORN);
        fctx.save(); fctx.clip(hp); flowAlong(h, R_HORN, 12 * bs, Math.PI / 2); fctx.restore();
        balShapes.horns.push({ h, outline });
      }
    }

    /* ---------------------------------------------------------- fire about the feet, the sword, the whip */
    {
      // low smoke rolling over the deck in front of its feet, and small flames before it
      OBJ = O.FIRE;
      for (let i = 0; i < 16; i++) {
        const t = R();
        const [x, y] = BX([[lerp(-46, 38, t), RR(0, 5)]])[0];
        tongue(x, y, -Math.PI / 2 + RR(-0.45, 0.45), RR(6, 16) * bs, RR(1.0, 2.0) * bs, { bend: RR(-0.8, 0.8), amp: RR(0.1, 0.22), foot: true });
      }
    }
    // the sword: a blade of flame brought down against the light
    {
      const hilt = BX([[BP.fistN[0] - 2, BP.fistN[1] + 1]])[0];
      const to = L.blaze;
      const dx = to[0] - hilt[0], dy = to[1] - hilt[1], dist = Math.hypot(dx, dy);
      const len = Math.min(dist * 0.78, 64 * bs);
      const ang = Math.atan2(dy, dx) - 0.08;
      const tip = [hilt[0] + Math.cos(ang) * len, hilt[1] + Math.sin(ang) * len];
      L.sword = { hilt, tip, ang, len };
      L.clash = [lerp(tip[0], to[0], 0.45), lerp(tip[1], to[1], 0.45)];
      const nx = -Math.sin(ang), ny = Math.cos(ang), bw = 1.7 * bs;
      const blade = [[hilt[0] + nx * bw, hilt[1] + ny * bw], [lerp(hilt[0], tip[0], 0.86) + nx * bw * 0.8, lerp(hilt[1], tip[1], 0.86) + ny * bw * 0.8], tip, [lerp(hilt[0], tip[0], 0.86) - nx * bw * 0.8, lerp(hilt[1], tip[1], 0.86) - ny * bw * 0.8], [hilt[0] - nx * bw, hilt[1] - ny * bw]];
      OBJ = O.FIRE;
      fireMass([hilt, tip], 7 * bs, 0.18);
      const bp = polyPath(blade); tctx.fillStyle = gray(0.0); tctx.fill(bp); F(bp, ang, R_FIRE);
      L.blade = blade;
      // flames stream off the blade, back along the swing
      for (let i = 0; i < 22; i++) {
        const t = RR(0.05, 0.97);
        const x = lerp(hilt[0], tip[0], t) + nx * RR(-1, 1) * bw, y = lerp(hilt[1], tip[1], t) + ny * RR(-1, 1) * bw;
        tongue(x, y, ang + Math.PI + RR(-0.25, 0.25) - 0.75, RR(10, 28) * bs * (1.15 - t * 0.6), RR(1.2, 2.6) * bs, { bend: RR(-0.5, 0.2), amp: 0.1, sword: true });
      }
    }
    // the whip: thongs lashing out, coiling low along the bridge toward the wizard
    {
      const fist = BX([[BP.fistF[0] + 2, BP.fistF[1] - 3]])[0];
      L.whip = [];
      const nT = 4;
      for (let i = 0; i < nT; i++) {
        const s0 = (i - (nT - 1) / 2) / ((nT - 1) / 2);
        // swung back, the thongs fall in long loops across the dark of the far wing
        const ctrl = [[0, 0], [8 + s0 * 2, -6 - s0 * 3], [18 + s0 * 4, -4 - s0 * 3], [26 + s0 * 5, 6 + s0 * 1], [24 + s0 * 7, 20 + s0 * 3], [14 + s0 * 8, 30 + s0 * 5], [8 + s0 * 10, 42 + s0 * 7], [14 + s0 * 12 + RR(-3, 3), 54 + s0 * 8 + RR(-3, 3)]];
        if (i % 2 === 0) { const e = ctrl[ctrl.length - 1]; ctrl.push([e[0] + 6, e[1] + 2], [e[0] + 8, e[1] - 4], [e[0] + 3, e[1] - 7]); }
        const pts = ctrl.map(([x, y]) => [fist[0] + (x + RR(-2, 2)) * bs, fist[1] + (y + RR(-2, 2)) * bs]);
        L.whip.push(spline(pts, false, 10));
      }
      OBJ = O.FIRE;
      for (const th of L.whip) tStroke(th, 0.12, 1.1 * bs, 0.8 * bs, 0.5);
      // sparks of flame along the thongs
      L.whipFlecks = [];
      for (const th of L.whip) {
        for (let j = 6; j < th.length - 4; j += 5) {
          if (R() < 0.82) continue;
          const p = th[j], q = th[j + 1];
          const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + (R() < 0.5 ? -1 : 1) * RR(1.8, 2.6);
          L.whipFlecks.push(tongue(p[0], p[1], a, RR(3, 8) * bs, RR(0.6, 1.1) * bs, { bend: RR(-0.6, 0.6), amp: 0.14, fleck: true }));
        }
      }
    }

    /* ---------------------------------------------------------- near pillars (framing) */
    for (const pl of pillars) if (pl.near) drawPillar(pl, pl.idx);

    /* ---------------------------------------------------------- the wizard (wu: origin between his feet, 100 wu = 1.85 m) */
    const wizShapes = {};
    {
      OBJ = O.WIZ;
      const S = (pts, per) => WX(spline(pts, true, per || 6));
      wizShapes.cloak = S([[3, -86], [10, -85], [15, -82.5], [19, -78.5], [22, -73], [26, -68], [30, -64.5], [33, -62], [31, -58], [27, -55], [26, -46], [27, -34], [28.5, -22], [30.5, -10], [32, -2.5],
        [27, -1], [22, -2.5], [17, -0.5], [12, -2.2], [6, -0.6], [0, -2], [-6, -0.8], [-12, -2.6], [-18, -1.4], [-24, -4], [-30, -6.5],
        [-37, -9], [-45, -12.5], [-53, -17], [-60, -20], [-64, -24], [-58, -25.5], [-62, -30], [-54, -31], [-48, -36],
        [-42, -44], [-36, -53], [-30, -61], [-25, -68], [-20, -74], [-16, -79], [-11, -83.5], [-5, -86]]);
      wizShapes.sleeveL = S([[-12, -83], [-13, -90], [-16, -97], [-19.5, -103], [-23, -108.5], [-27.5, -107], [-32.5, -109], [-33.2, -104], [-33.6, -98], [-37.5, -91.5], [-34.2, -88.4], [-30, -81], [-22, -77]]);
      wizShapes.forearmL = S([[-23, -108], [-25.5, -114], [-28.5, -120.5], [-33.5, -120.5], [-32.5, -114], [-32.5, -108.5]], 5);
      wizShapes.sleeveMouth = S([[-22.8, -108.2], [-27.5, -106.2], [-32.8, -108.6], [-27.5, -110.6]], 5);
      wizShapes.sleeveR = S([[14, -82], [20, -80], [26, -75], [31, -70], [36, -67.5], [40, -67], [41.5, -63], [38.5, -60], [34, -57], [33, -50], [29, -46], [26, -51], [26, -57], [22, -63], [18, -69]]);
      wizShapes.handL = S([[-28, -120], [-28.6, -126], [-32.2, -128.6], [-36, -126.4], [-35.6, -121], [-32, -119.6]], 5);
      wizShapes.handR = S([[40.5, -68.5], [44.5, -70], [47.5, -67.5], [46.5, -63], [42, -62.5]], 5);
      wizShapes.hood = S([[-12, -84], [-4, -86.5], [6, -86.5], [13, -84], [13, -79], [6, -77.5], [-3, -78], [-11, -80]]);
      wizShapes.hair = S([[-10, -96], [-4, -97], [4, -97], [9, -95], [11, -91], [11, -86], [9, -82], [4, -80], [-3, -80.5], [-9, -81.5], [-15, -81], [-21, -80.2], [-27, -79.6], [-23, -82], [-28, -82.6], [-20, -85], [-14, -88], [-11, -92]], 6);
      wizShapes.beard = S([[-11, -88], [-17, -88.2], [-24, -87.4], [-31, -87.2], [-37, -88.2], [-32, -86.2], [-25, -85.6], [-18, -85.8], [-12, -86.2]], 6);
      wizShapes.brim = S([[-19, -96], [-12, -98.3], [0, -99.2], [12, -98.4], [18, -96.6], [14, -95], [3, -94.4], [-8, -94.6], [-15, -95.2]], 6);
      wizShapes.crown = S([[-9, -98.6], [-9.6, -106], [-11, -114], [-13.2, -121], [-16, -128], [-19, -133.5], [-22.5, -136], [-24.5, -135], [-21, -131], [-16, -124], [-10, -116], [-4, -108], [2, -102], [8, -99]], 6);
      wizShapes.bootR = S([[4, -3], [10, -4], [15, -2.5], [16, 1], [10, 2], [3, 1.4], [1, -0.5]], 5);
      wizShapes.bootL = S([[17, -8], [23, -9.5], [29, -8.5], [30, -6], [24, -5], [18, -5.5]], 5);
      wizShapes.staff = WX(spline([[-26, -92], [-28.5, -108], [-32, -124], [-35.5, -142], [-39.5, -163], [-43, -184]], false, 10));
      wizShapes.sword = { a: WX([[47, -66]])[0], b: WX([[88, -104]])[0] };
      const apex = WX([[0, -96]])[0];
      L.wizApex = apex;
      REG[R_CLOAK].fn = (x, y) => Math.atan2(y - (IY + apex[1] * k), x - (IX + apex[0] * k));
      const crownTip = WX([[-22, -135]])[0], crownBase = WX([[0, -99]])[0];
      REG[R_HAT].fn = null;

      // the cloak: backlit, darkest low down, the light grazing the shoulders and the side under the raised arm
      const cloakP = polyPath(wizShapes.cloak);
      {
        const g = tctx.createLinearGradient(W0[0] - 40 * ws, W0[1] - 92 * ws, W0[0] + 20 * ws, W0[1] - 5 * ws);
        g.addColorStop(0, gray(0.5)); g.addColorStop(0.25, gray(0.68)); g.addColorStop(0.6, gray(0.8)); g.addColorStop(1, gray(0.88));
        tctx.fillStyle = g; tctx.fill(cloakP);
        F(cloakP, Math.PI / 2, R_CLOAK);
      }
      const folds = [
        [[-18, -74], [-13, -62], [-8, -48], [-5, -32], [-4, -16], [-5, -2]],
        [[-22, -69], [-20, -55], [-18, -40], [-17, -24], [-17, -4]],
        [[-26, -63], [-31, -51], [-38, -38], [-47, -27], [-57, -21]],
        [[-31, -56], [-37, -46], [-45, -36], [-54, -30]],
        [[3, -80], [3, -64], [2, -48], [1, -30], [1, -12], [1, -2]],
        [[11, -80], [12, -64], [13, -46], [14, -28], [15, -3]],
        [[18, -75], [19, -60], [20, -44], [22, -26], [23, -3]],
        [[26, -54], [25, -42], [25, -28], [26, -14], [27, -3]],
        [[-9, -82], [-9, -70], [-11, -56]],
      ];
      L.folds = folds.map((f) => WX(spline(f, false, 8)));
      tctx.save(); tctx.clip(cloakP);
      for (const fp of L.folds) {
        tStroke(offsetLine(fp, 1.8 * ws), 0.95, 2.2 * ws, 1.4 * ws, 0.75);
        tStroke(offsetLine(fp, -1.8 * ws), 0.45, 1.6 * ws, 1.4 * ws, 0.45);
      }
      tStroke(WX(spline([[-34, -8], [-12, -4], [10, -3], [32, -4]], false, 6)), 0.96, 5 * ws, 3 * ws, 0.7);
      tStroke(WX(spline([[-30, -60], [-36, -52], [-42, -44], [-50, -35]], false, 6)), 0.3, 2.5 * ws, 2 * ws, 0.5);
      tctx.restore();
      // the raised sleeve: falls from the wrist in heavy folds; the lit edge faces the staff
      const sL = polyPath(wizShapes.sleeveL);
      {
        const g = tctx.createLinearGradient(W0[0] - 20 * ws, W0[1] - 110 * ws, W0[0] - 42 * ws, W0[1] - 90 * ws);
        g.addColorStop(0, gray(0.62)); g.addColorStop(0.4, gray(0.8)); g.addColorStop(1, gray(0.9));
        tctx.fillStyle = g; tctx.fill(sL);
        F(sL, -1.25, R_SLEEVE);
        fctx.save(); fctx.clip(sL);
        for (const fl of [[[-14, -82], [-16, -92], [-20, -100], [-24, -107]], [[-24, -78], [-30, -88], [-33, -98], [-31, -106]], [[-33, -80], [-38, -88], [-38, -97], [-35, -104]]]) flowAlong(WX(spline(fl, false, 6)), R_SLEEVE, 9 * ws);
        fctx.restore();
        L.sleeveFolds = [[[-15, -85], [-17, -94], [-21, -103]], [[-24, -80], [-30, -90], [-32, -100], [-30, -107]], [[-32, -82], [-37.5, -90], [-37.5, -98]], [[26, -60], [29, -54], [30, -48]], [[18, -74], [24, -70], [30, -66]]].map((f) => WX(spline(f, false, 6)));
      }
      const sR = polyPath(wizShapes.sleeveR);
      { const g = tctx.createLinearGradient(W0[0] + 14 * ws, W0[1] - 82 * ws, W0[0] + 34 * ws, W0[1] - 50 * ws); g.addColorStop(0, gray(0.7)); g.addColorStop(1, gray(0.9)); tctx.fillStyle = g; tctx.fill(sR); F(sR, 0.6, R_SLEEVE); }
      const fl = (nm, v, rid, th) => { const p = polyPath(wizShapes[nm]); tctx.fillStyle = typeof v === 'number' ? gray(v) : v; tctx.fill(p); F(p, th, rid); };
      fl('forearmL', 0.55, R_SKIN, -1.1);
      fl('sleeveMouth', 0.95, R_SLEEVE, 0);
      fl('hood', 0.86, R_CLOAK, 0.2);
      {
        const g = tctx.createLinearGradient(W0[0] - 30 * ws, W0[1] - 84 * ws, W0[0] + 12 * ws, W0[1] - 84 * ws);
        g.addColorStop(0, gray(0.5)); g.addColorStop(0.5, gray(0.62)); g.addColorStop(1, gray(0.8));
        fl('hair', g, R_HAIR, -0.12);
      }
      fl('beard', 0.5, R_HAIR, 3.1);
      fl('handL', 0.45, R_SKIN, 0.8);
      fl('handR', 0.7, R_SKIN, 0.8);
      fl('bootR', 0.92, R_SKIN, 0.2);
      fl('bootL', 0.9, R_SKIN, 0.2);
      // the hat: crown dark, its left flank catching the blaze; the brim's underside in shadow
      const crP = polyPath(wizShapes.crown), brP = polyPath(wizShapes.brim);
      {
        const g = tctx.createLinearGradient(W0[0] - 26 * ws, W0[1] - 112 * ws, W0[0] + 4 * ws, W0[1] - 106 * ws);
        g.addColorStop(0, gray(0.55)); g.addColorStop(0.18, gray(0.8)); g.addColorStop(1, gray(0.9));
        tctx.fillStyle = g; tctx.fill(crP);
        F(crP, Math.atan2(crownTip[1] - crownBase[1], crownTip[0] - crownBase[0]), R_HAT);
        tctx.fillStyle = gray(0.92); tctx.fill(brP); F(brP, -0.04, R_HAT);
      }
      OBJ = O.STAFF;
      tStroke(wizShapes.staff, 0.82, 2.0 * ws, 0);
      fctx.save(); fctx.lineWidth = 2.0 * ws; fctx.strokeStyle = flowc(0.2, R_STAFF); fctx.stroke(polyPath(wizShapes.staff, true)); fctx.restore();
      bctx.save(); bctx.lineWidth = 2.0 * ws; bctx.strokeStyle = 'rgb(' + O.STAFF + ',0,0)'; bctx.stroke(polyPath(wizShapes.staff, true)); bctx.restore();
      OBJ = O.SWORD;
      {
        const { a, b } = wizShapes.sword;
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang), ny = Math.cos(ang), w = 1.2 * ws;
        const bl = [[a[0] + nx * w, a[1] + ny * w], [lerp(a[0], b[0], 0.9) + nx * w * 0.8, lerp(a[1], b[1], 0.9) + ny * w * 0.8], [b[0], b[1]], [lerp(a[0], b[0], 0.9) - nx * w * 0.8, lerp(a[1], b[1], 0.9) - ny * w * 0.8], [a[0] - nx * w, a[1] - ny * w]];
        wizShapes.blade = bl;
        const bp = polyPath(bl); tctx.fillStyle = gray(0.02); tctx.fill(bp); F(bp, ang, R_STEEL);
      }
    }

    /* ---------------------------------------------------------- sparks where light meets flame */
    L.sparks = [];
    {
      const c0 = L.clash;
      for (let i = 0; i < 90; i++) {
        const a = R() * TAU, d = Math.pow(R(), 2.2) * 120;
        const x = c0[0] + Math.cos(a) * d * 1.2, y = c0[1] + Math.sin(a) * d * 0.9;
        if (pointInPoly(x, y, rift)) continue;
        L.sparks.push([x, y, RR(0.5, 1.7), a]);
      }
      for (let i = 0; i < 90; i++) {
        const x = B0[0] + RR(-110, 150) * bs, y = B0[1] + RR(-170, 10) * bs;
        L.sparks.push([x, y, RR(0.5, 1.6), -Math.PI / 2 + RR(-0.4, 0.8)]);
      }
    }
    stamp('painted');

    /* ================================================================ READ MAPS, SMOKE FLOW, LIGHTS */
    const T = new Float32Array(hw * hh), C2 = new Float32Array(hw * hh), S2 = new Float32Array(hw * hh), RID = new Uint8Array(hw * hh);
    OIDA = new Uint8Array(hw * hh);
    {
      const td = tctx.getImageData(0, 0, hw, hh).data;
      const fd = fctx.getImageData(0, 0, hw, hh).data;
      const od = octx2.getImageData(0, 0, hw, hh).data;
      const bd = bctx.getImageData(0, 0, hw, hh).data;
      for (let i = 0, j = 0; i < hw * hh; i++, j += 4) {
        T[i] = 1 - td[j] / 255;
        OIDA[i] = bd[j];
        let c = (fd[j] - 128) / 127, s = (fd[j + 1] - 128) / 127;
        const id = fd[j + 2];
        RID[i] = id;
        if (id === R_SMOKE && od[j + 2] > 200) {
          const b = billows[od[j] + (od[j + 1] << 8) - 1];
          if (b) {
            const x = ((i % hw) + 0.5) / hk, y = (((i / hw) | 0) + 0.5) / hk;
            const dx = clamp((x - b.cx) / b.r, -0.97, 0.97);
            const dy = (y - b.cy) / (b.r * b.sq);
            // cross-contour arcs over each billow, like latitudes seen from below
            const th = Math.atan(0.7 * dx / Math.sqrt(1 - dx * dx)) * (0.6 + 0.4 * clamp(1 - dy, 0, 1));
            c = Math.cos(2 * th); s = Math.sin(2 * th);
          }
        }
        C2[i] = c; S2[i] = s;
        if ((i & 0x3ffff) === 0) await tick();
      }
      // smoke is hatched along its iso-tones, so the lines wrap each billow's light and shade
      const Bt = new Float32Array(hw * hh), tmp = new Float32Array(hw * hh);
      const rad = Math.max(3, Math.round(11 * hk));
      for (let y = 0; y < hh; y++) { let acc = 0; const row = y * hw; for (let x = -rad; x < hw; x++) { if (x + rad < hw) acc += T[row + x + rad]; if (x - rad - 1 >= 0) acc -= T[row + x - rad - 1]; if (x >= 0) tmp[row + x] = acc / (2 * rad + 1); } }
      await tick();
      for (let x = 0; x < hw; x++) { let acc = 0; for (let y = -rad; y < hh; y++) { if (y + rad < hh) acc += tmp[(y + rad) * hw + x]; if (y - rad - 1 >= 0) acc -= tmp[(y - rad - 1) * hw + x]; if (y >= 0) Bt[y * hw + x] = acc / (2 * rad + 1); } }
      await tick();
      for (let y = 1; y < hh - 1; y++) for (let x = 1; x < hw - 1; x++) {
        const i = y * hw + x;
        if (RID[i] !== R_SMOKE) continue;
        const gx = Bt[i + 1] - Bt[i - 1], gy = Bt[i + hw] - Bt[i - hw];
        const m = Math.hypot(gx, gy);
        const wgt = clamp(m * 60, 0, 1);
        const th = Math.atan2(gy, gx) + Math.PI / 2;
        C2[i] = lerp(C2[i], Math.cos(2 * th), wgt); S2[i] = lerp(S2[i], Math.sin(2 * th), wgt);
      }
    }
    // lights: the staff's white blaze, and the demon's fire
    {
      const [bx, by] = L.blaze;
      const fx = B0[0] - 14 * bs, fy = B0[1] - 104 * bs;
      const r1 = 1 / (120 * 120), r2 = 1 / (420 * 420), r3 = 1 / (170 * 170);
      for (let y = 0; y < hh; y++) {
        const uy = (y + 0.5) / hk;
        for (let x = 0; x < hw; x++) {
          const i = y * hw + x;
          const rg = REG[RID[i]];
          const lit = rg ? rg.lit : 1;
          if (lit <= 0) continue;
          const ux = (x + 0.5) / hk;
          const d2 = (ux - bx) * (ux - bx) + (uy - by) * (uy - by);
          const f2 = (ux - fx) * (ux - fx) + (uy - fy) * (uy - fy);
          const l = (0.85 * Math.exp(-d2 * r1) + 0.18 * Math.exp(-d2 * r2) + 0.32 * Math.exp(-f2 * r3)) * lit;
          T[i] = T[i] * (1 - (l > 0.95 ? 0.95 : l));
        }
        if ((y & 31) === 0) await tick();
      }
    }
    stamp('maps');
    if (want.preview) {
      const out = mkCanvas(CW, CH), o = out.getContext('2d');
      o.fillStyle = '#eee4d0'; o.fillRect(0, 0, CW, CH);
      const im = o.createImageData(hw, hh);
      const wd = wctx.getImageData(0, 0, hw, hh).data;
      for (let i = 0; i < hw * hh; i++) {
        const v = 255 * (1 - T[i]);
        const sh = want.preview === 'obj' ? (OIDA[i] * 47) % 255 : 0;
        im.data[i * 4] = want.preview === 'obj' ? sh : v; im.data[i * 4 + 1] = want.preview === 'obj' ? (OIDA[i] * 91) % 255 : v; im.data[i * 4 + 2] = want.preview === 'obj' ? (OIDA[i] * 13) % 255 : v; im.data[i * 4 + 3] = 255;
      }
      const tc = mkCanvas(hw, hh); tc.getContext('2d').putImageData(im, 0, 0);
      o.drawImage(tc, IX, IY, IW, IH);
      return { canvas: out, CW, CH, portrait };
    }

    /* ================================================================ HATCHING ENGINE */
    function samp(A, x, y) {
      let fx = (x - IX) / 2 - 0.5, fy = (y - IY) / 2 - 0.5;
      if (fx < 0) fx = 0; if (fy < 0) fy = 0; if (fx > hw - 1.001) fx = hw - 1.001; if (fy > hh - 1.001) fy = hh - 1.001;
      const xi = fx | 0, yi = fy | 0, u = fx - xi, v = fy - yi, i = yi * hw + xi;
      return A[i] * (1 - u) * (1 - v) + A[i + 1] * u * (1 - v) + A[i + hw] * (1 - u) * v + A[i + hw + 1] * u * v;
    }
    function ridAt(x, y) {
      const fx = ((x - IX) / 2) | 0, fy = ((y - IY) / 2) | 0;
      if (fx < 0 || fy < 0 || fx >= hw || fy >= hh) return 0;
      return RID[fy * hw + fx];
    }
    const LAYERS = [
      { thr: 0.03, rng: 0.5, cmax: 0.52 },
      { thr: 0.32, rng: 0.38, cmax: 0.48 },
      { thr: 0.55, rng: 0.3, cmax: 0.5 },
      { thr: 0.76, rng: 0.18, cmax: 0.62 },
    ];
    const SEP = Math.max(4.0, 0.00185 * IW);
    const hatchStats = { lines: 0, pts: 0 };

    async function hatchLayer(li) {
      const Ly = LAYERS[li];
      const cell = SEP * 0.4;
      const gw = Math.ceil(CW / cell) + 1, gh = Math.ceil(CH / cell) + 1;
      const head = new Int32Array(gw * gh).fill(-1);
      let cap = 1 << 18, np = 0;
      let PX = new Float32Array(cap), PY = new Float32Array(cap), PL = new Int32Array(cap), PR = new Uint8Array(cap), NX = new Int32Array(cap);
      function addPt(x, y, line, r) {
        if (np >= cap) {
          cap *= 2;
          const a = new Float32Array(cap); a.set(PX); PX = a;
          const b = new Float32Array(cap); b.set(PY); PY = b;
          const c = new Int32Array(cap); c.set(PL); PL = c;
          const d = new Uint8Array(cap); d.set(PR); PR = d;
          const e = new Int32Array(cap); e.set(NX); NX = e;
        }
        const g = ((y / cell) | 0) * gw + ((x / cell) | 0);
        PX[np] = x; PY[np] = y; PL[np] = line; PR[np] = r; NX[np] = head[g]; head[g] = np; np++;
      }
      function near(x, y, rad, r, line) {
        const r2 = rad * rad;
        const gx0 = Math.max(0, ((x - rad) / cell) | 0), gx1 = Math.min(gw - 1, ((x + rad) / cell) | 0);
        const gy0 = Math.max(0, ((y - rad) / cell) | 0), gy1 = Math.min(gh - 1, ((y + rad) / cell) | 0);
        for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
          for (let p = head[gy * gw + gx]; p >= 0; p = NX[p]) {
            if (PL[p] === line || PR[p] !== r) continue;
            const dx = PX[p] - x, dy = PY[p] - y;
            if (dx * dx + dy * dy < r2) return true;
          }
        }
        return false;
      }
      let T0 = 0;
      const cov = (t) => { t = (t - T0) / (1 - T0); const c = (t - Ly.thr) / Ly.rng; return c <= 0 ? 0 : (c >= 1 ? Ly.cmax : c * Ly.cmax); };
      function dirAt(x, y, r) {
        const rg = REG[r];
        const off = rg.off[li];
        if (off === 'V') return Math.PI / 2;
        const th = rg.fn ? rg.fn(x, y) : 0.5 * Math.atan2(samp(S2, x, y), samp(C2, x, y));
        return th + off;
      }
      let lineNo = 0;
      const queue = [];
      const bufX = new Float32Array(4096), bufY = new Float32Array(4096), tmpX = new Float32Array(4096), tmpY = new Float32Array(4096);
      function trace(x0, y0, r, sep, sgn, line, maxL, outX, outY) {
        const h = Math.max(1.1, sep * 0.3);
        const th0 = dirAt(x0, y0, r);
        let vx = Math.cos(th0) * sgn, vy = Math.sin(th0) * sgn;
        let x = x0, y = y0, n = 0, len = 0;
        const dtest = sep * 0.5;
        while (n < 4000 && len < maxL) {
          let th = dirAt(x, y, r); let ux = Math.cos(th), uy = Math.sin(th);
          if (ux * vx + uy * vy < 0) { ux = -ux; uy = -uy; }
          th = dirAt(x + ux * h * 0.5, y + uy * h * 0.5, r); let wx = Math.cos(th), wy = Math.sin(th);
          if (wx * ux + wy * uy < 0) { wx = -wx; wy = -wy; }
          if (wx * vx + wy * vy < 0.5) break;
          const nx2 = x + wx * h, ny2 = y + wy * h;
          if (nx2 < IX + 1 || ny2 < IY + 1 || nx2 > IX + IW - 2 || ny2 > IY + IH - 2) break;
          if (ridAt(nx2, ny2) !== r) break;
          if (cov(samp(T, nx2, ny2)) <= 0.004) break;
          if (near(nx2, ny2, dtest, r, line)) break;
          x = nx2; y = ny2; vx = wx; vy = wy; len += h;
          outX[n] = x; outY[n] = y; n++;
        }
        return n;
      }
      function tryLine(x, y) {
        const r = ridAt(x, y);
        const rg = REG[r];
        if (!rg || !(rg.layers & (1 << li))) return;
        T0 = rg.t0 || 0;
        if (cov(samp(T, x, y)) <= 0.01) return;
        const sep = SEP * rg.sp;
        if (near(x, y, sep * 0.92, r, -1)) return;
        const line = ++lineNo;
        const maxL = sep * (rg.minL + (rg.maxL - rg.minL) * R());
        const nb = trace(x, y, r, sep, -1, line, maxL * 0.5, tmpX, tmpY);
        const nf = trace(x, y, r, sep, 1, line, maxL * 0.5, bufX, bufY);
        const n = nb + nf + 1;
        if (n < 3 || (n - 1) * Math.max(1.1, sep * 0.3) < sep * (rg.minC || 2.6)) return;
        const xs = new Float32Array(n), ys = new Float32Array(n), rs = new Float32Array(n);
        for (let i = 0; i < nb; i++) { xs[i] = tmpX[nb - 1 - i]; ys[i] = tmpY[nb - 1 - i]; }
        xs[nb] = x; ys[nb] = y;
        for (let i = 0; i < nf; i++) { xs[nb + 1 + i] = bufX[i]; ys[nb + 1 + i] = bufY[i]; }
        for (let i = 0; i < n; i++) addPt(xs[i], ys[i], line, r);
        const wmul = rg.wt * (0.85 + 0.3 * R());
        const ph = R() * 1000, bow = (R() - 0.5) * rg.bow * sep, wob = rg.wob * sep;
        const ox = new Float32Array(n), oy = new Float32Array(n);
        let s = 0;
        for (let i = 0; i < n; i++) {
          const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
          let tx = xs[i1] - xs[i0], ty = ys[i1] - ys[i0]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          if (i > 0) s += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
          const f = i / (n - 1);
          const o = bow * 4 * f * (1 - f) + wob * (nz(ph + s / (sep * 5), 7.7) - 0.5) * 2;
          ox[i] = xs[i] - ty * o; oy[i] = ys[i] + tx * o;
          const w = sep * cov(samp(T, xs[i], ys[i])) * wmul;
          const ends = Math.min(1, 0.35 + i * 0.3) * Math.min(1, 0.2 + (n - 1 - i) * 0.25);
          rs[i] = 0.5 * w * ends;
        }
        strokePx(ink, ox, oy, rs, 0.84 + 0.15 * R());
        hatchStats.lines++; hatchStats.pts += n;
        const stepSeed = Math.max(2, Math.round(sep / Math.max(1.1, sep * 0.3)));
        for (let i = 0; i < n; i += stepSeed) {
          const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
          let tx = xs[i1] - xs[i0], ty = ys[i1] - ys[i0]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          queue.push(xs[i] - ty * sep, ys[i] + tx * sep, xs[i] + ty * sep, ys[i] - tx * sep);
        }
      }
      const cs = SEP * 6;
      const seeds = [];
      for (let y = IY + cs * 0.5; y < IY + IH; y += cs) for (let x = IX + cs * 0.5; x < IX + IW; x += cs) seeds.push(x + (R() - 0.5) * cs, y + (R() - 0.5) * cs);
      for (let i = seeds.length / 2 - 1; i > 0; i--) {
        const j = (R() * (i + 1)) | 0;
        let t = seeds[2 * i]; seeds[2 * i] = seeds[2 * j]; seeds[2 * j] = t;
        t = seeds[2 * i + 1]; seeds[2 * i + 1] = seeds[2 * j + 1]; seeds[2 * j + 1] = t;
      }
      for (let s = 0; s < seeds.length; s += 2) {
        tryLine(seeds[s], seeds[s + 1]);
        while (queue.length) {
          const qy = queue.pop(), qx = queue.pop();
          tryLine(qx, qy);
          if ((lineNo & 31) === 0) await tick();
        }
        await tick();
      }
    }
    for (let li = 0; li < 4; li++) { await hatchLayer(li); stamp('layer ' + li); }

    /* ---------- silhouettes: marching squares over the object map */
    function traceObj(ids) {
      const m = maskOf(ids);
      return traceMask((x, y) => m[OIDA[y * hw + x]]);
    }
    function traceMask(test, box) {
      let x0 = hw, y0 = hh, x1 = -1, y1 = -1;
      if (box) { [x0, y0, x1, y1] = box; }
      else for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) if (test(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return [];
      x0 -= 1; y0 -= 1; x1 += 1; y1 += 1;
      const ins = (x, y) => (x >= 0 && y >= 0 && x < hw && y < hh && test(x, y)) ? 1 : 0;
      const W = x1 - x0 + 2;
      const adj = new Map();
      const link = (a, b) => { let l = adj.get(a); if (!l) adj.set(a, l = []); l.push(b); let r = adj.get(b); if (!r) adj.set(b, r = []); r.push(a); };
      const Hh = (x, y) => ((y - y0) * W + (x - x0)) * 2, Vv = (x, y) => ((y - y0) * W + (x - x0)) * 2 + 1;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const c = ins(x, y) * 8 + ins(x + 1, y) * 4 + ins(x + 1, y + 1) * 2 + ins(x, y + 1);
        if (c === 0 || c === 15) continue;
        const Tt = Hh(x, y), Bb = Hh(x, y + 1), Ll = Vv(x, y), Rr = Vv(x + 1, y);
        switch (c) {
          case 1: case 14: link(Ll, Bb); break;
          case 2: case 13: link(Bb, Rr); break;
          case 3: case 12: link(Ll, Rr); break;
          case 4: case 11: link(Tt, Rr); break;
          case 6: case 9: link(Tt, Bb); break;
          case 7: case 8: link(Ll, Tt); break;
          case 5: link(Ll, Tt); link(Bb, Rr); break;
          case 10: link(Tt, Rr); link(Ll, Bb); break;
        }
      }
      const pos = (e) => { const cell = e >> 1, ex = (cell % W) + x0, ey = ((cell / W) | 0) + y0; return (e & 1) ? [(ex + 0.5) / hk, (ey + 1) / hk] : [(ex + 1) / hk, (ey + 0.5) / hk]; };
      const used = new Set(), lines = [];
      const walk = (start, prev, out) => { let cur = start, pv = prev; for (;;) { const nb = adj.get(cur).find((n) => n !== pv && !used.has(n)); if (nb == null) break; out.push(nb); used.add(nb); pv = cur; cur = nb; } };
      for (const e of adj.keys()) {
        if (used.has(e)) continue;
        used.add(e);
        const fw = [e]; walk(e, -1, fw);
        const bw = []; walk(e, fw.length > 1 ? fw[1] : -1, bw);
        let pts = bw.reverse().concat(fw).map(pos);
        if (pts.length < 8) continue;
        for (let it = 0; it < 2; it++) pts = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4]; });
        lines.push(pts.filter((p, i) => i % 2 === 0 || i === pts.length - 1));
      }
      return lines;
    }

    /* ================================================================ PEN WORK: contours and detail */
    const RT = (u, v) => samp(T, IX + u * k, IY + v * k);
    const lineW = (base, u, v) => base * (0.7 + 0.6 * clamp(RT(u, v), 0, 1)); // heavier in shadow

    // ---- the rift's broken lip
    {
      pen(rift.concat([rift[0]]), { w: 1.5, a: 0.95, wob: 0.6, taper: [0, 0], obj: [O.WALL, O.RIFT] });
      const c = [rb[0] + rw / 2, (rb[1] + rb[3]) / 2];
      for (let i = 0; i < 70; i++) {
        const p = rift[(R() * rift.length) | 0];
        const a = Math.atan2(p[1] - c[1], p[0] - c[0]) + RR(-0.6, 0.6);
        const crack = [p];
        let x = p[0], y = p[1];
        const ns = 2 + ((R() * 4) | 0);
        for (let j = 0; j < ns; j++) { x += Math.cos(a + RR(-0.5, 0.5)) * RR(5, 14); y += Math.sin(a + RR(-0.5, 0.5)) * RR(5, 14); crack.push([x, y]); }
        pen(crack, { w: RR(0.5, 1.1), a: 0.9, taper: [0.05, 0.6], obj: O.WALL });
      }
      for (let i = 0; i < rift.length - 6; i += 3) {
        if (R() < 0.4) continue;
        const seg = rift.slice(i, i + 4 + ((R() * 4) | 0));
        if (seg[0][0] < rb[0] + rw * 0.55) gpen(offsetLine(seg, -1.6), { w: RR(0.6, 1.2), a: 0.55, taper: [0.3, 0.3], obj: O.WALL });
      }
    }
    // ---- skyline of the snows
    if (L.skyline) {
      let run = [];
      const flushRun = () => { if (run.length > 3) pen(run, { w: 0.42, a: 0.75, wob: 0.12, obj: O.RIFT }); run = []; };
      for (const p of L.skyline) {
        if (run.length && Math.abs(p[1] - run[run.length - 1][1]) > 6) flushRun();
        run.push(p);
      }
      flushRun();
    }
    // ---- the tower
    {
      const tp = L.towerPoly;
      pen(tp.concat([tp[0]]), { w: 0.5, a: 1, wob: 0.04, taper: [0, 0], obj: [O.TOWER, O.RIFT] });
      const [tx, tb, th] = L.tower;
      for (let i = 0; i < 9; i++) {
        const y = tb - th * RR(0.2, 0.85), x = tx + RR(-0.5, 0.5) * th * 0.13 * (1.4 - (tb - y) / th);
        spen([[x, y], [x, y + 0.9]], { w: 0.35, a: 0.8, obj: O.TOWER });
      }
    }
    // ---- the far wall: arcades, ledges, masonry
    for (const ar of L.arcades) {
      const wv = 0.75 - ar.j * 0.1;
      for (const pp of ar.arches) pen(pp.concat([pp[0]]), { w: 0.35 + 0.3 * wv, a: 0.85, wob: 0.08, taper: [0, 0], obj: [O.DEEP, O.WALL] });
      // the ledge below each arcade
      const a = WP(-200, ar.bot - 0.3), b = WP(120, ar.bot - 0.3);
      pen([a, b], { w: 0.5 * wv + 0.2, a: 0.85, wob: 0.3, taper: [0, 0], obj: O.WALL });
      const a2 = WP(-200, ar.top + 0.8), b2 = WP(120, ar.top + 0.8);
      pen([a2, b2], { w: 0.4 * wv + 0.2, a: 0.7, wob: 0.3, taper: [0, 0], obj: O.WALL });
    }
    for (let y = 12; y > -90; y -= 1.7) {
      let x = -200 + R() * 10;
      while (x < 120) {
        const len = RR(5, 22);
        if (R() < 0.6) pen([WP(x, y), WP(x + len, y)], { w: 0.28, a: 0.55, wob: 0.15, taper: [0.1, 0.1], obj: O.WALL });
        x += len + RR(1, 6);
      }
    }
    // ---- the low bridges in the deep
    for (const b of L.lowBridges) {
      pen(b.top, { w: 0.6, a: 0.9, wob: 0.1, taper: [0, 0], obj: O.LBRIDGE });
      pen(b.bot, { w: 0.45, a: 0.85, wob: 0.1, taper: [0, 0], obj: O.LBRIDGE });
    }
    await tick();

    // ---- pillars: arrises, courses, chisel marks, rune bands
    function runeGlyph() {
      const s = [[[0.5, 0], [0.5, 1]]];
      if (R() < 0.25) s.push([[0.12, 0], [0.12, 1]]);
      const nb = 1 + ((R() * 3) | 0);
      for (let i = 0; i < nb; i++) {
        const y = [0, 0.25, 0.5][(R() * 3) | 0];
        const dir = R() < 0.5 ? -1 : 1;
        const kd = R();
        if (kd < 0.45) s.push([[0.5, y], [0.5 + dir * 0.4, y + 0.3]]);
        else if (kd < 0.75) s.push([[0.5, y + 0.3], [0.5 + dir * 0.4, y]]);
        else s.push([[0.5, y], [0.5 + dir * 0.35, y + 0.18], [0.5, y + 0.36]]);
      }
      return s;
    }
    for (const pf of L.pillarFaces) {
      const { pl, f, obj } = pf;
      const far = !pl.near;
      const wv = far ? 0.55 : 1;
      const fp = f.plane === 'x' ? (u, y) => [f.x, y, lerp(f.z0, f.z1, u)] : (u, y) => [lerp(f.x0, f.x1, u), y, f.z];
      const ln = (a, b, o) => { const s = seg3(a, b); if (s) pen(s, Object.assign({ obj }, o)); };
      ln(fp(0, -90), fp(0, 50), { w: 1.2 * wv, a: 0.95, wob: 0.15, taper: [0, 0] });
      ln(fp(1, -90), fp(1, 50), { w: 1.5 * wv, a: 0.95, wob: 0.15, taper: [0, 0] });
      for (let y = -40; y < 40; y += 1.25) {
        const s = seg3(fp(0, y), fp(1, y));
        if (!s || Math.max(s[0][1], s[1][1]) < -20 || Math.min(s[0][1], s[1][1]) > SH + 20) continue;
        const gapAt = R() * 0.9;
        ln(fp(0, y), fp(gapAt, y), { w: 0.6 * wv, a: 0.9, wob: 0.2, taper: [0.05, 0.05] });
        ln(fp(gapAt + 0.04, y), fp(1, y), { w: 0.6 * wv, a: 0.9, wob: 0.2, taper: [0.05, 0.05] });
        { const q = seg3(fp(0.02, y + 0.07), fp(0.98, y + 0.07)); if (q) spen(q, { w: 0.35 * wv, a: 0.55, taper: [0.2, 0.2], obj }); }
        const ju = (Math.round(y / 1.25) & 1) ? 0.5 : (R() < 0.5 ? 0.25 : 0.75);
        ln(fp(ju, y), fp(ju, y + 1.25), { w: 0.45 * wv, a: 0.8, wob: 0.1, taper: [0, 0] });
        if (R() < 0.2) {
          const c = seg3(fp(R() < 0.5 ? 0.02 : 0.96, y + 0.6), fp(0.5, y + 0.6));
          if (c) { const p = c[0]; const sz = 4 * wv * RR(0.5, 1.4); pen([[p[0] - sz, p[1] - sz * 0.4], [p[0] + sz * 0.3, p[1]], [p[0] - sz * 0.6, p[1] + sz * 0.6]], { w: 0.6 * wv, a: 0.9, obj }); }
        }
        if (!far && R() < 0.55) {
          const c = seg3(fp(RR(0.15, 0.85), y + RR(0.3, 0.9)), fp(0.5, y));
          if (c) ticks(c[0][0], c[0][1], RR(0.9, 1.3), 4 + ((R() * 4) | 0), 4.5, 1.6, 0.3, 0.8, obj);
        }
      }
      if (pl.rune) {
        const yA = 1.6, yB = 3.9;
        ln(fp(0, yA), fp(1, yA), { w: 0.9 * wv, a: 0.95, wob: 0.1, taper: [0, 0] });
        ln(fp(0, yB), fp(1, yB), { w: 0.9 * wv, a: 0.95, wob: 0.1, taper: [0, 0] });
        const nG = 7;
        for (let i = 0; i < nG; i++) {
          const u0 = 0.06 + i * (0.88 / nG), u1 = u0 + 0.88 / nG * 0.7;
          for (const s of runeGlyph()) {
            const w3 = s.map(([gu, gv]) => fp(lerp(u0, u1, gu), lerp(yB - 0.22, yA + 0.22, gv)));
            if (w3.some((p) => C3(...p)[2] < ZN)) continue;
            const pts = w3.map((p) => P(...p));
            pen(pts, { w: 1.3 * wv, a: 0.98, wob: 0.03, taper: [0, 0], obj });
            spen(pts.map((p) => [p[0] - 0.8 * wv, p[1] - 0.6 * wv]), { w: 0.55 * wv, a: 0.85, taper: [0.1, 0.1], obj });
            if (pl.x > 0) (L.runeWash = L.runeWash || []).push(pts);
          }
        }
      }
    }
    await tick();

    // ---- the bridge: edges, stones, chisel marks, cracks
    {
      const ob = O.BRIDGE;
      pen(L.deckL, { w: 1.0, a: 0.95, wob: 0.12, taper: [0, 0.1], obj: ob });
      pen(L.deckR, { w: 1.5, a: 1, wob: 0.12, taper: [0, 0.1], obj: ob });
      pen(L.sideBot, { w: 1.7, a: 1, wob: 0.2, taper: [0, 0.1], obj: [ob, O.DEEP, O.WALL, O.LBRIDGE, O.SMOKE] });
      for (const st of L.stones) {
        const dist = C3(0, 0, (st.z0 + st.z1) / 2)[2];
        const wv = clamp(8 / dist, 0.3, 1.3);
        const Pd = (x, z) => P(x, deckY(z), z);
        // the joint at the far end and the longitudinal joint; corners knocked off
        const cut = 0.05 + R() * 0.05;
        const e0 = seg3([st.x0 + cut, deckY(st.z1), st.z1], [st.x1 - cut, deckY(st.z1), st.z1]);
        if (e0) pen(e0, { w: 0.6 * wv, a: 0.85, wob: 0.25, taper: [0.1, 0.1], obj: ob });
        if (st.x1 < BW - 0.01) { const e1 = seg3([st.x1, deckY(st.z0 + cut), st.z0 + cut], [st.x1, deckY(st.z1 - cut), st.z1 - cut]); if (e1) pen(e1, { w: 0.5 * wv, a: 0.8, wob: 0.2, taper: [0.1, 0.1], obj: ob }); }
        if (dist > 17) continue;
        // a lit lip along the near edge of each joint
        const l0 = seg3([st.x0 + cut, deckY(st.z1) + 0.01, st.z1 - 0.03], [st.x1 - cut, deckY(st.z1) + 0.01, st.z1 - 0.03]);
        if (l0 && R() < 0.7) gpen(l0, { w: 0.35 * wv, a: 0.45, taper: [0.3, 0.3], obj: ob });
        // chisel marks, pits, a crack now and then
        if (R() < 0.75) { const c = Pd(lerp(st.x0, st.x1, RR(0.25, 0.75)), lerp(st.z0, st.z1, RR(0.3, 0.7))); ticks(c[0], c[1], Math.atan2(VP1[1] - c[1], VP1[0] - c[0]) + 1.4 + RR(-0.3, 0.3), 3 + ((R() * 5) | 0), 6 * wv, 1.7 * wv, 0.3 * wv, 0.75, ob); }
        for (let q = 0; q < 4; q++) { if (R() < 0.5) continue; const c = Pd(lerp(st.x0, st.x1, R()), lerp(st.z0, st.z1, R())); pen([c, [c[0] + 0.4 * wv, c[1] + 0.2 * wv]], { w: RR(0.4, 0.9) * wv, a: 0.8, wob: 0, obj: ob }); }
        if (R() < 0.22) { let c = Pd(lerp(st.x0, st.x1, R()), st.z0 + 0.05); const cr = [c]; for (let i = 0; i < 5; i++) { c = [c[0] + RR(-5, 5) * wv, c[1] + RR(0.5, 3) * wv]; cr.push(c); } pen(cr, { w: 0.5 * wv, a: 0.9, taper: [0.1, 0.7], obj: ob }); }
        if (st.x1 >= BW - 0.01 && R() < 0.35) { const c = Pd(BW, lerp(st.z0, st.z1, R())); pen([[c[0] - 4 * wv, c[1]], [c[0] - 1 * wv, c[1] + 3 * wv], [c[0] + 3 * wv, c[1] + 1 * wv]], { w: 0.7 * wv, a: 0.95, obj: ob }); }
      }
      let z = zA + 0.3;
      while (z < zB - 0.3) {
        const s = seg3([BW, deckY(z), z], [BW, underY(z), z]);
        if (s) {
          const dist = C3(BW, 0, z)[2];
          const wv = clamp(8 / dist, 0.35, 1.3);
          pen(s, { w: 0.55 * wv, a: 0.85, wob: 0.1, taper: [0, 0], obj: ob });
          const depth = deckY(z) - underY(z);
          for (let yy = 0.55; yy < depth - 0.2; yy += 0.55) { const q = seg3([BW, deckY(z) - yy, z], [BW, deckY(z) - yy, z + 0.42]); if (q) pen(q, { w: 0.45 * wv, a: 0.75, wob: 0.1, taper: [0, 0], obj: ob }); }
          if (dist < 14 && R() < 0.5) { const c = P(BW, deckY(z) - 0.3, z + 0.2); ticks(c[0], c[1], Math.PI / 2 + RR(-0.2, 0.2), 3 + ((R() * 3) | 0), 4 * wv, 1.6 * wv, 0.25 * wv, 0.7, ob); }
        }
        z += RR(0.4, 0.5);
      }
    }
    for (const ln of traceObj([O.PIER])) pen(ln, { w: 1.1, a: 0.9, wob: 0.35, taper: [0, 0] });
    await tick();

    // ---- smoke: a few contour lines where the rolls turn
    for (const sf of L.smokeFields) {
      for (const lev of [sf.lo + 0.05, sf.lo + 0.22, sf.lo + 0.4]) {
        const lines = traceMask((x, y) => { const lx = x - sf.px0, ly = y - sf.py0; return lx >= 0 && ly >= 0 && lx < sf.W2 && ly < sf.H2 && sf.Dn[ly * sf.W2 + lx] > lev && OIDA[y * hw + x] === O.SMOKE; }, [sf.px0, sf.py0, sf.px0 + sf.W2 - 1, sf.py0 + sf.H2 - 1])
          .map((ln) => ln.filter((q) => RT(q[0], q[1]) > 0.55)).filter((ln) => ln.length > 1);
        for (const ln of lines) {
          if (ln.length < 14) continue;
          // only broken pieces of each contour, like an engraver's line on a turning edge
          let i = 0;
          while (i < ln.length - 6) {
            const L0 = 6 + ((R() * 26) | 0);
            if (R() < 0.45) pen(ln.slice(i, i + L0), { w: RR(0.4, 0.8), a: 0.8, wob: 0.15, taper: [0.4, 0.4], obj: O.SMOKE });
            i += L0 + ((R() * 14) | 0);
          }
        }
        await tick();
      }
    }

    // ---- the wings: silhouette, bones, fraying trailing edge
    for (const wgd of [L.wingL, L.wingR]) {
      for (const bp of wgd.bones) pen(bp, { w: 2.2, w1: 0.5, a: 1, wob: 0.35, taper: [0.02, 0.35], obj: O.WING });
      pen(wgd.lead, { w: 1.6, w1: 0.7, a: 1, wob: 0.3, taper: [0, 0.2], obj: [O.WING, O.SMOKE, O.ROCK, O.WALL, O.RIFT, O.FIRE] });
      const W = wgd.W;
      for (let i = Math.floor(W.length * 0.45); i < W.length; i += 1) {
        if (R() < 0.55) continue;
        const p = W[i];
        const ang = Math.atan2(p[1] - (B0[1] - 86 * bs), p[0] - B0[0]) + RR(-0.4, 0.4) + 0.5 * Math.sign(p[0] - B0[0]);
        const tend = [p];
        let x = p[0], y = p[1];
        const n = 4 + ((R() * 5) | 0);
        for (let j = 0; j < n; j++) { x += Math.cos(ang + Math.sin(j * 1.1) * 0.8) * RR(2.5, 7); y += Math.sin(ang + Math.sin(j * 1.1) * 0.8) * RR(2.5, 7); tend.push([x, y]); }
        pen(tend, { w: RR(0.5, 1.4), a: 0.9, wob: 0.3, taper: [0.05, 0.85] });
      }
    }
    for (const ln of traceObj([O.WING])) pen(ln, { w: 0.8, a: 0.85, wob: 0.4, taper: [0, 0] });

    // ---- the Balrog: silhouette, inner forms, horns, face, veins of fire
    {
      const ob = [O.BAL];
      const sil = traceObj([O.BAL]);
      for (const ln of sil) pen(ln, { w: 1.7, a: 1, wob: 0.25, taper: [0, 0] });
      // backlight: a thread of fire runs round the silhouette wherever flame is near behind it
      const objAt = (u, v) => { const x = (u * hk) | 0, y = (v * hk) | 0; return (x < 0 || y < 0 || x >= hw || y >= hh) ? 0 : OIDA[y * hw + x]; };
      const inten = (x, y) => Math.max(Math.exp(-((x - L.fireA[0]) ** 2 + (y - L.fireA[1]) ** 2) / (55 * bs) ** 2), Math.exp(-((x - L.fireB[0]) ** 2 + (y - L.fireB[1]) ** 2) / (34 * bs) ** 2), 0.35 * Math.exp(-((x - L.sword.hilt[0]) ** 2 + (y - L.sword.hilt[1]) ** 2) / (30 * bs) ** 2));
      L.rimRuns = [];
      for (const ln of sil) {
        let run = [];
        const flushR = () => { if (run.length > 5) { const m = run.reduce((a, p) => a + p[2], 0) / run.length; const pts = run.map((p) => [p[0], p[1]]); spen(pts, { w: 0.5 + 1.1 * m, a: 0.95, taper: [0.3, 0.3], obj: ob }); L.rimRuns.push([pts, m]); } run = []; };
        for (let i = 0; i < ln.length; i++) {
          const a = ln[Math.max(0, i - 2)], b = ln[Math.min(ln.length - 1, i + 2)];
          const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
          const nx = -dy / l, ny = dx / l, d = 1.1 * bs;
          const inside = objAt(ln[i][0] + nx * d, ln[i][1] + ny * d) === O.BAL ? 1 : -1;
          const q = [ln[i][0] + nx * d * inside, ln[i][1] + ny * d * inside];
          const it = inten(q[0], q[1]) * (0.75 + 0.5 * nz(i / 6, ln.length));
          if (it > 0.22) run.push([q[0], q[1], clamp(it, 0, 1)]); else flushR();
        }
        flushR();
      }
      // the form is modelled the scratchboard way: white lines cut into the black along the muscles
      const sc = (pts, w, al) => spen(BX(spline(pts, false, 8)), { w: w || 0.55, a: al || 0.9, taper: [0.3, 0.5], obj: ob });
      const HTs = (pts) => pts.map(HT);
      // pectorals and the sternum
      sc([[-29, -76], [-22, -71.6], [-13, -70.6], [-5, -72.4]], 0.75);
      sc([[-26, -78.6], [-19, -75.4], [-12, -75]], 0.4, 0.7);
      sc([[-3, -72.6], [5, -73.4], [13, -76.6], [19, -80.6]], 0.55, 0.75);
      sc([[-4.6, -86], [-4.8, -78], [-4.4, -70]], 0.45, 0.7);
      // ribs and serratus on the near flank
      for (let i = 0; i < 4; i++) sc([[-26.4 + i * 1.2, -68.6 + i * 3.4], [-21.6 + i * 1.2, -67.2 + i * 3.4]], 0.5, 0.85);
      // the abdomen in bands
      for (let i = 0; i < 3; i++) sc([[-14, -64 + i * 5.4], [-9, -65 + i * 5.4], [-3, -64.6 + i * 5.4]], 0.45, 0.75);
      sc([[-5.6, -67], [-5.2, -58], [-4.4, -49]], 0.4, 0.6);
      sc([[-17, -46], [-12, -42.4], [-6, -41.4]], 0.5, 0.7);
      // the sword arm: deltoid, biceps, forearm
      sc([[-24, -90.6], [-31, -90.2], [-36, -87]], 0.6, 0.85);
      { const ax = offsetLine(BX(spline([BP.shN, BP.elbowN, BP.fistN], false, 10)), 3.2 * bs); spen(ax.slice(2, -3), { w: 0.75, a: 0.9, taper: [0.2, 0.4], obj: ob }); spen(offsetLine(ax, -1.6 * bs).slice(4, -6), { w: 0.4, a: 0.7, taper: [0.3, 0.5], obj: ob }); }
      sc([[-44, -84.6], [-50, -86.6], [-56, -88]], 0.45, 0.75);
      // far arm and shoulder
      sc([[14, -92.4], [21, -91], [26.4, -87.6]], 0.6, 0.85);
      sc([[30, -91.4], [37, -94.6], [44, -98.4], [50, -102.6]], 0.55, 0.8);
      sc([[20, -72], [17.6, -62], [15, -53]], 0.45, 0.7);
      // legs: the knee and shin of the striding leg, the far thigh
      sc([[-21.6, -40], [-24.2, -30], [-24.4, -20], [-23.4, -10]], 0.55, 0.75);
      sc([[17, -38], [21.6, -28], [22, -18]], 0.45, 0.6);
      sc([[-14, -28], [-17, -18], [-18.6, -8]], 0.35, 0.55);
      // the head: cheekbone, the line of the jaw, the brow
      sc(HTs([[-31, -99.4], [-26, -99.8], [-20.6, -101.4]]), 0.5, 0.85);
      sc(HTs([[-27, -93], [-21.4, -93.6], [-15.6, -95.6]]), 0.45, 0.8);
      sc(HTs([[-13, -103], [-9, -101], [-6.6, -97]]), 0.4, 0.7);
      pen(BXH(spline([[-30.6, -102.6], [-27.6, -103.2], [-24.4, -103.4], [-21, -105]], false, 6)), { w: 1.0, a: 1, obj: ob });
      // fine engraver's flicks in the lit planes
      for (let i = 0; i < 80; i++) {
        const t = R();
        const pick = R() < 0.45 ? [mid(BP.shN, BP.elbowN, t), axis(BP.shN, BP.elbowN)] : R() < 0.5 ? [mid(BP.elbowF, BP.fistF, t), axis(BP.elbowF, BP.fistF)] : [[lerp(-28, -20, t), lerp(-80, -58, t)], 1.4];
        const c = BX([pick[0]])[0], an = pick[1] + 1.4;
        spen([[c[0], c[1]], [c[0] + Math.cos(an) * RR(1.2, 3), c[1] + Math.sin(an) * RR(1.2, 3)]], { w: 0.3, a: 0.75, taper: [0, 0.7], obj: ob });
      }
      for (const hn of balShapes.horns) {
        const h = hn.h;
        pen(hn.outline.concat([hn.outline[0]]), { w: 1.0, a: 1, wob: 0.1, taper: [0, 0] });
        gpen(offsetLine(h, (f) => (1 - Math.pow(f, 0.8) * 0.92) * 2.6 * bs).slice(2), { w: 0.6, a: 0.5, taper: [0.2, 0.5] });
        for (let i = 2; i < h.length - 3; i += 2) {
          const a = h[i - 1], b = h[i + 1];
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
          const wd = 3.4 * bs * (1 - Math.pow(i / h.length, 0.8) * 0.92);
          pen([[h[i][0] - Math.cos(ang) * wd, h[i][1] - Math.sin(ang) * wd], [h[i][0] + Math.cos(ang) * wd * 0.9, h[i][1] + Math.sin(ang) * wd * 0.9]], { w: 0.5, a: 0.9, wob: 0.15 });
        }
      }
      // the eye, a slit of fire under the brow; the maw with its teeth
      L.balEyes = [BXH([[-28.6, -101.6], [-25.4, -102.2]])];
      spen(L.balEyes[0], { w: 0.6, a: 1, obj: ob });
      L.balMaw = BXH(spline([[-34, -95.6], [-31, -96.1], [-28.8, -96.4]], false, 6));
      spen(L.balMaw, { w: 0.5, a: 0.9, obj: ob });
      for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5; const p = BXH([[lerp(-35, -29.6, t), lerp(-97.6, -96.8, t)]])[0]; spen([p, [p[0] - 0.2, p[1] + RR(0.8, 1.5)]], { w: 0.45, a: 1, taper: [0, 0.85], obj: ob }); }
      for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; const p = BXH([[lerp(-34, -29.6, t), lerp(-94.8, -95.8, t)]])[0]; spen([p, [p[0] + 0.2, p[1] - RR(0.7, 1.3)]], { w: 0.4, a: 1, taper: [0, 0.85], obj: ob }); }
      spen(BXH([[-35.2, -99.6], [-34.2, -100]]), { w: 0.45, a: 0.9, obj: ob });
      L.veins = [];
      for (let i = 0; i < 14; i++) {
        let p = BX([[RR(-24, 18), RR(-82, -44)]])[0];
        const hx = (p[0] * hk) | 0, hy = (p[1] * hk) | 0;
        if (hx < 0 || hy < 0 || hx >= hw || hy >= hh || OIDA[hy * hw + hx] !== O.BAL) continue;
        const v = [p];
        let a = RR(0, TAU);
        for (let j = 0; j < 4; j++) { a += RR(-0.9, 0.9); p = [p[0] + Math.cos(a) * RR(1, 2.5) * bs * 0.6, p[1] + Math.sin(a) * RR(1, 2.5) * bs * 0.6]; v.push(p); }
        L.veins.push(v);
        spen(v, { w: 0.35, a: 0.7, taper: [0.3, 0.6], obj: ob });
      }
      for (const c of [[-63, -89.6, -2.5], [-63.6, -87, -2.8], [-62.6, -84.6, 3.0], [56, -111.6, -0.6], [58.6, -109.4, -0.2], [59, -105.6, 0.3]]) {
        const p = BX([[c[0], c[1]]])[0];
        const a = c[2];
        pen([p, [p[0] + Math.cos(a) * 1.4 * bs, p[1] + Math.sin(a) * 1.4 * bs], [p[0] + Math.cos(a + 0.6) * 2.4 * bs, p[1] + Math.sin(a + 0.6) * 2.4 * bs]], { w: 0.8, a: 1, taper: [0, 0.9] });
      }
    }
    // ---- flames: calligraphic tongues with broken edges
    for (const fl of flames) {
      const o = fl.outline, half = (o.length / 2) | 0;
      const fine = fl.opt.fleck ? 0.35 : fl.opt.mane ? 0.6 : 0.5;
      const big = fl.len > 30 * bs;
      if (big && R() < 0.5) pen(sub(o.slice(0, half + 1), RR(0.2, 0.4), RR(0.8, 0.98)), { w: fine * 0.7, a: 0.75, wob: 0.06, taper: [0.6, 0.8], obj: [O.FIRE, O.SMOKE, O.WING] });
    }
    // ---- the whip thongs
    for (const th of L.whip) { pen(offsetLine(th, 1.3 * bs), { w: 0.8, w1: 0.25, a: 0.95, wob: 0.06, taper: [0, 0.2] }); spen(th.slice(2), { w: 1.4 * bs, w1: 0.3 * bs, a: 1, taper: [0.05, 0.3] }); gpen(th.slice(3, Math.floor(th.length * 0.6)), { w: 0.9, a: 0.6, taper: [0.2, 0.5] }); }
    // ---- the flaming sword: edges and guard
    {
      const bl = L.blade, { hilt, ang } = L.sword;
      pen([bl[0], bl[1], bl[2]], { w: 0.6, a: 0.9, taper: [0, 0.2] });
      pen([bl[4], bl[3], bl[2]], { w: 0.8, a: 0.95, taper: [0, 0.2] });
      const nx = -Math.sin(ang) * 2.2 * bs, ny = Math.cos(ang) * 2.2 * bs;
      pen([[hilt[0] + nx * 2, hilt[1] + ny * 2], [hilt[0] - nx * 2, hilt[1] - ny * 2]], { w: 2.2, a: 1, taper: [0, 0] });
    }
    await tick();

    // ---- the wizard
    {
      const ow = [O.WIZ];
      // the silhouette, heavy; inner edges lighter
      for (const ln of traceObj([O.WIZ])) pen(ln, { w: 1.25, a: 1, wob: 0.12, taper: [0, 0] });
      const C = (nm, w, opt) => pen(wizShapes[nm].concat([wizShapes[nm][0]]), Object.assign({ w, a: 1, wob: 0.1, taper: [0, 0], obj: ow }, opt || {}));
      C('sleeveL', 0.9); C('sleeveR', 0.8); C('hood', 0.7); C('crown', 0.9); C('brim', 0.9);
      C('handL', 0.7); C('handR', 0.7); C('bootR', 0.7); C('bootL', 0.7); C('sleeveMouth', 0.6); C('forearmL', 0.6); C('hair', 0.5, { a: 0.8 }); C('beard', 0.5, { a: 0.8 });
      pen(WX(spline([[42, -69], [43.5, -66], [43, -63]], false, 4)), { w: 0.45, a: 0.9, obj: ow });
      pen(WX(spline([[-29, -123], [-32, -124], [-35.5, -123]], false, 4)), { w: 0.4, a: 0.9, obj: ow });
      // folds: long falls with a hooked start, some forked
      for (const fp of L.folds) {
        pen(fp, { w: 0.95, w1: 0.4, a: 0.95, wob: 0.12, taper: [0.25, 0.3], obj: ow });
        if (R() < 0.6) { const st = Math.floor(fp.length * RR(0.3, 0.6)); const br = fp.slice(st).map((p, i) => [p[0] + i * RR(-0.18, 0.18) * ws, p[1]]); pen(br, { w: 0.6, a: 0.85, taper: [0.4, 0.4], obj: ow }); }
      }
      for (const fp of L.sleeveFolds) pen(fp, { w: 0.8, w1: 0.3, a: 0.9, taper: [0.3, 0.3], obj: ow });
      // crease in the crown, band at its base
      pen(WX(spline([[-5, -101], [-7.5, -110], [-11, -119], [-15.5, -127]], false, 6)), { w: 0.5, a: 0.8, taper: [0.3, 0.5], obj: ow });
      pen(WX(spline([[-9, -99.4], [0, -100.8], [8, -99.6]], false, 6)), { w: 0.7, a: 0.9, obj: ow });
      // hair and beard: long strands streaming to the left in the hot wind
      for (let i = 0; i < 34; i++) {
        const y0 = RR(-95, -84), x0 = RR(-10, 10);
        const s = WX(spline([[x0, y0], [x0 - RR(6, 10), y0 + RR(1, 3)], [x0 - RR(14, 22), y0 + RR(3, 6)], [x0 - RR(22, 34), y0 + RR(4, 9)]], false, 6));
        pen(s, { w: RR(0.25, 0.5), a: 0.8, wob: 0.08, taper: [0.1, 0.7], obj: ow });
      }
      for (let i = 0; i < 16; i++) {
        const y0 = RR(-88, -85);
        const s = WX(spline([[-14, y0], [-22, y0 + RR(-0.8, 1.2)], [-30, y0 + RR(-1.5, 2)], [-RR(36, 44), y0 + RR(-2.5, 2.5)]], false, 6));
        pen(s, { w: RR(0.25, 0.45), a: 0.8, wob: 0.08, taper: [0.1, 0.7] });
      }
      // the staff: gnarled, with knots
      pen(wizShapes.staff, { w: 2.0, a: 1, wob: 0.18, taper: [0, 0], obj: [O.STAFF, O.WIZ, O.WING, O.BAL, O.SMOKE, O.ROCK, O.WALL, O.FIRE, O.RIFT, O.DEEP] });
      for (let i = 0; i < 7; i++) {
        const p = wizShapes.staff[(5 + i * 7) % wizShapes.staff.length];
        pen([[p[0] - 1.4, p[1] - 0.2], [p[0] + 1.3, p[1] + 0.7]], { w: 0.6, a: 0.9 });
      }
      gpen(offsetLine(wizShapes.staff.slice(Math.floor(wizShapes.staff.length * 0.3)), -0.7), { w: 0.5, a: 0.7, taper: [0.3, 0] });
      // Glamdring: cold and white
      const bl = wizShapes.blade;
      pen([bl[0], bl[1], bl[2]], { w: 0.45, a: 1, wob: 0.02, taper: [0, 0.3] });
      pen([bl[4], bl[3], bl[2]], { w: 0.65, a: 1, wob: 0.02, taper: [0, 0.3] });
      const { a: sa, b: sb } = wizShapes.sword;
      const ang = Math.atan2(sb[1] - sa[1], sb[0] - sa[0]);
      const qx = -Math.sin(ang) * 4.5 * ws, qy = Math.cos(ang) * 4.5 * ws;
      pen([[sa[0] + qx, sa[1] + qy], [sa[0] - qx, sa[1] - qy]], { w: 1.4, a: 1, taper: [0, 0] });
      pen([[sa[0] - Math.cos(ang) * 1.5 * ws, sa[1] - Math.sin(ang) * 1.5 * ws], [sa[0] - Math.cos(ang) * 5 * ws, sa[1] - Math.sin(ang) * 5 * ws]], { w: 1.6, a: 1, taper: [0, 0] });
      gpen([[lerp(sa[0], sb[0], 0.06), lerp(sa[1], sb[1], 0.06)], sb], { w: 0.75, a: 0.95, taper: [0.1, 0.1] });
      // rims of white: the blaze grazes hat, brim, hair, the raised sleeve and the shoulders
      const rim = (pts, w, a) => gpen(WX(spline(pts, false, 6)), { w, a, taper: [0.25, 0.35], obj: [O.WIZ, O.STAFF] });
      rim([[-23.5, -135.6], [-19.5, -133], [-16.4, -127.6], [-13.6, -121], [-11.4, -113], [-9.8, -105], [-9.4, -100]], 1.1, 0.9);
      rim([[-18.5, -96.2], [-12, -98.4], [0, -99.2], [8, -98.8]], 0.8, 0.85);
      rim([[-30, -79], [-22, -84], [-14, -88], [-11, -93], [-8, -96.4]], 0.8, 0.8);
      rim([[-28.2, -120], [-25.8, -114], [-23.4, -108.4], [-19.6, -103], [-16.2, -97], [-13.2, -90]], 0.9, 0.8);
      rim([[-33.2, -118], [-32.8, -112], [-33, -108.6]], 0.6, 0.6);
      rim([[-14.6, -82], [-19.6, -75.6], [-25.4, -68], [-31.4, -59.6], [-38, -50]], 0.8, 0.7);
      rim([[-36.8, -91], [-33.8, -97], [-33.2, -104]], 0.6, 0.55);
      rim([[-34, -87.2], [-41, -88.4]], 0.5, 0.7);
      rim([[-28.6, -125], [-32.2, -128.4], [-35.6, -126.6]], 0.6, 0.8);
    }
    await tick();

    // ---- the white blaze: scratched rays and a gouache heart
    {
      const [bx, by] = L.blaze;
      const notWiz = [];
      for (let o = 0; o < 64; o++) if (o !== O.WIZ && o !== O.SWORD) notWiz.push(o);
      for (let i = 0; i < 46; i++) {
        // a bundle of near-parallel rays
        const a0 = R() < 0.6 ? RR(-1.0, 1.2) : R() * TAU;
        const n = 2 + ((R() * 5) | 0);
        const len0 = RR(260, 900);
        for (let j = 0; j < n; j++) {
          const a = a0 + (j - n / 2) * RR(0.004, 0.012);
          const len = len0 * RR(0.7, 1.05);
          spen([[bx + Math.cos(a) * 16, by + Math.sin(a) * 16], [bx + Math.cos(a) * len, by + Math.sin(a) * len]], { w: RR(0.35, 1.0), a: RR(0.6, 0.95), taper: [0.0, 0.85], obj: notWiz });
        }
      }
      for (let i = 0; i < 110; i++) {
        const a = R() * TAU;
        const len = Math.pow(R(), 1.6) * 360 + 30;
        spen([[bx + Math.cos(a) * 12, by + Math.sin(a) * 12], [bx + Math.cos(a) * len, by + Math.sin(a) * len]], { w: RR(0.25, 0.6), a: RR(0.5, 0.9), taper: [0.0, 0.9], obj: notWiz });
      }
      const pb = [IX + bx * k, IY + by * k], r0 = 22 * k;
      for (let y = Math.floor(pb[1] - r0 * 4); y < pb[1] + r0 * 4; y++) {
        for (let x = Math.floor(pb[0] - r0 * 4); x < pb[0] + r0 * 4; x++) {
          if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
          const d = Math.hypot(x - pb[0], y - pb[1]) / r0;
          const dry = 0.75 + 0.25 * nz(x / 2.3, y / 2.3);
          const g = clamp(1.25 - d * 0.9, 0, 1) * dry + 0.35 * Math.exp(-d * d * 0.6) * dry;
          const i = y * CW + x;
          if (g > gou[i]) gou[i] = clamp(g, 0, 1);
        }
      }
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + RR(-0.1, 0.1);
        const len = (i % 3 === 0 ? RR(70, 130) : RR(30, 60));
        gpen([[bx, by], [bx + Math.cos(a) * len, by + Math.sin(a) * len]], { w: i % 3 === 0 ? 2.2 : 1.2, a: 0.9, taper: [0, 0.95] });
      }
    }
    for (const s of L.sparks) {
      const [x, y, r, a] = s;
      spen([[x, y], [x - Math.cos(a) * r * 3, y - Math.sin(a) * r * 3]], { w: r * 0.7, a: 0.9, taper: [0, 0.8] });
      gpen([[x, y], [x + 0.2, y + 0.2]], { w: r * 0.6, a: 0.8, taper: [0, 0] });
    }
    {
      const [mx, my, mr] = L.moon;
      for (let y = Math.floor(IY + (my - mr) * k); y < IY + (my + mr) * k; y++) for (let x = Math.floor(IX + (mx - mr) * k); x < IX + (mx + mr) * k; x++) {
        const d = Math.hypot(x - IX - mx * k, y - IY - my * k) / (mr * k);
        if (d < 1) { const i = y * CW + x; gou[i] = Math.max(gou[i], clamp((1 - d) * 6, 0, 0.85) * (0.8 + 0.2 * nz(x / 4, y / 4))); }
      }
      pen(spline([[mx - mr, my], [mx, my - mr], [mx + mr, my], [mx, my + mr]], true, 10).concat([[mx - mr, my]]), { w: 0.4, a: 0.6, wob: 0.1, obj: [O.MOON, O.RIFT] });
    }
    {
      const [ex, ey, er] = L.eye;
      const almond = [];
      for (let t = 0; t <= 1; t += 0.05) almond.push([ex - er + 2 * er * t, ey - Math.sin(Math.PI * t) * er * 0.55]);
      for (let t = 1; t >= 0; t -= 0.05) almond.push([ex - er + 2 * er * t, ey + Math.sin(Math.PI * t) * er * 0.5]);
      pen(almond, { w: 0.5, a: 1, wob: 0.03, taper: [0, 0] });
      pen([[ex, ey - er * 0.48], [ex - er * 0.08, ey], [ex, ey + er * 0.44]], { w: er * 0.22, a: 1, wob: 0, taper: [0.3, 0.3] });
      for (let i = 0; i < 26; i++) {
        const a = R() * TAU, r1 = er * (1.05 + 0.15 * R());
        const p0 = [ex + Math.cos(a) * r1, ey + Math.sin(a) * r1 * 0.55];
        const p1 = [ex + Math.cos(a) * r1 * RR(1.3, 1.9), ey + Math.sin(a) * r1 * 0.55 * RR(1.3, 2.1) - RR(0, er * 0.6)];
        pen([p0, p1], { w: 0.3, a: 0.8, taper: [0.1, 0.8] });
      }
    }
    // ---- border: a ruled line round the image
    FREE = true;
    {
      const o = -0.6;
      pen([[o, o], [SW - o, o], [SW - o, SH - o], [o, SH - o], [o, o]], { w: 0.75, a: 0.9, wob: 0.15, taper: [0, 0] });
    }
    FREE = false;
    stamp('pen');

    /* ================================================================ WASHES */
    {
      const [gx, gy] = L.glow;
      wRadial(gx, gy, lay.glowR, 0.12, 0.42, 0.36, 0.85, 0.8);
      wRadial(gx, gy + 80, lay.glowR * 0.55, 0.4, 0.42, 0.18, 0.6, 0.8);
      // fire-lit smoke and the demon's halo
      wRadial(B0[0] + 10 * bs, B0[1] - 60 * bs, 120 * bs, 0.18, 0.32, 0.2, 0.55, 1.2);
      // flames: gamboge at the root, vermilion along, madder at the tips
      wctx.globalCompositeOperation = 'lighten';
      for (const fl of flames) {
        const pts = fl.pts, nS = 5;
        for (let s = 0; s < nS; s++) {
          const a = s / nS, b = (s + 1.2) / nS;
          const l = sub(offsetLine(pts, (f) => fl.wid * Math.sin(Math.PI * Math.pow(f, 0.45)) * 0.95), a, Math.min(1, b));
          const r = sub(offsetLine(pts, (f) => -fl.wid * Math.sin(Math.PI * Math.pow(f, 0.45)) * 0.95), a, Math.min(1, b));
          const poly = l.concat(r.reverse());
          const t = a;
          wFill(poly, lerp(0.75, 0.35, t), lerp(0.08, 0.5, t), lerp(0.0, 0.25, t * t), 1, 0.9);
        }
      }
      wctx.globalCompositeOperation = 'lighter';
      const { hilt, tip } = L.sword;
      wStroke([hilt, tip], 0.95, 0.35, 0.0, 1, 3.4 * bs, 1);
      wStroke([hilt, tip], 0.2, 0.6, 0.3, 0.6, 7 * bs, 4);
      for (const th of L.whip) { wStroke(th, 0.3, 0.5, 0.25, 0.45, 3.4 * bs, 2 * bs); wStroke(th, 0.95, 0.3, 0, 0.95, 1.6 * bs, 0.3); }
      for (const e of L.balEyes) { wStroke(e, 1, 0.5, 0, 1, 0.8 * bs, 0.2); wStroke(e, 0.4, 0.5, 0.2, 0.6, 2.2 * bs, 1.2 * bs); }
      wStroke(L.balMaw, 0.9, 0.7, 0.1, 1, 1.0 * bs, 0.4);
      for (const v of L.veins) wStroke(v, 0.5, 0.7, 0.2, 0.8, 0.5 * bs, 0.3);
      for (const [pts, m] of (L.rimRuns || [])) wStroke(pts, 0.85, 0.45, 0.05, 0.6 + 0.4 * m, 1.8 * bs, 0.6 * bs);

      // the mane's glow
      wStroke(L.maneMass, 0.55, 0.35, 0.05, 0.55, 22 * bs, 9 * bs);
      wStroke(L.footMass, 0.5, 0.4, 0.1, 0.5, 18 * bs, 8 * bs);
      // the far end of the bridge, its side, and the right-hand pillars take the fire
      wctx.save(); wctx.clip(L.deckP);
      const dg = wctx.createLinearGradient(W0[0], 0, B0[0], 0);
      dg.addColorStop(0, washc(0, 0, 0, 0)); dg.addColorStop(0.55, washc(0.1, 0.25, 0.15, 0.2)); dg.addColorStop(1, washc(0.35, 0.55, 0.3, 0.75));
      wctx.fillStyle = dg; wctx.fillRect(0, 0, SW, SH); wctx.restore();
      wctx.save(); wctx.clip(L.sideP);
      const sg = wctx.createLinearGradient(0, B0[1] - 40, 0, W0[1] + 160);
      sg.addColorStop(0, washc(0.2, 0.5, 0.35, 0.5)); sg.addColorStop(1, washc(0.1, 0.3, 0.3, 0.3));
      wctx.fillStyle = sg; wctx.fillRect(0, 0, SW, SH); wctx.restore();
      for (const r of (L.runeWash || [])) wStroke(r, 0.4, 0.7, 0.3, 0.8, 1.2, 0.3);
      for (const pf of L.pillarFaces) {
        if (pf.pl.x > 0) { wctx.save(); wctx.clip(pf.path); const yb = P(pf.pl.x, 0, pf.pl.z)[1]; const g = wctx.createLinearGradient(0, yb - 300, 0, yb + 400); g.addColorStop(0, washc(0, 0, 0, 0)); g.addColorStop(0.5, washc(0.12, 0.35, 0.28, 0.4)); g.addColorStop(1, washc(0.1, 0.35, 0.4, 0.5)); wctx.fillStyle = g; wctx.fillRect(0, 0, SW, SH); wctx.restore(); }
      }
      // red rim on the wizard's right
      wStroke(WX(spline([[19, -78.5], [24, -70], [31, -63.5], [28, -54], [26.5, -40], [28, -24], [31, -6]], false, 6)), 0.15, 0.55, 0.3, 0.65, 1.6 * ws, 0.6);
      wStroke(WX(spline([[4, -99], [7, -95.5], [18, -92.8]], false, 6)), 0.15, 0.5, 0.25, 0.6, 1.2 * ws, 0.5);
      wStroke(WX(spline([[34, -67.5], [41, -66.5], [46, -68.5]], false, 6)), 0.2, 0.5, 0.25, 0.6, 1.2 * ws, 0.5);
      // the eye and a sullen glow over the far land
      const [ex, ey, er] = L.eye;
      wRadial(ex, ey + er * 2, er * 10, 0.1, 0.4, 0.4, 0.45, 0.6);
      wctx.save();
      wctx.fillStyle = washc(1, 0.45, 0, 1); wctx.beginPath(); wctx.ellipse(ex, ey, er, er * 0.52, 0, 0, TAU); wctx.fill();
      wctx.lineWidth = er * 0.25; wctx.strokeStyle = washc(0.1, 0.8, 0.5, 1); wctx.beginPath(); wctx.ellipse(ex, ey, er * 1.02, er * 0.54, 0, 0, TAU); wctx.stroke();
      wctx.restore();
      for (const s of L.sparks) wRadial(s[0], s[1], s[2] * 3, 0.9, 0.55, 0.05, 0.85);
    }
    stamp('wash paint');
    const WY = new Float32Array(hw * hh), WO = new Float32Array(hw * hh), WC = new Float32Array(hw * hh);
    {
      const wd = wctx.getImageData(0, 0, hw, hh).data;
      const bc = mkCanvas(hw, hh), bx = cpu(bc);
      bx.filter = 'blur(' + (3 * hk).toFixed(1) + 'px)'; bx.drawImage(wcan, 0, 0);
      const bd = bx.getImageData(0, 0, hw, hh).data;
      for (let i = 0, j = 0; i < hw * hh; i++, j += 4) {
        if (wd[j] + wd[j + 1] + wd[j + 2] + bd[j] + bd[j + 1] + bd[j + 2] === 0) continue;
        const gx = i % hw, gy = (i / hw) | 0;
        const gran = 0.9 + 0.2 * nz(gx / 2.2, gy / 2.2);
        const e0 = wd[j] / 255, e1 = wd[j + 1] / 255, e2 = wd[j + 2] / 255;
        WY[i] = clamp((e0 + Math.max(0, e0 - bd[j] / 255) * 1.4) * gran, 0, 1.2);
        WO[i] = clamp((e1 + Math.max(0, e1 - bd[j + 1] / 255) * 1.4) * gran, 0, 1.2);
        WC[i] = clamp((e2 + Math.max(0, e2 - bd[j + 2] / 255) * 1.4) * gran, 0, 1.2);
        if ((i & 0x3ffff) === 0) await tick();
      }
    }
    stamp('washes');

    /* ================================================================ COMPOSITE */
    const out = mkCanvas(CW, CH);
    const octx = out.getContext('2d');
    const img = octx.createImageData(CW, CH);
    const D = img.data;
    const paper = [238, 229, 210];
    const inkc = [24, 18, 15];
    const PYc = [0.99, 0.8, 0.22], POc = [0.96, 0.42, 0.17], PCc = [0.64, 0.16, 0.13];
    // paper fibre: a tile of fine noise, plus a coarse field for foxing and tone
    const TS = 512, tile = new Float32Array(TS * TS);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) tile[y * TS + x] = nz(x / 2.7, y / 2.7) * 0.62 + nz(x / 17 + 40, y / 6) * 0.38;
    const cs4 = 16, cw4 = Math.ceil(CW / cs4) + 2, ch4 = Math.ceil(CH / cs4) + 2, coarse = new Float32Array(cw4 * ch4);
    for (let y = 0; y < ch4; y++) for (let x = 0; x < cw4; x++) {
      const px = x * cs4, py = y * cs4;
      const ed = Math.min(px, CW - 1 - px, py, CH - 1 - py);
      coarse[y * cw4 + x] = (1 - smooth(0, CW * 0.05, ed)) * 0.6 + 0.4 * smooth(0.55, 0.8, nz(px / 300 + 9, py / 300)) + 0.15 * (nz(px / 90, py / 90) - 0.5);
    }
    await tick();
    for (let y = 0; y < CH; y++) {
      const cy = y / cs4, cyi = cy | 0, cyf = cy - cyi;
      const inY = y >= IY && y < IY + IH;
      for (let x = 0; x < CW; x++) {
        const i = y * CW + x, j = i * 4;
        const fib = tile[(y & (TS - 1)) * TS + (x & (TS - 1))];
        const cx = x / cs4, cxi = cx | 0, cxf = cx - cxi, ci = cyi * cw4 + cxi;
        const age = (coarse[ci] * (1 - cxf) + coarse[ci + 1] * cxf) * (1 - cyf) + (coarse[ci + cw4] * (1 - cxf) + coarse[ci + cw4 + 1] * cxf) * cyf;
        let r = paper[0] - 10 * fib - 9 * age, g = paper[1] - 10 * fib - 12 * age, b = paper[2] - 11 * fib - 18 * age;
        let solid = 0;
        if (inY && x >= IX && x < IX + IW) {
          let fx = (x - IX) / 2 - 0.5, fy = (y - IY) / 2 - 0.5;
          if (fx < 0) fx = 0; if (fy < 0) fy = 0; if (fx > hw - 1.001) fx = hw - 1.001; if (fy > hh - 1.001) fy = hh - 1.001;
          const xi = fx | 0, yi = fy | 0, u = fx - xi, v = fy - yi, wi = yi * hw + xi;
          const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
          const wy = WY[wi] * w00 + WY[wi + 1] * w10 + WY[wi + hw] * w01 + WY[wi + hw + 1] * w11;
          const wo = WO[wi] * w00 + WO[wi + 1] * w10 + WO[wi + hw] * w01 + WO[wi + hw + 1] * w11;
          const wc = WC[wi] * w00 + WC[wi + 1] * w10 + WC[wi + hw] * w01 + WC[wi + hw + 1] * w11;
          // the deepest darks are laid in with the brush: a solid black that lets a little paper through
          const tt = T[wi] * w00 + T[wi + 1] * w10 + T[wi + hw] * w01 + T[wi + hw + 1] * w11;
          if (tt > 0.86) solid = smooth(0.86, 0.97, tt) * (0.82 + 0.16 * fib);
          if (wy + wo + wc > 0.003) {
            r *= (1 - wy * (1 - PYc[0])) * (1 - wo * (1 - POc[0])) * (1 - wc * (1 - PCc[0]));
            g *= (1 - wy * (1 - PYc[1])) * (1 - wo * (1 - POc[1])) * (1 - wc * (1 - PCc[1]));
            b *= (1 - wy * (1 - PYc[2])) * (1 - wo * (1 - POc[2])) * (1 - wc * (1 - PCc[2]));
          }
        }
        let a = ink[i];
        if (solid > 0) a = 1 - (1 - a) * (1 - solid);
        if (a > 0) {
          a *= (1 - scr[i]) * (0.9 + 0.1 * fib);
          r = r * (1 - a) + inkc[0] * a; g = g * (1 - a) + inkc[1] * a; b = b * (1 - a) + inkc[2] * a;
        }
        const go = gou[i];
        if (go > 0) { r = lerp(r, 251, go); g = lerp(g, 250, go); b = lerp(b, 246, go); }
        D[j] = r; D[j + 1] = g; D[j + 2] = b; D[j + 3] = 255;
      }
      if ((y & 31) === 0) await tick();
    }
    octx.putImageData(img, 0, 0);
    stamp('composite');
    if (debug) console.warn('[bridge] hatch', JSON.stringify(hatchStats), 'size', CW, CH);
    return { canvas: out, CW, CH, portrait };
  }
})();
