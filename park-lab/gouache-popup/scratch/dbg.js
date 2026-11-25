const { chromium } = require('playwright'); const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1080}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+path.resolve(process.argv[2]));await p.waitForFunction(()=>window.READY===true);
console.log(await p.evaluate(process.argv[3]));await b.close();})();
