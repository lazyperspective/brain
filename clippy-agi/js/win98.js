// Late-90s desktop chrome, drawn by hand: windows, menus, toolbars, scrollbars, dialogs, taskbar, cursors.
(function (G) {
  const { R, H, V, frame, edge, raised, pressed, winEdge, sunken, shallow, thinRaised, groove, vsep, hsep, dotted, dither, C, T, TW } = K;
  const SW = 800, SH = 600, TASK_Y = 572;

  function gradient(ctx, x, y, w, h, a, b) {
    // banded like a 16-bit display: 1px vertical stripes of interpolated colour
    const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    const step = 4;
    for (let i = 0; i < w; i += step) {
      const k = w > 1 ? i / (w - 1) : 0;
      const c = pa.map((v, j) => Math.round((v + (pb[j] - v) * k) / 8) * 8).map((v) => Math.min(255, v));
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(x + i, y, Math.min(step, w - i), h);
    }
  }
  function capButton(ctx, x, y, kind, down, disabled) {
    (down ? pressed : raised)(ctx, x, y, 16, 14);
    const o = down ? 1 : 0, c = disabled ? C.shadow : C.black;
    if (kind === 'close') { const P = ['##....##', '.##..##.', '..####..', '...##...', '..####..', '.##..##.', '##....##']; P.forEach((r, j) => { for (let i = 0; i < 8; i++) if (r[i] === '#') R(ctx, x + 4 + i + o, y + 3 + j + o, 1, 1, c); }); }
    if (kind === 'max') { frame(ctx, x + 3 + o, y + 2 + o, 9, 9, c); H(ctx, x + 3 + o, y + 3 + o, 9, c); }
    if (kind === 'min') R(ctx, x + 4 + o, y + 9 + o, 6, 2, c);
    if (kind === 'restore') { frame(ctx, x + 5 + o, y + 2 + o, 6, 6, c); H(ctx, x + 5 + o, y + 3 + o, 6, c); R(ctx, x + 3 + o, y + 5 + o, 6, 6, C.face); frame(ctx, x + 3 + o, y + 5 + o, 6, 6, c); H(ctx, x + 3 + o, y + 6 + o, 6, c); }
    if (kind === 'help') T(ctx, '?', x + 5 + o, y + o - 1, c, 'uib');
  }
  // window frame; returns client rect
  function window(ctx, w) {
    const { x, y } = w, ww = w.w, hh = w.h;
    winEdge(ctx, x, y, ww, hh);
    const cx = x + 3, cy = y + 3, cw = ww - 6;
    if (w.active) gradient(ctx, cx, cy, cw, 18, C.navy, C.navy2); else gradient(ctx, cx, cy, cw, 18, C.igray, C.igray2);
    let tx = cx + 3;
    if (w.icon) { ICON(ctx, w.icon, cx + 2, cy + 1); tx = cx + 21; }
    const btnW = w.dialog ? 18 : 52;
    // clip title text
    ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw - btnW - 2, 18); ctx.clip();
    T(ctx, w.title || '', tx, cy + 3, w.active ? C.white : C.face, 'uib');
    ctx.restore();
    const bx = cx + cw - 2 - 16, by = cy + 2;
    capButton(ctx, bx, by, 'close', w.down === 'close');
    if (!w.dialog) { capButton(ctx, bx - 18, by, w.max ? 'restore' : 'max', w.down === 'max'); capButton(ctx, bx - 34, by, 'min', w.down === 'min'); }
    else if (w.help) capButton(ctx, bx - 18, by, 'help');
    return { x: x + 4, y: y + 22, w: ww - 8, h: hh - 26 };
  }
  // menu bar (office=true -> command-bar style with gripper)
  function menuBar(ctx, x, y, w, items, opts = {}) {
    R(ctx, x, y, w, 19, C.face);
    let ix = x + 6;
    if (opts.office) { thinRaised(ctx, x, y, w, 21); ix = x + 9; V(ctx, x + 3, y + 3, 15, C.hi); V(ctx, x + 4, y + 3, 15, C.shadow); V(ctx, x + 5, y + 3, 15, C.hi); V(ctx, x + 6, y + 3, 15, C.shadow); }
    const out = [];
    for (const it of items) {
      const tw = TW(it.replace('&', ''));
      if (opts.open === it) { if (opts.office) pressed(ctx, ix - 1, y + 2, tw + 12, 17, null); else R(ctx, ix - 1, y + 1, tw + 12, 17, C.navy); }
      T(ctx, it, ix + 5, y + (opts.office ? 4 : 3), opts.open === it && !opts.office ? C.white : C.black, 'ui', { mnemonic: true });
      out.push({ label: it, x: ix, w: tw + 10 }); ix += tw + 12;
    }
    if (opts.docButtons) { const bx = x + w - 52; capButton(ctx, bx, y + 3, 'min'); capButton(ctx, bx + 16, y + 3, 'restore'); capButton(ctx, bx + 34, y + 3, 'close'); }
    return out;
  }
  // toolbar row: items: 'name' (16px glyph button), '|', {combo:'text', w}, {gap:n}
  function toolbar(ctx, x, y, w, items, opts = {}) {
    const h = opts.h || 26;
    thinRaised(ctx, x, y, w, h, C.face);
    V(ctx, x + 3, y + 3, h - 6, C.hi); V(ctx, x + 4, y + 3, h - 6, C.shadow); V(ctx, x + 6, y + 3, h - 6, C.hi); V(ctx, x + 7, y + 3, h - 6, C.shadow);
    let ix = x + 10;
    for (const it of items) {
      if (it === '|') { vsep(ctx, ix + 2, y + 3, h - 6); ix += 6; continue; }
      if (typeof it === 'object' && it.combo !== undefined) {
        sunken(ctx, ix, y + 3, it.w, 20, C.white);
        T(ctx, it.combo, ix + 4, y + 6, C.black, it.font || 'ui');
        raised(ctx, ix + it.w - 18, y + 5, 16, 16); K.PIXarrowDown(ctx, ix + it.w - 14, y + 11);
        ix += it.w + 4; continue;
      }
      if (typeof it === 'object' && it.gap) { ix += it.gap; continue; }
      if (opts.down && opts.down === it) pressed(ctx, ix, y + 2, 23, 22, null);
      if (opts.on && opts.on.includes(it)) { dither(ctx, ix + 1, y + 3, 21, 20, C.hi, C.face); edge(ctx, ix, y + 2, 23, 22, C.shadow, C.hi); }
      if (opts.hover === it) thinRaised(ctx, ix, y + 2, 23, 22, null);
      const o = opts.down === it || (opts.on && opts.on.includes(it)) ? 1 : 0;
      TBI(ctx, it, ix + 3 + o, y + 5 + o);
      ix += 23;
    }
    return ix;
  }
  K.PIXarrowDown = (ctx, x, y) => { H(ctx, x, y, 7, C.black); H(ctx, x + 1, y + 1, 5, C.black); H(ctx, x + 2, y + 2, 3, C.black); H(ctx, x + 3, y + 3, 1, C.black); };
  function arrow(ctx, x, y, dir, c = C.black) { // 7x4 / 4x7 small triangle
    for (let i = 0; i < 4; i++) {
      if (dir === 'down') H(ctx, x + i, y + i, 7 - 2 * i, c);
      if (dir === 'up') H(ctx, x + i, y + 3 - i, 7 - 2 * i, c);
      if (dir === 'right') V(ctx, x + i, y + i, 7 - 2 * i, c);
      if (dir === 'left') V(ctx, x + 3 - i, y + i, 7 - 2 * i, c);
    }
  }
  function vscroll(ctx, x, y, h, pos = 0, size = 0.3) {
    dither(ctx, x, y, 16, h, C.hi, C.face);
    raised(ctx, x, y, 16, 16); arrow(ctx, x + 4, y + 6, 'up');
    raised(ctx, x, y + h - 16, 16, 16); arrow(ctx, x + 4, y + h - 10, 'down');
    const track = h - 32, th = Math.max(8, Math.round(track * size)), ty = y + 16 + Math.round((track - th) * pos);
    raised(ctx, x, ty, 16, th);
  }
  function hscroll(ctx, x, y, w, pos = 0, size = 0.5) {
    dither(ctx, x, y, w, 16, C.hi, C.face);
    raised(ctx, x, y, 16, 16); arrow(ctx, x + 6, y + 4, 'left');
    raised(ctx, x + w - 16, y, 16, 16); arrow(ctx, x + w - 10, y + 4, 'right');
    const track = w - 32, tw = Math.max(8, Math.round(track * size)), tx = x + 16 + Math.round((track - tw) * pos);
    raised(ctx, tx, y, tw, 16);
  }
  function statusBar(ctx, x, y, w, panels) { // panels: [{text, w}] last one fills
    R(ctx, x, y, w, 20, C.face);
    let px = x + 2;
    panels.forEach((p, i) => {
      const pw = p.w || (x + w - 2 - px - 14);
      shallow(ctx, px, y + 2, pw, 18, null);
      if (p.text) T(ctx, p.text, px + 3, y + 5, p.dim ? C.shadow : C.black, 'ui');
      px += pw + 2;
    });
    // size grip
    for (let i = 0; i < 3; i++) { for (let j = 0; j <= i; j++) { } }
    const gx = x + w - 13, gy = y + 7;
    for (let k = 0; k < 3; k++) for (let j = 0; j < 11 - k * 4; j++) { R(ctx, gx + k * 4 + j, gy + 10 - j, 1, 1, C.hi); R(ctx, gx + k * 4 + j + 1, gy + 10 - j, 1, 1, C.shadow); R(ctx, gx + k * 4 + j + 2, gy + 10 - j, 1, 1, C.shadow); }
  }
  function button(ctx, x, y, w, h, label, o = {}) {
    if (o.def) { frame(ctx, x, y, w, h, C.black); x++; y++; w -= 2; h -= 2; }
    if (o.down) { R(ctx, x, y, w, h, C.face); frame(ctx, x, y, w, h, C.black); frame(ctx, x + 1, y + 1, w - 2, h - 2, C.shadow); }
    else raised(ctx, x, y, w, h);
    const tw = TW(label.replace('&', '')), d = o.down ? 1 : 0;
    const tx = x + Math.floor((w - tw) / 2) + d, ty = y + Math.floor((h - 13) / 2) + d;
    T(ctx, label, tx, ty, o.disabled ? C.shadow : C.black, o.bold ? 'uib' : 'ui', { mnemonic: true });
    if (o.focus) dotted(ctx, x + 3 + d, y + 3 + d, w - 6, h - 6);
  }
  function progress(ctx, x, y, w, h, frac, col = C.navy) {
    shallow(ctx, x, y, w, h, C.face);
    const inner = w - 4, n = Math.floor(Math.max(0, Math.min(1, frac)) * inner / 10 + 1e-6);
    for (let i = 0; i < n; i++) R(ctx, x + 2 + i * 10, y + 2, Math.min(8, inner - i * 10), h - 4, col);
  }
  function checkbox(ctx, x, y, on) { sunken(ctx, x, y, 13, 13, C.white); if (on) { const P = ['......#', '.....##', '#...###', '##.###.', '#####..', '.###...', '..#....']; P.forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] === '#') R(ctx, x + 3 + i, y + 3 + j, 1, 1, C.black); }); } }
  function radio(ctx, x, y, on) { K.pEllipse(ctx, x + 6, y + 6, 6, 6, C.shadow); K.pEllipse(ctx, x + 6, y + 6, 5, 5, C.white); if (on) K.pEllipse(ctx, x + 6, y + 6, 2, 2, C.black); }
  // message box (returns button rects)
  function msgBox(ctx, d) {
    const cl = window(ctx, { x: d.x, y: d.y, w: d.w, h: d.h, title: d.title, active: d.active !== false, dialog: true });
    const lines = [];
    for (const p of d.text) { if (p === '') lines.push(''); else lines.push(...K.wrap(p, d.w - 90, d.bold ? 'uib' : 'ui')); }
    const textH = lines.length * 13;
    if (d.icon) ICON(ctx, d.icon, cl.x + 11, cl.y + 11);
    const ty = cl.y + 11 + Math.max(0, Math.round((32 - textH) / 2));
    lines.forEach((l, i) => T(ctx, l, cl.x + (d.icon ? 59 : 16), ty + i * 13, C.black, d.boldLines && d.boldLines.includes(i) ? 'uib' : 'ui'));
    const n = d.buttons.length, bw = 75, gap = 6, total = n * bw + (n - 1) * gap;
    let bx = cl.x + Math.round((cl.w - total) / 2); const by = cl.y + cl.h - 23 - 11;
    const rects = [];
    d.buttons.forEach((b, i) => { button(ctx, bx, by, bw, 23, b, { def: d.def === i, focus: d.def === i, down: d.down === i }); rects.push({ x: bx, y: by, w: bw, h: 23 }); bx += bw + gap; });
    return { client: cl, buttons: rects };
  }

  // ---------- desktop ----------
  const DESK_ICONS = [
    { id: 'computer', icon: 'computer32', label: ['My Computer'], x: 0, y: 0 },
    { id: 'docs', icon: 'docs32', label: ['My Documents'], x: 0, y: 1 },
    { id: 'ie', icon: 'ie32', label: ['Internet', 'Explorer'], x: 0, y: 2 },
    { id: 'net', icon: 'net32', label: ['Network', 'Neighborhood'], x: 0, y: 3 },
    { id: 'recycle', icon: 'recycle32', label: ['Recycle Bin'], x: 0, y: 4 },
    { id: 'outlook', icon: 'outlook32', label: ['Microsoft', 'Outlook'], x: 0, y: 5 },
    { id: 'brief', icon: 'briefcase32', label: ['My Briefcase'], x: 0, y: 6 },
    { id: 'word', icon: 'word32', label: ['Microsoft', 'Word'], x: 1, y: 0, sc: true },
    { id: 'excel', icon: 'excel32', label: ['Microsoft', 'Excel'], x: 1, y: 1, sc: true },
  ];
  function iconPos(ic) { return { x: 8 + ic.x * 75, y: 6 + ic.y * 76 }; }
  function desktop(ctx, o = {}) {
    R(ctx, 0, 0, SW, SH, C.teal);
    for (const ic of DESK_ICONS) {
      const p = iconPos(ic), sel = o.sel === ic.id;
      const ix = p.x + 21, iy = p.y + 2;
      ICON(ctx, ic.icon, ix, iy);
      if (ic.sc) ICONS.shortcut(ctx, ix, iy);
      if (sel) { // navy 50% dither over the icon's own pixels
        const img = ctx.getImageData(ix, iy, 32, 32), d = img.data, tl = ctx.getImageData(ix, iy, 32, 32);
        for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const k = (j * 32 + i) * 4; const isBg = d[k] === 0 && d[k + 1] === 128 && d[k + 2] === 128; if (!isBg && (i + j) % 2 === 0) { d[k] = 0; d[k + 1] = 0; d[k + 2] = 128; } }
        ctx.putImageData(img, ix, iy);
      }
      ic.label.forEach((l, j) => {
        const tw = TW(l), lx = p.x + 37 - Math.floor(tw / 2) - 1, ly = p.y + 37 + j * 13;
        if (sel) R(ctx, lx - 1, ly, tw + 2, 13, C.navy);
        T(ctx, l, lx, ly, C.white, 'ui');
      });
      if (sel) { const tw = Math.max(...ic.label.map((l) => TW(l))); dotted(ctx, p.x + 37 - Math.floor(tw / 2) - 2, p.y + 37, tw + 3, ic.label.length * 13, C.yellow); }
    }
  }
  function taskbar(ctx, o) {
    const y = TASK_Y;
    R(ctx, 0, y, SW, 28, C.face); H(ctx, 0, y, SW, C.light); H(ctx, 0, y + 1, SW, C.hi);
    // start button
    const sd = o.startDown;
    (sd ? pressed : raised)(ctx, 2, y + 4, 54, 22);
    ICON(ctx, 'start', 5 + (sd ? 1 : 0), y + 7 + (sd ? 1 : 0));
    T(ctx, 'Start', 23 + (sd ? 1 : 0), y + 8 + (sd ? 1 : 0), C.black, 'uib');
    // quick launch
    vsep(ctx, 60, y + 4, 22); V(ctx, 63, y + 6, 18, C.hi); V(ctx, 64, y + 6, 18, C.shadow);
    ['ie16', 'outlook16', 'desk16', 'channels16'].forEach((n, i) => ICON(ctx, n, 68 + i * 22, y + 7));
    vsep(ctx, 157, y + 4, 22); V(ctx, 160, y + 6, 18, C.hi); V(ctx, 161, y + 6, 18, C.shadow);
    // tray
    const trayW = 70, tx = SW - 2 - trayW;
    shallow(ctx, tx, y + 4, trayW, 22, null);
    ICON(ctx, 'speaker16', tx + 3, y + 7);
    const clk = o.clock || '9:14 AM'; T(ctx, clk, tx + trayW - 6 - TW(clk), y + 9, C.black, 'ui');
    // task buttons
    const tasks = o.tasks || [], x0 = 166, avail = tx - 4 - x0;
    if (tasks.length) {
      const rows = tasks.length > 9 ? 2 : 1;
      const perRow = Math.ceil(tasks.length / rows);
      const bw = Math.min(160, Math.floor((avail + 3) / perRow) - 3), bh = rows === 2 ? 11 : 22;
      tasks.forEach((tk, i) => {
        const r = Math.floor(i / perRow), c = i % perRow;
        const bx = x0 + c * (bw + 3), by = y + 4 + r * (bh + 0);
        if (rows === 2) { (tk.active ? pressed : raised)(ctx, bx, by, bw, bh); return; }
        if (tk.active) { pressed(ctx, bx, by, bw, bh, null); dither(ctx, bx + 2, by + 2, bw - 4, bh - 4, C.hi, C.face); } else raised(ctx, bx, by, bw, bh);
        const o2 = tk.active ? 1 : 0;
        if (bw > 26) ICON(ctx, tk.icon, bx + 4 + o2, by + 3 + o2); else ICON(ctx, tk.icon, bx + Math.floor((bw - 16) / 2), by + 3);
        if (bw > 40) {
          let s = tk.title; const maxw = bw - 28;
          const f = tk.active ? 'uib' : 'ui';
          if (TW(s, f) > maxw) { while (s.length > 1 && TW(s + '...', f) > maxw) s = s.slice(0, -1); s += '...'; }
          T(ctx, s, bx + 23 + o2, by + 5 + o2, C.black, f);
        }
      });
    }
  }

  // ---------- cursors ----------
  const CUR = {
    arrow: { hx: 0, hy: 0, rows: ['X', 'XX', 'X.X', 'X..X', 'X...X', 'X....X', 'X.....X', 'X......X', 'X.......X', 'X........X', 'X.....XXXXX', 'X..X..X', 'X.X X..X', 'XX  X..X', 'X    X..X', '     X..X', '      X..X', '      X..X', '       XX'] },
    hour: { hx: 6, hy: 10, rows: ['XXXXXXXXXXXXX', 'X...........X', 'XXXXXXXXXXXXX', ' X.........X', ' X.........X', ' X.X.X.X.X.X', '  X.X.X.X.X', '   X.X.X.X', '    X.X.X', '     X.X', '     X.X', '    X...X', '   X..X..X', '  X...X...X', ' X..X.X.X..X', ' X.X.X.X.X.X', ' X.........X', 'XXXXXXXXXXXXX', 'X...........X', 'XXXXXXXXXXXXX'] },
    ibeam: { hx: 3, hy: 8, rows: ['XXX XXX', '   X', '   X', '   X', '   X', '   X', '   X', '   X', '   X', '   X', '   X', '   X', '   X', '   X', '   X', 'XXX XXX'] },
    hand: { hx: 5, hy: 0, rows: ['     XX', '    X..X', '    X..X', '    X..X', '    X..XXX', '    X..X..XXX', ' XX X..X..X..XX', 'X..XX........X.X', 'X...X..........X', ' X.............X', '  X............X', '  X...........X', '   X..........X', '   X.........X', '    X........X', '    X........X', '    XXXXXXXXXX'] },
  };
  function drawCur(ctx, c, x, y) {
    c.rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch === 'X') R(ctx, x + i, y + j, 1, 1, C.black); else if (ch === '.') R(ctx, x + i, y + j, 1, 1, C.white); } });
  }
  function cursor(ctx, kind, x, y) {
    x = Math.round(x); y = Math.round(y);
    if (kind === 'busy') { drawCur(ctx, CUR.arrow, x, y); // arrow + small hourglass
      const hg = ['XXXXXXX', 'X.....X', ' X...X', '  X.X', '  X.X', ' X.X.X', 'X.X.X.X', 'XXXXXXX'];
      hg.forEach((r, j) => { for (let i = 0; i < r.length; i++) { if (r[i] === 'X') R(ctx, x + 11 + i, y + 9 + j, 1, 1, C.black); else if (r[i] === '.') R(ctx, x + 11 + i, y + 9 + j, 1, 1, C.white); } });
      return; }
    const c = CUR[kind] || CUR.arrow; drawCur(ctx, c, x - c.hx, y - c.hy);
  }

  G.W98 = { SW, SH, TASK_Y, gradient, capButton, window, menuBar, toolbar, arrow, vscroll, hscroll, statusBar, button, progress, checkbox, radio, msgBox, desktop, taskbar, cursor, DESK_ICONS, iconPos };
})(window);
