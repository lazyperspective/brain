// Original 1-bit icons and cursors, drawn by hand (strings) or with tiny pixel-drawing code.
(function (G) {
  const { Bm } = K;
  // ---------- helpers ----------
  function dilateMask(b) { // mask = ink grown by 1 px (8-neighbour) -> white outline around black cursors
    const m = new Uint8Array(b.w * b.h);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      let on = 0; for (let j = -1; j <= 1 && !on; j++) for (let i = -1; i <= 1; i++) if (b.get(x + i, y + j)) { on = 1; break; }
      m[y * b.w + x] = on;
    }
    b.m = m; return b;
  }
  function ellipse(b, cx, cy, rx, ry, v = 1, fill = false) { // midpoint-ish ellipse via angle sampling + rows
    if (fill) { for (let y = -ry; y <= ry; y++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); b.hl(cx - hw, cx + hw, cy + y, v); } return; }
    let px = null, py = null;
    for (let a = 0; a <= 720; a++) { const t = (a / 720) * Math.PI * 2; const x = Math.round(cx + rx * Math.cos(t)), y = Math.round(cy + ry * Math.sin(t)); if (x !== px || y !== py) b.set(x, y, v); px = x; py = y; }
  }
  function flood(b, x, y, v = 1) {
    const st = [x, y], tgt = b.get(x, y); if (tgt === v) return;
    while (st.length) { const yy = st.pop(), xx = st.pop(); if (xx < 0 || yy < 0 || xx >= b.w || yy >= b.h) continue; if (b.get(xx, yy) !== tgt) continue; b.set(xx, yy, v); st.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1); }
  }
  function rrFillBm(b, x0, y0, x1, y1, r, v = 1) { const w = x1 - x0 + 1, h = y1 - y0 + 1; for (let j = 0; j < h; j++) { const i = K.rrInset(j, h, r); b.hl(x0 + i, x1 - i, y0 + j, v); } }
  function rr(b, x0, y0, x1, y1, r, v = 1) { // rounded rect outline = border pixels of the filled shape
    const w = x1 - x0 + 1, h = y1 - y0 + 1, t = new Bm(w + 2, h + 2);
    rrFillBm(t, 1, 1, w, h, r);
    for (let y = 1; y <= h; y++) for (let x = 1; x <= w; x++) if (t.get(x, y) && (!t.get(x - 1, y) || !t.get(x + 1, y) || !t.get(x, y - 1) || !t.get(x, y + 1))) b.set(x0 + x - 1, y0 + y - 1, v);
  }
  const S = (rows) => Bm.from(rows);

  // ---------- cursors (hotspot hx,hy) ----------
  const CUR = {};
  CUR.arrow = { b: S([
    '..              ',
    '.#.             ',
    '.##.            ',
    '.###.           ',
    '.####.          ',
    '.#####.         ',
    '.######.        ',
    '.#######.       ',
    '.########.      ',
    '.#####.....     ',
    '.##.##.         ',
    '.#. .##.        ',
    '..  .##.        ',
    '     .##.       ',
    '     .##.       ',
    '      ..        ']), hx: 1, hy: 1 };
  CUR.watch = { b: S([
    '    ......      ',
    '    .####.      ',
    '    .####.      ',
    '   ..####..     ',
    '  .##....##.    ',
    ' .#...#....#.   ',
    ' .#...#....#..  ',
    '.#....#.....##. ',
    '.#....####..##. ',
    ' .#........#..  ',
    ' .#........#.   ',
    '  .##....##.    ',
    '   ..####..     ',
    '    .####.      ',
    '    .####.      ',
    '    ......      ']), hx: 7, hy: 8 };
  CUR.ibeam = { b: dilateMask(S([
    '               ',
    ' ##.##         ',
    '...#...        ',
    '...#...        ',
    '...#...        ',
    '...#...        ',
    '...#...        ',
    '...#...        ',
    '...#...        ',
    '...#...        ',
    '...#...        ',
    '...#...        ',
    ' ##.##         '].map((r) => r.replace(/\./g, ' ')))), hx: 3, hy: 7 };
  {
    const b = new Bm(16, 16);
    for (let i = 0; i < 15; i++) { if (Math.abs(i - 7) > 1) { b.set(7, i); b.set(i, 7); } }
    b.set(7, 7);
    CUR.cross = { b: dilateMask(b), hx: 7, hy: 7 };
  }
  CUR.pencil = { b: S([
    '          ...   ',
    '         .###.  ',
    '        .#..##. ',
    '       .#..#.#. ',
    '      .#..#.#.  ',
    '     .#..#.#.   ',
    '    .#..#.#.    ',
    '   .#..#.#.     ',
    '  .#..#.#.      ',
    ' .##.#.#.       ',
    ' .#.##.#.       ',
    '.#...##.        ',
    '.##.##.         ',
    '.####.          ',
    '.##..           ',
    '...             ']), hx: 1, hy: 14 };
  CUR.bucket = { b: S([
    '      ...       ',
    '     .###.      ',
    '    .#...#..    ',
    '   .#.....##.   ',
    '  .##....#.##.  ',
    ' .#.##..#..###. ',
    '.#....###...##. ',
    '.#.....#....##. ',
    ' .#........#.#. ',
    '  .#......#..#. ',
    '   .#....#. .#. ',
    '    .#..#.  .#. ',
    '     .##.   ... ',
    '      ..        ']), hx: 13, hy: 12 };
  {
    const b = new Bm(16, 16); b.rect(0, 0, 15, 15); b.m = new Uint8Array(256).fill(1);
    CUR.eraser = { b, hx: 8, hy: 8 };
  }

  // ---------- apple menu glyph (original plump apple with stem + leaf, no bite) ----------
  const APPLE = S([
    '.......##...',
    '......##....',
    '......#.....',
    '..####.####.',
    '.##########.',
    '############',
    '############',
    '############',
    '############',
    '.##########.',
    '.##########.',
    '..###..###..',
  ]);

  // ---------- desktop icons 32x32 ----------
  function diskIcon() {
    const b = new Bm(32, 32);
    // body with chamfered top-right corner
    b.hl(3, 25, 2); b.line(25, 2, 28, 5); b.vl(28, 5, 29); b.hl(3, 28, 29); b.vl(3, 2, 29);
    // metal shutter + slot
    b.rect(8, 2, 22, 12); b.frect(17, 4, 20, 10);
    // label
    b.rect(7, 16, 24, 29); b.hl(9, 22, 19); b.hl(9, 22, 22); b.hl(9, 18, 25);
    // write-protect notch + hub hint
    b.frect(5, 26, 5, 27);
    return b.autoMask();
  }
  function trashIcon(full) {
    const b = new Bm(32, 32);
    if (!full) {
      b.rect(13, 2, 18, 4);               // handle
      b.rect(6, 5, 25, 8);                // lid
      b.frect(7, 6, 24, 7, 0);
      b.hl(8, 23, 7);
      // body (slightly tapered)
      b.vl(8, 9, 28); b.vl(23, 9, 28); b.hl(8, 23, 29); b.line(8, 28, 9, 29); b.line(23, 28, 22, 29);
      b.set(8, 29, 0); b.set(23, 29, 0);
      for (const x of [11, 14, 17, 20]) b.vl(x, 11, 26);
      return b.autoMask();
    }
    // bulging: sides bowed out, lid knocked askew on a heap of crumpled paper
    const prof = [0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0, 0, 0];
    const top = 10;
    for (let j = 0; j < 19; j++) { const y = top + j; b.set(8 - prof[j], y); b.set(23 + prof[j], y); }
    b.hl(8, 23, 29); b.set(8, 29, 0); b.set(23, 29, 0); b.hl(9, 22, 29);
    for (const x of [11, 14, 17, 20]) for (let j = 2; j < 17; j++) { const off = Math.round((x - 15.5) / 7.5 * prof[j] * 0.8); b.set(x + off, top + j); }
    // crumpled paper bulging over the rim
    const paper = [[7, 10], [8, 9], [10, 9], [11, 10], [13, 8], [15, 9], [17, 7], [19, 8], [21, 6], [23, 8], [24, 10]];
    for (let i = 0; i + 1 < paper.length; i++) b.line(paper[i][0], paper[i][1], paper[i + 1][0], paper[i + 1][1]);
    b.line(12, 9, 13, 10); b.line(16, 8, 17, 9); b.line(20, 9, 21, 10); b.set(9, 9);
    // lid, tilted, resting on the heap: outlined parallelogram
    for (let x = 4; x <= 25; x++) { const yt = Math.round(7 - (x - 4) * 4 / 21); b.set(x, yt); b.set(x, yt + 2); b.set(x, yt + 1, x === 4 || x === 25 ? 1 : 0); }
    b.line(12, 4, 12, 2); b.line(12, 2, 17, 1); b.line(17, 1, 17, 3); b.set(13, 3, 0);
    b.hl(8, 23, top);
    b.autoMask();
    for (let x = 5; x <= 24; x++) { const yt = Math.round(7 - (x - 4) * 4 / 21); for (let y = yt + 2; y <= top; y++) b.m[y * 32 + x] = 1; }
    return b;
  }
  function chatIcon() { // original: a speech bubble holding a little three-loop knot
    const b = new Bm(32, 32);
    rr(b, 2, 3, 29, 23, 7);
    // tail
    b.hl(8, 11, 23, 0); b.line(8, 23, 6, 29); b.line(6, 29, 13, 23);
    // knot: three interlaced loops
    const cx = 15.5, cy = 13;
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 2;
      for (let s = 0; s < 400; s++) {
        const t = (s / 400) * Math.PI * 2; const ex = 7.2 * Math.cos(t), ey = 2.6 * Math.sin(t);
        b.set(Math.round(cx + ex * Math.cos(a) - ey * Math.sin(a)), Math.round(cy + ex * Math.sin(a) + ey * Math.cos(a)));
      }
    }
    b.set(15, 13, 1); b.set(16, 13, 1);
    return b.autoMask();
  }
  function paintIcon() { // MacPaint-ish document/app: brush over a framed picture (original drawing)
    const b = new Bm(32, 32);
    b.rect(4, 6, 27, 27); b.rect(6, 8, 25, 25);
    b.line(8, 22, 13, 15); b.line(13, 15, 17, 19); b.line(17, 19, 23, 12);
    b.line(21, 2, 11, 16); b.line(23, 3, 13, 17); b.line(21, 2, 23, 3);
    return b.autoMask();
  }
  function happyMac() { // boot icon: compact computer with a smiling face (original drawing)
    const b = new Bm(26, 33);
    // case
    b.hl(2, 23, 0); b.vl(1, 1, 25); b.vl(24, 1, 25); b.set(1, 0, 0); b.set(24, 0, 0); b.set(1, 1); b.set(24, 1);
    b.hl(1, 24, 26); b.set(1, 26, 0); b.set(24, 26, 0); b.hl(2, 23, 26);
    // foot
    b.vl(2, 27, 31); b.vl(23, 27, 31); b.hl(2, 23, 32); b.hl(2, 23, 27);
    // screen bezel (rounded)
    b.hl(5, 20, 3); b.hl(5, 20, 17); b.vl(4, 4, 16); b.vl(21, 4, 16);
    // face
    b.vl(9, 7, 8); b.vl(16, 7, 8);                       // eyes
    b.vl(13, 7, 11); b.set(12, 11);                      // nose
    b.set(9, 13); b.set(10, 14); b.hl(11, 14, 14); b.set(15, 14); b.set(16, 13); // smile
    // floppy slot + logo bump
    b.hl(13, 20, 22); b.set(5, 22); b.set(6, 22);
    return b.autoMask();
  }
  function bombIcon() { // alert icon: round bomb, fuse and spark (original drawing)
    const b = new Bm(32, 32);
    ellipse(b, 13, 19, 10, 10, 1, true);
    // highlight
    b.set(8, 14, 0); b.set(9, 13, 0); b.set(10, 12, 0); b.set(7, 15, 0); b.set(7, 16, 0); b.set(11, 12, 0);
    // neck
    b.frect(18, 8, 23, 12); b.set(18, 8, 0); b.set(23, 12, 0);
    b.frect(19, 9, 22, 11, 1);
    // fuse
    b.line(22, 8, 24, 5); b.line(24, 5, 26, 5);
    // spark
    b.set(27, 2); b.set(27, 1); b.set(28, 4); b.set(29, 4); b.set(26, 3); b.set(30, 2); b.set(29, 6); b.set(25, 1);
    return b; // no mask needed (drawn on white)
  }
  const ICON = {};
  function init() {
    if (ICON.disk) return;
    ICON.disk = diskIcon(); ICON.trash = trashIcon(false); ICON.trashFull = trashIcon(true);
    ICON.chat = chatIcon(); ICON.paint = paintIcon(); ICON.happy = happyMac(); ICON.bomb = bombIcon(); ICON.apple = APPLE;
    TOOLS = buildTools();
  }

  // ---------- MacPaint tool palette icons (original drawings), each drawn into a 22x16 cell ----------
  let TOOLS = null;
  const TOOL_ORDER = ['lasso', 'marquee', 'grabber', 'text', 'bucket', 'spray', 'brush', 'pencil', 'line', 'eraser',
    'rect', 'frect', 'rrect', 'frrect', 'oval', 'foval', 'free', 'ffree', 'poly', 'fpoly'];
  function buildTools() {
    const T = {};
    const mk = (fn) => { const b = new Bm(20, 14); fn(b); return b; };
    T.marquee = mk((b) => { for (let x = 3; x <= 16; x += 2) { b.set(x, 2); b.set(x + 1, 11); } for (let y = 2; y <= 11; y += 2) { b.set(3, y + 1); b.set(16, y); } });
    T.lasso = mk((b) => { ellipse(b, 10, 5, 7, 4); b.line(5, 8, 6, 11); b.line(6, 11, 4, 13); b.set(5, 9); });
    T.grabber = mk((b) => {
      const r = ['....##.##.....', '...#..#..#.##.', '...#..#..##..#', '...#..#..#...#', '.##.#.....#..#', '#..##........#', '#...#........#', '.#...........#', '..#.........#.', '...#........#.', '....#......#..', '.....######...'];
      r.forEach((s, j) => { for (let i = 0; i < s.length; i++) if (s[i] === '#') b.set(3 + i, 1 + j); });
    });
    T.text = mk((b) => {
      const r = ['....##....', '....##....', '...#.##...', '...#.##...', '..#...##..', '..######..', '.#.....##.', '.#.....##.', '###...####'];
      r.forEach((s, j) => { for (let i = 0; i < s.length; i++) if (s[i] === '#') b.set(5 + i, 2 + j); });
    });
    T.bucket = mk((b) => {
      const r = ['.....##.......', '....#..#......', '...#....##....', '..##...#.##...', '.#.##.#..###..', '#....##...##..', '#.....#...##..', '.#.......#.#..', '..#.....#..#..', '...#...#...#..', '....#.#.......', '.....#........'];
      r.forEach((s, j) => { for (let i = 0; i < s.length; i++) if (s[i] === '#') b.set(3 + i, 1 + j); });
    });
    T.spray = mk((b) => { b.rect(9, 5, 14, 13); b.frect(10, 3, 13, 4); b.set(11, 2); b.set(11, 1); b.set(9, 1); for (const [x, y] of [[3, 1], [5, 2], [2, 4], [6, 4], [4, 6], [1, 2], [7, 1], [3, 8], [6, 7]]) b.set(x, y); });
    T.brush = mk((b) => { b.line(16, 1, 9, 8); b.line(17, 2, 10, 9); b.set(17, 1); b.frect(7, 8, 9, 10); b.set(10, 10); b.line(6, 10, 3, 12); b.line(7, 11, 4, 13); b.set(3, 13); b.set(6, 11); });
    T.pencil = mk((b) => { b.line(16, 1, 6, 11); b.line(18, 3, 8, 13); b.line(16, 1, 18, 3); b.line(15, 2, 17, 4, 1); b.line(6, 11, 4, 13); b.line(8, 13, 4, 13); b.line(6, 11, 6, 11); b.set(5, 12); });
    T.line = mk((b) => { b.line(4, 12, 15, 1); });
    T.eraser = mk((b) => { b.line(8, 2, 16, 2); b.line(8, 2, 3, 7); b.line(16, 2, 11, 7); b.rect(3, 7, 11, 12); b.line(16, 2, 16, 7); b.line(16, 7, 11, 12); });
    T.rect = mk((b) => b.rect(3, 2, 16, 11));
    T.frect = mk((b) => { b.rect(3, 2, 16, 11); for (let y = 3; y < 11; y++) for (let x = 4; x < 16; x++) if ((x + y) % 2) b.set(x, y); });
    T.rrect = mk((b) => rr(b, 3, 2, 16, 11, 3));
    T.frrect = mk((b) => { rr(b, 3, 2, 16, 11, 3); for (let y = 3; y < 11; y++) for (let x = 4; x < 16; x++) if ((x + y) % 2 && !(y < 4 && (x < 5 || x > 14)) && !(y > 9 && (x < 5 || x > 14))) b.set(x, y); });
    T.oval = mk((b) => ellipse(b, 9.5, 6.5, 6.5, 4.5));
    T.foval = mk((b) => { ellipse(b, 9.5, 6.5, 6.5, 4.5); const c = new Bm(20, 14); ellipse(c, 9.5, 6.5, 5.5, 3.5, 1, true); for (let y = 0; y < 14; y++) for (let x = 0; x < 20; x++) if (c.get(x, y) && (x + y) % 2) b.set(x, y); });
    T.free = mk((b) => { b.line(4, 8, 6, 3); b.line(6, 3, 10, 5); b.line(10, 5, 14, 2); b.line(14, 2, 16, 7); b.line(16, 7, 12, 11); b.line(12, 11, 7, 10); b.line(7, 10, 4, 8); });
    T.ffree = mk((b) => { b.line(4, 8, 6, 3); b.line(6, 3, 10, 5); b.line(10, 5, 14, 2); b.line(14, 2, 16, 7); b.line(16, 7, 12, 11); b.line(12, 11, 7, 10); b.line(7, 10, 4, 8); for (let y = 4; y < 10; y++) for (let x = 6; x < 15; x++) if ((x + y) % 2 && !(y < 5 && x > 8 && x < 12)) b.set(x, y); });
    T.poly = mk((b) => { b.line(4, 11, 7, 2); b.line(7, 2, 15, 4); b.line(15, 4, 12, 8); b.line(12, 8, 16, 11); b.line(16, 11, 4, 11); });
    T.fpoly = mk((b) => { b.line(4, 11, 7, 2); b.line(7, 2, 15, 4); b.line(15, 4, 12, 8); b.line(12, 8, 16, 11); b.line(16, 11, 4, 11); for (let y = 4; y < 11; y++) for (let x = 6; x < 14; x++) if ((x + y) % 2 && !(x > 11 && y > 5 && y < 9)) b.set(x, y); });
    return T;
  }

  G.ICONS = { init, CUR, ICON, get TOOLS() { return TOOLS; }, TOOL_ORDER, ellipse, flood, rr, rrFillBm, dilateMask };
})(window);
