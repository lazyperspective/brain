import { createEngine } from './engine.js';
import { buildPhone } from './phone.js';
import { makeScreen, SW, SH } from './os.js';
import { FILM, shotAt } from './film.js';
const q = new URLSearchParams(location.search), W = +(q.get('w') || 1920), H = +(q.get('h') || 1080);
for (const f of ['400 50px Newsreader', '500 50px Newsreader', '400 50px Inter', '500 50px Inter', '600 50px Inter', '700 50px Inter', '800 50px Inter', '900 50px Inter']) await document.fonts.load(f);
const out = document.getElementById('c'); out.width = W; out.height = H; const o = out.getContext('2d');

if (q.has('ui')) {   // flat UI preview: several screens side by side  ?ui=lock:0.8,listen:2.1&...
  const items = q.get('ui').split(';'), scr = makeScreen(1);
  window.__piece = { renderAt(t) {
    o.fillStyle = '#333'; o.fillRect(0, 0, W, H); const n = items.length, h = H * 0.96, w = h * SW / SH, gap = (W - n * w) / (n + 1);
    items.forEach((it, i) => { const [scene, lt, ...ex] = it.split(':'), extra = ex.join(':'); const st = { scene, lt: +lt, t: t + +lt, ...(extra ? JSON.parse(decodeURIComponent(extra)) : {}) };
      scr.draw(st); o.drawImage(scr.cv, gap + i * (w + gap), H * 0.02, w, h); });
  }, dur: 1 }; window.__ready = true;
} else {
  const gl = document.createElement('canvas'), E = createEngine(gl, W, H);
  const screens = { ink: makeScreen(1.5), ivory: makeScreen(1), clay: makeScreen(1) };
  const rig = {}; for (const f of ['ink', 'ivory', 'clay']) { rig[f] = buildPhone(screens[f].tex, f); rig[f].userData.screen = screens[f]; E.scene.add(rig[f]); }
  const frm = document.createElement('canvas'); frm.width = W; frm.height = H; const fo = frm.getContext('2d');
  function sample(t) {
    const [shot, lt] = shotAt(t); const st = FILM.frame(shot, lt, t, E, rig);
    for (const f in screens) if (rig[f].visible) { const ss = st.screens && st.screens[f]; if (ss) { screens[f].draw(ss); screens[f].off = false; } else if (!screens[f].off) { screens[f].draw({ scene: 'off' }); screens[f].off = true; } }
    E.render(t); fo.setTransform(1, 0, 0, 1, 0, 0); fo.globalAlpha = 1; fo.globalCompositeOperation = 'source-over'; fo.drawImage(gl, 0, 0);
    FILM.overlay(shot, fo, lt, t, W, H, E, rig); return st;
  }
  function renderAt(t) {
    const [shot, lt] = shotAt(t); const n = Math.max(1, Math.round(shot.blur ? shot.blur(lt) : 1)), shut = shot.shutter || 0.5;
    if (n === 1) { sample(t); o.globalAlpha = 1; o.drawImage(frm, 0, 0); }
    else for (let i = 0; i < n; i++) {
      const ts = Math.min(shot.t1 - 1e-4, Math.max(shot.t0, t + ((i + 0.5) / n - 0.5) * shut / 30));
      sample(ts); o.globalAlpha = 1 / (i + 1); o.drawImage(frm, 0, 0);
    }
    o.globalAlpha = 1; FILM.post(o, t, W, H);
  }
  window.__piece = { renderAt, dur: FILM.dur }; window.__ready = true;
  if (q.has('t')) renderAt(+q.get('t'));
  else if (!q.has('export')) { const t0 = performance.now(); (function loop() { renderAt(((performance.now() - t0) / 1000) % FILM.dur); requestAnimationFrame(loop); })(); }
}
