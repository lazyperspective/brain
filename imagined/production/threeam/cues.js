// Dump the picture's clock for the score: node cues.js > music/cues.json
// Cue times come straight from the piece (window.__threeamCore.T), plus derived event lists (heartbeats, the
// footfalls of the tiptoe, each tread of the stairs down and up).
const fs = require('fs'), path = require('path');
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../../js/pieces/02-three-am.js'), 'utf8'));
const E = window.__threeamCore, T = E.T;
const tiptoe = [];
let last = Math.floor(E.walkX(T.stand) / (E.STRIDE / 2));
for (let t = T.stand; t < T.top + 0.2; t += 1 / 300) { const k = Math.floor(E.walkX(t) / (E.STRIDE / 2)); if (k !== last) { tiptoe.push(+t.toFixed(3)); last = k; } }
const down = [], up = [];
for (let k = 1; k <= 17; k++) down.push(+(T.desc0 + (k - 0.5) / 17 * (T.desc1 - T.desc0)).toFixed(3));
for (let k = 1; k <= 11; k++) up.push(+(T.climb + (k - 0.5) / 11 * (T.cut4 + 0.4 - T.climb)).toFixed(3));
const kitchen = []; for (let k = 0; k < 4; k++) kitchen.push(+(T.walk2 + 0.2 + k * 0.24).toFixed(3));
console.log(JSON.stringify({ D: E.D, T, beats: E.BEATS.map((b) => +b.toFixed(4)), cuts: E.CUTS, tiptoe, down, up, kitchen }, null, 1));
