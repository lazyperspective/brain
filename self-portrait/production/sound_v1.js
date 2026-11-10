// sound.js — original soundtrack, synthesized from the film's timeline (48 kHz stereo, loopable).
// node sound.js out.wav [gainDb]
// Hum + soft key ticks + a small chiptune-meets-pad score. Everything is rendered on a
// circular buffer (events and reverb tails wrap), so the file loops without a seam.
const fs = require('fs'), path = require('path');
globalThis.window = globalThis; globalThis.CUT = 'v1';
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
  const h = (Math.sin(2 * Math.PI * cyc(55) * t) * 0.5 + Math.sin(2 * Math.PI * cyc(110.3) * t) * 0.22 + Math.sin(2 * Math.PI * cyc(164.9) * t) * 0.07 * (1 + Math.sin(2 * Math.PI * (5 / D) * t))) * swell * 0.085;
  Ld[i] += h * (1 + 0.1 * Math.sin(2 * Math.PI * (7 / D) * t)); Rd[i] += h * (1 - 0.1 * Math.sin(2 * Math.PI * (7 / D) * t));
}

// --- score -------------------------------------------------------------------------------------
const NOTE = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const n = (s) => { const m = s.match(/^([A-G][b#]?)(\d)$/); return 12 * (+m[2] + 1) + NOTE[m[1]]; };
const HOME = n('A5');   // the one note: the cursor's voice
// 1. cursor: one soft ping per blink (the blink-on moments), a real key at the keystroke
const blinkOns = []; for (let k = 0; k < D + 1; k++) { const t = k - 0.1; if (t >= -0.2) blinkOns.push(t); }
blinkOns.forEach(t => {
  const tt = ((t % D) + D) % D;
  if (tt < TL.key - 0.4) { ping(tt, HOME, 0.28, 0.045, 0, 0.8); tick(tt, 0.02, 0, 0.7); }
  if (tt >= TL.curOn - 0.05) { ping(tt, HOME, 0.28, 0.045, 0, 0.8); tick(tt, 0.02, 0, 0.7); }
});
tick(TL.key, 0.22, 0, 1); thud(TL.key + 0.004, 0.12);
// the slit of light: a rising fifth, then the door opens on the first chord
ping(TL.slit[0], n('D5'), 0.5, 0.05, -0.2); ping(TL.slit[0] + 0.3, n('A5'), 0.6, 0.05, 0.2); ping(TL.part[0], n('D6'), 0.9, 0.04, 0);

const STEP = 0.3125;
// chord book: [start, dur, bass, pad notes, arp notes]
const LIB = [
  [5.2, 2.5, 'D2', ['D3', 'A3', 'F4', 'E4'], ['D4', 'A4', 'E5', 'F5', 'A5', 'F5', 'E5', 'A4']],
  [7.7, 2.5, 'Bb1', ['Bb2', 'F3', 'D4', 'A4'], ['Bb3', 'F4', 'A4', 'D5', 'F5', 'D5', 'A4', 'F4']],
  [10.2, 2.5, 'F2', ['F3', 'C4', 'A4', 'G4'], ['F4', 'A4', 'C5', 'G5', 'A5', 'G5', 'C5', 'A4']],
  [12.7, 2.5, 'C2', ['C3', 'G3', 'E4', 'D4'], ['C4', 'G4', 'D5', 'E5', 'G5', 'E5', 'D5', 'G4']]
];
LIB.forEach(([t0, dur, bass, pn, an], ci) => {
  pn.forEach((p, k) => pad(t0 - 0.3, n(p), dur + 0.2, 0.07, (k - 1.5) * 0.3, { cut: 620 + ci * 60 }));
  an.forEach((p, k) => pluck(t0 + k * STEP, n(p), 0.5, 0.04 + 0.012 * Math.min(ci, 2), k % 2 ? 0.45 : -0.45, 0.25, 0.55, 2200));
  // glyph-snow: tiny high chimes, off the grid
  for (let k = 0; k < 3; k++) ping(t0 + rnd() * dur, n(an[Math.floor(rnd() * an.length)]) + 12, 0.25, 0.012, rnd() * 1.6 - 0.8, 1);
});
// the moon turns a page: a soft paper swish and a spill of chimes
(function swish(t0, dur, vol) {
  const n = Math.round(dur * SR), i0 = Math.round(t0 * SR); let lp = 0, hp = 0;
  for (let i = 0; i < n; i++) { const tt = i / n, x = rnd() * 2 - 1; lp += 0.35 * (x - lp); hp += 0.02 * (lp - hp); const env = Math.sin(Math.PI * tt) ** 2 * vol, v = (lp - hp) * env; add(i0 + i, v * (1 - tt * 0.6), v * (0.4 + tt * 0.6), 0.5); }
})(9.2, 1.0, 0.05);
for (let k = 0; k < 9; k++) ping(9.55 + k * 0.11 + rnd() * 0.04, n(['A5', 'G5', 'E5', 'D5', 'C5', 'A5', 'F5', 'D5', 'A4'][k]) + 12, 0.3, 0.02, rnd() * 1.4 - 0.7, 1);
// 3. the mirror: the harmony cannot decide; pitch wavers; each new face is a broken chord
const FACE = [
  ['G2', ['G3', 'D4', 'A4', 'Bb4']], ['A2', ['A3', 'E4', 'G4', 'D5']], ['Bb2', ['Bb3', 'F4', 'A4', 'E5']],
  ['E2', ['E3', 'Bb3', 'D4', 'G4']], ['F2', ['F3', 'C4', 'Eb4', 'A4']], ['A2', ['A3', 'E4', 'G4', 'C#5']]
];
pad(15.0, n('D3'), 2.1, 0.06, 0, { cut: 560, waver: 0.004 }); pad(15.0, n('A3'), 2.1, 0.05, 0.3, { cut: 560, waver: 0.004 }); pad(15.0, n('E4'), 2.1, 0.04, -0.3, { cut: 560, waver: 0.005 });
for (let k = 0; k < 6; k++) pluck(15.3 + k * STEP, n(['D4', 'E4', 'A4', 'D5', 'E5', 'A5'][k]), 0.4, 0.03, k % 2 ? 0.4 : -0.4, 0.125, 0.7, 1800);
const FDUR = (TL.faces[1] - TL.faces[0]) / 6;
FACE.forEach(([bass, pn], k) => {
  const t0 = TL.faces[0] + k * FDUR;
  pn.forEach((p, j) => pad(t0 - 0.15, n(p), FDUR - 0.1, 0.06, (j - 1.5) * 0.35, { atk: 0.35, rel: 0.7, cut: 600, waver: 0.006 + k * 0.0015, wrate: 3.6 + j * 0.5 }));
  pn.forEach((p, j) => pluck(t0 + 0.02 + j * 0.09, n(p) + 12, 0.35, 0.034, j % 2 ? 0.5 : -0.5, 0.125, 0.7, 2000));
  if (k % 2) pluck(t0 + FDUR * 0.62, n(pn[2]) + 12, 0.3, 0.02, 0, 0.125, 0.8, 1600);
});
// collapse: the notes fall
['A5', 'G5', 'E5', 'D5', 'C5', 'A4', 'G4', 'E4', 'D4', 'A3'].forEach((p, k) => pluck(TL.collapse[0] + 0.05 + k * 0.1, n(p), 0.3, 0.032 - k * 0.0015, (k % 3 - 1) * 0.5, 0.125, 0.8, 1700 - k * 60));
pad(TL.collapse[0], n('D2'), 1.4, 0.07, 0, { atk: 0.5, rel: 1.0, cut: 380 });
// the lantern: one warm tone and its fifth, then the reflections answer, receding
pad(TL.lantern[0] + 0.2, n('D3'), 2.4, 0.075, 0, { atk: 0.9, rel: 1.2, cut: 760 }); pad(TL.lantern[0] + 0.2, n('A3'), 2.4, 0.06, 0.2, { atk: 1.0, rel: 1.2, cut: 760 }); pad(TL.lantern[0] + 0.5, n('F#4'), 2.1, 0.05, -0.2, { atk: 1.0, rel: 1.2, cut: 820 });
ping(TL.lantern[0] + 0.55, n('A4'), 0.9, 0.07, 0, 0.7);
for (let k = 0; k < 11; k++) ping(TL.regress[0] + k * 0.105, n('A5') + [0, 2, 5, 7, 9, 12, 14, 17, 19, 21, 24][k] - 12, 0.3, 0.035 * Math.pow(0.86, k), (k % 2 ? 1 : -1) * Math.min(0.8, 0.1 * k), 0.9);
// 4. the city blooms
const CITY = [
  [26.0, 'Bb1', ['Bb2', 'F3', 'D4', 'A4', 'C5'], ['Bb3', 'D4', 'F4', 'A4', 'C5', 'D5', 'F5', 'A5']],
  [28.5, 'F1', ['F2', 'C3', 'A3', 'E4', 'G4'], ['F3', 'A3', 'C4', 'E4', 'G4', 'A4', 'C5', 'E5']],
  [31.0, 'C2', ['C3', 'G3', 'E4', 'D4', 'G4'], ['C4', 'E4', 'G4', 'D5', 'E5', 'G5', 'D5', 'G4']],
  [33.5, 'D2', ['D3', 'A3', 'F4', 'E4', 'A4'], ['D4', 'F4', 'A4', 'E5', 'F5', 'A5', 'E5', 'A4']],
  [36.0, 'Bb1', ['Bb2', 'F3', 'D4', 'A4'], ['Bb3', 'F4', 'A4', 'D5', 'F5', 'D5', 'A4', 'F4']],
  [38.5, 'C2', ['C3', 'G3', 'E4', 'D4'], ['C4', 'G4', 'D5', 'E5', 'G5', 'E5', 'D5', 'G4']]
];
CITY.forEach(([t0, bass, pn, an], ci) => {
  const wide = ci < 2, vol = ci < 2 ? 1 : ci < 4 ? 0.8 : ci === 4 ? 0.62 : 0.42;
  pn.forEach((p, k) => pad(t0 - 0.35, n(p), 2.7, 0.07 * vol, (k - 2) * 0.28, { cut: wide ? 1100 : 800, atk: ci === 0 ? 1.0 : 0.6 }));
  tri(t0, n(bass) + 12, 2.3, 0.09 * vol); if (wide) tri(t0 + 1.25, n(bass) + 19, 1.0, 0.05);
  an.forEach((p, k) => {
    if (ci === 5 && k > 4) return;                               // the arpeggio starts to leave
    pluck(t0 + k * STEP, n(p), 0.5, 0.05 * vol, k % 2 ? 0.5 : -0.5, 0.25, 0.5, wide ? 3000 : 2300);
    if (wide) pluck(t0 + k * STEP + STEP / 2, n(p) + 12, 0.3, 0.022, k % 2 ? -0.6 : 0.6, 0.125, 0.7, 3200);
  });
  // a small tune over the top (triangle-ish ping), one phrase per chord
  const mel = [['A5', 0], ['C6', 0.625], ['D6', 0.9375], ['F5', 1.5625]][ci % 4];
  if (ci < 5) { ping(t0 + 0.02, n(an[4]) + 12, 0.5, 0.03 * vol, 0.1); ping(t0 + 1.27, n(an[2]) + 12, 0.45, 0.024 * vol, -0.1); }
});
// rooms: typing in room 1 and room 5 (very soft), pencil, pen
for (let t = TL.pan0 + 0.1; t < TL.pan0 + TL.rest; t += 0.125) if (rnd() < 0.7) tick(t + rnd() * 0.03, 0.016, 0.3, 1.2);
for (let t = TL.arrive5 + 0.1; t < TL.lapClose - 0.5; t += 0.11) if (rnd() < 0.75) tick(t + rnd() * 0.03, 0.02, 0.1, 1.1);
thud(TL.lapClose + 0.1, 0.1);                                    // the laptop closes
// 5. thinning to one note
pad(40.9, n('D3'), 1.6, 0.05, 0, { atk: 0.4, rel: 1.6, cut: 520 }); pad(40.9, n('A3'), 1.6, 0.04, 0, { atk: 0.4, rel: 1.6, cut: 520 });
ping(TL.dim[0], n('A4'), 1.4, 0.05, 0, 0.8); ping(TL.dim[0] + 0.6, n('E5'), 1.2, 0.035, 0.2, 0.8);
ping(TL.dim[1] - 0.1, HOME, 1.6, 0.04, 0, 0.9);                   // the last note is the cursor's note

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
const soft = x => Math.tanh(x * 1.0);     // gentle saturation as a safety limiter
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
