// node idx.js t x0 y0 x1 y1 -> prints palette indices as hex chars
const { chromium } = require('playwright'); const path=require('path');
(async()=>{const [t,x0,y0,x1,y1]=process.argv.slice(2).map(Number);const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+path.resolve(__dirname,'../index.html')+'?export');
const o=await p.evaluate(([t,nb])=>{window.__piece.DBG.noBeam=nb;return window.__piece.frameIdx(t)},[t,!!process.env.NOBEAM]);
for(let y=y0;y<y1;y++){let r='';for(let x=x0;x<x1;x++)r+=o[y*216+x].toString(16);console.log(String(y).padStart(3)+' '+r);}
await b.close();})();
