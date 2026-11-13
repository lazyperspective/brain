// ------------------------------------------------------------------
// Four ad directions for the KILN concept phone.
//  light — pure, Apple-grade minimal: an orange field, the phone floats up, turns, wakes, unlocks.
//  made  — crafted: exploded parts on warm paper with callouts, assembles with a snap, wakes.
//  pulse — kinetic: hard cuts, colour blocks, giant words behind the phone, the Ask moment.
//  dawn  — cinematic dark: macro light-runs over the edges and lenses, a sunrise behind, then the reveal.
// frame(t, E, phone) poses everything and returns the screen state; overlay(o, t) draws ad type over the frame.
// ------------------------------------------------------------------
import * as THREE from 'three';
import { track, sm, clamp } from './engine.js';
import { explode } from './phone.js';

const PI = Math.PI, SERIF = '"Newsreader", Georgia, serif', SANS = '"Inter", system-ui, sans-serif';
const v3 = new THREE.Vector3();
function lerpHex(a, b, u) { const A = new THREE.Color(a), B = new THREE.Color(b); return '#' + A.lerp(B, clamp(u, 0, 1)).getHexString(); }
function type(o, s, x, y, font, col, a = 1, align = 'center', ls = 0) { if (a <= 0) return; o.save(); o.globalAlpha = a; o.font = font; o.fillStyle = col; o.textAlign = align; o.letterSpacing = ls + 'px'; o.fillText(s, x, y); o.restore(); }
function resetLights(E) {
  const L = E.L; L.key.intensity = 1.6; L.fill.intensity = 0.35; L.rimA.intensity = 1.2; L.rimB.intensity = 0.8; L.sweep.intensity = 0; L.hemi.intensity = 0.35;
  L.rimA.color.set('#ffb48a'); L.rimB.color.set('#ffd9c2'); E.scene.environmentIntensity = 1; E.bokeh.enabled = false; E.bloom.strength = 0.32; E.shadow.visible = false; E.fin.uniforms.vig.value = 0.28;
}
function pose(phone, p) { phone.position.set(p[0], p[1], p[2]); phone.rotation.set(p[3], p[4], p[5]); phone.updateMatrixWorld(true); }
function partPos(phone, name) { phone.userData.parts[name].getWorldPosition(v3); return v3.clone(); }
function shadowUnder(E, phone, floorY, k) { E.shadow.visible = k > 0.01; E.shadow.position.set(phone.position.x, floorY, phone.position.z); E.shadow.scale.set(1.5, 0.55, 1); E.shadow.material.opacity = k * clamp(1 - (phone.position.y - floorY - 0.8) * 0.6, 0.2, 1); }
function askGlow(phone, k) { phone.userData.parts.materials.mAsk.emissiveIntensity = 0.25 + k * 3; }
function fill(E, draw) { const x = E.bg.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; draw(x, E.W, E.H); }

// ---------------------------------------------------------------- LIGHT
const light = {
  name: 'LIGHT', dur: 11.5, finish: 'ivory',
  frame(t, E, phone) {
    resetLights(E); E.L.key.intensity = 1.05; E.L.hemi.intensity = 0.25; E.scene.environmentIntensity = 0.8;
    const glow = sm(0.2, 2.2, t);
    fill(E, (x, W, H) => { const g = x.createRadialGradient(W / 2, H * 0.47, 0, W / 2, H * 0.5, W * 0.72); g.addColorStop(0, lerpHex('#eaa985', '#f8dcc6', glow)); g.addColorStop(0.55, lerpHex('#e8a07b', '#eeb08d', glow)); g.addColorStop(1, '#de9068'); x.fillStyle = g; x.fillRect(0, 0, W, H); });
    const p = track([[0, 0, -2.7, 0, 0.55, PI + 1.0, 0.25], [1.0, 0, -2.3, 0, 0.5, PI + 0.9, 0.2], [3.6, 0.04, -0.06, 0, 0.12, PI + 0.22, -0.04], [5.4, 0, 0.02, 0.25, 0.04, 0.34, 0], [6.0, 0, 0.03, 0.32, 0.02, 0.12, 0],
      [8.6, 0, 0.03, 0.45, 0, 0, 0], [10.2, -0.5, 0, 0.6, 0, 0.26, 0], [11.5, -0.54, 0, 0.66, 0, 0.3, 0]], t);
    p[1] += Math.sin(t * 1.3) * 0.02; pose(phone, p);
    E.look(0, 0.02, 5.9 - 0.45 * sm(1, 11, t), 0, 0, 0, 22);
    E.L.sweep.intensity = 7 * Math.sin(clamp((t - 2.6) / 3.2, 0, 1) * PI); E.L.sweep.position.set(-1.6 + 3.2 * clamp((t - 2.6) / 3.2, 0, 1), 0.7, 1.4);
    shadowUnder(E, phone, -1.12, sm(1.8, 3.8, t) * 0.8);
    askGlow(phone, Math.sin(clamp((t - 5.5) / 0.8, 0, 1) * PI));
    return { wall: 'dunes', t, wake: sm(5.9, 6.6, t), tn: t - 6.3, unlock: sm(7.9, 8.8, t), type: clamp((t - 9.1) / 1.3, 0, 1) };
  },
  overlay(o, t, W, H) {
    const a = sm(9.5, 10.3, t);
    type(o, 'KILN', W * 0.66, H * 0.47, `300 ${Math.round(H * 0.15)}px ${SERIF}`, '#3a1c10', a, 'left', -2);
    type(o, 'The phone that thinks with you.', W * 0.665, H * 0.47 + H * 0.07, `400 ${Math.round(H * 0.03)}px ${SANS}`, '#4a2616', sm(9.9, 10.7, t), 'left');
    type(o, 'CONCEPT', W * 0.665, H * 0.47 + H * 0.12, `600 ${Math.round(H * 0.016)}px ${SANS}`, '#7a3f26', sm(10.2, 10.9, t) * 0.8, 'left', 5);
  },
};

