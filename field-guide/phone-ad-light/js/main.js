// KILN — LIGHT · frame assembly: shot → (motion-blur sub-frames) → (dissolves) → light overlay + title
import { createEngine } from './engine.js';
import { buildPhone } from './phone.js';
import { makeOS } from './os.js';
import { FILM } from './film.js';
const q = new URLSearchParams(location.search), W = +(q.get('w') || 1920), H = +(q.get('h') || 1080), MB = q.has('nomb') ? 0 : 1;
for (const f of ['200 50px Newsreader', '300 50px Newsreader', '400 50px Newsreader', 'italic 300 50px Newsreader', 'italic 400 50px Newsreader', '300 50px Inter', '400 50px Inter', '500 50px Inter', '600 50px Inter', '700 50px Inter']) await document.fonts.load(f);
const out = document.getElementById('c'); out.width = W; out.height = H; const o = out.getContext('2d');
const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tx = tmp.getContext('2d');
const gl = document.createElement('canvas'), E = createEngine(gl, W, H), os = makeOS(+(q.get('uis') || 1)), phone = buildPhone(os.tex); E.scene.add(phone);
const SHUTTER = 1 / 60;   // 180° at 30 fps
function shotFrame(i, t) { const s = FILM.shots[i]; const st = s.frame(t, E, phone); if (q.has('nodof')) E.bokeh.enabled = false; os.draw(t, st.os || {}); E.render(t); return st; }
function renderShot(i, t, ctx) {
  const s = FILM.shots[i], n = MB && s.mb ? s.mb(t) : 1; let st;
  for (let k = 0; k < n; k++) { const tt = n > 1 ? t + ((k + 0.5) / n - 0.5) * SHUTTER : t; st = shotFrame(i, tt); ctx.globalAlpha = 1 / (k + 1); ctx.drawImage(gl, 0, 0); }
  ctx.globalAlpha = 1; if (n > 1) st = FILM.shots[i].frame(t, E, phone); return st;
}
function renderAt(t) {
  if (q.has('osonly')) { const st = FILM.shots[FILM.shotIndex(t)].frame(t, E, phone); os.draw(t, st.os || {}); o.fillStyle = '#222'; o.fillRect(0, 0, W, H); const h = H, w = h * 1080 / 2376; o.drawImage(os.canvas, (W - w) / 2, 0, w, h); return; }
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; o.filter = 'none';
  const i = FILM.shotIndex(t); let st = renderShot(i, t, o);
  for (const tr of FILM.transitions) if (tr.type === 'dissolve' && t >= tr.t0 && t < tr.t1) {
    const u = (t - tr.t0) / (tr.t1 - tr.t0), other = i === tr.a ? tr.b : tr.a;
    const sto = renderShot(other, t, tx);
    // light dissolve: blend through a brighter, slightly bloomed mix
    const kB = u * u * (3 - 2 * u), wB = i === tr.b ? 1 - kB : kB;   // weight of the "other" render
    o.save(); o.globalAlpha = wB; o.drawImage(tmp, 0, 0); o.globalCompositeOperation = 'screen'; o.globalAlpha = Math.sin(u * Math.PI) * 0.35; o.filter = 'blur(18px)'; o.drawImage(tmp, 0, 0); o.restore();
    if (wB > 0.5) st = sto;
  }
  FILM.overlay(o, t, W, H, st);
}
window.__piece = { renderAt, dur: FILM.dur, E, phone, FILM, os }; window.__ready = true;
if (q.has('t')) renderAt(+q.get('t')); else if (!q.has('export')) { const t0 = performance.now(); (function loop() { renderAt(((performance.now() - t0) / 1000) % FILM.dur); requestAnimationFrame(loop); })(); }
