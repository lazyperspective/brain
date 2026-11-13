// debug: dump what the eye "wants" for sky + cloud, before any drawing
const fs=require('fs'),path=require('path'),zlib=require('zlib');
require('../js/engine.js'); require('../js/scene.js'); const A=globalThis.ART;
const {skyAll,GW,GH}=A._plan(); const W=GW,H=500; const rgb=new Uint8Array(W*H*3);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=skyAll(x,y);for(let k=0;k<3;k++)rgb[(y*W+x)*3+k]=Math.max(0,Math.min(255,c[k]*255));}
const raw=Buffer.alloc((W*3+1)*H); for(let y=0;y<H;y++){ raw[(W*3+1)*y]=0; Buffer.from(rgb.buffer,y*W*3,W*3).copy(raw,(W*3+1)*y+1);} 
const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(zlib.crc32(td)>>>0);return Buffer.concat([l,td,c]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=2;
fs.writeFileSync(path.resolve(__dirname,'../../every-light-green-output/work/plan.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));
