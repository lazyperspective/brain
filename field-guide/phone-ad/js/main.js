import { createEngine } from './engine.js';
import { buildPhone } from './phone.js';
import { makeScreen } from './ui.js';
import { DIRS } from './directions.js';
const q = new URLSearchParams(location.search), dir = DIRS[q.get('dir') || 'light'], W = +(q.get('w') || 1920), H = +(q.get('h') || 1080);
for (const f of ['300 50px Newsreader', '400 50px Newsreader', '400 50px Inter', '500 50px Inter', '600 50px Inter', '800 50px Inter']) await document.fonts.load(f);
const out = document.getElementById('c'); out.width = W; out.height = H; const o = out.getContext('2d');
const gl = document.createElement('canvas'), E = createEngine(gl, W, H), scr = makeScreen(), phone = buildPhone(scr.tex, dir.finish); E.scene.add(phone);
function renderAt(t) { const st = dir.frame(t, E, phone); scr.draw(st); E.render(t); o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.drawImage(gl, 0, 0); dir.overlay && dir.overlay(o, t, W, H); }
window.__piece = { renderAt, dur: dir.dur }; window.__ready = true;
if (q.has('t')) renderAt(+q.get('t')); else if (!q.has('export')) { const t0 = performance.now(); (function loop() { renderAt(((performance.now() - t0) / 1000) % dir.dur); requestAnimationFrame(loop); })(); }
