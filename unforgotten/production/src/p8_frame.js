  /* ================================================================ the cut: shots, captions, lip sync, frame */
  const LB = 22;
  const SHOTS = [];
  const shot = (t0, t1, fn, opt) => SHOTS.push(Object.assign({ t0, t1, fn }, opt || {}));
  // dialogue: DLG (from the voice pass) holds each line's start, length, text and a mouth envelope at 30 fps
  function lineOf(who, t) { for (const l of DLG) if (l.who === who && t >= l.t0 && t < l.t0 + l.dur) return l; return null; }
  function mouth(who, t) {
    const l = lineOf(who, t); if (!l) return 0;
    const f = fl((t - l.t0) * 30), e = l.env; if (f < 0 || f >= e.length) return 0;
    return clamp((e.charCodeAt(f) - 48) / 9, 0, 1);
  }
  const talking = (who, t) => mouth(who, t) > 0.05;
  const CAPCOL = { sable: C('ember', 6), sable_vo: C('ember', 6), mira: C('gold', 6), king: C('hush', 5), oren: C('indigo', 6), warden: C('indigo', 6), kaira: C('gold', 6), tamo: C('teal', 6), docker: C('wood', 6), bellwether: C('gold', 4), vesper: C('violet', 6) };
  const CAPNAME = { sable: 'SABLE', sable_vo: '', mira: 'MIRA', king: '???', oren: 'OREN', warden: 'WARDEN', kaira: 'KAIRA', tamo: 'TAMO', docker: 'DOCKHAND', bellwether: 'THE BELLWETHER', vesper: '???' };
  function captions(t) {
    for (const l of DLG) {
      if (t < l.t0 - 0.05 || t >= l.t0 + l.dur + 0.35) continue;
      const s = l.text.replace(/\[[a-z]+\]\s*/g, '').toUpperCase(), name = CAPNAME[l.who], y = H - LB + 8;
      if (l.who === 'sable_vo') { const w = textWidth(s, 1); text(s, 240 - w / 2, y, C('linen', 6), 1); continue; }
      const tag = name + ':', tw = textWidth(tag, 1), w = tw + 5 + textWidth(s, 1);
      if (w <= 456) { const x0 = 240 - w / 2; text(tag, x0, y, CAPCOL[l.who], 1); text(s, x0 + tw + 5, y, C('hush', 5), 1); continue; }
      // too long for one line: break at the space nearest the middle and stack two lines in the bar
      let br = -1; for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (br < 0 || Math.abs(i - s.length / 2) < Math.abs(br - s.length / 2))) br = i;
      const a = s.slice(0, br), b = s.slice(br + 1), wa = tw + 5 + textWidth(a, 1), wb = textWidth(b, 1), x0 = 240 - Math.max(wa, wb) / 2;
      text(tag, x0, H - LB + 3, CAPCOL[l.who], 1); text(a, x0 + tw + 5, H - LB + 3, C('hush', 5), 1); text(b, x0 + tw + 5, H - LB + 12, C('hush', 5), 1);
    }
  }
  // cards: on-screen titles in the picture area
  const CARDS = [];
  let SHX = 0, SHY = 0;
  function render(t) {
    t = clamp(t, 0, D - 1 / FPS);
    T_NOW = t; SHAKE_A = 0; BUF.fill(BLACK); beginWorld();
    let S = SHOTS[0]; for (const s of SHOTS) if (t >= s.t0) S = s;
    S.fn(t - S.t0, t, S.t1 - S.t0);
    // whip pans between shots that ask for one
    for (const s of SHOTS) if (s.whip !== undefined) { const d = Math.abs(t - s.t0); if (d < 0.1) whip(80 * (1 - d / 0.1), s.whip); }
    if (!S.nobars) letterbox(LB);
    for (const s of SHOTS) if (s.flash && t >= s.t0 && t < s.t0 + 0.067) tintAll(T_WH, 0.55);
    if (!S.nocaps) captions(t);
    const f = fl(t * FPS);
    SHX = Math.round((ih(f, 1, 901) - 0.5) * 2 * SHAKE_A); SHY = Math.round((ih(f, 2, 901) - 0.5) * 2 * SHAKE_A);
  }