// ---------------------------------------------------------------- MADE
let PAPER = null;
const made = {
  name: 'MADE', dur: 11.5, finish: 'clay',
  frame(t, E, phone) {
    resetLights(E); E.L.key.intensity = 1.9; E.L.rimA.color.set('#ffd2b0');
    fill(E, (x, W, H) => {
      if (!PAPER) { PAPER = document.createElement('canvas'); PAPER.width = W; PAPER.height = H; const p = PAPER.getContext('2d'); p.fillStyle = '#f1e7da'; p.fillRect(0, 0, W, H);
        const d = p.getImageData(0, 0, W, H), a = d.data; let s = 3; for (let i = 0; i < a.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 10) & 15) - 7.5; a[i] += n * 0.7; a[i + 1] += n * 0.7; a[i + 2] += n * 0.7; } p.putImageData(d, 0, 0);
        p.globalAlpha = 0.05; p.strokeStyle = '#8a5a3a'; for (let i = 0; i < 260; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const X = (s % W), Y = ((s >> 7) % H); p.beginPath(); p.moveTo(X, Y); p.lineTo(X + 30 + (s % 40), Y + ((s >> 3) % 9) - 4); p.stroke(); } }
      x.drawImage(PAPER, 0, 0); const g = x.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, W * 0.7); g.addColorStop(0, 'rgba(255,250,242,0.55)'); g.addColorStop(1, 'rgba(160,110,80,0.12)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    });
    const p = track([[0, -0.05, 0.1, 0, 0.42, -0.98, 0.08], [4.4, 0, 0.06, 0, 0.36, -0.6, 0.05], [6.0, 0, 0.02, 0.05, 0.25, -0.38, 0.02], [7.6, 0, 0.02, 0.25, 0.03, 0, 0], [9.6, 0, 0.02, 0.35, 0, 0, 0], [11.5, 0.46, 0.02, 0.5, 0, -0.24, 0]], t);
    const snap = t > 5.9 && t < 6.15 ? Math.sin((t - 5.9) / 0.25 * PI) * 0.012 : 0; p[1] += snap + Math.sin(t * 1.1) * 0.012; pose(phone, p);
    const k = 1 - sm(4.4, 5.9, t); explode(phone, k);
    phone.userData.parts.chipGlow.material.color.setRGB(1, 0.6 + 0.2 * Math.sin(t * 3), 0.4);
    E.look(0.25 * (1 - sm(5, 8, t)), 0.3 * (1 - sm(5, 8, t)), 6.4 - 0.6 * sm(4, 11, t), 0, 0, 0, 22);
    E.bloom.strength = 0.32 + 0.6 * (t > 5.88 && t < 6.2 ? 1 - (t - 5.88) / 0.32 : 0);
    shadowUnder(E, phone, -1.08, 0.55 * sm(5.5, 7, t));
    askGlow(phone, 0.4 * (1 - sm(4.4, 5.9, t)) + Math.sin(clamp((t - 7.0) / 0.6, 0, 1) * PI));
    this._phone = phone; this._E = E;
    return { wall: 'dunes', t, wake: sm(7.4, 8.0, t), tn: t - 7.7, unlock: sm(9.0, 9.9, t), type: clamp((t - 10.1) / 1.2, 0, 1) };
  },
  overlay(o, t, W, H) {
    const phone = this._phone, E = this._E, P = phone.userData.parts;
    const call = (obj, off, label, a0) => { const a = sm(a0, a0 + 0.5, t) * (1 - sm(4.2, 4.7, t)); if (a <= 0) return; obj.getWorldPosition(v3); v3.project(E.camera);
      const X = (v3.x * 0.5 + 0.5) * W, Y = (-v3.y * 0.5 + 0.5) * H, X2 = X + off[0] * H, Y2 = Y + off[1] * H, len = sm(a0, a0 + 0.4, t);
      o.save(); o.globalAlpha = a; o.strokeStyle = '#3b2418'; o.fillStyle = '#3b2418'; o.lineWidth = 1.5; o.beginPath(); o.arc(X, Y, 4, 0, 7); o.fill(); o.beginPath(); o.moveTo(X, Y); o.lineTo(X + (X2 - X) * len, Y + (Y2 - Y) * len); o.stroke(); o.restore();
      type(o, label, X2 + (off[0] > 0 ? 12 : -12), Y2 + 7, `500 ${Math.round(H * 0.021)}px ${SANS}`, '#3b2418', a * sm(a0 + 0.3, a0 + 0.6, t), off[0] > 0 ? 'left' : 'right', 1); };
    call(P.chip, [0.26, -0.2], 'Kiln Core — thinks on-device', 1.0); call(P.back.children[0], [0.3, 0.18], 'Ceramic back, kiln-fired', 1.6);
    call(P.front.children[0], [-0.3, 0.2], 'Edge-to-edge glass', 2.2); call(P.ask, [-0.28, -0.16], 'Ask key — hold to talk', 2.8);
    const a = sm(10.2, 10.9, t); type(o, 'Made to think.', W * 0.08, H * 0.5, `300 ${Math.round(H * 0.1)}px ${SERIF}`, '#3b2418', a, 'left', -1);
    type(o, 'KILN  ·  CONCEPT', W * 0.083, H * 0.5 + H * 0.07, `600 ${Math.round(H * 0.018)}px ${SANS}`, '#8a4a30', sm(10.5, 11.1, t), 'left', 5);
  },
};

