  /* ================================================================ the cut: type, captions, lip sync, shots */
  /* ================================================================ type: a 5 × 7 pixel font */
  const FONT = (() => {
    const g = {
      A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.', C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
      E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....', G: '.###.|#...#|#....|#.###|#...#|#...#|.###.', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
      I: '###|.#.|.#.|.#.|.#.|.#.|###', J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..', K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
      M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#', O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
      Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#', S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
      U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
      Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
      0: '.###.|#..##|#.#.#|#.#.#|##..#|#...#|.###.', 1: '.#.|##.|.#.|.#.|.#.|.#.|###', 2: '.###.|#...#|....#|...#.|..#..|.#...|#####', 3: '####.|....#|....#|.###.|....#|....#|####.',
      4: '#..#.|#..#.|#..#.|#####|...#.|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.', 6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|..#..|..#..|..#..',
      8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|....#|.###.',
      '.': '..|..|..|..|..|##|##', ',': '..|..|..|..|..|.#|#.', '!': '#|#|#|#|#|.|#', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..', "'": '#|#|.|.|.|.|.',
      '-': '...|...|...|###|...|...|...', ':': '.|#|.|.|.|#|.', '·': '.|.|.|#|.|.|.', ' ': '...|...|...|...|...|...|...', '—': '.....|.....|.....|#####|.....|.....|.....',
    };
    const o = {}; for (const k in g) o[k] = g[k].split('|'); return o;
  })();
  const glyphW = (ch) => (FONT[ch] || FONT[' '])[0].length;
  function textWidth(s, sc) { let w = 0; for (const ch of s) w += (glyphW(ch) + 1) * sc; return w - sc; }
  // draw text; c may be a function (i, j, k) of glyph pixel and glyph index; oc outline colour; nvis typewriter count
  function text(s, x, y, c, sc, oc, nvis, shake) {
    sc = sc || 1; let cx = x, k = 0;
    for (const ch of s.toUpperCase()) {
      if (nvis !== undefined && k >= nvis) break;
      const g = FONT[ch] || FONT[' '], gw = g[0].length;
      const jx = shake ? Math.round((ih(k, fl(shake * 30), 77) - 0.5) * 2) : 0, jy = shake ? Math.round((ih(k, fl(shake * 30), 78) - 0.5) * 2) : 0;
      if (oc !== undefined) { const ow = sc > 2 ? Math.max(1, Math.round(sc * 0.5)) : 1; for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) if (g[j][i] === '#') rectF(cx + i * sc - ow + jx, y + j * sc - ow + jy, sc + ow * 2, sc + ow * 2, oc); }
      for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) if (g[j][i] === '#') { const cc = typeof c === 'function' ? c(i, j, k) : c; if (cc >= 0) rectF(cx + i * sc + jx, y + j * sc + jy, sc, sc, cc); }
      cx += (gw + 1) * sc; k++;
    }
  }

  // dialogue (from the voice pass): each line's start, length, text and mouth envelope at 30 fps
  function lineOf(who, t) { for (const l of DLG) if (l.who === who && t >= l.t0 && t < l.t0 + l.dur) return l; return null; }
  function mouth(who, t) { const l = lineOf(who, t); if (!l) return 0; const f = fl((t - l.t0) * 30), e = l.env; if (f < 0 || f >= e.length) return 0; return clamp((e.charCodeAt(f) - 48) / 9, 0, 1); }
  const talking = (who, t) => mouth(who, t) > 0.05;
  const blink = (t, seed) => frac(t / (2.6 + ih(seed, 1, 9) * 1.8) + ih(seed, 2, 9)) < 0.05;
  const LB = 22;
  const CAPCOL = { sable: C('ember', 6), sable_vo: C('ember', 6), mira: C('gold', 6), king: C('hush', 5), oren: C('indigo', 6), warden: C('indigo', 6), kaira: C('gold', 6), tamo: C('teal', 6), docker: C('wood', 6), bellwether: C('gold', 4), vesper: C('violet', 6) };
  const CAPNAME = { sable: 'SABLE', sable_vo: '', mira: 'MIRA', king: '???', oren: 'OREN', warden: 'WARDEN', kaira: 'KAIRA', tamo: 'TAMO', docker: 'DOCKHAND', bellwether: 'THE BELLWETHER', vesper: '???' };
  function captions(t) {
    for (const l of DLG) {
      if (t < l.t0 - 0.05 || t >= l.t0 + l.dur + 0.35) continue;
      const s = l.text.replace(/\[[a-z]+\]\s*/g, '').toUpperCase(), name = CAPNAME[l.who], y = H - LB + 8;
      if (l.who === 'sable_vo') { const w = textWidth(s, 1); text(s, 240 - w / 2, y, C('linen', 6), 1); continue; }
      const tag = name + ':', tw = textWidth(tag, 1), w = tw + 5 + textWidth(s, 1);
      if (w <= 456) { const x0 = 240 - w / 2; text(tag, x0, y, CAPCOL[l.who], 1); text(s, x0 + tw + 5, y, C('hush', 6), 1); continue; }
      let br = -1; for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (br < 0 || Math.abs(i - s.length / 2) < Math.abs(br - s.length / 2))) br = i;
      const a = s.slice(0, br), b = s.slice(br + 1), wa = tw + 5 + textWidth(a, 1), wb = textWidth(b, 1), x0 = 240 - Math.max(wa, wb) / 2;
      text(tag, x0, H - LB + 3, CAPCOL[l.who], 1); text(a, x0 + tw + 5, H - LB + 3, C('hush', 6), 1); text(b, x0 + tw + 5, H - LB + 12, C('hush', 6), 1);
    }
  }
  const SHOTS = [];
  const shot = (t0, t1, fn, opt) => SHOTS.push(Object.assign({ t0, t1, fn }, opt || {}));
  let SHAKE_A = 0, SHX = 0, SHY = 0, T_NOW = 0;
  const shk = (a) => { SHAKE_A = Math.max(SHAKE_A, a); };
  const D = 300;
  function render(t) {
    t = clamp(t, 0, D - 1 / FPS); T_NOW = t; SHAKE_A = 0; BUF.fill(BLACK);
    LIGHT.x = -0.6; LIGHT.y = -0.8; ENV.edge = null; CAM.x = 0; CAM.y = 0; LAMPS.length = 0;
    let S = null; for (const s of SHOTS) if (t >= s.t0 && t < s.t1) S = s;
    if (S) S.fn(t - S.t0, t, S.t1 - S.t0);
    if (!S || !S.nobars) letterbox(LB);
    if (!S || !S.nocaps) captions(t);
    const f = fl(t * FPS); SHX = Math.round((ih(f, 1, 901) - 0.5) * 2 * SHAKE_A); SHY = Math.round((ih(f, 2, 901) - 0.5) * 2 * SHAKE_A);
  }
  const fade = (a) => { if (a > 0) tintAll(tab('#000000'), Math.min(1, a)); };
  const flash = (a) => { if (a > 0) tintAll(tab('#ffffff', true), Math.min(1, a)); };
