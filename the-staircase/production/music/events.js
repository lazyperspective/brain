// The picture's event list for the score (Node, no browser): every sound-making moment of one loop, read straight
// from the choreography the renderer uses (js/choreo.js), with a stereo pan from the event's screen x.
//   node events.js            -> events.json next to this file
const fs = require('fs'), path = require('path');
global.window = {};
for (const f of ['core.js', 'stairs.js', 'choreo.js']) eval(fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8'));
const S = window.STAIR, U = S.U, ST = S.stairs, CH = S.choreo, C = CH.C, D = S.D, N = ST.N;

// screen x of a world point at time t (the camera looks down -z with a fixed orientation)
function panAt(p, t) {
  const c = CH.camera(t), th = Math.tan(c.fov * Math.PI / 360) * (S.W / S.H);
  const dx = p.x - c.pos.x, dz = c.pos.z - p.z;
  return U.clamp((dx / Math.max(1, dz)) / th * 0.9, -1, 1);
}
const panS = (s, t) => panAt(ST.pathXZ(s, {}), t);
const panJ = (J, t) => panAt(ST.blockTop(J, {}), t);
const panClaude = (t) => panS(CH.claudeS(t), t);

const ev = [];
const add = (t, type, o = {}) => ev.push(Object.assign({ t: U.wrap(t, D), type }, o));
const dt = 1 / 600;
// every crossing of an integer level by levelOf(f(t)) within [t0, t1] (f monotone)
function crossings(f, levelOf, t0, t1, cb) {
  let prev = f(t0);
  for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) {
    const v = f(t);
    const a = Math.floor(levelOf(prev)), b = Math.floor(levelOf(v));
    if (b > a) { for (let k = a + 1; k <= b; k++) { let lo = t - dt, hi = t; for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (Math.floor(levelOf(f(m))) >= k) hi = m; else lo = m; } cb(hi, k); } }
    prev = v;
  }
}

// ---- the build: every block of one loop
for (let J = CH.J0 + 3; J < CH.J0 + 3 + N; J++) {
  const tl = CH.landTime(J), dur = CH.buildDur(J), jit = CH.isJit(J);
  add(tl - dur, 'form', { pan: panJ(J, tl), dur, jit, step: J });
  add(tl, jit ? 'jitSlam' : 'slam', { pan: panJ(J, tl), step: J });
  // the helper hops onto the new block
  if (!(tl > C.turn - 0.5 && tl < C.hopFwd1)) add(tl + 0.08, 'miniHop', { pan: panJ(J, tl) });
  // the block below crumbles away later
  const tc = CH.crumbleTime(J);
  add(tc, 'crack', { pan: panJ(J, tc), step: J });
  add(tc + CH.CRACK, 'crumble', { pan: panJ(J, tc), step: J });
}
// ---- footsteps: Claude (a foot lands at u = k - 0.62), humans dragged up a riser, humans running
crossings(CH.claudeU, (u) => u + 0.62, 0, D, (t, k) => { if (Math.abs(t - C.jit) > 0.02) add(t, 'climbStep', { pan: panClaude(t), heavy: t > C.surge && t < C.surge + 1.5 }); });
for (const i of [0, 1, 2]) {
  const hs = (t) => CH.humanS(t, i);
  crossings((t) => CH.humanSU(t, i), (s) => ST.stepAt(s + 0.36 - 0.04), 0, D - 1e-6, (t) => { if (CH.humanMode(t, i) === 'taut') add(t, 'dragHop', { who: i, pan: panS(hs(t), t) }); });
  crossings((t) => ST.uOfS(CH.humanSU(t, i)), (u) => u + 0.62, 0, D - 1e-6, (t) => { if (CH.humanMode(t, i) === 'run') add(t, 'runStep', { who: i, pan: panS(hs(t), t) }); });
}
// ---- rope creaks while it is taut (a creak per dragged step of the lead human)
crossings((t) => CH.humanSU(t, 0), (s) => ST.stepAt(s + 0.36 - 0.04) , 0, D - 1e-6, (t) => { if (CH.humanMode(t, 0) === 'taut') add(t + 0.05, 'creak', { pan: panS(CH.humanS(t, 0), t) }); });

// ---- story beats
const at = (t, type, o = {}) => add(t, type, Object.assign({ pan: panClaude(t) }, o));
at(C.turn, 'turn');
at(C.hopBack0, 'hopUp'); at(C.hopBack1, 'hopLand');
at(C.snip1, 'snipOpen'); at(C.snip2, 'snipHalf');
at(C.cut, 'snip'); at(C.cut, 'whip');
for (const i of [0, 1, 2]) add(C.sit + CH.LAG[i], 'fall', { who: i, pan: panS(CH.humanS(C.sit + CH.LAG[i], i), C.sit) });
at(C.hopUp0, 'hopUp'); at(C.hopUp1, 'hopLand');
at(C.pop, 'pop'); at(C.show, 'show'); at(C.insert, 'insert');
at(C.crank1, 'crank'); at(C.crank2, 'crank');
at(C.glowUp, 'upgrade');
at(C.hopFwd0, 'hopUp'); at(C.hopFwd1, 'hopLand');
at(C.surge, 'surge');
for (const i of [0, 1, 2]) add(C.getup + CH.LAG[i], 'getup', { who: i, pan: panS(CH.humanS(C.getup, i), C.getup) });
at(C.fizzle, 'fizzle', { dur: CH.landTime(CH.JIT_J) - CH.buildDur(CH.JIT_J) - C.fizzle });
add(C.spin, 'spin', { dur: C.throw - C.spin, pan: panS(CH.humanS(C.spin, 0), C.spin) });
add(C.throw, 'throw', { pan: panS(CH.humanS(C.throw, 0), C.throw) });
at(C.catch, 'catch');
for (const i of [0, 1, 2]) at(CH.RETAUT[i], 'taut', { who: i });
ev.sort((a, b) => a.t - b.t);
const out = { D, n: ev.length, events: ev };
fs.writeFileSync(path.join(__dirname, 'events.json'), JSON.stringify(out, null, 1));
const count = {}; for (const e of ev) count[e.type] = (count[e.type] || 0) + 1;
console.log('events.json:', ev.length, 'events', JSON.stringify(count));
for (const e of ev) if (!['climbStep', 'dragHop', 'runStep', 'creak', 'crack', 'crumble', 'miniHop'].includes(e.type)) console.log(e.t.toFixed(2).padStart(6), e.type.padEnd(9), 'pan', e.pan.toFixed(2));