// ---------------------------------------------------------------- PULSE
const SHOTS = [[0, 'dial'], [0.9, 'spin'], [1.8, 'lens'], [2.7, 'wake'], [4.0, 'ask'], [5.4, 'home'], [6.8, 'hero']];
const shotAt = t => { let i = 0; while (i < SHOTS.length - 1 && t >= SHOTS[i + 1][0]) i++; return [i, t - SHOTS[i][0]]; };
const pulse = {
  name: 'PULSE', dur: 9.5, finish: 'ink',
  frame(t, E, phone) {
    resetLights(E); E.L.rimA.intensity = 2; E.fin.uniforms.vig.value = 0.2;
    const [i, lt] = shotAt(t), id = SHOTS[i][1], P = phone.userData.parts; P.dial.rotation.x = 0;
    const BG = { dial: '#d97757', spin: '#f0e6dc', lens: '#141213', wake: '#d97757', ask: '#f0e6dc', home: '#141213', hero: null }[id];
    const WORD = { dial: ['CALM.', '#f6ece2'], spin: ['CLEVER.', '#1a1617'], lens: ['YOURS.', '#d97757'], ask: ['JUST ASK.', '#d97757'] }[id];
    fill(E, (x, W, H) => {
      if (BG) { x.fillStyle = BG; x.fillRect(0, 0, W, H); } else { const s = sm(0, 2.6, lt); x.fillStyle = '#141213'; x.fillRect(0, 0, W, H); x.fillStyle = '#d97757'; x.beginPath(); x.moveTo(0, H); x.lineTo(W * (0.15 + 0.45 * s), H); x.lineTo(W * (0.35 + 0.45 * s), 0); x.lineTo(0, 0); x.fill(); }
      if (WORD) { x.font = `800 ${Math.round(H * 0.36)}px ${SANS}`; x.fillStyle = WORD[1]; x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '-12px'; x.fillText(WORD[0], W / 2 + (lt - 0.45) * W * 0.06, H * 0.52); x.letterSpacing = '0px'; }
    });
    let st = { wall: 'ink', t, wake: 0 };
    if (id === 'dial') { pose(phone, [0, 0, 0, 0.1, -PI / 2 + 0.42, 0.05]); P.dial.rotation.x = lt * 5; const d = partPos(phone, 'dial'); E.look(d.x + 0.35, d.y + 0.15 - lt * 0.12, d.z + 1.45, d.x, d.y, d.z, 26); E.L.sweep.intensity = 6; E.L.sweep.position.set(d.x + 0.4, d.y + 0.5 - lt, d.z + 0.6); }
    if (id === 'spin') { pose(phone, [0, 0, 0, 0.18, lt * 7.5 + 0.4, 0.1]); E.look(0, 0, 6.4, 0, 0, 0, 22); }
    if (id === 'lens') { pose(phone, [0, 0, 0, 0.12, PI + 0.3, 0.04]); const c = partPos(phone, 'camera'); E.look(c.x - 0.3 + lt * 0.3, c.y + 0.1, c.z + 1.5, c.x, c.y, c.z, 24); E.L.sweep.intensity = 9; E.L.sweep.position.set(c.x - 1 + lt * 2.4, c.y + 0.3, c.z + 0.7); E.L.rimA.color.set('#ff8a55'); }
    if (id === 'wake') { pose(phone, [0, Math.sin(lt * 2) * 0.02, 0.6 - lt * 0.12, 0.06, 0.18 - lt * 0.12, 0]); E.look(0, 0, 6.4, 0, 0, 0, 22); st = { wall: 'ink', t, wake: sm(0.1, 0.4, lt), tn: lt - 0.3 }; shadowUnder(E, phone, -1.05, 0.5); }
    if (id === 'ask') { pose(phone, [0.15, 0, 0.7, 0.05, 0.42 - lt * 0.1, -0.03]); E.look(0, 0, 6.2, 0, 0, 0, 22); askGlow(phone, sm(0, 0.25, lt)); st = { wall: 'ink', t, wake: 1, tn: 9, ask: sm(0.2, 0.55, lt) }; }
    if (id === 'home') { pose(phone, [0, 0, 0.8, 0.02, -0.3 + lt * 0.35, 0]); E.look(0, 0, 6.0, 0, 0, 0, 22); st = { wall: 'ink', t, wake: 1, tn: 9, ask: 1 - sm(0, 0.35, lt), unlock: sm(0.25, 0.9, lt), type: clamp((lt - 0.7) / 0.8, 0, 1) }; }
    if (id === 'hero') { pose(phone, [0.1 - lt * 0.08, 0.02 + Math.sin(t * 1.2) * 0.015, 0.6 + lt * 0.08, 0, -0.18 + lt * 0.05, 0]); E.look(0, 0, 6.6, 0, 0, 0, 22); st = { wall: 'ink', t, wake: 1, tn: 9, unlock: 1, type: 1 }; shadowUnder(E, phone, -1.05, 0.35); }
    this._lt = lt; this._id = id; return st;
  },
  overlay(o, t, W, H) {
    const [i, lt] = shotAt(t); if (lt < 0.05 && i > 0) { o.fillStyle = `rgba(255,246,236,${0.35 * (1 - lt / 0.05)})`; o.fillRect(0, 0, W, H); }
    if (SHOTS[i][1] === 'hero') { const a = sm(1.0, 1.6, lt); type(o, 'KILN', W * 0.8, H * 0.46, `800 ${Math.round(H * 0.13)}px ${SANS}`, '#f6ece2', a, 'center', -6); type(o, 'Think out loud.', W * 0.8, H * 0.46 + H * 0.08, `400 ${Math.round(H * 0.04)}px ${SERIF}`, '#f6ece2', sm(1.4, 2.0, lt), 'center'); type(o, 'CONCEPT', W * 0.8, H * 0.46 + H * 0.13, `600 ${Math.round(H * 0.016)}px ${SANS}`, '#d97757', sm(1.7, 2.2, lt), 'center', 5); }
  },
};

