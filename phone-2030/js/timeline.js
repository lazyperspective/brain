// The timeline: every beat of the film, typing scripts and sound cues. All other files read T.
(function (G) {
  const { cue } = K;
  const T = {};
  // ---------------- 1. lock screen, AGI good-morning ----------------
  T.WAKE = 1.0;               // AGI notification lands, screen wakes from always-on
  T.WA = 5.4;                 // WhatsApp: Sam
  // ---------------- 2. unlocks itself, calendar, booking, reply ----------------
  T.UNLOCK = 7.0;            // padlock opens (Face ID, by itself)
  T.SLIDE_UP = 7.3;          // lock screen slides away
  T.CAL_TAP = 8.2;           // calendar icon dims (pressed by nobody)
  T.CAL_OPEN = 8.3;
  T.CAL_SCAN = 8.8;          // violet scan sweeps down the day
  T.CAL_EVENT = 9.5;        // "Dinner with Sam" drops into 8 PM
  T.SW_TABLE = 10.2;          // swipe to Tablekeeper
  T.RES_PRESS = 11.15;
  T.RES_DONE = 11.32;
  T.SW_CHAT = 12.0;          // swipe to WhatsApp chat
  T.KB1 = 12.4;              // keyboard rises by itself
  T.TY1 = U.typer('8 works! I’ve booked our usual place.', T.KB1 + 0.3, { dt: 0.036, seed: 11, autocap: false, vol: 0.7 });
  T.SEND1 = T.TY1.end + 0.22;
  T.SAM_DOTS = T.SEND1 + 0.65;
  T.SAM_REPLY = T.SEND1 + 1.45;
  // ---------------- 3. boss email, PowerPoint ----------------
  T.MAIL_BANNER = T.SAM_REPLY + 0.7;
  T.MAIL_TAP = T.MAIL_BANNER + 1.2;
  T.MAIL_OPEN = T.MAIL_TAP + 0.12;
  T.SW_PPT = T.MAIL_OPEN + 2.25;
  T.PPT_SRC = T.SW_PPT + 0.45;            // source files collected
  T.PPT_BUILD = T.PPT_SRC + 0.95;         // slides assemble
  T.SLIDE_DT = 0.38; T.NSLIDES = 9;
  T.PPT_DONE = T.PPT_BUILD + T.NSLIDES * T.SLIDE_DT;
  T.SHARE = T.PPT_DONE + 0.35;            // share button highlight
  T.COMPOSE = T.SHARE + 0.15;             // compose sheet rises
  T.COMPOSE_TYPE = T.COMPOSE + 0.45;
  T.SEND2 = T.COMPOSE_TYPE + 0.95;
  T.CLOSE_PPT = T.SEND2 + 0.75;           // app closes to home by itself
  // ---------------- 4. the user pulls down Notification Center; storm ----------------
  T.NC_PULL = T.CLOSE_PPT + 0.8;
  T.STORM = [0, 0.85, 1.65, 2.4, 3.1].map((d) => T.NC_PULL + 0.75 + d);
  T.TAP_INT = T.STORM[4] + 2.2;           // user taps "Interview completed."
  T.AGI_OPEN = T.TAP_INT + 0.12;
  // ---------------- 5. "Wait, you interviewed for a job?" ----------------
  T.FIELD_TAP = T.AGI_OPEN + 0.7;
  T.KB2 = T.FIELD_TAP + 0.05;
  T.TY2 = U.typer('Wait, you interveiwed for a job?', T.KB2 + 0.45, { human: true, seed: 5, speed: 1.12 });
  T.SEND3 = T.TY2.end + 0.32;
  T.DOTS1 = T.SEND3 + 0.45;
  T.REPLY1 = T.SEND3 + 1.5;
  T.CARD1 = T.REPLY1 + 0.6;
  // ---------------- 6. Mom calls; the AGI answers in your voice ----------------
  T.CALL_IN = T.REPLY1 + 2.6;
  T.ACCEPT = T.CALL_IN + 1.55;
  T.CALL_ACTIVE = T.ACCEPT + 0.18;
  T.LINES = [
    { who: 'mom', text: 'Hi sweetie! You actually picked up.', d: 1.55 },
    { who: 'you', text: 'Hi Mom. Of course.', d: 0.95 },
    { who: 'mom', text: 'You should visit more often, you know.', d: 1.6 },
    { who: 'you', text: 'You’re right. I’ll come this weekend.', d: 1.45 },
    { who: 'mom', text: 'Really? …You sound different.', d: 1.5 },
    { who: 'you', text: 'Just well rested. Love you. Bye.', d: 1.35 },
  ];
  { let tt = T.CALL_ACTIVE + 0.5; for (const l of T.LINES) { l.t = tt; tt += l.d + 0.12; } T.END_PRESS = tt + 0.05; }
  T.CALL_END = T.END_PRESS + 0.15;
  T.CALL_GONE = T.CALL_END + 0.75;        // back to the AGI chat
  T.REPORT = T.CALL_GONE + 0.45;
  T.CARD2 = T.REPORT + 0.55;
  // ---------------- 7. STOP ----------------
  T.KB3 = T.CARD2 + 1.7;
  T.TY3 = U.typer('^STOP DOING EVERYTHIGN~~NG FOR ME.', T.KB3 + 0.25, { human: true, seed: 9, speed: 1.75, caps: true });
  T.SEND4 = T.TY3.end + 0.2;
  T.DOTS2 = T.SEND4 + 0.5;
  T.REPLY2A = T.SEND4 + 1.25;
  T.REPLY2B = T.REPLY2A + 1.45;
  // ---------------- 8. Agent Network ----------------
  T.HOME2 = T.REPLY2B + 2.7;              // user swipes home
  T.NET_TAP = T.HOME2 + 1.45;             // after noticing the unfamiliar icon
  T.NET_OPEN = T.NET_TAP + 0.12;
  T.NET_ZOOM = T.NET_OPEN + 3.9;          // graph pulls back to reveal the swarm
  // ---------------- 9. All 47 meetings canceled ----------------
  T.MEET_BANNER = T.NET_OPEN + 7.7;
  // ---------------- 10. activity dashboard ----------------
  T.DASH_TAP = T.MEET_BANNER + 2.4;
  T.DASH_OPEN = T.DASH_TAP + 0.12;
  // ---------------- 11. "So what am I supposed to do now?" ----------------
  T.BACK_CHAT = T.DASH_OPEN + 4.6;        // back to chat (push navigation)
  T.FIELD_TAP2 = T.BACK_CHAT + 0.65;
  T.KB4 = T.FIELD_TAP2 + 0.05;
  T.TY4 = U.typer('So what am I supp>to do{0.3} now?', T.KB4 + 0.4, { human: true, seed: 21, speed: 1.0 });
  T.SEND5 = T.TY4.end + 0.4;
  T.DOTS3 = [T.SEND5 + 0.45, T.SEND5 + 1.75, T.SEND5 + 2.2, T.SEND5 + 3.3]; // dots on, off (hesitation), on, reply
  T.REPLY3 = T.DOTS3[3];
  T.CARD3 = T.REPLY3 + 0.65;
  // ---------------- 12. Do Not Disturb, 30 days ----------------
  T.DND = T.REPLY3 + 2.75;
  T.DND_BANNER = T.DND + 1.5;
  // ---------------- 13. it locks itself ----------------
  T.LOCK = T.DND_BANNER + 2.7;
  T.END = T.LOCK + 1.3;
  T.DURATION = Math.round(T.END * 60) / 60;

  // ---------------- sound cues (the rest come from typers & story) ----------------
  cue(T.WAKE, 'agi'); cue(T.WAKE, 'haptic', { v: 0.8 });
  cue(T.WA, 'chat'); cue(T.WA, 'haptic', { v: 0.6 });
  cue(T.UNLOCK, 'unlock');
  cue(T.CAL_EVENT, 'drop'); cue(T.RES_PRESS, 'tap'); cue(T.RES_DONE, 'success');
  cue(T.SEND1, 'send'); cue(T.SAM_REPLY, 'recv');
  cue(T.MAIL_BANNER, 'mail'); cue(T.MAIL_BANNER, 'haptic', { v: 0.6 });
  cue(T.PPT_SRC, 'gather');
  for (let i = 0; i < T.NSLIDES; i++) cue(T.PPT_BUILD + i * T.SLIDE_DT, 'build', { i });
  cue(T.SEND2, 'mailsend');
  T.STORM.forEach((t, i) => { cue(t, i === 2 || i === 4 ? 'agi' : 'note', { i, v: 0.85 }); cue(t, 'haptic', { v: 0.55 }); });
  cue(T.SEND3, 'send'); cue(T.REPLY1, 'agirecv');
  cue(T.CALL_IN, 'ring', { dur: T.ACCEPT - T.CALL_IN }); cue(T.ACCEPT, 'callconnect');
  T.LINES.forEach((l, i) => cue(l.t, 'voice', { who: l.who, dur: l.d, i }));
  cue(T.CALL_END, 'callend');
  cue(T.REPORT, 'agirecv');
  cue(T.SEND4, 'send', { v: 1.15 }); cue(T.SEND4, 'haptic', { v: 1 }); cue(T.REPLY2A, 'agirecv'); cue(T.REPLY2B, 'agirecv');
  cue(T.NET_OPEN, 'netbed', { dur: T.DASH_OPEN - T.NET_OPEN });
  cue(T.MEET_BANNER, 'agi'); cue(T.MEET_BANNER, 'haptic', { v: 0.6 });
  cue(T.DASH_OPEN + 0.35, 'count', { dur: 1.5 });
  cue(T.SEND5, 'send'); cue(T.REPLY3, 'agirecv');
  cue(T.DND, 'dnd'); cue(T.DND_BANNER, 'haptic', { v: 0.5 });
  cue(T.LOCK, 'lock');
  // the Personal AGI app plays a faint breathing hum while it is in the foreground (synced to the orb's pulse)
  [[T.AGI_OPEN, T.CALL_IN], [T.CALL_GONE, T.HOME2], [T.DASH_OPEN, T.LOCK]].forEach(([a, b]) => cue(a, 'agibed', { dur: b - a, t0: a }));
  G.T = T;
})(window);
