/* Fable 5.2: A Field Guide. The locked timeline: beats, captions, tip cards, speech bubbles and every sound cue.
   Times are seconds; cue times are snapped to frames (30 fps) so the picture and the score hit together.
   Shared by the page (window.FG.TL) and by node / the score builder (module.exports). */
(function (root) {
  'use strict';
  var FG = root.FG = root.FG || {};
  function f(t) { return Math.round(t * 30) / 30; }        // snap to a frame
  var TL = {};
  TL.FPS = 30; TL.DUR = 40; TL.FRAMES = 1200;
  TL.BEATS = [
    { n: 1, t0: 0.0, t1: 3.0, name: 'hi' },
    { n: 2, t0: 3.0, t1: 6.5, name: 'effort' },
    { n: 3, t0: 6.5, t1: 10.5, name: 'plank' },
    { n: 4, t0: 10.5, t1: 14.0, name: 'thumbs' },
    { n: 5, t0: 14.0, t1: 18.5, name: 'owner' },
    { n: 6, t0: 18.5, t1: 22.5, name: 'quiet' },
    { n: 7, t0: 22.5, t1: 26.5, name: 'clones' },
    { n: 8, t0: 26.5, t1: 31.0, name: 'notes' },
    { n: 9, t0: 31.0, t1: 35.0, name: 'report' },
    { n: 10, t0: 35.0, t1: 40.0, name: 'reveal' }
  ];

  /* ---------------------------------------------------------------- key event times (the acting hangs off these) */
  var E = TL.E = {};
  // 1: hi
  E.hiLand = f(0.467); E.sit = f(0.9); E.cloudPuff = [f(1.13), f(1.23), f(1.33)]; E.cloudIn = f(1.4); E.hiSay = f(2.47);
  // 2: effort
  E.signHits = [f(3.27), f(3.47), f(3.63)]; E.read = f(3.75); E.cloudDouble = f(4.2);
  E.handDown = f(4.5); E.knobClicks = [f(4.83), f(4.93), f(5.03)]; E.deflate = f(5.07); E.hiSay2 = f(5.33); E.beamHop = f(5.4);
  E.cloudZip = f(5.75); E.flyIn = f(6.22); E.flyOut = f(6.6);
  // 3: plank
  E.planks = [f(6.97), f(7.15), f(7.33), f(7.51), f(7.69), f(7.87)]; E.stopShort = f(8.07); E.turnAsk = f(8.13); E.scratch = f(8.3);
  E.toss = f(9.2); E.lastPlank = f(9.5); E.cross = f(9.62); E.hopDown = f(10.2);
  // 4: thumbs
  E.thumbDown = f(10.62); E.thumbStop = f(11.25); E.huh = [f(11.5), f(11.7)]; E.thumbUp = f(11.95); E.banner = f(12.0); E.bannerSet = f(12.38);
  E.salute = f(13.05); E.sprint = f(13.42);
  // 5: owner
  E.arrive = f(14.05); E.crown = f(14.33); E.merge = f(15.0); E.mergeDone = f(15.42);
  E.flags = [f(15.6), f(15.76), f(15.92), f(16.08), f(16.24), f(16.4)]; E.paint = f(16.6); E.paintDone = f(17.05); E.meterTop = f(17.0);
  E.proud = f(17.35); E.dash = f(17.85); E.dive = f(18.4);
  // 6: quiet
  E.tumble = f(18.95); E.chirps = [f(19.15), f(19.45), f(19.75), f(20.05)]; E.taps = [f(19.62), f(19.86), f(20.1)];
  E.pops = [f(20.5), f(21.3), f(22.1)];
  // 7: clones
  E.crane = f(22.45); E.burst = f(22.97); E.plop = f(23.25);
  E.cloneWaves = [[f(23.45)], [f(23.72), f(23.8)], [f(24.0), f(24.04), f(24.08), f(24.12)], [f(24.3), f(24.33), f(24.36), f(24.39), f(24.42), f(24.45), f(24.48)]];
  E.kaching = [f(23.55), f(23.87), f(24.2), f(24.55)];
  E.bubblePops = [f(25.12), f(25.2), f(25.27), f(25.35), f(25.42), f(25.5), f(25.57)];
  // 8: notes
  E.snow = f(26.45); E.slaps = [f(27.05), f(27.3), f(27.52), f(27.72), f(27.9), f(28.05), f(28.18), f(28.3), f(28.42), f(28.52), f(28.62)];
  E.paw = f(28.95); E.blinkAsk = f(29.08); E.gust = f(29.75); E.cleanNote = f(30.15); E.relief = f(30.3);
  // 9: report
  E.offer = f(31.05); E.unroll = f(31.6); E.river = f(31.9); E.spin = f(32.55); E.spinEnd = f(33.35); E.collapse = f(33.55); E.card = f(33.9);
  E.hops = [f(34.45), f(34.95), f(35.45)];
  // 10: reveal
  E.landTop = f(35.9); E.wave = f(37.05); E.blinkEnd = f(38.5); E.title = f(36.7); E.sub = f(37.35); E.hold = f(38.3);

  /* ---------------------------------------------------------------- captions
     obs: top (documentary observation); tip: bottom HANDLER'S TIP card. {thumb} is drawn as an icon. */
  TL.CAPS = [
    { kind: 'obs', n: 1, t0: f(0.72), t1: f(3.05), text: 'It thinks before every reply. Even ‘hi’.' },
    { kind: 'obs', n: 2, t0: f(3.3), t1: f(5.25), text: 'Telling it not to think doesn’t work.' },
    { kind: 'tip', n: 2, t0: f(4.85), t1: f(6.55), text: 'Lower the effort instead.' },
    { kind: 'obs', n: 3, t0: f(7.15), t1: f(9.4), text: 'Sometimes it stops one plank short.' },
    { kind: 'tip', n: 3, t0: f(8.75), t1: f(10.7), text: '“Avoid stopping while you still owe work.”' },
    { kind: 'obs', n: 4, t0: f(10.95), t1: f(12.95), text: 'A {thumb} is not an approval.' },
    { kind: 'tip', n: 4, t0: f(12.4), t1: f(14.15), text: 'Say exactly what you approve.' },
    { kind: 'obs', n: 5, t0: f(14.4), t1: f(16.05), text: 'Tell it it owns the code…' },
    { kind: 'obs', n: 5, t0: f(16.05), t1: f(17.75), text: '…and it tidies EVERYTHING.', cont: true },
    { kind: 'tip', n: 5, t0: f(16.75), t1: f(18.7), text: 'Skip that line when you want small changes.' },
    { kind: 'obs', n: 6, t0: f(18.8), t1: f(20.75), text: 'On long tasks it goes quiet.' },
    { kind: 'tip', n: 6, t0: f(20.2), t1: f(22.75), text: '“Every few tool calls, give the user a one-line update.”' },
    { kind: 'obs', n: 7, t0: f(23.2), t1: f(25.4), text: 'At top effort it hires reviewers. Itself.' },
    { kind: 'tip', n: 7, t0: f(24.85), t1: f(26.65), text: 'Tell it what subagents cost.' },
    { kind: 'obs', n: 8, t0: f(26.9), t1: f(29.45), text: 'Old rules pile up. ‘Never’ means never.' },
    { kind: 'tip', n: 8, t0: f(29.25), t1: f(31.15), text: 'Trim old notes. Scope your rules.' },
    { kind: 'obs', n: 9, t0: f(31.35), t1: f(33.45), text: 'Its reports can get dense.' },
    { kind: 'tip', n: 9, t0: f(33.2), t1: f(35.15), text: '“Write for an intelligent but low-context reader.”' },
    { kind: 'title', n: 10, t0: E.title, t1: 40.0, text: 'FABLE 5.2 — A FIELD GUIDE' },
    { kind: 'sub', n: 10, t0: E.sub, t1: 40.0, text: 'Handle with clear instructions.' }
  ];
  // speech bubbles (drawn by the compositor at the hero's projected anchor)
  TL.BUBBLES = [
    { t0: E.hiSay, t1: f(3.2), text: 'hi.', who: 'hero', small: true },
    { t0: E.hiSay2, t1: f(6.05), text: 'hi!', who: 'hero' },
    { t0: E.pops[0], t1: E.pops[1] - 0.05, text: 'still digging!', who: 'pop' },
    { t0: E.pops[1], t1: E.pops[2] - 0.05, text: 'found a bug!', who: 'pop' },
    { t0: E.pops[2], t1: f(22.95), text: 'almost there!', who: 'pop' },
    { t0: E.blinkAsk, t1: f(29.95), text: 'may I blink?', who: 'hero', small: true }
  ];

  /* ---------------------------------------------------------------- sound cues: [time, name, gain, param] */
  var Q = [];
  function q(t, name, g, p) { Q.push({ t: f(t), name: name, g: g == null ? 1 : g, p: p == null ? 0 : p }); }
  q(0.0, 'fallwhistle', 0.55);
  q(E.hiLand, 'thud', 1.0);
  q(E.sit, 'plop', 0.5);
  E.cloudPuff.forEach(function (t, i) { q(t, 'puff', 0.45, i); });
  q(E.cloudIn, 'inflate', 0.7);
  q(E.hiSay, 'tiny', 0.7);
  E.signHits.forEach(function (t, i) { q(t, 'stake', 1 - i * 0.2, i); });
  q(E.cloudDouble, 'inflate2', 0.85);
  q(E.handDown, 'whooshDown', 0.5);
  E.knobClicks.forEach(function (t, i) { q(t, 'click', 0.75, i); });
  q(E.deflate, 'squeak', 0.9);
  q(E.hiSay2, 'blip', 0.75);
  q(E.cloudZip, 'pfft', 0.6);
  q(E.flyIn - 0.1, 'whoosh', 0.75, 0);
  E.planks.forEach(function (t, i) { q(t, 'bonk', 0.8, i); });
  q(E.turnAsk, 'blip', 0.4);
  q(E.scratch, 'scratch', 0.9);
  q(E.toss, 'swish', 0.5);
  q(E.lastPlank, 'bonkbig', 1.0);
  q(E.hopDown, 'plop', 0.45);
  q(E.thumbDown, 'choir', 0.8);
  E.huh.forEach(function (t, i) { q(t, 'huh', 0.6, i); });
  q(E.thumbUp, 'whooshUp', 0.45);
  q(E.banner, 'unfurl', 0.7);
  q(E.salute, 'ting', 0.7);
  q(E.sprint, 'zip', 0.8);
  q(E.crown, 'crown', 0.9);
  q(E.merge, 'squish', 0.8);
  q(E.mergeDone, 'poof', 0.7);
  E.flags.forEach(function (t, i) { q(t, 'thwip', 0.6, i); });
  q(E.paint, 'swish', 0.6); q(E.paint + 0.18, 'swish', 0.5);
  q(15.0, 'meter', 0.5);
  q(E.meterTop, 'ding', 0.6);
  q(E.dash, 'zip', 0.6);
  q(E.dive, 'dive', 0.8);
  q(E.tumble, 'wind', 0.55);
  E.chirps.forEach(function (t, i) { q(t, 'cricket', 0.6, i); });
  E.taps.forEach(function (t, i) { q(t, 'tap', 0.85, i); });
  E.pops.forEach(function (t, i) { q(t, 'popup', 0.8, i); });
  q(E.crane, 'riser', 0.6);
  q(E.burst, 'burst', 0.8);
  q(E.plop, 'plop', 0.5);
  E.cloneWaves.forEach(function (w) { w.forEach(function (t, i) { q(t, 'clone', 0.55, i); }); });
  E.kaching.forEach(function (t, i) { q(t, 'kaching', 0.8, i); });
  E.bubblePops.forEach(function (t, i) { q(t, 'bubble', 0.7, i); });
  q(E.snow, 'flutter', 0.4);
  E.slaps.forEach(function (t, i) { q(t, 'slap', 0.65, i); });
  q(E.paw, 'creak', 0.45);
  q(E.blinkAsk, 'tiny', 0.6);
  q(E.gust, 'gust', 0.9);
  q(E.cleanNote, 'slap', 0.7, 3);
  q(E.relief, 'blinks', 0.6);
  q(E.offer, 'rustle', 0.6);
  q(E.unroll, 'unroll', 0.75);
  q(E.river, 'babble', 0.6);
  q(E.spin, 'dizzy', 0.7);
  q(E.collapse, 'rewind', 0.7);
  q(E.card, 'ding', 0.7);
  E.hops.forEach(function (t, i) { q(t - 0.05, 'boing', 0.45, i); });
  q(E.landTop, 'plop', 0.5);
  q(E.title, 'chime', 0.6);
  q(E.blinkEnd, 'tiny', 0.35);
  // the handler's tip card lands with a soft glove "whump" and a little celesta signature
  TL.CAPS.forEach(function (c) { if (c.kind === 'tip') { q(c.t0, 'tipcard', 0.75); } });
  Q.sort(function (a, b) { return a.t - b.t; });
  TL.CUES = Q;
  TL.f = f;

  FG.TL = TL;
  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
})(typeof window !== 'undefined' ? window : globalThis);