// ---------------------------------------------------------------- DAWN
const dawn = {
  name: 'DAWN', dur: 11.5, finish: 'clay',
  frame(t, E, phone) {
    resetLights(E); const P = phone.userData.parts, rise = sm(4.4, 9.5, t);
    E.scene.environmentIntensity = 0.12 + 0.35 * rise; E.L.key.intensity = 0.15 + 0.9 * rise; E.L.fill.intensity = 0.05; E.L.hemi.intensity = 0.05 + 0.2 * rise;
    E.L.rimA.color.set('#ff7a3d'); E.L.rimA.intensity = 0.6 + 3.2 * rise; E.L.rimB.color.set('#ffb070'); E.L.rimB.intensity = 0.3 + 1.6 * rise; E.L.rimA.position.set(2.5, -1.2, -4); E.L.rimB.position.set(-3, -1.5, -3.5);
    E.fin.uniforms.vig.value = 0.45; E.bloom.strength = 0.45;
    fill(E, (x, W, H) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#050404'); g.addColorStop(0.55, lerpHex('#070505', '#2a120b', rise)); g.addColorStop(0.8, lerpHex('#0b0706', '#8a3a1c', rise)); g.addColorStop(1, lerpHex('#0e0807', '#e0743e', rise)); x.fillStyle = g; x.fillRect(0, 0, W, H);
      const s = x.createRadialGradient(W * 0.5, H * 1.05, 0, W * 0.5, H * 1.05, H * 0.9); s.addColorStop(0, `rgba(255,190,120,${0.75 * rise})`); s.addColorStop(1, 'rgba(255,120,60,0)'); x.fillStyle = s; x.fillRect(0, 0, W, H); });
    let st = { wall: 'dawn', t, wake: 0 };
    if (t < 2.6) {   // macro: a light-run down the frame edge, across the crown
      const u = t / 2.6; pose(phone, [0, 0, 0, 0.08, -PI / 2 + 0.6, 0.04]); const d = partPos(phone, 'dial');
      E.look(d.x + 0.55, d.y + 0.3 - u * 0.4, d.z + 1.45, d.x, d.y - u * 0.25, d.z, 28); E.bokeh.enabled = true; E.bokeh.uniforms.focus.value = 1.56; E.bokeh.uniforms.aperture.value = 0.0035; E.bokeh.uniforms.maxblur.value = 0.006;
      E.L.sweep.intensity = 1.4; E.L.sweep.distance = 1.6; E.L.sweep.position.set(d.x + 0.5, d.y + 0.8 - u * 1.6, d.z + 0.6); P.dial.rotation.x = u * 1.2;
    } else if (t < 4.6) {   // macro: across the iris camera
      const u = (t - 2.6) / 2; pose(phone, [0, 0, 0, 0.1, PI + 0.35, 0.03]); const c = partPos(phone, 'camera');
      E.look(c.x - 0.45 + u * 0.55, c.y + 0.12, c.z + 1.5, c.x, c.y, c.z, 26); E.bokeh.enabled = true; E.bokeh.uniforms.focus.value = 1.56; E.bokeh.uniforms.aperture.value = 0.003; E.bokeh.uniforms.maxblur.value = 0.006;
      E.L.sweep.intensity = 1.8; E.L.sweep.distance = 2; E.L.sweep.position.set(c.x - 0.9 + u * 1.8, c.y + 0.4, c.z + 0.8);
    } else {   // the reveal: back to front against the sunrise
      const p = track([[4.6, 0, 0.0, 0, 0.18, PI + 0.55, 0.05], [7.0, 0, 0.02, 0.2, 0.04, 0.12, 0], [9.4, 0, 0.02, 0.35, 0, 0, 0], [11.5, 0, 0.12, 0.45, 0, 0, 0]], t); p[1] += Math.sin(t * 1.2) * 0.015; pose(phone, p);
      E.look(0, 0, 6.2 - 0.8 * sm(4.6, 11.5, t), 0, 0.05, 0, 22);
      st = { wall: 'dawn', t, wake: sm(7.1, 7.7, t), tn: t - 7.4, unlock: sm(8.6, 9.5, t), type: clamp((t - 9.7) / 1.2, 0, 1) };
    }
    askGlow(phone, 0.3 + 0.7 * Math.sin(clamp((t - 6.7) / 0.6, 0, 1) * PI));
    return st;
  },
  overlay(o, t, W, H) {
    const cut = [2.6, 4.6].reduce((m, c) => Math.max(m, 1 - Math.abs(t - c) / 0.14), 0); if (cut > 0) { o.fillStyle = `rgba(0,0,0,${cut})`; o.fillRect(0, 0, W, H); }
    if (t < 0.6) { o.fillStyle = `rgba(0,0,0,${1 - t / 0.6})`; o.fillRect(0, 0, W, H); }
    const a = sm(9.9, 10.6, t); type(o, 'Every day, a little lighter.', W / 2, H * 0.93, `300 ${Math.round(H * 0.045)}px ${SERIF}`, '#ffe9d8', a, 'center');
    type(o, 'KILN', W * 0.1, H * 0.5, `300 ${Math.round(H * 0.08)}px ${SERIF}`, '#ffe9d8', sm(10.2, 10.9, t), 'center', 4); type(o, 'CONCEPT', W * 0.1, H * 0.5 + H * 0.05, `600 ${Math.round(H * 0.015)}px ${SANS}`, '#e0743e', sm(10.4, 11, t), 'center', 5);
  },
};

export const DIRS = { light, made, pulse, dawn };
