// Trees (species-shaped clustered crowns, LOD by distance to the shot focus), shrubs, flower beds, sky.
import * as THREE from 'three';
import { hex, T, GEO, Kit, MG, hash, rng, DynKit } from './util.js';

export function buildNature(ctx) {
  const { D, mat, root, pixel } = ctx;
  const grp = new THREE.Group(); grp.name = 'nature'; root.add(grp);
  const sp = D.planting.species; const L = D.planting.trees.list;
  const near = ctx.lod || (() => true);
  // crown prototypes in unit space (height 1, crown radius 1 in xz), vertex colour = shade multiplier
  function proto(id, variant, hi) {
    const mg = new MG(); const r = rng(hash(id.length * 31 + variant, 5) * 1e9); const S = hi ? GEO.sph : new THREE.IcosahedronGeometry(0.5, 0);
    const blob = (x, y, z, sx, sy, sz, sh = 1) => mg.add(S, T(x, y, z, r() * 6, sx, sy, sz), new THREE.Color().setScalar(sh * (0.86 + r() * 0.22)));
    switch (id) {
      case 'oak': case 'maple_red': case 'plane': {
        const tall = id === 'plane' ? 1.25 : 1; blob(0, 0.66, 0, 1.6, 0.62 * tall, 1.6, 0.95);
        const n = hi ? 6 : 3; for (let k = 0; k < n; k++) { const a = k / n * 6.283 + r(); const rr = 0.45 + r() * 0.2; blob(Math.cos(a) * rr, 0.56 + r() * 0.3, Math.sin(a) * rr, 1.0 + r() * 0.3, 0.42 * tall, 1.0 + r() * 0.3, 0.85 + r() * 0.3); }
        blob(0.1, 0.88, -0.1, 1.0, 0.3, 1.0, 1.15); break;
      }
      case 'lime_clipped': { const rb = new THREE.BoxGeometry(1, 1, 1, 5, 5, 5); const pp = rb.attributes.position; const v = new THREE.Vector3(); for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i); const sp = v.clone().normalize().multiplyScalar(0.62); v.lerp(sp, 0.45); pp.setXYZ(i, v.x, v.y, v.z); } rb.computeVertexNormals(); mg.add(rb, T(0, 0.7, 0, r(), 1.7, 0.62, 1.7), new THREE.Color().setScalar(1)); blob(0.2, 0.95, 0.1, 0.9, 0.18, 0.9, 1.12); break; }
      case 'pine': { const n = hi ? 5 : 3; for (let k = 0; k < n; k++) { const a = k * 2.4 + r(); blob(Math.cos(a) * 0.45 * (k ? 1 : 0), 0.72 + k * 0.06, Math.sin(a) * 0.45 * (k ? 1 : 0), 1.3, 0.18, 1.3, 0.9 + k * 0.05); } break; }
      case 'fir': { const tiers = hi ? 4 : 2; for (let k = 0; k < tiers; k++) { const y0 = 0.22 + k * 0.62 / tiers; mg.add(new THREE.ConeGeometry(0.5, 1, hi ? 9 : 6), T(0, y0 + 0.24, 0, r(), 2.1 * (1 - k / (tiers + 0.6)), 0.5, 2.1 * (1 - k / (tiers + 0.6))), new THREE.Color().setScalar(0.85 + k * 0.07)); } break; }
      case 'cypress': blob(0, 0.55, 0, 2.0, 0.95, 2.0, 1); if (hi) blob(0, 0.75, 0, 1.6, 0.55, 1.6, 1.1); break;
      case 'palm': { const n = hi ? 10 : 6; for (let k = 0; k < n; k++) { const a = k / n * 6.283 + r() * 0.3; const m = T(0, 0.95, 0, -a + Math.PI / 2, 1, 1, 1, 0, 0).multiply(T(0, 0, 0.55, 0, 0.35, 0.06, 1.1, 0.35 + r() * 0.3)); mg.add(GEO.sph, m, new THREE.Color().setScalar(0.9 + r() * 0.2)); } blob(0, 0.95, 0, 0.35, 0.08, 0.35, 0.8); break; }
      case 'banana': { for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; mg.add(GEO.sph, T(0, 0.55, 0, a, 1, 1, 1).multiply(T(0, 0.2, 0.35, 0, 0.4, 0.12, 0.9, -0.7 - r() * 0.3)), new THREE.Color().setScalar(0.9 + r() * 0.25)); } break; }
      case 'jungle_broadleaf': { blob(0, 0.86, 0, 2.0, 0.22, 2.0, 1.1); blob(0.3, 0.68, 0.2, 1.6, 0.2, 1.6, 0.9); blob(-0.3, 0.55, -0.2, 1.3, 0.2, 1.3, 0.8); if (hi) for (let k = 0; k < 6; k++) { const a = k * 1.05; mg.add(GEO.box, T(Math.cos(a) * 0.8, 0.55, Math.sin(a) * 0.8, 0, 0.02, 0.5, 0.02), new THREE.Color().setScalar(0.7)); } break; }
      case 'birch': blob(0, 0.68, 0, 1.4, 0.55, 1.4, 1.05); blob(0.3, 0.5, 0.2, 0.9, 0.35, 0.9, 0.95); blob(-0.25, 0.82, -0.1, 0.9, 0.3, 0.9, 1.1); break;
      case 'cherry_blossom': { blob(0, 0.7, 0, 1.9, 0.5, 1.9, 1); const n = hi ? 6 : 3; for (let k = 0; k < n; k++) { const a = k / n * 6.283 + r(); blob(Math.cos(a) * 0.6, 0.66 + r() * 0.2, Math.sin(a) * 0.6, 0.9, 0.35, 0.9, 0.9 + r() * 0.3); } break; }
      case 'willow': { blob(0, 0.8, 0, 1.8, 0.42, 1.8, 1.05); const n = hi ? 14 : 8; for (let k = 0; k < n; k++) { const a = k / n * 6.283 + r() * 0.3; const rr = 0.72 + r() * 0.12; mg.add(S, T(Math.cos(a) * rr, 0.5 - r() * 0.08, Math.sin(a) * rr, -a, 0.16, 0.62 + r() * 0.15, 0.32, 0, (r() - 0.5) * 0.2), new THREE.Color().setScalar(0.8 + r() * 0.25)); } break; }
      default: blob(0, 0.65, 0, 1.8, 0.6, 1.8, 1);
    }
    return mg.geo();
  }
  const MC = mat({ vc: true, mot: pixel ? 0 : 0.22, frag: pixel ? `{ diffuseColor.rgb *= 0.92 + 0.16*step(.5, h21(floor(p.xz*1.6+p.y*1.3))); }` : `{ float l = vn(p.xz*2.2 + p.y*2.5); diffuseColor.rgb *= 0.88 + 0.24*l; }` });
  const MCd = mat({ vc: true, side: THREE.DoubleSide, mot: 0.2 });
  const MS_ = mat({ mot: pixel ? 0 : 0.22, frag: pixel ? '' : `{ float l = vn(p.xz*2.2 + p.y*2.5); diffuseColor.rgb *= 0.88 + 0.24*l; }` });
  const protos = {}; const P = (id, v, hi) => { const k = id + v + hi; return protos[k] || (protos[k] = proto(id, v, hi)); };
  const K0 = new Kit(grp); const DK = new DynKit(grp); let popT = null, piv = null;
  const KH = new Kit(grp), KL = new Kit(grp); let lodPair = false;
  const K = { add: (g, m, mm, c, gLo) => { if (popT != null) return DK.add(gLo || g, m, mm, c, popT, piv); if (gLo && !ctx.pixel) { KH.add(g, m, mm, c); KL.add(gLo, m, mm, c); } else K0.add(gLo || g, m, mm, c); },
    build: s => { K0.build(s); DK.build(); ctx.animators.push(t => DK.update(t)); const hi = KH.build(s, 50), lo = KL.build(s, 50);
      const R2 = (ctx.treeLodR || 120) ** 2;
      ctx.animators.push(() => { const cp = ctx.camPos; if (!cp) return; for (let i = 0; i < hi.length; i++) { const c = hi[i].boundingSphere.center; const d2 = (c.x - cp[0]) ** 2 + (c.z - cp[2]) ** 2 + cp[1] ** 2 * 0.5; const h = d2 < R2; hi[i].visible = h; lo[i].visible = !h; } }); } };
  const trunkG = new THREE.CylinderGeometry(0.35, 0.5, 1, 7); trunkG.translate(0, 0.5, 0);
  for (let i = 0; i < L.length; i++) {
    const [x, gy, z, si, h, cr, cv] = L[i]; const s = sp[si]; const id = s.id; const hi = near(x, z) ? 1 : 0; const v = i % 3;
    if (ctx.treeFilter && !ctx.treeFilter(x, z, i)) continue;
    popT = ctx.treePop ? ctx.treePop(x, z, i, id) : null; piv = [x, gy, z];
    const col = hex(s.colors[cv % s.colors.length]);
    const th = id === 'palm' ? h * 0.95 : id === 'pine' ? h * 0.7 : id === 'fir' ? h * 0.3 : id === 'lime_clipped' ? h * 0.45 : h * 0.5;
    const tw = Math.max(0.18, h * (id === 'oak' ? 0.045 : 0.03));
    const tcol = id === 'birch' ? 0xeee8dc : id === 'plane' ? 0x9a8a70 : id === 'palm' ? 0x8b7355 : 0x5e4330;
    if (id === 'palm') { for (let k = 0; k < 4; k++) K.add(trunkG, MS_, T(x + Math.sin(k * 0.35) * 0.3 * k, gy + k * th / 4, z, 0, tw * (1 - k * 0.12), th / 4 + 0.05, tw * (1 - k * 0.12), 0, 0.12 * k), tcol); }
    else if (id !== 'banana') K.add(trunkG, MS_, T(x, gy, z, 0, tw, th, tw), tcol);
    const crz = id === 'willow' || id === 'cherry_blossom' ? cr : cr; const yaw = hash(i, 9) * 6.283;
    const m = T(x, gy, z, yaw, crz, h, crz);
    K.add(P(id, v, 1), id === 'willow' ? MCd : MC, m, col, P(id, v, 0));
  }
  popT = null;
  // shrubs in shrub zones (scatter along polygon interiors)
  for (let zi = 0; zi < D.planting.shrub_zones.length; zi++) {
    const poly = D.planting.shrub_zones[zi]; const ring = poly[0] && Array.isArray(poly[0][0]) ? poly[0] : poly; if (!ring || ring.length < 3) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const r = rng(zi * 131 + 7); const area = (x1 - x0) * (z1 - z0); const n = Math.min(400, area / 6);
    for (let k = 0; k < n; k++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0); if (!pip(x, z, ring)) continue; const s = 0.8 + r() * 1.4; K.add(GEO.sph, MS_, T(x, s * 0.35, z, r() * 6, s * 1.4, s, s * 1.4), [0x4f7f3a, 0x3f6e33, 0x5e8c40, 0x6a9a45][Math.floor(r() * 4)]);
      if (r() < 0.25) K.add(GEO.sph, MS_, T(x + 0.3, s * 0.7, z, 0, s * 0.35, s * 0.3, s * 0.35), [0xe74c3c, 0xf5a6c8, 0xffffff, 0xf1c40f][Math.floor(r() * 4)]); }
  }
  // topiary shapes (rabbit, elephant ...) as sphere sculptures
  for (const tp of D.planting.topiary) { const [x, , z] = tp.position; const h = tp.height; const c = 0x2e6b3a;
    K.add(GEO.cyl6, MS_, T(x, 0.3, z, 0, 1.4, 0.6, 1.4), 0x8b5a2b); K.add(GEO.sph, MS_, T(x, h * 0.4, z, 0, h * 0.7, h * 0.6, h * 0.55), c); K.add(GEO.sph, MS_, T(x, h * 0.85, z + h * 0.1, 0, h * 0.4, h * 0.38, h * 0.38), c);
    if (tp.shape === 'rabbit') { K.add(GEO.sph, MS_, T(x - 0.1, h * 1.15, z + 0.1, 0, 0.18, 0.55, 0.12), c); K.add(GEO.sph, MS_, T(x + 0.15, h * 1.15, z + 0.1, 0, 0.18, 0.55, 0.12), c); }
    else if (tp.shape === 'elephant') { K.add(GEO.cyl6, MS_, T(x, h * 0.55, z + h * 0.4, 0, 0.25, h * 0.6, 0.25, 0.5), c); }
    else K.add(GEO.sph, MS_, T(x, h * 1.1, z, 0, h * 0.25, h * 0.25, h * 0.25), c); }
  K.build(true);
  function pip(x, z, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) ins = !ins; } return ins; }
}

