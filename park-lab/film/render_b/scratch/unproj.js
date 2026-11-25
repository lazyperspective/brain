const P=require('../../plan/park.js'); const park=P.loadFileSync(__dirname+'/../../plan/park.json');
const shots=require('../../plan/shots.json'); const s=shots.shots.find(x=>x.id.startsWith('05')); const c=park.camera(s,16.0);
const V=P.vec; const f=V.norm(V.sub(c.target,c.position)); const r=V.norm(V.cross(f,[0,1,0])); const u=V.cross(r,f); const hh=c.orthoHalfHeight, hw=hh*16/9;
for (const [px,py] of JSON.parse(process.argv[2])) { const sx=(px/960-1)*hw, sy=(1-py/540)*hh; const o=V.add(V.add(c.target,V.mul(r,sx)),V.mul(u,sy)); const t=-o[1]/f[1]; const g=V.add(o,V.mul(f,t)); console.log(px,py,'->',g[0].toFixed(1),g[2].toFixed(1)); }
