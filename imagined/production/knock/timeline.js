// Dump the piece's own clock (window.__knockCore.EV) to music/timeline.json, so the score follows the picture.
//   node timeline.js
const fs = require('fs'), path = require('path');
global.window = { PIECES: [] };
eval(fs.readFileSync(path.join(__dirname, '../../js/pieces/03-the-knock.js'), 'utf8'));
const EV = window.__knockCore.EV;
fs.writeFileSync(path.join(__dirname, 'music/timeline.json'), JSON.stringify(EV, null, 1) + '\n');
console.log('timeline: D', EV.D, 'knocks', EV.knocks.join(' '), 'shots', EV.shots.join(' '));
