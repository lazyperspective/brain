const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const srv = await require('../serve.js').start(); const port=srv.address().port;
const browser = await chromium.launch(); const page = await browser.newPage({viewport:{width:1920,height:1080}});
page.on('console', m=>console.log('[page]',m.text().slice(0,200)));
await page.goto(`http://127.0.0.1:${port}/rb/scratch/perf.html`); await page.waitForFunction(()=>window.ready||window.err,null,{timeout:300000});
console.log(await page.evaluate(()=>window.err||JSON.stringify(window.info)));
for (const [id,t] of [['08_pov_lift_lowpoly',29.0],['08_pov_lift_lowpoly',29.1],['04_lowpoly_blueprint',14]]) { const r = await page.evaluate(([id,t])=>window.go(id,t),[id,t]); console.log(id,t,r.render|0,r.enc|0); fs.writeFileSync(`scratch/perf_${id.slice(0,2)}_${t}.jpg`, Buffer.from(r.url.split(',')[1],'base64')); }
await browser.close(); srv.close(); })();
