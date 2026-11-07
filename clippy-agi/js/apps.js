// Application windows recreated by hand: word processor, spreadsheet (+ chart, chart wizard), mail client,
// message windows, web browser, paint program, file-copy dialog. Each takes a window rect + a state object.
(function (G) {
  const { R, H, V, frame, edge, raised, pressed, sunken, shallow, thinRaised, vsep, hsep, dotted, dither, C, T, TW, wrap, clamp } = K;
  const W = W98;

  function clipTo(ctx, x, y, w, h) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }

  // ================= WORD =================
  const WORD_MENU = ['&File', '&Edit', '&View', '&Insert', 'F&ormat', '&Tools', 'T&able', '&Window', '&Help'];
  const WORD_STD = ['new', 'open', 'save', '|', 'print', 'preview', 'spell', '|', 'cut', 'copy', 'paste', 'painter', '|', 'undo', 'redo', '|', 'link', 'web', '|', 'table', 'xlsheet', 'columns', 'drawing', '|', 'docmap', 'pilcrow', { combo: '100%', w: 50 }, 'help'];
  const WORD_FMT = [{ combo: 'Normal', w: 84 }, { combo: 'Times New Roman', w: 122 }, { combo: '12', w: 34 }, '|', 'bold', 'italic', 'under', '|', 'alignl', 'alignc', 'alignr', 'justify', '|', 'numbering', 'bullets', 'outdent', 'indent', '|', 'border', 'highlight', 'fontcolor'];
  function ruler(ctx, x, y, w, textX, textW) {
    R(ctx, x, y, w, 18, C.face);
    R(ctx, textX - 2, y + 3, textW + 4, 12, C.white); R(ctx, x + 2, y + 3, textX - x - 4, 12, C.shadow); R(ctx, textX + textW + 2, y + 3, x + w - textX - textW - 4, 12, C.shadow);
    edge(ctx, x + 2, y + 2, w - 4, 14, C.shadow, C.hi);
    for (let i = 0; textX + i * 12 < x + w - 4; i++) {
      const px = textX + i * 12;
      if (i % 8 === 0 && i > 0) { const s = String(i / 8); T(ctx, s, px - Math.floor(TW(s) / 2), y + 3, C.black, 'ui'); }
      else if (i % 4 === 0) V(ctx, px, y + 6, 6, C.black); else if (i > 0) V(ctx, px, y + 8, 2, C.black);
    }
    // indent markers
    const mk = (mx, up) => { for (let j = 0; j < 4; j++) H(ctx, mx - 3 + j, y + (up ? 3 + j : 14 - j), 7 - 2 * j, C.face); };
    R(ctx, textX - 4, y + 2, 9, 4, C.face); frame(ctx, textX - 4, y + 2, 9, 4, C.shadow); R(ctx, textX - 4, y + 12, 9, 5, C.face); frame(ctx, textX - 4, y + 12, 9, 5, C.shadow);
    R(ctx, textX + textW - 4, y + 12, 9, 5, C.face); frame(ctx, textX + textW - 4, y + 12, 9, 5, C.shadow);
  }
  // layout paragraphs into lines (serif16); returns {lines:[{s, x, y}], caret:{x,y}}
  function layoutDoc(paras, n, maxW, f = 'serif16', lh = 19) {
    const lines = []; let y = 0, left = n == null ? 1e9 : n, caret = { x: 0, y: 0 };
    for (let p = 0; p < paras.length; p++) {
      if (left < 0) break;
      const full = paras[p], k = Math.min(full.length, left);
      const fl = full.length ? wrap(full, maxW, f) : [''];
      let used = 0;
      for (let i = 0; i < fl.length; i++) {
        const seg = fl[i], take = Math.max(0, Math.min(seg.length, k - used)), s = seg.slice(0, take);
        lines.push({ s, y }); caret = { x: TW(s, f), y }; y += lh;
        used += seg.length + 1;
        if (used > k) break;
      }
      left -= full.length + 1;
    }
    return { lines, caret };
  }
  function word(ctx, win, st) {
    const cl = W.window(ctx, { x: win.x, y: win.y, w: win.w, h: win.h, title: st.title || 'Microsoft Word - Document1', icon: 'word16', active: win.active, down: win.down });
    if (st.paint != null && st.paint < 1) { R(ctx, cl.x, cl.y, cl.w, cl.h, C.face); if (st.paint < 0.3) return cl; }
    clipTo(ctx, cl.x, cl.y, cl.w, cl.h);
    let y = cl.y;
    W.menuBar(ctx, cl.x, y, cl.w, WORD_MENU, { office: true }); y += 21;
    W.toolbar(ctx, cl.x, y, cl.w, WORD_STD); y += 26;
    W.toolbar(ctx, cl.x, y, cl.w, WORD_FMT, { on: st.boldOn ? ['bold'] : [] }); y += 26;
    if (st.paint != null && st.paint < 0.6) { ctx.restore(); return cl; }
    const textX = cl.x + 14, docW = cl.w - 16, textW = Math.min(576, docW - 30);
    ruler(ctx, cl.x, y, docW, textX, textW); R(ctx, cl.x + docW, y, 16, 18, C.face); y += 18;
    const docTop = y, docH = cl.y + cl.h - 20 - 16 - docTop;
    R(ctx, cl.x, docTop, docW, docH, C.white);
    W.vscroll(ctx, cl.x + docW, docTop, docH, 0, 0.9);
    // h scroll with view buttons
    const hy = docTop + docH;
    R(ctx, cl.x, hy, cl.w, 16, C.face);
    ['normal', 'online', 'layout', 'outline'].forEach((v, i) => { (i === 0 ? pressed : raised)(ctx, cl.x + i * 16, hy, 16, 16); R(ctx, cl.x + 4 + i * 16 + (i === 0), hy + 4 + (i === 0), 8, 8, i === 2 ? C.white : '#e0e0e0'); for (let j = 0; j < 3; j++) H(ctx, cl.x + 5 + i * 16 + (i === 0), hy + 5 + j * 2 + (i === 0), 6, C.navy); });
    W.hscroll(ctx, cl.x + 64, hy, docW - 64, 0, 0.85); R(ctx, cl.x + docW, hy, 16, 16, C.face);
    // document text
    clipTo(ctx, cl.x, docTop, docW, docH);
    const lay = layoutDoc(st.paras || [], st.n, textW);
    const ty = docTop + 4 - (st.scroll || 0);
    for (const ln of lay.lines) T(ctx, ln.s, textX, ty + ln.y, C.black, 'serif16');
    if (st.sel) { const s = st.sel; ctx.globalCompositeOperation = 'difference'; R(ctx, textX + s.x, ty + s.y, s.w, 19, C.white); ctx.globalCompositeOperation = 'source-over'; }
    if (st.caret !== false && (st.caretBlink ? (Math.floor(st.t / 0.53) % 2 === 0) : true)) R(ctx, textX + lay.caret.x, ty + lay.caret.y + 1, 1, 17, C.black);
    // end-of-document marker (Normal view)
    const endY = ty + lay.lines.length * 19 + 2;
    if (st.endMark !== false) R(ctx, textX, endY + 2, 1, 1, C.black), H(ctx, textX - 1, endY + 1, 0, C.black);
    ctx.restore();
    // status bar
    const ln = Math.max(1, lay.lines.length), col = (lay.lines.length ? lay.lines[lay.lines.length - 1].s.length : 0) + 1;
    const sy = cl.y + cl.h - 20;
    R(ctx, cl.x, sy, cl.w, 20, C.face);
    let sx = cl.x + 2;
    const pan = (s, w) => { shallow(ctx, sx, sy + 2, w, 17, null); T(ctx, s, sx + 4, sy + 4, C.black); sx += w + 2; };
    pan('Page 1', 60); pan('Sec 1', 44); pan('1/1', 40); pan('At 1"', 52); pan('Ln ' + ln, 44); pan('Col ' + col, 52);
    shallow(ctx, sx, sy + 2, 150, 17, null); ['REC', 'TRK', 'EXT', 'OVR', 'WPH'].forEach((s, i) => T(ctx, s, sx + 4 + i * 29, sy + 4, C.shadow)); sx += 152;
    shallow(ctx, sx, sy + 2, 22, 17, null); R(ctx, sx + 5, sy + 5, 12, 10, C.white); frame(ctx, sx + 5, sy + 5, 12, 10, C.black); V(ctx, sx + 11, sy + 5, 10, C.black);
    ctx.restore();
    st.layout = { docTop, textX, ty, caret: lay.caret };
    return cl;
  }

  // ================= EXCEL =================
  const XL_MENU = ['&File', '&Edit', '&View', '&Insert', 'F&ormat', '&Tools', '&Data', '&Window', '&Help'];
  const XL_STD = ['new', 'open', 'save', '|', 'print', 'preview', 'spell', '|', 'cut', 'copy', 'paste', 'painter', '|', 'undo', 'redo', '|', 'link', 'web', '|', 'sum', 'fx', 'sortaz', 'sortza', '|', 'map', 'chart', 'drawing', { combo: '100%', w: 50 }, 'help'];
  const XL_FMT = [{ combo: 'Arial', w: 104 }, { combo: '10', w: 34 }, '|', 'bold', 'italic', 'under', '|', 'alignl', 'alignc', 'alignr', 'justify', '|', 'currency', 'percent', 'comma', 'incdec', '|', 'outdent', 'indent', '|', 'border', 'fill', 'fontcolor'];
  const COLS = 'ABCDEFGHIJKLMNOP';
  function colX(widths, x0, c) { let x = x0; for (let i = 0; i < c; i++) x += widths[i] || 64; return x; }
  function excel(ctx, win, st) {
    const cl = W.window(ctx, { x: win.x, y: win.y, w: win.w, h: win.h, title: st.title || 'Microsoft Excel - Book1', icon: 'excel16', active: win.active });
    if (st.paint != null && st.paint < 1) { R(ctx, cl.x, cl.y, cl.w, cl.h, C.face); if (st.paint < 0.3) return cl; }
    clipTo(ctx, cl.x, cl.y, cl.w, cl.h);
    let y = cl.y;
    W.menuBar(ctx, cl.x, y, cl.w, XL_MENU, { office: true }); y += 21;
    W.toolbar(ctx, cl.x, y, cl.w, XL_STD, { down: st.tbDown }); y += 26;
    W.toolbar(ctx, cl.x, y, cl.w, XL_FMT, { on: st.boldOn ? ['bold'] : [] }); y += 26;
    // formula bar
    R(ctx, cl.x, y, cl.w, 24, C.face);
    sunken(ctx, cl.x + 2, y + 2, 78, 20, C.white); T(ctx, st.nameBox || 'A1', cl.x + 6, y + 6); raised(ctx, cl.x + 62, y + 4, 16, 16); K.PIXarrowDown(ctx, cl.x + 66, y + 11);
    if (st.editing) { raised(ctx, cl.x + 84, y + 3, 20, 18); T(ctx, 'X', cl.x + 91, y + 6, C.red, 'uib'); raised(ctx, cl.x + 105, y + 3, 20, 18); T(ctx, 'v', cl.x + 112, y + 5, C.green, 'uib'); }
    raised(ctx, cl.x + 126, y + 3, 20, 18); T(ctx, '=', cl.x + 133, y + 6, C.black, 'uib');
    sunken(ctx, cl.x + 148, y + 2, cl.w - 150, 20, C.white); T(ctx, st.formula || '', cl.x + 152, y + 6, C.black, 'sans13');
    if (st.editing) R(ctx, cl.x + 152 + TW(st.formula || '', 'sans13'), y + 5, 1, 14, C.black);
    y += 24;
    // grid
    const gx = cl.x, gy = y, gw = cl.w - 16, gh = cl.y + cl.h - 20 - 17 - gy;
    const widths = st.widths || [];
    const rowH = 17, hdrW = 26;
    R(ctx, gx, gy, gw, gh, C.white);
    clipTo(ctx, gx, gy, gw, gh);
    const nRows = Math.ceil((gh - rowH) / rowH);
    // gridlines
    for (let r = 0; r <= nRows; r++) H(ctx, gx + hdrW, gy + rowH + r * rowH - 1, gw, C.grid);
    for (let c = 0, x = gx + hdrW; x < gx + gw; c++) { x += widths[c] || 64; V(ctx, x - 1, gy, gh, C.grid); }
    // selection range highlight (inverted like the era)
    const cells = st.cells || {};
    const cellRect = (c, r) => ({ x: colX(widths, gx + hdrW, c), y: gy + rowH + (r - 1) * rowH, w: widths[c] || 64, h: rowH });
    if (st.range) { const [c0, r0, c1, r1] = st.range; const a = cellRect(c0, r0), b = cellRect(c1, r1); R(ctx, a.x, a.y, b.x + b.w - a.x - 1, b.y + b.h - a.y - 1, '#000000'); }
    // fills
    for (const k in cells) { const cc = cells[k]; if (!cc.fill) continue; const c = COLS.indexOf(k[0]), r = +k.slice(1); const rc = cellRect(c, r); R(ctx, rc.x, rc.y, rc.w - 1, rc.h - 1, cc.fill); }
    // cell text (left text overflows into empty neighbours)
    for (const k in cells) {
      const cc = cells[k]; if (cc.v == null || cc.v === '') continue;
      const c = COLS.indexOf(k[0]), r = +k.slice(1); const rc = cellRect(c, r);
      const f = cc.b ? 'sans13b' : 'sans13'; const s = String(cc.v); const tw = TW(s, f);
      let inRange = false; if (st.range) { const [c0, r0, c1, r1] = st.range; inRange = c >= c0 && c <= c1 && r >= r0 && r <= r1 && !(st.sel && st.sel[0] === c && st.sel[1] === r); }
      const col = inRange ? C.white : cc.col || C.black;
      const num = cc.al === 'r' || (cc.al == null && /^[-$(0-9]/.test(s) && !/[a-z]/i.test(s.replace(/[$,().%-]/g, '')));
      if (num) { ctx.save(); ctx.beginPath(); ctx.rect(rc.x, rc.y, rc.w - 1, rc.h); ctx.clip(); T(ctx, tw > rc.w - 4 ? '#'.repeat(Math.floor((rc.w - 4) / 7)) : s, rc.x + rc.w - 3 - Math.min(tw, rc.w - 4), rc.y + 1, col, f); ctx.restore(); }
      else if (cc.al === 'c') T(ctx, s, rc.x + Math.floor((rc.w - tw) / 2), rc.y + 1, col, f);
      else {
        // overflow width: extend through empty cells to the right
        let ow = rc.w; for (let cc2 = c + 1; cc2 < 16; cc2++) { const nk = COLS[cc2] + r; if (cells[nk] && cells[nk].v != null && cells[nk].v !== '') break; ow += widths[cc2] || 64; if (ow > tw + 6) break; }
        ctx.save(); ctx.beginPath(); ctx.rect(rc.x, rc.y, ow - 1, rc.h); ctx.clip();
        if (ow > rc.w && !inRange) R(ctx, rc.x + rc.w - 1, rc.y, ow - rc.w, rc.h - 1, cc.fill || C.white);
        T(ctx, s, rc.x + 2, rc.y + 1, col, f); ctx.restore();
      }
      if (cc.u) H(ctx, rc.x + 2, rc.y + 14, tw, col);
    }
    // borders
    if (st.borders) for (const [c, r, side] of st.borders) { const rc = cellRect(c, r); if (side === 'b') H(ctx, rc.x - 1, rc.y + rc.h - 1, rc.w + 1, C.black); if (side === 'bb') { H(ctx, rc.x - 1, rc.y + rc.h - 3, rc.w + 1, C.black); H(ctx, rc.x - 1, rc.y + rc.h - 1, rc.w + 1, C.black); } }
    // active cell
    if (st.sel) { const rc = cellRect(st.sel[0], st.sel[1]); frame(ctx, rc.x - 2, rc.y - 2, rc.w + 3, rc.h + 3, C.black); frame(ctx, rc.x - 1, rc.y - 1, rc.w + 1, rc.h + 1, C.black); R(ctx, rc.x + rc.w - 3, rc.y + rc.h - 3, 5, 5, C.black); R(ctx, rc.x + rc.w - 4, rc.y + rc.h - 4, 1, 7, C.white); R(ctx, rc.x + rc.w - 4, rc.y + rc.h - 4, 7, 1, C.white); }
    // chart object
    if (st.chart) chart(ctx, st.chart);
    ctx.restore();
    // headers
    R(ctx, gx, gy, gw, rowH, C.face); R(ctx, gx, gy, hdrW, gh, C.face);
    raised(ctx, gx, gy, hdrW, rowH);
    for (let c = 0, x = gx + hdrW; x < gx + gw; c++) {
      const w = widths[c] || 64; const on = st.sel && (st.sel[0] === c || (st.range && c >= st.range[0] && c <= st.range[2]));
      thinRaised(ctx, x, gy, w, rowH, C.face); if (on) { H(ctx, x, gy, w, C.hi); }
      const s = COLS[c] || ''; T(ctx, s, x + Math.floor((w - TW(s, on ? 'uib' : 'ui')) / 2), gy + 2, C.black, on ? 'uib' : 'ui'); x += w;
    }
    for (let r = 1; r <= nRows; r++) {
      const ry = gy + rowH + (r - 1) * rowH; const on = st.sel && (st.sel[1] === r || (st.range && r >= st.range[1] && r <= st.range[3]));
      thinRaised(ctx, gx, ry, hdrW, rowH, C.face);
      const s = String(r); T(ctx, s, gx + Math.floor((hdrW - TW(s, on ? 'uib' : 'ui')) / 2), ry + 2, C.black, on ? 'uib' : 'ui');
    }
    W.vscroll(ctx, gx + gw, gy, gh, 0, 0.2);
    // sheet tabs + h scroll
    const ty = gy + gh;
    R(ctx, cl.x, ty, cl.w, 17, C.face);
    ['first', 'prev', 'next', 'last'].forEach((b, i) => { raised(ctx, cl.x + i * 16, ty, 16, 16); W.arrow(ctx, cl.x + i * 16 + 6, ty + 4, i < 2 ? 'left' : 'right'); });
    let tx = cl.x + 68;
    const tabs = st.tabs || ['Sheet1', 'Sheet2', 'Sheet3'];
    tabs.forEach((tb, i) => {
      const f = i === (st.tab || 0) ? 'uib' : 'ui'; const w = TW(tb, f) + 18;
      if (i === (st.tab || 0)) { R(ctx, tx - 2, ty, w + 4, 16, C.white); V(ctx, tx - 2, ty, 16, C.black); V(ctx, tx + w + 1, ty, 16, C.black); H(ctx, tx - 2, ty + 15, w + 4, C.black); }
      else { R(ctx, tx, ty + 1, w, 14, C.face); V(ctx, tx, ty, 15, C.black); V(ctx, tx + w, ty, 15, C.black); H(ctx, tx, ty + 15, w, C.black); }
      T(ctx, tb, tx + 9, ty + 1, C.black, f); tx += w + 2;
    });
    W.hscroll(ctx, cl.x + cl.w - 16 - 220, ty, 220, 0, 0.4);
    W.statusBar(ctx, cl.x, cl.y + cl.h - 20, cl.w, [{ text: st.status || 'Ready', w: cl.w - 120 }, { text: st.sum || '', w: 60 }, { text: 'NUM', w: 40 }]);
    ctx.restore();
    st.cellRect = cellRect;
    return cl;
  }
  // embedded chart (era default look: grey plot area, periwinkle bars)
  function chart(ctx, ch) {
    const { x, y, w, h } = ch;
    const g = ch.grow == null ? 1 : ch.grow;
    R(ctx, x, y, w, h, C.white); frame(ctx, x, y, w, h, C.black);
    T(ctx, ch.title, x + Math.floor((w - TW(ch.title, 'sans16b')) / 2), y + 6, C.black, 'sans16b');
    const px = x + 70, py = y + 32, pw = w - 84, ph = h - 92;
    R(ctx, px, py, pw, ph, C.face); frame(ctx, px, py, pw, ph, C.shadow);
    const max = ch.max, steps = ch.steps || 5;
    for (let i = 0; i <= steps; i++) { const yy = py + ph - Math.round(ph * i / steps); H(ctx, px, yy, pw, C.black); const lab = ch.fmt(max * i / steps); T(ctx, lab, px - 6 - TW(lab, 'sans11'), yy - 7, C.black, 'sans11'); }
    V(ctx, px, py, ph, C.black);
    const n = ch.data.length, bw = Math.floor(pw / n);
    ch.data.forEach((d, i) => {
      const k = clamp(g * 1.6 - i * 0.07, 0, 1);
      const bh = Math.max(d.v > 0 ? 1 : 0, Math.round(ph * Math.min(1, d.v / max) * k));
      const bx = px + i * bw + Math.floor(bw * 0.2), bww = Math.max(3, Math.floor(bw * 0.6));
      R(ctx, bx, py + ph - bh, bww, bh, d.c || '#9999ff'); frame(ctx, bx, py + ph - bh, bww, bh, C.black);
      if (d.v > max) { // broken bar going through the roof
        R(ctx, bx - 2, py - 4, bww + 4, 3, C.white);
        if (k >= 1) T(ctx, d.over || '', bx + bww + 3, py + 2, C.red, 'sans13b');
      }
      // label (two short lines)
      const ls = d.l.split('\n');
      ls.forEach((l, j) => T(ctx, l, px + i * bw + Math.floor((bw - TW(l, 'sans11')) / 2), py + ph + 4 + j * 12, C.black, 'sans11'));
    });
    if (ch.selected) { const hs = (hx, hy) => R(ctx, hx - 2, hy - 2, 5, 5, C.black); hs(x, y); hs(x + w / 2, y); hs(x + w - 1, y); hs(x, y + h / 2); hs(x + w - 1, y + h / 2); hs(x, y + h - 1); hs(x + w / 2, y + h - 1); hs(x + w - 1, y + h - 1); }
  }
  function chartWizard(ctx, win, st) {
    const step = st.step || 1;
    const titles = ['Chart Type', 'Chart Source Data', 'Chart Options', 'Chart Location'];
    const cl = W.window(ctx, { x: win.x, y: win.y, w: win.w, h: win.h, title: `Chart Wizard - Step ${step} of 4 - ${titles[step - 1]}`, active: true, dialog: true, help: true });
    const bx = cl.x + 8, by = cl.y + 8, bw = cl.w - 16, bh = cl.h - 50;
    if (step === 1) {
      // tabs
      R(ctx, bx, by + 18, bw, bh - 18, C.face); edge(ctx, bx, by + 18, bw, bh - 18, C.hi, C.dark); edge(ctx, bx + 1, by + 19, bw - 2, bh - 20, C.face, C.shadow);
      R(ctx, bx + 2, by + 1, 92, 19, C.face); H(ctx, bx + 3, by, 89, C.hi); V(ctx, bx + 1, by + 2, 17, C.hi); V(ctx, bx + 94, by + 2, 17, C.dark); T(ctx, 'Standard Types', bx + 10, by + 3);
      H(ctx, bx + 96, by + 3, 86, C.hi); V(ctx, bx + 96, by + 3, 16, C.hi); V(ctx, bx + 182, by + 4, 15, C.dark); T(ctx, 'Custom Types', bx + 104, by + 5);
      T(ctx, 'Chart type:', bx + 10, by + 26); sunken(ctx, bx + 10, by + 42, 130, 150, C.white);
      const types = ['Column', 'Bar', 'Line', 'Pie', 'XY (Scatter)', 'Area', 'Doughnut', 'Radar', 'Surface', 'Bubble'];
      types.forEach((tp, i) => { const yy = by + 45 + i * 14; if (i === 0) R(ctx, bx + 13, yy, 124, 14, C.navy); R(ctx, bx + 15, yy + 3, 9, 8, i === 0 ? '#9999ff' : ['#9999ff', '#ff9999', '#99ff99', '#ffff99'][i % 4]); frame(ctx, bx + 15, yy + 3, 9, 8, C.black); T(ctx, tp, bx + 30, yy, i === 0 ? C.white : C.black); });
      T(ctx, 'Chart sub-type:', bx + 150, by + 26); sunken(ctx, bx + 150, by + 42, bw - 160, 150, C.white);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const cx = bx + 158 + i * Math.floor((bw - 175) / 3), cy = by + 48 + j * 46; if (i === 0 && j === 0) R(ctx, cx - 3, cy - 3, 46, 42, C.black); R(ctx, cx, cy, 40, 36, C.white); for (let b = 0; b < 3; b++) { const hh = [16, 28, 22][(b + i + j) % 3]; R(ctx, cx + 5 + b * 11, cy + 34 - hh, 8, hh, ['#9999ff', '#993366', '#ffffcc'][b]); frame(ctx, cx + 5 + b * 11, cy + 34 - hh, 8, hh, C.black); } }
    } else {
      R(ctx, bx, by, bw, bh, C.face); edge(ctx, bx, by, bw, bh, C.hi, C.dark);
      sunken(ctx, bx + 20, by + 14, bw - 40, bh - 60, C.white);
      // preview chart
      const pw = bw - 80, ph = bh - 100; const px = bx + 40, py = by + 30;
      R(ctx, px, py, pw, ph, C.face); [0.2, 0.95, 0.75, 0.35, 0.2, 0.15, 0.1, 0.05].forEach((v, i) => { const bh2 = Math.round(ph * v); R(ctx, px + 8 + i * Math.floor((pw - 16) / 8), py + ph - bh2, 10, bh2, '#9999ff'); frame(ctx, px + 8 + i * Math.floor((pw - 16) / 8), py + ph - bh2, 10, bh2, C.black); });
      const lab = step === 2 ? 'Data range:  =Sheet1!$A$3:$C$12' : step === 3 ? 'Chart title:  WHERE THE MONEY WENT' : 'Place chart:  (o) As object in: Sheet1';
      T(ctx, lab, bx + 22, by + bh - 36);
    }
    const labels = ['Cancel', '< Back', 'Next >', 'Finish'];
    labels.forEach((l, i) => W.button(ctx, cl.x + cl.w - 8 - (4 - i) * 79 + 4, cl.y + cl.h - 32, 75, 23, l, { disabled: (i === 1 && step === 1) || (i === 2 && step === 4), def: i === 2, down: st.down === i }));
    return cl;
  }

  // ================= MAIL =================
  const OL_MENU = ['&File', '&Edit', '&View', '&Go', '&Tools', '&Compose', '&Help'];
  function outlookBarIcon(ctx, kind, x, y) {
    if (kind === 'inbox') { R(ctx, x + 2, y + 10, 28, 18, '#ffff99'); frame(ctx, x + 2, y + 10, 28, 18, C.black); R(ctx, x + 8, y + 4, 16, 12, C.white); frame(ctx, x + 8, y + 4, 16, 12, C.black); H(ctx, x + 3, y + 18, 26, C.black); R(ctx, x + 10, y + 18, 12, 4, '#c0c000'); }
    if (kind === 'cal') { R(ctx, x + 3, y + 3, 26, 25, C.white); frame(ctx, x + 3, y + 3, 26, 25, C.black); R(ctx, x + 4, y + 4, 24, 6, '#c00000'); for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) R(ctx, x + 6 + i * 6, y + 13 + j * 5, 3, 3, C.shadow); }
    if (kind === 'contacts') { R(ctx, x + 4, y + 4, 24, 24, '#e0c890'); frame(ctx, x + 4, y + 4, 24, 24, C.black); K.pEllipse(ctx, x + 16, y + 12, 4, 4, '#804000'); R(ctx, x + 9, y + 18, 14, 7, '#0000c0'); }
    if (kind === 'tasks') { R(ctx, x + 5, y + 3, 22, 26, C.white); frame(ctx, x + 5, y + 3, 22, 26, C.black); for (let j = 0; j < 4; j++) { R(ctx, x + 8, y + 7 + j * 5, 3, 3, '#008000'); H(ctx, x + 13, y + 8 + j * 5, 11, C.black); } }
    if (kind === 'journal') { R(ctx, x + 4, y + 4, 24, 24, '#8080ff'); frame(ctx, x + 4, y + 4, 24, 24, C.black); H(ctx, x + 8, y + 10, 16, C.white); H(ctx, x + 8, y + 15, 16, C.white); }
    if (kind === 'notes') { R(ctx, x + 4, y + 4, 24, 24, '#ffff80'); frame(ctx, x + 4, y + 4, 24, 24, C.black); R(ctx, x + 4, y + 4, 24, 4, '#e0e060'); }
    if (kind === 'deleted') { ICON(ctx, 'recycle32', x, y - 2); }
  }
  function outlook(ctx, win, st) {
    const cl = W.window(ctx, { x: win.x, y: win.y, w: win.w, h: win.h, title: st.title || 'Inbox - Microsoft Outlook', icon: 'outlook16', active: win.active });
    clipTo(ctx, cl.x, cl.y, cl.w, cl.h);
    let y = cl.y;
    W.menuBar(ctx, cl.x, y, cl.w, OL_MENU, { office: true }); y += 21;
    thinRaised(ctx, cl.x, y, cl.w, 26, C.face);
    // toolbar with "New" button
    raised(ctx, cl.x + 10, y + 2, 52, 22); ICON(ctx, 'outlook16', cl.x + 13, y + 5); T(ctx, 'New', cl.x + 33, y + 6);
    ['print', 'open', 'cut', '|', 'undo', 'redo', 'web', '|', 'help'].forEach((n, i) => { if (n !== '|') TBI(ctx, n, cl.x + 72 + i * 23, y + 5); else vsep(ctx, cl.x + 76 + i * 23, y + 4, 18); });
    y += 26;
    // folder banner
    R(ctx, cl.x, y, cl.w, 28, C.shadow); T(ctx, st.folder || 'Inbox', cl.x + 92, y + 3, C.white, 'sans20b');
    y += 28;
    const barW = 84, listX = cl.x + barW + 2, bottom = cl.y + cl.h - 20;
    // outlook bar
    R(ctx, cl.x, y, barW, bottom - y, C.shadow); raised(ctx, cl.x, y, barW, 20); T(ctx, 'Outlook', cl.x + 21, y + 3, C.black);
    ['inbox', 'cal', 'contacts', 'tasks', 'journal', 'notes', 'deleted'].forEach((k, i) => {
      const iy = y + 26 + i * 54; if (iy + 50 > bottom) return;
      outlookBarIcon(ctx, k, cl.x + 26, iy);
      const lab = ['Inbox', 'Calendar', 'Contacts', 'Tasks', 'Journal', 'Notes', 'Deleted Items'][i];
      T(ctx, lab, cl.x + 42 - Math.floor(TW(lab) / 2), iy + 33, C.white);
    });
    // message list
    const lw = cl.x + cl.w - listX;
    R(ctx, listX, y, lw, bottom - y, C.white);
    const cols = [['!', 14], ['', 18], ['From', 120], ['Subject', 300], ['Received', 160]];
    let cx = listX; for (const [h, w] of cols) { raised(ctx, cx, y, w, 18); T(ctx, h, cx + 4, y + 2); cx += w; }
    const rows = st.rows || [];
    rows.forEach((r, i) => {
      const ry = y + 19 + i * 16; if (ry > bottom - 16) return;
      if (r.sel) R(ctx, listX, ry, lw, 16, C.navy);
      const col = r.sel ? C.white : C.black, f = r.unread ? 'uib' : 'ui';
      R(ctx, listX + 17, ry + 4, 12, 8, r.sel ? C.white : '#ffff99'); frame(ctx, listX + 17, ry + 4, 12, 8, col);
      if (r.imp) T(ctx, '!', listX + 4, ry + 1, r.sel ? C.white : C.red, 'uib');
      T(ctx, r.from, listX + 36, ry + 1, col, f); T(ctx, r.subj, listX + 156, ry + 1, col, f); T(ctx, r.when || 'Mon 11/9/98 9:17 AM', listX + 456, ry + 1, col, f);
    });
    ctx.restore();
    W.statusBar(ctx, cl.x, cl.y + cl.h - 20, cl.w, [{ text: st.status || (rows.length + ' Items'), w: cl.w - 4 }]);
    return cl;
  }
  // message window: read note (thread) or compose
  function mail(ctx, win, st) {
    const cl = W.window(ctx, { x: win.x, y: win.y, w: win.w, h: win.h, title: st.title || 'Untitled - Message', icon: 'outlook16', active: win.active });
    clipTo(ctx, cl.x, cl.y, cl.w, cl.h);
    let y = cl.y;
    W.menuBar(ctx, cl.x, y, cl.w, ['&File', '&Edit', '&View', '&Insert', 'F&ormat', '&Tools', '&Compose', '&Help'], { office: true }); y += 21;
    thinRaised(ctx, cl.x, y, cl.w, 26, C.face);
    if (st.compose) {
      (st.sendDown ? pressed : raised)(ctx, cl.x + 10, y + 2, 54, 22); const o = st.sendDown ? 1 : 0;
      P_send(ctx, cl.x + 14 + o, y + 6 + o); T(ctx, 'Send', cl.x + 33 + o, y + 6 + o, C.black);
      ['save', 'print', '|', 'cut', 'copy', 'paste', '|', 'undo', '|', 'spell', 'open', '|', 'help'].forEach((n, i) => { if (n !== '|') TBI(ctx, n, cl.x + 72 + i * 23, y + 5); else vsep(ctx, cl.x + 76 + i * 23, y + 4, 18); });
    } else {
      ['print', 'save', '|', 'cut', 'copy', '|', 'undo', '|', 'help'].forEach((n, i) => { if (n !== '|') TBI(ctx, n, cl.x + 10 + i * 23, y + 5); else vsep(ctx, cl.x + 14 + i * 23, y + 4, 18); });
      ['Reply', 'Reply to All', 'Forward'].forEach((l, i) => { const bx = cl.x + 220 + i * 74; T(ctx, l, bx, y + 6); });
    }
    y += 26;
    const fields = st.fields || [];
    R(ctx, cl.x, y, cl.w, fields.length * 24 + 6, C.face);
    fields.forEach(([lab, val, btn], i) => {
      const fy = y + 4 + i * 24;
      if (btn) { raised(ctx, cl.x + 6, fy, 60, 21); T(ctx, lab, cl.x + 36 - Math.floor(TW(lab) / 2), fy + 4); }
      else T(ctx, lab, cl.x + 8, fy + 4);
      if (st.compose) { sunken(ctx, cl.x + 72, fy, cl.w - 80, 21, C.white); T(ctx, val, cl.x + 76, fy + 4, C.black); }
      else T(ctx, val, cl.x + 72, fy + 4, C.black, i === 0 ? 'uib' : 'ui');
    });
    y += fields.length * 24 + 6;
    const bodyTop = y, bodyH = cl.y + cl.h - y;
    sunken(ctx, cl.x, bodyTop, cl.w, bodyH, C.white);
    clipTo(ctx, cl.x + 2, bodyTop + 2, cl.w - 20, bodyH - 4);
    W.vscroll(ctx, cl.x + cl.w - 18, bodyTop + 2, bodyH - 4, 0, 0.9);
    const bf = st.bodyFont || 'sans13', blh = st.bodyLH || 16;
    const lay = layoutDoc(st.body || [], st.n, cl.w - 36, bf, blh);
    for (const ln of lay.lines) T(ctx, ln.s, cl.x + 8, bodyTop + 6 + ln.y, C.black, bf);
    const cxp = lay.caret.x, cyp = lay.caret.y;
    if (st.caret) R(ctx, cl.x + 8 + cxp, bodyTop + 6 + cyp, 1, blh - 1, C.black);
    ctx.restore();
    ctx.restore();
    st.sendRect = { x: cl.x + 10, y: cl.y + 21 + 2, w: 54, h: 22 };
    return cl;
  }
  function P_send(ctx, x, y) { PIX(ctx, x, y, ['kkkkkkkkkkkkk', 'kyyyyyyyyyyyk'.replace(/y/g, 'w'), 'kkwwwwwwwwwkk', 'kwkkwwwwwkkwk', 'kwwwkkwkkwwwk', 'kwwwwwkwwwwwk', 'kkkkkkkkkkkkk']); }

  // ================= WEB BROWSER =================
  function ieBtn(ctx, x, y, kind, label, disabled) {
    const c = disabled ? C.shadow : C.black;
    // 20x20 glyphs
    if (kind === 'back' || kind === 'fwd') { const d = kind === 'back' ? -1 : 1; const col = disabled ? C.shadow : '#008000'; for (let i = 0; i < 9; i++) V(ctx, x + 10 + d * (i - 4), y + 2 + Math.abs(i - 8) * 0 + (d < 0 ? i : 8 - i), 16 - 2 * (d < 0 ? i : 8 - i), col); R(ctx, x + (d < 0 ? 10 : 2), y + 7, 8, 6, col); }
    if (kind === 'stop') { K.pEllipse(ctx, x + 10, y + 10, 8, 8, '#c00000'); R(ctx, x + 5, y + 8, 10, 4, C.white); }
    if (kind === 'refresh') { R(ctx, x + 3, y + 3, 14, 15, C.white); frame(ctx, x + 3, y + 3, 14, 15, C.black); for (let i = 0; i < 8; i++) R(ctx, x + 6 + Math.round(4 * Math.cos(i * 0.8)), y + 10 + Math.round(4 * Math.sin(i * 0.8)), 2, 2, '#008000'); }
    if (kind === 'home') { for (let i = 0; i < 8; i++) H(ctx, x + 10 - i, y + 2 + i, 2 * i + 1, '#c00000'); R(ctx, x + 4, y + 10, 12, 8, '#ffff99'); frame(ctx, x + 4, y + 10, 12, 8, C.black); R(ctx, x + 8, y + 13, 4, 5, '#804000'); }
    if (kind === 'search') { K.pEllipse(ctx, x + 10, y + 10, 8, 8, '#0040c0'); K.pEllipse(ctx, x + 8, y + 8, 3, 3, '#80c0ff'); }
    if (kind === 'fav') { R(ctx, x + 2, y + 6, 16, 12, '#ffcc33'); frame(ctx, x + 2, y + 6, 16, 12, C.black); K.pEllipse(ctx, x + 10, y + 7, 3, 3, '#ffff00'); }
    if (kind === 'hist') { K.pEllipse(ctx, x + 10, y + 10, 8, 8, C.black); K.pEllipse(ctx, x + 10, y + 10, 7, 7, C.white); V(ctx, x + 10, y + 5, 6, C.black); H(ctx, x + 10, y + 10, 4, C.black); }
    if (kind === 'mail') { R(ctx, x + 2, y + 5, 16, 11, '#ffff99'); frame(ctx, x + 2, y + 5, 16, 11, C.black); for (let i = 0; i < 8; i++) { R(ctx, x + 3 + i, y + 6 + (i >> 1), 1, 1, C.black); R(ctx, x + 16 - i, y + 6 + (i >> 1), 1, 1, C.black); } }
    if (kind === 'print') TBI(ctx, 'print', x + 2, y + 2);
    T(ctx, label, x + 10 - Math.floor(TW(label) / 2), y + 22, c);
  }
  function throbber(ctx, x, y, t, busy) { // an original spinning-globe throbber
    R(ctx, x, y, 38, 38, C.black);
    K.pEllipse(ctx, x + 19, y + 19, 14, 14, '#1040c0');
    const a = busy ? t * 5 : 0;
    for (let i = 0; i < 4; i++) { const ph = a + i * 1.57; const xx = Math.sin(ph) * 12; if (Math.cos(ph) > 0) R(ctx, Math.round(x + 19 + xx - 1), y + 8, 3, 22, '#40c040'); }
    for (let i = 0; i < 5; i++) { const ox = Math.round(Math.sin(a * 0.5 + i) * 1); R(ctx, x + 6 + ox, y + 9 + i * 5, 26, 1, '#80a0ff'); }
  }
  function ie(ctx, win, st) {
    const cl = W.window(ctx, { x: win.x, y: win.y, w: win.w, h: win.h, title: (st.pageTitle || 'about:blank') + ' - Microsoft Internet Explorer', icon: 'ie16', active: win.active });
    clipTo(ctx, cl.x, cl.y, cl.w, cl.h);
    let y = cl.y;
    W.menuBar(ctx, cl.x, y, cl.w - 42, ['&File', '&Edit', '&View', '&Go', 'F&avorites', '&Help']);
    // coolbar
    thinRaised(ctx, cl.x, y + 19, cl.w - 42, 44, C.face);
    const btns = [['back', 'Back'], ['fwd', 'Forward'], ['stop', 'Stop'], ['refresh', 'Refresh'], ['home', 'Home'], ['search', 'Search'], ['fav', 'Favorites'], ['hist', 'History'], ['mail', 'Mail'], ['print', 'Print']];
    btns.forEach(([k, l], i) => { const bx = cl.x + 12 + i * 52; if (bx + 50 > cl.x + cl.w - 42) return; ieBtn(ctx, bx + 16, y + 21, k, l, k === 'fwd'); });
    throbber(ctx, cl.x + cl.w - 40, y + 1, st.t || 0, st.busy);
    y += 63;
    thinRaised(ctx, cl.x, y, cl.w, 24, C.face); T(ctx, 'Address', cl.x + 8, y + 5, C.black, 'ui');
    sunken(ctx, cl.x + 56, y + 2, cl.w - 60, 20, C.white); ICON(ctx, 'ie16', cl.x + 59, y + 4); T(ctx, st.url || 'about:blank', cl.x + 78, y + 5, C.black, 'ui');
    y += 24;
    const ph = cl.y + cl.h - 20 - y;
    R(ctx, cl.x, y, cl.w - 16, ph, st.bg || C.white);
    W.vscroll(ctx, cl.x + cl.w - 16, y, ph, 0, 0.5);
    clipTo(ctx, cl.x, y, cl.w - 16, ph);
    if (st.page) st.page(ctx, cl.x + 10, y + 8, cl.w - 36, ph - 16);
    ctx.restore();
    ctx.restore();
    const sb = cl.y + cl.h - 20;
    W.statusBar(ctx, cl.x, sb, cl.w, [{ text: st.status || 'Done', w: cl.w - 190 }, { text: '', w: 100 }, { text: 'Internet zone', w: 80 }]);
    if (st.load != null && st.load < 1) W.progress(ctx, cl.x + cl.w - 186, sb + 4, 98, 13, st.load);
    return cl;
  }

  // ================= PAINT =================
  const PAINT_COLS = ['#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040'];
  function paint(ctx, win, st) {
    const cl = W.window(ctx, { x: win.x, y: win.y, w: win.w, h: win.h, title: (st.name || 'untitled') + ' - Paint', icon: 'paint16', active: win.active });
    clipTo(ctx, cl.x, cl.y, cl.w, cl.h);
    W.menuBar(ctx, cl.x, cl.y, cl.w, ['&File', '&Edit', '&View', '&Image', '&Options', '&Help']);
    const y = cl.y + 19, bottom = cl.y + cl.h - 20 - 48;
    // tool box
    R(ctx, cl.x, y, 56, bottom - y + 48, C.face);
    for (let i = 0; i < 16; i++) {
      const tx = cl.x + 3 + (i % 2) * 25, ty = y + 4 + Math.floor(i / 2) * 25;
      (st.tool === i ? pressed : raised)(ctx, tx, ty, 25, 25);
      const gx = tx + 5, gy = ty + 5;
      // tiny tool glyphs
      if (i === 0) { for (let k = 0; k < 13; k += 2) { R(ctx, gx + k, gy, 1, 1, C.black); R(ctx, gx + k, gy + 12, 1, 1, C.black); R(ctx, gx, gy + k, 1, 1, C.black); R(ctx, gx + 12, gy + k, 1, 1, C.black); } }
      if (i === 1) { R(ctx, gx + 1, gy + 3, 11, 8, C.black); R(ctx, gx + 3, gy + 5, 7, 4, C.white); }
      if (i === 2) { R(ctx, gx + 2, gy + 2, 6, 9, C.white); frame(ctx, gx + 2, gy + 2, 6, 9, C.black); R(ctx, gx + 3, gy + 8, 4, 2, '#ff8080'); }
      if (i === 3) { R(ctx, gx + 2, gy + 2, 8, 8, C.black); R(ctx, gx + 3, gy + 3, 6, 6, '#ffff00'); R(ctx, gx + 9, gy + 9, 3, 3, C.black); }
      if (i === 4) { R(ctx, gx + 4, gy, 3, 8, '#808080'); R(ctx, gx + 3, gy + 8, 5, 4, C.black); }
      if (i === 5) { K.pEllipse(ctx, gx + 5, gy + 6, 4, 4, C.black); K.pEllipse(ctx, gx + 5, gy + 6, 3, 3, '#80ffff'); R(ctx, gx + 8, gy + 9, 3, 3, C.black); }
      if (i === 6) { for (let k = 0; k < 10; k++) R(ctx, gx + 1 + k, gy + 11 - k, 1, 1, C.black); R(ctx, gx + 9, gy, 3, 3, '#ffff00'); }
      if (i === 7) { R(ctx, gx + 5, gy, 2, 7, '#804000'); R(ctx, gx + 4, gy + 7, 4, 5, C.black); }
      if (i === 8) { R(ctx, gx + 2, gy + 6, 5, 6, '#808080'); R(ctx, gx + 3, gy + 3, 3, 3, C.black); for (let k = 0; k < 6; k++) R(ctx, gx + 7 + (k * 3) % 5, gy + (k * 5) % 6, 1, 1, C.black); }
      if (i === 9) T(ctx, 'A', gx + 2, gy - 2, C.black, 'uib');
      if (i === 10) for (let k = 0; k < 12; k++) R(ctx, gx + k, gy + 11 - k, 1, 1, C.black);
      if (i === 11) { for (let k = 0; k < 12; k++) R(ctx, gx + k, gy + 6 + Math.round(Math.sin(k / 2) * 4), 1, 1, C.black); }
      if (i === 12) frame(ctx, gx, gy + 2, 13, 9, C.black);
      if (i === 13) { for (let k = 0; k < 6; k++) R(ctx, gx + k * 2, gy + 10 - (k % 2) * 8, 2, 1, C.black); frame(ctx, gx, gy + 2, 13, 9, C.black); }
      if (i === 14) K.pEllipse(ctx, gx + 6, gy + 6, 6, 4, C.black), K.pEllipse(ctx, gx + 6, gy + 6, 5, 3, C.face);
      if (i === 15) { R(ctx, gx, gy + 2, 13, 9, C.black); R(ctx, gx + 1, gy + 3, 11, 7, C.face); }
    }
    sunken(ctx, cl.x + 6, y + 210, 44, 64, C.face);
    // workspace + canvas
    const wx = cl.x + 56, ww = cl.w - 56;
    R(ctx, wx, y, ww, bottom - y, C.shadow);
    const cx = wx + 4, cy = y + 4, cw = Math.min(ww - 24, st.cw || 420), chh = Math.min(bottom - y - 8, st.ch || 300);
    R(ctx, cx, cy, cw, chh, C.white); R(ctx, cx + cw, cy + chh, 3, 3, C.navy);
    clipTo(ctx, cx, cy, cw, chh);
    if (st.draw) st.draw(ctx, cx, cy, cw, chh);
    ctx.restore();
    // colour box
    const py = bottom;
    R(ctx, cl.x, py, cl.w, 48, C.face);
    sunken(ctx, cl.x + 4, py + 6, 30, 32, C.face); R(ctx, cl.x + 10, py + 11, 13, 13, C.black); frame(ctx, cl.x + 9, py + 10, 15, 15, C.white); R(ctx, cl.x + 17, py + 18, 12, 12, C.white);
    PAINT_COLS.forEach((c, i) => { const px = cl.x + 36 + (i % 14) * 16, pyy = py + 6 + Math.floor(i / 14) * 16; sunken(ctx, px, pyy, 16, 16, c); });
    ctx.restore();
    W.statusBar(ctx, cl.x, cl.y + cl.h - 20, cl.w, [{ text: 'For Help, click Help Topics on the Help Menu.', w: cl.w - 130 }, { text: st.coords || '', w: 60 }, { text: '', w: 60 }]);
    return cl;
  }

  // ================= FILE COPY =================
  function copyDlg(ctx, win, st) {
    const cl = W.window(ctx, { x: win.x, y: win.y, w: win.w, h: win.h, title: st.title || 'Copying...', active: win.active, dialog: true });
    // two folders with a page flying between them
    const fx = cl.x + 18, fy = cl.y + 10;
    ICONS.docs32 ? null : null;
    folderBig(ctx, fx, fy + 8); folderBig(ctx, fx + 200, fy + 8);
    const k = ((st.t || 0) * 1.6) % 1;
    const px = fx + 30 + k * 170, py = fy + 18 - Math.sin(k * Math.PI) * 16;
    R(ctx, px, py, 10, 13, C.white); frame(ctx, px, py, 10, 13, C.black); H(ctx, px + 2, py + 4, 6, C.shadow); H(ctx, px + 2, py + 7, 6, C.shadow);
    T(ctx, st.file || 'inefficiency_00001.doc', cl.x + 16, cl.y + 50);
    T(ctx, st.from || "From 'COMPANY' to 'FIXED'", cl.x + 16, cl.y + 64);
    W.progress(ctx, cl.x + 16, cl.y + 82, cl.w - 32, 16, st.p || 0);
    T(ctx, st.left || '', cl.x + 16, cl.y + 102);
    W.button(ctx, cl.x + cl.w - 91, cl.y + cl.h - 32, 75, 23, 'Cancel');
    return cl;
  }
  function folderBig(ctx, x, y) {
    R(ctx, x + 2, y, 12, 4, '#ffff99'); frame(ctx, x + 2, y, 12, 4, C.black);
    R(ctx, x, y + 3, 30, 20, '#ffcc33'); frame(ctx, x, y + 3, 30, 20, C.black); H(ctx, x + 1, y + 4, 28, '#ffff99');
  }
  // generic small dialog with progress (e.g. "Sending")
  function progDlg(ctx, win, st) {
    const cl = W.window(ctx, { x: win.x, y: win.y, w: win.w, h: win.h, title: st.title, active: win.active, dialog: true });
    T(ctx, st.text || '', cl.x + 14, cl.y + 12);
    W.progress(ctx, cl.x + 14, cl.y + 32, cl.w - 28, 16, st.p || 0);
    if (st.button) W.button(ctx, cl.x + cl.w / 2 - 37, cl.y + cl.h - 32, 75, 23, st.button);
    return cl;
  }

  G.APPS = { word, excel, chart, chartWizard, outlook, mail, ie, paint, copyDlg, progDlg, layoutDoc, colX, PAINT_COLS };
})(window);
