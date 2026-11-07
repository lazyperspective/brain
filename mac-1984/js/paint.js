// MacPaint (redrawn from scratch): screen layout, tool + pattern palettes, the "untitled" document window, and a
// deterministic stroke-by-stroke drawing engine. Drawings are scripts of operations (shape drags, pencil strokes,
// bucket fills, eraser passes, text, marquee+delete, stamps) scheduled on the timeline together with the AI-driven
// cursor that performs them (it flies to the palettes to pick tools and patterns, then draws).
(function (G) {
  const { R, H, V, frame, P, B, W, PAT, pbit, Bm, E, lerp, sat, clamp, hash, rng } = K;
  const DW = 416, DH = 240, DX = 90, DY = 44;           // document visible area on screen
  const WIN = { x: 89, y: 25, w: 418, h: 260 };
  const PAL = { x: 9, y: 27, cw: 23, ch: 17 };          // tool palette: 2 x 10 cells
  const LINES = { x: 9, y: 206, w: 47, h: 52 };
  const PATS = ['black', 'white', 'gray', 'ltgray', 'dkgray', 'sparse', 'hlines2', 'diag', 'tiles', 'bricks', 'dots', 'vlines', 'hatch', 'grid',
    'weave', 'scales', 'diamond', 'checker', 'hatch2', 'dkhatch', 'shingle', 'wave', 'crosses', 'circles', 'dkdots', 'zig', 'stars', 'lt2',
    'vlines2', 'basket', 'rain', 'thatch', 'ring', 'lt3', 'plaid', 'dash', 'hlines', 'diag2'];
  const PG = { x: 66, y: 299, cw: 22, ch: 19 };          // pattern grid: 19 x 2
  const CUR_PAT = { x: 9, y: 298, w: 47, h: 39 };

  function toolCell(name) { const i = ICONS.TOOL_ORDER.indexOf(name); const c = i % 2, r = (i / 2) | 0; return { x: PAL.x + c * PAL.cw, y: PAL.y + r * PAL.ch, w: PAL.cw + 1, h: PAL.ch + 1 }; }
  function patCell(name) { const i = PATS.indexOf(name); const c = (i / 2) | 0, r = i % 2; return { x: PG.x + c * PG.cw, y: PG.y + r * PG.ch, w: PG.cw + 1, h: PG.ch + 1 }; }

  // ---------------- UI ----------------
  const MENUS = ['@', 'File', 'Edit', 'Goodies', 'Font', 'FontSize', 'Style'];
  function drawUI(ctx, st) {
    R(ctx, 0, 0, MAC.SW, MAC.SH, W);
    MAC.menubar(ctx, MENUS, st.menuHi == null ? -1 : st.menuHi);
    // tool palette
    for (const name of ICONS.TOOL_ORDER) {
      const c = toolCell(name); frame(ctx, c.x, c.y, c.w, c.h, B);
      const on = name === st.tool;
      if (on) R(ctx, c.x + 1, c.y + 1, c.w - 2, c.h - 2, B);
      ICONS.TOOLS[name].draw(ctx, c.x + 2, c.y + 2, { inkOnly: true, inv: on });
    }
    // line-size box
    frame(ctx, LINES.x, LINES.y, LINES.w, LINES.h, B);
    const lw = [1, 2, 3, 4, 5]; let yy = LINES.y + 5;
    lw.forEach((w, i) => { R(ctx, LINES.x + 14, yy, LINES.w - 20, w, B); if (i === 0) { R(ctx, LINES.x + 4, yy - 2, 2, 1, B); R(ctx, LINES.x + 5, yy - 1, 2, 1, B); R(ctx, LINES.x + 6, yy, 2, 1, B); R(ctx, LINES.x + 7, yy - 1, 2, 1, B); R(ctx, LINES.x + 8, yy - 2, 2, 1, B); R(ctx, LINES.x + 9, yy - 3, 2, 1, B); } yy += w + 5; });
    // dotted "lines off" sample
    for (let x = LINES.x + 14; x < LINES.x + LINES.w - 6; x += 2) R(ctx, x, LINES.y + LINES.h - 6, 1, 1, B);
    // current pattern box
    frame(ctx, CUR_PAT.x, CUR_PAT.y, CUR_PAT.w, CUR_PAT.h, B);
    P(ctx, CUR_PAT.x + 4, CUR_PAT.y + 4, CUR_PAT.w - 8, CUR_PAT.h - 8, st.pat || 'black'); frame(ctx, CUR_PAT.x + 3, CUR_PAT.y + 3, CUR_PAT.w - 6, CUR_PAT.h - 6, B);
    // pattern palette
    for (const name of PATS) { const c = patCell(name); frame(ctx, c.x, c.y, c.w, c.h, B); P(ctx, c.x + 1, c.y + 1, c.w - 2, c.h - 2, name); }
    // document window
    const cr = MAC.window(ctx, { x: WIN.x, y: WIN.y, w: WIN.w, h: WIN.h, title: st.title || 'untitled', active: st.active !== false });
    return cr;
  }

  // ---------------- document raster ops ----------------
  const pat = (name) => PAT[name] || PAT.black;
  function px(b, x, y, v) { if (x >= 0 && y >= 0 && x < DW && y < DH) b[y * DW + x] = v; }
  function pp(b, x, y, p) { if (x >= 0 && y >= 0 && x < DW && y < DH) b[y * DW + x] = pbit(p, x, y); }
  function shapeMask(kind, x0, y0, x1, y1, r) { // returns {x,y,w,h,m}
    const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0) + 1, h = Math.abs(y1 - y0) + 1;
    const m = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) {
      let i0 = 0;
      if (kind === 'rrect') i0 = K.rrInset(j, h, Math.min(r || 8, Math.floor(Math.min(w, h) / 2)));
      if (kind === 'oval') { const ry = h / 2, yy = (j + 0.5 - ry) / ry; i0 = Math.round((w / 2) * (1 - Math.sqrt(Math.max(0, 1 - yy * yy)))); }
      for (let i = i0; i < w - i0; i++) m[j * w + i] = 1;
    }
    return { x, y, w, h, m };
  }
  function drawShape(b, op, x1, y1) {
    const s = shapeMask(op.shape, op.x0, op.y0, x1, y1, op.r);
    const lw = op.lw || 1;
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      if (!s.m[j * s.w + i]) continue;
      let edge = false;
      for (let d = 1; d <= lw && !edge; d++) {
        if (i - d < 0 || i + d >= s.w || j - d < 0 || j + d >= s.h || !s.m[j * s.w + i - d] || !s.m[j * s.w + i + d] || !s.m[(j - d) * s.w + i] || !s.m[(j + d) * s.w + i]) edge = true;
      }
      const X = s.x + i, Y = s.y + j;
      if (edge && op.line !== false) px(b, X, Y, 1);
      else if (op.fill) pp(b, X, Y, pat(op.fill));
      else if (edge && op.line === false && op.fill) pp(b, X, Y, pat(op.fill));
    }
  }
  function pen(b, x, y, lw, v) { const o = Math.floor((lw - 1) / 2); for (let j = 0; j < lw; j++) for (let i = 0; i < lw; i++) px(b, x - o + i, y - o + j, v); }
  function bres(x0, y0, x1, y1, f) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { f(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function pathLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function pathAt(pts, u) { // point at arc fraction u, plus the truncated polyline
    const L = pathLen(pts) * u; let acc = 0; const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc + d >= L) { const k = d ? (L - acc) / d : 0; const p = [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; out.push(p); return { p, pts: out }; }
      acc += d; out.push(pts[i]);
    }
    return { p: pts[pts.length - 1], pts: out };
  }
  function strokePath(b, pts, f) { for (let i = 1; i < pts.length; i++) bres(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], f); if (pts.length === 1) f(Math.round(pts[0][0]), Math.round(pts[0][1])); }
  function flood(b, x, y, p) {
    x = Math.round(x); y = Math.round(y); if (b[y * DW + x]) return;
    const seen = new Uint8Array(DW * DH), st = [y * DW + x]; seen[y * DW + x] = 1; const reg = [];
    while (st.length) {
      const k = st.pop(); reg.push(k); const xx = k % DW, yy = (k / DW) | 0;
      if (xx > 0 && !seen[k - 1] && !b[k - 1]) { seen[k - 1] = 1; st.push(k - 1); }
      if (xx < DW - 1 && !seen[k + 1] && !b[k + 1]) { seen[k + 1] = 1; st.push(k + 1); }
      if (yy > 0 && !seen[k - DW] && !b[k - DW]) { seen[k - DW] = 1; st.push(k - DW); }
      if (yy < DH - 1 && !seen[k + DW] && !b[k + DW]) { seen[k + DW] = 1; st.push(k + DW); }
    }
    for (const k of reg) b[k] = pbit(p, k % DW, (k / DW) | 0);
  }
  const textCache = {};
  function textBm(s, f) {
    const key = f + '|' + s; if (textCache[key]) return textCache[key];
    const w = FONT.measure(s, f) + 4, h = 18, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); FONT.text(g, s, 0, 3, f, B);
    const d = g.getImageData(0, 0, w, h).data, bm = new Bm(w, h);
    for (let i = 0; i < w * h; i++) bm.d[i] = d[i * 4 + 3] > 128 ? 1 : 0;
    const advs = []; let x = 0; for (const ch of s) { const m = FONT.FONTS[f].map[ch] || FONT.FONTS[f].map['?']; x += m.adv; advs.push(x); }
    return (textCache[key] = { bm, advs });
  }
  const ERASER = 14;
  function eraseAt(b, x, y) { const o = ERASER >> 1; for (let j = 0; j < ERASER; j++) for (let i = 0; i < ERASER; i++) px(b, Math.round(x) - o + i, Math.round(y) - o + j, 0); }

  // apply op at progress u in [0,1] (u=1 commits)
  function apply(b, op, u) {
    switch (op.kind) {
      case 'shape': case 'line': {
        const k = op.ease ? op.ease(u) : E.inOut2(u);
        const x1 = Math.round(lerp(op.x0, op.x1, k)), y1 = Math.round(lerp(op.y0, op.y1, k));
        if (op.kind === 'line') { bres(op.x0, op.y0, x1, y1, (x, y) => pen(b, x, y, op.lw || 1, 1)); }
        else if (Math.abs(x1 - op.x0) >= 1 || Math.abs(y1 - op.y0) >= 1) drawShape(b, op, x1, y1);
        break;
      }
      case 'pencil': { const a = pathAt(op.pts, u); strokePath(b, a.pts, (x, y) => pen(b, x, y, op.lw || 1, op.white ? 0 : 1)); break; }
      case 'erase': { const a = pathAt(op.pts, u); const P2 = a.pts; for (let i = 1; i < P2.length; i++) { const d = Math.hypot(P2[i][0] - P2[i - 1][0], P2[i][1] - P2[i - 1][1]); const n = Math.max(1, Math.ceil(d)); for (let s = 0; s <= n; s++) eraseAt(b, lerp(P2[i - 1][0], P2[i][0], s / n), lerp(P2[i - 1][1], P2[i][1], s / n)); } if (P2.length === 1) eraseAt(b, P2[0][0], P2[0][1]); break; }
      case 'fill': if (u >= 0.35) flood(b, op.x, op.y, pat(op.pat)); break;
      case 'text': {
        const T = textBm(op.str, op.font); const n = Math.floor(u * op.str.length + 1e-6); const wmax = n ? T.advs[n - 1] : 0;
        for (let j = 0; j < T.bm.h; j++) for (let i = 0; i < Math.min(wmax, T.bm.w); i++) if (T.bm.d[j * T.bm.w + i]) px(b, op.x + i, op.y - 3 + j, 1);
        break;
      }
      case 'stamp': { // reveal a bitmap's pixels in reading order (ink and, if masked, white)
        const bm = op.bm, n = Math.floor(u * bm.w * bm.h + 1e-6);
        for (let q = 0; q < n; q++) {
          const i = op.cols ? (q / bm.h) | 0 : q % bm.w, j = op.cols ? q % bm.h : (q / bm.w) | 0;
          const k = j * bm.w + i, m = bm.m ? bm.m[k] : 1; if (!m) continue;
          if (bm.d[k]) px(b, op.x + i, op.y + j, op.inv ? 0 : 1); else if (bm.m) px(b, op.x + i, op.y + j, op.inv ? 1 : 0);
        }
        break;
      }
      case 'spray': {
        const a = pathAt(op.pts, u), r = rng(op.seed || 7), L = pathLen(a.pts), n = Math.floor(L * (op.density || 1.2));
        for (let q = 0; q < n; q++) { const s = r() * L; const p = pathAt(a.pts, L ? s / L : 0).p; const ang = r() * 6.283, rad = Math.sqrt(r()) * op.r; px(b, Math.round(p[0] + Math.cos(ang) * rad), Math.round(p[1] + Math.sin(ang) * rad), 1); }
        break;
      }
      case 'del': if (u >= 1) for (let y = op.y0; y <= op.y1; y++) for (let x = op.x0; x <= op.x1; x++) px(b, x, y, 0); break;
      case 'clear': if (u >= 0.5) b.fill(0); break;
      case 'marquee': case 'wait': case 'pick': break;
    }
  }
  // cursor position (doc coords) during an op
  function opCursor(op, u) {
    switch (op.kind) {
      case 'shape': case 'line': case 'marquee': { const k = op.ease ? op.ease(u) : E.inOut2(u); return [lerp(op.x0, op.x1, k), lerp(op.y0, op.y1, k)]; }
      case 'pencil': case 'erase': case 'spray': return pathAt(op.pts, u).p;
      case 'fill': return [op.x, op.y];
      case 'text': { const T = textBm(op.str, op.font); const n = Math.floor(u * op.str.length); return [op.x + (n ? T.advs[n - 1] : 0) + 1, op.y + 4]; }
      case 'stamp': { const bm = op.bm, q = u * bm.w * bm.h; if (op.cols) return [op.x + q / bm.h, op.y + bm.h / 2]; return [op.x + bm.w / 2 + Math.sin(q * 0.9) * bm.w * 0.35, op.y + q / bm.w]; }
      case 'del': case 'clear': return null;
    }
    return null;
  }
  function opStart(op) { const c = opCursor(op, 0); return c; }

  // ---------------- scheduler ----------------
  // Builds ops with times + a cursor track (segments in SCREEN coords) + tool/pattern changes.
  function builder(t0, cur, o = {}) {
    const S = { t: t0, ops: [], segs: [], tools: [], pats: [], clicks: [], tool: o.tool || 'pencil', pat: o.pat || 'black', cur: cur.slice(), speed: o.speed || 1, menuEvents: [] };
    const sp = () => S.speed;
    function travel(to, extra = 0, ease = E.inOut2) {
      const d = Math.hypot(to[0] - S.cur[0], to[1] - S.cur[1]);
      if (d < 0.5) return;
      const dur = (0.035 + d / 2600 + extra) / sp();
      const a = S.cur.slice(), b = to.slice();
      S.segs.push({ t0: S.t, t1: S.t + dur, f: (u) => { const k = ease(u); return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]; } });
      S.t += dur; S.cur = b.slice();
    }
    function hold(dur) { S.t += dur / sp(); }
    function pickTool(name) {
      if (S.tool === name) return;
      const c = toolCell(name); travel([c.x + 11, c.y + 9]); hold(0.035); S.tools.push({ t: S.t, v: name }); S.clicks.push(S.t); S.tool = name; hold(0.03);
    }
    function pickPat(name) {
      if (S.pat === name) return;
      const c = patCell(name); travel([c.x + 11, c.y + 9]); hold(0.035); S.pats.push({ t: S.t, v: name }); S.clicks.push(S.t); S.pat = name; hold(0.03);
    }
    function addOp(op, dur, tool) {
      if (tool) pickTool(tool);
      const st = opStart(op); if (st) travel([st[0] + DX, st[1] + DY]);
      op.t0 = S.t; op.t1 = S.t + dur / sp(); op.tool = S.tool;
      S.ops.push(op);
      const f = (u) => { const c = opCursor(op, u); return c ? [c[0] + DX, c[1] + DY] : S.cur; };
      if (opCursor(op, 0)) S.segs.push({ t0: op.t0, t1: op.t1, f });
      S.t = op.t1; const e = opCursor(op, 1); if (e) S.cur = [e[0] + DX, e[1] + DY];
      hold(0.015);
      return op;
    }
    const api = {
      S,
      get t() { return S.t; }, set t(v) { S.t = v; },
      speed(v) { S.speed = v; return api; },
      wait(s) { S.t += s; return api; },
      moveTo(x, y) { travel([x, y]); return api; },
      tool(n) { pickTool(n); return api; },
      pat(n) { pickPat(n); return api; },
      shape(shape, x0, y0, x1, y1, opt = {}) {
        const filled = !!opt.fill;
        const tool = { rect: filled ? 'frect' : 'rect', rrect: filled ? 'frrect' : 'rrect', oval: filled ? 'foval' : 'oval' }[shape];
        pickTool(tool); if (filled) pickPat(opt.fill);
        const d = Math.hypot(x1 - x0, y1 - y0);
        addOp(Object.assign({ kind: 'shape', shape, x0, y0, x1, y1 }, opt), opt.dur || 0.1 + d / 650, null);
        return api;
      },
      line(x0, y0, x1, y1, opt = {}) { addOp(Object.assign({ kind: 'line', x0, y0, x1, y1 }, opt), opt.dur || 0.06 + Math.hypot(x1 - x0, y1 - y0) / 700, 'line'); return api; },
      pencil(pts, opt = {}) { addOp(Object.assign({ kind: 'pencil', pts }, opt), opt.dur || 0.04 + pathLen(pts) / 520, 'pencil'); return api; },
      erase(pts, opt = {}) { addOp(Object.assign({ kind: 'erase', pts }, opt), opt.dur || 0.05 + pathLen(pts) / 420, 'eraser'); return api; },
      spray(pts, r, opt = {}) { addOp(Object.assign({ kind: 'spray', pts, r }, opt), opt.dur || 0.05 + pathLen(pts) / 300, 'spray'); return api; },
      fill(x, y, p, opt = {}) { pickTool('bucket'); pickPat(p); addOp({ kind: 'fill', x, y, pat: p }, opt.dur || 0.09, null); return api; },
      text(x, y, str, font = 'g9', opt = {}) { addOp({ kind: 'text', x, y, str, font }, opt.dur || 0.05 + str.length * 0.045, 'text'); return api; },
      stamp(bm, x, y, opt = {}) { addOp(Object.assign({ kind: 'stamp', bm, x, y }, opt), opt.dur || 0.05 + (bm.w * bm.h) / 2600, opt.tool || 'pencil'); return api; },
      marquee(x0, y0, x1, y1, opt = {}) { const op = addOp({ kind: 'marquee', x0, y0, x1, y1 }, opt.dur || 0.12 + Math.hypot(x1 - x0, y1 - y0) / 900, 'marquee'); S.lastMarquee = op; return api; },
      del(opt = {}) { const m = S.lastMarquee; hold(opt.pause || 0.12); const op = { kind: 'del', x0: Math.min(m.x0, m.x1), y0: Math.min(m.y0, m.y1), x1: Math.max(m.x0, m.x1), y1: Math.max(m.y0, m.y1), t0: S.t, t1: S.t + 0.001, tool: S.tool }; S.ops.push(op); m.until = S.t; S.keyDel = S.t; hold(0.08); return api; },
      clear() { // double-click the eraser in the palette: erase the whole window
        const c = toolCell('eraser'); travel([c.x + 11, c.y + 9]); hold(0.05); S.tools.push({ t: S.t, v: 'eraser' }); S.tool = 'eraser'; S.clicks.push(S.t); hold(0.09); S.clicks.push(S.t);
        S.ops.push({ kind: 'clear', t0: S.t - 0.001, t1: S.t, tool: 'eraser' }); hold(0.12); return api;
      },
      done() { return finalize(S); },
    };
    return api;
  }
  function finalize(S) {
    const ops = S.ops.slice().sort((a, b) => a.t0 - b.t0);
    const segs = S.segs.slice().sort((a, b) => a.t0 - b.t0);
    const at = (list, t, d) => { let v = d; for (const e of list) { if (e.t <= t) v = e.v; else break; } return v; };
    const r = {
      ops, segs, end: S.t, t0: segs.length ? segs[0].t0 : S.t, clicks: S.clicks, endCur: S.cur,
      toolAt: (t, d) => at(S.tools, t, d), patAt: (t, d) => at(S.pats, t, d),
      cursorAt(t) {
        let p = null;
        for (const s of segs) { if (t < s.t0) break; p = s.f(t >= s.t1 ? 1 : (t - s.t0) / (s.t1 - s.t0)); }
        return p;
      },
      opAt(t) { let o = null; for (const op of ops) { if (op.t0 <= t && t < op.t1) o = op; } return o; },
    };
    return r;
  }

  // ---------------- document state at time t (incremental cache) ----------------
  function makeDoc(tracks) {
    const ops = []; tracks.forEach((tr) => ops.push(...tr.ops)); ops.sort((a, b) => a.t1 - b.t1);
    let cache = { n: 0, buf: new Uint8Array(DW * DH) };
    const work = new Uint8Array(DW * DH);
    return {
      ops,
      at(t) {
        let n = 0; while (n < ops.length && ops[n].t1 <= t) n++;
        if (n < cache.n) cache = { n: 0, buf: new Uint8Array(DW * DH) };
        for (let i = cache.n; i < n; i++) apply(cache.buf, ops[i], 1);
        cache.n = n;
        work.set(cache.buf);
        for (let i = n; i < ops.length; i++) { const op = ops[i]; if (op.t0 <= t && t < op.t1) apply(work, op, (t - op.t0) / (op.t1 - op.t0)); }
        return work;
      },
      marquees(t) { return ops.filter((o) => o.kind === 'marquee' && t >= o.t0 && t < (o.until || o.t1 + 0.4)); },
    };
  }
  let img = null;
  function blit(ctx, buf, clipH = DH) {
    if (!img) img = ctx.createImageData(DW, DH);
    const d = img.data;
    for (let i = 0; i < DW * DH; i++) { const v = buf[i] ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, DX, DY, 0, 0, DW, clipH);
  }
  function marchingAnts(ctx, m, t) {
    const x0 = Math.min(m.x0, m.x1) + DX, y0 = Math.min(m.y0, m.y1) + DY;
    let u = t < m.t1 ? (t - m.t0) / (m.t1 - m.t0) : 1; const c = opCursor(m, u);
    const x1 = Math.round(c[0]) + DX, y1 = Math.round(c[1]) + DY;
    const ph = Math.floor(t * 12) % 8;
    const per = []; for (let x = x0; x <= x1; x++) per.push([x, y0]); for (let y = y0; y <= y1; y++) per.push([x1, y]); for (let x = x1; x >= x0; x--) per.push([x, y1]); for (let y = y1; y >= y0; y--) per.push([x0, y]);
    per.forEach(([x, y], i) => { R(ctx, x, y, 1, 1, ((i + ph) & 7) < 4 ? B : W); });
  }

  // ---------------- art helpers ----------------
  const ICON8 = {
    phone: ['##......', '###.....', '##......', '.#......', '.##.....', '..##.##.', '...#####', '....###.'],
    mail: ['........', '########', '##....##', '#.#..#.#', '#..##..#', '#......#', '########', '........'],
    clock: ['..####..', '.#....#.', '#...#..#', '#...#..#', '#...###.', '#......#', '.#....#.', '..####..'],
    camera: ['........', '..##....', '########', '#..##..#', '#.#..#.#', '#.#..#.#', '#..##..#', '########'],
    music: ['..#####.', '..#...#.', '..#...#.', '..#...#.', '.##..##.', '###.###.', '###.###.', '.#...#..'],
    cal: ['.#....#.', '########', '#......#', '#.##.###', '#..#...#', '#..#..#.', '#.###.#.', '########'],
    pin: ['..###...', '.#...#..', '.#.#.#..', '.#...#..', '..#.#...', '..#.#...', '...#....', '........'],
    gear: ['.#.##.#.', '..####..', '###..###', '.#....#.', '.#....#.', '###..###', '..####..', '.#.##.#.'],
    sun: ['#..#..#.', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..', '#..#..#.', '........'],
    chat: ['.######.', '#......#', '#.#.#.##', '#......#', '.#####..', '....##..', '....#...', '........'],
    calc: ['#######.', '#.....#.', '#######.', '#.#.#.#.', '#######.', '#.#.#.#.', '#######.', '........'],
    notes: ['#######.', '#.....#.', '#.###.#.', '#.....#.', '#.###.#.', '#.....#.', '#######.', '........'],
    photo: ['...#....', '.#.#.#..', '..###...', '###.###.', '..###...', '.#.#.#..', '...#....', '........'],
    smile: ['..####..', '.#....#.', '#.#..#.#', '#......#', '#.#..#.#', '#..##..#', '.#....#.', '..####..'],
    stocks: ['........', '......#.', '.....#.#', '....#...', '#..#....', '.##.....', '........', '########'],
    book: ['........', '.##.##..', '#..#..#.', '#..#..#.', '#..#..#.', '#..#..#.', '.##.##..', '........'],
  };
  function appTile(name) { // 12x12 white rounded tile (masked) with a black 8x8 glyph
    const b = new Bm(12, 12); b.m = new Uint8Array(144).fill(1);
    for (const [x, y] of [[0, 0], [11, 0], [0, 11], [11, 11]]) b.m[y * 12 + x] = 0;
    const g = ICON8[name]; g.forEach((r, j) => { for (let i = 0; i < 8; i++) if (r[i] === '#') b.d[(j + 2) * 12 + i + 2] = 1; });
    return b;
  }
  function S2(rows) { return Bm.from(rows); }

  G.PAINT = { DW, DH, DX, DY, WIN, PATS, MENUS, toolCell, patCell, drawUI, builder, makeDoc, blit, marchingAnts, appTile, ICON8, S2, textBm, ERASER };
})(window);
