// Dump 6c ship sprites at several attitudes to a zoomed sheet
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const root=path.join(__dirname,'..');const ctx={console,Math,Uint8Array,Float32Array,Map,Array,Object,Number,JSON};vm.createContext(ctx);
const files=JSON.parse(fs.readFileSync(path.join(root,'js','files.json'),'utf8'));
let src=files.map(f=>fs.readFileSync(path.join(root,'js',f),'utf8')).join('\n;\n');
src+='\n;globalThis.__api={SHOT6C,PAL,FB,W,H,renderAt};';vm.runInContext(src,ctx);const api=ctx.__api;
const angles=JSON.parse(process.argv[3]||'[-2,0,15,30,45,60,75,90,95,101]');
const cell=24, Z=10, SW=cell*angles.length, SH=cell;
const buf=Buffer.alloc(SW*SH*3);
for(let i=0;i<SW*SH;i++){buf[i*3]=200;buf[i*3+1]=215;buf[i*3+2]=230;}
angles.forEach((a,k)=>{const s=api.SHOT6C.sprite(a);for(let j=0;j<s.h;j++)for(let i=0;i<s.w;i++){const c=s.data[j*s.w+i];if(c===255)continue;const x=k*cell+12-Math.round(s.ox)+i,y=12-Math.round(s.oy)+j;if(x<0||y<0||x>=SW||y>=SH)continue;const p=api.PAL[c];buf.set(p,(y*SW+x)*3);}});
cp.execFileSync('ffmpeg',['-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',`${SW}x${SH}`,'-i','-','-vf',`scale=${SW*Z}:${SH*Z}:flags=neighbor`,process.argv[2]],{input:buf});
