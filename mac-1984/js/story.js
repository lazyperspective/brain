// "What if Steve Jobs had ChatGPT in 1984?" — the whole film as a pure function of t: timeline, typing, transcript,
// cursor (human + AI tracks), menus, Finder, MacPaint, dialogs, camera and sound cues.
(function (G) {
  const { E, seg, sat, lerp, hash, rng, clamp, R, H, V, frame, P, B, W } = K;
  const SW = MAC.SW, SH = MAC.SH;
  FONT.init(); ICONS.init();
  const CUES = [];
  const MANUFACTURING = [
    '1. Invent multi-touch glass.', '2. Invent the lithium-ion battery.', '3. Shrink 9,000 Macintoshes onto one chip.',
    '4. Build a cellular network (start with 1G).', '5. Launch 24 GPS satellites.', '6. Finish inventing the internet.',
    '7. Negotiate with AT&T.', '8. Hire a young designer named Jony.', '9. Write 2,000,000 apps.',
    '10. Order 40,000,000 tiny screws.', '11. Design white headphones.', '12. Remove headphone jack (later).',
    '13. Build a factory the size of a city.', '14. Charge $499.', '15. Keynote: "One more thing..."',
    '16. Invent the camera that fits in glass.', '17. Make it waterproof (optional).', '18. Wait 23 years.',
  ];
  const cue = (t, s, o = {}) => CUES.push(Object.assign({ t: +t.toFixed(4), s }, o));

  // =====================================================================================
  // CURSOR TRACK (screen coords). Segments {t0,t1,f(u)}; human moves ease with overshoot.
  const SEGS = [];
  let curPos = [256, 171];
  function mv(t0, dur, x, y, o = {}) {
    const a = curPos.slice(), b = [x, y], over = o.over == null ? 0.05 : o.over, arc = o.arc == null ? 0.07 : o.arc;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    SEGS.push({ t0, t1: t0 + dur, human: true, f(u) {
      let k; if (u < 0.74) k = E.outQuint(u / 0.74) * (1 + over); else k = 1 + over * (1 - E.inOut((u - 0.74) / 0.26));
      const side = Math.sin(Math.min(1, u / 0.74) * Math.PI) * arc * L;
      return [a[0] + dx * k - (dy / L) * side, a[1] + dy * k + (dx / L) * side];
    } });
    curPos = b.slice();
    return t0 + dur;
  }
  function addTrack(tr) { for (const s of tr.segs) SEGS.push(s); if (tr.endCur) curPos = tr.endCur.slice(); }
  function cursorAt(t) { let p = curPos0; for (const s of SEGS) { if (t < s.t0) continue; p = s.f(t >= s.t1 ? 1 : (t - s.t0) / (s.t1 - s.t0)); } return [Math.round(p[0]), Math.round(p[1])]; }
  const curPos0 = [256, 171];
  const HIDE = []; // [t0, t1) cursor obscured while typing
  const WATCH = []; // [t0, t1) watch cursor
  function click(t, o = {}) { cue(t, 'mdown', o); cue(t + (o.hold || 0.085), 'mup', o); }

  // =====================================================================================
  // TYPING
  function steveTyper(script, t0, seed, kk = 0.92) {
    const r = rng(seed), keys = []; let t = t0, prev = '';
    for (let i = 0; i < script.length; i++) {
      const ch = script[i];
      if (ch === '{') { const j = script.indexOf('}', i); t += parseFloat(script.slice(i + 1, j)); i = j; continue; }
      let d = 0.062 + r() * 0.045;
      if (ch === ' ') d += 0.012 + r() * 0.02;
      if (/[A-Z]/.test(ch)) d += 0.05 + r() * 0.04;              // shift key, deliberate
      if (/[.,?]/.test(ch)) d += 0.03;
      if (prev === ' ' && r() < 0.14) d += 0.08 + r() * 0.08;    // occasional hesitation before a word
      if (/[.?]/.test(prev)) d += 0.18 + r() * 0.1;                // pause after a sentence
      if (ch === '\n') d = 0.24 + r() * 0.06;
      t += d * kk; keys.push({ t, ch }); prev = ch;
      cue(t, 'key', { k: ch === ' ' ? 'space' : ch === '\n' ? 'enter' : /[A-Z?]/.test(ch) ? 'shift' : 'key', seed: seed * 100 + i });
    }
    return { keys, t0, end: t, textAt(tt) { let s = ''; for (const k of keys) { if (k.t > tt) break; if (k.ch !== '\n') s += k.ch; } return s; }, first: keys[0].t };
  }
  // ChatGPT streams text in token-sized chunks, much faster than a human
  function gptStream(text, t0, o = {}) {
    const r = rng(o.seed || 11), marks = []; let t = t0, i = 0; const dt = o.dt || 0.03;
    while (i < text.length) { const n = 1 + Math.floor(r() * 4); i = Math.min(text.length, i + n); t += dt * (0.6 + r() * 0.8); marks.push({ t, n: i }); }
    return { text, t0, end: t, textAt(tt) { if (tt < t0) return null; let n = 0; for (const m of marks) { if (m.t > tt) break; n = m.n; } return text.slice(0, n); } };
  }

  // =====================================================================================
  // LAYOUT
  const CHATW = { x: 150, y: 244, w: 358, h: 94 };
  const CHAT0 = { x: 77, y: 132, w: 358, h: 94 };   // where the app first opens its window (before MacPaint)
  const CHAT_TEXT = { x: 155, y: 266, w: 330, lh: 14, lines: 5 };
  const ICON_DISK = [452, 26], ICON_CHAT = [212, 132], ICON_TRASH = [456, 288];
  const FINDER_MENUS = ['@', 'File', 'Edit', 'View', 'Special'];
  const CHAT_MENUS = ['@', 'File', 'Edit', 'Chat'];
  const SPECIAL_ITEMS = ['Clean Up', 'Empty Trash', '-', 'Erase Disk', 'Set Startup'];
  const PFILE_ITEMS = ['New', 'Open...', '-', 'Close', 'Save', 'Save As...', 'Revert', '-', 'Print Draft', 'Print Final', 'Print Catalog', '-', 'Quit|⌘Q'];

  // =====================================================================================
  // TIMELINE
  const T = {};
  const MSG = []; // transcript: {who, src (typer|stream), show}
  const DRAW = []; // MacPaint tracks
  const CAM = [];
  const cam = (t, dur, cx, cy, z, ease) => CAM.push({ t, dur, to: { cx, cy, z }, ease: ease || E.inOut });

  // ---- boot ----
  T.power = 0.15; T.on = 0.32; T.happy = 0.95; T.welcome = 1.8; T.finder = 2.95;
  cue(T.power, 'power'); cue(T.on, 'boot'); cue(T.on + 0.05, 'crt');
  cue(T.happy - 0.35, 'floppy', { dur: T.finder - T.happy + 0.9, mode: 'boot', seed: 1 });
  T.icons = T.finder + 0.35; T.curOn = T.finder + 0.42;

  // ---- open ChatGPT ----
  let t = T.curOn + 0.2;
  t = mv(t, 0.85, ICON_CHAT[0] + 15, ICON_CHAT[1] + 14, { over: 0.06, arc: 0.08 });
  T.click1 = t + 0.25; click(T.click1); T.dbl = T.click1 + 0.2; click(T.dbl);
  T.zoom = T.dbl + 0.05; T.appClear = T.zoom + 0.33;
  WATCH.push([T.dbl + 0.1, 0]); const wLaunch = WATCH.length - 1;
  cue(T.dbl + 0.15, 'floppy', { dur: 1.3, mode: 'launch', seed: 2 });
  T.app = T.appClear + 0.85; WATCH[wLaunch][1] = T.app + 0.15;
  T.chatWin = T.app + 0.12;

  // ---- greeting + first prompt ----
  const G1 = gptStream('Hello Steve. What would you like to create today?', T.chatWin + 0.35, { seed: 3 });
  MSG.push({ who: 'ChatGPT', src: G1, show: G1.t0 });
  T.prompt1 = G1.end + 0.15;
  const S1 = steveTyper('Design the computer of the future.\n', G1.end + 0.9, 7);
  MSG.push({ who: 'Steve', src: S1, show: T.prompt1, human: true });
  HIDE.push([S1.first, 1e9]);

  // ---- ChatGPT thinks, opens MacPaint, draws ----
  T.think1 = S1.end + 0.1; WATCH.push([T.think1, T.think1 + 0.75]); cue(T.think1, 'floppy', { dur: 0.7, mode: 'think', seed: 3 });
  const G2 = gptStream('Opening MacPaint...', T.think1 + 0.6, { seed: 4, dt: 0.03 });
  MSG.push({ who: 'ChatGPT', src: G2, show: G2.t0 });
  T.paintLaunch = G2.end + 0.25; WATCH.push([T.paintLaunch, T.paintLaunch + 1.05]);
  cue(T.paintLaunch, 'floppy', { dur: 1.1, mode: 'launch', seed: 5 });
  T.paint = T.paintLaunch + 0.55; T.paintReady = T.paint + 0.5;
  // AI cursor reappears (the AI drives it): starts from wherever the mouse was
  let D = PAINT.builder(T.paintReady + 0.15, curPos, { tool: 'pencil', pat: 'black' });
  D.speed(2.35); ART.phoneV1(D); const TR1 = D.done(); DRAW.push(TR1); addTrack(TR1);
  HIDE[HIDE.length - 1][1] = T.paintReady + 0.15;
  T.v1done = TR1.end;
  seeks(T.paintReady + 0.3, TR1.end, 6);

  // ---- explanation ----
  const G3 = gptStream('A computer that fits in your pocket. No keyboard. No mouse. Just a touchscreen.', T.v1done + 0.35, { seed: 5 });
  MSG.push({ who: 'ChatGPT', src: G3, show: G3.t0 });
  const S2 = steveTyper('Interesting.{0.35} Make it thinner.\n', G3.end + 1.45, 8);
  MSG.push({ who: 'Steve', src: S2, show: G3.end + 0.15, human: true });
  HIDE.push([S2.first, 0]);
  D = PAINT.builder(S2.end + 0.35, curPos, { tool: TR1.toolAt(1e9), pat: TR1.patAt(1e9) });
  D.speed(2.4); ART.thinner1(D); const TR2 = D.done(); DRAW.push(TR2); addTrack(TR2); HIDE[HIDE.length - 1][1] = S2.end + 0.35;
  seeks(S2.end + 0.3, TR2.end, 9);
  T.thin1 = S2.end + 0.35;
  const S3 = steveTyper('Thinner.\n', TR2.end + 0.6, 9);
  MSG.push({ who: 'Steve', src: S3, show: TR2.end + 0.05, human: true });
  HIDE.push([S3.first, 0]);
  D = PAINT.builder(S3.end + 0.3, curPos, { tool: TR2.toolAt(1e9), pat: TR2.patAt(1e9) });
  D.speed(3.0); ART.thinner2(D); const TR3 = D.done(); DRAW.push(TR3); addTrack(TR3); HIDE[HIDE.length - 1][1] = S3.end + 0.3;
  T.thin2 = S3.end + 0.3;

  // ---- remove everything ----
  const S4 = steveTyper('Remove all the ports.{0.25} Remove the buttons.{0.35} Remove everything unnecessary.\n', TR3.end + 0.7, 10, 0.72);
  MSG.push({ who: 'Steve', src: S4, show: TR3.end + 0.05, human: true });
  HIDE.push([S4.first, 0]);
  D = PAINT.builder(S4.end + 0.35, curPos, { tool: TR3.toolAt(1e9), pat: TR3.patAt(1e9) });
  D.speed(2.3); ART.strip(D); const TR4 = D.done(); DRAW.push(TR4); addTrack(TR4); HIDE[HIDE.length - 1][1] = S4.end + 0.35;
  seeks(S4.end + 0.3, TR4.end, 11);
  T.strip = S4.end + 0.35;

  // ---- "Done. ..." + OS sketches ----
  const G4 = gptStream("Done. I've also designed its operating system, app ecosystem, and a wireless internet network.", TR4.end + 0.3, { seed: 6 });
  MSG.push({ who: 'ChatGPT', src: G4, show: G4.t0 });
  D = PAINT.builder(G4.end + 0.1, curPos, { tool: TR4.toolAt(1e9), pat: TR4.patAt(1e9) });
  D.speed(4.0); ART.os(D); const TR5 = D.done(); DRAW.push(TR5); addTrack(TR5);
  seeks(G4.end, TR5.end, 12);
  T.os = G4.end + 0.1;

  // ---- naming ----
  const S5 = steveTyper('Perfect.{0.3} What should we call it?\n', TR5.end + 0.6, 12);
  MSG.push({ who: 'Steve', src: S5, show: TR5.end + 0.1, human: true });
  HIDE.push([S5.first, 0]);
  T.think2 = S5.end + 0.1; WATCH.push([T.think2, T.think2 + 0.5]); cue(T.think2, 'floppy', { dur: 0.45, mode: 'think', seed: 13 });
  const G5 = gptStream('iPhone.', T.think2 + 0.55, { seed: 7, dt: 0.05 });
  MSG.push({ who: 'ChatGPT', src: G5, show: G5.t0 });
  D = PAINT.builder(G5.end + 1.25, curPos, { tool: TR5.toolAt(1e9), pat: TR5.patAt(1e9) });
  D.speed(1.4); ART.name(D); const TR6 = D.done(); DRAW.push(TR6); addTrack(TR6); HIDE[HIDE.length - 1][1] = G5.end + 1.25;
  T.name = G5.t0;
  const S6 = steveTyper('Excellent.{0.3} Build it.\n', TR6.end + 0.65, 14);
  MSG.push({ who: 'Steve', src: S6, show: G5.end + 0.1, human: true });
  HIDE.push([S6.first, 0]);

  // ---- build: manufacturing instructions, progress bar, the bomb ----
  T.think3 = S6.end + 0.1; WATCH.push([T.think3, 0]); const wBuild = WATCH.length - 1;
  const STEPS = MANUFACTURING;
  const G6 = gptStream('Generating manufacturing instructions...\n' + STEPS.join('\n'), T.think3 + 0.35, { seed: 8, dt: 0.0056 });
  MSG.push({ who: 'ChatGPT', src: G6, show: G6.t0 });
  cue(T.think3, 'floppy', { dur: G6.end - T.think3 + 1.6, mode: 'grind', seed: 14 });
  T.prog = G6.end + 0.15; T.prog99 = T.prog + 0.95; T.bomb = T.prog99 + 0.6;
  WATCH[wBuild][1] = T.bomb;
  cue(T.bomb, 'beep');
  HIDE[HIDE.length - 1][1] = T.bomb + 1.35;
  // Steve reads, then clicks OK
  const OKB = { x: 330, y: 182, w: 60, h: 20 };
  t = mv(T.bomb + 1.25, 0.7, OKB.x + 30, OKB.y + 11, { over: 0.05, arc: 0.06 });
  T.ok = t + 0.3; click(T.ok); T.okUp = T.ok + 0.1;

  // ---- "a better computer" ----
  const G7 = gptStream('Would you like me to design a better computer first?', T.okUp + 0.45, { seed: 9 });
  MSG.push({ who: 'ChatGPT', src: G7, show: G7.t0 });
  const S7 = steveTyper('Yes.\n', G7.end + 1.05, 15);
  MSG.push({ who: 'Steve', src: S7, show: G7.end + 0.1, human: true });
  HIDE.push([S7.first, 0]);
  D = PAINT.builder(S7.end + 0.4, curPos, { tool: TR6.toolAt(1e9), pat: TR6.patAt(1e9) });
  D.speed(3.3); ART.pc(D); const TR7 = D.done(); DRAW.push(TR7); addTrack(TR7); HIDE[HIDE.length - 1][1] = S7.end + 0.4;
  seeks(S7.end + 0.4, TR7.end, 16);
  T.pc = S7.end + 0.4; T.pcDone = TR7.end;

  // ---- Steve quits, drags ChatGPT to the Trash, empties it ----
  const ML = MAC.menuLayout(PAINT.MENUS);
  t = mv(T.pcDone + 1.3, 0.7, ML[1].tx + 10, 9, { over: 0.04, arc: -0.06 });
  T.fileDown = t + 0.15; cue(T.fileDown, 'mdown');
  const PG = MAC.menuGeom(PAINT.MENUS, 1, PFILE_ITEMS);
  const quitRow = PG.rows[PFILE_ITEMS.length - 1];
  t = mv(T.fileDown + 0.1, 0.55, ML[1].tx + 24, PG.y + quitRow.y + 8, { over: 0.0, arc: 0.03 });
  T.fileUp = t + 0.15; cue(T.fileUp, 'mup');
  T.quitBlink = T.fileUp; T.quit = T.fileUp + 0.2;
  WATCH.push([T.quit, 0]); const wQuit = WATCH.length - 1;
  cue(T.quit + 0.05, 'floppy', { dur: 1.05, mode: 'launch', seed: 17 });
  T.finder2 = T.quit + 0.8; WATCH[wQuit][1] = T.finder2 + 0.25;
  t = mv(T.finder2 + 0.2, 0.6, ICON_CHAT[0] + 16, ICON_CHAT[1] + 12, { over: 0.05, arc: 0.07 });
  T.grab = t + 0.2; cue(T.grab, 'mdown');
  const grabOff = [ICON_CHAT[0] + 16 - ICON_CHAT[0], ICON_CHAT[1] + 12 - ICON_CHAT[1]];
  t = mv(T.grab + 0.1, 1.15, ICON_TRASH[0] + 16, ICON_TRASH[1] + 14, { over: 0.02, arc: -0.05 });
  T.drop = t + 0.25; cue(T.drop, 'mup');
  t = mv(T.drop + 0.35, 0.6, MAC.menuLayout(FINDER_MENUS)[4].tx + 18, 9, { over: 0.04, arc: 0.06 });
  T.specDown = t + 0.15; cue(T.specDown, 'mdown');
  const SG = MAC.menuGeom(FINDER_MENUS, 4, SPECIAL_ITEMS);
  t = mv(T.specDown + 0.1, 0.35, MAC.menuLayout(FINDER_MENUS)[4].tx + 26, SG.y + SG.rows[1].y + 8, { over: 0, arc: 0.04 });
  T.specUp = t + 0.22; cue(T.specUp, 'mup');
  T.empty = T.specUp + 0.2; cue(T.empty, 'floppy', { dur: 0.5, mode: 'think', seed: 19 });
  cue(T.empty + 0.12, 'crunch');
  T.black = T.empty + 0.42;
  const DUR = T.black + 1.05;

  function seeks(t0, t1, seed) { const r = rng(seed); let tt = t0 + 0.3 + r() * 0.6; while (tt < t1 - 0.2) { cue(tt, 'floppy', { dur: 0.25 + r() * 0.35, mode: 'seek', seed: seed * 10 + Math.floor(tt * 10) }); tt += 0.55 + r() * 0.8; } }

  // =====================================================================================
  // CAMERA (cx, cy in screen px; z = zoom relative to the 456x342 full-height view)
  {
    const chatCam = [321, 260, 1.36];
    const drawCam = [150, 128, 1.45];
    cam(0, 0.01, 256, 171, 1.35);
    cam(T.happy - 0.2, 1.4, 256, 168, 1.6, E.smooth);
    cam(T.welcome + 0.1, 1.0, 256, 168, 1.5, E.smooth);
    cam(T.finder - 0.05, 0.9, 256, 171, 1.0);
    cam(T.curOn + 0.3, 1.2, 228, 150, 1.32);
    cam(T.zoom + 0.05, 0.6, 256, 171, 1.0);
    cam(T.chatWin + 0.15, 0.9, 256, 180, 1.24);
    cam(S1.first - 0.4, 2.2, 244, 181, 1.42, E.smooth);
    cam(T.paint - 0.1, 0.7, 256, 171, 1.0);
    cam(T.paintReady + 0.2, 1.2, drawCam[0], drawCam[1], drawCam[2]);
    cam(TR1.t0 + 3.2, 1.6, 168, 120, 1.7, E.smooth);
    cam(G3.t0 - 0.15, 0.75, chatCam[0], chatCam[1], chatCam[2]);
    cam(T.thin1 - 0.25, 0.7, 236, 112, 2.0);
    cam(S3.first - 0.6, 0.6, 282, 300, 1.75);
    cam(T.thin2 - 0.15, 0.5, 248, 104, 2.5);
    cam(S4.first - 0.7, 0.7, chatCam[0], chatCam[1], chatCam[2]);
    cam(T.strip - 0.2, 0.75, 186, 130, 1.55);
    cam(TR4.end - 0.6, 1.0, 196, 128, 1.75, E.smooth);
    cam(G4.t0 - 0.05, 0.7, chatCam[0], chatCam[1], chatCam[2]);
    cam(G4.end + 0.05, 0.8, 270, 124, 1.45);
    cam(TR5.t0 + 1.6, 1.5, 200, 124, 2.15, E.smooth);
    cam(S5.first - 0.6, 0.7, chatCam[0], chatCam[1], chatCam[2]);
    cam(G5.t0 - 0.1, 0.5, 250, 300, 2.3);
    cam(G5.end + 0.95, 0.5, 290, 160, 1.35);
    cam(G5.end + 1.42, 0.6, 326, 76, 2.1);
    cam(S6.first - 0.45, 0.6, chatCam[0], chatCam[1], chatCam[2]);
    cam(G6.t0 + 0.6, 0.6, chatCam[0], chatCam[1], chatCam[2]);
    cam(T.prog - 0.15, 0.6, 256, 160, 1.45);
    cam(T.bomb - 0.05, 0.35, 256, 156, 1.36);
    cam(T.ok + 0.1, 0.7, chatCam[0], chatCam[1], chatCam[2]);
    cam(G7.end + 0.35, 0.8, 282, 300, 1.7);
    cam(T.pc - 0.15, 0.8, 196, 120, 1.5);
    cam(T.pc + 1.6, 2.2, 252, 146, 1.6, E.smooth);
    cam(T.pcDone + 1.0, 0.8, 212, 160, 1.2);
    cam(T.quit, 0.8, 256, 171, 1.0);
    cam(T.finder2 + 0.4, 1.0, 300, 200, 1.18);
    cam(T.drop + 0.2, 0.8, 330, 171, 1.08);
  }
  function camEval(t, upto) {
    let k = -1; for (let i = 0; i < upto; i++) if (CAM[i].t <= t) k = i;
    if (k < 0) return { cx: 256, cy: 171, z: 1 };
    const c = CAM[k]; if (!c.from) c.from = camEval(c.t, k);
    const u = c.ease(sat((t - c.t) / c.dur));
    return { cx: lerp(c.from.cx, c.to.cx, u), cy: lerp(c.from.cy, c.to.cy, u), z: Math.exp(lerp(Math.log(c.from.z), Math.log(c.to.z), u)) };
  }

  // =====================================================================================
  // DOCUMENT
  const DOC = PAINT.makeDoc(DRAW);

  // =====================================================================================
  // DRAW HELPERS
  function transcriptLines(t) {
    const lines = []; let caret = null;
    const msgs = MSG.filter((m) => t >= m.show);
    msgs.forEach((m, mi) => {
      let txt = m.src.textAt(t); if (txt == null) txt = '';
      const label = m.who + ':'; const lw = FONT.measure(label, 'chicago') + 5;
      const paras = txt.split('\n');
      let first = true;
      paras.forEach((p, pi) => {
        const words = p.split(' '); let line = ''; const maxW = () => CHAT_TEXT.w - (first ? lw : 0);
        const push = () => { lines.push({ label: first ? label : null, ind: first ? lw : 0, s: line }); first = false; line = ''; };
        for (const w of words) { const cand = line ? line + ' ' + w : w; if (FONT.measure(cand, 'g12') > maxW() && line) { push(); line = w; } else line = cand; }
        push();
      });
      if (m.human && mi === msgs.length - 1) caret = lines.length - 1;
    });
    return { lines, caret };
  }
  function drawChat(ctx, t, active = true, W0 = CHATW) {
    const dx = W0.x - CHATW.x, dy = W0.y - CHATW.y;
    if (dx || dy) { ctx.save(); ctx.translate(dx, dy); }
    const c = MAC.window(ctx, { x: CHATW.x, y: CHATW.y, w: CHATW.w, h: CHATW.h, title: 'ChatGPT', active, scroll: { thumb: null }, grow: true });
    const { lines, caret } = transcriptLines(t);
    const N = CHAT_TEXT.lines, top = Math.max(0, lines.length - N);
    // scroll bar state
    if (lines.length > N) MAC.scrollV(ctx, CHATW.x + CHATW.w - 16, CHATW.y + 18, CHATW.h - 18 - 15, 1, true);
    else { MAC.scrollV(ctx, CHATW.x + CHATW.w - 16, CHATW.y + 18, CHATW.h - 18 - 15, null, true); R(ctx, CHATW.x + CHATW.w - 15, CHATW.y + 35, 15, CHATW.h - 18 - 15 - 34, W); }
    ctx.save(); ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
    for (let i = top; i < lines.length; i++) {
      const L = lines[i], y = CHAT_TEXT.y + (i - top) * CHAT_TEXT.lh;
      if (L.label) FONT.text(ctx, L.label, CHAT_TEXT.x, y, 'chicago');
      const w = FONT.text(ctx, L.s, CHAT_TEXT.x + L.ind, y, 'g12');
      if (i === caret) {
        // insertion caret blinks (~0.53 s) while idle; solid while keys are being pressed
        const blinkOn = Math.floor(t / 0.53) % 2 === 0;
        const last = MSG.filter((m) => m.human && t >= m.show).slice(-1)[0];
        const typing = last && last.src.keys.some((k) => k.t <= t && t - k.t < 0.5);
        const done = last && t >= last.src.end;
        if (!done && (typing || blinkOn)) R(ctx, CHAT_TEXT.x + L.ind + (L.s ? w + 1 : 0), y - 2, 1, 13, B);
      }
    }
    ctx.restore();
    if (dx || dy) ctx.restore();
  }
  function finder(ctx, t, st) {
    MAC.desktop(ctx);
    const hi = st.menuHi == null ? -1 : st.menuHi;
    if (st.bareMenu) { R(ctx, 0, 0, SW, 19, W); H(ctx, 0, 19, SW, B); }
    else MAC.menubar(ctx, FINDER_MENUS, hi);
    if (st.icons) {
      if (st.disk) MAC.icon(ctx, ICONS.ICON.disk, ICON_DISK[0], ICON_DISK[1], 'System Disk');
      if (st.trash) MAC.icon(ctx, st.trashFull ? ICONS.ICON.trashFull : ICONS.ICON.trash, ICON_TRASH[0], ICON_TRASH[1], 'Trash', { sel: st.trashSel });
      if (st.chat !== false) MAC.icon(ctx, ICONS.ICON.chat, ICON_CHAT[0], ICON_CHAT[1], 'ChatGPT', { sel: st.chatSel });
    }
  }
  function progress(ctx, t) {
    const x = 126, y = 118, w = 260, h = 84;
    MAC.dialogBox(ctx, x, y, w, h);
    FONT.text(ctx, 'Building iPhone...', x + 20, y + 16, 'chicago');
    const u = sat((t - T.prog) / (T.prog99 - T.prog)); const p = Math.floor(E.out2(u) * 99);
    const bx = x + 20, by = y + 40, bw = w - 40, bh = 14;
    frame(ctx, bx, by, bw, bh, B); R(ctx, bx + 1, by + 1, Math.round((bw - 2) * p / 100), bh - 2, B);
    const s = p + '%'; FONT.text(ctx, s, x + w - 20 - FONT.measure(s, 'chicago'), y + 62, 'chicago');
    FONT.text(ctx, 'Units: 1', x + 20, y + 62, 'chicago');
  }
  function bomb(ctx, t) {
    const x = 96, y = 98, w = 320, h = 116;
    MAC.dialogBox(ctx, x, y, w, h);
    ICONS.ICON.bomb.draw(ctx, x + 18, y + 18);
    FONT.text(ctx, 'Not enough memory.', x + 64, y + 20, 'chicago');
    FONT.text(ctx, '127 KB available.', x + 64, y + 40, 'chicago');
    FONT.text(ctx, '8 GB required.', x + 64, y + 56, 'chicago');
    MAC.button(ctx, OKB.x, OKB.y, OKB.w, OKB.h, 'OK', { def: true, down: t >= T.ok && t < T.okUp + 0.02 });
  }
  function inRect(p, r) { return p[0] >= r.x && p[0] < r.x + r.w && p[1] >= r.y && p[1] < r.y + r.h; }

  // =====================================================================================
  // DRAW
  function draw(ctx, t) {
    if (t < T.on || t >= T.black) { R(ctx, 0, 0, SW, SH, B); return; }
    const p = cursorAt(t);
    let showCursor = t >= T.curOn, kind = 'arrow';
    if (t < T.finder) {
      MAC.desktop(ctx);
      if (t >= T.happy && t < T.welcome) MAC.happy(ctx);
      if (t >= T.welcome) MAC.welcome(ctx);
      MAC.corners(ctx); return;
    }
    if (t < T.appClear) {
      // ---------- Finder (first visit) ----------
      finder(ctx, t, { bareMenu: t < T.finder + 0.2, icons: t >= T.icons, disk: true, trash: t >= T.icons + 0.08, chat: t >= T.icons + 0.16, chatSel: t >= T.click1 });
      if (t >= T.zoom) MAC.zoomRects(ctx, { x: ICON_CHAT[0], y: ICON_CHAT[1], w: 32, h: 32 }, { x: 2, y: 22, w: 508, h: 318 }, sat((t - T.zoom) / (T.appClear - T.zoom)));
    } else if (t < T.paint) {
      // ---------- ChatGPT app (launching, then running) ----------
      MAC.desktop(ctx);
      if (t < T.app) { R(ctx, 0, 0, SW, 19, W); H(ctx, 0, 19, SW, B); }
      else MAC.menubar(ctx, CHAT_MENUS);
      if (t >= T.chatWin) drawChat(ctx, t, true, CHAT0);
      if (t >= T.paintLaunch) { R(ctx, 0, 0, SW, 19, W); H(ctx, 0, 19, SW, B); }
    } else if (t < T.quit + 0.3) {
      // ---------- MacPaint (with the ChatGPT window floating over it) ----------
      const tool = DRAW.reduce((v, tr) => tr.toolAt(t, v), 'pencil');
      const pat = DRAW.reduce((v, tr) => tr.patAt(t, v), 'black');
      const menuHi = t >= T.fileDown && t < T.quit ? 1 : -1;
      if (t < T.quit) {
        PAINT.drawUI(ctx, { tool, pat, menuHi, title: 'untitled' });
        if (t >= T.paintReady) {
          PAINT.blit(ctx, DOC.at(t));
          for (const m of DOC.marquees(t)) PAINT.marchingAnts(ctx, m, t);
        } else R(ctx, PAINT.DX, PAINT.DY, PAINT.DW, PAINT.DH, W);
        drawChat(ctx, t, true);
        if (t >= T.prog && t < T.bomb) progress(ctx, t);
        if (t >= T.bomb && t < T.okUp) bomb(ctx, t);
        if (t >= T.fileDown && t < T.quit) {
          const g = MAC.menuGeom(PAINT.MENUS, 1, PFILE_ITEMS);
          let hiItem = -1; g.rows.forEach((r, i) => { if (p[0] >= g.x && p[0] < g.x + g.w && p[1] >= g.y + r.y && p[1] < g.y + r.y + r.h && PFILE_ITEMS[i] !== '-') hiItem = i; });
          const blink = t >= T.quitBlink && Math.floor((t - T.quitBlink) / 0.05) % 2 === 1;
          if (t >= T.quitBlink) hiItem = PFILE_ITEMS.length - 1;
          MAC.menu(ctx, PAINT.MENUS, 1, PFILE_ITEMS, hiItem, blink);
        }
      } else { MAC.desktop(ctx); R(ctx, 0, 0, SW, 19, W); H(ctx, 0, 19, SW, B); }
      // cursor kind
      const docR = { x: PAINT.DX, y: PAINT.DY, w: PAINT.DW, h: PAINT.DH };
      const overChat = inRect(p, { x: CHATW.x, y: CHATW.y, w: CHATW.w + 1, h: CHATW.h + 1 });
      const drawing = DRAW.some((tr) => t >= tr.t0 - 0.05 && t <= tr.end + 0.05);
      if (drawing && inRect(p, docR) && !overChat) kind = { pencil: 'pencil', eraser: 'eraser', bucket: 'bucket', text: 'ibeam', line: 'cross', rect: 'cross', frect: 'cross', rrect: 'cross', frrect: 'cross', oval: 'cross', foval: 'cross', marquee: 'cross', spray: 'cross' }[tool] || 'arrow';
      else if (overChat && inRect(p, { x: CHATW.x + 1, y: CHATW.y + 19, w: CHATW.w - 18, h: CHATW.h - 20 })) kind = 'ibeam';
    } else {
      // ---------- back in the Finder ----------
      const dragging = t >= T.grab + 0.12 && t < T.drop;
      const overTrash = inRect(p, { x: ICON_TRASH[0], y: ICON_TRASH[1], w: 32, h: 44 });
      const gone = t >= T.drop;
      finder(ctx, t, {
        bareMenu: t < T.finder2, icons: t >= T.finder2 + 0.15, disk: true, trash: true, chat: !gone,
        chatSel: t >= T.grab && !gone, trashSel: dragging && overTrash, trashFull: t >= T.drop && t < T.empty,
        menuHi: t >= T.specDown && t < T.specUp + 0.2 ? 4 : -1,
      });
      if (dragging) MAC.iconOutline(ctx, ICONS.ICON.chat, p[0] - grabOff[0], p[1] - grabOff[1], 'ChatGPT');
      if (t >= T.specDown && t < T.specUp + 0.2) {
        const g = MAC.menuGeom(FINDER_MENUS, 4, SPECIAL_ITEMS);
        let hiItem = -1; g.rows.forEach((r, i) => { if (p[0] >= g.x && p[0] < g.x + g.w && p[1] >= g.y + r.y && p[1] < g.y + r.y + r.h && SPECIAL_ITEMS[i] !== '-') hiItem = i; });
        const blink = t >= T.specUp && Math.floor((t - T.specUp) / 0.05) % 2 === 1;
        if (t >= T.specUp) hiItem = 1;
        MAC.menu(ctx, FINDER_MENUS, 4, SPECIAL_ITEMS, hiItem, blink);
      }
    }
    // watch cursor
    for (const w of WATCH) if (t >= w[0] && t < w[1]) kind = 'watch';
    for (const h of HIDE) if (t >= h[0] && t < h[1]) showCursor = false;
    MAC.corners(ctx);
    if (showCursor) MAC.cursor(ctx, kind, p[0], p[1]);
  }

  function camera(t) {
    const c = camEval(t, CAM.length);
    return { cx: c.cx, cy: c.cy, zoom: c.z };
  }

  G.STORY = {
    duration: DUR,
    init() { CUES.sort((a, b) => a.t - b.t); },
    cues: () => CUES,
    draw, camera, T, MSG,
  };
})(window);
