// world.js: the detailed park (all styles). Built from park.json only: nothing is moved, added or removed
// at landmark level; this layer adds detail (people, facades, paving, track hardware, props, bulbs).
import * as THREE from 'three';
import { buildGreybox } from '/film/plan/greybox.js';
import { merge, box, cyl, ico, sph, cone, S, T, R, rng, hash, personGeometry, strollerGeometry, treeGeometries, speciesKind } from './geo.js';
import { U } from './mat.js';

const hex = s => (typeof s === 'string' ? parseInt(s.replace('#', ''), 16) : s);
const C = c => new THREE.Color(c);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;

export function buildWorld(park, M, opts = {}) {
  const D = park.data;
  const LP = M.style === 'lowpoly';
  const root = new THREE.Group(); root.name = 'world';
  const groups = {};
  const G = name => { if (!groups[name]) { groups[name] = new THREE.Group(); groups[name].name = name; root.add(groups[name]); } return groups[name]; };
  const animators = [];
  const R0 = rng(7);
  const landOf = (x, z) => park.landAt(x, z);
  const LANDS = ['entrance', 'main_street', 'hub', 'kiddie', 'seaside', 'jungle', 'thrill', 'frontier', 'midway', 'outside'];
  // keep-out for heavy detail (e.g. globe shot uses everything; POV uses everything)
  const near = opts.detailBox || null; // {x0,x1,z0,z1} region where full detail is built; outside -> cheaper
  const inDetail = (x, z) => !near || (x > near.x0 && x < near.x1 && z > near.z0 && z < near.z1);

  // ------------------------------------------------------------------ geometry registry
  const GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    boxB: T(new THREE.BoxGeometry(1, 1, 1), 0, 0.5, 0),
    cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6), cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8), cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), cyl20: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
    cone8: new THREE.ConeGeometry(0.5, 1, 8), cone12: new THREE.ConeGeometry(0.5, 1, 12), cone16: new THREE.ConeGeometry(0.5, 1, 16), cone4: R(new THREE.ConeGeometry(0.7071, 1, 4), 0, Math.PI / 4, 0),
    sph: new THREE.IcosahedronGeometry(0.5, 1), sph2: new THREE.IcosahedronGeometry(0.5, 2), sph0: new THREE.IcosahedronGeometry(0.5, 0),
    dome: new THREE.SphereGeometry(0.5, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    onion: (() => { const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; const r = Math.sin(u * Math.PI * 0.95) * (1 - u * 0.55) * 0.55 + (u > 0.9 ? 0 : 0); pts.push(new THREE.Vector2(Math.max(0.001, r), u)); } return new THREE.LatheGeometry(pts, 16); })(),
    gable: (() => { const v = [-0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0];
      const idx = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); const g2 = g.toNonIndexed(); g2.computeVertexNormals(); return g2; })(),
    tri: (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0, 0.5, 0, 0, -0.5, 0, 0, 0, -1, 0], 3)); g.computeVertexNormals(); return g; })(),
    disc: R(new THREE.CircleGeometry(0.5, 20), -Math.PI / 2, 0, 0),
    quad: R(new THREE.PlaneGeometry(1, 1), -Math.PI / 2, 0, 0),
    vquad: new THREE.PlaneGeometry(1, 1),
    torus: new THREE.TorusGeometry(0.5, 0.06, 6, 24),
  };
  GEO.cyl = GEO.cyl8;
  const persons = { hi: personGeometry(2), lo: personGeometry(1) };

  // ------------------------------------------------------------------ material classes
  const MAT = {};
  const mat = (k) => {
    if (MAT[k]) return MAT[k];
    let m;
    const [base, arg] = k.split(':');
    switch (base) {
      case 'solid': m = M.std({ snowK: 0.85 }); break;
      case 'ride': m = M.std({ snowK: 0.18, rough: LP ? 0.8 : 0.32 }); break;      // glossy painted rides (stay colourful in winter)
      case 'track': m = M.std({ snowK: 0.12, rough: LP ? 0.7 : 0.28, metal: LP ? 0 : 0.15, bpPerVertex: true }); break;
      case 'trackI': m = M.std({ snowK: 0.12, rough: LP ? 0.7 : 0.3, metal: LP ? 0 : 0.2 }); break;
      case 'metal': m = M.std({ snowK: 0.3, rough: 0.35, metal: LP ? 0.1 : 0.6 }); break;
      case 'roof': m = M.std({ snowK: 1.0, rough: LP ? 0.85 : 0.5 }); break;
      case 'fabric': m = M.std({ snowK: 0.5, side: THREE.DoubleSide, rough: LP ? 0.9 : 0.6 }); break;
      case 'leaf': m = M.std({ noZone: true, snowK: 0.55, rough: LP ? 0.9 : 0.8, bump: opts.flockTex || null, bumpScale: 3, map: opts.flockTex || null }); break;
      case 'bark': m = M.std({ noZone: true, snowK: 0.4, rough: 0.9 }); break;
      case 'person': m = M.std({ guest: true, snowK: 0, rough: LP ? 0.85 : 0.5, key: 'guest' }); break;
      case 'glass': m = M.std({ snowK: 0, rough: 0.12, metal: 0.1, color: 0xffffff }); break;
      case 'win': { // window glass that glows at night per land (arg = land)
        m = M.std({ snowK: 0, rough: 0.15, metal: 0.1, emissive: 0xffbe6e, emissiveIntensity: 0, key: 'win' + arg }); m.userData.land = arg; m.userData.glow = 1.6; break; }
      case 'glow': { // emissive panels/lanterns (arg = land): lamp heads, signs with icons
        m = M.std({ snowK: 0, rough: 0.5, emissive: 0xffc76b, emissiveIntensity: 0, key: 'glow' + arg }); m.userData.land = arg; m.userData.glow = 3.0; break; }
      case 'bulb': { // HDR bulbs (unlit), colour per instance, gain per land
        m = M.basic({ color: 0xffffff, toneMapped: true }); m.userData.land = arg; m.userData.bulb = true; break; }
      case 'water': m = M.std({ snowK: 0, rough: LP ? 0.35 : 0.08, metal: 0.0, color: 0xffffff, env: 1.4, key: 'water', fragExtra: waterFrag }); break;
      case 'line': m = new THREE.LineBasicMaterial({ color: 0x333333 }); break;
      default: m = M.std({});
    }
    MAT[k] = m; return m;
  };

  // ------------------------------------------------------------------ instanced batches
  const batches = new Map();
  const TILE = opts.tile || 120;
  const put = (geoKey, matKey, m4, color, opt = {}) => {
    const tileKey = opt.noTile ? 'x' : Math.floor(m4.elements[12] / TILE) + ',' + Math.floor(m4.elements[14] / TILE);
    const key = (typeof geoKey === 'string' ? geoKey : geoKey.uuid) + '|' + matKey + '|' + (opt.group || 'static') + '|' + tileKey + '|' + (opt.shadow === false ? 0 : 1);
    let b = batches.get(key);
    if (!b) { b = { geoKey, matKey, group: opt.group || 'static', items: [], shadow: opt.shadow !== false, recv: opt.recv !== false }; batches.set(key, b); }
    b.items.push(m4, color);
  };
  const flush = () => {
    const col = new THREE.Color();
    for (const b of batches.values()) {
      const n = b.items.length / 2; if (!n) continue;
      const geo = typeof b.geoKey === 'string' ? GEO[b.geoKey] : b.geoKey;
      const im = new THREE.InstancedMesh(geo, mat(b.matKey), n);
      for (let i = 0; i < n; i++) { im.setMatrixAt(i, b.items[2 * i]); col.set(b.items[2 * i + 1]); im.setColorAt(i, col); }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = b.shadow; im.receiveShadow = b.recv; im.computeBoundingSphere();
      im.userData.matKey = b.matKey;
      G(b.group).add(im);
    }
    batches.clear();
  };
  const E = new THREE.Euler(), Q = new THREE.Quaternion();
  const cmp = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => { E.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(E); return new THREE.Matrix4().compose(V(x, y, z), Q, V(sx, sy, sz)); };
  const beamM = (a, b, w, h) => {
    const va = V(...a), vb = V(...b); const d = vb.clone().sub(va); const L = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    return new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, V(w, L, h ?? w));
  };
  // local frame for oriented objects (front = local +z)
  const frame = (x, y, z, rot) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    const p = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    return {
      p, rot,
      box: (mk, lx, ly, lz, w, h, d, color, ry = 0, rx = 0, rz = 0, o) => put('box', mk, cmp(...p(lx, ly, lz), rot + ry, w, h, d, rx, rz), color, o),
      g: (gk, mk, lx, ly, lz, sx, sy, sz, color, ry = 0, rx = 0, rz = 0, o) => put(gk, mk, cmp(...p(lx, ly, lz), rot + ry, sx, sy, sz, rx, rz), color, o),
      beam: (mk, a, b, w, color, o) => put('box', mk, beamM(p(...a), p(...b), w), color, o),
      cbeam: (mk, a, b, w, color, o) => put('cyl6', mk, beamM(p(...a), p(...b), w), color, o),
    };
  };

  // ================================================================== GREYBOX BASE (terrain, water, paving, parking)
  const gbMat = (category, info) => {
    if (category === 'terrain') return terrainMat(info);
    if (category.startsWith('paving:')) return pavingMat(category.slice(7));
    if (category === 'water') return mat('water');
    if (category === 'kerb') return M.std({ color: 0x9a948a, snowK: 0.8, side: THREE.DoubleSide });
    if (category === 'parking') return M.std({ color: info.color || 0x55585c, snowK: 1, kind: 'ground', key: 'park', fragExtra: asphaltFrag });
    if (category === 'car') return M.std({ color: 0xffffff, rough: 0.3, snowK: 0.9 });
    if (category === 'backstage') return M.std({ color: 0xffffff, snowK: 1 });
    if (category === 'flowerbed') return M.std({ color: info.color, snowK: 0.9, kind: 'ground' });
    return null;
  };
  const gb = buildGreybox(THREE, park, { detail: 1, material: gbMat });
  const keep = ['terrain', 'water', 'paving', 'parking'];
  for (const [k, g] of Object.entries(gb.groups)) if (!keep.includes(k)) g.visible = false;
  // only keep needed groups in our root (others are dropped)
  for (const k of keep) { const g = gb.groups[k]; g.parent.remove(g); root.add(g); groups[k] = g; }
  gb.groups.water.traverse(o => { if (o.isMesh) { o.material = mat('water'); o.receiveShadow = true; } });
  gb.groups.terrain.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
  gb.groups.paving.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
  // kerbs: replace thin strips by a proper kerb profile (top + face)
  gb.groups.paving.children.filter(o => o.userData.category === 'kerb').forEach(o => o.parent.remove(o));
  {
    const pos = [];
    const ring = (rr, timber) => {
      for (let i = 0; i < rr.length; i++) {
        const a = rr[i], b = rr[(i + 1) % rr.length]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 0.01) continue;
        const nx = -dz / L * 0.16, nz = dx / L * 0.16; const h = 0.13;
        // top face (outside offset), outer face, inner face
        const q = (p0, p1, p2, p3) => pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
        q([a[0], h, a[1]], [b[0], h, b[1]], [b[0] + nx, h, b[1] + nz], [a[0] + nx, h, a[1] + nz]);
        q([a[0] + nx, h, a[1] + nz], [b[0] + nx, h, b[1] + nz], [b[0] + nx, 0, b[1] + nz], [a[0] + nx, 0, a[1] + nz]);
        q([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]);
      }
    };
    for (const p of D.paths.kerbs.outlines) { ring(p.outer); for (const h of p.holes) ring(h); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.std({ color: 0xa8a297, snowK: 0.9, side: THREE.DoubleSide, rough: 0.7 })); m.receiveShadow = true; m.castShadow = false;
    G('paving').add(m);
  }

  function terrainMat() {
    return M.std({ vertexColors: true, kind: 'ground', snowK: 0.8, rough: LP ? 0.95 : 0.85, key: 'terrain', bump: LP ? null : opts.grassTex, bumpScale: 1, fragExtra: f => f.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 p = vWP.xz;
        float stripe = step(0.5, fract(p.x / 6.0));
        float n = mn(p * 0.08) * 0.6 + mn(p * 0.5) * 0.4;
        float bermish = smoothstep(0.6, 2.0, vWP.y);
        diffuseColor.rgb *= mix(0.92 + 0.1 * stripe, 1.0, bermish) * (0.88 + 0.22 * n);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05, 1.02, 0.85), smoothstep(0.55, 0.8, mn(p * 0.02)) * 0.5);
      }`) });
  }
  function asphaltFrag(f) {
    return f.replace('#include <color_fragment>', `#include <color_fragment>
      { vec2 p = vWP.xz; float n = mh(floor(p * 6.0)); diffuseColor.rgb *= 0.93 + 0.1 * n;
        float bay = 1.0 - smoothstep(0.03, 0.07, abs(fract((p.x + 1.3) / 2.6) - 0.5) * 2.6 - 1.2);
        float rowz = mod(p.y - 228.0 + 8.0, 16.0); float inBay = step(2.0, rowz) * step(rowz, 14.0) * step(abs(rowz - 8.0), 5.8) ;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), bay * inBay * 0.9 * step(216.0, p.y)); }`);
  }
  function waterFrag(f) {
    return f.replace('#include <color_fragment>', `#include <color_fragment>
      { vec2 p = vWP.xz; float t = uTime;
        float w = mn(p * 0.25 + vec2(t * 0.15, t * 0.08)) * 0.6 + mn(p * 0.9 - vec2(t * 0.3, -t * 0.2)) * 0.4;
        vec3 deep = vec3(0.16, 0.42, 0.62), shallow = vec3(0.32, 0.66, 0.78);
        diffuseColor.rgb = mix(deep, shallow, w);
        float crest = smoothstep(0.66, 0.8, mn(p * 0.6 + vec2(t * 0.4, t * 0.1))) ;
        diffuseColor.rgb += vec3(0.25) * crest;
        diffuseColor.rgb *= mix(1.0, 0.28, uNight);
      }`);
  }
  function pavingMat(type) {
    const pt = D.paths.paving_types[type] || { color: '#cccccc', joint: '#999999' };
    const PAT = { brick_herringbone: 1, setts_radial: 2, concrete_plaza: 3, asphalt_tinted: 4, boardwalk: 5, flagstone: 6, packed_earth: 7, stamped_pastel: 8, checker: 9, queue_concrete: 10, asphalt_grey: 11, service: 12 }[type] || 0;
    const jc = C(pt.joint);
    return M.std({ color: hex(pt.color), kind: 'ground', bpPath: true, snowK: 0.55, rough: LP ? 0.9 : (type === 'boardwalk' ? 0.6 : 0.75), key: 'pav' + type, polygonOffset: -1,
      fragExtra: f => f.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 p = vWP.xz; vec3 J = vec3(${jc.r.toFixed(3)}, ${jc.g.toFixed(3)}, ${jc.b.toFixed(3)});
        float fw = length(fwidth(p));
        float j = 0.0; float tone = 0.0;
        int PAT = ${PAT};
        if (PAT == 1) { // herringbone-ish basket brick, 0.5 x 0.25 m
          vec2 uv = vec2(p.x + p.y, p.y - p.x) * 0.7071 / 0.25; vec2 c = floor(uv); vec2 fr = fract(uv);
          float odd = mod(c.x + c.y, 2.0); vec2 q = odd > 0.5 ? fr : fr.yx; float sub = step(0.5, q.x); vec2 b = vec2(fract(q.x * 2.0), q.y);
          j = 1.0 - smoothstep(0.0, 0.09 + fw * 3.0, min(min(b.x, 1.0 - b.x) * 0.5, min(b.y, 1.0 - b.y)));
          tone = mh(c * 2.0 + sub) - 0.5;
        } else if (PAT == 2) { // concentric setts around the hub
          float r = length(p); float a = atan(p.y, p.x); float ring = floor(r / 0.6); float seg = floor(a * r / 0.6 + ring * 0.5);
          float fr = fract(r / 0.6), fa = fract(a * r / 0.6 + ring * 0.5);
          j = 1.0 - smoothstep(0.0, 0.08 + fw * 2.0, min(min(fr, 1.0 - fr), min(fa, 1.0 - fa)));
          tone = mh(vec2(ring, seg)) - 0.5;
          float rose = step(abs(r - 31.0), 0.6) + step(abs(r - 37.5), 0.5) ; tone -= rose * 0.6;
        } else if (PAT == 3) { // 3 m grid concrete + brick bands every 12 m
          vec2 g = abs(fract(p / 3.0 + 0.5) - 0.5) * 3.0; j = 1.0 - smoothstep(0.02, 0.05 + fw, min(g.x, g.y));
          vec2 bb = abs(fract(p / 12.0 + 0.5) - 0.5) * 12.0; float band = 1.0 - step(0.35, min(bb.x, bb.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.3, 0.22), band * 0.85);
          tone = (mh(floor(p / 3.0)) - 0.5) * 0.5 + (mn(p * 3.0) - 0.5) * 0.3;
        } else if (PAT == 4 || PAT == 7) { // tinted asphalt / packed earth
          tone = (mn(p * 0.7) - 0.5) * 0.6 + (mh(floor(p * 8.0)) - 0.5) * 0.25;
        } else if (PAT == 5) { // boardwalk planks
          float u = (p.x + p.y * 0.0) / 0.3; float pl = floor(u); float fr = fract(u);
          j = 1.0 - smoothstep(0.0, 0.08 + fw * 2.0, min(fr, 1.0 - fr)); tone = (mh(vec2(pl, floor(p.y / 2.4 + mh(vec2(pl, 1.0))))) - 0.5) * 0.7;
        } else if (PAT == 6) { // irregular flags (cell noise)
          vec2 g = floor(p / 0.9), fr2 = fract(p / 0.9); float d1 = 9.0, d2 = 9.0; vec2 id = vec2(0.0);
          for (int yy = -1; yy <= 1; yy++) for (int xx = -1; xx <= 1; xx++) { vec2 o = vec2(float(xx), float(yy)); vec2 r = o + vec2(mh(g + o), mh(g + o + 7.3)) - fr2; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; id = g + o; } else if (d < d2) d2 = d; }
          j = 1.0 - smoothstep(0.0, 0.05 + fw, sqrt(d2) - sqrt(d1)); tone = mh(id) - 0.5;
        } else if (PAT == 8) { // stamped pastel with hopscotch squares
          vec2 g = abs(fract(p + 0.5) - 0.5); j = 1.0 - smoothstep(0.0, 0.04 + fw, min(g.x, g.y));
          float h = mh(floor(p)); vec3 pc = h < 0.08 ? vec3(0.66, 0.85, 0.92) : h < 0.16 ? vec3(1.0, 0.88, 0.54) : h < 0.24 ? vec3(0.72, 0.88, 0.69) : diffuseColor.rgb;
          diffuseColor.rgb = pc;
        } else if (PAT == 9) { // red/cream checker 1 m
          vec2 c = floor(p); float k = mod(c.x + c.y, 2.0); diffuseColor.rgb = mix(diffuseColor.rgb, J, k * 0.85); J = diffuseColor.rgb * 0.8;
          vec2 g = abs(fract(p + 0.5) - 0.5); j = (1.0 - smoothstep(0.0, 0.03 + fw, min(g.x, g.y))) * 0.5;
        } else if (PAT == 10 || PAT == 12) { // broom-finished concrete
          float m = ${PAT === 12 ? '4.0' : '1.5'}; vec2 g = abs(fract(p / m + 0.5) - 0.5) * m; j = 1.0 - smoothstep(0.01, 0.04 + fw, min(g.x, g.y));
          tone = (mn(vec2(p.x * 0.5, p.y * 18.0)) - 0.5) * 0.18 + (mn(p * 0.5) - 0.5) * 0.15;
        } else if (PAT == 11) { tone = (mh(floor(p * 6.0)) - 0.5) * 0.12; }
        float fade = 1.0 - smoothstep(0.12, 0.45, fw);
        diffuseColor.rgb *= 1.0 + tone * 0.14 * fade;
        diffuseColor.rgb = mix(diffuseColor.rgb, J, j * 0.8 * fade);
        diffuseColor.rgb *= 0.92 + 0.12 * mn(p * 0.05);
      }`) });
  }

  // ================================================================== LIGHT REGISTRY (bulbs + pools)
  const bulbSets = []; // {land, mesh, base colors}
  const bulbList = {}; // land -> [{p:[x,y,z], c: Color, s: size, chase?}]
  const addBulb = (land, x, y, z, color = 0xffc76b, size = 0.22, tag = null) => { (bulbList[land] = bulbList[land] || []).push({ x, y, z, c: color, s: size, tag }); };
  const pools = []; // light pools on the ground: {land, x, z, r, color}
  const addPool = (land, x, z, r, color = 0xffb460, k = 1) => pools.push({ land, x, z, r, color, k });
  const pointLights = []; // candidate dynamic lights
  const addPoint = (land, x, y, z, color, intensity, dist) => pointLights.push({ land, x, y, z, color, intensity, dist });

  // ================================================================== BUILDINGS
  const B = frame;
  const winKey = (land) => 'win:' + land;
  function windowRow(L, land, y, z, w, count, ww, wh, trim, opts2 = {}) {
    // windows on facade plane at local z, centred, count windows of ww x wh, bottom at y
    if (count <= 0) return;
    const step = w / count;
    for (let i = 0; i < count; i++) {
      const x = -w / 2 + step * (i + 0.5);
      const lit = hash(x * 13.1 + y * 7.7 + z * 3.3 + L.p(0, 0, 0)[0]) < 0.72;
      L.box('solid', x, y + wh / 2, z + 0.03, ww + 0.22, wh + 0.22, 0.08, trim);          // frame
      L.box(lit ? winKey(land) : 'glass', x, y + wh / 2, z + 0.07, ww, wh, 0.06, lit ? 0x2a3442 : 0x2f3a48);
      L.box('solid', x, y + wh / 2, z + 0.11, 0.06, wh, 0.03, trim);                       // mullion
      L.box('solid', x, y + wh * 0.58, z + 0.11, ww, 0.05, 0.03, trim);                    // transom
      L.box('solid', x, y - 0.06, z + 0.12, ww + 0.36, 0.1, 0.22, trim);                    // sill
      if (opts2.pediment) L.g('gable', 'solid', x, y + wh + 0.12, z + 0.08, ww + 0.36, 0.28, 0.16, trim, Math.PI / 2);
      else L.box('solid', x, y + wh + 0.16, z + 0.1, ww + 0.34, 0.12, 0.16, trim);         // lintel
      if (opts2.shutters) { L.box('solid', x - ww / 2 - 0.22, y + wh / 2, z + 0.08, 0.3, wh, 0.05, opts2.shutters); L.box('solid', x + ww / 2 + 0.22, y + wh / 2, z + 0.08, 0.3, wh, 0.05, opts2.shutters); }
      if (opts2.box && lit !== 2) { L.box('solid', x, y - 0.25, z + 0.28, ww + 0.1, 0.3, 0.3, 0x6b4a2e); for (let k = 0; k < 4; k++) L.g('sph0', 'leaf', x - ww / 2 + 0.15 + k * (ww - 0.3) / 3, y - 0.05, z + 0.3, 0.26, 0.2, 0.26, [0xe74c3c, 0xf5a6c8, 0xffffff, 0xf1c40f, 0x5e9c3f][(k + i) % 5]); }
    }
  }
  function awning(L, x, y, z, w, depth, col, style, land) {
    // sloped canvas from wall (y) outward (z) dropping 0.7, stripes; scalloped valance
    const n = Math.max(4, Math.round(w / 0.45));
    const slope = Math.atan2(0.75, depth);
    for (let i = 0; i < n; i++) {
      const sx = -w / 2 + (i + 0.5) * w / n;
      const c = style === 'plain' ? col : (i % 2 ? 0xfaf3e6 : col);
      L.box('fabric', x + sx, y - 0.375, z + depth / 2, w / n + 0.01, 0.05, Math.hypot(depth, 0.75), c, 0, slope);
      if (style === 'scalloped' || style === 'striped') L.g('dome', 'fabric', x + sx, y - 0.76, z + depth + 0.02, w / n * 0.98, -0.32, 0.06, c);
      else L.box('fabric', x + sx, y - 0.86, z + depth, w / n + 0.01, 0.22, 0.04, c);
    }
    // iron brackets
    L.beam('metal', [x - w / 2 + 0.2, y - 1.2, z + 0.05], [x - w / 2 + 0.2, y - 0.7, z + depth], 0.05, 0x2d2d2d);
    L.beam('metal', [x + w / 2 - 0.2, y - 1.2, z + 0.05], [x + w / 2 - 0.2, y - 0.7, z + depth], 0.05, 0x2d2d2d);
  }
  function roofOn(L, roof, w, d, y, roofCol, trim, flatOK = true) {
    const rh = Math.min(w, d) * 0.4;
    if (roof === 'gable') { L.g('gable', 'roof', 0, y, 0, w + 0.5, rh, d + 0.5, roofCol); }
    else if (roof === 'gable_front') { L.g('gable', 'roof', 0, y, 0, d + 0.5, rh * 1.25, w + 0.5, roofCol, Math.PI / 2); }
    else if (roof === 'hipped') { L.g('cone4', 'roof', 0, y + rh * 0.45, 0, w * 1.02, rh * 0.9, d * 1.02, roofCol); }
    else if (roof === 'mansard') {
      L.g('cone4', 'roof', 0, y + rh * 0.5, 0, w * 1.05, rh, d * 1.05, roofCol);
      for (const sx of [-0.25, 0.25]) { L.box('solid', sx * w, y + rh * 0.35, d / 2 - rh * 0.3, 1.0, 1.1, 1.0, trim); L.g('gable', 'roof', sx * w, y + rh * 0.35 + 0.55, d / 2 - rh * 0.3, 1.2, 0.55, 1.2, roofCol, Math.PI / 2); L.box(winKey('main_street'), sx * w, y + rh * 0.33, d / 2 - rh * 0.3 + 0.52, 0.6, 0.7, 0.05, 0x2a3442); }
    } else if (roof === 'corner_turret_dome') {
      L.box('roof', 0, y + 0.2, 0, w + 0.3, 0.4, d + 0.3, roofCol);
      L.g('cyl12', 'solid', w / 2 - 1.3, y + 1.2, d / 2 - 1.3, 2.6, 2.4, 2.6, trim);
      L.g('onion', 'roof', w / 2 - 1.3, y + 2.4, d / 2 - 1.3, 3.0, 2.6, 3.0, 0x3e7e6e);
      L.g('cyl6', 'metal', w / 2 - 1.3, y + 5.2, d / 2 - 1.3, 0.08, 0.8, 0.08, 0xd9a441);
    } else { // flat_cornice
      L.box('roof', 0, y + 0.1, 0, w, 0.2, d, 0x6d6a66);
    }
  }
  function mainStreetShop(b) {
    const L = B(b.position[0], 0, b.position[2], b.rot);
    const land = 'main_street';
    const w = b.w, d = b.d, h = b.h; const wall = hex(b.wall), trim = hex(b.trim || '#FFFFFF'), aw = hex(b.awning || '#C8463A');
    const sh = b.storey_heights || [4.2, 2.9, 2.2];
    L.box('solid', 0, h / 2, 0, w - 0.1, h, d, wall);
    // brick texture-ish courses (thin darker bands)
    for (let y = sh[0] + 0.5; y < h - 0.4; y += 0.7) L.box('solid', 0, y, d / 2 + 0.01, w - 0.2, 0.04, 0.02, new THREE.Color(wall).multiplyScalar(0.85).getHex());
    // pilasters
    for (const sx of [-1, 1]) L.box('solid', sx * (w / 2 - 0.25), h / 2, d / 2 + 0.08, 0.5, h, 0.2, trim);
    // ground-floor shopfront
    const sf = b.shopfront; const gy = 0;
    L.box('solid', 0, 0.3, d / 2 + 0.1, w - 1.0, 0.6, 0.16, new THREE.Color(trim).multiplyScalar(0.8).getHex()); // stall riser
    if (sf === 'arcade') {
      const n = Math.max(2, Math.round(w / 3.2));
      for (let i = 0; i < n; i++) { const x = -w / 2 + 0.5 + (i + 0.5) * (w - 1) / n; const ww = (w - 1) / n - 0.5;
        L.box(winKey(land), x, 2.0, d / 2 + 0.04, ww, 3.0, 0.06, 0x2a3442); L.g('cyl12', 'solid', x, 3.5, d / 2 + 0.1, ww, 0.12, ww * 0.6, trim, 0, Math.PI / 2);
        L.box('solid', x - ww / 2 - 0.25, 1.8, d / 2 + 0.12, 0.3, 3.6, 0.3, trim); }
    } else if (sf === 'bay_window') {
      L.box(winKey(land), -w * 0.18, 1.9, d / 2 + 0.55, w * 0.42, 2.2, 0.9, 0x2a3442);
      L.box('solid', -w * 0.18, 3.1, d / 2 + 0.6, w * 0.46, 0.2, 1.1, trim); L.box('solid', -w * 0.18, 0.55, d / 2 + 0.6, w * 0.46, 0.5, 1.1, trim);
      L.box('solid', w * 0.25, 1.4, d / 2 + 0.05, 1.3, 2.8, 0.1, 0x5a3a26); L.box(winKey(land), w * 0.25, 3.15, d / 2 + 0.06, 1.2, 0.5, 0.06, 0x2a3442);
    } else if (sf === 'double_doors') {
      L.box('solid', 0, 1.45, d / 2 + 0.05, 2.0, 2.9, 0.1, 0x3e5b4a); L.box(winKey(land), -0.5, 1.9, d / 2 + 0.11, 0.7, 1.4, 0.04, 0x2a3442); L.box(winKey(land), 0.5, 1.9, d / 2 + 0.11, 0.7, 1.4, 0.04, 0x2a3442);
      for (const sx of [-1, 1]) L.box(winKey(land), sx * (w / 4 + 0.6), 1.9, d / 2 + 0.05, w / 2 - 2.6, 2.4, 0.06, 0x2a3442);
    } else { // display windows
      for (const sx of [-1, 1]) { L.box(winKey(land), sx * (w / 4 + 0.35), 1.95, d / 2 + 0.05, w / 2 - 1.6, 2.5, 0.06, 0x2a3442); L.box('solid', sx * (w / 4 + 0.35), 1.95, d / 2 + 0.1, 0.06, 2.5, 0.04, trim); }
      L.box('solid', 0, 1.4, d / 2 + 0.05, 1.1, 2.8, 0.1, 0x6b3a2a);
    }
    // goods in the window (colour dots)
    if (inDetail(b.position[0], b.position[2])) for (let i = 0; i < 6; i++) L.g('sph0', 'solid', -w / 2 + 1 + hash(i + b.position[2]) * (w - 2), 0.9 + hash(i * 3.1) * 0.3, d / 2 - 0.2, 0.35, 0.35, 0.35, [0xe74c3c, 0xf1c40f, 0x3498db, 0xf5a6c8, 0x2ecc71][i % 5]);
    // fascia sign board (blank) above shopfront
    L.box('solid', 0, sh[0] - 0.35, d / 2 + 0.14, w - 1.2, 0.6, 0.12, trim);
    L.box('glow:' + land, 0, sh[0] - 0.35, d / 2 + 0.21, w - 1.8, 0.38, 0.03, aw); // painted blank sign (glows a little at night)
    // awning
    awning(L, 0, sh[0] - 0.7, d / 2 + 0.15, w - 1.0, 1.9, aw, b.awning_style || 'scalloped', land);
    // storey bands + upper windows
    let y = sh[0];
    for (let s = 1; s < sh.length; s++) {
      L.box('solid', 0, y + 0.08, d / 2 + 0.12, w + 0.1, 0.22, 0.26, trim);
      const wh = sh[s] * 0.56, ww = Math.min(1.2, sh[s] * 0.42);
      windowRow(L, land, y + sh[s] * 0.24, d / 2, w - 1.2, Math.max(1, Math.floor((w - 1) / 2.2)), ww, wh, trim, { box: s === 1 && b.window_boxes, pediment: s === 1 && (b.position[2] | 0) % 2 === 0, shutters: s === 2 && (b.position[2] | 0) % 3 === 0 ? 0x2f6e8e : 0 });
      y += sh[s];
    }
    // cornice + dentils + parapet
    L.box('solid', 0, h - 0.25, d / 2 + 0.25, w + 0.3, 0.32, 0.6, trim);
    L.box('solid', 0, h + 0.05, d / 2 + 0.3, w + 0.5, 0.18, 0.7, trim);
    if (inDetail(b.position[0], b.position[2])) for (let x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.45) L.box('solid', x, h - 0.48, d / 2 + 0.2, 0.18, 0.16, 0.3, trim);
    if (b.roof === 'flat_cornice') { L.box('solid', 0, h + 0.55, d / 2 - 0.1, w, 0.9, 0.3, wall); L.g('gable', 'solid', 0, h + 1.0, d / 2 - 0.1, 2.6, 0.7, 0.32, trim, Math.PI / 2); }
    roofOn(L, b.roof, w - 0.1, d, h, hex('#4E5D6C'), trim);
    // bulb outline on the cornice
    const c0 = L.p(-w / 2, h + 0.18, d / 2 + 0.66), c1 = L.p(w / 2, h + 0.18, d / 2 + 0.66);
    const nb = Math.round(w / 0.6); for (let i = 0; i <= nb; i++) addBulb(land, lerp(c0[0], c1[0], i / nb), h + 0.2, lerp(c0[2], c1[2], i / nb), 0xffd08a, 0.13);
  }
  function genericBuilding(b) {
    const [x, y0, z] = b.position; const rot = b.rot || 0; const L = B(x, y0, z, rot); const land = landOf(x, z);
    const pal = (D.lands.find(l => l.id === land) || D.lands[0]).palette;
    const w = b.w, d = b.d, h = b.h;
    const kind = b.kind;
    if (kind === 'entrance_arch') {
      for (const sx of [-14, 14]) {
        const T2 = B(x + sx, 0, z, rot);
        T2.box('solid', 0, 6, 0, 6, 12, 4, 0xb5563f); T2.box('solid', 0, 0.6, 0, 6.6, 1.2, 4.6, 0xd9c9a8);
        for (let yy = 2; yy < 12; yy += 2.5) T2.box('solid', 0, yy, 0, 6.2, 0.25, 4.2, 0xd9c9a8);
        T2.box('solid', 0, 12.3, 0, 6.8, 0.6, 4.8, 0xd9c9a8); T2.g('dome', 'roof', 0, 12.6, 0, 5.6, 5.0, 4.2, 0x3e7e6e); T2.g('cyl6', 'metal', 0, 15.6, 0, 0.1, 2.0, 0.1, 0xd9a441);
        T2.box(winKey('entrance'), 0, 8, 2.04, 1.4, 2.2, 0.05, 0x2a3442); T2.box(winKey('entrance'), 0, 8, -2.04, 1.4, 2.2, 0.05, 0x2a3442);
        for (let k = 0; k < 14; k++) { const p = T2.p(-3.1 + (k % 7) * 1.03, 12.6, k < 7 ? 2.45 : -2.45); addBulb('entrance', p[0], p[1], p[2], 0xffd08a, 0.16); }
        for (let k = 0; k < 16; k++) { const p = T2.p(k < 8 ? -3.1 : 3.1, 1.5 + (k % 8) * 1.4, 2.4); addBulb('entrance', p[0], p[1], p[2], 0xffd08a, 0.16); }
      }
      // wrought-iron arch spanning 22 m
      const n = 40; for (let i = 0; i < n; i++) { const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n; const P0 = [-11 * Math.cos(a0), 12 + 3.2 * Math.sin(a0), 0], P1 = [-11 * Math.cos(a1), 12 + 3.2 * Math.sin(a1), 0];
        L.beam('metal', P0, P1, 0.22, 0x26302c); L.beam('metal', [P0[0], P0[1] - 1.2, 0], [P1[0], P1[1] - 1.2, 0], 0.14, 0x26302c);
        if (i % 2 === 0) L.beam('metal', P0, [P0[0], P0[1] - 1.2, 0], 0.08, 0x26302c);
        const q = L.p(...P0); addBulb('entrance', q[0], q[1] + 0.2, q[2] + 0.2, 0xffd890, 0.2); }
      L.box('solid', 0, 15.6, 0, 4.2, 1.6, 0.3, 0xd9a441); L.box('solid', 0, 15.6, 0.1, 3.6, 1.1, 0.3, 0xf3e6cc); // blank cartouche
      return;
    }
    if (kind === 'turnstiles') {
      L.box('fabric', 0, 3.2, 0, w, 0.25, 3.0, 0x2f6e5a);
      for (let i = 0; i < 25; i++) { const xx = -w / 2 + 1 + i * (w - 2) / 24; L.box('solid', xx, 0.6, 0, 0.5, 1.2, 1.2, i % 3 === 0 ? 0xb5563f : 0xb8bcc0); if (i % 3 === 0) L.box('solid', xx, 1.8, 0, 0.5, 2.8, 0.5, 0xb5563f); }
      return;
    }
    if (kind === 'bandstand') {
      L.g('cyl8', 'solid', 0, 0.5, 0, 10.4, 1.0, 10.4, 0xb5563f); L.g('cyl8', 'solid', 0, 1.05, 0, 10.8, 0.12, 10.8, 0xf3e6cc);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; L.g('cyl6', 'solid', Math.cos(a) * 4.6, 3.3, Math.sin(a) * 4.6, 0.25, 4.4, 0.25, 0xffffff); L.box('solid', Math.cos(a) * 4.6, 1.6, Math.sin(a) * 4.6, 0.08, 0.7, 3.5, 0xffffff, -a + Math.PI / 2); }
      L.g('cyl8', 'solid', 0, 5.6, 0, 10.6, 0.4, 10.6, 0xffffff);
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; L.g('tri', 'fabric', Math.cos(a) * 2.6, 5.8 + 2.4, Math.sin(a) * 2.6, 2.1, 0.01, 1, i % 2 ? 0xc8463a : 0xffffff); }
      L.g('onion', 'fabric', 0, 5.8, 0, 11, 4.4, 11, 0xc8463a); L.g('cyl6', 'metal', 0, 10.6, 0, 0.1, 1.2, 0.1, 0xd9a441);
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const p = L.p(Math.cos(a) * 5.35, 5.5, Math.sin(a) * 5.35); addBulb(land, p[0], p[1], p[2], 0xffd08a, 0.15); }
      return;
    }
    if (kind === 'water_tower') {
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.beam('solid', [sx * 2.6, 0, sz * 2.6], [sx * 2.0, 8, sz * 2.0], 0.3, 0x6b4a2e);
      for (let yy = 2; yy < 8; yy += 3) { L.box('solid', 0, yy, 2.3, 4.6, 0.15, 0.15, 0x6b4a2e); L.box('solid', 0, yy, -2.3, 4.6, 0.15, 0.15, 0x6b4a2e); L.box('solid', 2.3, yy, 0, 0.15, 0.15, 4.6, 0x6b4a2e); L.box('solid', -2.3, yy, 0, 0.15, 0.15, 4.6, 0x6b4a2e); }
      L.g('cyl12', 'solid', 0, 10.2, 0, 5.4, 4.4, 5.4, 0x8b6b4a); for (const yy of [8.6, 10.2, 11.8]) L.g('cyl12', 'metal', 0, yy, 0, 5.55, 0.12, 5.55, 0x333333);
      L.g('cone12', 'roof', 0, 13.3, 0, 6.2, 1.8, 6.2, 0x5d3a1a); L.beam('metal', [2.7, 11, 0], [3.6, 8.5, 0], 0.15, 0x333333);
      return;
    }
    if (kind === 'lighthouse_folly') {
      for (let i = 0; i < 6; i++) L.g('cyl12', 'solid', 0, 1 + i * 2, 0, 3.2 - i * 0.18, 2.0, 3.2 - i * 0.18, i % 2 ? 0xffffff : 0xc0392b);
      L.g('cyl12', 'solid', 0, 12.2, 0, 3.6, 0.3, 3.6, 0x333333); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; L.g('cyl6', 'metal', Math.cos(a) * 1.75, 12.8, Math.sin(a) * 1.75, 0.05, 0.9, 0.05, 0x333333); }
      L.g('cyl12', 'glow:seaside', 0, 13.3, 0, 1.8, 1.6, 1.8, 0xfff2c8); L.g('cone12', 'roof', 0, 14.7, 0, 2.4, 1.4, 2.4, 0xc0392b);
      addBulb('seaside', ...L.p(0, 13.3, 0), 0xfff0c0, 1.2); addPool('seaside', x, z, 10, 0xffd090);
      return;
    }
    if (kind === 'food_court') {
      L.box('solid', 0, 1.6, 0, w, 3.2, d, 0xfff4e0);
      const n = 24; for (let i = 0; i < n; i++) { const xx = -w / 2 + (i + 0.5) * w / n; L.box('solid', xx, 1.6, d / 2 + 0.02, w / n, 3.2, 0.05, i % 2 ? 0xd7263d : 0xfff4e0); L.box('solid', xx, 1.6, -d / 2 - 0.02, w / n, 3.2, 0.05, i % 2 ? 0xd7263d : 0xfff4e0); }
      for (let k = 0; k < 4; k++) { L.box(winKey(land), -w / 2 + 5 + k * (w - 10) / 3, 1.9, d / 2 + 0.06, 3.2, 1.4, 0.04, 0x2a3442); L.box('fabric', -w / 2 + 5 + k * (w - 10) / 3, 2.9, d / 2 + 0.6, 3.8, 0.08, 1.3, 0xf4b942, 0, 0.3); }
      // big-top striped roof: hip panels
      const segs = 20; for (let i = 0; i < segs; i++) { const xx = -w / 2 + (i + 0.5) * w / segs; L.box('fabric', xx, 3.2 + 2.0, d / 4, w / segs + 0.02, 0.1, d / 2 * 1.12, i % 2 ? 0xd7263d : 0xfff4e0, 0, -Math.atan2(4.0, d / 2)); L.box('fabric', xx, 3.2 + 2.0, -d / 4, w / segs + 0.02, 0.1, d / 2 * 1.12, i % 2 ? 0xd7263d : 0xfff4e0, 0, Math.atan2(4.0, d / 2)); }
      for (const sx of [-1, 0, 1]) { L.g('cyl6', 'metal', sx * w / 3, 8.0, 0, 0.18, 2.0, 0.18, 0xd9a441); L.box('fabric', sx * w / 3 + 0.6, 8.6, 0, 1.2, 0.7, 0.04, 0xf4b942); }
      for (let i = 0; i < 60; i++) { const p = L.p(-w / 2 + i * w / 59, 3.3, d / 2 + 0.4); addBulb(land, p[0], p[1], p[2], 0xffd08a, 0.15); }
      return;
    }
    if (b.items) { // midway booth rows
      for (const it of b.items) {
        const T2 = B(it.position[0], 0, it.position[2], it.rot || 0); const aw = hex(it.awning || '#D7263D');
        T2.box('solid', 0, 1.6, -it.d / 2 + 0.15, it.w, 3.2, 0.3, 0xfff4e0); T2.box('solid', -it.w / 2 + 0.1, 1.6, 0, 0.2, 3.2, it.d, 0xfff4e0); T2.box('solid', it.w / 2 - 0.1, 1.6, 0, 0.2, 3.2, it.d, 0xfff4e0);
        T2.box('solid', 0, 0.55, it.d / 2 - 0.3, it.w - 0.2, 1.1, 0.5, aw); T2.box('solid', 0, 1.15, it.d / 2 - 0.3, it.w, 0.08, 0.7, 0xf4b942);
        T2.box('roof', 0, 3.3, 0, it.w + 0.2, 0.2, it.d + 0.2, 0x2e294e);
        for (let i = 0; i < 8; i++) T2.box('fabric', -it.w / 2 + (i + 0.5) * it.w / 8, 3.0, it.d / 2 + 0.55, it.w / 8, 0.05, 1.3, i % 2 ? 0xfff4e0 : aw, 0, 0.35);
        T2.box('glow:midway', 0, 3.55, it.d / 2 + 0.05, it.w - 0.6, 0.5, 0.06, aw);
        for (let i = 0; i < 9; i++) T2.g('sph0', 'solid', -it.w / 2 + 0.6 + (i % 5) * (it.w - 1.2) / 4, 1.6 + Math.floor(i / 5) * 0.55, -it.d / 2 + 0.55, 0.45, 0.45, 0.45, [0xf5a6c8, 0x3498db, 0xf1c40f, 0x9b59b6, 0x2ecc71, 0xe74c3c][(i + (it.position[0] | 0)) % 6]);
        for (let i = 0; i < 10; i++) { const p = T2.p(-it.w / 2 + 0.25 + i * (it.w - 0.5) / 9, 3.85, it.d / 2 + 0.12); addBulb('midway', p[0], p[1], p[2], i % 2 ? 0xffc76b : 0xffe8b0, 0.14); }
        addPool('midway', ...T2.p(0, 0, it.d / 2 + 2).filter((_, k) => k !== 1), 4.5, 0xffc070, 0.8);
      }
      return;
    }
    // ---- generic house types
    const wallCol = hex(b.wall || ({ restroom: '#B7A99A', first_aid: '#FFFFFF', ticket_booth: '#C8463A', railway_station: '#F3E6CC', frontier_building: '#A0522D', boathouse: '#FFFFFF', shop: '#E8C9A0', food_kiosk: '#F3E6CC', guest_services: '#B5563F' }[kind] || '#E0D6C4'));
    let roofCol = hex(pal.roof), trim = hex(pal.trim);
    let wc = wallCol, roofType = 'gable';
    if (b.id === 'thrill_shop') { // glass pavilion with red fins
      L.box('solid', 0, 0.15, 0, w + 0.6, 0.3, d + 0.6, 0xb9b4ae);
      L.box(winKey('thrill'), 0, h / 2, 0, w - 0.4, h - 0.6, d - 0.4, 0x37475a);
      L.box('roof', 0, h - 0.1, 0, w + 1.2, 0.5, d + 1.2, 0x1f2a44);
      for (let i = 0; i < 9; i++) L.box('ride', -w / 2 + i * w / 8, h / 2, d / 2 + 0.35, 0.18, h + 0.6, 0.9, 0xe23b2e);
      for (let i = 0; i < 6; i++) L.box('ride', -w / 2 - 0.2, h / 2, -d / 2 + i * d / 5, 0.9, h + 0.6, 0.18, 0xe23b2e);
      for (let i = 0; i < 20; i++) { const p = L.p(-w / 2 + i * w / 19, h + 0.2, d / 2 + 0.65); addBulb('thrill', p[0], p[1], p[2], 0xff6a5a, 0.12); }
      return;
    }
    if (b.id === 'thrill_food') {
      L.box('solid', 0, h / 2 - 0.2, 0, w, h - 0.4, d, 0x1f2a44); for (let i = 0; i < 12; i++) L.box('solid', -w / 2 + (i + 0.5) * w / 12, h / 2 - 0.2, d / 2 + 0.03, 0.08, h - 0.6, 0.06, 0x2d3b5c);
      L.box(winKey('thrill'), 0, 2.0, d / 2 + 0.05, w * 0.6, 1.3, 0.05, 0x2a3442); L.box('fabric', 0, 3.0, d / 2 + 0.8, w * 0.7, 0.08, 1.6, 0xf5b700, 0, 0.25);
      L.box('solid', 0, 1.0, d / 2 + 0.3, w * 0.62, 0.15, 0.6, 0xf5b700); L.box('solid', 0, h - 0.2, 0, w + 0.3, 0.4, d + 0.3, 0xf5b700);
      return;
    }
    if (kind === 'frontier_building') {
      L.box('solid', 0, h / 2, -0.5, w, h, d - 1, wallCol);
      for (let yy = 0.3; yy < h; yy += 0.35) L.box('solid', 0, yy, d / 2 - 0.98, w, 0.05, 0.02, new THREE.Color(wallCol).multiplyScalar(0.78).getHex()); // clapboard
      L.box('solid', 0, h + 1.2, d / 2 - 1.0, w, 2.4, 0.3, wallCol); L.box('solid', 0, h + 2.45, d / 2 - 0.9, w + 0.3, 0.2, 0.5, 0xf4e3c1); // false front
      L.g('gable', 'roof', 0, h, -0.5, w + 0.4, 2.4, d - 0.6, 0x5d3a1a, 0);
      L.box('roof', 0, 3.4, d / 2 + 0.6, w + 0.4, 0.15, 3.0, 0x5d3a1a, 0, 0.12); // porch roof
      for (let i = 0; i < 5; i++) L.g('cyl6', 'solid', -w / 2 + 0.3 + i * (w - 0.6) / 4, 1.7, d / 2 + 1.9, 0.18, 3.4, 0.18, 0x7b5e3b);
      L.box('solid', 0, 0.2, d / 2 + 0.6, w, 0.4, 3.0, 0x8b6b4a);
      windowRow(L, 'frontier', 1.0, d / 2 - 1.0, w - 2, Math.floor(w / 3.5), 1.0, 1.6, 0xf4e3c1);
      if (h > 7) { L.box('solid', 0, 4.4, d / 2 + 0.9, w, 0.15, 2.0, 0x8b6b4a); for (let i = 0; i < 12; i++) L.box('solid', -w / 2 + i * w / 11, 4.9, d / 2 + 1.85, 0.06, 0.9, 0.06, 0xf4e3c1); windowRow(L, 'frontier', 5.0, d / 2 - 1.0, w - 2, Math.floor(w / 3), 1.0, 1.5, 0xf4e3c1); }
      for (let i = 0; i < 8; i++) { const p = L.p(-w / 2 + i * w / 7, 3.3, d / 2 + 2.1); addBulb('frontier', p[0], p[1], p[2], 0xffb860, 0.13); }
      addPool('frontier', ...L.p(0, 0, d / 2 + 3).filter((_, k) => k !== 1), 6, 0xffb060, 0.7);
      return;
    }
    if (kind === 'ticket_booth') {
      L.box('solid', 0, 1.6, 0, w, 3.2, d, 0xc8463a); L.box('solid', 0, 0.3, 0, w + 0.2, 0.6, d + 0.2, 0xf3e6cc);
      for (const sx of [-1, 1]) { L.box(winKey('entrance'), sx * 1.2, 1.9, d / 2 + 0.03, 1.4, 1.5, 0.05, 0x2a3442); L.g('cyl12', 'solid', sx * 1.2, 2.65, d / 2 + 0.04, 1.4, 0.1, 0.8, 0xf3e6cc, 0, Math.PI / 2); }
      L.box('solid', 0, 3.35, 0, w + 0.5, 0.3, d + 0.5, 0xd9a441);
      L.g('dome', 'fabric', 0, 3.5, 0, w * 1.05, 1.8, d * 1.4, 0xf3e6cc);
      for (let i = 0; i < 8; i++) L.g('tri', 'fabric', -w / 2 + (i + 0.5) * w / 8, 3.45, d / 2 + 0.72, w / 8, 0.01, 0.35, i % 2 ? 0xc8463a : 0xf3e6cc);
      L.g('cyl6', 'metal', 0, 5.6, 0, 0.08, 1.0, 0.08, 0xd9a441); L.g('sph', 'metal', 0, 6.1, 0, 0.3, 0.3, 0.3, 0xd9a441);
      return;
    }
    if (kind === 'railway_station') {
      L.box('solid', 0, -0.3, 0, w, 0.6, d, 0xd9c9a8); L.box('solid', 0, -2.6, 0, w - 0.4, 4.6, d - 0.4, 0xb5563f);
      for (let i = 0; i < 8; i++) { L.g('cyl6', 'metal', -w / 2 + 1 + i * (w - 2) / 7, 2.0, d / 2 - 0.8, 0.2, 4.0, 0.2, 0x2f6e5a); }
      L.box('roof', 0, 4.2, 0, w + 1, 0.25, d + 1.2, 0x4e5d6c, 0, 0.08);
      for (let i = 0; i < 40; i++) L.g('tri', 'roof', -w / 2 + i * w / 39, 4.0, d / 2 + 1.1, w / 40, 0.01, 0.3, 0xf3e6cc);
      L.box('solid', 0, 1.8, -d / 2 + 1.2, w * 0.5, 3.0, 2.4, 0xf3e6cc); windowRow(L, 'entrance', 0.9, -d / 2 + 2.45, w * 0.48, 5, 0.9, 1.4, 0x2f6e5a);
      return;
    }
    if (kind === 'food_kiosk') {
      if (b.id === 'kiddie_sweets') { L.g('cyl12', 'solid', 0, 1.5, 0, 5, 3, 5, 0xf4a7b9); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; L.box('solid', Math.cos(a) * 2.45, 1.5, Math.sin(a) * 2.45, 0.3, 3, 0.2, 0xffffff, -a); }
        L.g('sph2', 'roof', 0, 3.6, 0, 6.2, 2.6, 6.2, 0xfff4f0); L.g('sph', 'ride', 0, 5.0, 0, 1.0, 1.0, 1.0, 0xe74c3c); L.box(winKey('kiddie'), 0, 1.7, 2.45, 2, 1.0, 0.3, 0x2a3442); return; }
      if (b.id === 'jungle_snacks') { L.box('solid', 0, 1.4, 0, w, 2.8, d, 0xc9a66b); L.g('cone4', 'roof', 0, 3.9, 0, w * 1.4, 2.6, d * 1.6, 0xb08d57); for (const sx of [-1, 1]) { L.g('cyl6', 'solid', sx * w * 0.7, 1.6, d / 2 + 1.4, 0.15, 3.2, 0.15, 0x7b5e3b); L.g('cone8', 'glow:jungle', sx * w * 0.7, 3.4, d / 2 + 1.4, 0.35, 0.6, 0.35, 0xff8a30); addBulb('jungle', ...L.p(sx * w * 0.7, 3.6, d / 2 + 1.4), 0xff9a40, 0.35); } return; }
      L.box('solid', 0, h / 2, 0, w, h, d, wallCol);
      for (let i = 0; i < 10; i++) L.box('solid', -w / 2 + (i + 0.5) * w / 10, h / 2, d / 2 + 0.02, w / 10 - 0.02, h, 0.04, i % 2 ? 0x2e86c1 : 0xffffff);
      L.box(winKey(land), 0, 2.0, d / 2 + 0.06, w * 0.6, 1.2, 0.04, 0x2a3442);
      L.box('fabric', 0, 3.0, d / 2 + 0.7, w * 0.8, 0.06, 1.4, hex(pal.accent), 0, 0.3);
      L.g('gable', 'roof', 0, h, 0, w + 0.4, 1.4, d + 0.4, roofCol);
      return;
    }
    // restrooms, shops, first aid, guest services, boathouse
    roofType = { boathouse: 'gable', guest_services: 'gable_front', first_aid: 'hipped', shop: 'gable' }[kind] || 'hipped';
    if (b.id === 'seaside_shop') roofType = 'dome';
    if (b.id === 'jungle_trading_post') { wc = 0xc9a66b; roofCol = 0xb08d57; }
    if (kind === 'restroom') { wc = land === 'thrill' ? 0x8a929c : land === 'frontier' ? 0x7b5e3b : land === 'kiddie' ? 0xf4d6e0 : land === 'seaside' ? 0xa8d8ea : 0xb7a99a; }
    L.box('solid', 0, h / 2, 0, w, h, d, wc);
    L.box('solid', 0, 0.25, 0, w + 0.2, 0.5, d + 0.2, new THREE.Color(wc).multiplyScalar(0.75).getHex());
    L.box('solid', 0, h - 0.15, 0, w + 0.3, 0.3, d + 0.3, trim);
    // door + windows on the front
    L.box('solid', 0, 1.2, d / 2 + 0.04, 1.4, 2.4, 0.08, 0x5a3a26);
    windowRow(L, land, 1.1, d / 2, w - 2.6, Math.max(2, Math.floor(w / 2.6)), 0.9, 1.4, trim, { shutters: kind === 'first_aid' ? 0x2f7a4f : 0 });
    if (h > 6.2) windowRow(L, land, h * 0.6, d / 2, w - 1.5, Math.max(2, Math.floor(w / 2.2)), 0.8, 1.2, trim);
    if (kind === 'first_aid') { L.box('solid', 0, h - 1.0, d / 2 + 0.06, 1.4, 1.4, 0.05, 0x2f7a4f); L.box('solid', 0, h - 1.0, d / 2 + 0.1, 0.9, 0.3, 0.04, 0xffffff); L.box('solid', 0, h - 1.0, d / 2 + 0.1, 0.3, 0.9, 0.04, 0xffffff); }
    if (kind === 'boathouse') { L.g('cyl8', 'solid', 0, h + 3.2, 0, 1.6, 1.6, 1.6, 0xffffff); L.g('cone8', 'roof', 0, h + 4.6, 0, 2.2, 1.4, 2.2, 0x1b4f72); for (let yy = 0.4; yy < h; yy += 0.4) L.box('solid', 0, yy, d / 2 + 0.01, w, 0.05, 0.02, 0xdde4ea); }
    if (roofType === 'dome') { L.g('dome', 'roof', 0, h, 0, Math.min(w, d) * 1.1, 4, Math.min(w, d) * 1.1, 0x2e86c1); }
    else roofOn(L, roofType, w, d, h, roofCol, trim);
    if (b.id === 'jungle_trading_post') for (let i = 0; i < 6; i++) L.box('solid', -w / 2 - 0.8 + (i % 3) * 0.9, 0.4 + Math.floor(i / 3) * 0.8, d / 2 + 1.2, 0.8, 0.8, 0.8, 0x9b7b4b, i);
  }
  for (const b of D.buildings) { if (b.kind === 'main_street_shop') mainStreetShop(b); else genericBuilding(b); }
  // railway bridge over the gate (girder + abutments)
  { const L = B(0, 0, 160, 0); L.box('solid', -11.5, 2.5, 0, 3, 5, 16, 0xb5563f); L.box('solid', 11.5, 2.5, 0, 3, 5, 16, 0xb5563f);
    L.box('metal', 0, 4.8, 0, 22, 0.6, 7, 0x4e5d6c); for (const sz of [-3.6, 3.6]) { L.box('metal', 0, 5.6, sz, 22, 1.6, 0.25, 0x2f6e5a); for (let i = 0; i < 12; i++) L.box('metal', -10 + i * 20 / 11, 5.6, sz * 1.03, 0.15, 1.5, 0.1, 0x264d3d); } }

  flush();
  return { M, root, groups, G, put, flush, cmp, beamM, frame, mat, GEO, persons, animators, addBulb, bulbList, pools, addPool, pointLights, addPoint, landOf, inDetail, MAT, LP, LANDS };
}
