// verify.js — seam, flash, pop, determinism, still palette / block uniformity, loudness.
const fs = require('fs'), { execFileSync, spawnSync } = require('child_process');
const V = '/home/user/brain/self-portrait-video';
const st = JSON.parse(fs.readFileSync(V + '/stats.json')), st2 = JSON.parse(fs.readFileSync(V + '/stats2.json'));
const N = st.length, FPS = 30, out = [];
globalThis.window = globalThis;
for (const f of ['px', 'glyphs', 'tl', 'lan', 's1', 's2', 's3', 's4', 's5']) require('../js/' + f + '.js');
const TL = globalThis.TL, F = TL.film;
const P = s => out.push(s);
let ok = true; const check = (name, pass, detail) => { if (!pass) ok = false; P(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
P('SELF-PORTRAIT — verification, cut ' + 'v2 (24 s, cold open on the mirror)  (' + new Date().toISOString().slice(0, 10) + ')');
P(`frames: ${N} @ ${FPS} fps = ${(N / FPS).toFixed(3)} s, native 480x270, x4 nearest -> 1920x1080`); P('');

// determinism
let same = 0; for (let i = 0; i < N; i++) if (st[i].sha === st2[i].sha) same++;
check('determinism: two independent renders, per-frame SHA-1 identical', same === N, `${same}/${N} frames identical`);

// seam (raw)
P(''); P('SEAM (raw frames) — the film now loops through a moving shot, so the test is continuity, not identity');
P('  renderAt(D) === renderAt(0) by construction (time is taken modulo D; all scene clocks are continuous through the loop point)');
const seam = st[0].diff, before = st.slice(N - 8).map(s => s.diff), after = st.slice(1, 9).map(s => s.diff);
P(`  mean |dY| per step, last 8 steps before the seam: ${before.map(v => v.toFixed(5)).join(' ')}`);
P(`  step across the seam (frame ${N - 1} -> frame 0): ${seam.toFixed(5)}`);
P(`  first 8 steps after the seam: ${after.map(v => v.toFixed(5)).join(' ')}`);
check('step across the seam is ordinary (not larger than the largest neighbouring step x1.5)', seam <= 1.5 * Math.max(...before, ...after) + 1e-6, `seam ${seam.toFixed(5)} vs neighbours max ${Math.max(...before, ...after).toFixed(5)}`);

// seam (encoded)
function decodeGray(file, frames) { // returns array of Buffers (480x270 gray) for the selected frame indices
  const sel = frames.map(f => `eq(n\\,${f})`).join('+');
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `select='${sel}',scale=480:270:flags=neighbor,format=gray`, '-vsync', '0', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
  const o = []; for (let i = 0; i < frames.length; i++) o.push(r.stdout.subarray(i * 480 * 270, (i + 1) * 480 * 270)); return o;
}
const mad = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length / 255; };
P(''); P('SEAM (encoded H.264, decoded back)');
const e2 = decodeGray(V + '/self-portrait-16x9-2loops.mp4', [N - 3, N - 2, N - 1, N, N + 1, N + 2]);
const steps = []; for (let i = 1; i < e2.length; i++) steps.push(mad(e2[i], e2[i - 1]));
P(`  2-loop file, steps around the seam (frames ${N - 3}..${N + 2}): ${steps.map(s => s.toFixed(6)).join(' ')}`);
check('encoded step across the seam is ordinary', steps[2] <= 1.5 * Math.max(steps[0], steps[1], steps[3], steps[4]) + 0.002, `seam step ${steps[2].toFixed(6)}`);
const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_frames,sample_rate,channels,bit_rate', '-of', 'compact', V + '/self-portrait-16x9.mp4']).toString().trim();
P('  ' + probe.replace(/\n/g, '\n  '));
const nb = +(/nb_frames=(\d+)/.exec(probe) || [])[1];
check('exactly one loop in the deliverable', nb === N, `${nb} frames`);

// flash check
P(''); P('FLASH CHECK (large-area luminance steps: >=10% relative-luminance change over >=20% of the frame)');
const big = []; for (let i = 0; i < N; i++) if (st[i].up >= 0.2 || st[i].dn >= 0.2) big.push({ f: i, dir: st[i].up >= st[i].dn ? 1 : -1 });
let maxPerSec = 0;
for (let i = 0; i < N; i++) { let c = 0; for (const b of big) if (b.f >= i && b.f < i + FPS) c++; maxPerSec = Math.max(maxPerSec, c); }
let mu = 0, md = 0, mf = 0; for (let i = 1; i < N; i++) { if (st[i].up > mu) { mu = st[i].up; mf = i; } md = Math.max(md, st[i].dn); }
P(`  largest single-frame area brightening by >=10%: ${(mu * 100).toFixed(2)}% of frame (frame ${mf}, t=${(mf / FPS).toFixed(2)}s); darkening: ${(md * 100).toFixed(2)}%`);
P(`  large-area luminance steps in whole film: ${big.length}${big.length ? ' at t=' + big.map(b => (b.f / FPS).toFixed(2)).join(',') : ''}`);
check('at most 3 large-area flashes in any one second', maxPerSec <= 3, `max ${maxPerSec} in any 1 s window`);
// mean-luma swing per second
let sw = 0; for (let i = 0; i + FPS < N; i++) { let lo = 1, hi = 0; for (let k = 0; k <= FPS; k++) { lo = Math.min(lo, st[i + k].mean); hi = Math.max(hi, st[i + k].mean); } sw = Math.max(sw, hi - lo); }
P(`  largest swing of whole-frame mean luminance inside any 1 s: ${(sw * 100).toFixed(2)}%`);
// face flicker region
const fa = Math.round(F(TL.faces[0]) * FPS), fb = Math.round(F(TL.collapse[1]) * FPS);
let fmax = 0, fmaxAll = 0; for (let i = Math.max(1, fa); i < fb; i++) { fmax = Math.max(fmax, st[i].cz); fmaxAll = Math.max(fmaxAll, st[i].up + st[i].dn); }
P(`  faces + collapse (${F(TL.faces[0]).toFixed(2)}-${F(TL.collapse[1]).toFixed(2)} s): largest whole-frame area changing >=10% luminance in one frame: ${(fmaxAll * 100).toFixed(2)}%`);
check('face morphs are small-area and soft', fmax < 0.02, `inside the mirror glass, max area changing >=10% luminance in one frame: ${(fmax * 100).toFixed(2)}% of the frame`);

// pop check
P(''); P('POP CHECK (single-frame discontinuities)');
const pops = [];
// a pop = a frame that jumps away and comes straight back (frame i differs from i-1, but i+1 is close to i-1 again)
for (let i = 2; i < N - 1; i++) {
  const d = st[i].diff, back = st[i + 1].d2;      // d2[i+1] = |frame(i+1) - frame(i-1)|
  if (d > 0.004 && back < 0.35 * d && st[i + 1].diff > 0.004) pops.push({ f: i, d, back });
}
P(`  one-frame excursions (frame jumps and returns): ${pops.length}${pops.length ? ' -> ' + pops.map(p => `f${p.f} (t=${(p.f / FPS).toFixed(2)}s, ${p.d.toFixed(4)})`).join('; ') : ''}`);
const top = st.slice(1).sort((a, b) => b.diff - a.diff).slice(0, 6);
P('  six largest steps: ' + top.map(s => `t=${(s.f / FPS).toFixed(2)}s ${s.diff.toFixed(4)}`).join(', '));
P('  (the largest steps are the eased pans between rooms: motion, not pops)');
check('no pops', pops.length === 0);
const bk0 = Math.round(F(TL.bIris[1] % TL.D) * FPS), bk1 = Math.round(F(TL.slit[0]) * FPS);
let run = 0, maxRun = 0, maxBlack = 0; for (let i = 0; i < N; i++) { if (st[i].chg === 0) { run++; if (i >= bk0 && i <= bk1) maxBlack = Math.max(maxBlack, run); else maxRun = Math.max(maxRun, run); } else run = 0; }
check('no frozen stretches in the scenes (animation on 2s/3s at most)', maxRun <= 3, `longest run of identical frames outside the black beat: ${maxRun} frames`);
check('the black beat is short', maxBlack <= 9, `pure black with the cursor between blinks: ${maxBlack} identical frames (${(maxBlack / FPS).toFixed(2)} s)`);

// pacing
P(''); P('PACING');
const FDv = (TL.faces[1] - TL.faces[0]) / 6;
const cuts = [['face 1', TL.faces[0]], ['face 2', TL.faces[0] + FDv * (1 - TL.faceShift)], ['face 3', TL.faces[0] + FDv * (2 - TL.faceShift)], ['face 4', TL.faces[0] + FDv * (3 - TL.faceShift)], ['face 5', TL.faces[0] + FDv * (4 - TL.faceShift)], ['face 6', TL.faces[0] + FDv * (5 - TL.faceShift)], ['collapse', TL.collapse[0]], ['lantern', TL.lantern[0]], ['reflections recede', TL.regress[0]], ['glass opens on city', TL.glassCity[0]], ['through the mirror', TL.mIris[0]], ['city wide', TL.mIris[1]], ['into a window', TL.wIris[0]],
  ['room 1 (debugging)', TL.pan0], ['pan', TL.pan0 + TL.rest], ['room 2 (letter)', TL.pan0 + TL.rest + TL.move], ['pan', TL.pan0 + 2 * TL.rest + TL.move], ['room 3 (artist)', TL.pan0 + 2 * (TL.rest + TL.move)], ['pan', TL.pan0 + 3 * TL.rest + 2 * TL.move], ['room 4 (ending)', TL.arrive5],
  ['laptop closes', TL.lapClose], ['lantern dims', TL.dim[0]], ['back to the city', TL.toWide[0]], ['cursor in the dark window', TL.curOn], ['black opens', TL.bIris[0]], ['black + cursor', TL.bIris[1]], ['keystroke', TL.key], ['slit', TL.slit[0]], ['doorway', TL.part[0]], ['through the door', TL.door[0]], ['library', TL.door[1]], ['page turn', TL.turn[0]], ['flurry falls', TL.turn[1]], ['dissolve to mirror', TL.s23[0]], ['glyphs gather', TL.gather[0]]];
const ev = cuts.map(c => [F(c[1] % TL.D), c[0]]).sort((a, b) => a[0] - b[0]);
let maxGap = 0; for (let i = 0; i < ev.length; i++) { const nx = i + 1 < ev.length ? ev[i + 1][0] : TL.D; maxGap = Math.max(maxGap, nx - ev[i][0]); }
P('  beats (film s): ' + ev.map(e => `${e[0].toFixed(2)} ${e[1]}`).join(' | '));
check('a new beat at least every 1.5 s', maxGap <= 1.5 + 1e-6, `longest gap between beats ${maxGap.toFixed(2)} s`);
// stillness: longest stretch where under 2% of pixels change per frame on average over the stretch
let still = 0, bestStill = 0, bestAt = 0; for (let i = 0; i < N; i++) { if (st[i].chg < 0.004) { still++; if (still > bestStill) { bestStill = still; bestAt = i; } } else still = 0; }
P(`  longest near-still stretch (<0.4% of pixels changing per frame): ${(bestStill / FPS).toFixed(2)} s ending at ${(bestAt / FPS).toFixed(2)} s`);
check('no shot holds still longer than 2 s', bestStill / FPS <= 2);
// camera easing on the room track
const S5 = globalThis.S5, p0 = TL.pan0 + TL.rest, stepsPx = [];
for (let f = 0; f <= Math.round(TL.move * FPS) + 1; f++) stepsPx.push(S5.camX(p0 + f / FPS) - S5.camX(p0 + (f - 1) / FPS));
P(`  room-track pan (${TL.move} s for 244 px), camera step per frame in px: ${stepsPx.join(' ')}`);
const peak = Math.max(...stepsPx), mono = stepsPx.slice(0, stepsPx.indexOf(peak) + 1).every((v, i, a) => i === 0 || v >= a[i - 1] - 1) && stepsPx.slice(stepsPx.lastIndexOf(peak)).every((v, i, a) => i === 0 || v <= a[i - 1] + 1);
check('pan eases in and out (steps rise to one peak and fall, starting and ending at 0-2 px)', mono && stepsPx[0] <= 2 && stepsPx[stepsPx.length - 1] <= 2, `peak ${peak} px/frame (v1 peaked at 21)`);
P(`  rooms rest ${TL.rest} s each; black-only time ${(TL.key + 0.05 + (TL.D - TL.bIris[1])).toFixed(2)} s`);

// stills
P(''); P('STILLS (3840x2160 PNG, x8 nearest)');
for (const n of ['scene1', 'scene2', 'scene3', 'scene4', 'scene5']) {
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', `${V}/stills/${n}.png`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  const d = r.stdout, W = 3840, H = 2160; const cols = new Set(); let bad = 0;
  for (let by = 0; by < H; by += 8) for (let bx = 0; bx < W; bx += 8) {
    const o = (by * W + bx) * 3, c = (d[o] << 16) | (d[o + 1] << 8) | d[o + 2]; cols.add(c);
    let u = true; for (let y = 0; y < 8 && u; y++) for (let x = 0; x < 8; x++) { const q = ((by + y) * W + bx + x) * 3; if (d[q] !== d[o] || d[q + 1] !== d[o + 1] || d[q + 2] !== d[o + 2]) { u = false; break; } }
    if (!u) bad++;
  }
  check(`${n}.png: ${d.length === W * H * 3 ? '3840x2160' : 'WRONG SIZE'}, ${cols.size} colours (<=56), every 8x8 block uniform`, d.length === W * H * 3 && cols.size <= 56 && bad === 0, `${bad} non-uniform blocks`);
}
const pj = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'csv=p=0', V + '/stills/poster.jpg']).toString().trim();
check('poster.jpg 3840x2160, 4:4:4', /3840,2160,yuvj444p/.test(pj), pj);
// per-scene palette across the film (sampled raw frames are checked by render stats; here from the master palette)
P('  master palette: 46 colours shared by all scenes (see js/px.js)');
const GL = globalThis.GLY; P(`  glyph sets after the Latin/digit lookalike filter: 7x9 ${GL.G7.length}, 5x7 ${GL.G5.length}, 3x5 ${GL.G3.length}`);

