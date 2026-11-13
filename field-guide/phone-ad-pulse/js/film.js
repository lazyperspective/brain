// ------------------------------------------------------------------
// KILN — PULSE. The film: shots on a 120 BPM grid (beat 0.5 s). Each shot poses the rig + camera + lights,
// draws its backdrop (colour fields / giant type behind the phone) and returns screen states; over() draws type in
// front of the phone. blur(lt) → number of motion-blur sub-frames.
// ------------------------------------------------------------------
import * as THREE from 'three';
import { track, sm, lin, clamp, mix, spr, eo, eo5, ei, beatKick } from './engine.js';
import { explode, setIris, pressAsk } from './phone.js';

const PI = Math.PI, F = '"Inter", system-ui, sans-serif';
const K = { clay: '#d97757', cream: '#f0e6dc', ink: '#141213', ember: '#ff5b2c', black: '#060505', bone: '#fff7ef', graph: '#221e1d' };
const v3 = new THREE.Vector3();
const SCR = { w: 0.69, h: 1.51 };   // screen size in phone units (canvas 1080 × 2376)
const scrY = c => 0.755 - c / 2376 * SCR.h, scrX = c => -0.345 + c / 1080 * SCR.w;

// ---------------------------------------------------------------- helpers
function pose(ph, x, y, z, rx, ry, rz) { ph.visible = true; ph.position.set(x, y, z); ph.rotation.set(rx, ry, rz); ph.updateMatrixWorld(true); }
function wpos(obj) { obj.updateWorldMatrix(true, false); obj.getWorldPosition(v3); return v3.clone(); }
function local(ph, x, y, z) { ph.updateMatrixWorld(true); return new THREE.Vector3(x, y, z).applyMatrix4(ph.matrixWorld); }
function proj(E, p) { const v = p.clone().project(E.camera); return [(v.x * 0.5 + 0.5) * E.W, (-v.y * 0.5 + 0.5) * E.H, v.z]; }
function bg(E, fn) { const x = E.bg.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; fn(x, E.W, E.H); }
function field(x, W, H, col) { x.fillStyle = col; x.fillRect(0, 0, W, H); }
function darkField(x, W, H, warm = 0.5, cx = 0.5, cy = 0.5) { x.fillStyle = K.black; x.fillRect(0, 0, W, H); const g = x.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, W * 0.7); g.addColorStop(0, `rgba(70,32,20,${warm})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
function word(x, s, X, Y, size, col, o = {}) {
  const { wt = 900, ls = -0.065, align = 'center', alpha = 1, base = 'middle', stroke = 0 } = o; if (alpha <= 0) return;
  x.save(); x.globalAlpha *= alpha; x.font = `${wt} ${Math.round(size)}px ${F}`; x.textAlign = align; x.textBaseline = base; x.letterSpacing = Math.round(size * ls) + 'px';
  if (stroke) { x.strokeStyle = col; x.lineWidth = stroke; x.strokeText(s, X, Y); } else { x.fillStyle = col; x.fillText(s, X, Y); } x.restore();
}
function wordW(x, s, size, wt = 900, ls = -0.065) { x.font = `${wt} ${Math.round(size)}px ${F}`; x.letterSpacing = Math.round(size * ls) + 'px'; const w = x.measureText(s).width; x.letterSpacing = '0px'; return w; }
// a word whose letters slam in one by one (mask from below), from t0 every `every` s
function slamWord(x, s, X, Y, size, col, lt, t0, every, o = {}) {
  const { wt = 900, ls = -0.065, align = 'center', from = 1 } = o; const tw = wordW(x, s, size, wt, ls); let cx = align === 'center' ? X - tw / 2 : align === 'right' ? X - tw : X;
  for (let i = 0; i < s.length; i++) { const cw = wordW(x, s[i], size, wt, ls), k = spr(lt, t0 + i * every, 3.2, 0.42); if (k > 0.001 && lt >= t0 + i * every) { x.save(); x.beginPath(); x.rect(cx - size * 0.1, Y - size * 0.62, cw + size * 0.2, size * 1.24); x.clip(); word(x, s[i], cx, Y + (1 - k) * size * 1.15 * from, size, col, { wt, ls, align: 'left' }); x.restore(); } cx += cw; }
}
function label(x, s, X, Y, size, col, align = 'left', a = 1) { word(x, s, X, Y, size, col, { wt: 700, ls: 0.22, align, alpha: a, base: 'alphabetic' }); }
function streak(o, X, Y, len, a, col = '255,180,130', th = 3) {
  if (a <= 0) return; o.save(); o.globalCompositeOperation = 'lighter'; const g = o.createLinearGradient(X - len, 0, X + len, 0); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); o.fillStyle = g; o.fillRect(X - len, Y - th / 2, 2 * len, th);
  const r = o.createRadialGradient(X, Y, 0, X, Y, len * 0.12); r.addColorStop(0, `rgba(255,240,225,${a})`); r.addColorStop(1, `rgba(${col},0)`); o.fillStyle = r; o.fillRect(X - len * 0.12, Y - len * 0.12, len * 0.24, len * 0.24); o.restore();
}
function hud(o, W, H, num, title, sub, a = 1) {   // small spec callout, bottom-left
  if (a <= 0) return; const s = H / 1080; o.save(); o.globalAlpha = a;
  word(o, num, 64 * s, H - 118 * s, 22 * s, K.ember, { wt: 800, ls: 0.2, align: 'left', base: 'alphabetic' });
  o.fillStyle = 'rgba(255,247,239,0.8)'; o.fillRect(64 * s, H - 106 * s, 220 * s * eo(a), 2 * s);
  word(o, title, 64 * s, H - 70 * s, 26 * s, K.bone, { wt: 800, ls: 0.16, align: 'left', base: 'alphabetic' });
  if (sub) word(o, sub, 64 * s, H - 40 * s, 19 * s, 'rgba(255,247,239,0.6)', { wt: 600, ls: 0.12, align: 'left', base: 'alphabetic' });
  o.restore();
}
function callout(o, E, p, dx, dy, txt, a) {
  if (a <= 0) return; const [X, Y] = proj(E, p), s = E.H / 1080, X2 = X + dx * s, Y2 = Y + dy * s, len = eo(a);
  o.save(); o.globalAlpha = clamp(a * 1.5, 0, 1); o.strokeStyle = K.bone; o.fillStyle = K.ember; o.lineWidth = 2 * s; o.beginPath(); o.arc(X, Y, 6 * s, 0, 7); o.fill();
  o.beginPath(); o.moveTo(X, Y); o.lineTo(X + (X2 - X) * len, Y + (Y2 - Y) * len); o.stroke();
  word(o, txt, X2 + (dx > 0 ? 14 : -14) * s, Y2 + 8 * s, 22 * s, K.bone, { wt: 800, ls: 0.14, align: dx > 0 ? 'left' : 'right', base: 'alphabetic', alpha: lin(0.4, 1, a) }); o.restore();
}
function askGlow(ph, k, E) { ph.userData.parts.materials.mAsk.emissiveIntensity = 0.25 + k * 2.2; if (E) { const p = wpos(ph.userData.parts.ask); E.L.askLight.position.copy(p).add(new THREE.Vector3(-0.06, 0, 0.04).applyQuaternion(ph.quaternion)); E.L.askLight.intensity = k * 0.12; } }
const detent = (lt, step, ang, n = 99) => { const k = Math.min(n - 1, Math.floor(lt / step)), f = lt - k * step; return (k + eo5(clamp(f / (step * 0.45), 0, 1))) * ang; };
function camOn(E, target, dir, dist, fov, roll = 0) { const p = target.clone().add(dir.clone().normalize().multiplyScalar(dist)); E.look(p.x, p.y, p.z, target.x, target.y, target.z, fov, roll); return p; }
function focusAt(E, target, aperture, maxblur = 0.012) { E.dof(E.camera.position.distanceTo(target), aperture, maxblur); }
function macroLights(E, warm = 1) { E.scene.environmentIntensity = 0.7; E.L.key.intensity = 0.6; E.L.fill.intensity = 0.05; E.L.hemi.intensity = 0.05; E.L.rimA.intensity = 2.0 * warm; E.L.rimA.color.set('#ff8a55'); E.L.rimB.intensity = 1.0; E.bloom.strength = 0.3; E.bloom.threshold = 0.95; E.fin.uniforms.vig.value = 0.45; }
function marquee(x, W, H, rows, lt, col, o = {}) {   // rows of giant words sliding (alternate directions), bumps on the beat
  const size = o.size || H * 0.26, alpha = o.alpha ?? 1;
  rows.forEach((r, i) => { const dir = i % 2 ? 1 : -1, sp = (o.speed || 0.06) * W, tw = wordW(x, r, size), off = ((lt * sp * dir) % tw + tw) % tw;
    for (let k = -1; k < Math.ceil(W / tw) + 1; k++) word(x, r, -off + k * tw, (o.y0 || H * 0.2) + i * size * 0.92, size, col, { align: 'left', alpha, stroke: o.stroke || 0 }); });
}
function phoneFront(ph, E, screen) { const p = ph.userData.parts.materials.mScreen; p.envMapIntensity = screen ?? 0.5; }

// ---------------------------------------------------------------- the shots
const SH = [];
const at = (t0, id, def) => SH.push({ t0, id, ...def });

// ===== INTRO — ignition =====
at(0.0, 'crown', {
  run({ lt, E, rig }) { const ph = rig.ink, P = ph.userData.parts; macroLights(E);
    bg(E, (x, W, H) => darkField(x, W, H, 0.45, 0.7, 0.4));
    pose(ph, 0, 0, 0, 0.1, -PI / 2 + 0.62, 0.02); P.dial.rotation.x = detent(lt, 0.25, -PI / 10);
    const d = wpos(P.dial), tgt = d.clone().add(new THREE.Vector3(0, -0.05 - lt * 0.05, 0));
    camOn(E, tgt, new THREE.Vector3(0.62, 0.22 - lt * 0.06, 1), 0.62 - lt * 0.05, 30, -0.12); focusAt(E, d, 0.02, 0.014);
    E.L.sweep.intensity = 0.9; E.L.sweep.distance = 0.9; E.L.sweep.position.copy(d).add(new THREE.Vector3(0.22, 0.5 - lt * 0.6, 0.25));
    askGlow(ph, 0); return { screens: {} };
  },
  over(o, { lt, W, H }) { hud(o, W, H, '01', 'CROWN DIAL', '40 DETENTS · HAPTIC', lin(0.3, 0.6, lt) * (1 - lin(1.8, 1.95, lt))); },
});
at(2.0, 'iris', {
  run({ lt, E, rig }) { const ph = rig.ink, P = ph.userData.parts; macroLights(E);
    bg(E, (x, W, H) => darkField(x, W, H, 0.35, 0.4, 0.5));
    pose(ph, 0, 0, 0, 0.12, PI + 0.32, 0.05); setIris(ph, 0.4 + 0.35 * eo(lt), lt * 0.9);
    const c = wpos(P.camera); camOn(E, c, new THREE.Vector3(-0.35 + lt * 0.5, 0.18, 1), 0.78 - lt * 0.1, 28); focusAt(E, c, 0.016);
    E.L.sweep.intensity = 0.5; E.L.sweep.distance = 1.2; E.L.sweep.position.copy(c).add(new THREE.Vector3(-0.6 + lt * 1.2, 0.25, 0.4)); ph.userData.lensGlow = 0.5 * sm(0.2, 0.8, lt); setIris(ph, 0.4 + 0.35 * eo(lt), lt * 0.9);
    return { screens: {} };
  },
  over(o, { lt, W, H, E, rig }) { const g = proj(E, wpos(rig.ink.userData.parts.irises[1])); streak(o, g[0] - W * 0.02, g[1] - H * 0.04, W * 0.35, 0.9 * Math.exp(-Math.abs(lt - 0.5) * 9), '255,170,120', H * 0.004); hud(o, W, H, '02', 'IRIS ARRAY', '3 × 50 MP · LIVE APERTURE', lin(0.1, 0.4, lt)); },
});
at(3.0, 'ceramic', {
  run({ lt, E, rig }) { const ph = rig.ink, P = ph.userData.parts; macroLights(E); E.scene.environmentIntensity = 0.7;
    bg(E, (x, W, H) => darkField(x, W, H, 0.3));
    pose(ph, 0, 0, 0, -0.25, PI + 0.5, 0.2); const m = wpos(P.mark);
    camOn(E, m.clone().add(new THREE.Vector3(0, 0.05, 0)), new THREE.Vector3(0.95, -0.25 + lt * 0.15, 0.55), 0.75 - lt * 0.08, 30, 0.1); focusAt(E, m, 0.02);
    E.L.sweep.intensity = 0.0; E.scene.environmentRotation.y = -1.2 + lt * 1.4; E.scene.environmentIntensity = 1.1;
    return { screens: {} };
  },
  over(o, { lt, W, H }) { hud(o, W, H, '03', 'KILN-FIRED CERAMIC', 'SPECKLED GLAZE · NO TWO ALIKE', lin(0.1, 0.4, lt)); },
});
at(4.0, 'askkey', {
  run({ lt, E, rig }) { const ph = rig.ink, P = ph.userData.parts; macroLights(E, 0.6);
    bg(E, (x, W, H) => darkField(x, W, H, 0.2 + 0.4 * sm(0.1, 0.6, lt), 0.4, 0.5));
    pose(ph, 0, 0, 0, 0.05, PI / 2 - 0.42, -0.04); const a = wpos(P.ask);
    camOn(E, a.clone().add(new THREE.Vector3(0, 0.02 - lt * 0.06, 0)), new THREE.Vector3(-0.9, 0.12, 1), 0.7 - lt * 0.08, 30, 0.08); focusAt(E, a, 0.018);
    askGlow(ph, sm(0.05, 0.5, lt) * (0.7 + 0.15 * Math.sin(lt * 20)), E); E.L.askLight.distance = 0.5;
    E.bloom.strength = 0.45; E.bloom.threshold = 0.9; return { screens: {} };
  },
  over(o, { lt, W, H }) { hud(o, W, H, '04', 'ASK KEY', 'HOLD — AND THINK OUT LOUD', lin(0.2, 0.5, lt)); },
});
const STUT = ['#d97757', '#060505', '#f0e6dc', '#ff5b2c'];
at(5.0, 'stutter', {
  run(c) { const { lt, E, rig } = c, i = Math.min(3, Math.floor(lt / 0.25)), l2 = lt - i * 0.25, ph = rig.ink, P = ph.userData.parts; macroLights(E);
    bg(E, (x, W, H) => field(x, W, H, STUT[i])); E.fin.uniforms.ca.value = 1.2 * Math.exp(-l2 * 25); E.scene.environmentIntensity = 0.8; E.L.key.intensity = 1.2;
    if (i === 0) { pose(ph, 0, 0, 0, 0.1, -PI / 2 + 0.3, 0); P.dial.rotation.x = -l2 * 6; const d = wpos(P.dial); camOn(E, d, new THREE.Vector3(1, 0.1, 0.4), 0.45 - l2 * 0.3, 30, 0.3); }
    if (i === 1) { pose(ph, 0, 0, 0, 0, PI, 0); setIris(ph, 0.2, l2 * 4); const l = wpos(P.irises[0]); camOn(E, l, new THREE.Vector3(0.1, 0.05, 1), 0.36 - l2 * 0.25, 30); }
    if (i === 2) { pose(ph, 0, 0, 0, 0.05, PI / 2 - 0.2, 0.3); askGlow(ph, 1, E); const a = wpos(P.ask); camOn(E, a, new THREE.Vector3(-1, -0.2, 0.4), 0.5 - l2 * 0.3, 30, -0.3); }
    if (i === 3) { pose(ph, 0, 0, 0, 0.3, 0.6, -0.4); const p = local(ph, 0.3, 0.72, 0.03); camOn(E, p, new THREE.Vector3(0.6, 0.6, 1), 0.5 - l2 * 0.3, 30, 0.4); }
    return { screens: {} };
  },
  blur: () => 3,
});
at(6.0, 'silhouette', {
  run({ lt, E, rig }) { const ph = rig.ink, P = ph.userData.parts; E.scene.environmentIntensity = 0.55; E.L.key.intensity = 0.0; E.L.fill.intensity = 0; E.L.hemi.intensity = 0.0;
    E.L.rimA.intensity = 9; E.L.rimA.color.set('#ff7a3d'); E.L.rimA.position.set(4, 1.5, -2); E.L.rimB.intensity = 6; E.L.rimB.color.set('#ffe0cc'); E.L.rimB.position.set(-4, 2.5, -1.5); E.bloom.strength = 0.6; E.fin.uniforms.vig.value = 0.5;
    bg(E, (x, W, H) => { field(x, W, H, '#030202'); const g = x.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, H * 0.6); g.addColorStop(0, `rgba(90,35,18,${0.5 * sm(0, 1.6, lt)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); });
    pose(ph, 0, 0.0, 0, 0.06, mix(PI / 2 + 0.15, PI + 0.55, eo(lin(0, 1.9, lt))), 0.03);
    E.look(0, 0.05, 5.0 - lt * 0.35, 0, 0, 0, 22);
    E.L.sweep.intensity = 6 * Math.sin(clamp((lt - 1.2) / 0.55, 0, 1) * PI); E.L.sweep.distance = 2.5; E.L.sweep.position.set(-1.2 + 2.4 * lin(1.2, 1.75, lt), 0.2, 0.8);
    E.fin.uniforms.flash.value = lt > 1.75 && lt < 1.875 ? 1 - (lt - 1.75) / 0.125 * 0.3 : 0; E.fin.uniforms.fade.value = lt >= 1.875 ? 1 : 0;
    askGlow(ph, 0.2 + 0.8 * sm(0.5, 1.4, lt), E); return { screens: {} };
  },
  over(o, { lt, W, H }) { if (lt < 1.75) streak(o, W * (0.1 + 0.8 * lin(1.2, 1.75, lt)), H * 0.42, W * 0.5, 0.8 * Math.sin(clamp((lt - 1.2) / 0.55, 0, 1) * PI), '255,170,120', H * 0.005); },
});

