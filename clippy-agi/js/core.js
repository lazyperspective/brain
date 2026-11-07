// Core: deterministic PRNG, easing, palette, pixel primitives, bitmap + thresholded TrueType text, bevels.
(function (G) {
  // ---------- determinism ----------
  function hash(n) { // integer/float -> [0,1)
    let x = Math.floor(n * 7919 + 0.5) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const sat = (v) => clamp(v, 0, 1);
  const E = {
    lin: (k) => k,
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: (k) => 1 - Math.pow(1 - k, 3),
    in: (k) => k * k * k,
    smooth: (k) => k * k * (3 - 2 * k),
    smoother: (k) => k * k * k * (k * (k * 6 - 15) + 10),
    outBack: (k, s = 1.70158) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
    outQuint: (k) => 1 - Math.pow(1 - k, 5),
  };
  const seg = (t, a, b) => sat((t - a) / (b - a));

  // ---------- palette ----------
  const C = {
    face: '#c0c0c0', light: '#dfdfdf', hi: '#ffffff', shadow: '#808080', dark: '#000000',
    navy: '#000080', navy2: '#1084d0', igray: '#808080', igray2: '#b5b5b5', teal: '#008080',
    tip: '#ffffe1', white: '#ffffff', black: '#000000', sel: '#000080', blue: '#0000ff', red: '#ff0000',
    dred: '#800000', green: '#008000', yellow: '#ffff00', dyellow: '#808000', grid: '#c0c0c0',
  };

  // ---------- primitives ----------
  function R(ctx, x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function H(ctx, x, y, w, c) { R(ctx, x, y, w, 1, c); }
  function V(ctx, x, y, h, c) { R(ctx, x, y, 1, h, c); }
  function frame(ctx, x, y, w, h, c) { H(ctx, x, y, w, c); H(ctx, x, y + h - 1, w, c); V(ctx, x, y, h, c); V(ctx, x + w - 1, y, h, c); }
  // two-tone 1px edge: tl colour on top/left, br colour on bottom/right
  function edge(ctx, x, y, w, h, tl, br) { H(ctx, x, y, w - 1, tl); V(ctx, x, y, h - 1, tl); H(ctx, x, y + h - 1, w, br); V(ctx, x + w - 1, y, h, br); }
  function raised(ctx, x, y, w, h, fill = C.face) { if (fill) R(ctx, x, y, w, h, fill); edge(ctx, x, y, w, h, C.hi, C.dark); edge(ctx, x + 1, y + 1, w - 2, h - 2, C.light, C.shadow); }
  function pressed(ctx, x, y, w, h, fill = C.face) { if (fill) R(ctx, x, y, w, h, fill); edge(ctx, x, y, w, h, C.dark, C.hi); edge(ctx, x + 1, y + 1, w - 2, h - 2, C.shadow, C.light); }
  function winEdge(ctx, x, y, w, h, fill = C.face) { if (fill) R(ctx, x, y, w, h, fill); edge(ctx, x, y, w, h, C.light, C.dark); edge(ctx, x + 1, y + 1, w - 2, h - 2, C.hi, C.shadow); }
  function sunken(ctx, x, y, w, h, fill = C.white) { if (fill) R(ctx, x, y, w, h, fill); edge(ctx, x, y, w, h, C.shadow, C.hi); edge(ctx, x + 1, y + 1, w - 2, h - 2, C.dark, C.light); }
  function shallow(ctx, x, y, w, h, fill) { if (fill) R(ctx, x, y, w, h, fill); edge(ctx, x, y, w, h, C.shadow, C.hi); }
  function thinRaised(ctx, x, y, w, h, fill) { if (fill) R(ctx, x, y, w, h, fill); edge(ctx, x, y, w, h, C.hi, C.shadow); }
  function groove(ctx, x, y, w, h) { edge(ctx, x, y, w, h, C.shadow, C.hi); edge(ctx, x + 1, y + 1, w - 2, h - 2, C.hi, C.shadow); }
  function vsep(ctx, x, y, h) { V(ctx, x, y, h, C.shadow); V(ctx, x + 1, y, h, C.hi); }
  function hsep(ctx, x, y, w) { H(ctx, x, y, w, C.shadow); H(ctx, x, y + 1, w, C.hi); }
  function dotted(ctx, x, y, w, h, c = C.black) { // focus rectangle
    ctx.fillStyle = c;
    for (let i = 0; i < w; i += 2) { ctx.fillRect(x + i, y, 1, 1); ctx.fillRect(x + i, y + h - 1, 1, 1); }
    for (let j = 0; j < h; j += 2) { ctx.fillRect(x, y + j, 1, 1); ctx.fillRect(x + w - 1, y + j, 1, 1); }
  }
  const patCache = {};
  function dither(ctx, x, y, w, h, a, b) { // 50% checkerboard aligned to screen
    const k = a + b;
    if (!patCache[k]) { const c = document.createElement('canvas'); c.width = c.height = 2; const g = c.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, 2, 2); g.fillStyle = b; g.fillRect(1, 0, 1, 1); g.fillRect(0, 1, 1, 1); patCache[k] = ctx.createPattern(c, 'repeat'); }
    ctx.fillStyle = patCache[k]; ctx.fillRect(x, y, w, h);
  }
  // pixel ellipse fill (no anti-aliasing)
  function pEllipse(ctx, cx, cy, rx, ry, c) {
    ctx.fillStyle = c;
    for (let j = -ry; j <= ry; j++) { const yy = (j + (j < 0 ? 0.5 : -0.5)) / ry; const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - yy * yy))); ctx.fillRect(Math.round(cx - hw), Math.round(cy + j), hw * 2, 1); }
  }
  // pixel rounded rect (fill + optional 1px border), radius r, no anti-aliasing
  function roundRows(ctx, x, y, w, h, r, c) {
    for (let j = 0; j < h; j++) {
      const d = j < r ? r - j - 0.5 : j >= h - r ? j - (h - r) + 0.5 : 0;
      const i0 = d > 0 ? Math.round(r - Math.sqrt(Math.max(0, r * r - d * d))) : 0;
      R(ctx, x + i0, y + j, w - 2 * i0, 1, c);
    }
  }
  function pRound(ctx, x, y, w, h, r, fill, border) {
    if (border) { roundRows(ctx, x, y, w, h, r, border); roundRows(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1), fill); }
    else roundRows(ctx, x, y, w, h, r, fill);
  }

  // ---------- bitmap font ----------
  const atlases = {};
  function buildAtlas(bold) {
    const F = G.UIFONT, chars = Object.keys(F.glyphs);
    const c = document.createElement('canvas'); c.width = chars.length * 12; c.height = F.CELL_H;
    const g = c.getContext('2d'); g.fillStyle = '#fff';
    const map = {};
    chars.forEach((ch, i) => {
      const gl = F.glyphs[ch], ox = i * 12;
      for (const [x, y] of gl.px) { g.fillRect(ox + x, y, 1, 1); if (bold) g.fillRect(ox + x + 1, y, 1, 1); }
      map[ch] = { sx: ox, w: gl.w + (bold ? 1 : 0), adv: gl.w + 1 + (bold ? 1 : 0) };
    });
    map[' '].adv = bold ? 4 : 3;
    return { canvas: c, map, h: F.CELL_H, base: F.BASE, tints: {} };
  }
  function tinted(at, col) {
    if (at.tints[col]) return at.tints[col];
    const c = document.createElement('canvas'); c.width = at.canvas.width; c.height = at.canvas.height;
    const g = c.getContext('2d'); g.drawImage(at.canvas, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
    return (at.tints[col] = c);
  }
  const FONTS = {};
  function font(name) { return FONTS[name]; }
  function initFonts() {
    FONTS.ui = buildAtlas(false); FONTS.uib = buildAtlas(true);
  }
  // text: y = top of the 13px line cell; returns advance width
  function text(ctx, s, x, y, col = C.black, f = 'ui', opts) {
    const at = FONTS[f]; if (!at) throw new Error('font ' + f);
    const img = tinted(at, col);
    let cx = Math.round(x); y = Math.round(y);
    const ul = opts && opts.underline;
    for (let i = 0; i < s.length; i++) {
      let ch = s[i]; let m = at.map[ch];
      if (!m) { m = at.map['?']; }
      if (ch === '&' && opts && opts.mnemonic && i + 1 < s.length) { // &File -> underlined F
        const n = at.map[s[i + 1]] || at.map['?'];
        ctx.drawImage(img, n.sx, 0, n.w + 1, at.h, cx, y, n.w + 1, at.h);
        R(ctx, cx, y + at.base + 1, n.w, 1, col); cx += n.adv; i++; continue;
      }
      if (ch !== ' ') ctx.drawImage(img, m.sx, 0, m.w + 1, at.h, cx, y, m.w + 1, at.h);
      cx += m.adv;
    }
    if (ul) R(ctx, Math.round(x), y + at.base + 1, cx - Math.round(x) - 1, 1, col);
    return cx - Math.round(x);
  }
  function measure(s, f = 'ui') {
    const at = FONTS[f]; let w = 0;
    for (let i = 0; i < s.length; i++) { const m = at.map[s[i]] || at.map['?']; w += m.adv; }
    return w;
  }
  // word wrap -> array of lines
  function wrap(s, maxW, f = 'ui') {
    const out = [];
    for (const para of s.split('\n')) {
      const words = para.split(' '); let line = '';
      for (const w of words) {
        const cand = line ? line + ' ' + w : w;
        if (measure(cand, f) > maxW && line) { out.push(line); line = w; } else line = cand;
      }
      out.push(line);
    }
    return out;
  }

  // ---------- thresholded TrueType fonts (aliased, integer advances, like a 90s rasteriser) ----------
  function buildTT(css, sizePx, lineH, baseY, thr = 0.5, extraAdv = 0, embolden = 0, ss = 1) {
    const chars = []; for (let i = 32; i < 127; i++) chars.push(String.fromCharCode(i));
    chars.push('’', '‘', '“', '”', '—', '•', '©', '…', '™', '¶', '·');
    const cw = Math.ceil(sizePx * 1.4);
    const c = document.createElement('canvas'); c.width = chars.length * cw; c.height = lineH;
    const g = c.getContext('2d');
    const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = lineH; const tg = tmp.getContext('2d', { willReadFrequently: true });
    tg.font = css; tg.textBaseline = 'alphabetic';
    const map = {};
    chars.forEach((ch, i) => {
      let d;
      if (ss > 1) {
        const big = document.createElement('canvas'); big.width = cw * ss; big.height = lineH * ss; const bg = big.getContext('2d', { willReadFrequently: true });
        bg.font = css.replace(/(\d+)px/, (m, n) => (n * ss) + 'px'); bg.fillStyle = '#fff'; bg.fillText(ch, ss, baseY * ss);
        if (embolden) { bg.strokeStyle = '#fff'; bg.lineWidth = embolden * ss; bg.strokeText(ch, ss, baseY * ss); }
        const bd = bg.getImageData(0, 0, cw * ss, lineH * ss).data; d = new Uint8ClampedArray(cw * lineH * 4);
        for (let yy = 0; yy < lineH; yy++) for (let xx = 0; xx < cw; xx++) { let a = 0; for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) a += bd[((yy * ss + j) * cw * ss + xx * ss + i) * 4 + 3]; d[(yy * cw + xx) * 4 + 3] = a / (ss * ss); }
      } else {
        tg.clearRect(0, 0, cw, lineH); tg.fillStyle = '#fff'; tg.fillText(ch, 1, baseY);
        if (embolden) { tg.strokeStyle = '#fff'; tg.lineWidth = embolden; tg.strokeText(ch, 1, baseY); }
        d = tg.getImageData(0, 0, cw, lineH).data;
      }
      const out = g.createImageData(cw, lineH);
      let maxx = 0;
      for (let p = 0; p < cw * lineH; p++) { if (d[p * 4 + 3] / 255 >= thr) { out.data[p * 4] = out.data[p * 4 + 1] = out.data[p * 4 + 2] = 255; out.data[p * 4 + 3] = 255; maxx = Math.max(maxx, p % cw); } }
      g.putImageData(out, i * cw, 0);
      const adv = Math.round(tg.measureText(ch).width) + extraAdv;
      map[ch] = { sx: i * cw, w: cw - 1, adv, ox: -1 };
    });
    return { canvas: c, map, h: lineH, base: baseY, tints: {}, ttf: true };
  }
  function ttText(ctx, s, x, y, col, f) {
    const at = FONTS[f], img = tinted(at, col);
    let cx = Math.round(x); y = Math.round(y);
    for (let i = 0; i < s.length; i++) {
      const m = at.map[s[i]] || at.map['?'];
      if (s[i] !== ' ') ctx.drawImage(img, m.sx, 0, m.w, at.h, cx + m.ox, y, m.w, at.h);
      cx += m.adv;
    }
    return cx - Math.round(x);
  }
  async function initTTFonts() {
    const faces = [
      ['DocSerif', 'fonts/LiberationSerif-Regular.ttf', 'normal'], ['DocSerif', 'fonts/LiberationSerif-Bold.ttf', 'bold'],
      ['DocSans', 'fonts/LiberationSans-Regular.ttf', 'normal'], ['DocSans', 'fonts/LiberationSans-Bold.ttf', 'bold'],
    ];
    for (const [fam, url, wt] of faces) { const ff = new FontFace(fam, `url(${url})`, { weight: wt }); await ff.load(); document.fonts.add(ff); }
    const B = (css, size, lh, base, emb = 0.25) => buildTT(css, size, lh, base, 0.45, 0, emb, 4);
    FONTS.serif16 = B('16px DocSerif', 16, 19, 14);
    FONTS.serif16b = B('bold 16px DocSerif', 16, 19, 14, 0.1);
    FONTS.serif24b = B('bold 24px DocSerif', 24, 28, 21, 0.1);
    FONTS.serif20b = B('bold 20px DocSerif', 20, 24, 18, 0.1);
    FONTS.serif13 = B('13px DocSerif', 13, 16, 12);
    FONTS.sans13 = B('13px DocSans', 13, 16, 12, 0.15);
    FONTS.sans13b = B('bold 13px DocSans', 13, 16, 12, 0.05);
    FONTS.sans16b = B('bold 16px DocSans', 16, 19, 15, 0.05);
    FONTS.sans20b = B('bold 20px DocSans', 20, 24, 18, 0.05);
    FONTS.sans28b = B('bold 28px DocSans', 28, 34, 26, 0.05);
    FONTS.sans11 = B('11px DocSans', 11, 14, 10, 0.15);
  }
  function T(ctx, s, x, y, col = C.black, f = 'ui', opts) { return FONTS[f].ttf ? ttText(ctx, s, x, y, col, f) : text(ctx, s, x, y, col, f, opts); }
  function TW(s, f = 'ui') { return measure(s, f); }

  G.K = { hash, rng, clamp, lerp, sat, E, seg, C, R, H, V, frame, edge, raised, pressed, winEdge, sunken, shallow, thinRaised, groove, vsep, hsep, dotted, dither, pEllipse, pRound, initFonts, initTTFonts, font, T, TW, wrap, FONTS };
})(window);
