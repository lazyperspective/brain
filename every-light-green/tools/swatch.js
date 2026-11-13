// media test sheet
const fs=require('fs'),path=require('path'),zlib=require('zlib');
require('../js/engine.js'); const A=globalThis.ART;
const W=parseInt(process.argv[2]||'1920'),H=Math.round(W*9/16);
const C=new A.Canvas(W,H,process.argv[3]||'#3a2a55',7);
const rng=A.rng(5), M=A.MED, hx=A.hex;
// pastel sky band, rubbed on the left half
const cols=['#1f1d66','#2c3f9e','#3f77bd','#7f8fd6','#b08ad0','#ee86a8','#ff9a78','#ffc463','#ffe59a'];
for(let k=0;k<cols.length;k++){ for(let q=0;q<26;q++){ const y=30+k*30+rng.r(-14,14), x=rng.r(20,700), L=rng.r(120,300);
  C.stroke(A.hand(rng,[x,y,x+L,y+rng.r(-10,10)],{wob:2}),M.pastel,hx(cols[k]),rng.r(22,40),rng.r(0.5,0.85)); } }
for(let y=30;y<300;y+=14){ const xy=[]; for(let x=20;x<420;x+=10) xy.push(x,y+rng.r(-4,4)); C.rub(xy,24,0.5); }
// second layer fresh strokes over rubbed
for(let k=0;k<cols.length;k++){ for(let q=0;q<10;q++){ const y=30+k*30+rng.r(-10,10), x=rng.r(20,380), L=rng.r(40,110);
  C.stroke(A.hand(rng,[x,y,x+L,y-rng.r(0,18)],{wob:1.2}),M.pastel,hx(cols[(k+ (rng()<0.4?1:0))%cols.length]),rng.r(10,18),rng.r(0.45,0.7)); } }
// oil pastel dabs
['#fffbe0','#ffd05e','#3fe6ae','#ff6a8a','#ffffff'].forEach((c,i)=>{ for(let q=0;q<8;q++){ const x=760+i*70+rng.r(-8,8), y=40+q*30;
  C.stroke(A.hand(rng,[x,y,x+rng.r(20,45),y+rng.r(-6,6)],{wob:0.6}),M.oil,hx(c),rng.r(6,14),rng.r(0.7,1.0)); } });
// pencil hatching
A.hatch(C,rng,[1150,30,1500,40,1520,250,1140,260],{ang:-0.8,gap:3.2,med:M.pencil,col:hx('#9c84d2'),w:1.5,p:0.7});
A.hatch(C,rng,[1150,30,1500,40,1520,250,1140,260],{ang:0.5,gap:4.5,med:M.pencil,col:hx('#f283ae'),w:1.3,p:0.6});
A.hatch(C,rng,[1200,300,1560,300,1560,480,1200,480],{ang:-0.6,gap:2.2,med:M.pencil,col:hx('#fdd05e'),w:1.6,p:0.9});
// conte block-in
A.hatch(C,rng,[40,340,500,340,500,520,40,520],{ang:-0.5,gap:7,med:M.conte,col:hx('#151238'),w:9,p:0.8,wob:1.2});
A.hatch(C,rng,[540,340,1000,340,1000,520,540,520],{ang:-0.5,gap:9,med:M.pastel,col:hx('#3cb5b0'),w:16,p:0.6,wob:1.5});
// lines
for(let i=0;i<8;i++) A.line(C,rng,[60,560+i*18,900,560+i*18+rng.r(-3,3)],M.pencil,hx(['#fff4c6','#151238','#98b4ea','#f47a52'][i%4]),1.2+i*0.25,0.5+i*0.07,{reps:i%2+1});
for(let i=0;i<40;i++) A.dot(C,rng,rng.r(950,1550),rng.r(540,860),M.oil,hx(rng.pick(['#fffbe0','#ffd05e','#ff9d6c'])),rng.r(3,9),1);
for(let i=0;i<12;i++){ const cx=rng.r(100,800),cy=rng.r(720,860); const xy=[]; for(let a=0;a<6.3;a+=0.3) xy.push(cx+Math.cos(a)*30,cy+Math.sin(a)*18); C.stroke(A.hand(rng,A.curve(xy,4)),M.pastelTip,hx(rng.pick(['#f9abc4','#98b4ea','#bfaee6'])),rng.r(4,9),0.7); }
const rgb=C.finish();
const raw=Buffer.alloc((W*3+1)*H); for(let y=0;y<H;y++){ raw[(W*3+1)*y]=0; Buffer.from(rgb.buffer,y*W*3,W*3).copy(raw,(W*3+1)*y+1);} 
const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(zlib.crc32(td)>>>0);return Buffer.concat([l,td,c]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=2;
const out=path.resolve(__dirname,'../../every-light-green-output/work'); fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'swatch.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));
console.log('ok',C.count);
