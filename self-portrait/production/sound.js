// sound.js — soundtrack for the 24 s cut (v2), synthesized from the film's timeline (48 kHz stereo, loopable).
// (sound_v1.js is the score of the original 46 s cut.)
// node sound.js out.wav [gainDb]
// Hum + soft key ticks + a small chiptune-meets-pad score. Everything is rendered on a
// circular buffer (events and reverb tails wrap), so the file loops without a seam.
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
require(path.resolve(__dirname, '..', 'js', 'tl.js'));
const TL = globalThis.TL;
const SR = 48000, D = TL.D, N = Math.round(SR * D);
const Ld = new Float32Array(N), Rd = new Float32Array(N);     // dry
const Lw = new Float32Array(N), Rw = new Float32Array(N);     // reverb send
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const wrap = i => ((i % N) + N) % N;
function add(i, l, r, send) { const j = wrap(i); Ld[j] += l; Rd[j] += r; if (send) { Lw[j] += l * send; Rw[j] += r * send; } }
function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }

// --- voices -----------------------------------------------------------------------------------
// pulse-wave pluck (the "chip" voice), gently low-passed
function pluck(t0, midi, dur, vol, pan, duty, send, cut) {
  const f = mtof(midi), dt = f / SR, n = Math.round((dur + 0.25) * SR), i0 = Math.round(t0 * SR);
  let ph = 0, lp = 0; const a = 1 - Math.exp(-2 * Math.PI * (cut || 2600) / SR), pl = Math.cos(pan * Math.PI / 2 + Math.PI / 4), pr = Math.sin(pan * Math.PI / 2 + Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const tt = i / SR;
    let s = (ph < duty ? 1 : -1) + blep(ph, dt) - blep((ph - duty + 1) % 1, dt);
    ph += dt; if (ph >= 1) ph -= 1;
    const env = Math.min(1, tt / 0.004) * Math.exp(-tt / (dur * 0.45)) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.25) : 1);
    lp += a * (s - lp);
    const v = lp * env * vol;
    add(i0 + i, v * pl, v * pr, send);
  }
}
// pad: three detuned saws through a slow low-pass, slow attack/release, optional pitch waver
function pad(t0, midi, dur, vol, pan, o) {
  o = o || {};
  const f = mtof(midi), atk = o.atk || 0.8, rel = o.rel || 1.4, n = Math.round((dur + rel) * SR), i0 = Math.round(t0 * SR);
  const det = [0.9966, 1, 1.0041], ph = [rnd(), rnd(), rnd()];
  let lp = 0, lp2 = 0; const pl = Math.cos(pan * Math.PI / 2 + Math.PI / 4), pr = Math.sin(pan * Math.PI / 2 + Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const tt = i / SR;
    const wav = o.waver ? 1 + o.waver * Math.sin(2 * Math.PI * (o.wrate || 4.2) * tt + midi) * Math.min(1, tt / 0.6) : 1;
    let s = 0;
    for (let k = 0; k < 3; k++) { const dt = f * det[k] * wav / SR; s += 2 * ph[k] - 1 - blep(ph[k], dt); ph[k] += dt; if (ph[k] >= 1) ph[k] -= 1; }
    const cut = (o.cut || 700) * (1 + 0.5 * Math.sin(2 * Math.PI * 0.11 * (t0 + tt)));
    const a = 1 - Math.exp(-2 * Math.PI * cut / SR);
    lp += a * (s / 3 - lp); lp2 += a * (lp - lp2);
    const env = Math.min(1, tt / atk) * (tt > dur ? Math.max(0, 1 - (tt - dur) / rel) : 1);
    const v = lp2 * env * env * vol;
    add(i0 + i, v * pl, v * pr, o.send === undefined ? 0.5 : o.send);
  }
}
// soft bell / ping (sine + a quiet octave), used for the cursor and the last note
function ping(t0, midi, dur, vol, pan, send) {
  const f = mtof(midi), n = Math.round(dur * 4 * SR), i0 = Math.round(t0 * SR);
  const pl = Math.cos(pan * Math.PI / 2 + Math.PI / 4), pr = Math.sin(pan * Math.PI / 2 + Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const tt = i / SR, env = Math.min(1, tt / 0.006) * Math.exp(-tt / dur);
    const v = (Math.sin(2 * Math.PI * f * tt) + 0.22 * Math.sin(2 * Math.PI * f * 2 * tt) * Math.exp(-tt / (dur * 0.4)) + 0.08 * Math.sin(2 * Math.PI * f * 3.01 * tt) * Math.exp(-tt / (dur * 0.2))) * env * vol;
    add(i0 + i, v * pl, v * pr, send === undefined ? 0.6 : send);
  }
}
function tri(t0, midi, dur, vol) { // soft bass
  const f = mtof(midi), n = Math.round((dur + 0.3) * SR), i0 = Math.round(t0 * SR);
  for (let i = 0; i < n; i++) {
    const tt = i / SR, p = (f * tt) % 1, s = (4 * Math.abs(p - 0.5) - 1) * 0.7 + Math.sin(2 * Math.PI * f * tt) * 0.5;
    const env = Math.min(1, tt / 0.03) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.3) : 1) * (0.75 + 0.25 * Math.exp(-tt * 2));
    add(i0 + i, s * env * vol, s * env * vol, 0.15);
  }
}
// key tick: a tiny filtered-noise click with a low body (soft, never sharp)
function tick(t0, vol, pan, bright) {
  const n = Math.round(0.06 * SR), i0 = Math.round(t0 * SR); let bp1 = 0, bp2 = 0, lp = 0;
  const fc = (bright || 1) * 1900, q = 0.6, w = 2 * Math.PI * fc / SR;
  const pl = Math.cos(pan * Math.PI / 2 + Math.PI / 4), pr = Math.sin(pan * Math.PI / 2 + Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const tt = i / SR, x = (rnd() * 2 - 1) * Math.exp(-tt / 0.006);
    bp1 += w * (x - bp1 * q - bp2); bp2 += w * bp1;       // state-variable band-pass
    lp += 0.25 * (bp1 - lp);
    const body = Math.sin(2 * Math.PI * 150 * tt) * Math.exp(-tt / 0.018) * 0.5;
    const v = (lp * 1.6 + body) * vol;
    add(i0 + i, v * pl, v * pr, 0.25);
  }
}
function thud(t0, vol) {
  const n = Math.round(0.3 * SR), i0 = Math.round(t0 * SR);
  for (let i = 0; i < n; i++) { const tt = i / SR, v = Math.sin(2 * Math.PI * (70 - 40 * tt) * tt) * Math.exp(-tt / 0.06) * vol; add(i0 + i, v, v, 0.3); }
  tick(t0, vol * 0.5, 0, 0.6);
}

