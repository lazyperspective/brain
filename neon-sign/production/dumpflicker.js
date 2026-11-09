// Dump the sign's brightness per source at 1 kHz over one loop (for the sound track): JSON [[b0..b7], ...]
global.window = {}; require('../js/flicker.js');
const F = window.NS.FLICKER, out = [];
for (let i = 0; i < F.D * 1000; i++) out.push(Array.from(F.sources(i / 1000)).map((v) => +v.toFixed(5)));
process.stdout.write(JSON.stringify(out));
