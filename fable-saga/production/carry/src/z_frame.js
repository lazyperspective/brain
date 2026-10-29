  /* ================================================================ captions */
  // [t0, t1, kind, speaker, text, y]; kinds: n narration (top bar), s speech (bottom bar), x shout (centre)

  function drawCaptions(t) {
    for (const [t0, t1, k, who, s, sy] of CAPS) {
      if (t < t0 || t >= t1) continue;
      const nv = Math.ceil((t - t0) * 38);
      if (k === 'n') { const w = textWidth(s, 1); text(s, 240 - w / 2, 9, 20, 1, undefined, nv); }
      else if (k === 's') {
        const tag = who + ':', tw = textWidth(tag, 1), w = tw + 6 + textWidth(s, 1), x0 = 240 - w / 2, y = H - LB + 9;
        text(tag, x0, y, who === 'SUNDERER' ? 104 : who === 'UNMAKER' ? 74 : who === 'NULL' ? 42 : 35, 1);
        text(s, x0 + tw + 6, y, 21, 1, undefined, nv);
      } else {
        const u = (t - t0) / (t1 - t0), sc = u < 0.12 ? 8 : 6, w = textWidth(s, sc);
        text(s, 240 - w / 2, (sy || 135) - 3.5 * sc, (i, j) => (j < 3 ? 22 : 59), sc, 0, undefined, t);
      }
    }
  }

  /* ================================================================ frame */
  let SHX = 0, SHY = 0;
  function render(t) {
    t = clamp(t, 0, D - 1 / 30);
    T_NOW = t; SHAKE_A = 0; FRZ = 0; BUF.fill(0);
    let S = SHOTS[0];
    for (const s of SHOTS) if (t >= s.t0) S = s;
    lifeTick(t, S); SLIFE.n = 0;              // per-draw physics slots restart each frame (hero and villain)
    S.fn(t - S.t0, t);
    for (const [wt, dir] of WHIPS) { const d = Math.abs(t - wt); if (d < 0.1) whip(80 * (1 - d / 0.1), dir); }
    for (const c of FLASH_CUTS) if (t >= c && t < c + 0.067) tintAll(T_WH, 0.55);
    grade();
    shakePicture(t);
    letterbox(LB);
    if (S.post) S.post(t - S.t0, t);
    drawCaptions(t);
    SHX = 0; SHY = 0;                       // (the shake is applied to the picture inside the bars, in shakePicture)
  }
  // shake is a camera being knocked about, not static: smooth noise (a few wobbles a second) rather than a new random spot
  // every frame; only the picture moves, the letterbox bars stay put
  function shakePicture(t) {
    const f = fl(t * 30);
    const nz = (k) => Math.sin(t * 37.1 + k) * 0.55 + Math.sin(t * 59.3 + k * 2.3) * 0.3 + (ih(f, k, 901) - 0.5) * 0.3;
    const dx = Math.round(nz(1) * 1.6 * SHAKE_A), dy = Math.round(nz(2) * 1.6 * SHAKE_A);
    if (!dx && !dy) return;
    TMP.set(BUF);
    for (let y = LB; y < H - LB; y++) { const sy = clamp(y - dy, LB, H - LB - 1); for (let x = 0; x < W; x++) BUF[y * W + x] = TMP[sy * W + clamp(x - dx, 0, W - 1)]; }
  }

  /* ================================================================ grade: light that spills, and a darkened edge
     Bloom: bright pixels (emitters) are gathered into a coarse grid, blurred, and spilled back over their neighbourhood as a
     tint of their own hue (gold light spills gold, magenta spills magenta), only onto what is darker than the light itself.
     Vignette: the corners of the frame sink a little, to hold the eye in the middle. */
  const GC = 4, GW = W / GC, GH = Math.ceil(H / GC), GR = new Float32Array(GW * GH), GG = new Float32Array(GW * GH), GB2 = new Float32Array(GW * GH), GT = new Float32Array(GW * GH), GTI = new Uint8Array(GW * GH);
  const LUMP = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
  const BLOOM_T = [[T_WH, [1, 1, 1]], [T_GOLD, [1, 0.75, 0.25]], [T_WARM, [1, 0.69, 0.38]], [T_MAG, [1, 0.23, 0.78]], [T_CYAN, [0.25, 0.85, 1]], [T_BL, [0.25, 0.6, 0.95]], [T_VI, [0.6, 0.36, 0.94]], [T_GR, [0.42, 0.75, 0.25]]];
  const VIG = new Float32Array(NP);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2 - LB), r = Math.sqrt(dx * dx * 0.8 + dy * dy * 0.6); VIG[y * W + x] = 0.3 * sstep(0.62, 1.2, r); }
  function blur(A) {
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < GH; y++) { let acc = 0; const row = y * GW; for (let x = -3; x < GW + 3; x++) { if (x + 3 < GW) acc += A[row + x + 3]; if (x - 4 >= 0) acc -= A[row + x - 4]; if (x >= 0 && x < GW) GT[row + x] = acc / 7; } }
      for (let x = 0; x < GW; x++) { let acc = 0; for (let y = -3; y < GH + 3; y++) { if (y + 3 < GH) acc += GT[(y + 3) * GW + x]; if (y - 4 >= 0) acc -= GT[(y - 4) * GW + x]; if (y >= 0 && y < GH) A[y * GW + x] = acc / 7; } }
    }
  }
  function grade() {
    GR.fill(0); GG.fill(0); GB2.fill(0);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const c = BUF[y * W + x], l = LUMP[c]; if (l < 175) continue;
      const k = (l - 175) / 80 / (GC * GC), p = PAL[c], j = fl(y / GC) * GW + fl(x / GC);
      GR[j] += p[0] / 255 * k; GG[j] += p[1] / 255 * k; GB2[j] += p[2] / 255 * k;
    }
    blur(GR); blur(GG); blur(GB2);
    for (let j = 0; j < GW * GH; j++) {
      const r = GR[j], g = GG[j], b = GB2[j], m = Math.max(r, g, b); GT[j] = m > 0.02 ? m : 0; if (m <= 0.02) continue;
      let best = 0, bd = 1e9; BLOOM_T.forEach(([, q], k) => { const d = (r / m - q[0]) ** 2 + (g / m - q[1]) ** 2 + (b / m - q[2]) ** 2; if (d < bd) { bd = d; best = k; } }); GTI[j] = best;
    }
    for (let y = LB; y < H - LB; y++) {
      const gy = Math.min(GH - 1, fl(y / GC));
      for (let x = 0; x < W; x++) {
        const i = y * W + x, j = gy * GW + fl(x / GC), m = GT[j];
        if (m > 0 && LUMP[BUF[i]] < m * 255 * 2.2) tintI(i, x, y, BLOOM_T[GTI[j]][0], Math.min(0.42, m * 1.4) * 0.5);
        if (VIG[i] > 0.01) tintI(i, x, y, T_DARK, VIG[i]);
      }
    }
  }

  /* ================================================================ present */
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 0x04;
  const pack = (r, g, b) => (LE ? ((255 << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 255)) >>> 0;
  const LIVE = new Uint32Array(256);
  for (let i = 0; i < NPAL; i++) LIVE[i] = pack(PAL[i][0], PAL[i][1], PAL[i][2]);
  let SMALL = null, SG = null, IMG = null, PIX = null;
  function drawFrame(t, g, cw, ch, k, ox, oy) {
    render(t);
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
    }
    // whole-pixel screen shake: shift the finished frame, clamping at the edges
    const sx = SHX, sy = SHY;
    for (let y = 0; y < H; y++) {
      const yy = clamp(y - sy, 0, H - 1), o = y * W, oo = yy * W;
      for (let x = 0; x < W; x++) PIX[o + x] = LIVE[BUF[oo + clamp(x - sx, 0, W - 1)]];
    }
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#04050b'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ mount */
  if (typeof window !== 'undefined') window.__carry_core = { render, BUF, PAL, W, H, D, SHAKE: () => [SHX, SHY] };
  (window.PIECES = window.PIECES || []).push({
    id: 'carry',
    title: 'Carry',
    medium: 'Pixel art, 480 × 270, drawn in JavaScript · a 15 s loop',
    note: 'An endless zoom · tap to pause',
    about: 'A small snail on a flower looks up at the night. The camera pulls back, and back: the meadow, the valley, the coast, the world, the sun and its planets, the galaxy, and the galaxy turns out to be the spiral on the shell of a small snail on a flower, looking up at the night. Fifteen seconds that never end.',
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
        window.__thecarry = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__thecarry.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-unmaker';
        api.ready();
      } else {
        window.__thecarry = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      let hold = 0;
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;                                     // a seamless loop: straight round again
        draw(clock);
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
          if (window.__thecarry) delete window.__thecarry;
        },
      };
    },
  });
