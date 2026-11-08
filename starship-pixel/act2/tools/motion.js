// Count changed native pixels between consecutive frames, report spikes per shot.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');const ctx={console,Math,Uint8Array,Float32Array,Map,Array,Object,Number,JSON};vm.createContext(ctx);
const files=JSON.parse(fs.readFileSync(path.join(root,'js','files.json'),'utf8'));
let src=files.map(f=>fs.readFileSync(path.join(root,'js',f),'utf8')).join('\n;\n');src+='\n;globalThis.__api={renderAt,FB,W,H};';vm.runInContext(src,ctx);const api=ctx.__api;
const t0=+process.argv[2], t1=+process.argv[3];
let prev=null; const out=[];
for(let i=Math.round((t0-30.1)*30);i<=Math.round((t1-30.1)*30);i++){const t=30.1+i/30;api.renderAt(t);const cur=Uint8Array.from(api.FB);if(prev){let n=0;for(let k=0;k<cur.length;k++)if(cur[k]!==prev[k])n++;out.push([t.toFixed(3),n]);}prev=cur;}
const ns=out.map(o=>o[1]);const mean=ns.reduce((a,b)=>a+b,0)/ns.length;
console.log('mean changed px',mean.toFixed(0),'max',Math.max(...ns));
out.filter(o=>o[1]>mean*2.5).slice(0,30).forEach(o=>console.log(o.join(' ')));