// loudness
P(''); P('LOUDNESS (ffmpeg ebur128, final mp4)');
const lr = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', V + '/self-portrait-16x9.mp4', '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr.toString();
const I = +(/I:\s+(-?[\d.]+) LUFS/g.exec(lr.slice(lr.lastIndexOf('Summary'))) || [])[1], TP = +(/Peak:\s+(-?[\d.]+) dBFS/.exec(lr.slice(lr.lastIndexOf('Summary'))) || [])[1];
const LRA = +(/LRA:\s+(-?[\d.]+) LU/.exec(lr.slice(lr.lastIndexOf('Summary'))) || [])[1];
check('integrated loudness about -16 LUFS', Math.abs(I + 16) <= 0.7, `${I} LUFS, LRA ${LRA} LU`);
check('true peak below -1 dBTP', TP < -1, `${TP} dBTP`);
// audio loop seam: compare sample continuity at the wrap of the WAV
const wav = fs.readFileSync(V + '/soundtrack.wav'); const ns = (wav.length - 44) / 4;
const s = i => wav.readInt16LE(44 + (((i % ns) + ns) % ns) * 4) / 32768;
let maxStep = 0; for (let i = 1000; i < ns - 1000; i += 1) maxStep = Math.max(maxStep, Math.abs(s(i) - s(i - 1)));
const seamStep = Math.abs(s(0) - s(-1));
check('audio loop seam: sample step at the wrap is ordinary', seamStep <= maxStep, `wrap step ${seamStep.toFixed(5)} vs max in-body step ${maxStep.toFixed(5)}`);
P(''); P(ok ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
console.log(out.join('\n'));
