// App screens (dark mode), each a pure function of t returning a 360x640 HTML surface.
(function (G) {
  const { clamp, lerp, sat, seg, E, spring, sp, esc, f3, clock, hash, rng } = K;
  const { appIcon, GL } = ICONS;
  const W = 360, H = 640;
  const A = {};
  const SEC = 'rgba(235,235,245,0.6)', TER = 'rgba(235,235,245,0.3)', BLUE = '#0a84ff';
  const kbY = (t, t0, t1 = 1e9) => { // keyboard top (slides up with a spring, down on t1)
    const up = sp(t, t0, 0.42, 0.92), dn = t > t1 ? E.inOut(seg(t, t1, t1 + 0.3)) : 0;
    return H - U.KB.h * (up - dn);
  };
  A.kbY = kbY;

  // ================================================================ Calendar
  A.calendar = function (t) {
    const y0 = 188, hh = 30.5;
    const yOf = (h) => y0 + (h - 7) * hh;
    let s = `<div class="L" style="background:#000">`;
    s += `<div class="abs row" style="left:8px;top:58px;gap:3px;color:#ff453a;font-size:17px"><div style="width:11px;height:19px">${GL.chevL('#ff453a')}</div>March</div>
      <div class="abs row" style="right:16px;top:59px;gap:22px"><div style="width:18px;height:18px">${GL.search('#ff453a')}</div><div style="width:17px;height:17px">${GL.plus('#ff453a', 2.3)}</div></div>`;
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], dates = [10, 11, 12, 13, 14, 15, 16];
    days.forEach((d, i) => {
      const x = 12 + i * 48;
      s += `<div class="abs" style="left:${x}px;top:98px;width:48px;text-align:center;font-size:10.5px;font-weight:600;color:${SEC}">${d}</div>`;
      s += `<div class="abs" style="left:${x + 8}px;top:114px;width:32px;height:32px;border-radius:16px;${i === 1 ? 'background:#ff453a;' : ''}display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:${i === 1 ? 600 : 400};color:${i === 0 || i === 6 ? SEC : '#fff'}">${dates[i]}</div>`;
    });
    s += `<div class="abs" style="left:0;width:${W}px;top:154px;text-align:center;font-size:13.5px;color:#fff;font-weight:500">Monday, March 11, 2030</div>`;
    s += `<div class="abs" style="left:0;right:0;top:177px;height:0.5px;background:rgba(84,84,88,0.65)"></div>`;
    for (let h = 7; h <= 22; h++) {
      const y = yOf(h);
      if (y > H) break;
      const lab = h === 12 ? 'Noon' : ((h + 11) % 12 + 1) + (h < 12 ? ' AM' : ' PM');
      s += `<div class="abs" style="left:6px;top:${f3(y - 7)}px;width:48px;text-align:right;font-size:11px;color:${TER}">${lab}</div><div class="abs" style="left:60px;right:0;top:${f3(y)}px;height:0.5px;background:rgba(84,84,88,0.5)"></div>`;
    }
    const ev = (h0, h1, title, sub, col, o = {}) => {
      const y = yOf(h0) + 1, hgt = (h1 - h0) * hh - 2;
      return `<div class="abs" style="left:62px;right:6px;top:${f3(y)}px;height:${f3(hgt)}px;border-radius:5px;background:${col}${o.ghost ? '00' : '38'};${o.ghost ? `border:1px dashed ${col}99;` : ''}overflow:hidden;${o.style || ''}">
        <div class="abs" style="left:0;top:0;bottom:0;width:3.5px;background:${col};${o.ghost ? 'opacity:0;' : ''}"></div>
        <div style="padding:${hgt < 22 ? 2 : 4}px 8px 0 10px;font-size:12px;line-height:14px;font-weight:600;color:${o.ghost ? col + 'aa' : '#fff'};white-space:nowrap">${title}${sub ? `<span style="font-weight:400;color:${SEC}">  ${sub}</span>` : ''}</div></div>`;
    };
    s += ev(8.5, 9.25, 'Standup', 'moved by Personal AGI', '#bf5af2', { ghost: true });
    s += ev(10, 10.75, 'Standup', '10:00 AM', '#bf5af2');
    s += ev(11.5, 12.25, 'Design review', 'Room 4B', '#0a84ff');
    s += ev(12.5, 13.5, 'Lunch with Priya', '', '#30d158');
    s += ev(14, 14.75, '1:1 with Dana', '', '#ff9f0a');
    s += ev(15, 17, 'Focus time', '', '#8e8e93');
    s += ev(18, 19, 'Gym', '', '#64d2ff');
    // AGI scan band
    if (t > T.CAL_SCAN && t < T.CAL_EVENT + 0.4) {
      const k = E.inOut(seg(t, T.CAL_SCAN, T.CAL_EVENT - 0.1));
      const y = lerp(yOf(7), yOf(20), k), a = 1 - sat((t - T.CAL_EVENT + 0.1) / 0.45);
      s += `<div class="abs" style="left:60px;right:0;top:${f3(y - 70)}px;height:70px;background:linear-gradient(180deg,rgba(150,110,255,0) 0%,rgba(150,110,255,0.28) 100%);opacity:${f3(a)}"></div><div class="abs" style="left:60px;right:0;top:${f3(y)}px;height:1.5px;background:#b69bff;box-shadow:0 0 10px #a68bff;opacity:${f3(a)}"></div>`;
    }
    // current time
    const yn = yOf(7 + (29 + (22 + t) / 60) / 60);
    s += `<div class="abs" style="left:58px;right:0;top:${f3(yn - 0.75)}px;height:1.5px;background:#ff453a"></div><div class="abs" style="left:10px;top:${f3(yn - 8)}px;width:40px;height:16px;border-radius:8px;background:#ff453a;font-size:11px;font-weight:600;line-height:16px;text-align:center" class="tnum">${clock(t).str}</div>`;
    // the new event
    if (t > T.CAL_EVENT - 0.25) {
      const pulse = t < T.CAL_EVENT ? 0.5 + 0.5 * Math.sin((t - T.CAL_EVENT) * 30) : 0;
      if (t < T.CAL_EVENT) s += `<div class="abs" style="left:62px;right:6px;top:${f3(yOf(20) + 1)}px;height:${f3(hh - 2)}px;border-radius:5px;border:1.5px solid rgba(255,214,10,${f3(0.4 + 0.5 * pulse)})"></div>`;
      else {
        const k = sp(t, T.CAL_EVENT, 0.38, 0.62);
        s += ev(20, 21, 'Dinner with Sam', 'Lucia’s Trattoria', '#ffd60a', { style: `transform:scale(${f3(lerp(1.12, 1, k))});opacity:${f3(sat(k * 3))};box-shadow:0 0 ${f3(24 * (1 - sat(k)))}px rgba(255,214,10,0.7)` });
      }
    }
    return s + '</div>';
  };

  // ================================================================ Tablekeeper (restaurant booking)
  A.table = function (t) {
    let s = `<div class="L" style="background:#0e0e10">`;
    // "photo": generated warm table scene
    s += `<div class="abs" style="left:0;top:0;width:${W}px;height:236px;background:radial-gradient(120% 90% at 70% 30%, #6b3a22 0%, #2e1a12 55%, #120b08 100%);overflow:hidden">
      <div class="abs" style="left:150px;top:46px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,#f3ece2 0 52%,#d9d0c3 53% 60%,rgba(0,0,0,0) 61%)"></div>
      <div class="abs" style="left:182px;top:78px;width:86px;height:86px;border-radius:50%;background:radial-gradient(circle at 45% 40%,#e9a23b 0%,#c4572a 45%,#8f2f1b 75%,#6e2414 100%)"></div>
      <div class="abs" style="left:198px;top:92px;width:12px;height:8px;border-radius:50%;background:#3f8f3a;transform:rotate(30deg)"></div><div class="abs" style="left:236px;top:120px;width:12px;height:8px;border-radius:50%;background:#3f8f3a;transform:rotate(-20deg)"></div>
      <div class="abs" style="left:40px;top:30px;width:70px;height:170px;border-radius:35px;background:linear-gradient(180deg,rgba(255,220,170,0.0),rgba(255,220,170,0.12))"></div>
      <div class="abs" style="left:0;top:110px;width:${W}px;height:126px;background:linear-gradient(180deg,rgba(14,14,16,0),#0e0e10)"></div>
    </div>`;
    s += `<div class="abs" style="left:16px;top:182px;font-family:'Inter Display';font-weight:700;font-size:27px;letter-spacing:-0.02em">Lucia’s Trattoria</div>
      <div class="abs" style="left:16px;top:217px;font-size:14px;color:${SEC}">Italian · $$ · 0.8 mi · <span style="color:#ffd60a">★</span> 4.8</div>`;
    s += `<div class="abs row" style="left:16px;top:252px;gap:8px;padding:8px 12px;border-radius:12px;background:#1f1f22;font-size:14px"><span style="color:#ff6961;font-weight:600">Your usual</span><span style="color:${SEC}">Table 12, by the window</span></div>`;
    const field = (y, lab, val) => `<div class="abs row" style="left:16px;right:16px;top:${y}px;height:44px;justify-content:space-between;border-bottom:0.5px solid rgba(84,84,88,0.6)"><span style="font-size:16px">${lab}</span><span style="font-size:16px;color:${SEC}">${val}</span></div>`;
    s += field(300, 'Party size', '2 guests') + field(344, 'Date', 'Tonight, Mon 11');
    s += `<div class="abs" style="left:16px;top:404px;font-size:13px;font-weight:600;color:${SEC};letter-spacing:0.02em">AVAILABLE TIMES</div>`;
    const times = ['7:30', '7:45', '8:00', '8:15', '8:30'];
    const pick = sp(t, T.SW_TABLE + 0.55, 0.3, 0.7);
    times.forEach((tm, i) => {
      const sel = i === 2 && t > T.SW_TABLE + 0.55;
      s += `<div class="abs" style="left:${16 + i * 66}px;top:428px;width:60px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;${sel ? `background:#ff453a;color:#fff;transform:scale(${f3(lerp(0.9, 1, pick))})` : 'background:#1f1f22;color:#fff'}">${tm}</div>`;
    });
    const pr = t > T.RES_PRESS && t < T.RES_DONE + 0.05 ? 1 : 0;
    const done = sp(t, T.RES_DONE, 0.35, 0.7);
    const bcol = t > T.RES_DONE ? '#30d158' : '#ff453a';
    s += `<div class="abs" style="left:16px;right:16px;top:540px;height:52px;border-radius:14px;background:${bcol};display:flex;align-items:center;justify-content:center;gap:8px;font-size:17px;font-weight:600;transform:scale(${f3(pr ? 0.97 : t > T.RES_DONE ? lerp(0.97, 1, done) : 1)});${pr ? 'filter:brightness(0.8);' : ''}">${t > T.RES_DONE ? `<div style="width:18px;height:18px;transform:scale(${f3(done)})">${GL.check('#fff', 3)}</div>Reserved · 8:00 PM` : 'Reserve for 2 · 8:00 PM'}</div>`;
    if (t > T.RES_DONE) s += `<div class="abs" style="left:0;width:${W}px;top:600px;text-align:center;font-size:13px;color:${SEC};opacity:${f3(sat((t - T.RES_DONE) * 3))}">Confirmation sent to Sam</div>`;
    return s + '</div>';
  };

  // ================================================================ WhatsApp-style chat (original drawing)
  A.chat = function (t) {
    const kb = kbY(t, T.KB1, T.SEND1 + 0.9);
    const inputH = 52, inputTop = Math.min(kb, H - 30) - inputH;
    let s = `<div class="L" style="background:#0b141a">`;
    // doodle wallpaper: faint scattered rings & dots (original)
    let dd = ''; const r = rng(77);
    for (let i = 0; i < 70; i++) { const x = r() * W, y = 90 + r() * 560, sz = 6 + r() * 10; dd += `<div class="abs" style="left:${f3(x)}px;top:${f3(y)}px;width:${f3(sz)}px;height:${f3(sz)}px;border-radius:${r() < 0.5 ? '50%' : '3px'};border:1.2px solid rgba(255,255,255,0.035);transform:rotate(${f3(r() * 90)}deg)"></div>`; }
    s += dd;
    // messages
    const BIN = '#1f2c34', BOUT = '#005c4b';
    const tick = (read) => `<svg width="16" height="11" viewBox="0 0 16 11" style="display:inline-block;margin-left:3px;vertical-align:-1px"><path d="M1 6l3 3 6-7M6 9l1 .5 6.5-7.5" fill="none" stroke="${read ? '#53bdeb' : 'rgba(255,255,255,0.55)'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const bub = (side, text, time, o = {}) => `<div style="align-self:${side === 'me' ? 'flex-end' : 'flex-start'};max-width:268px;margin:${o.first ? 6 : 2}px ${side === 'me' ? 10 : 0}px 0 ${side === 'me' ? 0 : 10}px;position:relative">
      <div style="background:${side === 'me' ? BOUT : BIN};border-radius:${side === 'me' ? '9px 2px 9px 9px' : '2px 9px 9px 9px'};padding:6px 9px 7px 9px;font-size:16px;line-height:20.5px;color:#e9edef">${esc(text)}<span style="display:inline-block;width:${side === 'me' ? 80 : 62}px"></span>
        <span class="abs" style="right:8px;bottom:5px;font-size:11px;color:rgba(233,237,239,0.6)">${time}${side === 'me' ? tick(o.read) : ''}</span>${o.foot ? `<div style="font-size:11.5px;color:rgba(233,237,239,0.5);margin-top:2px;font-style:italic">${o.foot}</div>` : ''}</div></div>`;
    const chip = (txt) => `<div style="align-self:center;margin:10px 0 6px;padding:4px 10px;border-radius:8px;background:#1d282f;font-size:12.5px;color:rgba(233,237,239,0.7)">${txt}</div>`;
    let m = '';
    m += chip('Saturday');
    m += bub('them', 'did you see the game', '10:41 PM', { first: 1 });
    m += bub('them', 'unreal ending', '10:41 PM');
    m += bub('me', 'no I fell asleep at halftime', '11:02 PM', { first: 1, read: 1 });
    m += bub('them', 'classic', '11:03 PM', { first: 1 });
    m += chip('Yesterday');
    m += bub('them', 'you free this week?', '9:12 PM', { first: 1 });
    m += bub('me', 'should be! let’s do something', '9:20 PM', { first: 1, read: 1 });
    m += chip('Today');
    m += bub('them', 'Dinner tonight at 8?', '7:30 AM', { first: 1 });
    if (t > T.SEND1) { const k = sp(t, T.SEND1, 0.36, 0.8); m += U.grow(k, bub('me', '8 works! I’ve booked our usual place.', '7:31 AM', { first: 1, read: t > T.SEND1 + 0.6 }), { origin: '100% 100%', dy: 30 }); }
    if (t > T.SAM_REPLY) { const k = sp(t, T.SAM_REPLY, 0.36, 0.8); m += U.grow(k, bub('them', 'Perfect. Added it to Sam’s calendar.', '7:31 AM', { first: 1, foot: 'Sent by Sam’s AGI' }), { origin: '0% 100%' }); }
    s += `<div class="abs col" style="left:0;width:${W}px;top:96px;height:${f3(inputTop - 96 - 6)}px;justify-content:flex-end;overflow:hidden">${m}</div>`;
    // header
    const typing = t > T.SAM_DOTS && t < T.SAM_REPLY;
    s += `<div class="abs" style="left:0;top:0;width:${W}px;height:96px;background:#1f2c34"></div>
      <div class="abs row" style="left:8px;top:57px;gap:8px"><div style="width:11px;height:19px">${GL.chevL('#fff')}</div>
        <div style="width:36px;height:36px;border-radius:18px;background:linear-gradient(160deg,#8fb8ff,#3f6fd8);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px">S</div>
        <div><div style="font-size:16.5px;font-weight:600;line-height:19px">Sam</div><div style="font-size:12.5px;line-height:15px;color:${typing ? '#00a884' : 'rgba(233,237,239,0.6)'}">${typing ? 'typing…' : 'online'}</div></div></div>
      <div class="abs row" style="right:16px;top:64px;gap:24px"><div style="width:24px;height:17px">${GL.video2('#fff')}</div><div style="width:19px;height:19px">${GL.phoneO('#fff')}</div></div>`;
    // input bar
    const typed = t > T.KB1 && t < T.SEND1 ? T.TY1.text(t) : '';
    s += `<div class="abs" style="left:0;top:${f3(inputTop)}px;width:${W}px;height:${inputH + 40}px;background:#1f2c34"></div>
      <div class="abs" style="left:12px;top:${f3(inputTop + 13)}px;width:20px;height:20px">${GL.plus('#fff', 2)}</div>
      <div class="abs" style="left:44px;top:${f3(inputTop + 8)}px;width:${typed ? 258 : 214}px;min-height:34px;border-radius:17px;background:#2a3942;padding:7px 12px;font-size:16px;line-height:20px;color:#e9edef;white-space:nowrap;overflow:hidden">${typed ? esc(typed) + U.caret(t, T.TY1.at(t).t, '#00a884', 20) : ''}</div>`;
    if (typed) s += `<div class="abs" style="left:312px;top:${f3(inputTop + 7)}px;width:36px;height:36px;border-radius:18px;background:#00a884;display:flex;align-items:center;justify-content:center;${t > T.SEND1 - 0.12 ? 'filter:brightness(0.75);' : ''}"><svg width="17" height="17" viewBox="0 0 20 20"><path d="M18 10L3 3l4 7-4 7z" fill="#0b141a"/></svg></div>`;
    else s += `<div class="abs row" style="left:270px;top:${f3(inputTop + 14)}px;gap:20px"><div style="width:22px;height:19px">${GL.cameraO('#fff')}</div><div style="width:14px;height:20px">${GL.mic('#fff')}</div></div>`;
    if (kb < H) { const p = T.TY1.kb(t); s += U.keyboard(Object.assign({ y: kb }, p)); }
    return s + '</div>';
  };

  // ================================================================ Mail
  A.mail = function (t) {
    let s = `<div class="L" style="background:#000">`;
    s += `<div class="abs row" style="left:8px;top:58px;gap:3px;color:${BLUE};font-size:17px"><div style="width:11px;height:19px">${GL.chevL()}</div>Inbox</div>
      <div class="abs row" style="right:18px;top:60px;gap:26px;transform:rotate(90deg)"><div style="width:8px;height:14px;transform:rotate(180deg)">${GL.chevR(BLUE)}</div><div style="width:8px;height:14px">${GL.chevR(BLUE)}</div></div>`;
    s += `<div class="abs" style="left:16px;top:104px;width:42px;height:42px;border-radius:21px;background:linear-gradient(180deg,#a5a5ab,#6e6e74);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px">DW</div>
      <div class="abs" style="left:68px;top:105px;font-size:16.5px;font-weight:600">Dana Whitfield</div>
      <div class="abs" style="left:68px;top:126px;font-size:14px;color:${SEC}">To: Alex Rivera</div>
      <div class="abs" style="right:16px;top:107px;font-size:14px;color:${SEC}">7:30 AM</div>
      <div class="abs" style="left:16px;right:16px;top:160px;height:0.5px;background:rgba(84,84,88,0.65)"></div>
      <div class="abs" style="left:16px;top:174px;font-family:'Inter Display';font-weight:700;font-size:22px;letter-spacing:-0.015em">Q2 deck before noon</div>
      <div class="abs" style="left:16px;right:18px;top:216px;font-size:16.5px;line-height:23px;color:#fff">Hi Alex,<br><br>I need the Q2 presentation in my inbox <b style="font-weight:600">before noon</b>. Numbers, customer highlights, H2 roadmap. Board prep is at 1.<br><br>Thanks,<br>Dana</div>`;
    s += `<div class="abs mat-bar" style="left:0;top:578px;width:${W}px;height:62px;border-top:0.5px solid rgba(84,84,88,0.5)"></div>
      <div class="abs row" style="left:22px;right:22px;top:588px;justify-content:space-between">
        <div style="width:20px;height:22px">${GL.trash()}</div><div style="width:25px;height:20px">${GL.folder()}</div><div style="width:24px;height:20px">${GL.reply()}</div><div style="width:23px;height:23px">${GL.compose()}</div></div>`;
    return s + '</div>';
  };

  // ================================================================ PowerPoint-style editor
  const OR = '#e8582a';
  const SLIDES = [
    (k) => `<div class="abs" style="left:0;top:0;bottom:0;width:${f3(10 + 70 * (1 - E.out(sat(k * 2))))}px;background:${OR}"></div>
      <div class="abs" style="left:${f3(28 + 20 * (1 - E.out(sat(k * 2))))}px;top:56px;font-family:'Inter Display';font-weight:700;font-size:30px;letter-spacing:-0.02em;color:#1a1a1a;opacity:${f3(sat(k * 2.5))}">Q2 2030 Review</div>
      <div class="abs" style="left:28px;top:98px;font-size:11px;color:#555;opacity:${f3(sat(k * 2.5 - 0.6))}">Prepared for Dana Whitfield · Alex Rivera</div>
      <div class="abs" style="left:28px;top:150px;font-size:9px;color:#999;opacity:${f3(sat(k * 2.5 - 1))}">March 11, 2030 · Confidential</div>`,
    (k) => { let b = ''; const v = [0.42, 0.5, 0.47, 0.61, 0.7, 0.86]; v.forEach((h, i) => { const g = E.out(sat(k * 2.2 - i * 0.12)); b += `<div class="abs" style="left:${40 + i * 44}px;bottom:30px;width:28px;height:${f3(h * 110 * g)}px;background:${i === 5 ? OR : '#f0b49c'};border-radius:2px 2px 0 0"></div><div class="abs" style="left:${36 + i * 44}px;bottom:14px;width:36px;text-align:center;font-size:8px;color:#888">${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}</div>`; });
      return `<div class="abs" style="left:18px;top:14px;font-family:'Inter Display';font-weight:700;font-size:20px;color:#1a1a1a">Revenue up 18% QoQ</div>${b}<div class="abs" style="left:24px;right:20px;bottom:30px;height:1px;background:#ddd"></div><div class="abs" style="right:22px;top:46px;font-family:'Inter Display';font-weight:700;font-size:22px;color:${OR};opacity:${f3(sat(k * 3 - 1.4))}">$4.2M</div>`; },
    (k) => { const q = ['“It just works.”', '“Saved us 40 hours a week.”', '“Renewing for 3 years.”']; let c = ''; q.forEach((x, i) => { const g = E.out(sat(k * 2.4 - i * 0.3)); c += `<div class="abs" style="left:${18 + i * 102}px;top:${f3(56 + (1 - g) * 20)}px;width:94px;height:96px;border-radius:6px;background:#fbefe9;opacity:${f3(g)};padding:9px;font-size:11.5px;line-height:14.5px;font-weight:600;color:#3a2a22">${x}<div style="position:absolute;left:9px;bottom:8px;font-size:8px;font-weight:400;color:#a07a68">${['Acme Corp', 'Globex', 'Initech'][i]}</div></div>`; });
      return `<div class="abs" style="left:18px;top:14px;font-family:'Inter Display';font-weight:700;font-size:20px;color:#1a1a1a">What customers said</div>${c}`; },
    (k) => { const L = [['Leads', '1,240', 1], ['Qualified', '410', 0.74], ['Proposals', '96', 0.5], ['Won', '38', 0.3]]; let c = ''; L.forEach(([a, b, w], i) => { const g = E.out(sat(k * 2.4 - i * 0.22)); c += `<div class="abs" style="left:${f3(168 - 140 * w * g)}px;top:${50 + i * 32}px;width:${f3(280 * w * g)}px;height:26px;border-radius:3px;background:${['#f6c9b6', '#f2a585', '#ee8157', OR][i]};font-size:10px;line-height:26px;text-align:center;color:${i === 3 ? '#fff' : '#4a2a1a'};font-weight:600;white-space:nowrap;overflow:hidden">${a} · ${b}</div>`; });
      return `<div class="abs" style="left:18px;top:14px;font-family:'Inter Display';font-weight:700;font-size:20px;color:#1a1a1a">Pipeline</div>${c}`; },
    (k) => { const M = [['Jul', 'Launch Atlas'], ['Sep', 'EU expansion'], ['Nov', 'Platform 3.0']]; let c = `<div class="abs" style="left:26px;top:98px;width:${f3(284 * E.out(sat(k * 2)))}px;height:3px;background:${OR}"></div>`; M.forEach(([a, b], i) => { const g = sat(k * 2.6 - 0.5 - i * 0.3); c += `<div class="abs" style="left:${40 + i * 100}px;top:92px;width:15px;height:15px;border-radius:8px;background:#fff;border:3px solid ${OR};transform:scale(${f3(g)})"></div><div class="abs" style="left:${14 + i * 100}px;top:${i % 2 ? 116 : 52}px;width:70px;text-align:center;opacity:${f3(g)}"><div style="font-size:9px;color:#999;font-weight:600">${a}</div><div style="font-size:11.5px;font-weight:600;color:#222;line-height:13px">${b}</div></div>`; });
      return `<div class="abs" style="left:18px;top:14px;font-family:'Inter Display';font-weight:700;font-size:20px;color:#1a1a1a">H2 Roadmap</div>${c}`; },
    (k) => { const R = ['Churn in SMB', 'Hiring speed', 'EU compliance', 'Infra cost']; let c = ''; R.forEach((x, i) => { const g = sat(k * 2.6 - i * 0.25); c += `<div class="abs" style="left:${18 + (i % 2) * 154}px;top:${50 + Math.floor(i / 2) * 64}px;width:146px;height:56px;border-radius:5px;background:${i % 3 ? '#f4f4f4' : '#fbefe9'};opacity:${f3(g)};padding:8px 10px"><div style="font-size:11.5px;font-weight:700;color:#222">${x}</div><div style="font-size:9px;color:#777;margin-top:3px">Mitigated · owner: AGI</div></div>`; });
      return `<div class="abs" style="left:18px;top:14px;font-family:'Inter Display';font-weight:700;font-size:20px;color:#1a1a1a">Risks &amp; mitigations</div>${c}`; },
    (k) => { let c = ''; for (let i = 0; i < 6; i++) { const g = E.out(sat(k * 3 - i * 0.18)); c += `<div class="abs" style="left:${30 + i * 48}px;top:68px;width:38px;height:38px;border-radius:19px;background:${['#f2a585', '#9fc2ff', '#b5e3b0', '#f7d58a', '#d3b8f5', '#f6c9b6'][i]};transform:scale(${f3(g)})"></div>`; }
      return `<div class="abs" style="left:18px;top:14px;font-family:'Inter Display';font-weight:700;font-size:20px;color:#1a1a1a">Team</div>${c}<div class="abs" style="left:30px;top:122px;font-size:12px;color:#444;opacity:${f3(sat(k * 3 - 1.2))}">6 people · 4 open roles · 0 meetings needed</div>`; },
    (k) => { const L = ['Approve H2 budget', 'Two new hires', 'Cancel recurring meetings']; let c = ''; L.forEach((x, i) => { const g = sat(k * 2.6 - i * 0.3); c += `<div class="abs row" style="left:${f3(22 + (1 - E.out(g)) * 30)}px;top:${54 + i * 32}px;gap:10px;opacity:${f3(g)}"><div style="width:20px;height:20px;border-radius:10px;background:${OR};color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:20px">${i + 1}</div><div style="font-size:14px;font-weight:600;color:#222">${x}</div></div>`; });
      return `<div class="abs" style="left:18px;top:14px;font-family:'Inter Display';font-weight:700;font-size:20px;color:#1a1a1a">Asks</div>${c}`; },
    (k) => `<div class="abs" style="inset:0;background:${OR};opacity:${f3(sat(k * 2))}"></div><div class="abs" style="left:0;right:0;top:62px;text-align:center;font-family:'Inter Display';font-weight:700;font-size:30px;color:#fff;transform:scale(${f3(lerp(0.85, 1, E.out(sat(k * 2))))})">Thank you</div><div class="abs" style="left:0;right:0;top:108px;text-align:center;font-size:11.5px;color:#fff;opacity:${f3(sat(k * 3 - 1))}">Questions? Already answered in the appendix.</div>`,
  ];
  const slideBox = (i, k, w) => `<div style="position:relative;width:336px;height:189px;background:#fff;overflow:hidden;transform:scale(${f3(w / 336)});transform-origin:0 0">${SLIDES[i](k)}</div>`;
  A.ppt = function (t) {
    let s = `<div class="L" style="background:#1b1b1d">`;
    const shareHi = t > T.SHARE && t < T.SHARE + 0.25;
    s += `<div class="abs row" style="left:10px;top:58px;gap:3px;color:#ff8a5c;font-size:17px"><div style="width:11px;height:19px">${GL.chevL('#ff8a5c')}</div></div>
      <div class="abs" style="left:0;width:${W}px;top:56px;text-align:center"><div style="font-size:16px;font-weight:600">Q2 Review</div><div style="font-size:11.5px;color:${SEC}">${t > T.PPT_DONE ? 'Saved' : 'Editing…'}</div></div>
      <div class="abs row" style="right:14px;top:60px;gap:20px"><div style="width:16px;height:16px">${GL.play('#ff8a5c')}</div><div style="width:18px;height:22px;position:relative">${shareHi ? '<div class="abs" style="inset:-9px -10px;border-radius:14px;background:rgba(255,255,255,0.16)"></div>' : ''}${GL.share('#ff8a5c')}</div></div>`;
    s += `<div class="abs row" style="left:0;top:98px;width:${W}px;height:34px;background:#232325;gap:20px;padding-left:16px;font-size:14px;color:${SEC}"><span>Home</span><span>Insert</span><span>Draw</span><span style="color:#fff;font-weight:600;position:relative">Design<span class="abs" style="left:0;right:0;bottom:-9px;height:2.5px;background:${OR};border-radius:2px"></span></span><span>Review</span><span>View</span></div>`;
    // main slide
    const cur = clamp(Math.floor((t - T.PPT_BUILD) / T.SLIDE_DT), -1, T.NSLIDES - 1);
    s += `<div class="abs" style="left:12px;top:146px;width:336px;height:189px;border-radius:3px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.5)">${cur < 0 ? `<div style="width:336px;height:189px;background:#fff"><div style="position:absolute;left:28px;top:70px;font-size:20px;color:#bbb;font-family:'Inter Display';font-weight:600">Click to add title</div></div>` : slideBox(cur, sat((t - T.PPT_BUILD - cur * T.SLIDE_DT) / (T.SLIDE_DT * 0.78)), 336)}</div>`;
    // building status
    const prog = sat((t - T.PPT_SRC) / (T.PPT_DONE - T.PPT_SRC));
    s += `<div class="abs row" style="left:16px;top:350px;gap:8px">${U.orb(16, t)}<div style="font-size:13.5px;color:#fff;font-weight:500">${t < T.PPT_DONE ? `Personal AGI is building from 6 files… ${Math.round(prog * 100)}%` : 'Deck ready · 9 slides'}</div></div>
      <div class="abs" style="left:16px;right:16px;top:376px;height:3px;border-radius:2px;background:#333"><div style="width:${f3(prog * 100)}%;height:3px;border-radius:2px;background:${OR}"></div></div>`;
    // thumbnails grid
    for (let i = 0; i < T.NSLIDES; i++) {
      const ta = T.PPT_BUILD + i * T.SLIDE_DT + T.SLIDE_DT * 0.55;
      if (t < ta) continue;
      const k = sp(t, ta, 0.32, 0.65);
      const x = 16 + (i % 3) * 112, y = 392 + Math.floor(i / 3) * 74;
      s += `<div class="abs" style="left:${x}px;top:${y}px;width:104px;height:58.5px;border-radius:3px;overflow:hidden;transform:scale(${f3(lerp(0.6, 1, k))});opacity:${f3(sat(k * 2))};${i === cur ? `box-shadow:0 0 0 2px ${OR};` : ''}">${slideBox(i, 1, 104)}</div><div class="abs" style="left:${x}px;top:${y + 60}px;font-size:10px;color:${TER}">${i + 1}</div>`;
    }
    // source files card
    if (t > T.PPT_SRC - 0.05 && t < T.PPT_BUILD + 0.35) {
      const k = sp(t, T.PPT_SRC - 0.05, 0.35, 0.8), out = E.in(seg(t, T.PPT_BUILD, T.PPT_BUILD + 0.3));
      const files = [['Q2_Financials.xlsx', '#30d158'], ['Roadmap_2030.docx', '#0a84ff'], ['Customer_Calls.txt', '#8e8e93'], ['Board_Notes.pdf', '#ff453a'], ['Team_OKRs.xlsx', '#30d158'], ['Dana_Preferences.md', '#bf5af2']];
      let f = '';
      files.forEach(([n, c], i) => { const ti = T.PPT_SRC + 0.1 + i * 0.12, g = sat((t - ti) / 0.12); f += `<div class="row" style="gap:9px;height:25px;opacity:${f3(g)};transform:translateX(${f3((1 - E.out(g)) * 16)}px)"><div style="width:14px;height:17px;border-radius:2.5px;background:${c}"></div><div style="flex:1;font-size:13.5px">${n}</div><div style="width:14px;height:14px;opacity:${f3(sat((t - ti - 0.12) / 0.1))}">${GL.check('#30d158', 2.6)}</div></div>`; });
      s += `<div class="abs mat-banner" style="left:30px;top:${f3(150 + (1 - k) * 30)}px;width:300px;border-radius:16px;padding:12px 16px;opacity:${f3(sat(k * 2) * (1 - out))};transform:scale(${f3(1 - out * 0.08)})"><div class="row" style="gap:8px;margin-bottom:6px">${U.orb(14, t)}<div style="font-size:13px;font-weight:600;color:${SEC}">Reading work files</div></div>${f}</div>`;
    }
    return s + '</div>';
  };
  A.slideBox = slideBox;

  // ================================================================ Mail compose sheet (over PowerPoint)
  A.compose = function (t) {
    const body = 'Hi Dana,\n\nQ2 deck attached. Happy to walk you through it at 10.\n\nAlex';
    const n = Math.floor(sat((t - T.COMPOSE_TYPE) / 0.95) * body.length);
    const txt = esc(body.slice(0, n)).replace(/\n/g, '<br>');
    const press = t > T.SEND2 - 0.14 && t < T.SEND2 + 0.05;
    let s = `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:#1c1c1e;border-radius:12px 12px 0 0">`;
    s += `<div class="abs" style="left:16px;top:16px;font-size:17px;color:${BLUE}">Cancel</div>
      <div class="abs" style="left:0;width:${W}px;top:16px;text-align:center;font-size:17px;font-weight:600">Q2 Review</div>
      <div class="abs" style="right:14px;top:10px;width:32px;height:32px;border-radius:16px;background:${BLUE};display:flex;align-items:center;justify-content:center;${press ? 'filter:brightness(0.7);transform:scale(0.92);' : ''}"><div style="width:16px;height:16px">${GL.arrowUp()}</div></div>`;
    const row = (y, html) => `<div class="abs" style="left:16px;right:0;top:${y}px;height:44px;border-bottom:0.5px solid rgba(84,84,88,0.6);display:flex;align-items:center;font-size:16px">${html}</div>`;
    s += row(56, `<span style="color:${SEC}">To:&nbsp;</span><span style="color:${BLUE}">Dana Whitfield</span>`);
    s += row(100, `<span style="color:${SEC}">Cc/Bcc, From:&nbsp;</span><span style="color:${SEC}">alex@lumen.co</span>`);
    s += row(144, `<span style="color:${SEC}">Subject:&nbsp;</span><span>Q2 Review</span>`);
    s += `<div class="abs" style="left:16px;right:20px;top:202px;font-size:16.5px;line-height:23px">${txt}${t < T.SEND2 ? U.caret(t, t - 0.1) : ''}</div>`;
    s += `<div class="abs row" style="left:16px;top:350px;width:250px;height:64px;border-radius:12px;background:#2c2c2e;gap:12px;padding:0 12px">${appIcon('slides', 38, 'border-radius:9px')}<div><div style="font-size:15px;font-weight:600">Q2_Review.pptx</div><div style="font-size:13px;color:${SEC}">9 slides · 4.2 MB</div></div></div>`;
    return s + '</div>';
  };

  // ================================================================ Personal AGI chat
  const RECEIPTS = [
    ['7:29', 'Moved Standup to 10:00 AM'], ['7:29', 'Alarm adjusted to 8:15 AM'], ['7:29', 'Ordered oat flat white'],
    ['7:30', 'Booked Lucia’s Trattoria, 8 PM'], ['7:30', 'Replied to Sam'], ['7:30', 'Sent Q2_Review.pptx to Dana'],
    ['7:30', 'Rebooked flight UA 412'], ['7:30', 'Electricity bill: −30%'], ['7:30', 'Salary: +20%'], ['7:30', 'Portfolio optimized'], ['7:30', 'Interview completed · Northwind Labs'],
  ];
  const agiBub = (side, html, o = {}) => `<div style="align-self:${side === 'me' ? 'flex-end' : 'flex-start'};position:relative;margin:${o.gap == null ? 8 : o.gap}px ${side === 'me' ? 12 : 0}px 0 ${side === 'me' ? 0 : 12}px">
    <div class="bub ${side === 'me' ? 'me' : 'them'}" style="position:relative;${o.style || ''}">${html}${o.tail !== false ? U.tail(side, side === 'me' ? BLUE : '#262628') : ''}</div></div>`;
  const card = (icon, a, b, o = {}) => `<div style="align-self:flex-start;margin:6px 0 0 12px;width:262px;border-radius:16px;background:#1c1c1e;border:0.5px solid rgba(255,255,255,0.08);padding:11px 13px;display:flex;gap:11px;align-items:center">
    <div style="width:34px;height:34px;border-radius:9px;background:${o.bg || '#2c2c2e'};display:flex;align-items:center;justify-content:center;flex:none">${icon}</div>
    <div style="min-width:0"><div style="font-size:14.5px;font-weight:600;line-height:18px">${a}</div><div style="font-size:13px;color:${SEC};line-height:17px">${b}</div></div></div>`;
  const dots = (t) => { let d = ''; for (let i = 0; i < 3; i++) { const a = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 7.5 - i * 0.9), 2); d += `<div style="width:8px;height:8px;border-radius:4px;background:rgba(235,235,245,${f3(a * 0.65)})"></div>`; } return `<div style="align-self:flex-start;margin:8px 0 0 12px;position:relative"><div class="row" style="gap:4.5px;background:#262628;border-radius:18px;padding:12px 14px;position:relative">${d}${U.tail('them', '#262628')}</div></div>`; };
  A.agiMessages = function (t) {
    let m = '';
    // receipts card (everything it did this morning)
    let rows = '';
    RECEIPTS.forEach(([tm, x]) => { rows += `<div class="row" style="gap:8px;height:21px"><div style="width:12px;height:12px;flex:none">${GL.check('#30d158', 2.6)}</div><div style="flex:1;font-size:13.5px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x}</div><div class="tnum" style="font-size:11.5px;color:${TER}">${tm}</div></div>`; });
    m += `<div style="align-self:center;margin:6px 0 2px;font-size:11.5px;color:${TER};font-weight:500">Yesterday 11:48 PM</div>`;
    m += agiBub('me', 'Can you make tomorrow less stressful?');
    m += agiBub('them', 'Of course. Leave everything to me.');
    m += `<div style="align-self:center;margin:14px 0 2px;font-size:11.5px;color:${TER};font-weight:500">Today 7:29 AM</div>`;
    m += `<div style="align-self:flex-start;margin:6px 0 0 12px;width:290px;border-radius:18px;background:#1c1c1e;padding:10px 13px">${rows}</div>`;
    const G = (ta, html, o = {}) => { if (t < ta) return ''; const k = sp(t, ta, 0.36, 0.8); return U.grow(k, html, o); };
    m += G(T.SEND3, agiBub('me', 'Wait, you interviewed for a job?'), { origin: '100% 100%', dy: 34 });
    if (t > T.DOTS1 && t < T.REPLY1) m += dots(t);
    m += G(T.REPLY1, agiBub('them', 'Yes. They offered you twice your current salary. I’ve accepted.'), { origin: '0% 100%' });
    m += G(T.CARD1, card(`<div style="width:18px;height:18px">${GL.check('#fff', 2.6)}</div>`, 'Offer accepted · Northwind Labs', 'Senior Strategist · 2× salary · Starts Apr 1', { bg: '#30d158' }), { origin: '0% 100%' });
    m += G(T.REPORT, agiBub('them', 'Your mother says you should visit more often. I’ve booked your tickets.'), { origin: '0% 100%' });
    m += G(T.CARD2, card(`<div style="width:20px;height:20px">${ICONS.APPICON.airline()}</div>`, 'SFO → PDX · Sat, Mar 16', '9:05 AM · Seat 3A · Mom notified', { bg: '#1675d8' }), { origin: '0% 100%' });
    if (t > T.SEND4) { // sent with a "loud" effect: lands big, shakes, settles
      const u = t - T.SEND4, k = sp(t, T.SEND4, 0.36, 0.8);
      const big = 1 + 0.55 * Math.exp(-u * 5.5) * Math.max(0, Math.cos(u * 9)) * sat(u / 0.08);
      const shake = 5 * Math.exp(-u * 7) * Math.sin(u * 70) * sat((u - 0.1) / 0.05);
      m += U.grow(k, `<div style="align-self:flex-end;transform:translateX(${f3(shake)}px) scale(${f3(big)});transform-origin:100% 100%">${agiBub('me', 'STOP DOING EVERYTHING FOR ME.', { style: 'font-weight:600' })}</div>`, { origin: '100% 100%', dy: 34 });
    }
    if (t > T.DOTS2 && t < T.REPLY2A) m += dots(t);
    m += G(T.REPLY2A, agiBub('them', 'Understood. I’ll only handle important decisions.', { tail: false }), { origin: '0% 100%' });
    m += G(T.REPLY2B, agiBub('them', 'Based on my analysis, <b style="font-weight:600">97.4%</b> of your decisions are unnecessary.', { gap: 3 }), { origin: '0% 100%' });
    m += G(T.SEND5, agiBub('me', 'So what am I supposed to do now?'), { origin: '100% 100%', dy: 34 });
    if ((t > T.DOTS3[0] && t < T.DOTS3[1]) || (t > T.DOTS3[2] && t < T.REPLY3)) m += dots(t);
    m += G(T.REPLY3, agiBub('them', 'I’ve booked you a vacation. Please don’t interfere with productivity.'), { origin: '0% 100%' });
    m += G(T.CARD3, card(`<div style="width:20px;height:20px">${GL.sparkle('#fff')}</div>`, 'Bora Bora · 30 nights', 'Departs tomorrow 6:10 AM · One way', { bg: '#ff9f0a' }), { origin: '0% 100%' });
    return m;
  };
  // which typer is active, and keyboard windows
  const AGI_KB = () => [
    { t0: T.KB2, t1: T.SEND3 + 0.5, ty: T.TY2, send: T.SEND3 },
    { t0: T.KB3, t1: T.SEND4 + 0.6, ty: T.TY3, send: T.SEND4 },
    { t0: T.KB4, t1: T.SEND5 + 0.55, ty: T.TY4, send: T.SEND5, inline: { supp: 'osed' } },
  ];
  A.agi = function (t) {
    let kb = H, cur = null;
    for (const w of AGI_KB()) { if (t > w.t0 - 0.01 && t < w.t1 + 0.4) { kb = kbY(t, w.t0, w.t1); cur = w; } }
    const inputH = 50, inputTop = Math.min(kb, H - 30) - inputH;
    let s = `<div class="L" style="background:#000">`;
    s += `<div class="abs col" style="left:0;width:${W}px;top:110px;height:${f3(inputTop - 110 - 4)}px;justify-content:flex-end;overflow:hidden">${A.agiMessages(t)}</div>`;
    // header (blurred bar)
    const working = 0.5 + 0.5 * Math.sin(t * 2.4);
    s += `<div class="abs mat-bar" style="left:0;top:0;width:${W}px;height:110px;border-bottom:0.5px solid rgba(84,84,88,0.45)"></div>
      <div class="abs" style="left:8px;top:61px;width:11px;height:19px">${GL.chevL()}</div>
      <div class="abs" style="left:${W / 2 - 17}px;top:53px">${U.orb(34, t, { glow: 0.8 + 0.2 * working })}</div>
      <div class="abs row" style="left:0;width:${W}px;top:92px;justify-content:center;gap:3px;font-size:11.5px;color:#fff">Personal AGI<div style="width:5px;height:9px">${GL.chevR(SEC)}</div></div>
      <div class="abs" style="right:16px;top:62px;width:22px;height:18px"><svg viewBox="0 0 22 18"><g fill="${BLUE}"><rect x="1" y="9" width="4" height="8" rx="1"/><rect x="9" y="4" width="4" height="13" rx="1"/><rect x="17" y="1" width="4" height="16" rx="1"/></g></svg></div>`;
    // input bar
    let typed = '', caretT = -1;
    if (cur && t < cur.send) { typed = U.typedHtml(cur.ty, t, { inline: cur.inline }); caretT = cur.ty.at(t).t; }
    const focused = cur && t < cur.send + 0.05;
    const has = typed.length > 0;
    s += `<div class="abs" style="left:0;top:${f3(inputTop)}px;width:${W}px;height:${inputH + 40}px;background:#000"></div>
      <div class="abs" style="left:10px;top:${f3(inputTop + 9)}px;width:32px;height:32px;border-radius:16px;background:#2c2c2e;display:flex;align-items:center;justify-content:center"><div style="width:14px;height:14px">${GL.plus('#aeaeb2', 2.4)}</div></div>
      <div class="abs" style="left:50px;right:12px;top:${f3(inputTop + 8)}px;height:34px;border-radius:17px;border:1px solid #3a3a3c;padding:6px 40px 0 13px;font-size:16.5px;line-height:21px;white-space:nowrap;overflow:hidden">${has ? typed : ''}${focused ? U.caret(t, caretT < 0 ? cur.t0 : caretT, BLUE, 20) : ''}${has ? '' : `<span style="color:rgba(235,235,245,0.3);${focused ? 'margin-left:1px' : ''}">Message</span>`}</div>`;
    if (has || (cur && t > cur.send - 0.2 && t < cur.send)) {
      const pr = cur && t > cur.send - 0.13 && t < cur.send + 0.02;
      s += `<div class="abs" style="right:16px;top:${f3(inputTop + 12)}px;width:27px;height:27px;border-radius:14px;background:${BLUE};display:flex;align-items:center;justify-content:center;${pr ? 'filter:brightness(0.65);transform:scale(0.9);' : ''}"><div style="width:14px;height:14px">${GL.arrowUp()}</div></div>`;
    } else s += `<div class="abs" style="right:24px;top:${f3(inputTop + 15)}px;width:13px;height:19px">${GL.mic('#8e8e93')}</div>`;
    if (kb < H && cur) { const p = cur.ty.kb(t); s += U.keyboard(Object.assign({ y: kb }, p)); }
    return s + '</div>';
  };

  // ================================================================ Phone call (incoming + active, live transcript)
  const poster = (dim) => `<div class="L" style="background:linear-gradient(165deg,#f4b183 0%,#e37b7b 42%,#8e4a8f 78%,#3b2453 100%)"></div>
    <div class="L" style="background:radial-gradient(90% 60% at 30% 20%,rgba(255,236,200,0.45),rgba(255,236,200,0) 70%)"></div>
    <div class="L" style="background:#0b0710;opacity:${f3(dim)}"></div>`;
  A.call = function (t) {
    const active = t > T.CALL_ACTIVE;
    const ka = sp(t, T.CALL_ACTIVE, 0.5, 0.95);
    let s = `<div class="L" style="background:#000">${poster(active ? lerp(0, 0.62, sat(ka)) : 0)}`;
    if (!active) {
      s += `<div class="abs" style="left:24px;top:70px;font-size:16px;color:rgba(255,255,255,0.85);font-weight:500">mobile</div>
        <div class="abs" style="left:20px;top:84px;font-family:'Inter Display';font-weight:700;font-size:112px;line-height:112px;letter-spacing:-0.045em;color:#fff">Mom</div>`;
      const sm = (x, g, l) => `<div class="abs col" style="left:${x - 40}px;top:420px;width:80px;align-items:center;gap:6px"><div style="width:22px;height:22px">${g}</div><div style="font-size:13px;color:#fff;font-weight:500">${l}</div></div>`;
      s += sm(86, GL.alarm(), 'Remind Me') + sm(274, GL.message(), 'Message');
      const acc = t > T.ACCEPT - 0.12;
      s += `<div class="abs" style="left:${86 - 37}px;top:510px;width:74px;height:74px;border-radius:37px;background:#ff3b30;display:flex;align-items:center;justify-content:center"><div style="width:32px;height:14px">${GL.endcall()}</div></div><div class="abs" style="left:46px;top:592px;width:80px;text-align:center;font-size:13.5px;font-weight:500">Decline</div>`;
      s += `<div class="abs" style="left:${274 - 37}px;top:510px;width:74px;height:74px;border-radius:37px;background:#30d158;display:flex;align-items:center;justify-content:center;${acc ? 'filter:brightness(1.35);transform:scale(0.94);' : ''}"><div style="width:30px;height:30px">${GL.phone()}</div></div><div class="abs" style="left:234px;top:592px;width:80px;text-align:center;font-size:13.5px;font-weight:500">Accept</div>`;
      return s + '</div>';
    }
    const ended = t > T.CALL_END;
    const secs = Math.floor(t - T.CALL_ACTIVE);
    s += `<div class="abs" style="left:0;width:${W}px;top:66px;text-align:center;font-family:'Inter Display';font-size:30px;font-weight:600;letter-spacing:-0.02em">Mom</div>
      <div class="abs tnum" style="left:0;width:${W}px;top:104px;text-align:center;font-size:16px;color:rgba(255,255,255,0.75)">${ended ? 'Call Ended' : '0:' + String(secs).padStart(2, '0')}</div>`;
    // speaking-as-you chip
    const cur = T.LINES.find((l) => t >= l.t && t < l.t + l.d);
    const agiTalk = cur && cur.who === 'you';
    let wave = '';
    for (let i = 0; i < 11; i++) { const a = agiTalk ? 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + i * 1.7) * Math.sin(t * 5.3 + i * 0.6)) : 0.12; wave += `<div style="width:2.5px;height:${f3(3 + 13 * a)}px;border-radius:2px;background:#cdb8ff"></div>`; }
    s += `<div class="abs row" style="left:${(W - 290) / 2}px;top:134px;width:290px;height:34px;border-radius:17px;background:rgba(120,90,220,0.32);border:0.5px solid rgba(200,180,255,0.35);gap:8px;padding:0 12px;opacity:${f3(sat(ka * 2))}">${U.orb(16, t)}<div style="flex:1;font-size:13px;font-weight:600;color:#e8defd;white-space:nowrap">Personal AGI · speaking as you</div><div class="row" style="gap:2px;height:18px">${wave}</div></div>`;
    // live transcript
    let lines = '';
    for (const l of T.LINES) {
      if (t < l.t) break;
      const words = l.text.split(' '), n = Math.ceil(sat((t - l.t) / (l.d * 0.85)) * words.length);
      const k = sp(t, l.t, 0.35, 0.85);
      const lab = l.who === 'mom' ? `<span style="color:rgba(255,255,255,0.55)">Mom</span>` : `<span class="row" style="gap:5px;color:#cdb8ff">${U.orb(10, t, { glow: 0.6 })}You <span style="color:rgba(205,184,255,0.6);font-weight:500">· AGI voice</span></span>`;
      lines += U.grow(k, `<div style="padding:7px 0 5px"><div style="font-size:11.5px;font-weight:600;letter-spacing:0.01em;margin-bottom:2px">${lab}</div><div style="font-size:17px;line-height:22px;font-weight:500;color:${l.who === 'mom' ? '#fff' : '#efe8ff'}">${esc(words.slice(0, n).join(' '))}<span style="opacity:0.0">${esc(words.slice(n).join(' '))}</span></div></div>`, { dy: 10 });
    }
    s += `<div class="abs" style="left:16px;right:16px;top:182px;height:234px;border-radius:20px;background:rgba(20,14,28,0.45);backdrop-filter:blur(16px);opacity:${f3(sat(ka * 2))}"></div>
      <div class="abs row" style="left:32px;top:194px;gap:6px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.6);letter-spacing:0.04em;opacity:${f3(sat(ka * 2))}"><div style="width:7px;height:7px;border-radius:4px;background:#ff453a"></div>LIVE TRANSCRIPT</div>
      <div class="abs col" style="left:32px;right:28px;top:214px;height:194px;justify-content:flex-end;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 26px)">${lines}</div>`;
    // buttons
    const B = [['speaker', 'Speaker'], ['video', 'FaceTime'], ['micOff', 'Mute'], ['addcall', 'Add'], ['end', 'End'], ['keypad', 'Keypad']];
    B.forEach(([g, l], i) => {
      const cx = 70 + (i % 3) * 110, cy = 470 + Math.floor(i / 3) * 96;
      const isEnd = g === 'end', pr = isEnd && t > T.END_PRESS - 0.1 && t < T.CALL_END + 0.1;
      s += `<div class="abs" style="left:${cx - 34}px;top:${cy - 34}px;width:68px;height:68px;border-radius:34px;${isEnd ? `background:#ff3b30;${pr ? 'filter:brightness(1.3);' : ''}` : 'background:rgba(255,255,255,0.16);backdrop-filter:blur(12px)'};display:flex;align-items:center;justify-content:center;opacity:${f3(sat(ka * 1.5))};${ended && !isEnd ? 'opacity:0.4;' : ''}"><div style="width:${isEnd ? 30 : 26}px;height:${isEnd ? 13 : 24}px">${isEnd ? GL.endcall() : GL[g]()}</div></div>
        <div class="abs" style="left:${cx - 40}px;top:${cy + 39}px;width:80px;text-align:center;font-size:12.5px;font-weight:500;opacity:${f3(sat(ka * 1.5) * (ended && !isEnd ? 0.4 : 1))}">${l}</div>`;
    });
    return s + '</div>';
  };

  // ================================================================ Activity dashboard
  A.dash = function (t) {
    const t0 = T.DASH_OPEN + 0.35;
    const k = E.outQuint(sat((t - t0) / 1.5));
    const fmt = (n) => Math.round(n).toLocaleString('en-US');
    let s = `<div class="L" style="background:#000">`;
    s += `<div class="abs row" style="left:8px;top:58px;gap:3px;color:${BLUE};font-size:17px"><div style="width:11px;height:19px">${GL.chevL()}</div>Chat</div>`;
    s += `<div class="abs" style="left:16px;top:88px;font-family:'Inter Display';font-weight:700;font-size:32px;letter-spacing:-0.02em">Activity</div>
      <div class="abs" style="left:16px;top:130px;font-size:13.5px;color:${SEC}">Today · Monday, March 11, 2030</div>`;
    // card A: AI actions
    s += `<div class="abs" style="left:12px;right:12px;top:158px;height:192px;border-radius:16px;background:#1c1c1e"></div>
      <div class="abs row" style="left:26px;top:170px;gap:6px">${U.orb(13, t)}<span style="font-size:12.5px;font-weight:600;letter-spacing:0.03em;color:${SEC}">AI ACTIONS</span></div>
      <div class="abs disp tnum" style="left:24px;top:188px;font-weight:700;font-size:54px;line-height:60px;letter-spacing:-0.03em;color:#fff">${fmt(1284 * k + Math.max(0, Math.floor((t - t0 - 3.55) / 0.3)))}</div>
      <div class="abs" style="left:200px;top:204px;font-size:12.5px;line-height:16px;color:${SEC}">while you slept<br>and since 7:29 AM</div>`;
    const HB = [64, 71, 58, 80, 92, 77, 98, 244];
    let bars = '';
    for (let h = 0; h < 24; h++) {
      const v = h < 8 ? HB[h] : 0, g = E.out(sat((t - t0 - 0.15 - h * 0.035) / 0.6));
      bars += `<div class="abs" style="left:${26 + h * 12.8}px;bottom:${640 - 326}px;width:8px;height:${f3(Math.max(2, (v / 244) * 66 * g))}px;border-radius:2.5px;background:${h === 7 ? '#a98bff' : v ? '#6c55c9' : '#2c2c2e'}"></div>`;
    }
    s += bars + `<div class="abs" style="left:26px;right:24px;top:330px;font-size:10.5px;color:${TER};display:flex;justify-content:space-between"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span></div>`;
    // card B: human interactions
    const k2 = E.outQuint(sat((t - t0 - 0.5) / 1.0));
    s += `<div class="abs" style="left:12px;right:12px;top:360px;height:142px;border-radius:16px;background:#1c1c1e"></div>
      <div class="abs" style="left:26px;top:372px;font-size:12.5px;font-weight:600;letter-spacing:0.03em;color:${SEC}">HUMAN INTERACTIONS</div>
      <div class="abs disp tnum" style="left:24px;top:388px;font-weight:700;font-size:54px;line-height:60px;letter-spacing:-0.03em;color:#fff">${Math.round(3 * k2)}</div>`;
    const HI = [['7:30 AM', 'Asked a question'], ['7:31 AM', 'Raised voice (all caps)'], ['7:31 AM', 'Opened Agent Network']];
    HI.forEach(([a, b], i) => { const g = sat((t - t0 - 0.8 - i * 0.18) / 0.3); s += `<div class="abs row" style="left:84px;top:${390 + i * 22}px;gap:8px;opacity:${f3(g)}"><span class="tnum" style="font-size:12px;color:${TER};width:52px">${a}</span><span style="font-size:13.5px;color:#fff">${b}</span></div>`; });
    s += `<div class="abs" style="left:26px;top:466px;font-size:12.5px;color:#ff9f0a;opacity:${f3(sat((t - t0 - 1.4) / 0.3))}">0.23% of today’s activity · Reducing</div>`;
    // card C: categories
    const C = [['Work', 512, '#a98bff'], ['Finance', 187, '#30d158'], ['Social', 214, '#64d2ff'], ['Family', 96, '#ff9f0a'], ['Travel', 54, '#ff6482'], ['Other', 221, '#8e8e93']];
    s += `<div class="abs" style="left:12px;right:12px;top:512px;height:118px;border-radius:16px;background:#1c1c1e"></div>`;
    C.forEach(([a, n, c], i) => {
      const x = 26 + (i % 2) * 164, y = 524 + Math.floor(i / 2) * 34, g = E.out(sat((t - t0 - 0.3 - i * 0.08) / 0.8));
      s += `<div class="abs" style="left:${x}px;top:${y}px;width:150px"><div class="row" style="justify-content:space-between;font-size:12.5px"><span style="color:#fff">${a}</span><span class="tnum" style="color:${SEC}">${fmt(n * g)}</span></div><div style="margin-top:4px;height:5px;border-radius:3px;background:#2c2c2e"><div style="width:${f3((n / 512) * 100 * g)}%;height:5px;border-radius:3px;background:${c}"></div></div></div>`;
    });
    return s + '</div>';
  };

  G.A = A;
})(window);
