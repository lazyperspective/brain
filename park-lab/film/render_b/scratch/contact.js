const { chromium } = require('playwright'); const fs=require('fs'); const {execSync}=require('child_process');
(async()=>{ const srv = await require('../serve.js').start(); const port=srv.address().port;
const browser = await chromium.launch(); const page = await browser.newPage({viewport:{width:1920,height:1080}});
await page.goto(`http://127.0.0.1:${port}/rb/scratch/perf.html`); await page.waitForFunction(()=>window.ready||window.err,null,{timeout:300000});
const jobs = JSON.parse(process.argv[2]);
for (const [id,ts] of jobs) { const files=[]; for (const t of ts) { const r = await page.evaluate(([id,t])=>window.go(id,t),[id,t]); const f=`scratch/c_${id.slice(0,2)}_${t}.jpg`; fs.writeFileSync(f, Buffer.from(r.url.split(',')[1],'base64')); files.push(f);} 
 execSync(`ffmpeg -y -loglevel error ${files.map(f=>'-i '+f).join(' ')} -filter_complex "${files.map((f,i)=>`[${i}]scale=640:360[s${i}]`).join(';')};${files.map((f,i)=>`[s${i}]`).join('')}xstack=inputs=${files.length}:layout=${files.map((f,i)=>`${(i%3)*640}_${Math.floor(i/3)*360}`).join('|')}" scratch/contact_${id.slice(0,2)}.jpg`); files.forEach(f=>fs.unlinkSync(f)); }
await browser.close(); srv.close(); })();
