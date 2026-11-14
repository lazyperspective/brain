// Renders Still Warm at 1920 twice (normal, and with the rubbing-out steps skipped) and exports geometry fields.
const fs=require('fs'),path=require('path');const SRC='/home/user/brain/still-warm';
for (const f of ['engine','world','mound','sky','earth','last','main']) require(path.join(SRC,'js',f+'.js'));
const {png}=require(path.join(SRC,'render.js'));const A=globalThis.ART,Wd=A.Wd;
const W=1920,H=1080,S=W/1600;
function run(skip){const {C,steps}=A.steps(W,H);steps.forEach(st=>{if(!skip(st[0]))st[1]();});return C.finish();}
fs.writeFileSync('base.png',png(W,H,run(()=>false)));
fs.writeFileSync('remember.png',png(W,H,run(n=>n==='rubbing it out')));
// fields (float32): mound s, gone, dawn, sky mask, hill s
const sM=new Float32Array(W*H),gone=new Float32Array(W*H),dawn=new Float32Array(W*H),sky=new Uint8Array(W*H),sH=new Float32Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x/S,v=y/S,i=y*W+x;sM[i]=v<Wd.horizon(u)?Wd.MT.sOf(u,v):9;sH[i]=v<Wd.horizon(u)?Wd.HL.sOf(u,v):9;gone[i]=sM[i]<1.1?Wd.gone(u,v):0;dawn[i]=Wd.dawn(u,v);sky[i]=Wd.inSky(u,v,2)?1:0;}
for(const [n,a] of [['sM',sM],['gone',gone],['dawn',dawn],['sky',sky],['sH',sH]]) fs.writeFileSync(n+'.bin',Buffer.from(a.buffer));
const sp=(pts)=>A.P.spline(pts,3).map(v=>v*S);
fs.writeFileSync('geo.json',JSON.stringify({S,MT:[Wd.MT.cx*S,Wd.MT.cy*S],HL:[Wd.HL.cx*S,Wd.HL.cy*S],T1:sp(Wd.THREAD),T2:sp(Wd.THREAD2),IN:Wd.IN}));
console.log('ok');
