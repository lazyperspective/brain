const { chromium } = require('playwright'); const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+path.resolve(__dirname,'../index.html')+'?export');
for (const t of process.argv.slice(2)){
const [I,G]=await p.evaluate(t=>window.__piece.debugI(t),parseFloat(t));
const W=216;
for (const [nm,A] of [['beam',I],['glow',G]]){ console.log(nm,'t',t);
for (const y of [30,50,60,64,66,68,72,80,100]){ let r=[]; for(const x of [0,30,60,90,110,125,132,140,148,155,170,190,215]) r.push(A[y*W+x].toFixed(2).padStart(5)); console.log(String(y).padStart(3)+': '+r.join(' '));}}}
await b.close();})();
