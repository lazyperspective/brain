// Composition: which surfaces are on screen at t, their transitions (iOS springs), banners, island, chrome.
(function (G) {
  const { clamp, lerp, sat, seg, E, spring, sp, esc, f3, clock } = K;
  const { appIcon, GL } = ICONS;
  const W = 360, H = 640;

  // ---------------- notifications ----------------
  const avatar = (txt, bg, app) => `<div style="position:relative;width:36px;height:36px"><div style="width:36px;height:36px;border-radius:18px;background:${bg};display:flex;align-items:center;justify-content:center;font-weight:600;font-size:15px;color:#fff">${txt}</div><div style="position:absolute;right:-3px;bottom:-3px;border-radius:5px;box-shadow:0 0 0 1.5px rgba(40,40,44,0.9)">${appIcon(app, 16, 'border-radius:4.5px')}</div></div>`;
  const N = {
    agi: { app: 'agi', title: 'Personal AGI', body: 'Good morning. You slept poorly, so I’ve moved your first meeting to 10 AM, adjusted your alarm, and ordered your usual coffee.' },
    sam: { app: 'chat', title: 'Sam', body: 'Dinner tonight at 8?', custom: avatar('S', 'linear-gradient(160deg,#8fb8ff,#3f6fd8)', 'chat') },
    dana: { app: 'mail', title: 'Dana Whitfield', custom: avatar('DW', 'linear-gradient(180deg,#a5a5ab,#6e6e74)', 'mail'), bodyHtml: '<b style="font-weight:600">Q2 deck before noon</b><br>Hi Alex, I need the Q2 presentation in my inbox before noon. Thanks.' },
    storm: [
      { app: 'airline', title: 'Skyward', body: 'Flight delayed. Rebooked automatically.' },
      { app: 'volt', title: 'Volt Energy', body: 'Electricity bill reduced by 30%.' },
      { app: 'agi', title: 'Personal AGI', body: 'Negotiated a 20% salary increase.' },
      { app: 'invest', title: 'Fathom', body: 'Investment portfolio optimized.' },
      { app: 'agi', title: 'Personal AGI', body: 'Found a better job opportunity. Interview completed.' },
    ],
    meet: { app: 'agi', title: 'Personal AGI', body: 'All 47 meetings canceled. Work completed.' },
    dnd: { app: 'focus', title: 'Do Not Disturb', body: 'Your AGI has enabled Do Not Disturb for the next 30 days.' },
  };
  const BANNER_R = { x: 8, y: 54, w: 344, h: 80, r: 21 };
  const NC_TOP = 196;

  // ---------------- transitions ----------------
  function zoomWrap(inner, k, R, iconId) {
    const kk = Math.max(0, k);
    const x = lerp(R.x, 0, kk), y = lerp(R.y, 0, kk), w = lerp(R.w, W, kk), h = lerp(R.h, H, kk);
    const sc = w / W, offY = (h - H * sc) / 2;
    const rad = kk > 0.992 ? 0 : lerp(R.r || 13, 40, sat(kk));
    const iconA = 1 - sat(kk / 0.32);
    let ic = '';
    if (iconId && iconA > 0) { const s = Math.min(w, h); ic = `<div class="abs" style="left:${f3((w - s) / 2)}px;top:${f3((h - s) / 2)}px;opacity:${f3(iconA)}">${appIcon(iconId, f3(s), `border-radius:${f3(rad)}px`)}</div>`; }
    return `<div class="abs" style="left:${f3(x)}px;top:${f3(y)}px;width:${f3(w)}px;height:${f3(h)}px;border-radius:${f3(rad)}px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,${f3(0.5 * (1 - sat(kk)))})">
      <div style="position:absolute;left:0;top:${f3(offY)}px;width:${W}px;height:${H}px;transform:scale(${f3(sc)});transform-origin:0 0;opacity:${f3(sat((kk - 0.04) / 0.25))}">${inner}</div>${ic}</div>`;
  }
  // swipe-between-apps card: x offset, scale & radius at progress p (0 = resting, 1 = gone)
  function card(inner, x, sc, rad, extra = '') {
    return `<div class="abs" style="left:0;top:0;width:${W}px;height:${H}px;transform:translateX(${f3(x)}px) scale(${f3(sc)});border-radius:${f3(rad)}px;overflow:hidden;${extra}">${inner}</div>`;
  }

  // ---------------- app spans ----------------
  const SEQ = [
    { id: 'calendar', a: T.CAL_OPEN, b: T.SW_TABLE, enter: 'zoom', from: () => U.iconRect('calendar'), icon: 'calendar' },
    { id: 'table', a: T.SW_TABLE, b: T.SW_CHAT, enter: 'switch' },
    { id: 'chat', a: T.SW_CHAT, b: T.MAIL_OPEN + 0.7, enter: 'switch' },
    { id: 'mail', a: T.MAIL_OPEN, b: T.SW_PPT, enter: 'zoom', from: () => BANNER_R },
    { id: 'ppt', a: T.SW_PPT, b: T.CLOSE_PPT, enter: 'switch', exit: 'zoom', to: () => U.iconRect('slides'), icon: 'slides' },
    { id: 'agi', a: T.AGI_OPEN, b: T.HOME2, enter: 'zoom', from: () => ({ x: 8, y: NC_TOP, w: 344, h: 62, r: 21 }), exit: 'zoom', to: () => U.iconRect('agi'), icon: 'agi' },
    { id: 'network', a: T.NET_OPEN, b: T.DASH_OPEN + 0.7, enter: 'zoom', from: () => U.iconRect('network'), icon: 'network' },
    { id: 'dash', a: T.DASH_OPEN, b: T.BACK_CHAT, enter: 'zoom', from: () => BANNER_R, exit: 'pop' },
    { id: 'agi', a: T.BACK_CHAT, b: 1e9, enter: 'popunder' },
  ];
  const SWITCH = (t, a) => sp(t, a, 0.5, 0.95);
  function appSurface(id, t) {
    if (id === 'ppt') {
      let s = A.ppt(t);
      if (t > T.COMPOSE - 0.01 && t < T.SEND2 + 0.6) {
        const up = sp(t, T.COMPOSE, 0.45, 0.92), dn = E.in(seg(t, T.SEND2 + 0.04, T.SEND2 + 0.42));
        const pres = up * (1 - dn);
        const y = 50 + (H - 50) * (1 - up) + H * dn;
        s = `<div class="L" style="background:#000"></div><div class="L" style="transform:translateY(${f3(10 * pres)}px) scale(${f3(1 - 0.07 * pres)});border-radius:${f3(12 * pres)}px;overflow:hidden;filter:brightness(${f3(1 - 0.4 * pres)})">${s}</div>
          <div class="abs" style="left:0;top:${f3(y)}px;width:${W}px;height:${H}px">${A.compose(t)}</div>`;
      }
      return s;
    }
    if (id === 'network') return NET.render(t);
    return A[id](t);
  }
  function appsLayer(t) {
    let out = '';
    for (let i = 0; i < SEQ.length; i++) {
      const S = SEQ[i], nx = SEQ[i + 1];
      if (t < S.a) continue;
      const exitDur = S.exit === 'zoom' ? 0.75 : S.exit === 'pop' ? 0.65 : nx && nx.enter === 'switch' ? 0.75 : 0;
      if (t >= S.b + exitDur) continue;
      let inner = appSurface(S.id, t), html;
      // exits
      if (t >= S.b && S.exit === 'zoom') {
        const k = 1 - sp(t, S.b, 0.42, 0.92);
        html = zoomWrap(inner, k, S.to(), S.icon);
      } else if (t >= S.b && nx && nx.enter === 'switch') {
        const p = SWITCH(t, nx.a);
        html = card(inner, (W + 14) * p, 1 - 0.075 * Math.sin(Math.PI * sat(p)), 38 * Math.sin(Math.PI * sat(p)));
      } else if (t >= S.b && S.exit === 'pop') {
        const p = sp(t, S.b, 0.48, 1);
        html = card(inner, W * p, 1, 0, `box-shadow:-8px 0 24px rgba(0,0,0,${f3(0.5 * (1 - p))})`);
      } else if (S.enter === 'zoom' && t - S.a < 0.9) {
        const k = sp(t, S.a, 0.44, 0.86);
        html = zoomWrap(inner, k, S.from(), S.icon);
      } else if (S.enter === 'switch' && t - S.a < 0.9) {
        const p = SWITCH(t, S.a);
        html = card(inner, -(W + 14) * (1 - p), 1 - 0.075 * Math.sin(Math.PI * sat(p)), 38 * Math.sin(Math.PI * sat(p)));
      } else if (S.enter === 'popunder' && t - S.a < 0.9) {
        const p = sp(t, S.a, 0.48, 1);
        html = card(inner, -W * 0.3 * (1 - p), 1, 0) + `<div class="L" style="background:#000;opacity:${f3(0.35 * (1 - p))}"></div>`;
      } else html = `<div class="L">${inner}</div>`;
      out += html;
    }
    return out;
  }
  // is some app fully covering the home screen?
  function homeVisible(t) {
    if (t < T.SLIDE_UP) return false;
    if (t < T.CAL_OPEN + 0.6) return true;
    if (t > T.CLOSE_PPT && t < T.AGI_OPEN + 0.6) return true;
    if (t > T.HOME2 && t < T.NET_OPEN + 0.6) return true;
    return false;
  }
  function homeLayer(t) {
    const o = { t };
    o.fly = t < T.CAL_OPEN + 1 ? sp(t, T.SLIDE_UP + 0.05, 0.55, 0.84) : 1;
    if (t > T.HOME2 - 0.1) { o.newApp = 1; o.install = sat((t - T.HOME2 - 0.15) / 0.85); }
    // app open/close: icons zoom past the camera
    let z = 1, al = 1;
    const openAt = [T.CAL_OPEN, T.AGI_OPEN, T.NET_OPEN], closeAt = [T.CLOSE_PPT, T.HOME2];
    for (const a of openAt) if (t > a && t < a + 1) { const k = sp(t, a, 0.44, 0.86); z = 1 + 0.12 * k; al = 1 - sat(k * 1.1); }
    for (const b of closeAt) if (t > b && t < b + 1) { const k = sp(t, b, 0.42, 0.92); z = 1 + 0.12 * (1 - k); al = sat(k * 1.2); }
    o.zoom = z; o.alpha = al;
    if (t > T.CAL_TAP && t < T.CAL_OPEN + 0.05) o.press = { id: 'calendar', k: 1 };
    if (t > T.NET_TAP && t < T.NET_OPEN + 0.08) o.press = { id: 'network', k: 1 };
    o.widgetLine = t > T.HOME2 ? 'Handling 1,201 things.' : 'Everything is handled.';
    return U.homeScreen(o);
  }

  // ---------------- cover sheet: lock screen & notification center ----------------
  function coverLayer(t) {
    // morning lock screen
    if (t < T.SLIDE_UP + 0.7) {
      const aod = 1 - E.out(seg(t, T.WAKE, T.WAKE + 0.45));
      const nots = [];
      if (t > T.WA) nots.push({ n: Object.assign({ time: 'now' }, N.sam), k: sp(t, T.WA, 0.45, 0.78) });
      if (t > T.WAKE) nots.push({ n: Object.assign({ time: t > T.WA ? '1m ago' : 'now' }, N.agi), k: sp(t, T.WAKE + 0.08, 0.5, 0.78) });
      const y = -H * sp(t, T.SLIDE_UP, 0.42, 1);
      const fade = 1 - sat((t - T.SLIDE_UP) / 0.35);
      return `<div class="L" style="transform:translateY(${f3(y)}px)">${U.lockScreen({ t, aod, notifs: nots, listBottom: 108 })}<div class="L" style="opacity:${f3(1 - fade)};background:#000;pointer-events:none;opacity:0"></div></div>`;
    }
    // notification center pulled down by the user
    if (t > T.NC_PULL && t < T.AGI_OPEN + 0.6) {
      const pull = sp(t, T.NC_PULL, 0.46, 0.9);
      const out = sat((t - T.AGI_OPEN) / 0.22);
      const y = -H * (1 - pull) - 40 * out;
      let list = '';
      const items = [];
      N.storm.forEach((n, i) => { if (t > T.STORM[i]) items.unshift({ n: Object.assign({ time: 'now' }, n), k: sp(t, T.STORM[i], 0.42, 0.8), i }); });
      items.push({ n: Object.assign({ time: '1m ago' }, N.dana), k: 1 }, { n: Object.assign({ time: '1m ago' }, N.sam), k: 1 }, { n: Object.assign({ time: '2m ago' }, N.agi), k: 1 });
      for (const it of items) {
        const press = it.i === 4 && t > T.TAP_INT - 0.12 && t < T.AGI_OPEN + 0.1 ? 1 : 0;
        list += `<div data-grow="${f3(sat(it.k))}" style="overflow:visible;flex:none"><div style="padding-bottom:8px;transform:translateY(${f3((1 - it.k) * -18)}px) scale(${f3(0.94 + 0.06 * sat(it.k))});transform-origin:50% 0%">${U.notif(it.n, { press, alpha: sat(it.k * 1.8) * (it.i === 4 ? 1 : 1 - out) })}</div></div>`;
      }
      const cl = clock(t);
      return `<div class="L" style="transform:translateY(${f3(y)}px);opacity:${f3(1 - out * 0.0)}">
        <div class="L" style="opacity:${f3(1 - out)}">${U.wall()}<div class="L" style="background:rgba(0,0,0,0.18)"></div>
        <div class="abs disp" style="left:0;width:${W}px;top:74px;text-align:center;font-weight:600;font-size:19px;color:rgba(255,255,255,0.96)">Monday, March 11</div>
        <div class="abs disp" style="left:0;width:${W}px;top:88px;text-align:center;font-weight:600;font-size:94px;line-height:100px;letter-spacing:-0.035em;color:rgba(255,255,255,0.96)">${cl.str}</div></div>
        <div class="abs col" style="left:8px;width:344px;top:${NC_TOP}px">${list}</div>
        <div class="abs" style="left:${(W - 128) / 2}px;top:${H - 14}px;width:128px;height:5px;border-radius:3px;background:#fff;opacity:${f3(1 - out)}"></div>
      </div>`;
    }
    return '';
  }

  // ---------------- incoming / active call overlay ----------------
  function callLayer(t) {
    if (t < T.CALL_IN || t > T.CALL_GONE) return '';
    const k = sp(t, T.CALL_IN, 0.42, 1), out = E.inOut(seg(t, T.CALL_GONE - 0.38, T.CALL_GONE));
    // full-screen incoming call drops in from the top; after hang-up it slides back up
    return `<div class="L" style="transform:translateY(${f3(-H * (1 - k) - H * out)}px);box-shadow:0 10px 40px rgba(0,0,0,0.5)">${A.call(t)}</div>`;
  }

  // ---------------- banners ----------------
  function bannerLayer(t) {
    let s = '';
    const B = [
      { n: N.dana, a: T.MAIL_BANNER, tap: T.MAIL_TAP, gone: T.MAIL_OPEN },
      { n: N.meet, a: T.MEET_BANNER, tap: T.DASH_TAP, gone: T.DASH_OPEN },
      { n: N.dnd, a: T.DND_BANNER, gone: 1e9 },
    ];
    for (const b of B) {
      if (t < b.a || t > b.gone + 0.02) continue;
      const k = sp(t, b.a, 0.5, 0.74);
      const press = b.tap && t > b.tap - 0.12 ? 1 : 0;
      s += `<div class="abs" style="left:8px;top:${BANNER_R.y}px;transform-origin:50% -40px;transform:translateY(${f3(lerp(-46, 0, k))}px) scale(${f3(lerp(0.3, 1, k))})">${U.notif(Object.assign({ time: 'now' }, b.n), { banner: 1, press, alpha: sat(k * 2.4), style: 'position:absolute;left:0;top:0;box-shadow:0 8px 30px rgba(0,0,0,0.45)' })}</div>`;
    }
    return s;
  }

  // ---------------- Dynamic Island ----------------
  const ISL = [
    { a: T.UNLOCK - 0.1, b: T.CLOSE_PPT + 0.2, kind: 'agi' },
    { a: T.NET_OPEN + 0.6, b: T.MEET_BANNER + 1.2, kind: 'agi' },
    { a: T.DND, b: T.DND_BANNER - 0.12, kind: 'dnd' },
    { a: T.DND_BANNER + 0.6, b: 1e9, kind: 'agi' },
  ];
  function islandLayer(t) {
    let w = 122, h = 36, html = '';
    for (const s of ISL) {
      if (t < s.a) continue;
      const kin = sp(t, s.a, 0.5, 0.7), kout = t > s.b ? sp(t, s.b, 0.42, 0.85) : 0;
      const k = clamp(kin * (1 - kout), -0.2, 1.3);
      if (k <= 0.0001 && t > s.b + 1) continue;
      const tw = s.kind === 'dnd' ? 300 : 168, th = s.kind === 'dnd' ? 58 : 36;
      w = lerp(w, tw, k); h = lerp(h, th, k);
      const ca = sat((k - 0.55) * 2.5);
      if (s.kind === 'agi') {
        let bars = '';
        for (let i = 0; i < 4; i++) { const a = 0.3 + 0.7 * Math.abs(Math.sin(t * (5.1 + i * 1.3) + i)); bars += `<div style="width:3px;height:${f3(4 + 10 * a)}px;border-radius:2px;background:#b69bff"></div>`; }
        html = `<div class="abs" style="left:9px;top:8px;opacity:${f3(ca)}">${U.orb(20, t, { glow: 0.9 })}</div><div class="abs row" style="right:12px;top:0;height:36px;gap:2.5px;opacity:${f3(ca)}">${bars}</div>`;
      } else if (s.kind === 'dnd') {
        html = `<div class="abs row" style="left:12px;top:11px;gap:10px;opacity:${f3(ca)}"><div style="width:36px;height:36px;border-radius:18px;background:#5e5ce6;display:flex;align-items:center;justify-content:center"><div style="width:18px;height:18px">${GL.moon()}</div></div><div><div style="font-size:15px;font-weight:600;line-height:18px">Do Not Disturb</div><div style="font-size:13px;color:#a5a4ff;line-height:16px">On for 30 days</div></div></div><div class="abs" style="right:18px;top:19px;font-size:15px;font-weight:600;color:#a5a4ff;opacity:${f3(ca)}">On</div>`;
      }
    }
    return U.island({ w, h, html });
  }
  // padlock (lock screen), opens by itself
  function padlock(t) {
    if (t > T.SLIDE_UP + 0.4) return '';
    const aod = 1 - E.out(seg(t, T.WAKE, T.WAKE + 0.45));
    const open = E.outQuint(seg(t, T.UNLOCK, T.UNLOCK + 0.28));
    const y = -H * sp(t, T.SLIDE_UP, 0.42, 1);
    return `<div class="abs" style="left:${W / 2 - 8}px;top:${f3(52 + y)}px;width:16px;height:21px;opacity:${f3(1 - aod * 0.6)}"><svg viewBox="0 0 20 26"><path d="M5 11V7.5a5 5 0 0 1 10 0${open > 0 ? '' : 'V11'}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" transform="translate(${f3(open * 8.5)} ${f3(-open * 3)})"/><rect x="1.5" y="10.5" width="17" height="14" rx="3.4" fill="#fff"/></svg></div>`;
  }

  // ---------------- frame ----------------
  function frame(t) {
    const L = {};
    L.home = homeVisible(t) ? homeLayer(t) : '';
    L.apps = appsLayer(t);
    L.cover = coverLayer(t) + padlock(t);
    // a notification tapped in Notification Center expands into the app ABOVE the sheet
    if (t > T.AGI_OPEN && t < T.AGI_OPEN + 0.7) { L.home += L.cover; L.cover = ''; }
    L.call = callLayer(t);
    L.banners = bannerLayer(t);
    const aod = 1 - E.out(seg(t, T.WAKE, T.WAKE + 0.45));
    L.status = U.statusBar({ t, alpha: 1 - aod });
    L.island = islandLayer(t);
    const kbUp = false;
    L.homebar = t > T.SLIDE_UP + 0.3 && !(t > T.NC_PULL && t < T.AGI_OPEN + 0.5) ? U.homeBar(1) : t < T.SLIDE_UP ? U.homeBar(1 - aod) : '';
    const black = sat((t - T.LOCK) / 0.16);
    L.dim = black > 0 ? `<div class="L" style="background:#000;opacity:${f3(black)}"></div>` : '';
    return L;
  }
  G.STORY = { frame, duration: T.DURATION, N };
})(window);