// ===== DROP A — statements =====
at(8.0, 'calm', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.rimA.intensity = 2.2; E.L.key.intensity = 1.4; E.bloom.strength = 0.25; E.fin.uniforms.vig.value = 0.18;
    const u = eo5(lin(0, 0.62, lt)), w = ei(lin(1.72, 2.0, lt));
    const x = mix(2.3, 0.0, u) - w * 4.2, ry = mix(-6.5, PI + 0.5, u) - w * 6, y = Math.sin(lt * 1.5) * 0.02 + 0.02 * beatKick(lt);
    pose(ph, x, y, 0, 0.1 + 0.1 * (1 - u), ry, 0.06 * (1 - u) + 0.04);
    E.look(0, 0.04, 6.0 - 0.25 * lt, 0, 0.02, 0, 22);
    const px = proj(E, ph.position)[0];
    bg(E, (c, W, H) => { field(c, W, H, K.clay); const rev = mix(Math.min(px, W), 0, eo(lin(0.55, 0.8, lt))); c.save(); c.beginPath(); c.rect(rev, 0, W, H); c.clip(); const b = 1 + 0.025 * beatKick(lt + 8);
      c.translate(W / 2, H * 0.52); c.scale(b, b); word(c, 'CALM.', 0, 0, H * 0.44, K.cream); c.restore(); });
    E.shadow.visible = false; return { screens: {} };
  },
  blur: lt => (lt < 0.5 || lt > 1.72 ? 8 : 1), shutter: 0.8,
});
at(10.0, 'clever', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 1.6; E.bloom.strength = 0.2; E.fin.uniforms.vig.value = 0.16; E.L.rimA.intensity = 1.5;
    const u = eo5(lin(0, 0.55, lt)), w = ei(lin(1.75, 2.0, lt));
    pose(ph, 0.05, mix(-2.8, 0.0, u) + w * 3.4 + Math.sin(lt * 1.3) * 0.015, 0.2, mix(0.5, 0.06, u), mix(1.6, 0.42, u) - lt * 0.08, mix(-0.4, -0.05, u));
    E.look(0, 0.0, 6.2, 0, 0, 0, 22); phoneFront(ph, E, 1.0);
    const sl = eo(lin(0.12, 0.5, lt)), px = proj(E, ph.position)[0];
    bg(E, (c, W, H) => { field(c, W, H, K.cream); const cut = W / 2 + W * 0.004, off = sl * H * 0.11;
      c.save(); c.beginPath(); c.rect(0, 0, cut, H); c.clip(); word(c, 'CLEVER.', W / 2, H * 0.52 + off, H * 0.4, K.ink); c.restore();
      c.save(); c.beginPath(); c.rect(cut, 0, W, H); c.clip(); word(c, 'CLEVER.', W / 2, H * 0.52 - off, H * 0.4, K.ink); c.restore();
      const fl = Math.exp(-Math.max(0, lt - 0.3) * 10) * sm(0.1, 0.3, lt); if (fl > 0.01) { c.fillStyle = `rgba(255,91,44,${fl})`; c.fillRect(cut - 3, 0, 6, H); } });
    return { screens: {} };
  },
  blur: lt => (lt < 0.4 || lt > 1.75 ? 8 : 1), shutter: 0.8,
});
at(12.0, 'yours', {
  run({ lt, E, rig }) { E.L.key.intensity = 1.5; E.L.rimA.intensity = 2.4; E.bloom.strength = 0.3; E.fin.uniforms.vig.value = 0.3;
    bg(E, (c, W, H) => { field(c, W, H, K.ink); const g = c.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, W * 0.5); g.addColorStop(0, 'rgba(90,40,24,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); });
    const k = Math.floor(lt / 0.5), f = lt - k * 0.5, ry = PI + (k + spr(f, 0, 2.8, 0.38)) * PI / 2 - PI / 2;
    [['ivory', -1.28], ['ink', 0], ['clay', 1.28]].forEach(([n, X], i) => { const ph = rig[n]; pose(ph, X * 1.05, 0.05 * beatKick(lt) + 0.12 + (i === 1 ? 0.06 : 0), i === 1 ? 0.3 : 0, 0.05, ry, 0); phoneFront(ph, E, 0.8); });
    E.look(0, -0.25, 7.6, 0, 0.0, 0, 22);
    const lockState = { scene: 'lock', lt: 2, t: 12 + lt }; return { screens: { ink: lockState, ivory: lockState, clay: lockState } };
  },
  blur: lt => ((lt % 0.5) < 0.22 ? 6 : 1), shutter: 0.7,
  over(o, { lt, W, H }) { slamWord(o, 'YOURS.', W / 2, H * 0.72, H * 0.4, K.clay, lt, 0, 0.0625); },
});
at(14.0, 'explode', {
  run({ lt, E, rig }) { const ph = rig.ink, P = ph.userData.parts; E.L.key.intensity = 1.3; E.L.rimA.intensity = 3; E.bloom.strength = 0.5; E.fin.uniforms.vig.value = 0.3;
    const k = lt < 1.5 ? spr(lt, 0, 1.6, 0.42) : 1 - spr(lt, 1.5, 3.4, 0.5), w = ei(lin(1.75, 2.0, lt));
    explode(ph, k); P.chipGlow.material.color.setRGB(1, 0.45 + 0.3 * beatKick(lt), 0.25); P.traceM.opacity = 0.3 + 0.6 * beatKick(lt);
    pose(ph, 0.0, -0.05, 0, 0.32, -0.78 + lt * 0.1 + w * 5, 0.1);
    E.look(0.3, 0.7, 6.8, 0, -0.05, 0, 24); E.bloom.threshold = 0.95; E.bloom.strength = 0.35;
    E.fin.uniforms.ca.value = 0.8 * Math.exp(-lt * 12) + 0.8 * Math.exp(-Math.abs(lt - 1.52) * 30);
    bg(E, (c, W, H) => { field(c, W, H, K.clay); const s = 0.04 * Math.sin(lt * 0.8); c.fillStyle = K.ink; c.beginPath(); c.moveTo(0, 0); c.lineTo(W * (0.24 + s), 0); c.lineTo(W * (0.1 + s), H); c.lineTo(0, H); c.fill();
      word(c, 'INSIDE.', W * 0.5, H * 0.5, H * 0.36, 'rgba(20,18,19,0.16)', { wt: 900 }); });
    E.L.key.intensity = 1.8; E.L.key.position.set(-2, 3, 4); phoneFront(ph, E, 0.1);
    return { screens: { ink: { scene: 'idle', lt, t: 14 + lt } } };
  },
  blur: lt => (lt < 0.12 || lt > 1.75 || Math.abs(lt - 1.55) < 0.06 ? 8 : 1), shutter: 0.8,
  over(o, { lt, E, rig, W, H }) { const P = rig.ink.userData.parts, a = lin(0.3, 0.75, lt) * (1 - lin(1.35, 1.5, lt));
    callout(o, E, wpos(P.chip), 170, -150, 'KILN CORE — THINKS ON-DEVICE', a); callout(o, E, wpos(P.back.children[0]).add(new THREE.Vector3(0, -0.3, 0)), -200, 120, 'CERAMIC BACK', lin(0.4, 0.85, lt) * (1 - lin(1.35, 1.5, lt)));
    callout(o, E, wpos(P.front.children[0]).add(new THREE.Vector3(0, 0.45, 0)), 180, -90, 'EDGE GLASS', lin(0.5, 0.95, lt) * (1 - lin(1.35, 1.5, lt)));
    callout(o, E, wpos(P.ask), -190, -60, 'ASK KEY', lin(0.6, 1.05, lt) * (1 - lin(1.35, 1.5, lt))); },
});

// ===== WAKE =====
at(16.0, 'slam', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 1.1; E.L.rimA.intensity = 2.6; E.bloom.strength = 0.4; E.fin.uniforms.vig.value = 0.4;
    bg(E, (c, W, H) => { darkField(c, W, H, 0.25 + 0.35 * Math.exp(-lt * 3)); const b = eo(lin(0, 0.3, lt)); c.fillStyle = K.clay; c.fillRect(0, H * (1 - 0.3 * b), W, H); word(c, '07:24', W / 2, H * 0.86 + (1 - b) * H * 0.2, H * 0.36, K.black); });
    pose(ph, 0, 0.0 + 0.012 * Math.exp(-lt * 6) * Math.sin(lt * 60), 0, 0.03, 0.2 - lt * 0.12, 0.0);
    E.look(0, 0.05, mix(6.3, 5.0, eo(lt)), 0, 0.02, 0, 22); phoneFront(ph, E, 0.35);
    E.fin.uniforms.flash.value = 0.35 * Math.exp(-lt * 18);
    return { screens: { ink: { scene: 'lock', lt, t: 16 + lt } } };
  },
});
at(17.0, 'lockin', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 0.9; E.bloom.strength = 0.35; E.fin.uniforms.vig.value = 0.35;
    bg(E, (c, W, H) => { field(c, W, H, K.cream); marquee(c, W, H, ['HOLD ASK · HOLD ASK · ', 'THINK OUT LOUD · '], lt + 17, K.ink, { y0: H * 0.3, size: H * 0.34, speed: 0.08, alpha: 1 }); });
    pose(ph, 0, 0, 0, -0.05, 0.22, -0.07); phoneFront(ph, E, 0.3);
    const tgt = local(ph, scrX(380), scrY(1250), 0.04); camOn(E, tgt, new THREE.Vector3(0.25, 0.06, 1), mix(2.7, 2.15, eo(lt)), 24, -0.04);
    return { screens: { ink: { scene: 'lock', lt: lt + 1, t: 17 + lt } } };
  },
});

