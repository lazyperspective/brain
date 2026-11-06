// Choreography check (Node, no browser): the constraints the story relies on, sampled over one loop at 120 Hz.
//   node choreocheck.js
//  - build in time: every block lands before Claude's foot starts its swing toward it (>= 0.25 s margin), except the
//    deliberate just-in-time block, which must land after that swing starts (the foot is over thin air) and no later
//    than the frame the foot comes down on it
//  - one at a time: a block's materialisation never overlaps the previous block's (one clear focal build)
//  - nobody stands on air: every planted foot (Claude, the three humans, the helper) is on a block that has landed and
//    has not started to crumble
//  - crumbling: the crumble front never moves back and stays behind every human
//  - periodicity: over one loop Claude, every human, the build front, the crumble front and the camera rise exactly
//    one module (12 blocks, 5.04 m); the antenna glow returns to its start value
const fs = require('fs'), path = require('path');
global.window = {};
for (const f of ['core.js', 'stairs.js', 'choreo.js']) eval(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'));
const S = window.STAIR, U = S.U, ST = S.stairs, CH = S.choreo, C = CH.C, D = S.D, N = ST.N, HS = S.HS;
const FPS = 30, dtF = 1 / FPS;
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
let bad = 0;
const fail = (s) => { bad++; log('FAIL ' + s); };
log(`staircase: switchback module of N=${N} blocks (2 flights of ${ST.NF} + 4 corner steps), rise h=${ST.h} m, module rise H=${ST.H.toFixed(3)} m, path per module L=${ST.L.toFixed(3)} m`);

// ---- build in time
log('build timing (t = landing; swing = when the foot starts toward that block; contact = when it lands on it):');
let minMargin = Infinity, jitInfo = null;
for (let J = CH.J0 + 3; J < CH.J0 + 3 + N; J++) {
  const tl = CH.landTime(J), tSw = CH.timeAtU(CH.swingStartU(J)), tCo = CH.timeAtU(CH.contactU(J));
  const jit = CH.isJit(J);
  const margin = tSw - tl;
  if (!jit) { minMargin = Math.min(minMargin, margin); if (margin < 0.25) fail(`block ${J} lands ${tl.toFixed(3)} s, only ${margin.toFixed(3)} s before the swing`); }
  else {
    jitInfo = { J, tl, tSw, tCo };
    if (tl > tCo + 1e-6) fail(`just-in-time block ${J} lands ${tl.toFixed(3)} after contact ${tCo.toFixed(3)}`);
    if (tl < tSw) fail(`just-in-time block ${J} is not just in time (lands before the swing starts)`);
  }
  log(`  block ${String(J).padStart(2)} (${ST.stepRec(J).corner ? 'corner' : 'step  '})  lands ${U.wrap(tl, D).toFixed(2).padStart(5)}  swing ${U.wrap(tSw, D).toFixed(2).padStart(5)}  contact ${U.wrap(tCo, D).toFixed(2).padStart(5)}  ${jit ? 'JUST IN TIME: lands ' + ((tCo - tl) * 1000).toFixed(1) + ' ms before contact, ' + (tl - tSw).toFixed(2) + ' s after the foot left' : 'margin ' + margin.toFixed(2) + ' s'}`);
}
log(`min build margin (ordinary blocks): ${minMargin.toFixed(3)} s;  just-in-time block ${jitInfo.J}: lands at ${jitInfo.tl.toFixed(3)} s, foot contact at ${jitInfo.tCo.toFixed(3)} s (frame ${Math.round(jitInfo.tCo * FPS)}), the foot left ${(jitInfo.tl - jitInfo.tSw).toFixed(2)} s earlier`);
for (let J = CH.J0 + 3; J < CH.J0 + 3 + N; J++) {
  const gap = CH.landTime(J + 1) - CH.buildDur(J + 1) - CH.landTime(J);
  if (gap < 0) fail(`block ${J + 1} starts forming before block ${J} has landed (${gap.toFixed(2)} s)`);
}

// ---- nobody stands on air (sampled at 120 Hz)
const stat = {};
const upd = (k, v, t) => { const s = stat[k] || (stat[k] = { min: Infinity, max: -Infinity, tmin: 0, tmax: 0 }); if (v < s.min) { s.min = v; s.tmin = t; } if (v > s.max) { s.max = v; s.tmax = t; } };
const solid = (J, t) => CH.solidAt(J, t);
const gaitFeet = (u) => { const m = u + 0.5, k = Math.floor(m), ph = m - k; return { planted: k, swingTo: k + 1, q: U.smooth(0.12, 0.88, ph) }; };
let airCount = 0, prevCF = -Infinity;
const air = (who, J, t) => { airCount++; if (airCount < 12) log(`  on air: ${who} needs block ${J} at t=${t.toFixed(3)} (lands ${CH.landTime(J).toFixed(2)}, crumbles ${CH.crumbleTime(J).toFixed(2)})`); };
for (let i = 0; i < D * 120; i++) {
  const t = i / 120;
  // Claude: the planted foot, and the swinging foot once it has come down (q >= 1 -> it is the planted one)
  const u = CH.claudeU(t), g = gaitFeet(u);
  if (!solid(g.planted, t)) air('Claude', g.planted, t);
  upd('claudeLead', CH.builtIdx(t) - u, t);
  // humans
  for (let h = 0; h < 3; h++) {
    const s = CH.humanS(t, h), m = CH.humanMode(t, h);
    let need = [];
    if (m === 'taut' || m === 'brace') need = [ST.stepAt(s + 0.36 + 0.15), ST.stepAt(s + 0.27 + 0.15)];
    else if (m === 'sit' || m === 'fall') need = [ST.stepAt(s), ST.stepAt(s + 0.6 * HS)];
    else { const gh = gaitFeet(ST.uOfS(s)); need = [gh.planted]; if (gh.q > 0.85) need.push(gh.swingTo); }
    for (const J of need) if (!solid(J, t)) air(['researcher', 'evaluator', 'suit'][h], J, t);
    upd('humanAboveCrumble', ST.uOfS(s) - CH.crumbleFront(t), t);
  }
  // helper (building): on the newest landed block
  const inTrip = t >= C.turn && t < C.hopFwd1;
  if (!inTrip) { const B = CH.builtIdx(t); if (!solid(B, t + 0.5)) air('helper', B, t); }
  const cf = CH.crumbleFront(t);
  if (cf < prevCF - 1e-9) fail(`crumble front moved back at ${t}`);
  prevCF = cf;
  upd('builtAhead', CH.builtIdx(t) - u, t);
}
if (airCount) fail(`${airCount} samples with someone standing on air`);
for (const [k, v] of Object.entries(stat)) log(`${k.padEnd(18)} min ${v.min.toFixed(3)} @${v.tmin.toFixed(2)}  max ${v.max.toFixed(3)} @${v.tmax.toFixed(2)}`);
if (stat.humanAboveCrumble.min < 0.5) fail('a human gets within half a step of the crumble front');

// ---- periodicity: exactly one module per loop
const per = (f) => f(D - 1e-9) - f(0) + (f(D) - f(D - 1e-9));
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const cam0 = CH.camera(0), camD = CH.camera(D);
const dCam = { x: camD.pos.x - cam0.pos.x, y: camD.pos.y - cam0.pos.y, z: camD.pos.z - cam0.pos.z }, dLook = { x: camD.look.x - cam0.look.x, y: camD.look.y - cam0.look.y, z: camD.look.z - cam0.look.z };
const rows = [
  ['Claude (blocks)', CH.claudeU(D) - CH.claudeU(0), N],
  ['Claude (height m)', (CH.claudeU(D) - CH.claudeU(0)) * ST.h, ST.H],
  ['researcher (path m)', CH.humanSU(D, 0) - CH.humanSU(0, 0), ST.L],
  ['evaluator (path m)', CH.humanSU(D, 1) - CH.humanSU(0, 1), ST.L],
  ['suit (path m)', CH.humanSU(D, 2) - CH.humanSU(0, 2), ST.L],
  ['build front (blocks)', CH.builtIdx(D) - CH.builtIdx(0), N],
  ['crumble front (blocks)', CH.crumbleFront(D) - CH.crumbleFront(0), N],
  ['camera y (m)', dCam.y, ST.H], ['camera x (m)', dCam.x, 0], ['camera z (m)', dCam.z, 0],
  ['camera look y (m)', dLook.y, ST.H], ['camera look x (m)', dLook.x, 0], ['camera look z (m)', dLook.z, 0],
  ['antenna glow (t=D vs 0)', CH.upgradeGlow(D - 1e-9) - CH.upgradeGlow(0), 0],
];
log('one loop = one module:');
for (const [k, v, want] of rows) { const ok = near(v, want, 1e-5); log(`  ${k.padEnd(26)} ${v.toFixed(6).padStart(11)}  (want ${want.toFixed(6)})  ${ok ? 'ok' : 'MISMATCH'}`); if (!ok) fail(k + ' does not rise exactly one module'); }
// continuity across the wrap (positions just before D equal t=0 + one module)
const e = 1e-7;
const wrapRows = [['Claude u', CH.claudeU(D - e) + 0, CH.claudeU(0) + N], ['camera y', CH.camera(D - e).pos.y, cam0.pos.y + ST.H]];
for (let h = 0; h < 3; h++) wrapRows.push(['human ' + h + ' s', CH.humanSU(D - e, h), CH.humanSU(0, h) + ST.L]);
for (const [k, a, b] of wrapRows) if (Math.abs(a - b) > 1e-4) fail(`${k} jumps at the loop seam (${a} vs ${b})`);
log(bad === 0 ? 'PASS' : 'CHECK');
