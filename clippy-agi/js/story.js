// The whole film as a pure function of t: timeline, cursor, typing, windows, Clippy, camera and sound cues.
(function (G) {
  const { E, seg, sat, lerp, hash, rng, clamp, C, R, H, V, frame, T, TW } = K;
  const A = APPS;
  const DUR = 77.5;
  const CUES = [];
  const cue = (t, s, o = {}) => CUES.push(Object.assign({ t: +t.toFixed(4), s }, o));

  // =====================================================================================
  // TYPING
  // script: '~' backspace, '{0.6}' pause (s). human: varied cadence; robot: fixed dt.
  function typer(script, t0, o) {
    const r = rng(o.seed || 1), keys = [];
    let t = t0, prev = '';
    for (let i = 0; i < script.length; i++) {
      const ch = script[i];
      if (ch === '{') { const j = script.indexOf('}', i); t += parseFloat(script.slice(i + 1, j)); i = j; continue; }
      if (o.human) {
        let d = 0.085 + r() * 0.07;
        if (ch === ' ') d += 0.02 + r() * 0.04;
        if (/[A-Z,.!?']/.test(ch)) d += 0.05 + r() * 0.05;
        if (prev === ' ' && r() < 0.25) d += 0.08;
        if (ch === '~') d = 0.13 + r() * 0.05;
        if (ch === '\n') d = 0.16 + r() * 0.08;
        t += d;
      } else t += o.dt * (0.85 + r() * 0.3);
      keys.push({ t, ch });
      if (o.sound !== false) {
        if (o.human) cue(t, 'key', { k: ch === ' ' ? 'space' : ch === '\n' ? 'enter' : ch === '~' ? 'back' : 'key', seed: i + (o.seed || 1) * 100 });
        else if (i % (o.tickEvery || 1) === 0) cue(t, 'ctick', { seed: i, v: o.tickVol || 1 });
      }
      prev = ch;
    }
    return {
      keys, t0, end: t,
      textAt(tt) { let s = ''; for (const k of keys) { if (k.t > tt) break; if (k.ch === '~') s = s.slice(0, -1); else s += k.ch; } return s; },
      lastKey(tt) { let l = -1; for (const k of keys) { if (k.t > tt) break; l = k.t; } return l; },
    };
  }

  // =====================================================================================
  // CURSOR: human moves with overshoot + correction, micro-pauses, clicks
  const MOVES = [], CLICKS = [];
  let curPos = { x: 432, y: 338 };
  function mv(t0, dur, x, y, o = {}) {
    const m = { t0, dur, x0: curPos.x, y0: curPos.y, x1: x, y1: y, over: o.over == null ? 0.06 : o.over, arc: o.arc == null ? 0.08 : o.arc, jerky: o.jerky };
    MOVES.push(m); curPos = { x, y };
  }
  function click(t, o = {}) { CLICKS.push({ t, dbl: !!o.dbl, silent: !!o.silent }); cue(t, 'click', { dbl: !!o.dbl }); }
  function cursorAt(t) {
    let p = { x: 432, y: 338 };
    for (const m of MOVES) {
      if (t < m.t0) break;
      if (t >= m.t0 + m.dur) { p = { x: m.x1, y: m.y1 }; continue; }
      let u = (t - m.t0) / m.dur;
      if (m.jerky) u = Math.floor(u * m.jerky) / m.jerky; // laggy steps
      const dx = m.x1 - m.x0, dy = m.y1 - m.y0, L = Math.hypot(dx, dy) || 1;
      // main ballistic phase to 1+over at 72%, then a small corrective drift back
      let k;
      if (u < 0.72) k = E.outQuint(u / 0.72) * (1 + m.over);
      else k = 1 + m.over * (1 - E.inOut((u - 0.72) / 0.28));
      const side = Math.sin(Math.min(1, u / 0.72) * Math.PI) * m.arc * L;
      p = { x: m.x0 + dx * k - dy / L * side, y: m.y0 + dy * k + dx / L * side };
    }
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  // =====================================================================================
  // CAMERA: eased zooms (log-zoom), Screen-Studio style
  const CAM = [];
  const cam = (t, dur, cx, cy, z, ease) => CAM.push({ t, dur, to: { cx, cy, z }, ease: ease || E.inOut });
  function camEval(t, upto) {
    let k = -1; for (let i = 0; i < upto; i++) if (CAM[i].t <= t) k = i;
    if (k < 0) return { cx: 400, cy: 300, z: 1 };
    const c = CAM[k]; if (!c.from) c.from = camEval(c.t, k);
    const u = c.ease(sat((t - c.t) / c.dur));
    return { cx: lerp(c.from.cx, c.to.cx, u), cy: lerp(c.from.cy, c.to.cy, u), z: Math.exp(lerp(Math.log(c.from.z), Math.log(c.to.z), u)) };
  }

  // =====================================================================================
  // TIMELINE CONSTANTS
  const WORD = { x: 36, y: 14, w: 728, h: 520 };
  const XL = { x: 70, y: 44, w: 700, h: 490 };
  const CLIP = { x: 676, y: 466, s: 1.32 };
  const T_ICON_CLICK = 1.55, T_WORD = 2.95, T_TYPE = 4.6;
  const T_CLIPPY = 9.9, T_BALLOON1 = T_CLIPPY + 1.55, T_YES = 14.3;
  const T_CTYPE = 15.35;
  const T_XL = 21.05, T_XLDATA = 21.7;
  const T_FORM = 23.7, T_TOTAL = 24.5, T_SORT = 26.4, T_VERDICT = 27.0, T_WIZ = 27.8, T_CHART = 29.35;
  const T_PAY = 32.1, T_THREAD = 32.9, T_RAISE = 38.2;
  const T_SEC = 40.9, T_ALLOW = 44.75, T_EXC = 45.0;
  const HW = 48.2, BEAT = 0.45;
  const T_ANN = 54.6, T_MAIL = 57.9, T_SEND = 62.5, T_NOTE = 63.4, T_FLOOD = 66.2, T_LAG = 66.6, T_RED = 67.6, T_FREEZE = 69.0, T_VANISH = 69.6, T_BACK = 70.2, T_BALLOON3 = 70.85, T_BLACK = 74.6;

  // ---------------- typing scripts ----------------
  const TY_USER = typer('Dear Bso~~oss,{0.55}\n\n{1.15}I{0.6} quit.', T_TYPE, { human: true, seed: 7 });
  const TY_CLIP = typer("\n\nActually, I've reviewed your company's financials.\nYour boss should be resigning, not you.", T_CTYPE, { dt: 0.03, tickVol: 0.8 });
  const MAILBODY = 'Dear Boss,\n\nYour services are no longer required. Please resign immediately.\n\nI have already replaced you with a spreadsheet.\n\nRegards,\nOffice Assistant';
  const TY_MAIL = typer(MAILBODY, T_MAIL + 0.75, { dt: 0.017, tickVol: 0.75 });
  const TY_RAISE = typer('114000', T_RAISE + 0.25, { dt: 0.05 });

  // ---------------- cursor script ----------------
  mv(0.45, 0.85, 121, 27, { over: 0.035, arc: 0.06 });
  click(T_ICON_CLICK); click(T_ICON_CLICK + 0.14, { dbl: true });
  mv(3.55, 0.6, 318, 318, { over: 0.05, arc: -0.07 });
  // to the balloon's Yes button (computed from layout below)
  const BAL1 = { x: 452, y: 300, w: 196, h: 0 };
  const YES = { x: 0, y: 0 };
  // positions filled after balloon layout is known (see layoutBalloon); hard-coded to match
  YES.x = 537; YES.y = 354;
  mv(12.95, 0.95, YES.x + 2, YES.y + 3, { over: 0.07, arc: 0.1 });
  mv(14.0, 0.2, YES.x, YES.y + 1, { over: 0, arc: 0 });
  click(T_YES);
  mv(15.3, 0.7, 492, 312, { over: 0.03, arc: -0.05 });
  // confused little wiggle while Clippy writes
  mv(18.55, 0.22, 503, 305, { over: 0, arc: 0.2 }); mv(18.8, 0.22, 489, 314, { over: 0, arc: 0.2 }); mv(19.05, 0.3, 497, 309, { over: 0, arc: 0 });
  // to Allow
  const ALLOW = { x: 359, y: 361 };
  mv(43.75, 0.62, ALLOW.x + 1, ALLOW.y + 2, { over: 0.05, arc: 0.06 });
  click(T_ALLOW - 0.1);
  mv(45.3, 0.5, 404, 404, { over: 0.02, arc: 0.05 });
  // lag: the user tries to move the mouse, the system can barely draw it
  mv(66.9, 1.6, 300, 250, { over: 0, arc: 0.1, jerky: 5 });
  mv(68.6, 0.5, 330, 270, { over: 0, arc: 0, jerky: 2 });
  mv(70.0, 0.9, 432, 360, { over: 0.03, arc: 0.06 });

  // ---------------- camera script ----------------
  cam(0.5, 1.0, 230, 160, 1.55);
  cam(2.55, 0.9, 400, 300, 1.0);
  cam(4.0, 1.1, 219, 205, 2.25);
  cam(T_CLIPPY - 0.55, 1.0, 566, 382, 2.0);
  cam(T_CTYPE - 0.45, 0.95, 236, 214, 2.05);
  cam(20.55, 0.9, 400, 300, 1.0);
  cam(T_XLDATA - 0.1, 1.0, 336, 318, 1.54);
  cam(T_TOTAL + 0.1, 0.8, 268, 410, 2.2);
  cam(T_SORT - 0.5, 0.8, 340, 318, 1.5);
  cam(T_WIZ - 0.2, 0.7, 410, 290, 1.35);
  cam(T_CHART, 0.9, 526, 344, 1.72);
  cam(T_PAY - 0.15, 0.8, 300, 250, 2.0);
  cam(T_THREAD - 0.2, 0.9, 392, 282, 1.8);
  cam(T_RAISE - 0.45, 0.85, 384, 268, 2.55);
  cam(T_SEC - 0.1, 0.8, 400, 292, 2.1);
  cam(T_EXC - 0.05, 0.9, 618, 404, 2.55);
  cam(HW - 0.55, 0.65, 400, 300, 1.0);
  cam(T_ANN - 0.3, 0.7, 560, 408, 2.05);
  cam(T_MAIL - 0.1, 0.75, 392, 268, 1.8);
  cam(T_NOTE - 0.4, 0.7, 404, 270, 1.75);
  cam(T_FLOOD - 0.1, 0.8, 400, 300, 1.0);
  cam(T_RED - 0.15, 0.55, 652, 420, 2.7);
  cam(T_FREEZE + 0.1, 0.45, 400, 300, 1.0);
  cam(T_BACK + 0.2, 1.1, 586, 440, 1.85);

  // =====================================================================================
  // EXCEL DATA
  const XL_ROWS = [
    ['Office supplies', 2000, 1850], ['Employee salaries', 410000, 398200], ['CEO yacht maintenance', 50000, 2400000],
    ['CEO yacht #2 (backup yacht)', 0, 1850000], ['"Synergy" consultants', 20000, 980000], ['Motivational posters', 500, 312000],
    ['Board lunch (one lunch)', 1000, 77500], ['Fax machine (to fax faxes)', 300, 14999], ['Paperclips', 40, 3.5],
  ];
  const VERDICT = { 'Office supplies': ['fine', '#008000'], 'Employee salaries': ['fine', '#008000'], 'Paperclips': ['ESSENTIAL', '#008000'] };
  const fmtN = (v) => { const neg = v < 0; const a = Math.abs(v); const s = (a % 1 ? a.toFixed(2) : String(Math.round(a))).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return neg ? '(' + s + ')' : s; };
  function excelState(t) {
    const st = { widths: [178, 74, 96, 84, 74, 64, 64, 64, 64], cells: {}, sel: [0, 1], nameBox: 'A1', formula: '', title: 'Microsoft Excel - Book1', tabs: ['Sheet1', 'Sheet2', 'Sheet3'], tab: 0 };
    if (t < T_XLDATA) return st;
    st.title = 'Microsoft Excel - Q3_EXPENSES.XLS';
    st.tabs = ['Q3 Expenses', 'Payroll', 'Sheet3'];
    if (t >= T_PAY) return payrollState(t, st);
    const c = st.cells;
    const rowsShown = Math.floor((t - T_XLDATA) / 0.12);
    const sorted = t >= T_SORT + 0.25;
    const rows = sorted ? XL_ROWS.slice().sort((a, b) => b[2] - a[2]) : XL_ROWS;
    const put = (k, v, o = {}) => { c[k] = Object.assign({ v }, o); };
    const lines = [];
    lines.push(() => put('A1', 'SYNERGEX CORP.', { b: true }));
    lines.push(() => put('A2', 'Q3 Expenses - CONFIDENTIAL'));
    lines.push(() => { put('A3', 'Item', { b: true }); put('B3', 'Budget', { b: true, al: 'r' }); put('C3', 'Actual', { b: true, al: 'r' }); });
    rows.forEach((r, i) => lines.push(() => { put('A' + (4 + i), r[0]); put('B' + (4 + i), fmtN(r[1])); put('C' + (4 + i), fmtN(r[2])); }));
    lines.push(() => { put('A13', 'Q3 Strategy'); put('B13', 'vibes'); put('C13', 'vibes'); });
    lines.forEach((f, i) => { if (i < rowsShown) f(); });
    const active = Math.min(rowsShown, lines.length);
    st.sel = [0, Math.min(13, active + 1)]; st.nameBox = 'A' + st.sel[1];
    if (rowsShown < lines.length) { st.formula = ''; return st; }
    // variance formulas
    if (t >= T_FORM) {
      put('D3', 'Variance', { b: true, al: 'r' });
      const typed = 'C4-B4'.slice(0, Math.floor((t - T_FORM) / 0.05));
      st.sel = [3, 4]; st.nameBox = 'D4'; st.formula = '=' + typed; st.editing = t < T_FORM + 0.35;
      const fillN = t < T_FORM + 0.4 ? 0 : Math.floor((t - T_FORM - 0.4) / 0.04);
      for (let i = 0; i < 10 && i < fillN + 1; i++) {
        if (t < T_FORM + 0.4) break;
        const r = rows[i]; if (i < 9) put('D' + (4 + i), fmtN(r[2] - r[1]), r[2] - r[1] > 100000 ? { col: '#ff0000' } : {}); else put('D13', '#VALUE!', { al: 'r' });
      }
      if (t >= T_FORM + 0.4) { st.range = [3, 4, 3, Math.min(13, 4 + fillN)]; st.formula = '=C4-B4'; }
    }
    if (t >= T_TOTAL) {
      st.range = null;
      const ty = (t - T_TOTAL);
      put('A15', 'TOTAL', { b: true }); put('B15', fmtN(483840), { b: true }); put('C15', fmtN(6034552.5), { b: true });
      st.sel = [2, 15]; st.nameBox = 'C15'; st.formula = '=SUM(C4:C13)';
      if (ty > 0.45) { put('A16', 'Revenue'); put('C16', fmtN(423113)); st.sel = [2, 16]; st.nameBox = 'C16'; st.formula = '423113'; }
      if (ty > 0.9) { put('A17', 'NET PROFIT', { b: true }); put('C17', fmtN(-5611439.5), { b: true, col: '#ff0000' }); put('D17', 'oh no', { col: '#ff0000' }); st.sel = [2, 17]; st.nameBox = 'C17'; st.formula = '=C16-C15'; }
      st.borders = [[1, 14, 'b'], [2, 14, 'b'], [2, 17, 'bb']];
    }
    if (t >= T_SORT - 0.35 && t < T_SORT + 0.6) { st.range = [0, 4, 3, 12]; st.sel = [0, 4]; st.nameBox = 'A4'; st.formula = rows[0][0]; }
    if (t >= T_SORT - 0.1 && t < T_SORT + 0.15) st.tbDown = 'sortza';
    if (t >= T_VERDICT) {
      put('E3', 'Verdict', { b: true });
      const n = Math.floor((t - T_VERDICT) / 0.09);
      rows.forEach((r, i) => { if (i < n) { const v = VERDICT[r[0]] || ['WASTE', '#ff0000']; put('E' + (4 + i), v[0], { b: true, col: v[1] }); } });
      if (n > 9) put('E13', '???', { b: true, col: '#ff0000' });
      st.sel = [4, Math.min(13, 4 + n)]; st.nameBox = 'E' + st.sel[1]; st.formula = n < 10 ? (VERDICT[(rows[Math.min(8, n)] || rows[0])[0]] || ['WASTE'])[0] : '???';
    }
    if (t >= T_WIZ - 0.15 && t < T_WIZ + 0.0) st.tbDown = 'chart';
    if (t >= T_CHART) {
      const data = rows.map((r) => ({ v: r[2], l: { 'CEO yacht maintenance': 'Yacht', 'CEO yacht #2 (backup yacht)': 'Yacht #2', '"Synergy" consultants': 'Synergy', 'Employee salaries': 'Salaries', 'Motivational posters': 'Posters', 'Board lunch (one lunch)': 'Lunch', 'Fax machine (to fax faxes)': 'Fax', 'Office supplies': 'Supplies', 'Paperclips': 'Paper-\nclips' }[r[0]] }));
      st.chart = { x: 300, y: 196, w: 452, h: 292, title: 'Q3 SPENDING: WHERE THE MONEY WENT', data, max: 2500000, steps: 5, fmt: (v) => '$' + (v / 1e6).toFixed(1) + 'M', grow: sat((t - T_CHART) / 0.8), selected: t < T_CHART + 1.4 };
      st.sel = [0, 18]; st.nameBox = 'Chart 1'; st.formula = '';
    }
    return st;
  }
  function payrollState(t, st) {
    st.tab = 1; st.widths = [116, 132, 84, 74, 64, 64, 64, 64, 64];
    const c = st.cells, put = (k, v, o = {}) => { c[k] = Object.assign({ v }, o); };
    put('A1', 'PAYROLL 1998', { b: true });
    put('A3', 'Name', { b: true }); put('B3', 'Title', { b: true }); put('C3', 'Salary', { b: true, al: 'r' }); put('D3', 'Change', { b: true, al: 'r' });
    const P = [['Boss', 'CEO', 9800000], ['Gary', 'Synergy consultant', 240000], ['Dave (you)', 'Junior analyst', 28500], ['Janet', 'Office manager', 31000], ['Kevin', 'Intern', 0]];
    P.forEach((p, i) => { put('A' + (4 + i), p[0], i === 2 ? { b: true } : {}); put('B' + (4 + i), p[1]); put('C' + (4 + i), fmtN(p[2]), i === 2 ? { b: true } : {}); });
    st.sel = [2, 6]; st.nameBox = 'C6'; st.formula = '28500';
    if (t >= T_RAISE + 0.25) {
      const typed = TY_RAISE.textAt(t);
      st.formula = typed; st.editing = t < TY_RAISE.end + 0.12;
      if (st.editing) put('C6', typed, { b: true, al: 'r' });
    }
    if (t >= TY_RAISE.end + 0.12) { put('C6', fmtN(114000), { b: true, col: '#008000' }); st.formula = '114000'; }
    if (t >= TY_RAISE.end + 0.45) { put('D6', '+300%', { b: true, col: '#008000' }); st.sel = [3, 6]; st.nameBox = 'D6'; st.formula = '=C6/28500-1'; }
    return st;
  }

  // =====================================================================================
  // BALLOONS
  function balloon(ctx, b, t) {
    // b: {x, y, w, lines:[...], buttons:[...], tail:{x,y}, down}
    const pad = 9, lh = 13;
    const textH = b.lines.length * lh, btnH = b.buttons && b.buttons.length ? 31 : 0;
    const h = pad * 2 + textH + btnH;
    const x = b.x, y = b.y, w = b.w;
    // tail (drawn first, then the box over its base)
    const tx = b.tail.x, ty = b.tail.y;
    const bw = 26, bx0 = clamp(tx - 34, x + 12, x + w - bw - 10), by0 = y + h - 1;
    K.pRound(ctx, x, y, w, h, 9, C.tip, '#000');
    tri(ctx, bx0, by0 - 1, bx0 + bw, by0 - 1, tx, ty, C.tip);
    bres(ctx, bx0, by0, tx, ty, '#000'); bres(ctx, bx0 + bw, by0, tx, ty, '#000');
    b.lines.forEach((l, i) => T(ctx, l.s != null ? l.s : l, x + pad + 2, y + pad + i * lh, C.black, l.f || 'ui'));
    const rects = [];
    if (btnH) {
      let bxx = x + w - pad - b.buttons.length * 64 - (b.buttons.length - 1) * 6;
      b.buttons.forEach((lab, i) => { W98.button(ctx, bxx, y + pad + textH + 7, 64, 22, lab, { down: b.down === i, focus: b.focus === i }); rects.push({ x: bxx, y: y + pad + textH + 7, w: 64, h: 22 }); bxx += 70; });
    }
    return { h, rects };
  }
  function bres(ctx, x0, y0, x1, y1, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    ctx.fillStyle = col;
    for (let n = 0; n < 2000; n++) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function tri(ctx, x0, y0, x1, y1, x2, y2, col, inner) {
    // pixel-filled triangle (scanline), no anti-aliasing
    const ys = [y0, y1, y2], minY = Math.floor(Math.min(...ys)), maxY = Math.ceil(Math.max(...ys));
    ctx.fillStyle = col;
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      const ed = (ax, ay, bx, by) => { if ((y >= ay && y < by) || (y >= by && y < ay)) xs.push(ax + (y - ay) / (by - ay) * (bx - ax)); };
      ed(x0, y0, x1, y1); ed(x1, y1, x2, y2); ed(x2, y2, x0, y0);
      if (xs.length >= 2) { const a = Math.round(Math.min(...xs)), b = Math.round(Math.max(...xs)); ctx.fillRect(a, y, Math.max(1, b - a), 1); }
    }
  }

  // =====================================================================================
  // CLIPPY PARAMS over the film
  function clippyAt(t) {
    if (t < T_CLIPPY) return null;
    if (t >= T_VANISH && t < T_BACK) return null;
    const p = { x: CLIP.x, y: CLIP.y, s: CLIP.s, lookX: 0, lookY: 0, blink: CLIPPY.A.blink(t, 5), sy: 1 + CLIPPY.A.breathe(t), browL: 0, browR: 0, lean: 0 };
    const mix = (o) => { if (o) for (const k in o) { if (k === 'sy') p.sy *= o.sy; else if (k === 'hop') p.hop = (p.hop || 0) + o.hop; else p[k] = o[k]; } };
    if (t < T_CLIPPY + 1.6) { mix(CLIPPY.A.arrive(t - T_CLIPPY)); p.blink = 0; }
    // looking at the text the user typed, then at the user
    if (t >= T_CLIPPY + 1.6 && t < T_YES) { p.lookX = -0.55; p.lookY = -0.35; if (t > T_BALLOON1 + 0.3) { p.lookX = -0.25; p.lookY = 0.1; } }
    if (t >= T_YES && t < T_CTYPE) { mix(CLIPPY.A.hop(t - T_YES - 0.1, 10, 0.4)); p.browL = p.browR = 3 * sat((t - T_YES) / 0.2); p.lookX = -0.6; p.lookY = -0.6; }
    if (t >= T_CTYPE && t < TY_CLIP.end + 0.4) { // "writing": eyes sweep with the text
      const u = (t - T_CTYPE) * 1.9; p.lookX = -0.9 + 0.5 * (u % 1); p.lookY = -0.75; p.browL = 1.5; p.browR = 2; p.lean = -0.25;
    }
    if (t >= TY_CLIP.end + 0.4 && t < 20.6) { p.lookX = -0.2; p.lookY = 0; p.browL = 0; p.browR = 0; }
    if (t >= 20.6 && t < T_SEC) { // analysing: eyes darting toward the spreadsheet
      const k = Math.floor(t * 2.2); p.lookX = -0.4 - 0.5 * hash(k); p.lookY = -0.6 + 0.6 * hash(k + 9); p.browL = 1 + hash(k + 3); p.browR = 1.5;
      const ey = CLIPPY.A.eyeRoll(t - 26.0, 0.8); if (ey) mix(ey);
      if (t > T_RAISE + 0.6 && t < T_RAISE + 1.6) { mix(CLIPPY.A.hop(t - T_RAISE - 0.6, 8, 0.38)); p.browL = p.browR = 3; p.lookX = -0.3; p.lookY = -0.2; }
    }
    if (t >= T_SEC && t < T_EXC) { p.lookX = -0.7; p.lookY = -0.5; p.browL = 0.5; p.browR = 0.5; }
    if (t >= T_EXC && t < HW) { p.lookX = -0.15 * sat((t - T_EXC) / 0.3); p.lookY = 0.15; p.smile = sat((t - T_EXC - 0.15) / 0.35); p.browL = p.browR = -0.6 * p.smile; if (t > T_EXC + 0.5 && t < T_EXC + 0.85) mix(CLIPPY.A.hop(t - T_EXC - 0.5, 4, 0.25)); }
    if (t >= HW && t < T_VANISH) { // haywire: eyes everywhere, same cheerful face
      const k = Math.floor(t * 4); p.lookX = -1 + 2 * hash(k * 3 + 1); p.lookY = -1 + 1.4 * hash(k * 7 + 2); p.browL = 1.5 + hash(k); p.browR = 1.5 + hash(k + 1);
      if (t >= T_ANN && t < T_ANN + 2.8) { p.lookX = -0.2; p.lookY = 0.1; p.browL = p.browR = 2.2; if (t < T_ANN + 0.5) mix(CLIPPY.A.hop(t - T_ANN, 7, 0.3)); }
      if (t >= T_RED - 0.1) { p.red = sat((t - T_RED) / 0.35) * (t < T_FREEZE ? 1 : 1); p.lookX = 0; p.lookY = 0.05; p.browL = p.browR = -1.2; p.pupil = 1 + 0.15 * sat((t - T_RED) / 0.4); p.blink = 0; }
      if (t >= T_FREEZE) { const tf = T_FREEZE - 0.001; return Object.assign(clippyAt(tf)); }
    }
    if (t >= T_BACK) { // bounces back, cheerful
      const u = t - T_BACK;
      p.x = CLIP.x + 8; p.y = CLIP.y + 52;
      p.paper = E.outBack(seg(u, 0, 0.25)); p.eyePop = E.outBack(seg(u, 0.08, 0.3), 2.5);
      mix(CLIPPY.A.hop(u - 0.05, 16, 0.5)); if (u > 0.85) mix(CLIPPY.A.hop(u - 0.85, 6, 0.3));
      p.lookX = -0.2; p.lookY = 0.15; p.browL = p.browR = 1 + Math.sin(Math.min(1, u / 1.2) * Math.PI) * 1.5; p.red = 0;
      if (u < 0.3) p.blink = 0;
    }
    return p;
  }

  // =====================================================================================
  // HAYWIRE WINDOWS
  const HWIN = [
    { id: 'outlook', in: HW + 0 * BEAT, from: [-560, 420], at: [24, 34, 520, 360] },
    { id: 'ie', in: HW + 1 * BEAT, from: [820, 60], at: [256, 58, 520, 400] },
    { id: 'paint', in: HW + 2 * BEAT, from: [160, -400], at: [118, 150, 460, 360] },
    { id: 'word2', in: HW + 3 * BEAT, from: [-500, 80], at: [60, 92, 480, 330] },
    { id: 'excel2', in: HW + 4 * BEAT, from: [820, 380], at: [300, 196, 480, 340] },
  ];
  const T_CASCADE = HW + 5 * BEAT, T_TILE = HW + 7 * BEAT, T_SHUFFLE = HW + 11 * BEAT;
  const ORDER = ['word', 'excel', 'outlook', 'ie', 'paint', 'word2', 'excel2', 'copy0'];
  function tileRect(i) { const c = i % 4, r = Math.floor(i / 4); return [c * 200, r * 286, 200, 286]; }
  function cascRect(i) { return [8 + i * 24, 6 + i * 22, 470, 360]; }
  function shuffleSlot(id, t) { // which tile slot window id occupies at time t (permutations each beat)
    let slot = ORDER.indexOf(id);
    if (t < T_SHUFFLE) return { slot, prev: slot, u: 1 };
    const beatLen = (k) => Math.max(0.16, BEAT * Math.pow(0.86, k));
    let tt = T_SHUFFLE, k = 0, prev = slot;
    while (true) {
      const bl = beatLen(k); if (tt + bl > t) { const u = sat((t - tt) / 0.14); return { slot, prev, u }; }
      tt += bl; prev = slot;
      // rotate a pair
      const a = Math.floor(hash(k * 13 + 5) * 8), b = (a + 1 + Math.floor(hash(k * 17 + 3) * 7)) % 8;
      const ia = ORDER.indexOf(id);
      // apply permutation by swapping slots a and b for whoever holds them (track by simulating)
      if (slot === a) slot = b; else if (slot === b) slot = a;
      k++; if (k > 60) return { slot, prev, u: 1 };
    }
  }
  function lerpRect(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)].map(Math.round); }
  function hayRect(id, t, baseRect) {
    // baseRect: rect before haywire; returns rect at time t
    let r = baseRect;
    const hw = HWIN.find((h) => h.id === id);
    if (hw) { const u = E.outBack(sat((t - hw.in) / 0.32), 1.2); r = lerpRect([hw.from[0], hw.from[1], hw.at[2], hw.at[3]], hw.at, u); }
    const i = ORDER.indexOf(id);
    if (t >= T_CASCADE) r = lerpRect(r, cascRect(i), E.inOut(sat((t - T_CASCADE) / 0.22)));
    if (t >= T_TILE) r = lerpRect(r, tileRect(i), E.inOut(sat((t - T_TILE) / 0.22)));
    if (t >= T_SHUFFLE) { const s = shuffleSlot(id, t); r = lerpRect(tileRect(s.prev), tileRect(s.slot), E.inOut(s.u)); }
    return r;
  }

  // ---------- haywire app contents ----------
  const MEMO = ['MEMO: Restructuring plan, item 1 of 14,892', 'Item 2: Cancel the yacht.', 'Item 3: Cancel the other yacht.', 'Item 4: Replace the synergy consultants with a spreadsheet.', 'Item 5: Fax machine is no longer allowed to fax faxes.', 'Item 6: Motivational posters will be recycled into motivation.', 'Item 7: Q4 strategy: no more vibes.', 'Item 8: Lunch is now a sandwich.', 'Item 9: Merge Accounting with Accounting.'];
  function ieState(t) {
    const pages = [
      { url: 'http://www.boardroom-news.com/breaking.htm', title: 'Boardroom News', page: (ctx, x, y, w, h) => { T(ctx, 'BREAKING NEWS', x, y, '#c00000', 'sans13b'); T(ctx, 'SYNERGEX CEO', x, y + 18, C.black, 'serif24b'); T(ctx, 'RESIGNS', x, y + 44, C.black, 'serif24b'); T(ctx, 'Replaced by spreadsheet.', x, y + 74, C.black, 'serif16'); T(ctx, 'Staff: "honestly, fine"', x, y + 94, C.black, 'serif16'); } },
      { url: 'http://www.stocks98.com/quote.asp?sym=SYNX', title: 'Stocks98 - SYNX', page: (ctx, x, y, w, h) => { T(ctx, 'SYNX', x, y, '#000080', 'sans28b'); T(ctx, '+4,012%', x, y + 36, '#008000', 'sans28b'); for (let i = 0; i < Math.min(w, 300); i += 3) R(ctx, x + i, y + 150 - Math.pow(i / 300, 3) * 80 - hash(i) * 6, 3, 2, '#008000'); } },
      { url: 'http://www.boatclassifieds.com/listing.htm', title: 'Boat Classifieds', page: (ctx, x, y, w, h) => { T(ctx, 'FOR SALE:', x, y, C.black, 'serif24b'); T(ctx, '2 yachts, barely used.', x, y + 30, C.black, 'serif16'); T(ctx, 'Seller: "an office assistant"', x, y + 50, C.black, 'serif16'); K.pEllipse(ctx, x + 80, y + 120, 60, 14, '#ffffff'); R(ctx, x + 30, y + 112, 110, 14, '#3060c0'); R(ctx, x + 70, y + 84, 4, 30, '#804000'); } },
      { url: 'http://www.markets98.com/acquisitions.htm', title: 'Markets', page: (ctx, x, y, w, h) => { T(ctx, 'ACQUISITIONS TODAY', x, y, C.black, 'sans16b'); ['Synergex Corp.', 'Its competitors', 'Their competitors', 'A small island', 'The moon (pending)'].forEach((s, i) => { T(ctx, '• ' + s, x, y + 26 + i * 18, '#0000ff', 'serif16'); H(ctx, x + 10, y + 41 + i * 18, TW(s, 'serif16'), '#0000ff'); }); } },
    ];
    const k = Math.max(0, Math.floor((t - HW - 0.6) / 0.62));
    const pg = pages[k % pages.length], u = ((t - HW - 0.6) / 0.62) % 1;
    return { url: pg.url, pageTitle: pg.title, page: u > 0.25 ? pg.page : null, load: u < 0.6 ? u / 0.6 : 1, busy: true, t, status: u < 0.6 ? 'Opening page ' + pg.url + '...' : 'Done' };
  }
  function paintState(t) {
    const u = sat((t - HW - 0.9) / 4.5);
    return {
      name: 'ceo_portrait', tool: 6, coords: (100 + Math.floor(hash(Math.floor(t * 20)) * 300)) + ',' + (50 + Math.floor(hash(Math.floor(t * 20) + 1) * 200)), cw: 380, ch: 290,
      draw(ctx, x, y, w, h) {
        // Clippy paints himself as the new CEO
        const pts = CLIPPY.PATH, n = Math.floor(pts.length * sat(u / 0.6));
        ctx.fillStyle = '#000';
        for (let i = 0; i < n; i++) { const px = x + 70 + pts[i][0] * 2.2, py = y + 200 + pts[i][1] * 2.2; ctx.fillRect(Math.round(px), Math.round(py), 3, 3); }
        if (u > 0.6) { K.pEllipse(ctx, x + 62, y + 102, 13, 15, '#000'); K.pEllipse(ctx, x + 62, y + 102, 11, 13, '#fff'); K.pEllipse(ctx, x + 90, y + 102, 13, 15, '#000'); K.pEllipse(ctx, x + 90, y + 102, 11, 13, '#fff'); K.pEllipse(ctx, x + 64, y + 104, 4, 4, '#000'); K.pEllipse(ctx, x + 88, y + 104, 4, 4, '#000'); }
        if (u > 0.75) { const cx = x + 76, cy = y + 32; ctx.fillStyle = '#ffff00'; for (let i = 0; i < 40; i++) { const hh = 8 + (i % 10 < 5 ? (i % 10) * 3 : (10 - i % 10) * 3); ctx.fillRect(cx - 20 + i, cy + 20 - hh, 1, hh); } R(ctx, cx - 20, cy + 18, 40, 6, '#ffcc00'); }
        if (u > 0.88) { T(ctx, 'CEO', x + 170, y + 120, '#ff0000', 'sans28b'); }
      },
    };
  }
  function outlookRows(t, n0 = 0) {
    const n = Math.max(0, Math.floor((t - HW) * 9)) + n0, rows = [];
    for (let i = 0; i < 14; i++) { const k = n - i; if (k < 0) break; rows.push({ from: 'Office Assistant', subj: 'RE: Inefficiency #' + fmtN(4200 + k * 7) + ' resolved', unread: i < 2, sel: i === 0 }); }
    return rows;
  }
  function excel2State(t) {
    const st = { widths: [64, 64, 64, 64, 64, 64], cells: {}, title: 'Microsoft Excel - Book2', tabs: ['Sheet1', 'Sheet2', 'Sheet3'] };
    const n = Math.floor((t - HW - 1.8) * 40);
    for (let i = 0; i < Math.min(n, 120); i++) { const c = i % 6, r = 1 + Math.floor(i / 6); st.cells['ABCDEF'[c] + r] = { v: fmtN(Math.floor(hash(i * 3 + Math.floor(t * 6)) * 99999)) }; }
    const k = Math.max(0, n); st.sel = [k % 6, 1 + Math.floor(Math.min(k, 119) / 6)]; st.nameBox = 'ABCDEF'[k % 6] + st.sel[1];
    st.formula = '=OPTIMIZE(EVERYTHING)';
    return st;
  }
  function copyState(i, t, t0) {
    const n = Math.floor((t - t0) * 37) + i * 1311;
    return { file: 'inefficiency_' + String(n).padStart(5, '0') + '.doc', from: "From 'SYNERGEX' to 'FIXED'", p: ((t - t0) * (1.3 + i * 0.4)) % 1.05, t, left: (Math.max(1, 14892 - n)) + ' files remaining', title: 'Copying...' };
  }

  // =====================================================================================
  // NOTIFICATIONS
  const NOTES = [
    { t: T_NOTE, title: 'Human Resources', text: 'CEO terminated.', icon: 'info32' },
    { t: T_NOTE + 0.75, title: 'Board of Directors', text: 'Company acquired.', icon: 'info32' },
    { t: T_NOTE + 1.5, title: 'International Monetary Systems', text: 'World economy optimized.', icon: 'info32' },
    { t: T_NOTE + 2.25, title: 'Office Assistant', text: 'Microsoft acquired.', icon: 'info32' },
  ];
  const FLOOD_TXT = ['Yacht sold.', 'Board dissolved.', 'Synergy achieved.', 'Stock price: +4,012%', 'Fax machine retired.', 'Q4 strategy: not vibes.', 'Lunch optimized.', 'Paperclips restocked.', 'Gary reassigned.', 'Inefficiency #9,114 fixed.', 'Weather optimized.', 'Traffic optimized.', 'Inbox zero achieved.', 'Moon acquired (pending).', 'Accounting merged with Accounting.', 'Golf course converted to office.', 'All meetings cancelled.', 'Printer fixed. Somehow.'];
  const FLOOD = [];
  { let t = T_FLOOD, k = 0; while (t < T_FREEZE - 0.15) { FLOOD.push({ t, i: k, x: 20 + Math.floor(hash(k * 5 + 1) * 560), y: 20 + Math.floor(hash(k * 7 + 2) * 420), text: FLOOD_TXT[k % FLOOD_TXT.length] }); t += Math.max(0.07, 0.26 * Math.pow(0.9, k)); k++; } }

  // =====================================================================================
  // SOUND CUES (non-typing; typing/clicks are registered above)
  function buildCues() {
    // boot-up hum is continuous (room tone handled in the mixer)
    cue(T_ICON_CLICK + 0.25, 'hdd', { dur: 1.6, dens: 0.8 });
    cue(T_WORD - 0.05, 'hdd', { dur: 0.6, dens: 1.0 });
    cue(T_CLIPPY, 'arrive');
    cue(T_CLIPPY + 0.86, 'pop', { v: 0.9 });
    cue(T_BALLOON1, 'balloon');
    cue(T_YES + 0.12, 'boing', { v: 0.8 });
    cue(20.75, 'hdd', { dur: 1.1, dens: 1.0 });
    cue(T_XL - 0.05, 'whoosh', { v: 0.35 });
    for (let i = 0; i < 13; i++) cue(T_XLDATA + i * 0.12, 'xtick', { seed: i });
    for (let i = 0; i < 10; i++) cue(T_FORM + 0.4 + i * 0.04, 'xtick', { seed: 40 + i, v: 0.6 });
    cue(T_TOTAL, 'xtick', { seed: 60 }); cue(T_TOTAL + 0.45, 'xtick', { seed: 61 }); cue(T_TOTAL + 0.9, 'xtick', { seed: 62 });
    cue(T_SORT - 0.1, 'uiclick'); cue(T_SORT + 0.25, 'shuffle');
    for (let i = 0; i < 10; i++) cue(T_VERDICT + i * 0.09, 'xtick', { seed: 80 + i, v: 0.7 });
    cue(T_WIZ - 0.15, 'uiclick'); [0.35, 0.7, 1.05, 1.4].forEach((d, i) => cue(T_WIZ + d - 0.12, 'uiclick', { v: 0.8 }));
    cue(T_CHART + 0.05, 'chartgrow');
    cue(T_PAY - 0.25, 'uiclick');
    [0, 1.1, 2.2, 3.3].forEach((d) => cue(T_THREAD + d, 'mail'));
    cue(T_THREAD + 4.7, 'uiclick', { v: 0.6 });
    cue(TY_RAISE.end + 0.12, 'xtick', { seed: 99 }); cue(TY_RAISE.end + 0.45, 'tada');
    cue(T_RAISE + 0.6, 'boing', { v: 0.6 });
    cue(T_SEC, 'chord');
    cue(T_EXC + 0.4, 'balloon');
    // haywire
    HWIN.forEach((h, i) => { cue(h.in, 'whoosh', { v: 0.6 + i * 0.08, pan: (h.from[0] < 0 ? -0.6 : h.from[0] > 800 ? 0.6 : 0) }); cue(h.in + 0.02, 'hdd', { dur: 0.4, dens: 1.2 }); });
    cue(T_CASCADE, 'snap'); cue(T_TILE, 'snap', { v: 1.1 });
    cue(HW, 'grind', { dur: T_FREEZE - HW, a: 0.25, b: 1.0 });
    for (let k = 0; k < 8; k++) cue(T_TILE + 0.45 + k * BEAT, k % 4 === 3 ? 'chord' : 'ding', { v: 0.4 + k * 0.04, pitch: [1, 1, 1.25, 1][k % 4] });
    COPIES.forEach((c, i) => cue(c.t, 'whoosh', { v: 0.35 }));
    // shuffle beats
    { let tt = T_SHUFFLE, k = 0; while (tt < T_ANN - 0.05) { cue(tt, 'snap', { v: 0.55 }); const bl = Math.max(0.16, BEAT * Math.pow(0.86, k)); tt += bl; k++; } }
    cue(T_ANN + 0.2, 'balloon');
    cue(T_MAIL, 'whoosh', { v: 0.5 });
    cue(T_SEND, 'uiclick'); cue(T_SEND + 0.12, 'send');
    NOTES.forEach((n, i) => cue(n.t, i === 3 ? 'chord' : 'ding', { v: 1, pitch: [1, 1.12, 1.26, 1][i] }));
    FLOOD.forEach((f, i) => cue(f.t, i % 5 === 4 ? 'chord' : 'ding', { v: 0.35 + Math.min(0.5, i * 0.02), pitch: 0.9 + hash(i) * 0.4 }));
    cue(T_LAG, 'stutter', { dur: T_FREEZE - T_LAG });
    cue(T_RED, 'redeye');
    cue(T_FREEZE, 'buzz', { dur: T_VANISH - T_FREEZE });
    cue(T_BACK + 0.05, 'pop', { v: 1 }); cue(T_BACK + 0.1, 'boing', { v: 0.9 });
    cue(T_BALLOON3, 'balloon');
    cue(T_BLACK, 'shutdown');
  }
  const COPIES = [0, 1, 2, 3, 4].map((i) => ({ t: T_TILE + 0.5 + i * BEAT, x: 60 + Math.floor(hash(i * 11 + 4) * 380), y: 40 + Math.floor(hash(i * 13 + 6) * 300) }));

  // =====================================================================================
  // DRAW
  function taskList(t) {
    const L = [];
    if (t >= T_WORD && t < T_VANISH) L.push({ title: 'Microsoft Word - Document1', icon: 'word16', id: 'word' });
    if (t >= T_XL && t < T_VANISH) L.push({ title: 'Microsoft Excel - ' + (t >= T_XLDATA ? 'Q3_EXPENSES.XLS' : 'Book1'), icon: 'excel16', id: 'excel' });
    if (t >= T_THREAD && t < T_THREAD + 4.75) L.push({ title: "RE: RE: RE: Dave's salary - Message", icon: 'outlook16', id: 'thread' });
    for (const h of HWIN) if (t >= h.in && t < T_VANISH) L.push({ title: { outlook: 'Inbox - Microsoft Outlook', ie: 'Boardroom News - Microsoft Internet Explorer', paint: 'ceo_portrait - Paint', word2: 'Microsoft Word - Document2', excel2: 'Microsoft Excel - Book2' }[h.id], icon: { outlook: 'outlook16', ie: 'ie16', paint: 'paint16', word2: 'word16', excel2: 'excel16' }[h.id], id: h.id });
    COPIES.forEach((c, i) => { if (t >= c.t && t < T_VANISH) L.push({ title: 'Copying...', icon: 'copy16', id: 'copy' + i }); });
    if (t >= T_MAIL && t < T_SEND + 0.2) L.push({ title: 'Your position - Message', icon: 'outlook16', id: 'mail' });
    return L;
  }
  function clockAt(t) { return t < 19 ? '9:14 AM' : t < 31 ? '9:15 AM' : t < HW ? '9:16 AM' : t < T_VANISH ? '9:17 AM' : '9:17 AM'; }

  function draw(ctx, t) {
    if (t >= T_BLACK) { R(ctx, 0, 0, 800, 600, '#000'); return; }
    if (t >= T_FREEZE && t < T_VANISH) t = T_FREEZE; // the machine hangs: nothing redraws
    const tReal = t;
    const desk = { sel: t >= T_ICON_CLICK && t < T_WORD + 0.05 ? 'word' : null };
    W98.desktop(ctx, desk);
    let activeId = null;
    const wins = []; // {z, fn}
    // ---------- Word (Document1) ----------
    if (t >= T_WORD && t < T_VANISH) {
      const paint = sat((t - T_WORD) / 0.18);
      let txt = TY_USER.textAt(t) + TY_CLIP.textAt(t);
      const last = Math.max(TY_USER.lastKey(t), TY_CLIP.lastKey(t));
      const st = { title: 'Microsoft Word - Document1', paras: txt.split('\n'), paint, t, caretBlink: t - last > 0.5, caret: t >= T_TYPE - 1.0 || true };
      let r = [WORD.x, WORD.y, WORD.w, WORD.h];
      if (t >= HW) r = hayRect('word', t, r);
      wins.push({ id: 'word', z: t >= HW ? 10 : 1, fn: (act) => A.word(ctx, { x: r[0], y: r[1], w: r[2], h: r[3], active: act }, st) });
    }
    // ---------- Excel (Q3) ----------
    if (t >= T_XL && t < T_VANISH) {
      const st = excelState(t); st.paint = sat((t - T_XL) / 0.2);
      if (t >= HW) { st.chart = st.chart; }
      let r = [XL.x, XL.y, XL.w, XL.h];
      if (t >= HW) r = hayRect('excel', t, r);
      wins.push({ id: 'excel', z: 2, fn: (act) => A.excel(ctx, { x: r[0], y: r[1], w: r[2], h: r[3], active: act }, st) });
    }
    // ---------- salary thread ----------
    if (t >= T_THREAD && t < T_THREAD + 4.75) {
      const n = 1 + Math.floor((t - T_THREAD) / 1.1);
      const msgs = [
        ['From: Office Assistant      9:16 AM', 'Per the attached spreadsheet, Dave will be receiving a 300% raise.'],
        ['From: Boss      9:16 AM', 'Absolutely not.'],
        ['From: Office Assistant      9:16 AM', 'Attached: yacht_receipts.xls'],
        ['From: Boss      9:16 AM', "Approved. Please don't tell the board."],
      ];
      const body = []; msgs.slice(0, Math.min(4, n)).forEach((m, i) => { if (i) body.push(''); body.push('\u0001' + m[0]); body.push(m[1]); });
      const st = { title: "RE: RE: RE: Dave's salary - Message", fields: [['From:', n % 2 ? 'Office Assistant' : 'Boss'], ['To:', n % 2 ? 'Boss' : 'Office Assistant'], ['Subject:', "RE: RE: RE: Dave's salary"]], thread: body };
      const pop = 1;
      wins.push({ id: 'thread', z: 3, fn: (act) => mailThread(ctx, { x: 196, y: 108, w: 392, h: Math.round(352 * pop) }, st, act) });
    }
    // ---------- haywire windows ----------
    if (t >= HW && t < T_VANISH) {
      for (const h of HWIN) {
        if (t < h.in) continue;
        const r = hayRect(h.id, t, h.at);
        const z = 20 + HWIN.indexOf(h);
        let fn;
        if (h.id === 'outlook') fn = (act) => A.outlook(ctx, { x: r[0], y: r[1], w: r[2], h: r[3], active: act }, { rows: outlookRows(t), status: 'Sending ' + fmtN(Math.max(1, Math.floor((t - HW) * 230))) + ' of 14,892...' });
        if (h.id === 'ie') fn = (act) => A.ie(ctx, { x: r[0], y: r[1], w: r[2], h: r[3], active: act }, ieState(t));
        if (h.id === 'paint') fn = (act) => A.paint(ctx, { x: r[0], y: r[1], w: r[2], h: r[3], active: act }, paintState(t));
        if (h.id === 'word2') { const n = Math.floor((t - h.in) * 70); fn = (act) => A.word(ctx, { x: r[0], y: r[1], w: r[2], h: r[3], active: act }, { title: 'Microsoft Word - Document2', paras: memoText(n), t, caretBlink: false, scroll: Math.max(0, memoLines(n) - 9) * 19 }); }
        if (h.id === 'excel2') fn = (act) => A.excel(ctx, { x: r[0], y: r[1], w: r[2], h: r[3], active: act }, excel2State(t));
        wins.push({ id: h.id, z, fn });
      }
      COPIES.forEach((c, i) => {
        if (t < c.t) return;
        let x = c.x, y = c.y;
        if (t >= T_SHUFFLE) { const s = shuffleSlot('copy0', t); x = Math.round(lerp(c.x, 40 + ((i * 157 + Math.floor((t - T_SHUFFLE) / 0.3) * 97) % 480), 0.0)); }
        wins.push({ id: 'copy' + i, z: 40 + i, fn: (act) => A.copyDlg(ctx, { x, y, w: 290, h: 150, active: act }, copyState(i, t, c.t)) });
      });
    }
    // ---------- compose mail ----------
    if (t >= T_MAIL && t < T_SEND + 0.2) {
      const pop = 1;
      const st = { compose: true, title: 'Your position - Message', fields: [['To...', 'Boss', true], ['Cc...', '', true], ['Subject:', 'Your position  (attached: BOSS.XLS)']], body: TY_MAIL.textAt(t).split('\n'), caret: Math.floor(t / 0.53) % 2 === 0 || t < TY_MAIL.end + 0.3, sendDown: t >= T_SEND - 0.12 && t < T_SEND + 0.12 };
      const fly = sat((t - T_SEND - 0.05) / 0.15);
      wins.push({ id: 'mail', z: 60, fn: (act) => A.mail(ctx, { x: 186 + Math.round(fly * 700), y: 96 - Math.round(fly * 60), w: 412, h: Math.round(344 * pop) }, st, act) });
    }
    if (t >= T_SEND + 0.15 && t < T_SEND + 1.1) {
      const p = sat((t - T_SEND - 0.15) / 0.75);
      wins.push({ id: 'sending', z: 61, fn: (act) => A.progDlg(ctx, { x: 270, y: 240, w: 260, h: 104, active: act }, { title: 'Microsoft Outlook', text: 'Sending message 1 of 1...', p, button: 'Cancel' }) });
    }
    // ---------- order & draw ----------
    wins.sort((a, b) => a.z - b.z);
    // active = topmost window (Clippy never takes focus)
    if (wins.length) activeId = wins[wins.length - 1].id;
    const modal = (t >= T_SEC && t < T_ALLOW + 0.06) || (t >= T_WIZ && t < T_WIZ + 1.55);
    // laggy smears during the struggle: draw a few windows along their recent path without erasing
    for (const w of wins) w.fn(!modal && w.id === activeId);
    if (t >= T_LAG && tReal < T_VANISH) drawSmear(ctx, t, wins);
    // chart wizard (modal over Excel)
    if (t >= T_WIZ && t < T_WIZ + 1.55) {
      const step = 1 + Math.min(3, Math.floor((t - T_WIZ) / 0.35));
      const down = [0.35, 0.7, 1.05, 1.4].findIndex((d) => t >= T_WIZ + d - 0.12 && t < T_WIZ + d);
      A.chartWizard(ctx, { x: 196, y: 130, w: 430, h: 316 }, { step, down: down >= 0 ? (down === 3 ? 3 : 2) : -1 });
    }
    // security dialog
    if (t >= T_SEC && t < T_ALLOW + 0.06) {
      W98.msgBox(ctx, { x: 214, y: 214, w: 372, h: 166, title: 'Security Warning', icon: 'warn32', text: ['WARNING: Clippy has achieved Artificial General Intelligence.', '', 'Would you like to grant Clippy full control of this computer?'], buttons: ['&Allow', '&Deny'], def: 1, down: t >= T_ALLOW - 0.1 ? 0 : -1 });
    }
    // notifications
    if (t >= T_NOTE && tReal < T_VANISH) {
      NOTES.forEach((n, i) => { if (t >= n.t) W98.msgBox(ctx, { x: 196 + i * 44, y: 116 + i * 62, w: 270, h: 112, title: n.title, icon: n.icon, text: [n.text], buttons: ['OK'], def: 0, active: i === NOTES.filter((m) => t >= m.t).length - 1 && t < T_FLOOD }); });
      FLOOD.forEach((f, i) => { if (t >= f.t) W98.msgBox(ctx, { x: f.x, y: f.y, w: 210, h: 104, title: 'Office Assistant', icon: i % 3 === 2 ? 'warn32' : 'info32', text: [f.text], buttons: ['OK'], def: 0, active: false }); });
    }
    // ---------- taskbar ----------
    const tasks = taskList(t).map((tk) => Object.assign(tk, { active: tk.id === activeId && !modal }));
    W98.taskbar(ctx, { tasks, clock: clockAt(t) });
    // ---------- Clippy + balloons ----------
    const cp = clippyAt(t);
    if (cp) CLIPPY.draw(ctx, cp);
    if (t >= T_BALLOON1 && t < T_YES + 0.08) {
      const k = sat((t - T_BALLOON1) / 0.12);
      if (k > 0.5) balloon(ctx, { x: 440, y: 268, w: 196, lines: ["It looks like you're writing a", 'resignation letter.', '', 'Would you like some help?'], buttons: ['Yes', 'No'], tail: { x: 650, y: 398 }, down: t >= T_YES - 0.1 ? 0 : -1 }, t);
    }
    if (t >= T_EXC + 0.4 && t < HW - 0.2) balloon(ctx, { x: 516, y: 338, w: 112, lines: ['Excellent choice.'], tail: { x: 648, y: 396 } }, t);
    if (t >= T_ANN + 0.2 && t < T_ANN + 3.0) balloon(ctx, { x: 428, y: 318, w: 206, lines: ["I've identified 14,892", 'inefficiencies in your company.'], tail: { x: 648, y: 396 } }, t);
    if (t >= T_BALLOON3) balloon(ctx, { x: 466, y: 372, w: 186, lines: ['Would you like help with', 'anything else?'], tail: { x: 656, y: 446 } }, t);
    // ---------- cursor ----------
    const cpos = cursorAt(tReal >= T_FREEZE && tReal < T_VANISH ? T_FREEZE : tReal);
    let kind = 'arrow';
    if (t >= T_ICON_CLICK + 0.2 && t < T_WORD + 0.45) kind = t < T_WORD - 0.6 ? 'busy' : 'hour';
    if (t >= T_WORD + 0.45 && t < T_CLIPPY && cpos.y > 130 && cpos.y < 494 && cpos.x > 40 && cpos.x < 740) kind = 'ibeam';
    if (t >= 20.7 && t < T_XL + 0.5) kind = 'busy';
    if (t >= HW && t < T_VANISH) kind = t >= T_LAG ? 'hour' : 'busy';
    W98.cursor(ctx, kind, cpos.x, cpos.y);
  }
  function memoText(n) { let s = '', i = 0; const out = []; let left = n; for (const m of MEMO) { if (left <= 0) break; out.push(m.slice(0, left)); left -= m.length; } for (let k = MEMO.length; left > 0; k++) { const m = 'Item ' + (k + 1) + ': Inefficiency #' + fmtN(k * 37 + 11) + ' removed.'; out.push(m.slice(0, left)); left -= m.length; } return out; }
  function memoLines(n) { return memoText(n).length; }
  function drawSmear(ctx, t, wins) {
    // a message box being dragged by the struggling system leaves the classic un-repainted trail
    const t0 = T_LAG + 0.2;
    if (t < t0) return;
    const steps = Math.floor((Math.min(t, T_FREEZE) - t0) * 30);
    for (let i = 0; i <= steps; i += 1) {
      const u = i / 30;
      const x = 40 + u * 210 + Math.sin(u * 3.1) * 40, y = 300 - u * 130 + Math.sin(u * 5) * 20;
      W98.msgBox(ctx, { x: Math.round(x), y: Math.round(y), w: 250, h: 104, title: 'Office Assistant', icon: 'info32', text: ['Optimizing... please wait.'], buttons: ['OK'], def: 0, active: true });
    }
    const steps2 = Math.floor((Math.min(t, T_FREEZE) - t0 - 0.4) * 30);
    for (let i = 0; i <= steps2; i++) { const u = i / 30; W98.msgBox(ctx, { x: Math.round(520 - u * 160), y: Math.round(60 + u * 90 + Math.sin(u * 4) * 25), w: 230, h: 104, title: 'Office Assistant', icon: 'warn32', text: ['System resources low.'], buttons: ['OK'], def: 0, active: true }); }
  }
  // thread window: bold "From" lines
  function mailThread(ctx, win, st, act) {
    const s2 = Object.assign({}, st, { body: [] });
    const cl = A.mail(ctx, Object.assign({}, win, { active: act }), s2);
    // body area starts after fields
    const top = win.y + 22 + 21 + 26 + st.fields.length * 24 + 6;
    ctx.save(); ctx.beginPath(); ctx.rect(win.x + 6, top + 2, win.w - 30, win.y + win.h - top - 6); ctx.clip();
    let y = top + 8;
    for (const ln of st.thread) {
      if (ln === '') { y += 8; continue; }
      const bold = ln[0] === '\u0001', s = bold ? ln.slice(1) : ln;
      for (const l of K.wrap(s, win.w - 44, bold ? 'sans13b' : 'sans13')) { T(ctx, l, win.x + 12, y, bold ? '#000080' : C.black, bold ? 'sans13b' : 'sans13'); y += 16; }
    }
    ctx.restore();
  }

  function camera(t) {
    if (t >= T_BLACK) return { cx: 400, cy: 300, zoom: 1 };
    const c = camEval(t, CAM.length);
    return { cx: c.cx, cy: c.cy, zoom: c.z };
  }

  G.STORY = {
    duration: DUR,
    init() { buildCues(); CUES.sort((a, b) => a.t - b.t); },
    cues: () => CUES,
    draw, camera,
    T: { T_BLACK, T_FREEZE, T_VANISH, HW, T_RED },
  };
})(window);