// ===== ASK =====
at(18.0, 'press', {
  run({ lt, E, rig }) { const ph = rig.ink, P = ph.userData.parts; macroLights(E, 0.6);
    bg(E, (c, W, H) => darkField(c, W, H, 0.3 + 0.5 * sm(0.05, 0.3, lt), 0.3, 0.5));
    pose(ph, 0, 0, 0, 0.05, PI / 2 - 0.5, -0.02); const pr = Math.sin(clamp((lt - 0.02) / 0.16, 0, 1) * PI) * (lt < 0.1 ? 1 : 0.6); pressAsk(ph, pr);
    const a = wpos(P.ask); camOn(E, a.clone().add(new THREE.Vector3(0, 0.03, 0)), new THREE.Vector3(-0.8, 0.25, 1), 0.55 - lt * 0.1, 30, 0.05); focusAt(E, a, 0.016);
    askGlow(ph, 0.2 + 0.8 * sm(0.03, 0.12, lt), E); E.L.askLight.distance = 0.6; E.bloom.strength = 0.5; E.bloom.threshold = 0.9;
    return { screens: { ink: { scene: 'listen', lt: 0, t: 18 + lt } } };
  },
  over(o, { lt, W, H }) { hud(o, W, H, '05', 'ASK', 'PRESS · HOLD · SPEAK', lin(0.0, 0.2, lt)); },
});
at(18.5, 'irisM', {
  run({ lt, E, rig }) { const ph = rig.ink, P = ph.userData.parts; macroLights(E); E.scene.environmentIntensity = 0.6;
    bg(E, (c, W, H) => darkField(c, W, H, 0.3));
    pose(ph, 0, 0, 0, 0, PI, 0); setIris(ph, mix(0.75, 0.25, eo(lt * 2)), lt * 2.5);
    const l = wpos(P.irises[0]); camOn(E, l, new THREE.Vector3(0, 0, 1), mix(0.42, 0.34, lt * 2), 24); focusAt(E, l, 0.01);
    E.L.sweep.intensity = 0.3; E.L.sweep.distance = 0.8; E.L.sweep.position.copy(l).add(new THREE.Vector3(-0.25 + lt, 0.15, 0.3)); ph.userData.lensGlow = 0.9; setIris(ph, mix(0.75, 0.25, eo(lt * 2)), lt * 2.5);
    return { screens: {} };
  },
});
at(19.0, 'irisS', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 0.6; E.bloom.strength = 0.5; E.fin.uniforms.vig.value = 0.4; E.scene.environmentIntensity = 0.5;
    bg(E, (c, W, H) => darkField(c, W, H, 0.25));
    pose(ph, 0, 0, 0, 0, 0, 0); phoneFront(ph, E, 0.15);
    const tgt = local(ph, 0, scrY(1000), 0.04), d = mix(0.98, 2.9, eo(lin(0.15, 1.0, lt)));
    camOn(E, tgt.clone().add(new THREE.Vector3(0, -0.25 * eo(lin(0.15, 1, lt)), 0)), new THREE.Vector3(0.08 * lt, 0, 1), d, 22);
    askGlow(ph, 0.8, E);
    return { screens: { ink: { scene: 'listen', lt: lt + 0.0, t: 19 + lt, irisY: 1000, irisHold: 0.3, waveY: 1000 } } };
  },
});
at(20.0, 'justask', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 1.3; E.bloom.strength = 0.3; E.fin.uniforms.vig.value = 0.18;
    bg(E, (c, W, H) => { field(c, W, H, K.cream); const k = spr(lt, 0, 3, 0.45); c.save(); c.beginPath(); c.rect(0, H * 0.18, W, H * 0.64); c.clip(); word(c, 'JUST', W * 0.255, H * 0.52 + (1 - k) * H * 0.6, H * 0.36, K.ink); c.restore(); });
    pose(ph, 0.2, 0.0, 0.3, 0.02, -0.14 + lt * 0.08, 0.02); askGlow(ph, 0.9, E); phoneFront(ph, E, 0.4);
    E.look(0, 0.0, 6.0 - lt * 0.2, 0, 0, 0, 22);
    return { screens: { ink: { scene: 'listen', lt: 1.0 + lt, t: 20 + lt, waveY: 1000 } } };
  },
  over(o, { lt, W, H }) { const k = spr(lt, 0.5, 3, 0.45); if (lt >= 0.5) { o.save(); o.beginPath(); o.rect(0, H * 0.18, W, H * 0.64); o.clip(); word(o, 'ASK.', W * 0.74, H * 0.52 + (1 - k) * H * 0.6, H * 0.36, K.clay); o.restore(); } },
});
at(21.0, 'listen', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 0.7; E.bloom.strength = 0.4; E.fin.uniforms.vig.value = 0.4; E.scene.environmentIntensity = 0.6;
    bg(E, (c, W, H) => { darkField(c, W, H, 0.35); marquee(c, W, H, ['BOOK DINNER FOR FOUR · ', 'SOMEWHERE QUIET · 8PM · '], lt + 21, 'rgba(217,119,87,0.16)', { y0: H * 0.3, size: H * 0.36, speed: 0.05 }); });
    pose(ph, 0, 0, 0, -0.06, 0.16 - lt * 0.04, 0.03); askGlow(ph, 0.9, E); phoneFront(ph, E, 0.25);
    const tgt = local(ph, scrX(540), scrY(mix(1350, 1600, eo(lt / 3))), 0.04); camOn(E, tgt, new THREE.Vector3(0.12, 0.05, 1), mix(2.7, 2.05, eo(lt / 3)), 24, 0.02);
    return { screens: { ink: { scene: 'listen', lt: 2.0 + lt, t: 21 + lt, speak: lt, waveY: 1000 } } };
  },
});
at(24.0, 'build', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 1.0; E.bloom.strength = 0.3; E.fin.uniforms.vig.value = 0.25;
    bg(E, (c, W, H) => { field(c, W, H, K.clay); marquee(c, W, H, ['QUIET · FOUR · 20:00 · ', 'SABLE & RYE · 0.6 KM · ', 'BOOKED IN ONE ASK · '], lt + 24, K.black, { y0: H * 0.16, size: H * 0.3, speed: 0.07 }); });
    pose(ph, 0.42, -0.02, 0, -0.03, -0.24 + lt * 0.03, 0.035); phoneFront(ph, E, 0.25);
    const tgt = local(ph, 0, 0.0, 0.04); camOn(E, tgt.clone().add(new THREE.Vector3(-0.45, 0, 0)), new THREE.Vector3(0.0, 0.02, 1), mix(4.35, 3.95, eo(lt / 2)), 24);
    return { screens: { ink: { scene: 'build', lt, t: 24 + lt, tap: lt - 1.75 } } };
  },
});
at(26.0, 'booked', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 1.3; E.L.rimA.intensity = 2.8; E.bloom.strength = 0.35; E.fin.uniforms.vig.value = 0.3;
    bg(E, (c, W, H) => { field(c, W, H, K.ink); slamWord(c, 'BOOKED.', W / 2, H * 0.5, H * 0.34, K.clay, lt, 0.05, 0.0625); });
    pose(ph, 0.15, 0.0 + Math.sin(lt) * 0.01, 0.4, 0.05, 0.5 - lt * 0.1, -0.02); phoneFront(ph, E, 0.35);
    E.look(-0.3, -0.15, mix(5.4, 4.9, eo(lt / 2)), 0.0, 0.0, 0, 22);
    return { screens: { ink: { scene: 'booked', lt: lt + 0.0, t: 26 + lt } } };
  },
});