// --- hum: always there, warm and low; integer cycles over the loop so it wraps exactly --------
const cyc = f => Math.round(f * D) / D;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const swell = 0.75 + 0.25 * Math.sin(2 * Math.PI * (3 / D) * t - 1.2);
  const h = (Math.sin(2 * Math.PI * cyc(55) * t) * 0.5 + Math.sin(2 * Math.PI * cyc(110.3) * t) * 0.22 + Math.sin(2 * Math.PI * cyc(164.9) * t) * 0.07 * (1 + Math.sin(2 * Math.PI * (5 / D) * t))) * swell * 0.045;
  Ld[i] += h * (1 + 0.1 * Math.sin(2 * Math.PI * (7 / D) * t)); Rd[i] += h * (1 - 0.1 * Math.sin(2 * Math.PI * (7 / D) * t));
}

// --- score (film time; F(lin) converts a linear timeline cue to film seconds) -------------------
const F = TL.film;
const NOTE = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const n = (s) => { const m = s.match(/^([A-G][b#]?)(\d)$/); return 12 * (+m[2] + 1) + NOTE[m[1]]; };
const HOME = n('A5');
const STEP = 0.25;
const chord = (t0, notes, vol, spread, duty, cut) => notes.forEach((p, j) => pluck(t0 + j * spread, n(p), 0.42, vol, j % 2 ? 0.5 : -0.5, duty || 0.25, 0.6, cut || 2400));

// 0.0 — THE HOOK: the first face lands on a full D-minor-9 strike (this is also where the library run resolves)
tri(0, n('D2'), 0.9, 0.12); tri(0, n('D3'), 0.5, 0.05);
chord(0, ['D4', 'A4', 'F5', 'E5', 'A5'], 0.075, 0.012, 0.25, 3200);
ping(0, n('A5'), 0.7, 0.07, 0.15, 0.7); ping(0.01, n('D6'), 0.6, 0.045, -0.15, 0.8);
['D3', 'A3', 'F4', 'E4'].forEach((p, k) => pad(-0.12, n(p), 0.75, 0.07, (k - 1.5) * 0.3, { atk: 0.1, rel: 0.5, cut: 900, waver: 0.003 }));
tick(0, 0.05, 0, 0.8);
// faces: an accent on every new face, harmony that cannot decide, pitch wavering more each time
const FACE = [
  ['G2', ['G3', 'D4', 'A4', 'Bb4']], ['A2', ['A3', 'E4', 'G4', 'D5']], ['Bb2', ['Bb3', 'F4', 'A4', 'E5']],
  ['E2', ['E3', 'Bb3', 'D4', 'G4']], ['A2', ['A3', 'E4', 'G4', 'C#5']]
];
FACE.forEach(([bass, pn], k) => {
  const t0 = 0.5 * (k + 1);
  tri(t0, n(bass), 0.4, 0.085);
  pn.forEach((p, j) => pad(t0 - 0.06, n(p), 0.42, 0.07, (j - 1.5) * 0.35, { atk: 0.08, rel: 0.35, cut: 760, waver: 0.006 + k * 0.002, wrate: 4 + j * 0.6 }));
  chord(t0, pn.map(p => p.replace(/\d/, d => String(+d + 1))), 0.05, 0.035, 0.125, 2600);
  pluck(t0 + 0.25, n(pn[3]) + 12, 0.2, 0.026, k % 2 ? 0.6 : -0.6, 0.125, 0.8, 2000);            // the swarm between faces
  pluck(t0 + 0.375, n(pn[1]) + 12, 0.2, 0.02, k % 2 ? -0.6 : 0.6, 0.125, 0.8, 1800);
});
pluck(0.25, n('E5'), 0.2, 0.026, 0.5, 0.125, 0.8, 2000); pluck(0.375, n('F5'), 0.2, 0.022, -0.5, 0.125, 0.8, 1800);
// collapse: the notes fall
const c0 = F(TL.collapse[0]), cd = TL.collapse[1] - TL.collapse[0];
['A5', 'G5', 'E5', 'D5', 'C5', 'A4', 'G4', 'E4', 'D4', 'A3'].forEach((p, k) => pluck(c0 + 0.03 + k * cd / 11, n(p), 0.26, 0.04 - k * 0.002, (k % 3 - 1) * 0.5, 0.125, 0.8, 1900 - k * 70));
pad(c0, n('D2'), cd + 0.2, 0.09, 0, { atk: 0.3, rel: 0.8, cut: 400 });
// the lantern: one warm tone and its fifth; then the reflections answer, receding
const l0 = F(TL.lantern[0]);
pad(l0 + 0.1, n('D3'), 1.7, 0.09, 0, { atk: 0.5, rel: 0.9, cut: 800 }); pad(l0 + 0.1, n('A3'), 1.7, 0.075, 0.2, { atk: 0.55, rel: 0.9, cut: 800 }); pad(l0 + 0.25, n('F#4'), 1.5, 0.06, -0.2, { atk: 0.55, rel: 0.9, cut: 860 });
ping(l0 + 0.3, n('A4'), 0.8, 0.08, 0, 0.7);
const r0 = F(TL.regress[0]), rd = TL.regress[1] - TL.regress[0];
for (let k = 0; k < 12; k++) ping(r0 + k * rd / 13, n('A4') + [0, 2, 5, 7, 9, 12, 14, 17, 19, 21, 24, 26][k], 0.26, 0.042 * Math.pow(0.88, k), (k % 2 ? 1 : -1) * Math.min(0.8, 0.1 * k), 0.9);
// a swell into the city, then the bloom on the bar line at 6.0
['Bb2', 'F3', 'C4', 'D4'].forEach((p, k) => pad(F(TL.glassCity[0]), n(p), 6.0 - F(TL.glassCity[0]), 0.05, (k - 1.5) * 0.3, { atk: 0.8, rel: 0.3, cut: 700 }));
const CITY = [
  [6.0, 'Bb1', ['Bb2', 'F3', 'D4', 'A4', 'C5'], ['Bb3', 'D4', 'F4', 'A4', 'C5', 'D5', 'F5', 'A5']],
  [8.0, 'F1', ['F2', 'C3', 'A3', 'E4', 'G4'], ['F3', 'A3', 'C4', 'E4', 'G4', 'A4', 'C5', 'E5']],
  [10.0, 'C2', ['C3', 'G3', 'E4', 'D4', 'G4'], ['C4', 'E4', 'G4', 'D5', 'E5', 'G5', 'D5', 'G4']],
  [12.0, 'D2', ['D3', 'A3', 'F4', 'E4', 'A4'], ['D4', 'F4', 'A4', 'E5', 'F5', 'A5', 'E5', 'A4']],
  [14.0, 'Bb1', ['Bb2', 'F3', 'D4', 'A4'], ['Bb3', 'F4', 'A4', 'D5', 'F5', 'D5', 'A4', 'F4']]
];
const tClose = F(TL.lapClose);
CITY.forEach(([t0, bass, pn, an], ci) => {
  const wide = ci < 1, vol = ci === 0 ? 1 : ci < 4 ? 0.82 : 0.6;
  pn.forEach((p, k) => pad(t0 - 0.2, n(p), 2.0, 0.075 * vol, (k - 2) * 0.28, { cut: wide ? 1200 : 850, atk: 0.3, rel: 0.7 }));
  tri(t0, n(bass) + 12, 1.8, 0.1 * vol); if (ci < 2) tri(t0 + 1.0, n(bass) + 19, 0.8, 0.055);
  an.forEach((p, k) => {
    const tt = t0 + k * STEP; if (tt > tClose - 0.3) return;
    pluck(tt, n(p), 0.4, 0.055 * vol, k % 2 ? 0.5 : -0.5, 0.25, 0.5, wide ? 3200 : 2400);
    if (ci < 2) pluck(tt + STEP / 2, n(p) + 12, 0.24, 0.024, k % 2 ? -0.6 : 0.6, 0.125, 0.7, 3200);
  });
  if (ci < 4) { ping(t0 + 0.01, n(an[4]) + 12, 0.45, 0.034 * vol, 0.1); ping(t0 + 1.0, n(an[2]) + 12, 0.4, 0.026 * vol, -0.1); }
});
chord(6.0, ['Bb4', 'D5', 'F5', 'A5', 'C6'], 0.05, 0.03, 0.25, 3400); ping(6.0, n('D6'), 0.8, 0.05, 0, 0.8);
// rooms: soft typing in the first room and the last; the laptop closes
for (let t = F(TL.pan0) + 0.05; t < F(TL.pan0) + TL.rest; t += 0.11) if (rnd() < 0.7) tick(t + rnd() * 0.03, 0.016, 0.3, 1.2);
for (let t = F(TL.arrive5) - 0.2; t < tClose - 0.45; t += 0.1) if (rnd() < 0.8) tick(t + rnd() * 0.03, 0.02, 0.1, 1.1);
thud(tClose + 0.08, 0.11);
// lights out: thin to one note
const d0 = F(TL.dim[0]), d1 = F(TL.dim[1]);
pad(tClose, n('C3'), d1 - tClose - 0.2, 0.055, 0, { atk: 0.3, rel: 1.0, cut: 520 }); pad(tClose, n('G3'), d1 - tClose - 0.2, 0.045, 0.2, { atk: 0.3, rel: 1.0, cut: 520 }); pad(tClose + 0.2, n('D4'), d1 - tClose - 0.5, 0.035, -0.2, { atk: 0.3, rel: 1.0, cut: 520 });
ping(d0, n('E5'), 1.0, 0.045, 0.2, 0.8); ping(d0 + 0.45, n('A4'), 1.1, 0.05, -0.1, 0.8);
ping(d1, HOME, 1.3, 0.05, 0, 0.9);                       // the one note
// the cursor: a ping on each blink-on; a real key; the slit; the door
const cur = F(TL.curOn);
[0, 0.7, 1.4].forEach(dt => { ping(cur + dt, HOME, 0.25, 0.05, 0, 0.8); tick(cur + dt, 0.022, 0, 0.7); });
const key = F(TL.key);
tick(key, 0.24, 0, 1); thud(key + 0.004, 0.13);
ping(F(TL.slit[0]), n('A4'), 0.4, 0.05, -0.2); ping(F(TL.slit[0]) + 0.2, n('E5'), 0.4, 0.05, 0.2); ping(F(TL.part[0]), n('A5'), 0.6, 0.05, 0);
// the library: a rising run over a dominant pedal that resolves exactly at the loop point
const lib0 = F(TL.door[0]) + 0.25, libN = 24 - lib0;
const SCALE = ['A2', 'C#3', 'E3', 'G3', 'A3', 'Bb3', 'C#4', 'D4', 'E4', 'G4', 'A4', 'Bb4', 'C#5', 'D5', 'E5', 'G5', 'A5', 'Bb5', 'C#6', 'E6'];
const steps = Math.floor(libN / 0.125);
for (let k = 0; k < steps; k++) {
  const f = k / (steps - 1), idx = Math.min(SCALE.length - 1, Math.floor(Math.pow(f, 0.9) * (SCALE.length - 4)) + (k % 3 === 2 ? 2 : k % 3));
  pluck(24 - (steps - k) * 0.125, n(SCALE[idx]), 0.2 + 0.15 * (1 - f), 0.022 + 0.04 * f * f, k % 2 ? 0.5 : -0.5, k % 4 === 0 ? 0.25 : 0.125, 0.6, 1600 + 1800 * f);
}
['A2', 'E3', 'G3', 'D4', 'C#4'].forEach((p, k) => pad(lib0, n(p), libN - 0.25, 0.03 + 0.012 * k, (k - 2) * 0.3, { atk: libN * 0.85, rel: 0.2, cut: 900, waver: k === 4 ? 0.004 : 0 }));
for (let k = 0; k < 4; k++) tri(24 - 2.0 + k * 0.5, n('A1') + 12, 0.42, 0.05 + 0.02 * k);
// the moon turns a page: a soft paper swish and a spill of chimes; chimes thicken as the glyphs gather
(function swish(t0, dur, vol) {
  const nn = Math.round(dur * SR), i0 = Math.round(t0 * SR); let lp = 0, hp = 0;
  for (let i = 0; i < nn; i++) { const tt = i / nn, x = rnd() * 2 - 1; lp += 0.35 * (x - lp); hp += 0.02 * (lp - hp); const env = Math.sin(Math.PI * tt) ** 2 * vol, v = (lp - hp) * env; add(i0 + i, v * (1 - tt * 0.6), v * (0.4 + tt * 0.6), 0.5); }
})(F(TL.turn[0]), TL.turn[1] - TL.turn[0], 0.06);
for (let k = 0; k < 7; k++) ping(F(TL.turn[0]) + 0.3 + k * 0.09 + rnd() * 0.03, n(['A5', 'G5', 'E5', 'D5', 'C#5', 'A5', 'E5'][k]) + 12, 0.25, 0.02, rnd() * 1.4 - 0.7, 1);
for (let k = 0; k < 14; k++) { const f = k / 13; ping(F(TL.gather[0]) + Math.pow(f, 0.7) * (TL.gather[1] - TL.gather[0] - 0.08), n(['E5', 'A5', 'C#6', 'E6'][k % 4]) + (k > 9 ? 12 : 0), 0.18, 0.012 + 0.016 * f, (k % 2 ? 1 : -1) * 0.6, 1); }

// --- reverb (4 combs + 2 all-passes per side), run twice around the loop so tails wrap ----------
function reverb(inp, delays, apd) {
  const out = new Float32Array(N);
  for (const dl of delays) {
    const buf = new Float32Array(dl); let p = 0, lp = 0; const fb = 0.83, damp = 0.35;
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) {
      const y = buf[p]; lp = y * (1 - damp) + lp * damp; buf[p] = inp[i] + lp * fb; p = (p + 1) % dl;
      if (pass === 1) out[i] += y * 0.25;
    }
  }
  let cur = out;
  for (const dl of apd) {
    const buf = new Float32Array(dl); let p = 0; const res = new Float32Array(N);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { const b = buf[p], x = cur[i] + b * 0.5; buf[p] = x; p = (p + 1) % dl; if (pass === 1) res[i] = b - x * 0.5; }
    cur = res;
  }
  return cur;
}
const revL = reverb(Lw, [1687, 1931, 2053, 2251], [347, 113]), revR = reverb(Rw, [1733, 1973, 2099, 2293], [359, 127]);
const gainDb = parseFloat(process.argv[3] || '0'), gain = Math.pow(10, gainDb / 20);
const out = Buffer.alloc(44 + N * 4);
let peak = 0;
const soft = x => 0.84 * Math.tanh(x / 0.84);     // gentle saturation as a safety limiter (ceiling about -1.5 dBFS)
for (let i = 0; i < N; i++) {
  const l = soft((Ld[i] + revL[i] * 0.9) * gain), r = soft((Rd[i] + revR[i] * 0.9) * gain);
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l)) * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r)) * 32767), 46 + i * 4);
}
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
fs.writeFileSync(process.argv[2], out);
console.log('wrote', process.argv[2], 'samples', N, 'peak', (20 * Math.log10(peak)).toFixed(2), 'dBFS');
