// nsnap.js — fast node-only preview (no browser): node nsnap.js out_prefix t1 t2 ... -> writes raw RGBA, converted by caller
global.PX = require('./px.js'); const A = require('./act1.js'); const fs = require('fs');
const [out, ...ts] = process.argv.slice(2); A.init();
for (const t of ts) { A.render(+t); fs.writeFileSync(`${out}_${(+t).toFixed(2)}.rgba`, Buffer.from(PX.screen.d.buffer)); }