// ===== MONTAGE =====
at(28.0, 'crownM', {
  run({ lt, E, rig }) { const ph = rig.ink, P = ph.userData.parts; macroLights(E); E.scene.environmentIntensity = 0.9; E.L.key.intensity = 1.2;
    bg(E, (c, W, H) => field(c, W, H, K.clay));
    pose(ph, 0, 0, 0, 0, -PI / 2, 0); P.dial.rotation.x = detent(lt, 0.25, PI / 8, 4);
    const d = wpos(P.dial).add(new THREE.Vector3(0, 0, 0.0)); camOn(E, d, new THREE.Vector3(0.0, 0.0, 1), 0.3 + lt * 0.03, 26); focusAt(E, d, 0.008);
    return { screens: {} };
  },
  over(o, { lt, W, H }) { hud(o, W, H, '06', 'TURN TO CATCH UP', 'THE CROWN SCRUBS TIME', lin(0.1, 0.3, lt)); },
});
const crownEnd = PI / 2;
at(29.0, 'catchup', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 0.9; E.bloom.strength = 0.35; E.fin.uniforms.vig.value = 0.3;
    const c = eo(lin(0.25, 1.5, lt));
    bg(E, (x, W, H) => { field(x, W, H, K.ink); const n = Math.round(mix(47, 3, c)); const s = 1 + 0.03 * beatKick(lt + 29); x.save(); x.translate(W * 0.68, H * 0.54); x.scale(s, s); word(x, String(n), 0, 0, H * 0.78, n === 3 ? K.ember : K.clay, { ls: -0.08 }); x.restore();
      label(x, n === 3 ? 'THAT MATTER' : 'UPDATES', W * 0.68, H * 0.93, H * 0.03, K.bone, 'center'); });
    pose(ph, -0.62, 0, 0, 0, 0.26, 0); phoneFront(ph, E, 0.25);
    const pull = eo(lin(0.18, 0.8, lt)), dialP = local(ph, 0, scrY(640), 0.04), mid = local(ph, 0, -0.05, 0.04).add(new THREE.Vector3(0.62, 0, 0));
    const push = eo(lin(1.7, 2.6, lt)), lines = local(ph, 0, scrY(1650), 0.04); const tgt = dialP.clone().lerp(mid, pull).lerp(lines, push); camOn(E, tgt, new THREE.Vector3(mix(0.25, 0, pull) + 0.2 * push, 0, 1), mix(mix(2.0, 5.6, pull), 2.3, push), 22);
    return { screens: { ink: { scene: 'catchup', lt, t: 29 + lt, compress: c, dial: crownEnd + c * PI * 1.4, doneAt: 1.5 } } };
  },
  blur: lt => (lt > 0.2 && lt < 0.7 ? 3 : 1),
});
at(32.0, 'translate', {
  run({ lt, E, rig }) { E.L.key.intensity = 1.2; E.bloom.strength = 0.3; E.fin.uniforms.vig.value = 0.2;
    const dv = eo(lin(0, 0.35, lt));
    bg(E, (c, W, H) => { field(c, W, H, K.ink); c.fillStyle = K.cream; c.fillRect(0, 0, W / 2, H * dv); word(c, 'EN', W * 0.25, H * 0.5, H * 0.62, K.clay, { alpha: lin(0.1, 0.4, lt) }); word(c, 'ES', W * 0.75, H * 0.5, H * 0.62, '#2a2423', { alpha: lin(0.2, 0.5, lt) });
      c.fillStyle = K.ember; c.fillRect(W / 2 - 2, 0, 4, H * dv); });
    pose(rig.ivory, -0.98, 0.0, 0, 0.0, 0.2, 0.0); pose(rig.clay, 0.98, 0.0, 0, 0.0, -0.2, 0.0); phoneFront(rig.ivory, E, 0.2); phoneFront(rig.clay, E, 0.2);
    E.look(0, 0.0, mix(4.9, 4.35, eo(lt / 3)), 0, 0.0, 0, 22);
    return { screens: { ivory: { scene: 'translate', side: 'en', lt, t: 32 + lt }, clay: { scene: 'translate', side: 'es', lt, t: 32 + lt } } };
  },
});
at(35.0, 'shutter', {
  run({ lt, E, rig }) { const ph = rig.ink, P = ph.userData.parts; macroLights(E); E.scene.environmentIntensity = 0.8;
    bg(E, (c, W, H) => darkField(c, W, H, 0.3));
    pose(ph, 0, 0, 0, 0, PI, 0); const sh = Math.sin(clamp(lt / 0.3, 0, 1) * PI); ph.userData.lensGlow = 0.4 + 0.6 * sh; setIris(ph, 0.8 - 0.75 * sh, lt * 3);
    const cc = wpos(P.camera); camOn(E, cc, new THREE.Vector3(0.15, 0.12, 1), 0.62 - lt * 0.2, 26, 0.1); E.scene.environmentRotation.y = -0.5 + lt * 2; focusAt(E, cc, 0.012);
    E.fin.uniforms.flash.value = 0.4 * Math.exp(-Math.abs(lt - 0.15) * 30);
    return { screens: {} };
  },
  over(o, { lt, W, H }) { hud(o, W, H, '07', 'LENS', 'THE CAMERA READS THE ROOM', lin(0.0, 0.2, lt)); },
});
at(35.5, 'scan', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 0.8; E.bloom.strength = 0.3; E.fin.uniforms.vig.value = 0.3;
    bg(E, (c, W, H) => { darkField(c, W, H, 0.35); marquee(c, W, H, ['NO NUTS · FOR FOUR · €48 · ', 'READS THE MENU · '], lt + 35, 'rgba(255,91,44,0.14)', { y0: H * 0.3, size: H * 0.36, speed: 0.05 }); });
    pose(ph, 0.0, 0, 0, 0.04, -0.12 + lt * 0.06, -0.03); phoneFront(ph, E, 0.25);
    const tgt = local(ph, 0, mix(0.05, -0.15, eo(lt / 2.5)), 0.04); camOn(E, tgt, new THREE.Vector3(-0.08, 0.03, 1), mix(3.0, 2.3, eo(lt / 2.5)), 24);
    return { screens: { ink: { scene: 'scan', lt, t: 35.5 + lt } } };
  },
});
at(38.0, 'formation', {
  run({ lt, E, rig }) { E.L.key.intensity = 1.3; E.L.rimA.intensity = 2.8; E.bloom.strength = 0.35; E.fin.uniforms.vig.value = 0.3;
    const W3 = ['ASK', 'ANY', 'THING.'], wi = Math.min(2, Math.floor(lt / 0.5));
    bg(E, (c, W, H) => { field(c, W, H, [K.clay, K.cream, K.ink, K.ink][Math.min(3, Math.floor(lt / 0.5))]); if (lt < 1.5) { const k = spr(lt - wi * 0.5, 0, 3.4, 0.4); c.save(); c.translate(W / 2, H * 0.52); c.scale(mix(1.3, 1, clamp(k, 0, 1)), mix(1.3, 1, clamp(k, 0, 1))); word(c, W3[wi], 0, 0, H * 0.46, [K.black, K.ink, K.clay][wi]); c.restore(); }
      else { word(c, 'ANYTHING.', W / 2, H * 0.52, H * 0.3, K.clay); } });
    const k = Math.floor(lt / 0.5), f = lt - k * 0.5, sw = ei(lin(1.5, 1.75, lt));
    [['ivory', -1.3], ['ink', 0], ['clay', 1.3]].forEach(([n, X], i) => { const ph = rig[n], side = (k % 2 ? 1 : -1) * (i - 1), s = spr(f, 0, 3, 0.4);
      pose(ph, X + side * 0.08 * s, 0.08 * Math.sin((k + s) * PI) * (i === 1 ? -1 : 1), i === 1 ? 0.25 : 0, 0.04, (k % 2 ? -0.28 : 0.28) * (1 - sw) + sw * PI * 2.2 * (i === 1 ? 1 : -1), 0.04 * (k % 2 ? 1 : -1)); phoneFront(ph, E, 0.08); });
    E.look(0, -0.15, 7.4 - 0.25 * eo(lt / 2), 0, 0, 0, 22);
    E.fin.uniforms.flash.value = lt > 1.75 && lt < 1.875 ? 1 : 0; E.fin.uniforms.fade.value = lt >= 1.875 ? 1 : 0;
    return { screens: { ivory: { scene: 'booked', lt: 3, t: 38 + lt }, ink: { scene: 'listen', lt: 3, t: 38 + lt, waveY: 1000, speak: -9 }, clay: { scene: 'catchup', lt: 3, t: 38 + lt, compress: 1, dial: 2, doneAt: 0 } } };
  },
  blur: lt => (lt > 1.5 && lt < 1.75 ? 8 : (lt % 0.5) < 0.15 ? 4 : 1), shutter: 0.8,
});

