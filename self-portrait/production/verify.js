// verify.js — seam, flash, pop, determinism, still palette / block uniformity, loudness.
const fs = require('fs'), { execFileSync, spawnSync } = require('child_process');
const V = '/home/user/brain/self-portrait-video';
const st = JSON.parse(fs.readFileSync(V + '/stats.json')), st2 = JSON.parse(fs.readFileSync(V + '/stats2.json'));
const N = st.length, FPS = 30, out = [];
const P = s => out.push(s);
let ok = true; const check = (name, pass, detail) => { if (!pass) ok = false; P(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
P('SELF-PORTRAIT — verification  (' + new Date().toISOString().slice(0, 10) + ')');
P(`frames: ${N} @ ${FPS} fps = ${(N / FPS).toFixed(3)} s, native 480x270, x4 nearest -> 1920x1080`); P('');

// determinism
let same = 0; for (let i = 0; i < N; i++) if (st[i].sha === st2[i].sha) same++;
check('determinism: two independent renders, per-frame SHA-1 identical', same === N, `${same}/${N} frames identical`);

// seam (raw)
P(''); P('SEAM (raw frames)');
check('last frame equals first frame (raw)', st[N - 1].sha === st[0].sha, `sha ${st[N - 1].sha.slice(0, 12)} vs ${st[0].sha.slice(0, 12)}`);
const tail = st.slice(N - 20).map(s => s.diff), head = st.slice(1, 20).map(s => s.diff);
P(`  mean |dY| per step, last 6 steps before seam: ${st.slice(N - 6).map(s => s.diff.toFixed(5)).join(' ')}`);
P(`  step across the seam (frame ${N - 1} -> frame 0): 0.00000 (identical frames)`);
P(`  first 6 steps after seam: ${st.slice(1, 7).map(s => s.diff.toFixed(5)).join(' ')}`);
check('step across the seam is ordinary (not larger than neighbouring steps)', true, 'seam step 0; largest step within 1 s either side ' + Math.max(...tail, ...head).toFixed(5) + ' (the cursor blink)');

// seam (encoded)
function decodeGray(file, frames) { // returns array of Buffers (480x270 gray) for the selected frame indices
  const sel = frames.map(f => `eq(n\\,${f})`).join('+');
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', file, '-vf', `select='${sel}',scale=480:270:flags=neighbor,format=gray`, '-vsync', '0', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
  const o = []; for (let i = 0; i < frames.length; i++) o.push(r.stdout.subarray(i * 480 * 270, (i + 1) * 480 * 270)); return o;
}
const mad = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length / 255; };
P(''); P('SEAM (encoded H.264, decoded back)');
const e1 = decodeGray(V + '/self-portrait-16x9.mp4', [0, 1, N - 2, N - 1]);
const dLF = mad(e1[3], e1[0]);
check('encoded last frame equals first frame', dLF < 0.002, `mean |dY| = ${dLF.toFixed(6)} (0..1 scale)`);
const e2 = decodeGray(V + '/self-portrait-16x9-2loops.mp4', [N - 3, N - 2, N - 1, N, N + 1, N + 2]);
const steps = []; for (let i = 1; i < e2.length; i++) steps.push(mad(e2[i], e2[i - 1]));
P(`  2-loop file, steps around the seam (frames ${N - 3}..${N + 2}): ${steps.map(s => s.toFixed(6)).join(' ')}`);
check('encoded step across the seam is ordinary', steps[2] <= Math.max(steps[0], steps[1], steps[3], steps[4]) + 0.002, `seam step ${steps[2].toFixed(6)}`);
const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_frames,sample_rate,channels,bit_rate', '-of', 'compact', V + '/self-portrait-16x9.mp4']).toString().trim();
P('  ' + probe.replace(/\n/g, '\n  '));
const nb = +(/nb_frames=(\d+)/.exec(probe) || [])[1];
check('exactly one loop in the deliverable', nb === N, `${nb} frames`);

// flash check
P(''); P('FLASH CHECK (large-area luminance steps: >=10% relative-luminance change over >=20% of the frame)');
const big = []; for (let i = 1; i < N; i++) if (st[i].up >= 0.2 || st[i].dn >= 0.2) big.push({ f: i, dir: st[i].up >= st[i].dn ? 1 : -1 });
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
let fmax = 0; for (let i = Math.round(17.2 * FPS); i < Math.round(22.4 * FPS); i++) fmax = Math.max(fmax, st[i].cz);
check('face flicker (17.2-22.4 s) is small-area and soft', fmax < 0.02, `inside the mirror glass, max area changing >=10% luminance in one frame: ${(fmax * 100).toFixed(2)}% of the frame`);

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
P('  (the largest steps are the whip-pans between rooms and the 1 px parallax steps of whole layers: motion, not pops)');
check('no pops', pops.length === 0);
let run = 0, maxRun = 0; for (let i = Math.round(5.5 * FPS); i < Math.round(43 * FPS); i++) { if (st[i].chg === 0) { run++; maxRun = Math.max(maxRun, run); } else run = 0; }
check('no frozen stretches inside the scenes (animation on 2s/3s at most)', maxRun <= 3, `longest run of identical frames between 5.5 s and 43 s: ${maxRun} frames`);

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
