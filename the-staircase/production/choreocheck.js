// Choreography check (Node, no browser): the constraints the story relies on, sampled over one loop at 120 Hz.
//   node choreocheck.js
//  - lead: the mini-me's built front stays ahead of its climber (>= 1.3 steps: the next foot only lands on solid stone)
//  - ghost: the step being built is always blueprint before it is laid (>= 0.1 step margin); the ghost front never moves back
//  - spacing: no team's people ever stand on another team's blueprint steps
//  - pace: the mini-me never lays more than 2.8 steps a second (each block's flight stays readable)
//  - periodicity: every quantity at t = D equals t = 0 plus exactly one lap
const fs = require('fs'), path = require('path');
global.window = {};
for (const f of ['core.js', 'stairs.js', 'choreo.js']) eval(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'));
const S = window.STAIR, ST = S.stairs, CH = S.choreo, D = S.D, N = ST.N, L = ST.L;
console.log(`staircase: N=${N} steps, lap path L=${L.toFixed(3)}, LAP=(${ST.LAP.x}, ${ST.LAP.y.toFixed(2)}, ${ST.LAP.z}), view elevation ${(Math.atan2(ST.LAP.y, Math.hypot(ST.LAP.x, ST.LAP.z)) * 180 / Math.PI).toFixed(1)} deg`);
console.log(`retaut at c = ${CH.RETAUT.map((x) => x.toFixed(2)).join(', ')}`);
let bad = 0;
const stat = {};
const upd = (k, v, t) => { const s = stat[k] || (stat[k] = { min: Infinity, max: -Infinity, tmin: 0, tmax: 0 }); if (v < s.min) { s.min = v; s.tmin = t; } if (v > s.max) { s.max = v; s.tmax = t; } };
let prevG = [null, null];
for (let i = 0; i <= D * 120; i++) {
  const t = i / 120;
  for (const team of [0, 1]) {
    const sc = CH.climberS(t, team), uc = ST.uOfS(sc), B = CH.buildIdx(t, team), g = CH.ghostFront(t, team);
    const s1 = CH.humanS(t, team, 0), s2 = CH.humanS(t, team, 1);
    if (![sc, B, g, s1, s2].every(Number.isFinite)) { bad++; console.log('NaN at', t, team); }
    upd('lead' + team, B - uc, t);
    upd('ghostLen' + team, g - (Math.floor(B) + 1), t);
    upd('h1gap' + team, sc - s1, t);
    upd('h2gap' + team, s1 - s2, t);
    if (prevG[team] !== null && g < prevG[team] - 1e-6) { bad++; console.log('ghost front moved back', t, team, prevG[team], g); }
    prevG[team] = g;
    // the other team's tail vs this team's ghost front (in this team's frame)
    const other = 1 - team;
    const tailO = ST.uOfS(CH.humanS(t, other, 1) - 0.78) + (team === 0 ? N : 0);
    upd('tailClear' + team, tailO - g, t);
  }
  for (const team of [0, 1]) upd('buildRate' + team, (CH.buildIdx(t + 1 / 30, team) - CH.buildIdx(t, team)) * 30, t);
  // team separation (climbers, path units, A ahead of B by)
  upd('sep', CH.climberS(t, 0) - CH.climberS(t, 1), t);
}
for (const [k, v] of Object.entries(stat)) console.log(`${k.padEnd(11)} min ${v.min.toFixed(3)} @${v.tmin.toFixed(2)}  max ${v.max.toFixed(3)} @${v.tmax.toFixed(2)}`);
const per = (f) => f(D) - f(0);
for (const team of [0, 1]) {
  console.log(`team ${team}: climber ${per((t) => CH.climberS(t, team)).toFixed(6)} (L ${L.toFixed(6)}), build ${per((t) => CH.buildIdx(t, team)).toFixed(6)} (N ${N}), h1 ${per((t) => CH.humanS(t, team, 0)).toFixed(6)}, h2 ${per((t) => CH.humanS(t, team, 1)).toFixed(6)}, ghost ${per((t) => CH.ghostFront(t, team)).toFixed(6)}`);
}
const ok = stat.lead0.min >= 1.3 && stat.lead1.min >= 1.3 && stat.ghostLen0.min >= 0.1 && stat.ghostLen1.min >= 0.1 && stat.tailClear0.min >= 0.95 && stat.tailClear1.min >= 0.95 && stat.buildRate0.max <= 2.8 && bad === 0;
console.log(ok ? 'PASS' : 'CHECK');
