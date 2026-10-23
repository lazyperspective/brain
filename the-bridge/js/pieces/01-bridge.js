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
    const ZWIZ = portrait ? 5.6 : 6.2, ZBAL = portrait ? 19 : 20;
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
    const R_WALLF = reg(13, { sp: 0.85, wt: 0.85, fn: toVPpx(VP2[0], VP2[1]), maxL: 50, wob: 0.14, bow: 0.1, off: [0, 'V', 0.6, -0.6], lit: 0.5 });
    const R_ARCH = reg(14, { sp: 0.75, wt: 0.75, fn: () => 0.05, maxL: 40, wob: 0.1, off: [0, 0.3, -0.3, 1.5708], lit: 0.3 });
    const R_FACE_A = reg(20, { sp: 1.0, wt: 1.05, fn: toVPpx(VP1[0], VP1[1]), maxL: 60, wob: 0.13, bow: 0.15, off: [0, 'V', 0.5, -0.5] });
    const R_FACE_B = reg(21, { sp: 1.0, wt: 1.05, fn: toVPpx(VP2[0], VP2[1]), maxL: 60, wob: 0.13, bow: 0.15, off: [0, 'V', -0.5, 0.5] });
    const R_FACE_A2 = reg(22, { sp: 0.8, wt: 0.85, fn: toVPpx(VP1[0], VP1[1]), maxL: 50, wob: 0.1, off: [0, 'V', 0.5, -0.5], lit: 0.7 });
    const R_FACE_B2 = reg(23, { sp: 0.8, wt: 0.85, fn: toVPpx(VP2[0], VP2[1]), maxL: 50, wob: 0.1, off: [0, 'V', -0.5, 0.5], lit: 0.7 });
    const R_DEEP = reg(30, { sp: 0.85, wt: 0.85, fn: (x, y) => Math.PI / 2 + 0.25 * (nz(x / 300, y / 300) - 0.5), maxL: 60, wob: 0.22, bow: 0.15, lit: 0.4, off: [0, 0.45, -0.45, 1.5708] });
    const R_DECK = reg(40, { sp: 0.85, wt: 1.0, fn: toVPpx(VP1[0], VP1[1]), maxL: 40, wob: 0.1, bow: 0.1, off: [0, 1.3, -0.95, 'V'] });
    const R_BSIDE = reg(41, { sp: 0.8, wt: 1.0, fn: toVPpx(VP1[0], VP1[1]), maxL: 40, wob: 0.1, bow: 0.1, off: [0, 'V', 0.6, -0.6] });
    const R_PIER = reg(42, { sp: 0.85, wt: 1.0, fn: () => Math.PI / 2, maxL: 50, wob: 0.15, off: [0, 0.5, -0.5, 1.5708] });
    const R_SMOKE = reg(50, { sp: 0.95, wt: 0.95, maxL: 30, minL: 6, wob: 0.18, bow: 0.3, lit: 0.6, off: [0, 0.8, -0.75, 1.5708] });
    const R_WING = reg(60, { sp: 0.95, wt: 1.1, maxL: 40, minL: 8, wob: 0.25, bow: 0.35, lit: 0.25, off: [0, 0.6, -0.55, 1.5708] });
    const R_BAL = reg(70, { sp: 0.72, wt: 1.1, maxL: 20, minL: 5, wob: 0.12, bow: 0.45, lit: 0.3, off: [0, 0.85, -0.75, 1.5708] });
    const R_HORN = reg(72, { sp: 0.55, wt: 1.0, maxL: 12, minL: 3, wob: 0.06, bow: 0.3, lit: 0.3 });
    const R_FIRE = reg(80, { sp: 0.8, wt: 0.7, maxL: 24, minL: 5, wob: 0.15, bow: 0.5, lit: 0, layers: 1 });
    const R_CLOAK = reg(90, { lit: 0.4, sp: 0.68, wt: 1.0, maxL: 34, minL: 6, wob: 0.08, bow: 0.12, off: [0, 0.8, -0.75, 1.5708] });
    const R_HAT = reg(91, { lit: 0.3, sp: 0.6, wt: 1.0, maxL: 26, minL: 5, wob: 0.06, bow: 0.15, off: [0, 0.75, -0.75, 1.5708] });
    const R_HAIR = reg(92, { lit: 0.3, sp: 0.5, wt: 0.65, maxL: 40, minL: 6, wob: 0.06, bow: 0.1, layers: 3 });
    const R_SKIN = reg(93, { lit: 0.4, sp: 0.48, wt: 0.75, maxL: 10, minL: 3, wob: 0.04 });
    const R_STEEL = reg(94, { sp: 0.45, wt: 0.7, maxL: 20, minL: 3, wob: 0.02, layers: 1 });
    const R_STAFF = reg(95, { sp: 0.42, wt: 0.9, maxL: 14, minL: 3, wob: 0.05 });
    const R_SLEEVE = reg(97, { lit: 0.45, sp: 0.64, wt: 1.0, maxL: 30, minL: 5, wob: 0.08, bow: 0.15, off: [0, 0.8, -0.75, 1.5708] });

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
      rift: [[118, -30], [182, 90], [152, 214], [200, 330], [170, 440], [212, 540], [196, 612], [262, 660], [352, 642], [372, 560], [404, 470], [386, 350], [432, 240], [412, 110], [462, -30]],
      eyeF: 0.56, glow: [880, 1080], glowR: 760, wallZ: 90,
      pillars: [
        { x: -11.8, z: 10.5, w: 3.2, near: true, rune: 1 },
        { x: 7.8, z: 17.5, w: 3.0, near: true, rune: 1 },
        { x: 13, z: 36, w: 3.0, rune: 0.6 },
        { x: -30, z: 70, w: 3.0, rune: 0.5 },
      ],
    };
    const B0 = L.bal, bs = L.balS, BX = xf(B0, bs);
    const W0 = L.wiz, ws = L.wizS, WX = xf(W0, ws);
    L.blaze = WX([[-31, -178]])[0];

    // base: cave darkness everywhere
    tctx.fillStyle = gray(0.9); tctx.fillRect(0, 0, SW, SH);
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
      const levels = portrait ? [-11, -21, -33, -47, -63] : [-10, -19, -30, -43, -58];
      levels.forEach((top, j) => {
        const hgt = 4.2 - j * 0.2, bot = top - hgt;
        let x = -200 + R() * 8;
        const arches = [];
        while (x < 120) {
          const runLen = RR(14, 60);
          const gap = RR(4, 26);
          const pitch = RR(2.9, 3.6);
          for (let xx = x; xx < x + runLen; xx += pitch) {
            const w = pitch * 0.62, r = w / 2;
            const pts = [[xx, bot, ZW], [xx + w, bot, ZW]];
            for (let a = 0; a <= 8; a++) { const t = a / 8 * Math.PI; pts.push([xx + r + r * Math.cos(t), top - r + r * Math.sin(t) * 1.1, ZW]); }
            const pp = clipPoly(pts);
            if (pp.length < 3 || pp[0][0] < -30 || pp[0][0] > SW + 30) continue;
            const path = polyPath(pp);
            const v = clamp(0.55 - j * 0.07 + RR(-0.06, 0.06), 0.2, 0.8);
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
      const eyeH = 1.0;
      const towerX = L.tower[0] * hk - x0;
      const cxp = (rb[0] + rw * 0.45) * hk - x0;
      // peaks: [fraction across the rift, distance km, height km, half-width as a fraction of the rift]
      const peakF = portrait
        ? [[0.1, 24, 2.6, 0.14], [0.32, 38, 3.6, 0.16], [0.8, 28, 2.9, 0.14], [0.98, 50, 3.6, 0.14], [0.6, 70, 4.2, 0.1]]
        : [[0.08, 26, 2.8, 0.13], [0.3, 40, 3.8, 0.15], [0.82, 30, 3.1, 0.13], [1.0, 52, 3.8, 0.13], [0.62, 72, 4.4, 0.1]];
      const peaks = peakF.map(([f, z, h, w]) => [((rb[0] + rw * f) * hk - x0 - cxp) / Fz, z, h, w * rw * hk / Fz]);
      const towerAng = (towerX - cxp) / Fz;
      const H = (x, z) => {
        let h = 0, a = 1, f = 0.22, w = 1;
        for (let i = 0; i < 6; i++) {
          const n = nz(x * f + i * 31.7 + 100, z * f * 0.6 + i * 17.1);
          let r = 1 - Math.abs(2 * n - 1); r = r * r;
          h += r * a * w; w = clamp(r * 1.6, 0, 1); a *= 0.48; f *= 2.15;
        }
        h = h * 0.9;
        const ang = x / z;
        for (const pk of peaks) {
          const d = Math.hypot((ang - pk[0]) / pk[3], (z - pk[1]) / (pk[1] * 0.12));
          if (d < 1.6) h += pk[2] * Math.pow(Math.max(0, 1 - d / 1.6), 1.5);
        }
        const dv = (ang - towerAng) / 0.045;
        h *= 1 - 0.85 * Math.exp(-dv * dv) * smooth(12, 26, z);
        h *= 1 - smooth(70, 100, z) * 0.9;
        return h;
      };
      const Lx = -0.7, Ly = 0.55, Lz = 0.45; const Ll = Math.hypot(Lx, Ly, Lz);
      const sky = new Float32Array(W2).fill(H2);
      for (let c = 0; c < W2; c++) {
        let ymin = H2;
        const dirx = (c - cxp) / Fz;
        for (let z = 6; z < 240; z *= 1.01) {
          const x = dirx * z;
          const h = H(x, z);
          const v = hzp - Fz * (h - eyeH) / z + Fz * (z * z / 12742) / z;
          if (v < ymin) {
            const e = 0.02 + z * 0.0015;
            const hx = (H(x + e, z) - H(x - e, z)) / (2 * e), hzz = (H(x, z + e) - H(x, z - e)) / (2 * e);
            const nl = Math.hypot(hx, 1, hzz);
            const lam = (-hx * Lx + Ly - hzz * Lz) / (nl * Ll);
            const slope = Math.hypot(hx, hzz);
            const snowline = 0.95 + 0.5 * (nz(x * 3, z * 0.5) - 0.5);
            const snow = smooth(snowline - 0.2, snowline + 0.15, h) * (1 - smooth(1.2, 2.2, slope));
            const lit = clamp(lam, 0, 1);
            let tone = snow > 0.5 ? lerp(0.55, 0.0, Math.pow(lit, 0.7)) : lerp(0.92, 0.5, lit);
            const fog = clamp(smooth(25, 140, z) * 0.7 + (1 - smooth(0.15, 0.9, h)) * 0.5, 0, 0.85);
            tone = lerp(tone, 0.2, fog);
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
        tStroke(arc, 0.66 + 0.1 * R(), er * (0.6 + 0.4 * R()), 2, 0.55);
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
      const rg = tctx.createRadialGradient(gx, gy, 10, gx, gy, lay.glowR);
      rg.addColorStop(0, 'rgba(255,255,255,0.85)'); rg.addColorStop(0.3, 'rgba(255,255,255,0.5)'); rg.addColorStop(0.7, 'rgba(255,255,255,0.12)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
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
      const x0 = -3.4, x1 = 3.4, za = zB, zb = zB + 6, yb = -95, yt = -0.05;
      const faces = [{ k: 'B', w: [[x0, yb, za], [x1, yb, za], [x1, yt, za], [x0, yt, za]] }, { k: 'A', w: [[x1, yb, za], [x1, yb, zb], [x1, yt, zb], [x1, yt, za]] }];
      L.pierFaces = [];
      for (const f of faces) {
        const pp = clipPoly(f.w); const path = polyPath(pp);
        const g = tctx.createLinearGradient(0, B0[1], 0, SH);
        g.addColorStop(0, gray(0.9)); g.addColorStop(0.5, gray(0.82)); g.addColorStop(1, gray(0.6));
        tctx.fillStyle = g; tctx.fill(path);
        F(path, 0, f.k === 'A' ? R_FACE_A : R_PIER);
        L.pierFaces.push(pp);
      }
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
    }

    /* ---------------------------------------------------------- smoke: a column boiling up behind the demon */
    const billows = [];
    function billow(cx, cy, r, vTop, vBot, sq) {
      OBJ = O.SMOKE;
      const idx = billows.length + 1;
      sq = sq || 1;
      billows.push({ cx, cy, r, sq });
      const g = tctx.createLinearGradient(0, cy - r * sq, 0, cy + r * sq);
      g.addColorStop(0, gray(vTop)); g.addColorStop(0.6, gray(lerp(vTop, vBot, 0.55))); g.addColorStop(1, gray(vBot));
      const p = new Path2D(); p.ellipse(cx, cy, r, r * sq, 0, 0, TAU);
      tctx.fillStyle = g; tctx.fill(p);
      F(p, 0, R_SMOKE);
      octx2.fillStyle = 'rgb(' + (idx & 255) + ',' + (idx >> 8) + ',255)'; octx2.fill(p);
    }
    {
      const cx = B0[0] + 12 * bs, base = B0[1] + 20 * bs;
      const top = -60;
      for (let i = 0; i < 80; i++) {
        const t = i / 80;
        const y = lerp(base, top, t);
        const spread = (34 + 90 * t) * bs;
        const x = cx + (R() - 0.5) * 2 * spread + 20 * bs * t;
        const r = (11 + 20 * R()) * bs * (0.75 + 0.6 * t);
        const nearFire = 1 - smooth(0.05, 0.7, t);
        billow(x, y, r, clamp(0.8 - 0.12 * R(), 0, 1), clamp(0.55 - 0.32 * nearFire + 0.1 * R(), 0.15, 1), 0.85 + 0.25 * R());
      }
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
    // the pose: hunched toward the wizard, near arm raised with the sword, far arm low with the whip
    const BP = {
      shN: [-22, -80], elbowN: [-38, -90], fistN: [-50, -103],
      shF: [15, -82], elbowF: [25, -63], fistF: [41, -48],
      head: [-20, -92],
    };
    const mid = (a, b, t) => [lerp(a[0], b[0], t == null ? 0.5 : t), lerp(a[1], b[1], t == null ? 0.5 : t)];
    const BAL_PARTS = [
      // far leg (mostly lost in smoke)
      { nm: 'thighF', p: ell([10, -29], 10.5, 7.2, axis([8, -38], [12, -20])), th: axis([8, -38], [12, -20]) + 1.57, v: 0.96 },
      { nm: 'calfF', p: ell([13.5, -12], 8.2, 5, axis([12, -20], [15, -4])), th: 0.1, v: 0.96 },
      { nm: 'footF', p: ell([17, -2], 6, 2.4, 0), th: 0, v: 0.96 },
      // far arm, hanging with the whip
      { nm: 'bicepsF', p: ell(mid(BP.shF, BP.elbowF), 11, 6.6, axis(BP.shF, BP.elbowF)), th: axis(BP.shF, BP.elbowF) + 1.57, v: 0.95 },
      { nm: 'forearmF', p: limb(BP.elbowF, BP.fistF, 6.2, 4.4), th: axis(BP.elbowF, BP.fistF) + 1.57, v: 0.95 },
      { nm: 'flexorF', p: ell(mid(BP.elbowF, BP.fistF, 0.35), 7.5, 5.4, axis(BP.elbowF, BP.fistF)), th: axis(BP.elbowF, BP.fistF) + 1.57, v: 0.95 },
      { nm: 'fistF', p: ell(BP.fistF, 5, 4.6, 0.3), th: 0.5, v: 0.93 },
      // near leg striding forward
      { nm: 'thighN', p: ell([-14, -29], 11.5, 8, axis([-10, -38], [-19, -20])), th: axis([-10, -38], [-19, -20]) + 1.57, v: 0.95 },
      { nm: 'calfN', p: ell([-18.5, -12], 9, 5.6, axis([-19, -20], [-17, -4])), th: 0.05, v: 0.95 },
      { nm: 'footN', p: ell([-21, -2], 7.5, 2.6, 0), th: 0, v: 0.95 },
      // trunk
      { nm: 'trunk', p: [[-30, -82], [-8, -88], [16, -88], [25, -80], [20, -66], [14, -50], [12, -38], [-14, -36], [-19, -48], [-25, -62]], th: 0.05, v: 0.95 },
      { nm: 'pelvis', p: ell([-1, -39], 15, 7.5, 0), th: 0.05, v: 0.95 },
      { nm: 'belly', p: ell([-3, -53], 13, 11, 0.05), th: 0.02, v: 0.94 },
      { nm: 'ribs', p: ell([-3, -70], 21, 14, -0.1), th: -0.2, v: 0.94 },
      { nm: 'pecF', p: ell([8, -76], 12, 8.5, -0.2), th: -0.6, v: 0.95 },
      { nm: 'pecN', p: ell([-14, -74], 13, 9, 0.28), th: -0.5, v: 0.92 },
      { nm: 'hump', p: ell([1, -87], 14, 7.5, 0.1), th: 0.4, v: 0.96 },
      { nm: 'shF', p: ell(BP.shF, 8.5, 8.5, 0.4), th: 1.0, v: 0.95 },
      { nm: 'neck', p: limb([-6, -84], [-15, -89], 7.5, 6), th: 0.5, v: 0.95 },
      // head: heavy brow, long muzzle, the jaw dropped open
      { nm: 'head', p: [[-9, -90], [-13, -96.5], [-19, -98.6], [-25, -97.4], [-28.5, -95.4], [-31, -93.6], [-30.4, -92.2], [-32.6, -91], [-35.6, -89.6], [-36, -88], [-33.6, -87], [-28, -86.2], [-33.4, -84.6], [-33, -83.2], [-29.8, -81.6], [-25.5, -80.6], [-20.5, -81.2], [-15.5, -83.2], [-11, -86]], th: 1.2, v: 0.92 },
      // near shoulder and the raised sword arm
      { nm: 'shN', p: ell(BP.shN, 8.6, 8.2, 0.6), th: -0.9, v: 0.9 },
      { nm: 'bicepsN', p: ell(mid(BP.shN, BP.elbowN, 0.48), 10.5, 6.6, axis(BP.shN, BP.elbowN)), th: axis(BP.shN, BP.elbowN) + 1.57, v: 0.9 },
      { nm: 'forearmN', p: limb(BP.elbowN, BP.fistN, 5.8, 4.2), th: axis(BP.elbowN, BP.fistN) + 1.57, v: 0.9 },
      { nm: 'flexorN', p: ell(mid(BP.elbowN, BP.fistN, 0.33), 7.6, 5.2, axis(BP.elbowN, BP.fistN)), th: axis(BP.elbowN, BP.fistN) + 1.57, v: 0.9 },
      { nm: 'fistN', p: ell(BP.fistN, 5.2, 4.9, 0), th: 0.4, v: 0.88 },
    ];
    const BAL_HORNS = [
      [[-16, -97], [-22, -102], [-29, -104], [-35, -108], [-37.5, -115.5], [-34, -122]],
      [[-11, -96.5], [-7, -103], [-1, -107.5], [5, -110], [8, -117], [5, -123.5]],
    ];

    /* ---------------------------------------------------------- the Balrog: wings of shadow */
    function wingShape(side) {
      // leading edge: a smooth sweep from the shoulder to the tip; trailing edge: scalloped, fraying into smoke
      const root = [side * 6, -88];
      const tip = portrait ? [side * 78, -150] : [side * 92, -124];
      const lead = spline([root, [side * 20, -106], [side * 44, (portrait ? -128 : -118)], [side * 66, (portrait ? -144 : -126)], tip], false, 10);
      const attach = [side * 34, -66];
      const trail = [];
      const nF = 6;
      for (let i = 0; i <= nF * 4; i++) {
        const t = i / (nF * 4);
        // bow outward and downward between tip and attach point
        const bx = lerp(tip[0], attach[0], t), by = lerp(tip[1], attach[1], t);
        const bowA = Math.sin(Math.PI * t) * (portrait ? 14 : 18);
        const ph = (i % 4) / 4;
        const finger = ph === 0 ? 1 : ph === 2 ? -0.5 : 0.2;
        const ox = side * (bowA * 0.5 + finger * 7 * (1 - t * 0.5)) + (R() - 0.5) * 3;
        const oy = bowA + finger * 9 * (1 - t * 0.4) + (R() - 0.5) * 3;
        trail.push([bx + ox, by + oy]);
      }
      const outline = lead.concat(trail.slice(1));
      const fingers = trail.filter((p, i) => i % 4 === 0 && i > 0 && i < nF * 4);
      return { root, tip, outline, fingers, lead };
    }
    function wing(side) {
      OBJ = O.WING;
      const ws_ = wingShape(side);
      const W = BX(ws_.outline);
      const path = polyPath(W);
      const root = BX([ws_.root])[0];
      const g = tctx.createRadialGradient(root[0], root[1], 10, root[0], root[1], 110 * bs);
      g.addColorStop(0, gray(0.97)); g.addColorStop(0.55, gray(0.9)); g.addColorStop(1, gray(0.74));
      tctx.fillStyle = g; tctx.fill(path);
      F(path, Math.atan2(ws_.tip[1] - ws_.root[1], ws_.tip[0] - ws_.root[0]), R_WING);
      fctx.save(); fctx.clip(path);
      const bones = [];
      for (const fp of [ws_.tip].concat(ws_.fingers)) {
        const bone = [ws_.root, [lerp(ws_.root[0], fp[0], 0.35), lerp(ws_.root[1], fp[1], 0.35) - 5], [lerp(ws_.root[0], fp[0], 0.72), lerp(ws_.root[1], fp[1], 0.72) - 3], fp];
        const bp = BX(spline(bone, false, 8));
        bones.push(bp);
        flowAlong(bp, R_WING, 26 * bs);
      }
      fctx.restore();
      // the membrane thins toward the trailing edge: fire-lit smoke glimmers through
      tctx.save(); tctx.clip(path);
      for (let i = 1; i < bones.length; i++) {
        const a = bones[i - 1], b = bones[i];
        const mid = a.slice(Math.floor(a.length * 0.55)).map((p, j) => { const q = b[Math.min(b.length - 1, Math.floor(b.length * 0.55) + j)]; return [lerp(p[0], q[0], 0.5), lerp(p[1], q[1], 0.5)]; });
        tStroke(mid, 0.62, 7 * bs, 4 * bs, 0.5);
      }
      for (const bp of bones) tStroke(bp, 0.99, 3 * bs, 1.5 * bs, 0.9);
      tctx.restore();
      return { W, bones, path, lead: BX(ws_.lead) };
    }
    L.wingL = wing(-1);
    L.wingR = wing(1);

    /* ---------------------------------------------------------- the Balrog: body */
    const balShapes = {};
    {
      OBJ = O.BAL;
      const clipAll = new Path2D();
      for (const part of BAL_PARTS) {
        const poly = BX(part.p);
        part.u = poly;
        const path = polyPath(poly);
        clipAll.addPath(path);
        tctx.fillStyle = gray(part.v); tctx.fill(path);
        F(path, part.th, R_BAL);
      }
      L.balClip = clipAll;
      // modelling: the staff's cool light on planes turned toward the wizard, fire rims behind and below
      tctx.save(); tctx.clip(clipAll);
      const lightN = [
        offsetLine(BX(spline([BP.shN, BP.elbowN, BP.fistN], false, 8)), 4.2 * bs),
        BX(spline([[-26, -70], [-20, -67], [-12, -66.5], [-4, -68]], false, 8)),
        BX(spline([[-29, -80], [-28, -74], [-25, -66], [-21, -58]], false, 8)),
        BX(spline([[-30, -92], [-33, -89.5], [-30, -86.5]], false, 6)),
        BX(spline([[-17, -50], [-16, -44], [-13, -38]], false, 6)),
      ];
      for (const l of lightN) tStroke(l, 0.45, 3.2 * bs, 1.8 * bs, 0.8);
      const rims = [
        BX(spline([[8, -92], [16, -90], [22, -85], [23, -78]], false, 8)),
        BX(spline([[22, -76], [30, -64], [38, -54], [45, -48]], false, 8)),
        BX(spline([[19, -62], [15, -50], [13, -42], [14, -34]], false, 8)),
        BX(spline([[-13, -97.5], [-8, -95], [-6, -91]], false, 6)),
      ];
      for (const l of rims) tStroke(l, 0.5, 2.6 * bs, 1.4 * bs, 0.75);
      tctx.restore();
      fctx.save(); fctx.clip(clipAll);
      // pectoral fibres fan from the sternum to the shoulders; abdominal bands
      for (let i = 0; i < 6; i++) flowAlong(BX(spline([[-3, -69 + i * 1.6], [-11, -73 + i * 0.7], [-19, -77 + i * 0.4], [-24, -79]], false, 6)), R_BAL, 4 * bs);
      for (let i = 0; i < 6; i++) flowAlong(BX(spline([[-1, -71 + i * 1.5], [7, -75 + i * 0.6], [15, -80 + i * 0.4]], false, 6)), R_BAL, 4 * bs);
      fctx.restore();
      // horns: ridged, curling forward
      balShapes.horns = [];
      for (const hc of BAL_HORNS) {
        const h = BX(spline(hc, false, 8));
        const outline = offsetLine(h, (f) => (1 - f * 0.9) * 3.3 * bs).concat(offsetLine(h, (f) => -(1 - f * 0.9) * 3.3 * bs).reverse());
        const hp = polyPath(outline);
        const g = tctx.createLinearGradient(h[0][0], h[0][1], h[h.length - 1][0], h[h.length - 1][1]);
        g.addColorStop(0, gray(0.85)); g.addColorStop(1, gray(0.45));
        tctx.fillStyle = g; tctx.fill(hp);
        F(hp, 0, R_HORN);
        fctx.save(); fctx.clip(hp); flowAlong(h, R_HORN, 12 * bs, Math.PI / 2); fctx.restore();
        balShapes.horns.push({ h, outline });
      }
    }

    /* ---------------------------------------------------------- fire: the mane, the feet, the sword, the whip */
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
      tctx.fillStyle = gray(opt.v != null ? opt.v : 0.05); tctx.fill(path);
      F(path, ang, R_FIRE);
      return fl;
    }
    function fireMass(pts, w, v) { OBJ = O.FIRE; tStroke(pts, v, w, w * 0.45, 0.85); }
    {
      // the mane: fire streaming up and back from skull, nape and hump, like hair in a gale
      const roots = [[-24, -98], [-20, -99], [-16, -98.8], [-12, -97], [-8, -94], [-3, -93], [2, -93], [7, -92.5], [12, -91], [17, -89.5], [21, -87]];
      const massLine = BX(spline([[-16, -104], [0, -112], [20, -124], [40, -136]], false, 8));
      fireMass(massLine, 16 * bs, 0.12);
      for (let pass = 0; pass < 3; pass++) {
        for (const r of roots) {
          const [x, y] = BX([[r[0] + RR(-1.5, 1.5), r[1] + RR(-1.5, 1.5)]])[0];
          const ang = -1.15 + RR(-0.3, 0.3) + (r[0] + 20) / 90;
          const len = RR(30, 72) * bs * (pass === 0 ? 1 : pass === 1 ? 0.72 : 0.45);
          tongue(x, y, ang, len, RR(1.8, 3.8) * bs, { bend: RR(0.1, 0.7), amp: RR(0.06, 0.16), mane: true });
        }
      }
      // fire licking up out of the smoke about its feet
      fireMass(BX(spline([[-40, -4], [-20, -8], [0, -6], [24, -4]], false, 8)), 14 * bs, 0.16);
      for (let i = 0; i < 16; i++) {
        const [x, y] = BX([[RR(-42, 30), RR(-14, 2)]])[0];
        tongue(x, y, -Math.PI / 2 + RR(-0.5, 0.5), RR(10, 30) * bs * (R() < 0.3 ? 1.6 : 1), RR(2.2, 4.4) * bs, { bend: RR(-0.6, 0.6), amp: RR(0.06, 0.14), foot: true });
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
      const fist = BX([[BP.fistF[0] + 3, BP.fistF[1] + 2]])[0];
      const goal = WX([[60, -30]])[0];
      L.whip = [];
      const nT = 7;
      for (let i = 0; i < nT; i++) {
        const s = (i - (nT - 1) / 2) / ((nT - 1) / 2);
        const c1 = [fist[0] + (16 + s * 4) * bs, fist[1] + (12 + s * 3) * bs];
        const c2 = [fist[0] + (6 + s * 8) * bs, fist[1] + (34 + s * 4) * bs];
        const c3 = [lerp(fist[0], goal[0], 0.42) + s * 6 * bs, lerp(fist[1], goal[1], 0.55) + (10 + s * 7) * bs];
        const c4 = [lerp(fist[0], goal[0], 0.78) + s * 9 * bs, lerp(fist[1], goal[1], 0.82) + (2 + s * 9) * bs];
        const end = [goal[0] + s * 12 * bs + RR(-3, 3) * bs, goal[1] + s * 9 * bs + RR(-3, 3) * bs];
        const curl = [end[0] + RR(2, 10) * bs, end[1] - RR(6, 14) * bs];
        const curl2 = [curl[0] + RR(4, 8) * bs, curl[1] + RR(-2, 4) * bs];
        L.whip.push(spline([fist, c1, c2, c3, c4, end, curl, curl2], false, 14));
      }
      OBJ = O.FIRE;
      for (const th of L.whip) tStroke(th, 0.1, 1.8 * bs, 1.2 * bs, 0.55);
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

    /* ---------------------------------------------------------- the wizard */
    const wizShapes = {};
    {
      OBJ = O.WIZ;
      const S = (pts, per) => WX(spline(pts, true, per || 6));
      wizShapes.cloak = S([[2, -86], [9, -85], [14, -82], [18, -78], [22, -72], [26, -67], [30, -63], [33, -60], [30, -55], [26, -52], [25, -42], [26, -30], [28, -18], [30, -8], [31, -3], [25, -1], [19, -3], [13, -0.5], [7, -3], [1, -1], [-5, -3], [-11, -1], [-17, -4], [-23, -3], [-29, -7], [-37, -9], [-46, -13], [-55, -19], [-61, -23], [-56, -27], [-60, -32], [-50, -34], [-44, -41], [-38, -50], [-31, -60], [-25, -68], [-19, -74], [-14, -80], [-8, -85]]);
      wizShapes.hood = S([[-11, -86], [-3, -88], [6, -88], [13, -85], [14, -80], [7, -78], [-2, -78], [-10, -80]]);
      wizShapes.sleeveL = S([[-13, -81], [-15, -90], [-17, -100], [-18, -110], [-19, -117], [-23, -119], [-28, -118], [-32, -112], [-36, -104], [-38, -95], [-37, -87], [-32, -80], [-25, -75], [-19, -75]]);
      wizShapes.sleeveR = S([[26, -66], [31, -68], [36, -68], [40, -67], [42, -64], [41, -60], [37, -57], [33, -55], [29, -57], [26, -60]]);
      wizShapes.handL = S([[-18, -117], [-19, -124], [-24, -127], [-28, -123], [-27, -118], [-22, -116]], 5);
      wizShapes.handR = S([[40, -67], [44, -69], [47, -66], [45, -62], [41, -62]], 5);
      wizShapes.brim = S([[-17, -91], [-9, -93.5], [2, -94.5], [13, -93], [18, -91], [11, -89], [0, -88.5], [-10, -89]], 6);
      wizShapes.crown = S([[-7, -93], [-8, -101], [-10, -109], [-14, -117], [-19, -123], [-25, -127], [-30, -128], [-26, -124], [-19, -118], [-12, -111], [-5, -104], [2, -98], [7, -93.5], [0, -92.5]], 6);
      wizShapes.hair = S([[-10, -89], [-3, -88.5], [5, -88.5], [11, -88], [14, -84], [12, -80], [6, -81], [0, -83], [-6, -83], [-13, -84], [-20, -83], [-16, -87]], 6);
      wizShapes.beard = S([[11, -88], [15, -86], [18, -82], [19, -77], [17, -72], [13, -70], [9, -72], [10, -78], [10, -84]], 6);
      wizShapes.bootR = S([[3, -4], [9, -5], [14, -3], [15, 1], [9, 2], [2, 1], [0, -1]], 5);
      wizShapes.bootL = S([[16, -9], [22, -11], [28, -10], [29, -7], [23, -6], [17, -6]], 5);
      wizShapes.staff = WX(spline([[-15, -90], [-19, -112], [-23, -133], [-27, -155], [-31, -174]], false, 10));
      const gl0 = [46, -67], gl1 = [86, -104];
      wizShapes.sword = { a: WX([gl0])[0], b: WX([gl1])[0] };

      const cloakP = polyPath(wizShapes.cloak);
      {
        const g = tctx.createLinearGradient(W0[0] - 50 * ws, W0[1] - 95 * ws, W0[0] + 30 * ws, W0[1]);
        g.addColorStop(0, gray(0.22)); g.addColorStop(0.35, gray(0.45)); g.addColorStop(0.8, gray(0.66)); g.addColorStop(1, gray(0.74));
        tctx.fillStyle = g; tctx.fill(cloakP);
        F(cloakP, Math.PI / 2, R_CLOAK);
      }
      const folds = [
        [[-20, -72], [-12, -60], [-4, -46], [2, -30], [4, -14], [5, -2]],
        [[-24, -68], [-20, -54], [-16, -38], [-14, -20], [-14, -3]],
        [[-26, -64], [-32, -50], [-40, -36], [-50, -24], [-58, -21]],
        [[-30, -56], [-38, -44], [-46, -32], [-54, -28]],
        [[10, -80], [12, -62], [13, -44], [14, -26], [15, -4]],
        [[18, -74], [19, -58], [20, -40], [22, -22], [23, -3]],
        [[26, -54], [24, -40], [24, -26], [25, -12], [26, -3]],
        [[2, -82], [1, -66], [-2, -50], [-6, -32], [-8, -14], [-9, -2]],
      ];
      L.folds = folds.map((f) => WX(spline(f, false, 8)));
      tctx.save(); tctx.clip(cloakP); fctx.save(); fctx.clip(cloakP);
      for (const fp of L.folds) {
        tStroke(offsetLine(fp, 2.4 * ws), 0.86, 3.2 * ws, 2 * ws, 0.7);
        tStroke(offsetLine(fp, -2.2 * ws), 0.2, 2.6 * ws, 2 * ws, 0.5);
        flowAlong(fp, R_CLOAK, 9 * ws);
      }
      tStroke(WX(spline([[-30, -8], [-10, -4], [10, -4], [30, -4]], false, 6)), 0.88, 6 * ws, 3 * ws, 0.6);
      tStroke(WX(spline([[-12, -77], [0, -75], [12, -77]], false, 6)), 0.9, 4 * ws, 2 * ws, 0.7);
      tctx.restore(); fctx.restore();
      const sL = polyPath(wizShapes.sleeveL), sR = polyPath(wizShapes.sleeveR);
      {
        const g = tctx.createLinearGradient(W0[0] - 38 * ws, W0[1] - 118 * ws, W0[0] - 14 * ws, W0[1] - 78 * ws);
        g.addColorStop(0, gray(0.1)); g.addColorStop(0.5, gray(0.35)); g.addColorStop(1, gray(0.7));
        tctx.fillStyle = g; tctx.fill(sL);
        F(sL, -1.2, R_SLEEVE);
        fctx.save(); fctx.clip(sL);
        flowAlong(WX(spline([[-16, -78], [-21, -92], [-24, -106], [-24, -118]], false, 6)), R_SLEEVE, 8 * ws);
        flowAlong(WX(spline([[-26, -78], [-33, -90], [-35, -102], [-29, -114]], false, 6)), R_SLEEVE, 8 * ws);
        fctx.restore();
        const g2 = tctx.createLinearGradient(W0[0] + 26 * ws, W0[1] - 68 * ws, W0[0] + 40 * ws, W0[1] - 56 * ws);
        g2.addColorStop(0, gray(0.5)); g2.addColorStop(1, gray(0.75));
        tctx.fillStyle = g2; tctx.fill(sR);
        F(sR, 0.6, R_SLEEVE);
      }
      const fl = (nm, v, rid, th) => { const p = polyPath(wizShapes[nm]); tctx.fillStyle = gray(v); tctx.fill(p); F(p, th, rid); };
      fl('hood', 0.62, R_CLOAK, 0.2);
      fl('hair', 0.14, R_HAIR, -0.2);
      fl('beard', 0.12, R_HAIR, 1.9);
      fl('handL', 0.3, R_SKIN, 0.8);
      fl('handR', 0.5, R_SKIN, 0.8);
      fl('bootR', 0.88, R_SKIN, 0.2);
      fl('bootL', 0.82, R_SKIN, 0.2);
      const crP = polyPath(wizShapes.crown), brP = polyPath(wizShapes.brim);
      {
        const g = tctx.createLinearGradient(W0[0] - 28 * ws, 0, W0[0] + 8 * ws, 0);
        g.addColorStop(0, gray(0.1)); g.addColorStop(0.55, gray(0.38)); g.addColorStop(1, gray(0.72));
        tctx.fillStyle = g; tctx.fill(crP); F(crP, -1.0, R_HAT);
        const g2 = tctx.createLinearGradient(W0[0] - 17 * ws, 0, W0[0] + 19 * ws, 0);
        g2.addColorStop(0, gray(0.3)); g2.addColorStop(0.6, gray(0.55)); g2.addColorStop(1, gray(0.75));
        tctx.fillStyle = g2; tctx.fill(brP); F(brP, -0.05, R_HAT);
      }
      OBJ = O.STAFF;
      tStroke(wizShapes.staff, 0.7, 2.2 * ws, 0);
      fctx.save(); fctx.lineWidth = 2.2 * ws; fctx.strokeStyle = flowc(0.2, R_STAFF); fctx.stroke(polyPath(wizShapes.staff, true)); fctx.restore();
      bctx.save(); bctx.lineWidth = 2.2 * ws; bctx.strokeStyle = 'rgb(' + O.STAFF + ',0,0)'; bctx.stroke(polyPath(wizShapes.staff, true)); bctx.restore();
      OBJ = O.SWORD;
      {
        const { a, b } = wizShapes.sword;
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang), ny = Math.cos(ang), w = 1.25 * ws;
        const bl = [[a[0] + nx * w, a[1] + ny * w], [lerp(a[0], b[0], 0.88) + nx * w * 0.85, lerp(a[1], b[1], 0.88) + ny * w * 0.85], [b[0], b[1]], [lerp(a[0], b[0], 0.88) - nx * w * 0.85, lerp(a[1], b[1], 0.88) - ny * w * 0.85], [a[0] - nx * w, a[1] - ny * w]];
        wizShapes.blade = bl;
        const bp = polyPath(bl); tctx.fillStyle = gray(0.04); tctx.fill(bp); F(bp, ang, R_STEEL);
      }
    }

    /* ---------------------------------------------------------- sparks where light meets flame */
    L.sparks = [];
    {
      const c0 = L.clash;
      for (let i = 0; i < 170; i++) {
        const a = R() * TAU, d = Math.pow(R(), 1.8) * 200;
        L.sparks.push([c0[0] + Math.cos(a) * d * 1.3, c0[1] + Math.sin(a) * d * 0.9, RR(0.6, 2.0), a]);
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
    }
    // lights: the staff's white blaze, and the demon's fire
    {
      const [bx, by] = L.blaze;
      const fx = B0[0] + 4 * bs, fy = B0[1] - 70 * bs;
      const r1 = 1 / (150 * 150), r2 = 1 / (440 * 440), r3 = 1 / (240 * 240);
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
          const l = (0.78 * Math.exp(-d2 * r1) + 0.32 * Math.exp(-d2 * r2) + 0.22 * Math.exp(-f2 * r3)) * lit;
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
      { thr: 0.03, rng: 0.5, cmax: 0.47 },
      { thr: 0.33, rng: 0.4, cmax: 0.42 },
      { thr: 0.57, rng: 0.3, cmax: 0.44 },
      { thr: 0.79, rng: 0.17, cmax: 0.5 },
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
      const cov = (t) => { const c = (t - Ly.thr) / Ly.rng; return c <= 0 ? 0 : (c >= 1 ? Ly.cmax : c * Ly.cmax); };
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
        if (cov(samp(T, x, y)) <= 0.01) return;
        const sep = SEP * rg.sp;
        if (near(x, y, sep * 0.92, r, -1)) return;
        const line = ++lineNo;
        const maxL = sep * (rg.minL + (rg.maxL - rg.minL) * R());
        const nb = trace(x, y, r, sep, -1, line, maxL * 0.5, tmpX, tmpY);
        const nf = trace(x, y, r, sep, 1, line, maxL * 0.5, bufX, bufY);
        const n = nb + nf + 1;
        if (n < 3 || (n - 1) * Math.max(1.1, sep * 0.3) < sep * 1.2) return;
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
      let x0 = hw, y0 = hh, x1 = -1, y1 = -1;
      for (let y = 0; y < hh; y++) { const row = y * hw; for (let x = 0; x < hw; x++) if (m[OIDA[row + x]]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      if (x1 < 0) return [];
      x0 -= 1; y0 -= 1; x1 += 1; y1 += 1;
      const ins = (x, y) => (x >= 0 && y >= 0 && x < hw && y < hh && m[OIDA[y * hw + x]]) ? 1 : 0;
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
        ln(fp(0, y), fp(gapAt, y), { w: 0.5 * wv, a: 0.85, wob: 0.2, taper: [0.05, 0.05] });
        ln(fp(gapAt + 0.04, y), fp(1, y), { w: 0.5 * wv, a: 0.85, wob: 0.2, taper: [0.05, 0.05] });
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
        const yA = 2.0, yB = 3.5;
        ln(fp(0, yA), fp(1, yA), { w: 0.9 * wv, a: 0.95, wob: 0.1, taper: [0, 0] });
        ln(fp(0, yB), fp(1, yB), { w: 0.9 * wv, a: 0.95, wob: 0.1, taper: [0, 0] });
        const nG = 7;
        for (let i = 0; i < nG; i++) {
          const u0 = 0.06 + i * (0.88 / nG), u1 = u0 + 0.88 / nG * 0.7;
          for (const s of runeGlyph()) {
            const w3 = s.map(([gu, gv]) => fp(lerp(u0, u1, gu), lerp(yB - 0.22, yA + 0.22, gv)));
            if (w3.some((p) => C3(...p)[2] < ZN)) continue;
            const pts = w3.map((p) => P(...p));
            pen(pts, { w: 0.9 * wv, a: 0.95, wob: 0.03, taper: [0, 0], obj });
            gpen(pts.map((p) => [p[0] - 0.9 * wv, p[1] - 0.7 * wv]), { w: 0.35 * wv, a: 0.5, taper: [0.2, 0.2], obj });
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
      let z = zA + 0.15, row = 0;
      while (z < zB - 0.2) {
        const len = RR(0.42, 0.6) * (1 + (z - 8) * 0.012);
        const zz = z + len;
        const zm = (row++ & 1) ? z + len * 0.5 : z;
        const s = seg3([-BW, deckY(z), z], [BW, deckY(z), z]);
        if (s) {
          const dist = C3(0, 0, z)[2];
          const wv = clamp(8 / dist, 0.35, 1.3);
          pen(s, { w: 0.55 * wv, a: 0.85, wob: 0.15, taper: [0, 0], obj: ob });
          const m = seg3([RR(-0.08, 0.08), deckY(zm), zm], [RR(-0.08, 0.08), deckY(zz), zz]);
          if (m && R() < 0.7) pen(m, { w: 0.45 * wv, a: 0.75, wob: 0.1, taper: [0, 0], obj: ob });
          if (dist < 15) {
            if (R() < 0.6) { const c = P(RR(-BW * 0.8, BW * 0.8), deckY(z + len / 2), z + len / 2); ticks(c[0], c[1], Math.atan2(VP1[1] - c[1], VP1[0] - c[0]) + 1.4 + RR(-0.3, 0.3), 3 + ((R() * 4) | 0), 5 * wv, 1.8 * wv, 0.28 * wv, 0.75, ob); }
            if (R() < 0.25) { let c = P(RR(-BW, BW), deckY(z + 0.1), z + 0.1); const cr = [c]; for (let i = 0; i < 4; i++) { c = [c[0] + RR(-6, 6) * wv, c[1] + RR(1, 4) * wv]; cr.push(c); } pen(cr, { w: 0.5 * wv, a: 0.9, taper: [0.1, 0.7], obj: ob }); }
            if (R() < 0.3) { const c = P(BW, deckY(z + len * 0.5), z + len * 0.5); pen([[c[0] - 4 * wv, c[1]], [c[0] - 1 * wv, c[1] + 3 * wv], [c[0] + 3 * wv, c[1] + 1 * wv]], { w: 0.7 * wv, a: 0.95, obj: ob }); }
          }
        }
        z = zz;
      }
      z = zA + 0.3;
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
    for (const pp of L.pierFaces) {
      pen([pp[3], pp[0]], { w: 1.0, a: 0.9, wob: 0.2, obj: O.PIER });
      pen([pp[2], pp[1]], { w: 1.0, a: 0.9, wob: 0.2, obj: O.PIER });
    }
    await tick();

    // ---- smoke: scalloped crowns of the billows
    {
      const od = octx2.getImageData(0, 0, hw, hh).data;
      const owner = (u, v) => { const x = (u * hk) | 0, y = (v * hk) | 0; if (x < 0 || y < 0 || x >= hw || y >= hh) return -1; const j = (y * hw + x) * 4; return od[j + 2] > 200 ? od[j] + (od[j + 1] << 8) - 1 : -1; };
      billows.forEach((b, bi) => {
        let run = [];
        const flushRun = () => { if (run.length > 4) pen(run, { w: RT(run[0][0], run[0][1]) > 0.55 ? 0.9 : 0.55, a: 0.85, wob: 0.15, taper: [0.3, 0.3], obj: O.SMOKE }); run = []; };
        for (let a = Math.PI * 0.92; a < Math.PI * 2.08; a += 0.06) {
          const x = b.cx + Math.cos(a) * b.r * 0.98, y = b.cy + Math.sin(a) * b.r * b.sq * 0.98;
          if (owner(x, y) === bi) run.push([x, y]); else flushRun();
        }
        flushRun();
      });
    }
    await tick();

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
      for (const ln of traceObj([O.BAL])) pen(ln, { w: 1.7, a: 1, wob: 0.25, taper: [0, 0] });
      const part = (nm) => BAL_PARTS.find((p) => p.nm === nm).u;
      const arc = (poly, a, b) => { const n = poly.length, out = []; for (let i = Math.floor(a * n); i <= Math.floor(b * n); i++) out.push(poly[i % n]); return out; };
      // the raised arm stands out in front of the chest; a few anatomical edges
      for (const nm of ['bicepsN', 'forearmN', 'flexorN', 'fistN']) pen(part(nm).concat([part(nm)[0]]), { w: 0.8, a: 0.95, wob: 0.15, taper: [0, 0], obj: ob });
      pen(arc(part('shN'), 0.05, 0.6), { w: 0.8, a: 0.9, obj: ob });
      pen(arc(part('pecN'), 0.0, 0.5), { w: 0.9, a: 0.9, obj: ob });
      pen(arc(part('pecF'), 0.05, 0.45), { w: 0.7, a: 0.85, obj: ob });
      pen(arc(part('belly'), 0.0, 0.5), { w: 0.55, a: 0.8, obj: ob });
      pen(arc(part('bicepsF'), 0.0, 0.5), { w: 0.6, a: 0.85, obj: ob });
      pen(arc(part('thighN'), 0.0, 0.5), { w: 0.6, a: 0.85, obj: ob });
      for (let i = 0; i < 3; i++) pen(BX(spline([[-13, -61 + i * 5.5], [-6, -62 + i * 5.5], [2, -61.5 + i * 5.5]], false, 6)), { w: 0.5, a: 0.75, obj: ob, taper: [0.3, 0.3] });
      pen(BX(spline([[-5, -66], [-5, -56], [-4, -45]], false, 6)), { w: 0.5, a: 0.75, obj: ob, taper: [0.3, 0.3] });
      for (let i = 0; i < 4; i++) pen(BX([[-24 + i * 1.2, -66 + i * 3.4], [-19 + i * 1.2, -64.8 + i * 3.4]]), { w: 0.6, a: 0.8, obj: ob, taper: [0.2, 0.6] });
      // bony spurs along the forearms and spine
      for (const [a0, b0] of [[BP.elbowN, BP.fistN], [BP.elbowF, BP.fistF]]) {
        for (let i = 0; i < 4; i++) {
          const t = 0.1 + i * 0.2, c = mid(a0, b0, t), an = axis(a0, b0);
          const base = BX([[c[0] + Math.cos(an - 1.57) * 4.5, c[1] + Math.sin(an - 1.57) * 4.5]])[0];
          const tipp = BX([[c[0] + Math.cos(an - 1.57) * 4.5 + Math.cos(an - 2.4) * 4, c[1] + Math.sin(an - 1.57) * 4.5 + Math.sin(an - 2.4) * 4]])[0];
          pen([base, tipp], { w: 1.4, w1: 0.2, a: 1, taper: [0, 0] });
        }
      }
      // brow, eye-socket, cheek and the line of the open jaw
      pen(BX(spline([[-31, -93.4], [-27, -94.4], [-22, -94.2], [-18, -95.4]], false, 6)), { w: 1.1, a: 1, obj: ob });
      pen(BX(spline([[-28, -86.2], [-24, -85.6], [-19, -85.4], [-15, -86.8]], false, 6)), { w: 0.8, a: 1, obj: ob });
      for (const hn of balShapes.horns) {
        const h = hn.h;
        pen(hn.outline.concat([hn.outline[0]]), { w: 1.0, a: 1, wob: 0.1, taper: [0, 0] });
        for (let i = 2; i < h.length - 3; i += 2) {
          const a = h[i - 1], b = h[i + 1];
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
          const wd = 3.3 * bs * (1 - (i / h.length) * 0.9);
          pen([[h[i][0] - Math.cos(ang) * wd, h[i][1] - Math.sin(ang) * wd], [h[i][0] + Math.cos(ang) * wd * 0.9, h[i][1] + Math.sin(ang) * wd * 0.9]], { w: 0.5, a: 0.9, wob: 0.15 });
        }
      }
      L.balEyes = [BX([[-29.2, -92.4], [-26.2, -92.0]]), BX([[-22.5, -92.8], [-20.4, -93.0]])];
      L.balMaw = BX(spline([[-33.4, -86.6], [-30, -86.0], [-27.6, -85.4], [-30.5, -84.6], [-33, -83.8]], false, 6));
      pen(L.balMaw, { w: 0.8, a: 1, obj: ob });
      for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5; const p = BX([[lerp(-35, -29, t), lerp(-86.8, -86.2, t)]])[0]; pen([p, [p[0] - 0.3, p[1] + RR(0.9, 1.8)]], { w: 0.55, a: 1, taper: [0, 0.85], obj: ob }); }
      for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; const p = BX([[lerp(-33, -29, t), lerp(-83.8, -84.4, t)]])[0]; pen([p, [p[0] + 0.3, p[1] - RR(0.8, 1.5)]], { w: 0.5, a: 1, taper: [0, 0.85], obj: ob }); }
      pen(BX([[-34.6, -89.4], [-33.4, -89.8]]), { w: 0.6, a: 1, obj: ob });
      L.veins = [];
      for (let i = 0; i < 40; i++) {
        let p = BX([[RR(-36, 30), RR(-88, -30)]])[0];
        const hx = (p[0] * hk) | 0, hy = (p[1] * hk) | 0;
        if (hx < 0 || hy < 0 || hx >= hw || hy >= hh || OIDA[hy * hw + hx] !== O.BAL) continue;
        const v = [p];
        let a = RR(0, TAU);
        for (let j = 0; j < 7; j++) { a += RR(-0.9, 0.9); p = [p[0] + Math.cos(a) * RR(1.5, 4) * bs * 0.6, p[1] + Math.sin(a) * RR(1.5, 4) * bs * 0.6]; v.push(p); }
        L.veins.push(v);
        spen(v, { w: 0.5, a: 0.85, taper: [0.2, 0.6], obj: ob });
      }
      for (const c of [[-54, -105, -2.3], [-54.5, -102, -2.6], [-53.5, -99.5, -2.9], [45, -47, 1.2], [45.5, -44.5, 1.5], [44, -42.5, 1.9]]) {
        const p = BX([[c[0], c[1]]])[0];
        const a = c[2];
        pen([p, [p[0] + Math.cos(a) * 1.4 * bs, p[1] + Math.sin(a) * 1.4 * bs], [p[0] + Math.cos(a + 0.6) * 2.4 * bs, p[1] + Math.sin(a + 0.6) * 2.4 * bs]], { w: 0.8, a: 1, taper: [0, 0.9] });
      }
    }
    // ---- flames: calligraphic tongues with broken edges
    for (const fl of flames) {
      const o = fl.outline, half = (o.length / 2) | 0;
      const fine = fl.opt.fleck ? 0.35 : fl.opt.mane ? 0.6 : 0.5;
      if (R() < 0.8) pen(sub(o.slice(0, half + 1), RR(0, 0.2), RR(0.65, 1)), { w: fine, a: 0.9, wob: 0.1, taper: [0.25, 0.7] });
      if (R() < 0.5) pen(sub(o.slice(half), RR(0, 0.35), RR(0.75, 1)), { w: fine * 0.7, a: 0.8, wob: 0.1, taper: [0.6, 0.2] });
      if (fl.len > 14 * bs && R() < 0.6) pen(sub(offsetLine(fl.pts, (f) => fl.wid * 0.35 * (1 - f)), 0.2, 0.85), { w: 0.3, a: 0.55, taper: [0.3, 0.6] });
    }
    // ---- the whip thongs
    for (const th of L.whip) pen(th, { w: 1.1, w1: 0.35, a: 1, wob: 0.08, taper: [0, 0.15] });
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
      const C = (nm, w, opt) => pen(wizShapes[nm].concat([wizShapes[nm][0]]), Object.assign({ w, a: 1, wob: 0.1, taper: [0, 0] }, opt || {}));
      C('cloak', 1.3); C('sleeveL', 1.1); C('sleeveR', 1.0); C('hood', 0.8, { obj: ow }); C('crown', 1.1); C('brim', 1.0);
      C('handL', 0.8); C('handR', 0.8); C('bootR', 0.8, { obj: ow }); C('bootL', 0.8, { obj: ow });
      for (const fp of L.folds) pen(fp, { w: 0.85, a: 0.95, wob: 0.1, taper: [0.15, 0.4], obj: ow });
      for (let i = 0; i < 28; i++) {
        const s = WX(spline([[RR(-9, 12), -88 + RR(-1, 2)], [RR(-14, 6), -84 + RR(-2, 2)], [RR(-22, -4), -80 + RR(-3, 3)], [RR(-32, -14), -77 + RR(-4, 4)]], false, 6));
        pen(s, { w: RR(0.28, 0.55), a: 0.85, wob: 0.1, taper: [0.1, 0.6] });
      }
      for (let i = 0; i < 18; i++) {
        const s = WX(spline([[RR(11, 15), -87], [RR(16, 19), -81], [RR(15, 18), -74], [RR(6, 13), -68 + RR(-2, 2)]], false, 6));
        pen(s, { w: RR(0.28, 0.5), a: 0.85, wob: 0.1, taper: [0.1, 0.6] });
      }
      pen(wizShapes.staff, { w: 2.3, a: 1, wob: 0.15, taper: [0, 0], obj: [O.STAFF, O.WIZ, O.WING, O.BAL, O.SMOKE, O.ROCK, O.WALL, O.FIRE, O.RIFT] });
      for (let i = 0; i < 5; i++) { const p = wizShapes.staff[(4 + i * 7) % wizShapes.staff.length]; pen([[p[0] - 1.6, p[1]], [p[0] + 1.4, p[1] + 0.6]], { w: 0.7, a: 0.9 }); }
      const bl = wizShapes.blade;
      pen([bl[0], bl[1], bl[2]], { w: 0.5, a: 1, wob: 0.02, taper: [0, 0.3] });
      pen([bl[4], bl[3], bl[2]], { w: 0.7, a: 1, wob: 0.02, taper: [0, 0.3] });
      const { a: sa, b: sb } = wizShapes.sword;
      const ang = Math.atan2(sb[1] - sa[1], sb[0] - sa[0]);
      const qx = -Math.sin(ang) * 4.5 * ws, qy = Math.cos(ang) * 4.5 * ws;
      pen([[sa[0] + qx, sa[1] + qy], [sa[0] - qx, sa[1] - qy]], { w: 1.5, a: 1, taper: [0, 0] });
      gpen([[lerp(sa[0], sb[0], 0.05), lerp(sa[1], sb[1], 0.05)], sb], { w: 0.75, a: 0.95, taper: [0.1, 0.1] });
      // rims: the staff's white on hat, sleeve and shoulder
      gpen(offsetLine(WX(spline([[-30, -127], [-22, -122], [-14, -115], [-9, -105], [-7, -95]], false, 6)), 0.6), { w: 1.0, a: 0.85, taper: [0.2, 0.2] });
      gpen(WX(spline([[-17, -91.4], [-8, -93.8], [4, -94.6]], false, 6)), { w: 0.9, a: 0.8, taper: [0.2, 0.3] });
      gpen(WX(spline([[-21, -119], [-30, -114], [-36, -104], [-38, -94]], false, 6)), { w: 0.9, a: 0.75, taper: [0.2, 0.3] });
      gpen(WX(spline([[-14, -81], [-20, -74], [-27, -66], [-36, -54]], false, 6)), { w: 0.8, a: 0.6, taper: [0.2, 0.4] });
    }
    await tick();

    // ---- the white blaze: scratched rays and a gouache heart
    {
      const [bx, by] = L.blaze;
      for (let i = 0; i < 150; i++) {
        const a = R() * TAU;
        const len = Math.pow(R(), 1.7) * 620 + 40;
        spen([[bx + Math.cos(a) * 14, by + Math.sin(a) * 14], [bx + Math.cos(a) * len, by + Math.sin(a) * len]], { w: RR(0.25, 0.65), a: RR(0.5, 0.9), taper: [0.0, 0.9] });
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
      for (const fl of flames) {
        const pts = fl.pts, nS = 5;
        for (let s = 0; s < nS; s++) {
          const a = s / nS, b = (s + 1.2) / nS;
          const l = sub(offsetLine(pts, (f) => fl.wid * Math.sin(Math.PI * Math.pow(f, 0.45)) * 0.95), a, Math.min(1, b));
          const r = sub(offsetLine(pts, (f) => -fl.wid * Math.sin(Math.PI * Math.pow(f, 0.45)) * 0.95), a, Math.min(1, b));
          const poly = l.concat(r.reverse());
          const t = a;
          wFill(poly, lerp(0.85, 0.1, t), lerp(0.25, 0.7, t), lerp(0.0, 0.45, t * t), 0.75, 0.6);
        }
      }
      const { hilt, tip } = L.sword;
      wStroke([hilt, tip], 0.95, 0.35, 0.0, 1, 3.4 * bs, 1);
      wStroke([hilt, tip], 0.2, 0.6, 0.3, 0.6, 7 * bs, 4);
      for (const th of L.whip) { wStroke(th, 0.3, 0.5, 0.15, 0.5, 2.2 * bs, 1.5); wStroke(th, 0.6, 0.25, 0, 0.7, 0.7 * bs, 0.3); }
      for (const e of L.balEyes) wStroke(e, 1, 0.6, 0, 1, 1.6 * bs, 0.3);
      wStroke(L.balMaw, 0.8, 0.8, 0.2, 1, 1.8 * bs, 0.5);
      for (const v of L.veins) wStroke(v, 0.6, 0.8, 0.2, 0.9, 1.0 * bs, 0.5);
      for (const nm of ['shF', 'bicepsF', 'forearmF', 'hump', 'head']) { const u = BAL_PARTS.find((q) => q.nm === nm).u; wStroke(u.slice(Math.floor(u.length * 0.7)).concat(u.slice(0, Math.floor(u.length * 0.2))), 0.25, 0.55, 0.3, 0.55, 3 * bs, 3); }
      // the mane's glow
      wStroke(BX(spline([[-16, -104], [0, -112], [20, -124], [40, -136]], false, 8)), 0.55, 0.35, 0.05, 0.6, 18 * bs, 8 * bs);
      // the far end of the bridge, its side, and the right-hand pillars take the fire
      wctx.save(); wctx.clip(L.deckP);
      const dg = wctx.createLinearGradient(W0[0], 0, B0[0], 0);
      dg.addColorStop(0, washc(0, 0, 0, 0)); dg.addColorStop(0.55, washc(0.1, 0.25, 0.15, 0.2)); dg.addColorStop(1, washc(0.35, 0.55, 0.3, 0.75));
      wctx.fillStyle = dg; wctx.fillRect(0, 0, SW, SH); wctx.restore();
      wctx.save(); wctx.clip(L.sideP);
      const sg = wctx.createLinearGradient(0, B0[1] - 40, 0, W0[1] + 160);
      sg.addColorStop(0, washc(0.2, 0.5, 0.35, 0.5)); sg.addColorStop(1, washc(0.1, 0.3, 0.3, 0.3));
      wctx.fillStyle = sg; wctx.fillRect(0, 0, SW, SH); wctx.restore();
      for (const pf of L.pillarFaces) {
        if (pf.pl.x > 0) { wctx.save(); wctx.clip(pf.path); const yb = P(pf.pl.x, 0, pf.pl.z)[1]; const g = wctx.createLinearGradient(0, yb - 300, 0, yb + 400); g.addColorStop(0, washc(0, 0, 0, 0)); g.addColorStop(0.5, washc(0.12, 0.35, 0.28, 0.4)); g.addColorStop(1, washc(0.1, 0.35, 0.4, 0.5)); wctx.fillStyle = g; wctx.fillRect(0, 0, SW, SH); wctx.restore(); }
      }
      // red rim on the wizard's right
      wStroke(WX(spline([[18, -78], [24, -68], [30, -62], [27, -50], [26, -34], [28, -18], [31, -4]], false, 6)), 0.2, 0.6, 0.25, 0.7, 2.2 * ws, 0.8);
      wStroke(WX(spline([[3, -98], [7, -94], [17, -91.5]], false, 6)), 0.2, 0.55, 0.2, 0.6, 1.4 * ws, 0.6);
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
        const gran = 0.8 + 0.4 * nz(gx / 3.5, gy / 3.5);
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
        if (inY && x >= IX && x < IX + IW) {
          let fx = (x - IX) / 2 - 0.5, fy = (y - IY) / 2 - 0.5;
          if (fx < 0) fx = 0; if (fy < 0) fy = 0; if (fx > hw - 1.001) fx = hw - 1.001; if (fy > hh - 1.001) fy = hh - 1.001;
          const xi = fx | 0, yi = fy | 0, u = fx - xi, v = fy - yi, wi = yi * hw + xi;
          const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
          const wy = WY[wi] * w00 + WY[wi + 1] * w10 + WY[wi + hw] * w01 + WY[wi + hw + 1] * w11;
          const wo = WO[wi] * w00 + WO[wi + 1] * w10 + WO[wi + hw] * w01 + WO[wi + hw + 1] * w11;
          const wc = WC[wi] * w00 + WC[wi + 1] * w10 + WC[wi + hw] * w01 + WC[wi + hw + 1] * w11;
          if (wy + wo + wc > 0.003) {
            r *= (1 - wy * (1 - PYc[0])) * (1 - wo * (1 - POc[0])) * (1 - wc * (1 - PCc[0]));
            g *= (1 - wy * (1 - PYc[1])) * (1 - wo * (1 - POc[1])) * (1 - wc * (1 - PCc[1]));
            b *= (1 - wy * (1 - PYc[2])) * (1 - wo * (1 - POc[2])) * (1 - wc * (1 - PCc[2]));
          }
        }
        let a = ink[i];
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
