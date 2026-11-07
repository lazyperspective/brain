// 1984 Macintosh user-interface toolkit, redrawn by hand: 512x342 1-bit screen, desktop, menu bar and menus,
// striped-title windows with close box, scroll bars and grow box, dialogs, buttons, Finder icons, zoom rects.
(function (G) {
  const { R, H, V, frame, P, patFrame, rrFill, rrFrame, B, W, grayOut } = K;
  const SW = 512, SH = 342;
  const T = (ctx, s, x, y, f, c) => FONT.text(ctx, s, x, y, f, c);
  const M = (s, f) => FONT.measure(s, f);

  function desktop(ctx, pat = 'gray') { P(ctx, 0, 0, SW, SH, pat); }
  // the screen's rounded corners (black), radius 5
  const CORNER = [5, 3, 2, 1, 1];
  function corners(ctx) {
    for (let j = 0; j < CORNER.length; j++) {
      const n = CORNER[j];
      R(ctx, 0, j, n, 1, B); R(ctx, SW - n, j, n, 1, B); R(ctx, 0, SH - 1 - j, n, 1, B); R(ctx, SW - n, SH - 1 - j, n, 1, B);
    }
  }

  // ---------------- menu bar ----------------
  // titles: ['@', 'File', ...]; returns [{x0,x1,tx}] hilite extents
  function menuLayout(titles) {
    const out = []; let x = 10;
    for (const t of titles) {
      const tw = t === '@' ? 12 : M(t, 'chicago');
      out.push({ x0: x - 6, x1: x + tw + 6, tx: x, w: tw });
      x += tw + 15;
    }
    return out;
  }
  function menubar(ctx, titles, hi = -1) {
    R(ctx, 0, 0, SW, 19, W); H(ctx, 0, 19, SW, B);
    const L = menuLayout(titles);
    titles.forEach((t, i) => {
      const l = L[i], on = i === hi;
      if (on) R(ctx, l.x0, 1, l.x1 - l.x0, 18, B);
      if (t === '@') ICONS.ICON.apple.draw(ctx, l.tx, 4, { inkOnly: true, inv: on });
      else T(ctx, t, l.tx, 5, 'chicago', on ? W : B);
    });
    return L;
  }
  // drop-down menu. items: strings; '-' separator; prefix '~' disabled; 'Quit|⌘Q' with shortcut
  function menuGeom(titles, idx, items) {
    const L = menuLayout(titles);
    let w = 0; for (const it of items) { if (it === '-') continue; const [a, b] = it.replace(/^~/, '').split('|'); w = Math.max(w, M(a, 'chicago') + (b ? M(b, 'chicago') + 26 : 0)); }
    w += 30; const x = L[idx].x0; let h = 2;
    const rows = items.map((it) => { const r = { y: h, h: it === '-' ? 2 + 14 - 14 + 2 : 16, it }; if (it === '-') r.h = 4; h += r.h; return r; });
    return { x, y: 19, w, h: h + 1, rows };
  }
  function menu(ctx, titles, idx, items, hiItem = -1, blinkOff = false) {
    const g = menuGeom(titles, idx, items);
    R(ctx, g.x, g.y, g.w, g.h, W); frame(ctx, g.x, g.y, g.w, g.h, B);
    R(ctx, g.x + 1, g.y + g.h, g.w, 1, B); R(ctx, g.x + g.w, g.y + 1, 1, g.h, B);   // 1-px shadow
    g.rows.forEach((r, i) => {
      const yy = g.y + r.y;
      if (r.it === '-') { ctx.fillStyle = K.patStyle(ctx, 'gray', true); ctx.fillRect(g.x + 1, yy + 1, g.w - 2, 1); return; }
      const dis = r.it[0] === '~'; const [a, b] = r.it.replace(/^~/, '').split('|');
      const on = i === hiItem && !dis && !blinkOff;
      if (on) R(ctx, g.x + 1, yy, g.w - 2, r.h, B);
      T(ctx, a, g.x + 14, yy + 4, 'chicago', on ? W : B);
      if (b) T(ctx, b, g.x + g.w - 8 - M(b, 'chicago'), yy + 4, 'chicago', on ? W : B);
      if (dis) grayOut(ctx, g.x + 2, yy + 1, g.w - 4, r.h - 1);
    });
    return g;
  }

  // ---------------- windows ----------------
  function titleBar(ctx, x, y, w, title, active, closeDown) {
    R(ctx, x + 1, y + 1, w - 2, 17, W);
    if (active) {
      for (let j = 4; j <= 14; j += 2) H(ctx, x + 2, y + j, w - 4, B);
      // close box
      R(ctx, x + 7, y + 3, 13, 13, W); frame(ctx, x + 8, y + 4, 11, 11, B);
      if (closeDown) { // pressed close box shows a small starburst
        for (const [a, b2] of [[0, 4], [1, 4], [2, 4], [4, 0], [4, 1], [4, 2], [6, 4], [7, 4], [8, 4], [4, 6], [4, 7], [4, 8], [1, 1], [7, 7], [7, 1], [1, 7], [2, 2], [6, 6], [6, 2], [2, 6]]) R(ctx, x + 9 + a, y + 5 + b2, 1, 1, B);
      }
    }
    if (title) {
      const tw = M(title, 'chicago'), tx = Math.round(x + (w - tw) / 2);
      R(ctx, tx - 6, y + 1, tw + 12, 17, W);
      T(ctx, title, tx, y + 5, 'chicago', B);
    }
    H(ctx, x, y + 18, w, B);
  }
  function arrowGlyph(ctx, x, y, up) { // outlined scroll arrow inside a 16x16 box at (x,y)
    const rows = ['.....#.....', '....#.#....', '...#...#...', '..#.....#..', '.#.......#.', '####...####', '...#...#...', '...#...#...', '...#####...'];
    rows.forEach((s, j) => { const yy = up ? y + 3 + j : y + 12 - j; for (let i = 0; i < s.length; i++) if (s[i] === '#') R(ctx, x + 2 + i, yy, 1, 1, B); });
  }
  function scrollV(ctx, x, y, h, thumb, active = true) { // x = left line of the 16-px bar; spans y..y+h-1
    R(ctx, x, y, 16, h, W); V(ctx, x, y, h, B);
    if (!active) return;
    arrowGlyph(ctx, x, y + 1, true); H(ctx, x, y + 16, 16, B);
    arrowGlyph(ctx, x, y + h - 16, false); H(ctx, x, y + h - 17, 16, B);
    P(ctx, x + 1, y + 17, 15, h - 34, 'gray');
    if (thumb != null) { const ty = Math.round(y + 17 + thumb * (h - 34 - 16)); R(ctx, x + 1, ty, 15, 16, W); H(ctx, x + 1, ty, 15, B); H(ctx, x + 1, ty + 15, 15, B); }
  }
  function growBox(ctx, x, y) { // 16x16 at (x,y) (its top/left lines included): two overlapping squares
    R(ctx, x, y, 16, 16, W); H(ctx, x, y, 16, B); V(ctx, x, y, 16, B);
    frame(ctx, x + 3, y + 3, 7, 7, B);
    R(ctx, x + 5, y + 5, 9, 9, W); frame(ctx, x + 5, y + 5, 9, 9, B);
  }
  // document window; returns content rect (inside frame, below title, left of scroll bar)
  function window_(ctx, o) {
    const { x, y, w, h } = o;
    R(ctx, x, y, w, h, W); frame(ctx, x, y, w, h, B);
    H(ctx, x + 1, y + h, w, B); V(ctx, x + w, y + 1, h, B);           // drop shadow
    titleBar(ctx, x, y, w, o.title, o.active !== false, o.closeDown);
    let cw = w - 2;
    if (o.scroll) { scrollV(ctx, x + w - 16, y + 18, h - 18 - 15, o.scroll.thumb, o.active !== false); cw = w - 17; }
    if (o.grow) growBox(ctx, x + w - 16, y + h - 16);
    return { x: x + 1, y: y + 19, w: cw, h: h - 20 };
  }

  // ---------------- dialogs & buttons ----------------
  function dialogBox(ctx, x, y, w, h) { // modal dialog frame: black, white, thick black
    R(ctx, x, y, w, h, W); frame(ctx, x, y, w, h, B); frame(ctx, x + 2, y + 2, w - 4, h - 4, B); frame(ctx, x + 3, y + 3, w - 6, h - 6, B);
  }
  function button(ctx, x, y, w, h, label, o = {}) {
    if (o.def) rrFrame(ctx, x - 4, y - 4, w + 8, h + 8, 8 + 3, B, W, 3);
    rrFrame(ctx, x, y, w, h, 8, B, o.down ? B : W, 1);
    const tw = M(label, 'chicago');
    T(ctx, label, Math.round(x + (w - tw) / 2), y + Math.round((h - 9) / 2), 'chicago', o.down ? W : B);
  }
  // simple bordered box with an outline (the startup "Welcome" box)
  function welcome(ctx) {
    const w = 204, h = 52, x = Math.round((SW - w) / 2), y = Math.round((SH - h) / 2) - 2;
    R(ctx, x, y, w, h, W); frame(ctx, x, y, w, h, B); frame(ctx, x + 3, y + 3, w - 6, h - 6, B);
    const s = 'Welcome to Macintosh.'; T(ctx, s, Math.round(x + (w - M(s, 'chicago')) / 2), y + 21, 'chicago', B);
  }
  function happy(ctx) { const b = ICONS.ICON.happy; b.draw(ctx, Math.round((SW - b.w) / 2), Math.round((SH - b.h) / 2) - 4); }

  // ---------------- Finder icons ----------------
  function iconLabelRect(x, y, label) { const tw = M(label, 'g9'); return { x: Math.round(x + 16 - tw / 2) - 2, y: y + 33, w: tw + 4, h: 11, tw }; }
  function icon(ctx, bm, x, y, label, o = {}) {
    if (o.ghost) return;
    bm.draw(ctx, x, y, { inv: !!o.sel });
    if (label) {
      const L = iconLabelRect(x, y, label);
      R(ctx, L.x, L.y, L.w, L.h, o.sel ? B : W);
      T(ctx, label, L.x + 2, L.y + 2, 'g9', o.sel ? W : B);
    }
  }
  // dotted drag outline of an icon + its label (gray pattern, ink only)
  function iconOutline(ctx, bm, x, y, label) {
    const m = bm.m; ctx.fillStyle = K.patStyle(ctx, 'gray', true);
    for (let j = 0; j < bm.h; j++) for (let i = 0; i < bm.w; i++) {
      const k = j * bm.w + i; if (!m[k]) continue;
      const edge = !(i > 0 && m[k - 1]) || !(i < bm.w - 1 && m[k + 1]) || !(j > 0 && m[k - bm.w]) || !(j < bm.h - 1 && m[k + bm.w]);
      if (edge) ctx.fillRect(x + i, y + j, 1, 1);
    }
    if (label) { const L = iconLabelRect(x, y, label); patFrame(ctx, L.x, L.y, L.w, L.h, 'gray'); }
  }
  // Finder zoom rects: a short train of gray outlines interpolating from rect a to rect b
  function zoomRects(ctx, a, b, u) {
    const N = 12;
    for (let k = 0; k < 4; k++) {
      const s = (u * (N + 3) - k) / N; if (s < 0 || s > 1) continue;
      const e = 1 - Math.pow(1 - s, 1.6);
      const x = Math.round(a.x + (b.x - a.x) * e), y = Math.round(a.y + (b.y - a.y) * e), w = Math.round(a.w + (b.w - a.w) * e), h = Math.round(a.h + (b.h - a.h) * e);
      patFrame(ctx, x, y, w, h, 'gray');
    }
  }
  function cursor(ctx, kind, x, y) { const c = ICONS.CUR[kind] || ICONS.CUR.arrow; c.b.draw(ctx, x - c.hx, y - c.hy); }

  G.MAC = { SW, SH, desktop, corners, menubar, menuLayout, menu, menuGeom, window: window_, titleBar, scrollV, growBox, dialogBox, button, welcome, happy, icon, iconOutline, iconLabelRect, zoomRects, cursor };
})(window);
