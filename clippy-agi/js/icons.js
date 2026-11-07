// Hand-made pixel icons (original drawings in a late-90s 16-colour idiom). ICON(ctx, name, x, y).
(function (G) {
  const { R, H, V, frame, C } = K;
  const PAL = { k: '#000000', r: '#800000', g: '#008000', o: '#808000', n: '#000080', p: '#800080', t: '#008080', s: '#808080',
    S: '#c0c0c0', R: '#ff0000', G: '#00ff00', Y: '#ffff00', B: '#0000ff', M: '#ff00ff', c: '#00ffff', w: '#ffffff', y: '#ffffe1', b: '#ffcc66', e: '#e0c890', d: '#a08040' };
  // string art: each char a palette key, '.' transparent
  function P(ctx, x, y, rows) {
    for (let j = 0; j < rows.length; j++) { const r = rows[j]; for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch !== '.' && ch !== ' ') { ctx.fillStyle = PAL[ch]; ctx.fillRect(x + i, y + j, 1, 1); } } }
  }
  const ART = {
    W16: ['kkkkk.kkkk.kkkkk', 'kBBk..kBBk..kBBk', '.kBk..kBBk..kBk.', '.kBBk.kBBk.kBBk.', '..kBk.kBBk.kBk..', '..kBBkBBBBkBBk..', '...kBkBkkBkBk...', '...kBBBkkBBBk...', '....kBBk.kBBk...', '....kkk..kkkk...'],
    X16: ['kkkkk....kkkkk', '.kGGk...kGGk..', '..kGGk.kGGk...', '...kGGkGGk....', '....kGGGk.....', '....kGGGk.....', '...kGGkGGk....', '..kGGk.kGGk...', '.kGGk...kGGk..', 'kkkkk....kkkkk'],
  };
  function page(ctx, x, y, w, h) { // white sheet with folded corner
    R(ctx, x, y, w - 4, h, C.white); R(ctx, x + w - 4, y + 4, 4, h - 4, C.white);
    H(ctx, x, y, w - 4, C.black); V(ctx, x, y, h, C.black); H(ctx, x, y + h - 1, w, C.black); V(ctx, x + w - 1, y + 4, h - 4, C.black);
    for (let i = 0; i < 4; i++) { R(ctx, x + w - 5 + i, y + i, 1, 1, C.black); }
    H(ctx, x + w - 5, y + 4, 5, C.black); V(ctx, x + w - 5, y, 5, C.black); R(ctx, x + w - 4, y + 1, 1, 3, '#c0c0c0'); R(ctx, x + w - 3, y + 2, 1, 2, '#c0c0c0');
  }
  function lines(ctx, x, y, w, n, step = 2, c = '#808080') { for (let i = 0; i < n; i++) H(ctx, x, y + i * step, w - ((i * 7) % 5), c); }
  function folder(ctx, x, y, w, h, open) {
    R(ctx, x + 1, y, Math.round(w * 0.4), 3, '#ffff99'); H(ctx, x + 1, y, Math.round(w * 0.4), '#000'); V(ctx, x, y + 1, 2, '#000'); V(ctx, x + Math.round(w * 0.4) + 1, y + 1, 2, '#000');
    R(ctx, x, y + 2, w, h - 2, '#ffcc33'); frame(ctx, x, y + 2, w, h - 2, '#000'); H(ctx, x + 1, y + 3, w - 2, '#ffff99'); V(ctx, x + 1, y + 3, h - 4, '#ffff99'); R(ctx, x + 1, y + h - 2, w - 2, 1, '#cc9900');
  }
  function monitor(ctx, x, y, w, h, scr = '#008080') {
    R(ctx, x, y, w, h, '#c0c0c0'); frame(ctx, x, y, w, h, '#000'); H(ctx, x + 1, y + 1, w - 2, '#fff'); V(ctx, x + 1, y + 1, h - 2, '#fff');
    R(ctx, x + 3, y + 3, w - 6, h - 6, '#000'); R(ctx, x + 4, y + 4, w - 8, h - 8, scr);
  }
  function shortcut(ctx, x, y) { R(ctx, x, y + 21, 11, 11, '#fff'); frame(ctx, x, y + 21, 11, 11, '#000'); P(ctx, x + 2, y + 23, ['...kkkk', '....kkk', '...k.kk', '..k...k', '.k.....', '.k.....', 'k......']); }

  const ICONS = {
    computer32(ctx, x, y) {
      monitor(ctx, x + 5, y + 1, 22, 18, '#008080'); R(ctx, x + 10, y + 6, 6, 3, '#00ffff'); R(ctx, x + 9, y + 10, 10, 1, '#00a0a0');
      R(ctx, x + 12, y + 19, 8, 2, '#808080'); H(ctx, x + 12, y + 19, 8, '#000');
      R(ctx, x + 2, y + 21, 28, 8, '#c0c0c0'); frame(ctx, x + 2, y + 21, 28, 8, '#000'); H(ctx, x + 3, y + 22, 26, '#fff'); H(ctx, x + 3, y + 27, 26, '#808080');
      H(ctx, x + 17, y + 24, 9, '#000'); H(ctx, x + 17, y + 25, 9, '#808080'); R(ctx, x + 5, y + 24, 2, 2, '#00ff00'); R(ctx, x + 8, y + 24, 2, 2, '#ffff00');
      R(ctx, x + 1, y + 29, 24, 3, '#c0c0c0'); frame(ctx, x + 1, y + 29, 24, 3, '#000'); for (let i = 3; i < 23; i += 2) R(ctx, x + i, y + 30, 1, 1, '#808080');
    },
    docs32(ctx, x, y) {
      folder(ctx, x + 1, y + 8, 28, 20); page(ctx, x + 9, y + 2, 16, 18); lines(ctx, x + 11, y + 7, 10, 5, 2, '#000080');
      R(ctx, x + 2, y + 15, 26, 13, '#ffcc33'); frame(ctx, x + 1, y + 14, 28, 14, '#000'); H(ctx, x + 2, y + 15, 26, '#ffff99'); H(ctx, x + 2, y + 26, 26, '#cc9900');
    },
    ie32(ctx, x, y) { // an original "blue e with ring" approximation
      const ring = (c, r1, r2) => { for (let a = 0; a < 360; a += 2) { const t = a * Math.PI / 180; const px = Math.cos(t) * r1, py = Math.sin(t) * r2; const xr = px * 0.85 - py * 0.53, yr = px * 0.53 + py * 0.85; if (a > 200 && a < 330) continue; R(ctx, Math.round(x + 16 + xr), Math.round(y + 16 + yr), 2, 2, c); } };
      ring('#806000', 15, 6);
      P(ctx, x + 6, y + 5, ['.....kkkkkk.....', '...kkBBBBBBkk...', '..kBBBccBBBBBk..', '.kBBBkkkkkBBBBk.', '.kBBk.....kBBBk.', 'kBBk.......kBBk', 'kBBk.......kBBk', 'kBBkkkkkkkkkBBk', 'kBBBBBBBBBBBBBk', 'kBBkkkkkkkkkkkk', 'kBBk...........', 'kBBk......kkkk.', '.kBBk....kBBBk.', '.kBBBkkkkBBBk..', '..kkBBBBBBBkk..', '....kkkkkkk....']);
      ring('#ffcc00', 14, 5);
    },
    net32(ctx, x, y) {
      monitor(ctx, x + 9, y + 1, 14, 11, '#008080'); R(ctx, x + 12, y + 12, 8, 2, '#808080');
      monitor(ctx, x + 1, y + 17, 12, 10, '#008080'); monitor(ctx, x + 19, y + 17, 12, 10, '#008080');
      H(ctx, x + 7, y + 15, 18, '#000'); V(ctx, x + 16, y + 13, 3, '#000'); V(ctx, x + 7, y + 15, 2, '#000'); V(ctx, x + 25, y + 15, 2, '#000');
      R(ctx, x + 4, y + 27, 6, 2, '#808080'); R(ctx, x + 22, y + 27, 6, 2, '#808080');
    },
    recycle32(ctx, x, y) {
      // wire basket
      for (let j = 0; j < 22; j++) { const inset = Math.round(j * 0.18); R(ctx, x + 6 + inset, y + 8 + j, 20 - 2 * inset, 1, j % 3 === 0 ? '#808080' : '#e0e0e0'); }
      for (let i = 0; i < 6; i++) { for (let j = 0; j < 22; j++) { const inset = Math.round(j * 0.18); const xx = x + 6 + inset + Math.round(i * (20 - 2 * inset) / 5.5); R(ctx, Math.min(xx, x + 25 - inset), y + 8 + j, 1, 1, '#606060'); } }
      for (let j = 0; j < 22; j++) { const inset = Math.round(j * 0.18); R(ctx, x + 5 + inset, y + 8 + j, 1, 1, '#000'); R(ctx, x + 26 - inset, y + 8 + j, 1, 1, '#000'); }
      R(ctx, x + 4, y + 6, 24, 3, '#c0c0c0'); frame(ctx, x + 4, y + 6, 24, 3, '#000'); H(ctx, x + 9, y + 29, 14, '#000');
      P(ctx, x + 11, y + 14, ['...gg...', '..gGGg..', '.g.gg.g.', 'gGg..gGg', 'gg....gg', '.gggggg.']);
    },
    outlook32(ctx, x, y) {
      R(ctx, x + 2, y + 9, 24, 17, '#ffff99'); frame(ctx, x + 2, y + 9, 24, 17, '#000');
      for (let i = 0; i < 12; i++) { R(ctx, x + 3 + i, y + 10 + Math.round(i * 0.6), 1, 1, '#000'); R(ctx, x + 24 - i, y + 10 + Math.round(i * 0.6), 1, 1, '#000'); }
      H(ctx, x + 3, y + 24, 22, '#cc9900');
      // round blue badge with a white clock-ish O
      K.pEllipse(ctx, x + 23, y + 9, 8, 8, '#000'); K.pEllipse(ctx, x + 23, y + 9, 7, 7, '#0000c0'); K.pEllipse(ctx, x + 23, y + 9, 4, 4, '#fff'); K.pEllipse(ctx, x + 23, y + 9, 2, 2, '#0000c0');
    },
    briefcase32(ctx, x, y) {
      R(ctx, x + 11, y + 6, 10, 4, '#000'); R(ctx, x + 13, y + 7, 6, 3, '#008080');
      R(ctx, x + 2, y + 10, 28, 17, '#a08040'); frame(ctx, x + 2, y + 10, 28, 17, '#000'); H(ctx, x + 3, y + 11, 26, '#e0c890'); H(ctx, x + 3, y + 17, 26, '#604000');
      R(ctx, x + 14, y + 15, 4, 4, '#ffff00'); frame(ctx, x + 14, y + 15, 4, 4, '#000');
    },
    word32(ctx, x, y) { page(ctx, x + 10, y + 2, 19, 26); lines(ctx, x + 14, y + 8, 12, 8, 2, '#808080'); P(ctx, x + 1, y + 10, ART.W16.map((r) => r)); R(ctx, x + 1, y + 21, 1, 1, '#000'); },
    excel32(ctx, x, y) {
      page(ctx, x + 10, y + 2, 19, 26);
      for (let j = 0; j < 6; j++) H(ctx, x + 12, y + 8 + j * 3, 14, '#808080'); for (let i = 0; i < 4; i++) V(ctx, x + 13 + i * 4, y + 8, 16, '#808080');
      P(ctx, x + 2, y + 11, ART.X16);
    },
    paint32(ctx, x, y) {
      // palette with brush
      K.pEllipse(ctx, x + 15, y + 18, 13, 9, '#000'); K.pEllipse(ctx, x + 15, y + 18, 12, 8, '#e0c890');
      R(ctx, x + 6, y + 14, 4, 3, '#ff0000'); R(ctx, x + 11, y + 12, 4, 3, '#0000ff'); R(ctx, x + 17, y + 12, 4, 3, '#ffff00'); R(ctx, x + 22, y + 15, 4, 3, '#00a000'); K.pEllipse(ctx, x + 10, y + 22, 2, 2, '#808080');
      for (let i = 0; i < 14; i++) { R(ctx, x + 14 + i, y + 26 - i * 1.5, 2, 2, '#804000'); }
      R(ctx, x + 12, y + 25, 4, 4, '#000'); R(ctx, x + 13, y + 26, 2, 2, '#ff0000');
    },
    warn32(ctx, x, y) {
      for (let j = 0; j < 28; j++) { const hw = Math.round(j * 0.5 + 1); R(ctx, x + 16 - hw, y + 2 + j, hw * 2, 1, '#000'); if (j > 1 && j < 26) { const iw = hw - 2; R(ctx, x + 16 - iw, y + 2 + j, iw * 2, 1, '#ffff00'); } }
      R(ctx, x + 2, y + 28, 28, 2, '#000');
      R(ctx, x + 14, y + 10, 4, 11, '#000'); R(ctx, x + 15, y + 21, 2, 1, '#000'); R(ctx, x + 14, y + 23, 4, 3, '#000');
    },
    info32(ctx, x, y) {
      K.pEllipse(ctx, x + 16, y + 13, 14, 12, '#000'); K.pEllipse(ctx, x + 16, y + 13, 13, 11, '#fff');
      P(ctx, x + 7, y + 22, ['....kkkk', '...kwwk.', '..kwwk..', '.kwk....', 'kk......']);
      R(ctx, x + 14, y + 5, 4, 3, '#0000ff'); R(ctx, x + 13, y + 10, 5, 2, '#0000ff'); R(ctx, x + 14, y + 12, 4, 7, '#0000ff'); R(ctx, x + 13, y + 19, 6, 2, '#0000ff');
    },
    error32(ctx, x, y) {
      K.pEllipse(ctx, x + 16, y + 16, 14, 14, '#800000'); K.pEllipse(ctx, x + 16, y + 16, 13, 13, '#ff0000');
      for (let i = -6; i <= 6; i++) { R(ctx, x + 15 + i, y + 15 + i, 3, 3, '#fff'); R(ctx, x + 15 + i, y + 15 - i, 3, 3, '#fff'); }
    },
    // ---- 16x16 ----
    word16(ctx, x, y) { page(ctx, x + 5, y + 1, 10, 14); lines(ctx, x + 8, y + 5, 5, 5, 2); P(ctx, x, y + 4, ['k.k.k', 'kBkBk', 'kBkBk', '.kBk.', '.k.k.']); P(ctx, x, y + 4, ['kk.kk.k', 'kBkBkBk', 'kBBBBBk', '.kBkBk.', '.kk.kk.']); },
    excel16(ctx, x, y) { page(ctx, x + 5, y + 1, 10, 14); for (let j = 0; j < 4; j++) H(ctx, x + 7, y + 5 + j * 2, 6, '#808080'); P(ctx, x, y + 5, ['kk...kk', '.kGkGk.', '..kGk..', '.kGkGk.', 'kk...kk']); },
    outlook16(ctx, x, y) { R(ctx, x + 1, y + 5, 12, 9, '#ffff99'); frame(ctx, x + 1, y + 5, 12, 9, '#000'); for (let i = 0; i < 6; i++) { R(ctx, x + 2 + i, y + 6 + (i >> 1), 1, 1, '#000'); R(ctx, x + 11 - i, y + 6 + (i >> 1), 1, 1, '#000'); } K.pEllipse(ctx, x + 12, y + 5, 4, 4, '#000'); K.pEllipse(ctx, x + 12, y + 5, 3, 3, '#0000c0'); R(ctx, x + 11, y + 4, 2, 2, '#fff'); },
    ie16(ctx, x, y) { P(ctx, x + 2, y + 2, ['...kkkkk...', '..kBBBBBk..', '.kBk...kBk.', 'kBk.....kBk', 'kBkkkkkkkBk', 'kBBBBBBBBBk', 'kBk........', 'kBk....kkk.', '.kBk..kBBk.', '..kBBBBBk..', '...kkkkk...']); for (let i = 0; i < 14; i++) R(ctx, x + 1 + i, y + 12 - Math.round(Math.sin(i / 13 * Math.PI) * 9), 1, 1, '#d0a000'); },
    paint16(ctx, x, y) { K.pEllipse(ctx, x + 8, y + 9, 7, 5, '#000'); K.pEllipse(ctx, x + 8, y + 9, 6, 4, '#e0c890'); R(ctx, x + 4, y + 8, 2, 2, '#f00'); R(ctx, x + 7, y + 7, 2, 2, '#00f'); R(ctx, x + 10, y + 8, 2, 2, '#0a0'); for (let i = 0; i < 7; i++) R(ctx, x + 8 + i, y + 13 - i, 1, 1, '#804000'); },
    folder16(ctx, x, y) { folder(ctx, x + 1, y + 2, 14, 11); },
    computer16(ctx, x, y) { monitor(ctx, x + 2, y + 1, 12, 9); R(ctx, x + 1, y + 11, 14, 4, '#c0c0c0'); frame(ctx, x + 1, y + 11, 14, 4, '#000'); },
    desk16(ctx, x, y) { R(ctx, x + 1, y + 3, 14, 10, '#008080'); frame(ctx, x + 1, y + 3, 14, 10, '#000'); R(ctx, x + 2, y + 4, 12, 2, '#000080'); R(ctx, x + 3, y + 8, 5, 3, '#c0c0c0'); R(ctx, x + 4, y + 13, 8, 2, '#808080'); },
    channels16(ctx, x, y) { K.pEllipse(ctx, x + 8, y + 8, 6, 6, '#000'); K.pEllipse(ctx, x + 8, y + 8, 5, 5, '#3060ff'); R(ctx, x + 5, y + 5, 3, 3, '#80ff80'); R(ctx, x + 9, y + 9, 3, 2, '#80ff80'); },
    speaker16(ctx, x, y) { P(ctx, x + 2, y + 3, ['....k...', '...kk...', 'kkkSk.k.', 'kSSSk..k', 'kSSSk..k', 'kkkSk.k.', '...kk...', '....k...']); },
    clippy16(ctx, x, y) { P(ctx, x + 4, y + 1, ['.kkkk..', 'k....k.', 'k.kk.k.', 'k.k.k.k', 'k.k.k.k', 'k.k.k.k', 'k.k.k.k', 'k.k.k.k', 'k...k.k', '.kkk..k', '......k']); R(ctx, x + 3, y + 4, 3, 3, '#fff'); R(ctx, x + 7, y + 4, 3, 3, '#fff'); R(ctx, x + 4, y + 5, 1, 1, '#000'); R(ctx, x + 8, y + 5, 1, 1, '#000'); },
    copy16(ctx, x, y) { page(ctx, x + 1, y + 1, 9, 11); page(ctx, x + 5, y + 4, 9, 11); },
    start(ctx, x, y) { // original four-colour waving squares glyph (not a copy of any logo)
      const sq = [['#f03000', 0, 0], ['#20a020', 6, -1], ['#2040e0', 0, 5], ['#f0c000', 6, 4]];
      for (const [c, dx, dy] of sq) { for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) R(ctx, x + 4 + dx + i, y + 2 + dy + j + (i > 2 ? -0 : 0) + (dx ? 0 : 0) - Math.round(Math.sin((i + dx) / 11 * Math.PI) * 1), 1, 1, c); }
      R(ctx, x, y + 3, 2, 1, '#000'); R(ctx, x + 1, y + 6, 2, 1, '#000'); R(ctx, x, y + 9, 2, 1, '#000');
    },
    shortcut,
  };

  // ---- toolbar 16x16 glyphs (drawn on a grey face) ----
  const TB = {
    new(ctx, x, y) { page(ctx, x + 2, y + 1, 11, 14); },
    open(ctx, x, y) { R(ctx, x + 1, y + 4, 12, 10, '#ffff99'); frame(ctx, x + 1, y + 4, 12, 10, '#000'); P(ctx, x + 3, y + 8, ['kkkkkkkkkkkk', '.kYYYYYYYYYk', '..kYYYYYYYYk', '...kkkkkkkkk']); P(ctx, x + 9, y + 1, ['.kkk.', 'k...k', '....k', '...kkk', '....k.']); },
    save(ctx, x, y) { R(ctx, x + 1, y + 1, 14, 14, '#000'); R(ctx, x + 2, y + 2, 12, 12, '#008080'); R(ctx, x + 4, y + 2, 8, 6, '#fff'); R(ctx, x + 4, y + 10, 8, 4, '#c0c0c0'); R(ctx, x + 9, y + 11, 2, 2, '#000'); },
    print(ctx, x, y) { R(ctx, x + 4, y + 1, 8, 6, '#fff'); frame(ctx, x + 4, y + 1, 8, 6, '#000'); R(ctx, x + 1, y + 7, 14, 6, '#c0c0c0'); frame(ctx, x + 1, y + 7, 14, 6, '#000'); H(ctx, x + 2, y + 8, 12, '#fff'); R(ctx, x + 11, y + 9, 2, 1, '#0f0'); R(ctx, x + 3, y + 13, 10, 2, '#000'); },
    preview(ctx, x, y) { page(ctx, x + 1, y + 1, 10, 14); K.pEllipse(ctx, x + 10, y + 8, 4, 4, '#000'); K.pEllipse(ctx, x + 10, y + 8, 3, 3, '#80ffff'); R(ctx, x + 12, y + 11, 3, 3, '#000'); },
    spell(ctx, x, y) { K.T(ctx, 'ABC', x - 1, y - 4, '#000080', 'ui'); P(ctx, x + 4, y + 9, ['........k', '.......k.', 'k.....k..', '.k...k...', '..k.k....', '...k.....']); },
    cut(ctx, x, y) { P(ctx, x + 3, y + 1, ['k.....k', 'k.....k', '.k...k.', '.k...k.', '..k.k..', '...k...', '..k.k..', '.kkkkk.']); K.pEllipse(ctx, x + 4, y + 12, 3, 3, '#000'); K.pEllipse(ctx, x + 11, y + 12, 3, 3, '#000'); R(ctx, x + 3, y + 11, 2, 2, '#c0c0c0'); R(ctx, x + 10, y + 11, 2, 2, '#c0c0c0'); },
    copy(ctx, x, y) { page(ctx, x + 1, y + 1, 9, 10); page(ctx, x + 6, y + 5, 9, 10); lines(ctx, x + 8, y + 9, 5, 3, 2, '#000080'); },
    paste(ctx, x, y) { R(ctx, x + 1, y + 2, 10, 13, '#a08040'); frame(ctx, x + 1, y + 2, 10, 13, '#000'); R(ctx, x + 4, y + 1, 4, 3, '#808080'); page(ctx, x + 6, y + 6, 9, 9); },
    painter(ctx, x, y) { R(ctx, x + 2, y + 1, 11, 5, '#ffff00'); frame(ctx, x + 2, y + 1, 11, 5, '#000'); R(ctx, x + 7, y + 6, 2, 4, '#000'); R(ctx, x + 6, y + 10, 4, 5, '#808080'); frame(ctx, x + 6, y + 10, 4, 5, '#000'); },
    undo(ctx, x, y) { P(ctx, x + 1, y + 3, ['...kk.....', '..kBk.....', '.kBBkkkkk.', 'kBBBBBBBBk', '.kBBkkkkBk', '..kBk...kBk', '...kk....kBk', '.........kk']); },
    redo(ctx, x, y) { P(ctx, x + 3, y + 3, ['.....kk...', '.....kBk..', '.kkkkkBBk.', 'kBBBBBBBBk', 'kBkkkkBBk.', 'kBk...kBk..', 'kBk....kk...', 'kk.........']); },
    link(ctx, x, y) { K.pEllipse(ctx, x + 7, y + 7, 6, 6, '#000080'); K.pEllipse(ctx, x + 7, y + 7, 5, 5, '#3080ff'); R(ctx, x + 4, y + 4, 3, 3, '#00c000'); P(ctx, x + 8, y + 9, ['.kkk...', 'k...k..', 'k..kkk.', '.kkk..k', '...k..k', '....kk.']); },
    web(ctx, x, y) { R(ctx, x + 1, y + 2, 14, 12, '#fff'); frame(ctx, x + 1, y + 2, 14, 12, '#000'); R(ctx, x + 2, y + 3, 12, 2, '#000080'); K.pEllipse(ctx, x + 8, y + 10, 3, 3, '#3080ff'); },
    table(ctx, x, y) { R(ctx, x + 1, y + 2, 14, 12, '#fff'); frame(ctx, x + 1, y + 2, 14, 12, '#000'); R(ctx, x + 2, y + 3, 12, 2, '#000080'); for (let i = 1; i < 3; i++) V(ctx, x + 1 + i * 5, y + 5, 9, '#000'); for (let j = 1; j < 3; j++) H(ctx, x + 1, y + 5 + j * 3, 14, '#000'); },
    xlsheet(ctx, x, y) { R(ctx, x + 1, y + 2, 14, 12, '#fff'); frame(ctx, x + 1, y + 2, 14, 12, '#000'); for (let i = 1; i < 4; i++) V(ctx, x + 1 + i * 4, y + 2, 12, '#808080'); for (let j = 1; j < 4; j++) H(ctx, x + 1, y + 2 + j * 3, 14, '#808080'); R(ctx, x + 2, y + 3, 3, 2, '#00c000'); },
    columns(ctx, x, y) { for (let c = 0; c < 2; c++) for (let j = 0; j < 6; j++) H(ctx, x + 1 + c * 8, y + 2 + j * 2, 6, '#000'); },
    drawing(ctx, x, y) { P(ctx, x + 1, y + 2, ['...k......', '..kYk.....', '.kYYYk....', 'kkkkkkk...']); K.pEllipse(ctx, x + 10, y + 10, 4, 4, '#000'); K.pEllipse(ctx, x + 10, y + 10, 3, 3, '#00c0c0'); R(ctx, x + 1, y + 9, 6, 6, '#000'); R(ctx, x + 2, y + 10, 4, 4, '#ff0000'); },
    docmap(ctx, x, y) { page(ctx, x + 1, y + 1, 13, 14); R(ctx, x + 2, y + 2, 4, 12, '#c0c0c0'); lines(ctx, x + 7, y + 4, 5, 5, 2, '#000'); },
    pilcrow(ctx, x, y) { P(ctx, x + 4, y + 2, ['.kkkkkk', 'kkkkk.k', 'kkkkk.k', 'kkkkk.k', '.kkkk.k', '....k.k', '....k.k', '....k.k', '....k.k', '....k.k', '....k.k']); },
    help(ctx, x, y) { P(ctx, x + 2, y + 1, ['..kkkkkk...', '.kyyyyyyk..', 'kyyBBByyyk.', 'kyBByBByyk.', 'kyyyyBByyk.', 'kyyyBByyyk.', 'kyyyyyyyyk.', 'kyyyBByyyk.', '.kyyyyyyk..', '..kkkkkkk..', '....kk.....', '...k.......']); },
    bold(ctx, x, y) { K.T(ctx, 'B', x + 4, y + 0, '#000', 'uib'); },
    italic(ctx, x, y) { P(ctx, x + 5, y + 3, ['..kkkk', '...kk.', '...kk.', '..kk..', '..kk..', '.kk...', '.kk...', 'kkkk..']); },
    under(ctx, x, y) { P(ctx, x + 4, y + 2, ['kk..kk', '.k..k.', '.k..k.', '.k..k.', '.k..k.', '.k..k.', '..kk..', '......', 'kkkkkk']); },
    alignl(ctx, x, y) { for (let j = 0; j < 5; j++) H(ctx, x + 2, y + 3 + j * 2, j % 2 ? 8 : 12, '#000'); },
    alignc(ctx, x, y) { for (let j = 0; j < 5; j++) H(ctx, x + (j % 2 ? 4 : 2), y + 3 + j * 2, j % 2 ? 8 : 12, '#000'); },
    alignr(ctx, x, y) { for (let j = 0; j < 5; j++) H(ctx, x + (j % 2 ? 6 : 2), y + 3 + j * 2, j % 2 ? 8 : 12, '#000'); },
    justify(ctx, x, y) { for (let j = 0; j < 5; j++) H(ctx, x + 2, y + 3 + j * 2, 12, '#000'); },
    numbering(ctx, x, y) { for (let j = 0; j < 3; j++) { K.T(ctx, String(j + 1), x + 1, y - 3 + j * 4, '#000', 'ui'); H(ctx, x + 7, y + 3 + j * 4, 7, '#000'); } },
    bullets(ctx, x, y) { for (let j = 0; j < 3; j++) { R(ctx, x + 2, y + 2 + j * 4, 2, 2, '#000'); H(ctx, x + 6, y + 3 + j * 4, 8, '#000'); } },
    outdent(ctx, x, y) { for (let j = 0; j < 5; j++) H(ctx, x + 6, y + 3 + j * 2, 8, '#000'); P(ctx, x + 1, y + 5, ['..k', '.kk', 'kkk', '.kk', '..k']); },
    indent(ctx, x, y) { for (let j = 0; j < 5; j++) H(ctx, x + 6, y + 3 + j * 2, 8, '#000'); P(ctx, x + 1, y + 5, ['k..', 'kk.', 'kkk', 'kk.', 'k..']); },
    border(ctx, x, y) { for (let i = 0; i < 13; i += 2) { R(ctx, x + 2 + i, y + 2, 1, 1, '#808080'); R(ctx, x + 2 + i, y + 8, 1, 1, '#808080'); R(ctx, x + 2, y + 2 + i, 1, 1, '#808080'); R(ctx, x + 8, y + 2 + i, 1, 1, '#808080'); R(ctx, x + 14, y + 2 + i, 1, 1, '#808080'); } H(ctx, x + 2, y + 14, 13, '#000'); },
    highlight(ctx, x, y) { P(ctx, x + 3, y + 1, ['....kk', '...kwk', '..kwk.', '.kwk..', 'kkk...']); R(ctx, x + 1, y + 11, 14, 4, '#ffff00'); },
    fontcolor(ctx, x, y) { K.T(ctx, 'A', x + 4, y - 2, '#000', 'uib'); R(ctx, x + 1, y + 11, 14, 4, '#ff0000'); },
    sum(ctx, x, y) { P(ctx, x + 3, y + 2, ['kkkkkkkk', 'k.....k', '.k.......', '..k......', '...k.....', '..k......', '.k.......', 'k.....k', 'kkkkkkkk']); },
    fx(ctx, x, y) { K.T(ctx, 'f', x + 3, y - 1, '#000', 'uib'); K.T(ctx, 'x', x + 8, y + 1, '#000', 'ui'); },
    sortaz(ctx, x, y) { K.T(ctx, 'A', x - 1, y - 4, '#0000ff', 'ui'); K.T(ctx, 'Z', x - 1, y + 4, '#ff0000', 'ui'); P(ctx, x + 10, y + 1, ['.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', 'kkk', '.k.']); },
    sortza(ctx, x, y) { K.T(ctx, 'Z', x - 1, y - 4, '#ff0000', 'ui'); K.T(ctx, 'A', x - 1, y + 4, '#0000ff', 'ui'); P(ctx, x + 10, y + 1, ['.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', '.k.', 'kkk', '.k.']); },
    chart(ctx, x, y) { R(ctx, x + 1, y + 1, 14, 14, '#fff'); frame(ctx, x + 1, y + 1, 14, 14, '#000'); R(ctx, x + 3, y + 8, 3, 6, '#0000ff'); R(ctx, x + 7, y + 4, 3, 10, '#ff0000'); R(ctx, x + 11, y + 6, 2, 8, '#ffff00'); },
    map(ctx, x, y) { K.pEllipse(ctx, x + 8, y + 8, 6, 6, '#000'); K.pEllipse(ctx, x + 8, y + 8, 5, 5, '#0080ff'); R(ctx, x + 5, y + 5, 4, 3, '#00a000'); R(ctx, x + 9, y + 9, 3, 3, '#00a000'); },
    currency(ctx, x, y) { K.T(ctx, '$', x + 5, y - 1, '#000', 'ui'); },
    percent(ctx, x, y) { K.T(ctx, '%', x + 3, y - 1, '#000', 'ui'); },
    comma(ctx, x, y) { K.T(ctx, ',', x + 6, y - 2, '#000', 'uib'); },
    incdec(ctx, x, y) { K.T(ctx, '.0', x + 1, y - 4, '#000', 'ui'); K.T(ctx, '.00', x + 1, y + 3, '#000', 'ui'); },
    fill(ctx, x, y) { P(ctx, x + 2, y + 1, ['...k.....', '..kwk....', '.kwwwk...', 'kwwwwwk..', '.kwwwk.k.', '..kwk..k.', '...k...k.']); R(ctx, x + 1, y + 11, 14, 4, '#ffff00'); },
    zoom100(ctx, x, y) {},
  };
  function ICON(ctx, name, x, y) { const f = ICONS[name]; if (f) f(ctx, x, y); }
  function TBI(ctx, name, x, y) { const f = TB[name]; if (f) f(ctx, x, y); }
  G.ICON = ICON; G.TBI = TBI; G.PIX = P; G.ICONS = ICONS;
})(window);
