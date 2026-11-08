// Count distinct palette colours used per shot (every 3rd frame).
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');const ctx={console,Math,Uint8Array,Float32Array,Map,Array,Object,Number,JSON};vm.createContext(ctx);
const files=JSON.parse(fs.readFileSync(path.join(root,'js','files.json'),'utf8'));
let src=files.map(f=>fs.readFileSync(path.join(root,'js',f),'utf8')).join('\n;\n');src+='\n;globalThis.__api={renderAt,FB,PALHEX};';vm.runInContext(src,ctx);const api=ctx.__api;
for (const [n,a,b] of [['6a',30.1,38.99],['6b',39.0,47.19],['6c',47.2,60.29]]) {
  const used=new Set();
  for(let i=Math.round((a-30.1)*30);i<=Math.round((b-30.1)*30);i+=3){api.renderAt(30.1+i/30);for(const c of api.FB)used.add(c);}
  const all=[...Array(api.PALHEX.length).keys()].filter(i=>!used.has(i)).map(i=>api.PALHEX[i]);
  console.log(n,'colours used:',used.size,'unused:',all.join(' '));
}