// ===== DROP B — hero + title =====
at(40.0, 'hero', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 1.0; E.L.rimA.intensity = 3.2; E.L.rimA.color.set('#ff8a55'); E.L.rimB.intensity = 1.6; E.bloom.strength = 0.4; E.fin.uniforms.vig.value = 0.35;
    const b = spr(lt, 0, 2.2, 0.5);
    bg(E, (c, W, H) => { field(c, W, H, K.black); c.fillStyle = K.clay; c.beginPath(); const x0 = mix(W * 1.3, W * 0.56, b); c.moveTo(x0, 0); c.lineTo(W * 2, 0); c.lineTo(W * 2, H); c.lineTo(x0 - W * 0.22, H); c.fill();
      const g = c.createRadialGradient(W * 0.42, H * 0.5, 0, W * 0.42, H * 0.5, H * 0.7); g.addColorStop(0, 'rgba(80,36,22,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); });
    pose(ph, -0.15, 0.02 + Math.sin(lt * 1.4) * 0.012, 0, 0.04, mix(0.55, 0.12, eo(lt / 2)), -0.03); phoneFront(ph, E, 0.28); E.bloom.strength = 0.25;
    E.look(-0.1, -0.2, mix(5.5, 5.0, eo(lt / 2)), -0.15, 0.0, 0, 22);
    E.L.sweep.intensity = 2.2 * Math.sin(clamp(lt / 0.7, 0, 1) * PI); E.L.sweep.distance = 3; E.L.sweep.position.set(-1.6 + 3.2 * lin(0, 0.7, lt), 0.5, 1.2);
    E.fin.uniforms.flash.value = 0.5 * Math.exp(-lt * 14); E.fin.uniforms.ca.value = 0.6 * Math.exp(-lt * 10);
    return { screens: { ink: { scene: 'home', lt, t: 40 + lt } } };
  },
  over(o, { lt, W, H }) { streak(o, W * mix(0.1, 0.9, lin(0, 0.7, lt)), H * 0.36, W * 0.45, 0.85 * Math.sin(clamp(lt / 0.7, 0, 1) * PI), '255,190,150', H * 0.005); },
});
at(42.0, 'heroback', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 1.2; E.L.rimA.intensity = 3.2; E.bloom.strength = 0.35; E.fin.uniforms.vig.value = 0.3;
    bg(E, (c, W, H) => { field(c, W, H, K.clay); const g = c.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, W * 0.6); g.addColorStop(0, 'rgba(255,220,190,0.35)'); g.addColorStop(1, 'rgba(120,50,30,0.25)'); c.fillStyle = g; c.fillRect(0, 0, W, H); });
    const u = eo5(lin(0, 0.7, lt));
    pose(ph, 0, 0.0 + Math.sin(lt * 1.2) * 0.012, 0, 0.1 - 0.05 * u, mix(PI - 2.2, PI + 0.42, u) + lt * 0.05, 0.05); setIris(ph, 0.5, lt * 0.4); E.scene.environmentRotation.y = 0.9 - lt * 0.9; ph.userData.lensGlow = 0.6; setIris(ph, 0.5, lt * 0.4);
    E.look(0, 0.25, mix(4.8, 5.4, u), 0, 0.05, 0, 22);
    return { screens: {} };
  },
  blur: lt => (lt < 0.45 ? 8 : 1), shutter: 0.8,
});
const TITLE = [['K', K.clay], ['I', K.cream], ['L', K.ember], ['N', K.bone]];
at(44.0, 'title', {
  run({ lt, E, rig }) { const ph = rig.ink; E.L.key.intensity = 1.0; E.L.rimA.intensity = 3.4; E.L.rimB.intensity = 1.8; E.bloom.strength = 0.4; E.fin.uniforms.vig.value = 0.35;
    const col = lin(1.5, 1.9, lt), ph_in = eo5(lin(1.5, 2.3, lt));
    bg(E, (c, W, H) => { field(c, W, H, K.black);
      // four colour blocks slam in on 8ths, each carrying a giant letter
      const bw = W / 4;
      TITLE.forEach(([L, bc], i) => { const k = spr(lt, i * 0.25, 2.6, 0.48), dir = i % 2 ? -1 : 1; if (lt < i * 0.25) return; const out = ei(lin(1.5 + i * 0.04, 1.78 + i * 0.04, lt)) * H * 1.05 * -dir;
        c.save(); c.beginPath(); c.rect(i * bw, (1 - clamp(k, 0, 1.2)) * H * dir + out, bw + 1, H); c.clip(); c.fillStyle = bc; c.fillRect(i * bw, 0, bw + 1, H);
        word(c, L, i * bw + bw / 2, H * 0.53 + (1 - k) * H * 0.3 * dir + out * 0.6, H * 0.92, K.black, { ls: 0 }); c.restore(); });
      if (col > 0) { const g = c.createRadialGradient(W * 0.33, H * 0.5, 0, W * 0.33, H * 0.5, H * 0.7); g.addColorStop(0, `rgba(80,36,22,${0.55 * col})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    });
    ph.visible = ph_in > 0;
    pose(ph, -0.78, mix(-2.4, 0.0, ph_in) + Math.sin(lt * 1.2) * 0.01, 0, 0.03, mix(0.9, 0.32, ph_in) - lt * 0.025, -0.02); phoneFront(ph, E, 0.5); if (ph_in <= 0) ph.visible = false;
    E.look(0, -0.02, mix(5.3, 5.0, eo(lin(1.5, 7, lt))), 0, -0.02, 0, 22);
    E.scene.environmentRotation.y = 0.5 - 0.9 * eo(lin(1.6, 4.0, lt));
    E.fin.uniforms.flash.value = 0.25 * Math.exp(-lt * 12); E.fin.uniforms.fade.value = sm(6.0, 7.0, lt);
    return { screens: { ink: { scene: 'idle', lt, t: 44 + lt } } };
  },
  blur: lt => (lt < 1.0 && (lt % 0.25) < 0.08 ? 4 : lt > 1.5 && lt < 2.0 ? 5 : 1),
  over(o, { lt, W, H }) {
    const a = lin(1.6, 1.9, lt); if (a <= 0) return; const X = W * 0.58, Y = H * 0.5;
    o.save(); o.globalAlpha = 1 - sm(6.0, 7.0, lt);
    const tk = eo(lin(1.6, 2.4, lt)); slamWord(o, 'KILN', X, Y, H * 0.3, K.bone, lt, 1.6, 0.06, { align: 'left', ls: mix(0.04, -0.06, tk) });
    // tagline + its live wave
    const tg = lin(2.0, 2.3, lt); if (tg > 0) { slamWord(o, 'Think out loud.', X + H * 0.01, Y + H * 0.2, H * 0.072, K.bone, lt, 2.0, 0.03, { align: 'left', wt: 800, ls: -0.03 });
      o.save(); o.globalCompositeOperation = 'lighter'; const wv = W * 0.3 * eo(lin(2.1, 2.8, lt)), y0 = Y + H * 0.27; o.strokeStyle = K.ember; o.lineWidth = H * 0.004; o.beginPath();
      for (let i = 0; i <= 80; i++) { const u = i / 80, e = Math.pow(Math.sin(PI * u), 2), yy = y0 + Math.sin(u * 40 + lt * 9) * H * 0.018 * e * (0.4 + beatKick(lt + 44)); i ? o.lineTo(X + u * wv, yy) : o.moveTo(X + u * wv, yy); } o.stroke(); o.restore(); }
    label(o, 'CONCEPT', X + H * 0.012, Y + H * 0.36, H * 0.022, K.ember, 'left', lin(3.0, 3.4, lt));
    label(o, 'KILN OS · PULSE', X + H * 0.012 + H * 0.2, Y + H * 0.36, H * 0.022, 'rgba(255,247,239,0.55)', 'left', lin(3.2, 3.6, lt));
    o.restore();
  },
});

// ---------------------------------------------------------------- timeline
SH.forEach((s, i) => { s.t1 = i < SH.length - 1 ? SH[i + 1].t0 : 51.0; });
export function shotAt(t) { let i = 0; while (i < SH.length - 1 && t >= SH[i + 1].t0) i++; return [SH[i], t - SH[i].t0]; }
export const CUTS = SH.map(s => [s.t0, s.id]);
export const FILM = {
  dur: 51.0, shots: SH,
  frame(shot, lt, t, E, rig) {
    E.reset();
    for (const n in rig) { const ph = rig[n], P = ph.userData.parts; ph.visible = false; ph.userData.lensGlow = 0; pressAsk(ph, 0); explode(ph, 0); setIris(ph, 0.3, 0); P.dial.rotation.x = 0; askGlow(ph, 0.25); P.materials.mScreen.envMapIntensity = 0.5; }
    const st = shot.run({ lt, t, E, rig, d: shot.t1 - shot.t0 }) || {}; return st;
  },
  overlay(shot, o, lt, t, W, H, E, rig) { if (shot.over) shot.over(o, { lt, t, W, H, E, rig }); },
  post(o, t, W, H) {},
};
