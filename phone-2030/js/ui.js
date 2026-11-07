// iOS-style components, drawn by hand: status bar, Dynamic Island, wallpaper, lock screen, home screen,
// notifications, banners, keyboard (+ predictive bar), chat bubbles, generic nav bars.
(function (G) {
  const { clamp, lerp, sat, seg, E, spring, sp, esc, f3, clock, hash, rng } = K;
  const { appIcon, GL, APPICON } = ICONS;
  const W = 360, H = 640;
  const U = {};

  // ---------------------------------------------------------------- wallpaper (generated once)
  U.initWallpaper = async function () {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    const g = c.getContext('2d');
    let gr = g.createLinearGradient(0, 0, 0, 1920);
    gr.addColorStop(0, '#05081a'); gr.addColorStop(0.35, '#121a44'); gr.addColorStop(0.62, '#3a2463'); gr.addColorStop(0.82, '#8a3a6a'); gr.addColorStop(1, '#e0794f');
    g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
    const blob = (x, y, r, col, a) => { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, col.replace('A', a)); q.addColorStop(1, col.replace('A', 0)); g.fillStyle = q; g.fillRect(0, 0, 1080, 1920); };
    blob(820, 1650, 900, 'rgba(255,150,90,A)', 0.55);
    blob(150, 1300, 700, 'rgba(160,70,200,A)', 0.45);
    blob(900, 500, 800, 'rgba(60,90,220,A)', 0.35);
    blob(300, 200, 600, 'rgba(40,60,160,A)', 0.3);
    // soft dune lines
    g.globalCompositeOperation = 'screen';
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      const y0 = 1180 + k * 95;
      g.moveTo(-50, y0);
      for (let x = 0; x <= 1130; x += 20) g.lineTo(x, y0 + Math.sin(x / 260 + k * 1.3) * 60 + Math.sin(x / 90 + k) * 8);
      g.lineTo(1130, 1920); g.lineTo(-50, 1920); g.closePath();
      g.fillStyle = `rgba(255,${120 + k * 12},${120 - k * 6},${0.05 + k * 0.012})`; g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    // grain (deterministic) to avoid banding
    const id = g.getImageData(0, 0, 1080, 1920), d = id.data, r = rng(2030);
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 5; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
    const toURL = (cv) => new Promise((res) => cv.toBlob((b) => res(URL.createObjectURL(b)), 'image/png'));
    U.WALL = await toURL(c);
    const b = document.createElement('canvas'); b.width = 540; b.height = 960; const bg = b.getContext('2d');
    bg.filter = 'blur(28px) saturate(1.3) brightness(0.62)'; bg.drawImage(c, -60, -60, 660, 1080);
    U.WALL_BLUR = await toURL(b);
    await Promise.all([U.WALL, U.WALL_BLUR].map((u) => new Promise((res) => { const im = new Image(); im.onload = res; im.src = u; })));
  };
  U.wall = (extra = '', blur = false) => `<div class="L" style="background:url(${blur ? U.WALL_BLUR : U.WALL}) center/cover;${extra}"></div>`;

  // ---------------------------------------------------------------- status bar
  // o: {t, color, alpha, rec(bool), battery}
  U.statusBar = function (o) {
    const c = o.color || '#fff', a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0.001) return '';
    const tm = clock(o.t).str;
    const pill = o.rec !== false ? `<div class="abs" style="left:${62 - 27}px;top:${18}px;width:54px;height:23px;border-radius:12px;background:#ff3b30"></div>` : '';
    return `<div class="L" style="height:52px;opacity:${f3(a)};pointer-events:none">
      ${pill}
      <div class="abs tnum" style="left:12px;width:100px;top:20px;text-align:center;font-weight:600;font-size:16px;line-height:19px;letter-spacing:-0.02em;color:${o.rec !== false ? '#fff' : c}">${tm}</div>
      <div class="abs row" style="right:20px;top:23.5px;gap:5px">${GL.signal(c)}${GL.wifi(c)}<div style="margin-left:1px">${GL.battery(o.battery || 0.87, c)}</div></div>
    </div>`;
  };

  // ---------------------------------------------------------------- Dynamic Island
  // shape {w,h,r,y} + content html; base pill 122x36 at y=11
  U.ISL = { w: 122, h: 36, y: 11 };
  U.island = function (s) {
    const w = s.w, h = s.h, r = Math.min(s.r == null ? h / 2 : s.r, h / 2);
    return `<div class="abs" style="left:${f3((W - w) / 2)}px;top:${f3(s.y == null ? 11 : s.y)}px;width:${f3(w)}px;height:${f3(h)}px;border-radius:${f3(r)}px;background:#000;overflow:hidden">${s.html || ''}</div>`;
  };
  // tiny glowing orb (the AGI's mark) as html
  U.orb = function (size, t, o = {}) {
    const p = 0.5 + 0.5 * Math.sin(t * (o.speed || 3.1));
    const glow = (o.glow == null ? 1 : o.glow) * (0.7 + 0.3 * p);
    const hue = o.hue == null ? 262 : o.hue;
    return `<div style="position:relative;width:${size}px;height:${size}px;flex:none">
      <div style="position:absolute;inset:${f3(-size * 0.55)}px;border-radius:50%;background:radial-gradient(circle, hsla(${hue},100%,78%,${f3(0.55 * glow)}) 0%, hsla(${hue},100%,70%,0) 68%)"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 38% 34%, #fff 0%, hsl(${hue - 6},100%,90%) 22%, hsl(${hue},92%,72%) 52%, hsl(${hue + 8},70%,48%) 82%, hsl(${hue + 12},70%,36%) 100%);box-shadow:0 0 ${f3(size * 0.5)}px hsla(${hue},100%,75%,${f3(0.6 * glow)})"></div>
    </div>`;
  };

  // ---------------------------------------------------------------- home indicator
  U.homeBar = (a = 1, c = '#fff') => (a <= 0 ? '' : `<div class="abs" style="left:${(W - 128) / 2}px;top:${H - 9 - 5}px;width:128px;height:5px;border-radius:3px;background:${c};opacity:${f3(a)}"></div>`);

  // ---------------------------------------------------------------- notification (lock screen / NC / banner)
  // n: {app, title, body, time, icon}
  U.notif = function (n, o = {}) {
    const cls = o.banner ? 'mat-banner' : 'mat-notif';
    const press = o.press || 0;
    const ico = n.custom || appIcon(n.icon || n.app, 36, 'border-radius:8.5px');
    const al = o.alpha == null ? 1 : o.alpha;
    return `<div class="notif ${cls}" style="width:${o.w || 344}px;${al < 1 ? `opacity:${f3(al)};` : ''}${press ? `transform:scale(${f3(1 - 0.035 * press)});filter:brightness(${f3(1 + 0.25 * press)});` : ''}${o.style || ''}">
      <div style="padding-top:1px">${ico}</div>
      <div style="flex:1;min-width:0">
        <div class="row" style="justify-content:space-between"><div class="ttl ell">${esc(n.title)}</div><div class="tm">${esc(n.time || 'now')}</div></div>
        <div class="bd">${n.bodyHtml || esc(n.body)}</div>
      </div>
    </div>`;
  };

  // ---------------------------------------------------------------- lock screen
  // o: {t, aod (0..1), lockOpen(0..1), notifs: [{n, k (appear 0..1), press}], clockAlpha, listAlpha, buttonsAlpha}
  U.lockScreen = function (o) {
    const aod = o.aod || 0;
    const cl = clock(o.t);
    const dimWall = `<div class="L" style="background:#000;opacity:${f3(aod * 0.82)}"></div>`;
    const cA = (o.clockAlpha == null ? 1 : o.clockAlpha);
    const clockCol = `rgba(${Math.round(lerp(255, 200, aod))},${Math.round(lerp(255, 205, aod))},${Math.round(lerp(255, 230, aod))},${f3(lerp(0.96, 0.55, aod))})`;
    let list = '';
    for (const it of o.notifs || []) {
      const k = it.k;
      list += `<div data-grow="${f3(sat(k))}" style="overflow:visible"><div style="padding-bottom:8px;transform:translateY(${f3((1 - k) * 26)}px) scale(${f3(0.94 + 0.06 * sat(k))});transform-origin:50% 100%">${U.notif(it.n, { press: it.press, alpha: sat(k * 1.6) })}</div></div>`;
    }
    const bA = (o.buttonsAlpha == null ? 1 : o.buttonsAlpha) * (1 - aod);
    const btn = (x, g) => `<div class="abs mat-round" style="left:${x - 25}px;top:${574 - 25}px;width:50px;height:50px;border-radius:25px;display:flex;align-items:center;justify-content:center;opacity:${f3(bA)}"><div style="width:22px;height:22px">${g}</div></div>`;
    return `<div class="L">${U.wall()}${dimWall}
      <div class="abs disp" style="left:0;width:${W}px;top:74px;text-align:center;font-weight:600;font-size:19px;letter-spacing:-0.005em;color:${clockCol};opacity:${f3(cA)}">Monday, March 11</div>
      <div class="abs disp" style="left:0;width:${W}px;top:88px;text-align:center;font-weight:600;font-size:94px;line-height:100px;letter-spacing:-0.035em;color:${clockCol};opacity:${f3(cA)}">${cl.str}</div>
      <div class="abs col" style="left:8px;width:344px;bottom:${o.listBottom || 112}px;justify-content:flex-end;opacity:${f3((o.listAlpha == null ? 1 : o.listAlpha) * (1 - aod))}">${list}</div>
      ${btn(52, GL.flashlight())}${btn(308, GL.camera())}
    </div>`;
  };

  // ---------------------------------------------------------------- home screen
  U.GRID = { x0: 26, y0: 62, cw: 58, gap: (W - 52 - 4 * 58) / 3, pitch: 90 };
  const HOME_APPS = [
    // row 2..4 (rows 0-1 are widgets)
    ['mail', 'Mail'], ['calendar', 'Calendar'], ['photos', 'Photos'], ['camera', 'Camera'],
    ['slides', 'PowerPoint'], ['maps', 'Maps'], ['weather', 'Weather'], ['notes', 'Notes'],
    ['airline', 'Skyward'], ['table', 'Tablekeeper'], ['invest', 'Fathom'], ['settings', 'Settings'],
  ];
  const TOP_APPS = [['clockapp', 'Clock'], ['health', 'Health'], ['music', 'Music']];
  const DOCK = [['phone', 'Phone'], ['browser', 'Browser'], ['chat', 'WhatsApp'], ['agi', 'Personal AGI']];
  U.iconRect = function (id) {
    const g = U.GRID;
    const i = HOME_APPS.findIndex((a) => a[0] === id);
    if (i >= 0) { const r = 2 + Math.floor(i / 4), c = i % 4; return { x: g.x0 + c * (g.cw + g.gap), y: g.y0 + r * g.pitch, w: g.cw, h: g.cw }; }
    const ti = TOP_APPS.findIndex((a) => a[0] === id);
    if (ti >= 0 || id === 'network') { const j = ti >= 0 ? ti : 3; return { x: g.x0 + (2 + j % 2) * (g.cw + g.gap), y: g.y0 + Math.floor(j / 2) * g.pitch, w: g.cw, h: g.cw }; }
    const d = DOCK.findIndex((a) => a[0] === id);
    if (d >= 0) return { x: g.x0 + d * (g.cw + g.gap), y: 559, w: g.cw, h: g.cw };
    return { x: 151, y: 291, w: 58, h: 58 };
  };
  // o: {t, newApp(0..1 visible), press:{id,k}, zoom (1..), alpha, fly (0..1 unlock fly-in), widgets}
  U.homeScreen = function (o) {
    const g = U.GRID, t = o.t;
    const fly = o.fly == null ? 1 : o.fly;
    let s = '';
    const icon = (id, label, r, k, extraBadge = '') => {
      const pr = o.press && o.press.id === id ? o.press.k : 0;
      const x = r.x, y = r.y;
      // unlock fly-in: icons start scaled up from screen centre and fade in
      const dx = (x + 29 - W / 2) * (1 - fly) * 0.35, dy = (y + 29 - H / 2) * (1 - fly) * 0.35;
      return `<div class="abs" style="left:${f3(x)}px;top:${f3(y)}px;width:58px;transform:translate(${f3(dx)}px,${f3(dy)}px) scale(${f3((1 + (1 - fly) * 0.5) * (1 - pr * 0.0))});opacity:${f3(sat(fly * 1.3) * (k == null ? 1 : k))}">
        <div style="position:relative">${appIcon(id, 58)}${pr ? `<div class="abs" style="inset:0;border-radius:13px;background:rgba(0,0,0,${f3(0.32 * pr)})"></div>` : ''}${extraBadge}</div>
        ${label ? `<div style="margin-top:5px;margin-left:-14px;width:86px;text-align:center;font-size:11.5px;line-height:13px;font-weight:500;letter-spacing:0;color:#fff;text-shadow:0 0 6px rgba(0,0,0,0.25);white-space:nowrap">${label}</div>` : ''}
      </div>`;
    };
    // widgets row (rows 0-1)
    const wy = g.y0, wh = g.cw + g.pitch, ww = g.cw * 2 + g.gap;
    const wfly = `transform:scale(${f3(1 + (1 - fly) * 0.3)});opacity:${f3(sat(fly * 1.3))}`;
    s += `<div class="abs" style="left:${g.x0}px;top:${wy}px;width:${ww}px;height:${wh}px;border-radius:21px;overflow:hidden;background:linear-gradient(160deg,#1d1640,#0b0a16);${wfly}">
        <div class="abs" style="left:14px;top:14px">${U.orb(26, t)}</div>
        <div class="abs" style="left:14px;top:60px;font-size:11.5px;font-weight:600;color:rgba(235,235,245,0.6);letter-spacing:0.02em">PERSONAL AGI</div>
        <div class="abs disp" style="left:14px;top:76px;font-size:19px;line-height:22px;font-weight:600;color:#fff;width:116px;letter-spacing:-0.02em">${o.widgetLine || 'Everything is handled.'}</div>
      </div>
`;
    TOP_APPS.forEach(([id, label]) => { s += icon(id, label, U.iconRect(id)); });
    HOME_APPS.forEach(([id, label]) => { s += icon(id, label, U.iconRect(id)); });
    if (o.newApp) {
      const r = U.iconRect('network');
      const ins = o.install == null ? 1 : o.install, done = ins >= 1;
      // iOS-style install: dimmed icon with a pie that fills, then the label + blue "new" dot
      let pie = '';
      if (!done) {
        const a = ins * Math.PI * 2, R = 13, cx = 29, cy = 29;
        const x = cx + R * Math.sin(a), y = cy - R * Math.cos(a);
        pie = `<div class="abs" style="inset:0;border-radius:13px;background:rgba(0,0,0,0.55)"></div><svg class="abs" style="left:0;top:0" width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="16" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2"/>${ins > 0.001 ? `<path d="M29 29V${cy - R}A${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${f3(x)} ${f3(y)}Z" fill="rgba(255,255,255,0.85)"/>` : ''}</svg>`;
      }
      s += `<div class="abs" style="left:${r.x}px;top:${r.y}px;width:58px;opacity:${f3(o.newApp * sat(fly * 1.3))}">
        <div style="position:relative">${appIcon('network', 58)}${pie}${o.press && o.press.id === 'network' ? `<div class="abs" style="inset:0;border-radius:13px;background:rgba(0,0,0,${f3(0.32 * o.press.k)})"></div>` : ''}</div>
        <div class="row" style="margin-top:5px;margin-left:-14px;width:86px;justify-content:center;gap:3px">${done ? '<div style="width:6px;height:6px;border-radius:3px;background:#0a84ff"></div>' : ''}<div style="font-size:11.5px;line-height:13px;font-weight:500;color:${done ? '#fff' : 'rgba(255,255,255,0.7)'};white-space:nowrap">${done ? 'Agent Network' : 'Installing…'}</div></div>
      </div>`;
    }
    // search pill
    s += `<div class="abs mat-dock row" style="left:${(W - 76) / 2}px;top:521px;width:76px;height:26px;border-radius:13px;justify-content:center;gap:4px;opacity:${f3(sat(fly * 1.3))}"><div style="width:11px;height:11px">${GL.search('rgba(255,255,255,0.85)')}</div><div style="font-size:12.5px;font-weight:500;color:rgba(255,255,255,0.9)">Search</div></div>`;
    // dock
    let dk = '';
    DOCK.forEach(([id]) => { dk += icon(id, '', U.iconRect(id)); });
    s += `<div class="abs mat-dock" style="left:10px;top:550px;width:340px;height:78px;border-radius:30px;opacity:${f3(sat(fly * 1.3))}"></div>${dk}`;
    const z = o.zoom || 1;
    return `<div class="L">${U.wall('filter:brightness(0.86)')}<div class="L" style="transform:scale(${f3(z)});opacity:${f3(o.alpha == null ? 1 : o.alpha)};transform-origin:${o.origin || '50% 50%'}">${s}</div></div>`;
  };

  // ---------------------------------------------------------------- keyboard
  U.KB = { h: 276, pred: 38, top: 44, kh: 40, gap: 10.5 };
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  U.keyRect = function (ch) {
    const k = U.KB, kw = 30.2, gx = 5.6;
    if (ch === ' ') return { x: 96, y: k.top + 3 * (k.kh + k.gap), w: 168, h: k.kh };
    if (ch === '\n') return { x: 270, y: k.top + 3 * (k.kh + k.gap), w: 87, h: k.kh };
    if (ch === '123') return { x: 3, y: k.top + 3 * (k.kh + k.gap), w: 87, h: k.kh };
    if (ch === 'shift') return { x: 3, y: k.top + 2 * (k.kh + k.gap), w: 42, h: k.kh };
    if (ch === 'back') return { x: 315, y: k.top + 2 * (k.kh + k.gap), w: 42, h: k.kh };
    const lc = ch.toLowerCase();
    for (let r = 0; r < 3; r++) {
      const i = ROWS[r].indexOf(lc); if (i < 0) continue;
      const n = ROWS[r].length, tw = n * kw + (n - 1) * gx, x0 = (W - tw) / 2;
      return { x: x0 + i * (kw + gx), y: k.top + r * (k.kh + k.gap), w: kw, h: k.kh };
    }
    // punctuation typed via the letter row in our model -> map to period/question near return (treated as letters on "." key)
    return { x: 270, y: k.top + 3 * (k.kh + k.gap), w: 87, h: k.kh, punct: true };
  };
  // o: {y (top), upper (bool), caps (bool), shiftOn, down: {key, k}, sugg:[a,b,c], hi (index), quote (index), sdown(index), ret}
  U.keyboard = function (o) {
    const k = U.KB;
    let s = '';
    const down = o.down || {};
    const isDown = (id) => down.key === id;
    for (let r = 0; r < 3; r++) for (const ch of ROWS[r]) {
      const R = U.keyRect(ch), lab = o.upper ? ch.toUpperCase() : ch;
      s += `<div class="key${isDown(ch) ? ' dn' : ''}" style="left:${f3(R.x)}px;top:${f3(R.y)}px;width:${f3(R.w)}px;height:${R.h}px;${o.upper ? '' : 'padding-bottom:3px;'}">${lab}</div>`;
    }
    const sh = U.keyRect('shift'), bk = U.keyRect('back');
    const shOn = o.shiftOn || o.caps;
    s += `<div class="key sp${isDown('shift') ? ' dn' : ''}" style="left:${sh.x}px;top:${sh.y}px;width:${sh.w}px;height:${sh.h}px;${shOn ? 'background:#fff;' : ''}"><div style="width:19px;height:19px;position:relative">${GL.shift(shOn, shOn ? '#000' : '#fff')}${o.caps ? '<div class="abs" style="left:4px;right:4px;bottom:-4px;height:1.8px;background:#000;border-radius:1px"></div>' : ''}</div></div>`;
    s += `<div class="key sp${isDown('back') ? ' dn' : ''}" style="left:${bk.x}px;top:${bk.y}px;width:${bk.w}px;height:${bk.h}px"><div style="width:23px;height:18px">${GL.backspace()}</div></div>`;
    const n1 = U.keyRect('123'), spc = U.keyRect(' '), rt = U.keyRect('\n');
    s += `<div class="key sp" style="left:${n1.x}px;top:${n1.y}px;width:${n1.w}px;height:${n1.h}px">123</div>`;
    s += `<div class="key${isDown(' ') ? ' dn' : ''}" style="left:${spc.x}px;top:${spc.y}px;width:${spc.w}px;height:${spc.h}px;font-size:15.5px">space</div>`;
    const retBlue = o.retBlue;
    s += `<div class="key sp${isDown('\n') || isDown('.') || isDown('?') ? ' dn' : ''}" style="left:${rt.x}px;top:${rt.y}px;width:${rt.w}px;height:${rt.h}px;${retBlue ? 'background:#0a84ff;' : ''}">${o.ret || 'return'}</div>`;
    // popup for letter keys
    if (down.key && down.key.length === 1 && /[a-z]/i.test(down.key) && down.pop !== false) {
      const R = U.keyRect(down.key), lab = o.upper ? down.key.toUpperCase() : down.key.toLowerCase();
      const pw = R.w + 22, ph = 56, px = clamp(R.x - 11, 1, W - pw - 1);
      s += `<div class="pop" style="left:${f3(px)}px;top:${f3(R.y - ph + 4)}px;width:${f3(pw)}px;height:${ph}px">${lab}</div>`;
      s += `<div class="abs" style="left:${f3(R.x)}px;top:${f3(R.y - 8)}px;width:${f3(R.w)}px;height:${R.h + 8}px;background:#6b6b6e;border-radius:0 0 5.5px 5.5px;z-index:3"></div>`;
    }
    // predictive bar
    let pb = '';
    const sg = o.sugg || ['', '', ''];
    for (let i = 0; i < 3; i++) {
      const txt = sg[i] || '';
      const hi = o.hi === i, dn = o.sdown === i;
      pb += `<div style="position:relative;flex:1;height:${k.pred - 6}px;display:flex;align-items:center;justify-content:center;border-radius:6px;${hi || dn ? `background:${dn ? '#8a8a8e' : '#5a5a5e'};` : ''}font-size:16px;color:#fff;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden">${o.quote === i && txt ? '“' + esc(txt) + '”' : esc(txt)}</div>`;
      if (i < 2) pb += `<div style="width:1px;height:22px;background:rgba(255,255,255,${hi || o.hi === i + 1 ? 0 : 0.16})"></div>`;
    }
    const bot = k.top + 4 * k.kh + 3 * k.gap;
    s += `<div class="abs row" style="left:6px;right:6px;top:3px;height:${k.pred}px;gap:2px">${pb}</div>`;
    s += `<div class="abs" style="left:24px;top:${bot + 13}px;width:25px;height:25px">${GL.emoji()}</div><div class="abs" style="left:316px;top:${bot + 11}px;width:16px;height:22px">${GL.mic('#c7c7cc')}</div>`;
    return `<div class="kbd mat-kbd" style="top:${f3(o.y)}px;height:${k.h + 40}px">${s}</div>`;
  };

  // ---------------------------------------------------------------- typing engine (human + robot)
  // script tokens: '~' backspace, '{0.5}' pause, '^' caps-lock on (double tap shift), '_' caps-lock off,
  // '|' tap predictive centre suggestion (replaces current word + space), '>' accept inline prediction (space)
  const DICT = {
    // word-in-progress completions [left, centre, right]; autocorrect pairs; next-word suggestions
    complete: {
      w: ['Wait', 'What', 'We'], wa: ['Wait', 'Was', 'Want'], wai: ['Wait', 'Waiting', 'Waited'], wait: ['Wait', 'Waiting', 'Waited'],
      y: ['you', 'yes', 'yeah'], yo: ['you', 'your', 'you’re'], you: ['you', 'your', 'you’re'],
      i: ['I', 'in', 'it'], in: ['in', 'interviewed', 'into'], int: ['into', 'interview', 'interesting'], inte: ['interview', 'interesting', 'internet'], inter: ['interview', 'interviewed', 'interesting'], interv: ['interview', 'interviewed', 'interviews'], interve: ['interveiw', 'interviewed', 'intervene'], interv_e: [], intervei: ['interveiw', 'interview', 'interviewed'], interveiw: ['interveiw', 'interview', 'interviews'], interveiwe: ['interveiwe', 'interviewed', 'interviewer'], interveiwed: ['interveiwed', 'interviewed', 'interviews'],
      f: ['for', 'from', 'find'], fo: ['for', 'found', 'forgot'], for: ['for', 'forget', 'forever'], a: ['a', 'and', 'are'], j: ['job', 'just', 'jobs'], jo: ['job', 'jobs', 'join'], job: ['job', 'jobs', 'job?'],
      s: ['So', 'Sorry', 'Still'], so: ['So', 'Some', 'Sorry'], wh: ['what', 'why', 'when'], wha: ['what', 'what’s', 'whatever'], what: ['what', 'what’s', 'whatever'],
      am: ['am', 'amazing', 'among'], su: ['supposed', 'sure', 'such'], sup: ['supposed', 'super', 'support'], supp: ['supposed', 'support', 'supply'],
      t: ['to', 'the', 'that'], to: ['to', 'today', 'too'], d: ['do', 'doing', 'don’t'], do: ['do', 'doing', 'don’t'], n: ['now', 'not', 'need'], no: ['now', 'not', 'no'], now: ['now', 'now?', 'nowhere'],
    },
    autocorrect: { interveiwed: 'interviewed' },
    next: { '': ['I', 'The', 'I’m'], wait: ['what', 'a', 'I'], you: ['are', 'have', 'did'], interviewed: ['for', 'me', 'with'], for: ['a', 'the', 'me'], a: ['new', 'job', 'few'], so: ['what', 'I', 'much'], what: ['am', 'is', 'do'], am: ['I', 'not', 'just'], i: ['supposed', 'going', 'have'], supposed: ['to', 'too', 'be'], to: ['do', 'be', 'get'], do: ['now', 'it', 'you'] },
  };
  U.typer = function (script, t0, o = {}) {
    const r = rng(o.seed || 1), ev = [];
    let t = t0, prev = '';
    for (let i = 0; i < script.length; i++) {
      const ch = script[i];
      if (ch === '{') { const j = script.indexOf('}', i); t += parseFloat(script.slice(i + 1, j)); i = j; continue; }
      let d;
      if (o.human) {
        const sp = o.speed || 1;
        d = (0.072 + r() * 0.065) / sp;
        if (ch === ' ') d += (0.02 + r() * 0.04) / sp;
        if (/[A-Z.,!?']/.test(ch) && !o.caps) d += (0.05 + r() * 0.05) / sp;
        if (prev === ' ' && r() < 0.25) d += 0.07 / sp;
        if (ch === '~') d = (0.16 + r() * 0.06) / sp;
        if (ch === '^') d = 0.28;
        if (ch === '|' || ch === '>') d = 0.35 + r() * 0.15;
      } else d = (o.dt || 0.045) * (0.8 + r() * 0.4);
      t += d;
      ev.push({ t, ch });
      prev = ch;
    }
    // simulate text state after each event
    const states = []; let text = '', caps = false, corr = [];
    for (const e of ev) {
      let key = e.ch, kind = 'key';
      if (e.ch === '~') { text = text.slice(0, -1); key = 'back'; kind = 'back'; }
      else if (e.ch === '^') { caps = true; key = 'shift'; kind = 'mod'; }
      else if (e.ch === '_') { caps = false; key = 'shift'; kind = 'mod'; }
      else if (e.ch === '|') { // tap predictive centre
        const m = text.match(/(\S*)$/), w = m[1].toLowerCase(); const c = (DICT.complete[w] || [w, w, w])[1];
        text = text.slice(0, text.length - m[1].length) + c + ' '; key = 'sugg'; kind = 'sugg';
      } else if (e.ch === '>') { // accept inline prediction with space
        const m = text.match(/(\S*)$/), w = m[1].toLowerCase(); const c = (DICT.complete[w] || [w])[0];
        text = text.slice(0, text.length - m[1].length) + c + ' '; key = ' '; kind = 'space';
      } else {
        if (/[ .,?!]/.test(e.ch)) { // autocorrect on word boundary
          const m = text.match(/(\S+)$/);
          if (m && DICT.autocorrect[m[1].toLowerCase()]) { const c = DICT.autocorrect[m[1].toLowerCase()]; const st = text.length - m[1].length; text = text.slice(0, st) + c; corr = corr.concat([{ st, en: st + c.length, t: e.t }]); }
          if (e.ch === ' ') { kind = 'space'; key = ' '; }
          else key = e.ch;
        }
        text += e.ch;
      }
      states.push({ t: e.t, text, caps, key, kind, corr });
      if (o.sound !== false) K.cue(e.t, o.human ? 'key' : 'rkey', { k: kind === 'back' ? 'del' : kind === 'space' ? 'space' : kind === 'mod' || kind === 'sugg' ? 'mod' : 'key', seed: Math.round(e.t * 1000) % 977, v: o.vol || 1 });
    }
    const api = {
      ev, states, t0, end: t,
      at(tt) { let s = null; for (const q of states) { if (q.t > tt) break; s = q; } return s || { t: -1, text: '', caps: false, corr: [] }; },
      text(tt) { return api.at(tt).text; },
      kb(tt, hold = o.human ? 0.095 : 0.05) { // keyboard props at time tt
        const s = api.at(tt);
        const down = s.t >= 0 && tt - s.t < hold ? { key: s.key === '.' || s.key === '?' || s.key === ',' || s.key === '!' || s.key === '\'' ? '\n' : s.key, pop: s.kind === 'key' } : null;
        if (down && s.kind === 'sugg') { down.key = null; }
        const txt = s.text;
        const atStart = txt.length === 0 || /[.?!]\s$/.test(txt);
        const upper = s.caps || (atStart && o.autocap !== false);
        const m = txt.match(/(\S*)$/), w = m[1].toLowerCase().replace(/[^a-z’']/g, '');
        let sugg, hi = -1, quote = -1;
        if (m[1].length) {
          if (o.caps) sugg = ['“' + m[1] + '”', '', ''];
          else {
            sugg = (DICT.complete[w] || [m[1], '', '']).slice();
            if (DICT.complete[w] && sugg[0].toLowerCase() === w && (DICT.complete[w][1] !== w)) { quote = 0; hi = 1; }
            if (!DICT.complete[w]) quote = 0;
            if (w === 'interveiw' || w === 'interveiwe' || w === 'interveiwed' || w === 'interve' || w === 'interveiw') { quote = 0; hi = 1; }
          }
        } else {
          const pw = (txt.trim().split(/\s+/).pop() || '').toLowerCase().replace(/[^a-z]/g, '');
          sugg = DICT.next[pw] || DICT.next[''];
          if (o.caps) sugg = ['I', 'THE', 'I’M'];
        }
        const sdown = s.kind === 'sugg' && tt - s.t < 0.14 ? 1 : -1;
        return { upper, caps: s.caps, shiftOn: upper && !s.caps, down, sugg, hi, quote, sdown };
      },
    };
    return api;
  };
  // render typed text with autocorrect underline + caret
  U.typedHtml = function (ty, tt, o = {}) {
    const s = ty.at(tt);
    let txt = s.text, html = '';
    let last = 0;
    for (const c of s.corr) {
      const age = tt - c.t;
      if (age > 1.3) continue;
      html += esc(txt.slice(last, c.st)) + `<span style="border-radius:3px;box-shadow:inset 0 -2px 0 rgba(10,132,255,${f3(1 - sat((age - 0.9) / 0.4))});background:rgba(10,132,255,${f3(0.25 * (1 - sat(age / 0.6)))})">${esc(txt.slice(c.st, c.en))}</span>`;
      last = c.en;
    }
    html += esc(txt.slice(last));
    // inline prediction (gray completion)
    if (o.inline) { const m = txt.match(/(\S+)$/); if (m && o.inline[m[1].toLowerCase()]) html += `<span style="color:rgba(235,235,245,0.35)">${o.inline[m[1].toLowerCase()]}</span>`; }
    return html;
  };
  U.caret = (tt, lastKey, col = '#0a84ff', h = 21) => {
    const since = tt - lastKey;
    const on = since < 0.5 ? 1 : 0.5 + 0.5 * Math.cos(((since - 0.5) / 1.0) * Math.PI * 2);
    const a = clamp(on * 1.6 - 0.3, 0, 1);
    return `<span style="display:inline-block;width:2px;height:${h}px;background:${col};border-radius:1px;vertical-align:-4px;margin-left:1px;opacity:${f3(a)}"></span>`;
  };

  // ---------------------------------------------------------------- chat bubbles
  // tail svg for iMessage-style bubbles
  U.tail = (side, col) => side === 'me'
    ? `<svg class="abs" style="right:-6px;bottom:0" width="17" height="21" viewBox="0 0 17 21"><path d="M0 0v14c0 4 3 7 6 7h11c-4-1-7-4-7.5-8.5L9.5 0z" fill="${col}"/></svg>`
    : `<svg class="abs" style="left:-6px;bottom:0" width="17" height="21" viewBox="0 0 17 21"><path d="M17 0v14c0 4-3 7-6 7H0c4-1 7-4 7.5-8.5L7.5 0z" fill="${col}"/></svg>`;
  // a message that grows in: k = spring progress
  U.grow = (k, inner, o = {}) => `<div data-grow="${f3(clamp(k, 0, 1.2))}" style="overflow:visible;flex:none;display:flex;flex-direction:column"><div style="display:flex;flex-direction:column;transform:translateY(${f3((1 - k) * (o.dy || 14))}px) scale(${f3(lerp(o.s0 || 0.86, 1, clamp(k, 0, 1.1)))});opacity:${f3(sat(k * 2.2))};transform-origin:${o.origin || '50% 100%'}">${inner}</div></div>`;

  // generic large-title nav bar (dark)
  U.navTitle = (title, o = {}) => `<div class="abs" style="left:16px;top:${o.top || 92}px;font-family:'Inter Display';font-weight:700;font-size:32px;letter-spacing:-0.02em;color:#fff">${title}</div>`;

  G.U = U;
})(window);