// painted sky dome (gouache) — rendered as a backdrop sphere that follows the camera
export function makeSky(ctx) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: ctx.MS.U.uTime, uGrey: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w*0.99999; }`,
    fragmentShader: `varying vec3 vD; uniform float uTime; uniform float uGrey;
      float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<6;i++){ s+=a*vn(p); p=p*2.02+vec2(1.7,9.2); a*=.5; } return s; }
      void main(){
        vec3 d = normalize(vD); float el = d.y; float az = atan(d.z, d.x);
        vec3 zen = vec3(.42,.63,.86), mid = vec3(.66,.80,.93), hor = vec3(.93,.92,.86);
        vec3 c = mix(hor, mid, smoothstep(0.0, .22, el)); c = mix(c, zen, smoothstep(.2, .75, el));
        // painted wash strokes
        vec2 sp = vec2(az*6., el*9.); float st = vn(vec2(sp.x*2.5, sp.y*14.)) - .5; c *= 1. + st*.05;
        // clouds: flattened fbm cumulus, lit from the south-west (sun az 225)
        vec2 cp = d.xz/(d.y+.12)*1.6 + vec2(uTime*.01, 0.); float n = fbm(cp*.55);
        float cl = smoothstep(.52, .7, n) * smoothstep(-.02, .12, el);
        float lit = fbm(cp*.55 + vec2(.06,-.06)); float shade = clamp((n - lit)*6. + .5, 0., 1.);
        vec3 ccol = mix(vec3(1.,.98,.93), vec3(.72,.72,.84), shade*.8);
        float edge = smoothstep(.52,.58,n) - smoothstep(.58,.66,n); ccol = mix(ccol, vec3(.95,.86,.80), edge*.3);
        c = mix(c, ccol, cl*.92);
        // distant painted hills
        float hz = .035 + .025*fbm(vec2(az*3., 1.)) + .015*vn(vec2(az*14.,0.));
        float hill = smoothstep(hz+.004, hz-.004, el) * step(-.2, el);
        vec3 hc = mix(vec3(.55,.66,.70), vec3(.62,.72,.74), vn(vec2(az*20., el*60.))); c = mix(c, hc, hill);
        float lum = dot(c, vec3(.3,.59,.11)); vec3 g = vec3(lum*.8+.06) - cl*vec3(.12,.11,.09)*shade + vec3(.0,.01,.02); c = mix(c, g, uGrey*.92);
        gl_FragColor = vec4(pow(c, vec3(2.2)), 1.);
      }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), m); s.frustumCulled = false; s.renderOrder = -10; return s;
}
