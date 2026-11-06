// The picture's event list for the score (Node, no browser): every sound-making moment of one loop, read straight
// from the choreography the renderer uses (js/choreo.js), with a stereo pan from the event's screen x.
//   node events.js            -> events.json next to this file
const fs = require('fs'), path = require('path');
global.window = {};
for (const f of ['core.js', 'stairs.js', 'choreo.js']) eval(fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8'));
const S = window.STAIR, U = S.U, ST = S.stairs, CH = S.choreo, C = CH.C, D = S.D, N = ST.N;

// screen x: the camera's right vector is horizontal and perpendicular to the lap displacement (so folding never moves it)
const V = ST.VIEW, rl = Math.hypot(V.z, V.x), RX = V.z / rl, RZ = -V.x / rl;
let mn = 1e9, mx = -1e9;
for (const st of ST.steps) { const x = st.cx * RX + st.cz * RZ; mn = Math.min(mn, x); mx = Math.max(mx, x); }
const panAtS = (s) => { const p = ST.pathXZ(s, {}); return U.clamp(((p.x * RX + p.z * RZ) - (mn + mx) / 2) / ((mx - mn) / 2) * 0.85, -1, 1); };

const ev = [];
const add = (t, type, o = {}) => ev.push(Object.assign({ t: U.wrap(t, D), type }, o));
const dt = 1 / 600;
// first crossing of a monotone function f(t) over level within [t0, t1]
function crossings(f, levelOf, t0, t1, cb) {
  let prev = f(t0);
  for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) {
    const v = f(t);
    const a = Math.floor(levelOf(prev)), b = Math.floor(levelOf(v));
    if (b > a) { for (let k = a + 1; k <= b; k++) { let lo = t - dt, hi = t; for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (Math.floor(levelOf(f(m))) >= k) hi = m; else lo = m; } cb(hi, k); } }
    prev = v;
  }
}
for (const team of [0, 1]) {
  const tc = (c) => c + CH.TEAM_T0[team];                // loop time of team-cycle time c (wrapped by add)
  const sAt = (t) => CH.climberS(t, team);
  // the mini-me lays a block (it lands at phase 0.55) and the block first glows in (phase 0.02)
  crossings((t) => CH.buildIdx(t, team), (b) => b - 0.55, 0, D, (t, k) => add(t, 'lay', { team, pan: panAtS(ST.stepSc(k + 1)), step: k + 1 }));
  crossings((t) => CH.buildIdx(t, team), (b) => b - 0.02, 0, D, (t, k) => add(t, 'glowIn', { team, pan: panAtS(ST.stepSc(k + 1)) }));
  // climber footfalls (foot lands at u = j + 0.38)
  crossings((t) => ST.uOfS(sAt(t)), (u) => u - 0.38, 0, D, (t) => add(t, 'climbStep', { team, pan: panAtS(sAt(t)) }));
  // a step dissolving into blueprint ahead of this mini-me
  crossings((t) => CH.ghostFront(t, team), (q) => q, 0, D, (t) => add(t, 'dissolve', { team, pan: panAtS(ST.sOfU(CH.ghostFront(t, team) + 1)) }));
  // human feet: hops up a riser while dragged, footfalls while running
  for (const i of [0, 1]) {
    const hs = (t) => CH.humanS(t, team, i);
    crossings(hs, (s) => ST.stepAt(s + 0.36 - 0.04), 0, D, (t) => { const c = CH.cOf(t, team), m = CH.humanMode(c, i); if (m === 'taut') add(t, 'dragHop', { team, who: i, pan: panAtS(hs(t)) }); });
    crossings((t) => ST.uOfS(hs(t)), (u) => u - 0.38, 0, D, (t) => { const c = CH.cOf(t, team), m = CH.humanMode(c, i); if (m === 'run') add(t, 'runStep', { team, who: i, pan: panAtS(hs(t)) }); });
  }
  const at = (c) => { const t = tc(c); return { pan: panAtS(sAt(U.wrap(t, D))) }; };
  add(tc(C.tripStart), 'turn', Object.assign({ team }, at(C.tripStart)));
  add(tc(C.hopBack0), 'hopUp', Object.assign({ team }, at(C.hopBack0)));
  add(tc(C.hopBack1), 'hopLand', Object.assign({ team }, at(C.hopBack1)));
  add(tc(3.6), 'snipOpen', Object.assign({ team }, at(3.6)));
  add(tc(3.82), 'snipHalf', Object.assign({ team }, at(3.82)));
  add(tc(C.cut), 'snip', Object.assign({ team }, at(C.cut)));
  add(tc(C.cut), 'whip', Object.assign({ team }, at(C.cut)));
  add(tc(C.hopFwd0), 'hopUp', Object.assign({ team }, at(C.hopFwd0)));
  add(tc(C.hopFwd1), 'hopLand', Object.assign({ team }, at(C.hopFwd1)));
  add(tc(C.sit), 'fall', Object.assign({ team, who: 0 }, at(C.sit)));
  add(tc(C.sit + 0.12), 'fall', Object.assign({ team, who: 1 }, at(C.sit + 0.12)));
  add(tc(C.getup), 'getup', Object.assign({ team }, at(C.getup)));
  add(tc(C.spin), 'spin', Object.assign({ team, dur: C.throw - C.spin }, at(C.spin)));
  add(tc(C.throw), 'throw', Object.assign({ team }, at(C.throw)));
  add(tc(C.catch), 'catch', Object.assign({ team }, at(C.catch)));
  add(tc(CH.RETAUT[0]), 'taut', Object.assign({ team }, at(CH.RETAUT[0])));
}
ev.sort((a, b) => a.t - b.t);
const out = { D, n: ev.length, events: ev };
fs.writeFileSync(path.join(__dirname, 'events.json'), JSON.stringify(out, null, 1));
const count = {}; for (const e of ev) count[e.type] = (count[e.type] || 0) + 1;
console.log('events.json:', ev.length, 'events', JSON.stringify(count));
for (const e of ev) if (!['lay', 'glowIn', 'climbStep', 'dragHop', 'runStep', 'dissolve'].includes(e.type)) console.log(e.t.toFixed(2).padStart(6), e.type.padEnd(9), 'team', e.team, 'pan', e.pan.toFixed(2));
