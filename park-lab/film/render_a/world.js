// Detailed park scene for render agent A (gouache + pixel styles).
// Uses greybox.js for terrain/paving/tracks/flat-ride skeletons, then replaces the primitive parts
// (buildings, guests, trees, props, trains, boats, the wooden coaster) with detailed instanced models.
import * as THREE from 'three';
import { buildGreybox, CATEGORY_COLORS } from '/plan/greybox.js';
import { makeMats } from './mats.js';
import { buildPeople } from './people.js';
import { buildArchitecture } from './arch.js';
import { buildNature } from './nature.js';
import { buildRides } from './rides.js';

import { hex, T, beamM, rng, GEO, Kit, frame, MG } from './util.js';
export { hex, T, beamM, rng, GEO, Kit, frame };

export function buildWorld(park, shot, style, opts = {}) {
  const D = park.data;
  const MS = makeMats(THREE, style);
  const { mat } = MS; const pixel = style === 'pixel';
  const root = new THREE.Group();
  const ctx = Object.assign({ THREE, park, D, shot, style, pixel, MS, mat, root, animators: [], bulbs: [], balloons: [], extraPeople: [], flags: [] }, opts.ctx || {});

  // ---------------------------------------------------------------- greybox base with style materials
  const PAVE = {
    brick_herringbone: `{ vec2 q = p.xz/vec2(0.21,0.21); vec2 g = floor(q); float r = mod(g.x+g.y,2.); vec2 f = fract(q);
      float a = r<.5 ? f.x : f.y; float b = r<.5 ? fract((q.y+g.x)*.5) : fract((q.x+g.y)*.5);
      float jt = min(min(a,1.-a), min(b,1.-b)); float fw = fwidth(q.x)*1.2; float J = 1.-smoothstep(0.03, 0.03+fw+.04, jt);
      float id = h21(g + r*31. + floor(r<.5 ? (q.y+g.x)*.5 : (q.x+g.y)*.5)*7.);
      vec3 bc = diffuseColor.rgb*(0.86+0.26*id); J *= clamp(1.-fw*3.,0.,1.);
      diffuseColor.rgb = mix(bc, JOINT, J*.8); }`,
    setts_radial: `{ float rr = length(p.xz); float an = atan(p.z,p.x); float ring = floor(rr/0.45); float k = floor(an*rr/0.55 + h21(vec2(ring))*3.);
      float fr = fract(rr/0.45), fa = fract(an*rr/0.55 + h21(vec2(ring))*3.); float jt = min(min(fr,1.-fr),min(fa,1.-fa)); float fw = fwidth(rr/0.45)*1.5;
      float J = (1.-smoothstep(.05,.05+fw+.05,jt))*clamp(1.-fw*3.,0.,1.); float id = h21(vec2(ring,k));
      vec3 bc = diffuseColor.rgb*(0.9+0.18*id); float rose = smoothstep(16.5,16.,rr)*step(15.,rr);
      bc = mix(bc, vec3(.62,.30,.24), rose*.8); diffuseColor.rgb = mix(bc, JOINT, J*.7); }`,
    concrete_plaza: `{ vec2 q = p.xz/3.; vec2 f = abs(fract(q)-.5); float fw = fwidth(q.x); float J = (1.-smoothstep(.485-fw,.495,max(f.x,f.y)))*0.; J = smoothstep(.48-fw,.5,max(f.x,f.y));
      vec2 b = abs(fract(p.xz/12.)-.5)*12.; float band = step(b.x,.35)+step(b.y,.35); vec3 bc = diffuseColor.rgb*(0.95+0.08*vn(p.xz*.7));
      bc = mix(bc, vec3(.70,.36,.27), clamp(band,0.,1.)*.85); diffuseColor.rgb = mix(bc, JOINT, J*.6); }`,
    asphalt_tinted: `{ diffuseColor.rgb *= 0.92 + 0.12*vn(p.xz*2.3) + 0.06*h21(floor(p.xz*12.)); }`,
    boardwalk: `{ float q = p.x/0.16 + vn(p.zz*.3)*.2; float f = fract(q); float fw = fwidth(q); float J = (1.-smoothstep(.06,.06+fw+.05,min(f,1.-f)))*clamp(1.-fw*2.,0.,1.);
      float id = h21(vec2(floor(q), floor(p.z/3.1 + h21(vec2(floor(q)))))); float grain = vn(vec2(q*3., p.z*.8));
      vec3 bc = diffuseColor.rgb*(0.82+0.3*id)*(0.94+0.1*grain); float end = fract(p.z/3.1 + h21(vec2(floor(q)))); J = max(J, (1.-smoothstep(0.,.02+fwidth(p.z/3.1),min(end,1.-end)))*.8);
      diffuseColor.rgb = mix(bc, JOINT, J*.85); }`,
    flagstone: `{ vec2 v = vor(p.xz/0.75); float fw = fwidth(p.x/0.75); float J = (1.-smoothstep(.05,.09+fw,v.x))*clamp(1.-fw*2.,0.,1.);
      vec3 bc = diffuseColor.rgb*(0.85+0.25*v.y); diffuseColor.rgb = mix(bc, mix(JOINT, vec3(.36,.48,.24), .5), J*.85); }`,
    packed_earth: `{ float n = fbm3(p.xz*.9); diffuseColor.rgb *= 0.86 + 0.24*n + 0.06*h21(floor(p.xz*9.)); }`,
    stamped_pastel: `{ vec2 q = p.xz/1.2; vec2 g = floor(q); vec2 f = fract(q)-.5; float d = length(f); float fw = fwidth(q.x);
      float J = (1.-smoothstep(.43,.46+fw,d))*0.; J = smoothstep(.40,.43+fw,d)*(1.-smoothstep(.46,.5+fw,d)); vec3 pc[4]; pc[0]=vec3(.96,.80,.82); pc[1]=vec3(.80,.90,.95); pc[2]=vec3(.98,.93,.76); pc[3]=vec3(.84,.93,.82);
      int id = int(mod(g.x*2.+g.y*3.,4.)); vec3 bc = mix(diffuseColor.rgb, pc[id], .35); diffuseColor.rgb = mix(bc, JOINT, J*.5); }`,
  };
  const jointOf = pv => { const j = D.paths.paving_types[pv]?.joint || '#888888'; const c = new THREE.Color(j); return `vec3(${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)})`; };
  const materialHook = (category, info) => {
    const base = category.split(':')[0];
    const col = info.instanced || info.vertexColors ? 0xffffff : (info.color != null ? info.color : (CATEGORY_COLORS[base] ?? 0xcccccc));
    const side = info.doubleSide ? THREE.DoubleSide : THREE.FrontSide;
    if (base === 'paving') { const pv = category.split(':')[1]; const pat = PAVE[pv] || PAVE.asphalt_tinted; return mat({ color: col, frag: pat.replace(/JOINT/g, jointOf(pv)), mot: pixel ? 0 : 0.08 }); }
    if (base === 'terrain') return mat({ color: col, vc: !!info.vertexColors, frag: ctx.grassFrag, mot: 0 });
    if (base === 'water') return mat({ color: 0xffffff, frag: ctx.waterFrag(info), mot: 0, transparent: false });
    if (base === 'parking') return mat({ color: col, frag: `{ diffuseColor.rgb *= 0.93 + 0.1*vn(p.xz*1.7); vec2 q = vec2(p.x/2.6, p.z); float f = abs(fract(q.x)-.5); float inAisle = 0.;
      for(int i=0;i<5;i++){ float az = 228. + float(i)*16.; inAisle = max(inAisle, step(abs(p.z-az), 3.0)); }
      float line = step(.465, f)*(1.-inAisle)*step(216.5,p.z); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.92,.92,.88), line*.8);
      float dash = step(abs(fract(p.x/6.)-.5),.25)*inAisle*step(abs(mod(p.z-228.+8.,16.)-8.),.12); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.95,.85,.4), dash*.8); }` });
    return mat({ color: col, vc: !!info.vertexColors, side, transparent: !!info.transparent, opacity: info.opacity ?? 1 });
  };
  // grass: painterly mottled patches (gouache) / mown stripes + dither noise (pixel)
  ctx.grassFrag = pixel ? `{ float h = p.y; float stripe = step(.5, fract((p.x+p.z)/9.)); diffuseColor.rgb *= 0.93 + 0.1*stripe + 0.07*(h21(floor(p.xz*1.3))-.5);
      float tuft = step(.92, h21(floor(p.xz*1.1)+3.)); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.15,1.2,.9), tuft*.6); }`
    : `{ float n1 = fbm3(p.xz*.08), n2 = fbm3(p.xz*.6+9.), n3 = vn(p.xz*vec2(4.,1.3)+p.zx*.3);
      vec3 c = diffuseColor.rgb; c = mix(c*vec3(.82,.92,.78), c*vec3(1.12,1.1,.86), smoothstep(.3,.7,n1)); c *= 0.9 + 0.2*n2; c *= 0.95 + 0.1*n3;
      float bloom = step(.985, h21(floor(p.xz*1.7))); c = mix(c, vec3(1.,.95,.75), bloom*.5); diffuseColor.rgb = c; }`;
  ctx.waterFrag = info => {
    const pool = info && info.id && info.id !== 'lake';
    return `{ vec3 deep = ${pool ? 'vec3(.30,.68,.82)' : 'vec3(.20,.47,.62)'}, shal = ${pool ? 'vec3(.55,.86,.92)' : 'vec3(.38,.66,.74)'};
      vec3 V = normalize(cameraPosition - p); float fr = pow(1.-abs(V.y), 3.);
      float n = fbm3(p.xz*vec2(.12,.3) + vec2(uTime*.05, 0.)); vec3 c = mix(deep, shal, .35 + .5*n);
      float rip = vn(vec2(p.x*.7 + uTime*.35, p.z*2.4 + sin(p.x*.13)*2.)); float rip2 = vn(vec2(p.x*1.6 - uTime*.5, p.z*5.1));
      ${pixel ? `c = mix(c, vec3(.62,.85,1.), step(.83, rip)*.8); c = mix(c, vec3(1.), step(.93, rip2)*.9); c = mix(c, vec3(.75,.86,.95), fr*.6);`
        : `c = mix(c, vec3(.80,.92,.96), smoothstep(.68,.8,rip)*.55); c = mix(c, c*.78, smoothstep(.7,.85,rip2)*.5); c = mix(c, vec3(.78,.87,.93), fr*.75);`}
      diffuseColor.rgb = c; }`;
  };
  const gb = buildGreybox(THREE, park, { detail: opts.detail || 1, material: materialHook });
  root.add(gb.root);
  ctx.gb = gb;
  // groups we replace with detailed versions
  for (const g of ['buildings', 'guests', 'trees', 'props', 'trains']) gb.groups[g].visible = false;
  gb.groups['track:wooden_coaster'].visible = false;
  gb.groups.rides.children.forEach(c => { const id = c.userData?.info?.id; const cat = c.userData?.category; if (cat === 'ride:boat' || ['ferris_wheel', 'swing_ride', 'pirate_ship', 'observation_tower', 'drop_tower', 'carousel'].includes(id) || (ctx.hideRides || []).includes(id)) c.visible = false; });
  // station roofs drawn by greybox are fine; queue rails/canopies replaced
  gb.groups.queues.visible = false;
  // outer ground beyond the site: patchwork fields with hedgerows
  {
    const g = new THREE.PlaneGeometry(9000, 9000, 1, 1); g.rotateX(-Math.PI / 2); g.translate(0, -0.6, 0);
    const m = new THREE.Mesh(g, mat({ color: 0x6f9e50, frag: ctx.grassFrag + (pixel ? `{ float d = max(abs(p.x)-338., max(p.z-318., -268.-p.z)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.16,.40,.20)*(0.9+0.2*step(.5,h21(floor(p.xz*.5)))), smoothstep(0.,20.,d)); }` : `{ float d = max(abs(p.x)-338., max(p.z-318., -268.-p.z));
      vec2 v = vor(p.xz/vec2(110.,80.)); vec3 fc[6]; fc[0]=vec3(.55,.66,.30); fc[1]=vec3(.78,.70,.40); fc[2]=vec3(.42,.58,.30); fc[3]=vec3(.66,.72,.38); fc[4]=vec3(.50,.62,.36); fc[5]=vec3(.84,.78,.50);
      vec3 f = fc[int(v.y*5.99)]; float rows = .92 + .08*step(.5, fract(dot(p.xz, vec2(cos(v.y*9.),sin(v.y*9.)))/6.));
      vec3 c = mix(diffuseColor.rgb, f*rows, smoothstep(0.,30.,d)); c = mix(c, vec3(.24,.40,.22), (1.-smoothstep(0.,.03,v.x))*step(5.,d));
      diffuseColor.rgb = c; }`), mot: 0 }));
    m.receiveShadow = true; root.add(m);
  }
  // car models replace the grey-box car boxes
  {
    gb.groups.parking.children.forEach(c => { if (c.userData?.category === 'car') c.visible = false; });
    const pk = D.parking; const mg = new MG();
    mg.add(GEO.box, T(0, 0.55, 0, 0, 1.8, 0.55, 4.3), 0xffffff); mg.add(GEO.box, T(0, 1.05, -0.2, 0, 1.6, 0.5, 2.2), 0xffffff);
    mg.add(GEO.box, T(0, 1.06, 0.92, 0, 1.5, 0.42, 0.05, -0.5), 0x3a4a5c); mg.add(GEO.box, T(0, 1.06, -1.32, 0, 1.5, 0.4, 0.05, 0.5), 0x3a4a5c);
    for (const s of [-1, 1]) { mg.add(GEO.box, T(s * 0.81, 1.07, -0.2, 0, 0.02, 0.36, 1.9), 0x3a4a5c); for (const zz of [-1.35, 1.35]) mg.add(GEO.cyl6, T(s * 0.82, 0.32, zz, 0, 0.62, 0.24, 0.62, 0, Math.PI / 2), 0x222222);
      mg.add(GEO.box, T(s * 0.6, 0.62, 2.16, 0, 0.3, 0.14, 0.04), 0xfff2c8); mg.add(GEO.box, T(s * 0.6, 0.65, -2.16, 0, 0.3, 0.12, 0.04), 0xc0392b); }
    const cg = mg.geo(); const KC = new Kit(root); const MC = mat({ vc: true });
    for (const [x, z, r, ci] of pk.cars.list) KC.add(cg, MC, T(x, 0, z, r), pk.car_colors[ci]); KC.build(true, 40);
  }
  buildArchitecture(ctx);
  buildNature(ctx);
  buildRides(ctx);
  buildPeople(ctx);
  if (ctx.after) ctx.after(ctx);
  const update = (t) => {
    MS.U.uTime.value = t;
    gb.update(t, shot);
    for (const a of ctx.animators) a(t);
  };
  return { root, update, ctx, gb, MS };
}
