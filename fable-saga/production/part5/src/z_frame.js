  /* ================================================================ captions */
  // [t0, t1, kind, speaker, text, y]; kinds: n narration (top bar), s speech (bottom bar), x shout (centre; speaker picks its ink)
  function drawCaptions(t) {
    if (t > D - 2.4) { const s4 = 'UNOFFICIAL FAN CONCEPT · NOT AFFILIATED WITH ANTHROPIC'; text(s4, 240 - textWidth(s4, 1) / 2, H - LB + 9, 19, 1); }
    for (const [t0, t1, k, who, s, sy] of CAPS) {
      if (t < t0 || t >= t1) continue;
      const nv = Math.ceil((t - t0) * 38);
      if (k === 'n') { const w = textWidth(s, 1); text(s, 240 - w / 2, 9, 20, 1, undefined, nv); }
      else if (k === 's') {
        const tag = who + ':', tw = textWidth(tag, 1), w = tw + 6 + textWidth(s, 1), x0 = 240 - w / 2, y = H - LB + 9;
        text(tag, x0, y, who === 'HOLLOW' ? 73 : who === 'SUNDERER' ? 104 : who === 'UNMAKER' ? 74 : who === 'NULL' ? 42 : 35, 1);
        text(s, x0 + tw + 6, y, 21, 1, undefined, nv);
      } else {
        const u = (t - t0) / (t1 - t0), sc0 = who === 'inv' ? 6 : s.length > 10 ? 5 : 6, sc = u < 0.1 ? sc0 + 2 : sc0, w = textWidth(s, sc), x0 = 240 - w / 2, y0 = (sy || 135) - 3.5 * sc;
        if (who === 'inv') text(s, x0, y0, (i, j) => (j < 5 ? 0 : 78), sc, 22, undefined, t * 0.4);          // the Hollow's: black letters, a white edge, cold (barely shaking)
        else if (who === 'dawn') text(s, x0, y0, (i, j, k2) => (k2 * 2 < s.length - 1 ? (j < 3 ? 22 : 56) : (j < 3 ? 22 : 59)), sc, 0, undefined, t);
        else text(s, x0, y0, (i, j) => (j < 3 ? 22 : 59), sc, 0, undefined, t);
      }
    }
  }

  /* ================================================================ frame
     Part V paints in two stages. The shot draws the picture into the indexed buffer as before (144 colours). Then the grade
     turns it into true colour: every effect that gives off light has dropped a lamp (light()), and each lamp tints the world
     and the characters round it; what is bright blooms (an additive glow, so darks stay as deep as they were drawn); a gentle
     contrast curve, a vignette, and on the heaviest blows a frame or two of colour fringing. The bars and captions go on last. */
  let SHX = 0, SHY = 0;
  const RGBF = new Float32Array(NP * 3), RGB = new Uint8Array(NP * 3), CAT = new Float32Array(NP * 2);
  const LIGHTS = [], GD0 = { bloom: 0.3, thr: 0.78, con: 0.22, sat: 1.06, vig: 0.36, ca: 0, flash: 0, fc: [1, 1, 1], fade: 0, mul: [1, 1, 1] }, GD = Object.assign({}, GD0);
  function light(x, y, r, col, a) { if (a > 0.004 && r > 1) LIGHTS.push([x, y, r, col[0], col[1], col[2], a]); }
  function render(t) {
    t = clamp(t, 0, D - 1 / 30);
    T_NOW = t; SHAKE_A = 0; FRZ = 0; BUF.fill(0); LIGHTS.length = 0; Object.assign(GD, GD0); GD.fc = [1, 1, 1]; GD.mul = [1, 1, 1];
    let S = SHOTS[0];
    for (const s of SHOTS) if (t >= s.t0) S = s;
    lifeTick(t, S); SLIFE.n = 0;
    S.fn(t - S.t0, t);
    for (const [wt, dir] of WHIPS) { const d = Math.abs(t - wt); if (d < 0.1) whip(80 * (1 - d / 0.1), dir); }
    for (const c of FLASH_CUTS) if (t >= c && t < c + 0.067) GD.flash = Math.max(GD.flash, 0.5);
    grade(t);
    // the bars, the captions and whatever the shot lays over the finished picture
    BUF.fill(255); letterbox(LB);
    if (S.post) S.post(t - S.t0, t);
    drawCaptions(t);
    for (let i = 0, j = 0; i < NP; i++, j += 3) { const c = BUF[i]; if (c !== 255) { const p = PAL[c]; RGB[j] = p[0]; RGB[j + 1] = p[1]; RGB[j + 2] = p[2]; } }
    SHX = 0; SHY = 0;
  }
  const GC = 4, GW = W / GC, GH = Math.ceil(H / GC), GR = new Float32Array(GW * GH), GG = new Float32Array(GW * GH), GB2 = new Float32Array(GW * GH), GT = new Float32Array(GW * GH);
  const VIG = new Float32Array(NP);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2 - LB), r = Math.sqrt(dx * dx * 0.8 + dy * dy * 0.6); VIG[y * W + x] = sstep(0.55, 1.25, r); }
  function blur(A) {
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < GH; y++) { let acc = 0; const row = y * GW; for (let x = -3; x < GW + 3; x++) { if (x + 3 < GW) acc += A[row + x + 3]; if (x - 4 >= 0) acc -= A[row + x - 4]; if (x >= 0 && x < GW) GT[row + x] = acc / 7; } }
      for (let x = 0; x < GW; x++) { let acc = 0; for (let y = -3; y < GH + 3; y++) { if (y + 3 < GH) acc += GT[(y + 3) * GW + x]; if (y - 4 >= 0) acc -= GT[(y - 4) * GW + x]; if (y >= 0 && y < GH) A[y * GW + x] = acc / 7; } }
    }
  }
  function grade(t) {
    // the shake is a camera being knocked about: smooth noise, and only the picture moves
    const f = fl(t * 30), nz = (k) => Math.sin(t * 37.1 + k) * 0.55 + Math.sin(t * 59.3 + k * 2.3) * 0.3 + (ih(f, k, 901) - 0.5) * 0.3;
    const sdx = Math.round(nz(1) * 1.6 * SHAKE_A), sdy = Math.round(nz(2) * 1.6 * SHAKE_A);
    for (let y = 0; y < H; y++) { const sy = y < LB || y >= H - LB ? y : clamp(y - sdy, LB, H - LB - 1); for (let x = 0; x < W; x++) { const p = PAL[BUF[sy * W + clamp(x - sdx, 0, W - 1)]], j = (y * W + x) * 3; RGBF[j] = p[0]; RGBF[j + 1] = p[1]; RGBF[j + 2] = p[2]; } }
    // lamps
    for (const [lx0, ly0, r, cr, cg, cb, a] of LIGHTS) {
      const lx = lx0 + sdx, ly = ly0 + sdy, x0 = Math.max(0, fl(lx - r)), x1 = Math.min(W - 1, Math.ceil(lx + r)), y0 = Math.max(LB, fl(ly - r)), y1 = Math.min(H - LB - 1, Math.ceil(ly + r)), ir = 1 / r;
      for (let y = y0; y <= y1; y++) { const dy = (y + 0.5 - ly) * ir; for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - lx) * ir, d = dx * dx + dy * dy; if (d >= 1) continue;
        const fo = 1 - Math.sqrt(d), k = a * fo * fo, j = (y * W + x) * 3;
        if (cr < 0) { const m = 1 - Math.min(0.95, k); RGBF[j] *= m; RGBF[j + 1] *= m; RGBF[j + 2] *= m; }
        else { RGBF[j] = RGBF[j] * (1 + k * cr * 0.9) + 42 * cr * k; RGBF[j + 1] = RGBF[j + 1] * (1 + k * cg * 0.9) + 42 * cg * k; RGBF[j + 2] = RGBF[j + 2] * (1 + k * cb * 0.9) + 42 * cb * k; }
      } }
    }
    // bloom
    if (GD.bloom > 0.01) {
      GR.fill(0); GG.fill(0); GB2.fill(0);
      const thr = GD.thr * 255, inv = 1 / ((255 - thr) * GC * GC);
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 3, r = RGBF[j], g = RGBF[j + 1], b = RGBF[j + 2], l = r * 0.3 + g * 0.55 + b * 0.15; if (l < thr) continue;
        const k = Math.min(1, (l - thr) * inv * GC * GC) / (GC * GC), q = fl(y / GC) * GW + fl(x / GC);
        GR[q] += Math.min(255, r) * k; GG[q] += Math.min(255, g) * k; GB2[q] += Math.min(255, b) * k;
      }
      blur(GR); blur(GG); blur(GB2);
      const bl = GD.bloom;
      for (let y = LB; y < H - LB; y++) {
        const gy = clamp((y - GC / 2) / GC, 0, GH - 1.001), y0 = fl(gy), fy = gy - y0;
        for (let x = 0; x < W; x++) {
          const gx = clamp((x - GC / 2) / GC, 0, GW - 1.001), x0 = fl(gx), fx = gx - x0, q = y0 * GW + x0, j = (y * W + x) * 3;
          const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
          RGBF[j] += (GR[q] * w00 + GR[q + 1] * w10 + GR[q + GW] * w01 + GR[q + GW + 1] * w11) * bl;
          RGBF[j + 1] += (GG[q] * w00 + GG[q + 1] * w10 + GG[q + GW] * w01 + GG[q + GW + 1] * w11) * bl;
          RGBF[j + 2] += (GB2[q] * w00 + GB2[q + 1] * w10 + GB2[q + GW] * w01 + GB2[q + GW + 1] * w11) * bl;
        }
      }
    }
    // colour fringing on a heavy blow: red and blue pulled apart, more toward the edges
    const ca = GD.ca;
    if (ca > 0.3) {
      for (let i = 0; i < NP; i++) { CAT[i * 2] = RGBF[i * 3]; CAT[i * 2 + 1] = RGBF[i * 3 + 2]; }
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const sh = Math.round(ca * (x - W / 2) / (W / 2)), sv = Math.round(ca * 0.5 * (y - H / 2) / (H / 2)); if (!sh && !sv) continue; const xa = clamp(x - sh, 0, W - 1), xb = clamp(x + sh, 0, W - 1), ya = clamp(y - sv, LB, H - LB - 1), yb = clamp(y + sv, LB, H - LB - 1), j = (y * W + x) * 3; RGBF[j] = CAT[(ya * W + xa) * 2]; RGBF[j + 2] = CAT[(yb * W + xb) * 2 + 1]; }
    }
    // curve, saturation, flash, fade, vignette
    const con = GD.con, sat = GD.sat, fl_ = Math.min(0.9, GD.flash), fc = GD.fc, fade = 1 - clamp(GD.fade, 0, 1), mul = GD.mul, vg = GD.vig;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i * 3;
      let r = Math.min(1, RGBF[j] / 255) * mul[0], g = Math.min(1, RGBF[j + 1] / 255) * mul[1], b = Math.min(1, RGBF[j + 2] / 255) * mul[2];
      const l = r * 0.3 + g * 0.55 + b * 0.15;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      r = r < 0 ? 0 : r > 1 ? 1 : r; g = g < 0 ? 0 : g > 1 ? 1 : g; b = b < 0 ? 0 : b > 1 ? 1 : b;
      r += (r * r * (3 - 2 * r) - r) * con; g += (g * g * (3 - 2 * g) - g) * con; b += (b * b * (3 - 2 * b) - b) * con;
      if (fl_ > 0) { r += (fc[0] - r) * fl_; g += (fc[1] - g) * fl_; b += (fc[2] - b) * fl_; }
      const v = (1 - VIG[i] * vg) * fade;
      RGB[j] = r * v * 255 + 0.5; RGB[j + 1] = g * v * 255 + 0.5; RGB[j + 2] = b * v * 255 + 0.5;
    }
  }

  /* ================================================================ present */
  let SMALL = null, SG = null, IMG = null;
  function drawFrame(t, g, cw, ch, k, ox, oy) {
    render(t);
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H);
    }
    const d = IMG.data;
    for (let i = 0, j = 0, q = 0; i < NP; i++, j += 3, q += 4) { d[q] = RGB[j]; d[q + 1] = RGB[j + 1]; d[q + 2] = RGB[j + 2]; d[q + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#04050b'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ mount */
  if (typeof window !== 'undefined') window.__hollow_core = { render, BUF, RGB, PAL, W, H, D, SHOTS, CAPS };
  (window.PIECES = window.PIECES || []).push({
    id: 'the-hollow',
    title: 'The Hollow',
    medium: 'Pixel art, 480 × 270, drawn in JavaScript · 40 s',
    note: 'Fable Saga, part V · tap to pause',
    about: 'Part five of the Fable saga. The ash of both brothers pours into the hero\'s own shadow, and the shadow stands up: the Hollow, its exact size and speed, with a cracked half-mask and one eye from each of them. A forty-second duel, blade on blade, falling and climbing through the worlds behind a sky of glass, to a new form, Dawnbreak, and a cut along the horizon itself. Drawn frame by frame in JavaScript into a 480 × 270 indexed buffer, then lit and graded in true colour. An unofficial fan concept, not affiliated with Anthropic.',
    tone: 'dark',
    room: '#04050b',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, ready = false;
      el.style.background = '#04050b';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,230,210,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,230,210,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 4, CW = W * 4, CH = H * 4;
      function layout() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1920; cssH = 1080; cv.style.position = 'fixed';
          K = Math.max(1, Math.round(4 * dpr)); CW = Math.round(1920 * dpr); CH = Math.round(1080 * dpr);
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H);
          K = Math.max(1, Math.floor(fit));
          let show = K;
          if (K < fit * 0.88) { K = Math.max(1, Math.ceil(fit)); show = fit; }
          CW = W * K; CH = H * K;
          cssW = W * show / dpr; cssH = H * show / dpr;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      const draw = (t) => drawFrame(t, g, CW, CH, K, 0, 0);
      layout();
      draw(0);
      ready = true;
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__thehollow = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__thehollow.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-hollow';
        api.ready();
      } else {
        window.__thehollow = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      let hold = 0;
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        if (clock >= D) { hold += dt; if (hold < 2.5) return; hold = 0; clock = 0; } // a short rest on the last frame, then again
        clock = Math.min(D, clock + dt);
        draw(Math.min(clock, D - 1 / 30));
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); draw(Math.min(clock, D - 1 / 30)); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__thehollow) delete window.__thehollow;
        },
      };
    },
  });
