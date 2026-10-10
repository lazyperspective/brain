// The magic: bloom wave vegetation, the rainbow sneeze plume & ribbons, rainbow rain, petals, waterfalls, motes, small story FX.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, paint, softDot, cloudTexture } from './mats.js';
import { mulberry32, V, clamp, lerp, inv, smooth, bump, easeOut } from './util.js';
import { L } from './city.js';

const ORIGIN = V(0.96, 0.6, 0.26);      // where Puff sneezes (balcony)
const WAVE_START = 22.05, WAVE_SPEED = 46; // bloom wave front: r = (t - start) * speed
const delayAt = (p, jitter = 0) => WAVE_START + 0.25 + p.distanceTo(ORIGIN) / WAVE_SPEED + jitter;

// Growth-enabled standard material for instanced vegetation
function growMat(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.55, metalness: 0, side: THREE.DoubleSide, emissive: opts.emissive ?? 0x000000, emissiveIntensity: 1 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = G.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aDelay; attribute float aScale; uniform float uTime;
        float elasticOut(float t){ return t<=0.0?0.0:(t>=1.0?1.0: pow(2.0,-9.0*t)*sin((t*9.0-0.75)*2.094)+1.0); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float gk = clamp((uTime - aDelay) / ${(opts.growTime ?? 0.55).toFixed(2)}, 0.0, 1.0);
        float gs = elasticOut(gk) * aScale;
        float sw = sin(uTime * 2.0 + aDelay * 13.0) * 0.08 * gk;
        transformed = vec3(transformed.x*cos(sw) - transformed.y*sin(sw), transformed.x*sin(sw) + transformed.y*cos(sw), transformed.z) * gs;`);
  };
  m.customProgramCacheKey = () => 'grow' + (opts.growTime ?? 0.55);
  return m;
}

function petalFlowerGeo(petals = 5, lo = true) {
  const parts = [];
  for (let i = 0; i < petals; i++) {
    const g = lo ? new THREE.CircleGeometry(0.5, 6).rotateX(-Math.PI / 2) : new THREE.SphereGeometry(0.5, 8, 5); g.scale(0.42, lo ? 1 : 0.08, 0.75); g.translate(0, 0.02, 0.52);
    g.rotateX(-0.35); g.rotateY(i / petals * Math.PI * 2);
    parts.push(g);
  }
  const m = mergeGeometries(parts.map(p => p.toNonIndexed()));
  return m;
}
function leafGeo() { const g = new THREE.CircleGeometry(0.5, 5).rotateX(-Math.PI / 2); g.scale(0.35, 1, 1.0); g.translate(0, 0, 0.5); g.rotateX(-0.5); return g; }

export function buildFX(scene, w) {
  const fx = {};
  const r = mulberry32(4242);
  const city = w.city;

  // ---------------- bloom vegetation ----------------
  const flowerItems = [], leafItems = [], centerItems = [];
  const petalCols = [0xff7eb6, 0xff9a8a, 0xffd36e, 0xf7f0ff, 0xc98cff, 0xff6f9f, 0xffb3d9, 0x8fd8ff];
  const addCluster = (p, n, s, delay0) => {
    const cnt = Math.max(2, Math.round(n * s));
    for (let i = 0; i < cnt; i++) {
      const a = r() * 6.28, d = r() * 0.6 * s;
      const pp = V(p.x + Math.cos(a) * d, p.y + r() * 0.08 * s, p.z + Math.sin(a) * d);
      const sz = (0.12 + r() * 0.16) * s * (r() < 0.1 ? 2.2 : 1);
      const dl = delay0 + r() * 0.5;
      const rot = new THREE.Euler((r() - 0.5) * 0.6, r() * 6.28, (r() - 0.5) * 0.6);
      flowerItems.push({ p: pp, s: sz, d: dl, rot, c: petalCols[Math.floor(r() * petalCols.length)] });
      centerItems.push({ p: pp.clone().add(V(0, 0.03 * sz / 0.2, 0)), s: sz * 0.22, d: dl, rot, c: 0xffd75a });
      for (let k = 0; k < 2; k++) leafItems.push({ p: pp.clone().add(V((r() - 0.5) * 0.1, -0.01, (r() - 0.5) * 0.1)), s: sz * (1.2 + r() * 0.8), d: dl - 0.1, rot: new THREE.Euler((r() - 0.5) * 0.4, r() * 6.28, 0), c: [0x3fae5a, 0x5cc46a, 0x2f9a6e, 0x7fd36a][Math.floor(r() * 4)] });
    }
  };
  for (const sp of city.bloomSpots) {
    const dist = sp.p.distanceTo(ORIGIN);
    const n = dist < 8 ? 7 : dist < 40 ? 5 : 3;
    addCluster(sp.p, n, sp.s * (dist < 6 ? 0.7 : 1.0) * (1 + dist * 0.004), delayAt(sp.p, r() * 0.3));
  }
  // vines (tubes revealed by growth) + their blossoms
  const vineGeos = [];
  for (const v of city.vineCurves) {
    const g = new THREE.TubeGeometry(v.curve, 60, v.rad, 5);
    const start = v.curve.getPointAt(0);
    const d0 = delayAt(start, r() * 0.3);
    const n = g.attributes.position.count; const arr = new Float32Array(n).fill(d0);
    g.setAttribute('aDelay', new THREE.BufferAttribute(arr, 1));
    vineGeos.push(g);
    for (let i = 1; i < 26; i++) {
      const u = i / 26; const p = v.curve.getPointAt(u);
      const dl = d0 + u * 1.8;
      leafItems.push({ p, s: v.rad * 6 * (0.8 + r() * 0.6), d: dl, rot: new THREE.Euler(r() * 3, r() * 6.28, r() * 3), c: [0x3fae5a, 0x5cc46a, 0x2f9a6e][Math.floor(r() * 3)] });
      if (r() < 0.5) { const sz = v.rad * (2.5 + r() * 2.5); const rot = new THREE.Euler(r() * 3, r() * 6.28, r() * 3); const c = petalCols[Math.floor(r() * petalCols.length)]; flowerItems.push({ p: p.clone(), s: sz, d: dl + 0.1, rot, c }); centerItems.push({ p: p.clone(), s: sz * 0.25, d: dl + 0.1, rot, c: 0xffd75a }); }
    }
  }
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x3f9a4e, roughness: 0.6 });
  vineMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = G.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aDelay; varying float vGrowU; varying float vDelay;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrowU = uv.x; vDelay = aDelay;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying float vGrowU; varying float vDelay;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vGrowU > clamp((uTime - vDelay) / 1.8, 0.0, 1.0)) discard;');
  };
  if (vineGeos.length) {
    const vm = new THREE.Mesh(mergeGeometries(vineGeos.map(g => { g.deleteAttribute('normal'); g.computeVertexNormals(); return g; })), vineMat);
    vm.castShadow = true; vm.frustumCulled = false; scene.add(vm); fx.vines = vm;
  }
  const mkInst = (geo, mat, items) => {
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    const dl = new Float32Array(items.length), sc = new Float32Array(items.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    items.forEach((it, i) => { q.setFromEuler(it.rot); m4.compose(it.p, q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(it.c)); dl[i] = it.d; sc[i] = it.s; });
    geo.setAttribute('aDelay', new THREE.InstancedBufferAttribute(dl, 1));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(sc, 1));
    im.frustumCulled = false; im.castShadow = false; scene.add(im); return im;
  };
  fx.flowers = mkInst(petalFlowerGeo(), growMat(0xffffff, { emissive: 0x2a0a18, roughness: 0.5 }), flowerItems);
  fx.centers = mkInst(new THREE.IcosahedronGeometry(1, 0), growMat(0xffffff, { emissive: 0x332200 }), centerItems);
  fx.leaves = mkInst(leafGeo(), growMat(0xffffff, { roughness: 0.6 }), leafItems);
  fx.counts = { flowers: flowerItems.length, leaves: leafItems.length };

  // flowers on the vendor's hat & the dangling guard's helmet
  const hatFlowers = new THREE.Group();
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; const f = new THREE.Mesh(petalFlowerGeo(6, false), new THREE.MeshStandardMaterial({ color: petalCols[i % 6], roughness: 0.5, side: THREE.DoubleSide, emissive: 0x220814 })); f.position.set(Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55); f.scale.setScalar(0.13); f.rotation.set(0.3, -a, 0); hatFlowers.add(f); }
  const big = new THREE.Mesh(petalFlowerGeo(7, false), new THREE.MeshStandardMaterial({ color: 0xff7eb6, roughness: 0.5, side: THREE.DoubleSide, emissive: 0x330a1a })); big.position.y = 0.4; big.scale.setScalar(0.3); hatFlowers.add(big);
  w.P.vendor.hat.add(hatFlowers); fx.hatFlowers = hatFlowers;
  const helm = new THREE.Mesh(petalFlowerGeo(6, false), new THREE.MeshStandardMaterial({ color: 0xffd36e, roughness: 0.5, side: THREE.DoubleSide, emissive: 0x332200 })); helm.position.y = 0.3; helm.scale.setScalar(0.18);
  const helmStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 5), new THREE.MeshStandardMaterial({ color: 0x4f9a4e })); helmStem.position.y = 0.23;
  w.P.guards[1].head.add(helm, helmStem); fx.helm = [helm, helmStem];
  const noodleFl = new THREE.Group(); for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(petalFlowerGeo(5, false), new THREE.MeshStandardMaterial({ color: petalCols[(i + 2) % 8], side: THREE.DoubleSide, emissive: 0x220814 })); f.position.set(Math.cos(i * 1.3) * 0.12, 0.2 + i * 0.07, Math.sin(i * 1.3) * 0.12); f.scale.setScalar(0.08); noodleFl.add(f); }
  w.P.noodle.noodles.add(noodleFl); fx.noodleFl = noodleFl;

  // ---------------- rainbow sneeze plume (GPU particles) ----------------
  const NP = 4500;
  const pg = new THREE.BufferGeometry();
  const seed = new Float32Array(NP * 4);
  for (let i = 0; i < NP; i++) seed.set([r(), r(), r(), r()], i * 4);
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const plumeMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: -1 }, uOrigin: { value: ORIGIN.clone() }, uTex: { value: softDot(64, 0.15) }, uScale: { value: 1080 } },
    vertexShader: `
      attribute vec4 aSeed; uniform float uT; uniform vec3 uOrigin; uniform float uScale; varying vec3 vC; varying float vA;
      vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0, 1.0); }
      void main(){
        float tau = uT - aSeed.w * 0.9;               // staggered emission
        float alive = step(0.0, tau);
        tau = max(tau, 0.0);
        float ang = aSeed.x * 6.2831;
        // jet: rapid rise that decelerates, then spreads into a canopy
        float H = 26.0 + aSeed.y * 40.0;
        float h = H * (1.0 - exp(-tau * (2.2 + aSeed.z * 1.5)));
        float spread = (0.25 + aSeed.y * 0.9) * h * 0.35 + aSeed.z * 0.4 + pow(max(tau - 0.6, 0.0), 1.3) * (14.0 + aSeed.z * 30.0);
        vec3 p = uOrigin + vec3(cos(ang) * spread, h - pow(max(tau - 1.4, 0.0), 2.0) * 3.0, sin(ang) * spread);
        p.x += sin(tau * 3.0 + aSeed.z * 20.0) * 0.6 * tau; p.z += cos(tau * 2.7 + aSeed.y * 20.0) * 0.6 * tau;
        vC = hue(fract(aSeed.x + h * 0.004)) * 1.2 + 0.05;
        vA = alive * smoothstep(0.0, 0.05, tau) * (1.0 - smoothstep(2.0, 4.5, tau));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((0.05 + aSeed.z * 0.12 + h * 0.03) * uScale / -mv.z, 1.0, 48.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA;
      void main(){ float a = texture2D(uTex, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC * 0.42 * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  fx.plume = new THREE.Points(pg, plumeMat); fx.plume.frustumCulled = false; scene.add(fx.plume);

  // rainbow ribbons of light: 7 bands that shoot up then arc over the city
  fx.ribbons = [];
  const bandCols = [0xff4d4d, 0xff9a3d, 0xffe14d, 0x5fe36b, 0x4dc3ff, 0x6a6aff, 0xc86bff];
  const dirs = [0.3, 1.6, 2.5, 3.4, 4.3, 5.4];
  dirs.forEach((dir, j) => {
    const reach = 70 + r() * 70, apex = 34 + r() * 22;
    for (let b = 0; b < 7; b++) {
      const off = (b - 3) * 0.55;
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const rad = reach * Math.pow(u, 1.4);
        const y = ORIGIN.y + apex * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.5) - Math.pow(Math.max(0, u - 0.6), 2) * 120;
        const side = V(-Math.sin(dir), 0, Math.cos(dir)).multiplyScalar(off * (0.3 + u * 2.0));
        pts.push(V(ORIGIN.x + Math.cos(dir) * rad, y + off * u * 1.5, ORIGIN.z + Math.sin(dir) * rad).add(side));
      }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.35 + 0.0 * b, 4);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uK: { value: 0 }, uFade: { value: 1 }, uC: { value: new THREE.Color(bandCols[b]) } },
        vertexShader: `varying vec2 vUv; varying float vF; void main(){ vUv = uv; float tp = 0.06 + 0.94 * smoothstep(0.0, 0.22, uv.x);
            vec3 p = position - normal * 0.35 * (1.0 - tp); vec4 mv = modelViewMatrix * vec4(p,1.0);
            vF = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
            gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uK; uniform float uFade; uniform vec3 uC; varying vec2 vUv; varying float vF;
          void main(){ float head = smoothstep(uK, uK - 0.08, vUv.x); if (vUv.x > uK) discard;
            float glow = 1.0 + 3.0 * smoothstep(uK - 0.06, uK, vUv.x);
            gl_FragColor = vec4(uC * glow * 0.7 * uFade * (0.35 + 0.65 * vF) * smoothstep(0.0, 0.12, vUv.x), 1.0); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; scene.add(m);
      fx.ribbons.push({ m, delay: j * 0.06 + b * 0.015 });
    }
  });
  // shockwave ring of colored vapor
  fx.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.25, 8, 64), new THREE.MeshBasicMaterial({ color: 0xfff0ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  fx.ring.rotation.x = Math.PI / 2; scene.add(fx.ring);
  // rainbow-tinted cloud canopy that forms above the city
  fx.canopy = [];
  const tints = [0xffc0d8, 0xffe0b0, 0xd0f0c0, 0xc0e0ff, 0xe0c8ff, 0xfff0c0];
  for (let i = 0; i < 26; i++) {
    const a = r() * 6.28, d = 10 + r() * 90;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(300 + i, 512, 320, { top: [255, 250, 252], mid: [255, 205, 230], bot: [200, 180, 240] }), color: tints[i % tints.length], transparent: true, opacity: 0, depthWrite: false, fog: false }));
    sp.position.set(ORIGIN.x + Math.cos(a) * d, 52 + r() * 22, ORIGIN.z + Math.sin(a) * d); sp.userData = { d, a, base: 40 + r() * 50 };
    scene.add(sp); fx.canopy.push(sp);
  }

  // ---------------- rainbow rain (near & far volumes) ----------------
  const mkRain = (n, box, len, alpha, far) => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 2 * 3), sd = new Float32Array(n * 2 * 4);
    for (let i = 0; i < n; i++) { const s = [r(), r(), r(), r()]; sd.set(s, i * 8); sd.set(s, i * 8 + 4); pos.set([0, 0, 0, 0, 1, 0], i * 6); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: G.uTime, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uLen: { value: len }, uAmt: { value: 0 }, uFar: { value: far ? 1 : 0 }, uR: { value: 0 } },
      vertexShader: `attribute vec4 aSeed; uniform float uT, uBox, uLen, uAmt, uFar, uR; uniform vec3 uCam; varying vec3 vC; varying float vA;
        vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0, 1.0); }
        void main(){
          float sp = 9.0 + aSeed.w * 6.0;
          vec3 p = aSeed.xyz * uBox; p.y -= uT * sp * (uFar > 0.5 ? 4.0 : 1.0);
          vec3 base = uFar > 0.5 ? vec3(-10.0, -40.0, -10.0) : uCam - vec3(uBox*0.5);
          p = mod(p - base, uBox) + base;
          if (uFar > 0.5) { p.y = p.y * 1.0; }
          p.y += position.y * uLen; p.x += position.y * uLen * 0.08;
          float rr = length(p.xz - vec2(${ORIGIN.x.toFixed(2)}, ${ORIGIN.z.toFixed(2)}));
          vA = uAmt * (uFar > 0.5 ? smoothstep(uR, uR - 30.0, rr) : 1.0) * (0.4 + 0.6 * aSeed.w);
          vC = hue(fract(aSeed.x * 3.0 + aSeed.z)) * 0.8 + 0.45;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uFar; varying vec3 vC; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(vC * vA * (uFar > 0.5 ? 0.9 : 1.6), vA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ls = new THREE.LineSegments(g, mat); ls.frustumCulled = false; scene.add(ls); return ls;
  };
  fx.rainNear = mkRain(5000, 14, 0.35, 1, false);
  fx.rainFar = mkRain(16000, 240, 3.5, 1, true);

  // ---------------- petals swirling around the camera ----------------
  const NPE = 900;
  const petalGeo = new THREE.PlaneGeometry(0.06, 0.04);
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6, emissive: 0x331020 });
  fx.petals = new THREE.InstancedMesh(petalGeo, petalMat, NPE); fx.petals.frustumCulled = false;
  fx.petalSeeds = [];
  for (let i = 0; i < NPE; i++) { fx.petals.setColorAt(i, new THREE.Color(petalCols[i % petalCols.length])); fx.petalSeeds.push([r(), r(), r(), r()]); }
  scene.add(fx.petals);

  // ---------------- sun motes ----------------
  const NM = 700; const mg = new THREE.BufferGeometry(); const ms = new Float32Array(NM * 4); for (let i = 0; i < NM * 4; i++) ms[i] = r();
  mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NM * 3), 3)); mg.setAttribute('aSeed', new THREE.BufferAttribute(ms, 4));
  fx.motes = new THREE.Points(mg, new THREE.ShaderMaterial({
    uniforms: { uT: G.uTime, uCam: { value: new THREE.Vector3() }, uBox: { value: 6 }, uTex: { value: softDot(32) }, uAmt: { value: 1 }, uBloom: G.uBloom },
    vertexShader: `attribute vec4 aSeed; uniform float uT, uBox, uBloom; uniform vec3 uCam; varying float vA; varying vec3 vC;
      void main(){ vec3 p = aSeed.xyz * uBox + vec3(sin(uT*0.3 + aSeed.w*30.0), uT*0.05, cos(uT*0.25+aSeed.x*20.0)) * 0.4;
        vec3 base = uCam - vec3(uBox*0.5); p = mod(p - base, uBox) + base;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp(18.0 / -mv.z, 1.0, 10.0);
        vA = (0.25 + 0.5 * aSeed.w) * smoothstep(0.2, 1.0, -mv.z);
        vC = mix(vec3(1.0, 0.85, 0.6), 0.6 + 0.4*cos(6.28*(aSeed.w + vec3(0.0,0.33,0.67))), uBloom);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uAmt; varying float vA; varying vec3 vC; void main(){ float a = texture2D(uTex, gl_PointCoord).a * vA * uAmt; gl_FragColor = vec4(vC * a * 1.5, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  fx.motes.frustumCulled = false; scene.add(fx.motes);

  // ---------------- burst particles (dust, sparkles, sparks) ----------------
  const mkBurst = (n, color, tex) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.05, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    p.frustumCulled = false; p.userData.seeds = Array.from({ length: n }, () => [r(), r(), r(), r()]); scene.add(p); return p;
  };
  fx.sparkle = mkBurst(160, 0xfff4c8, softDot(32, 0.3));
  fx.sparks = mkBurst(120, 0xffa040, softDot(32, 0.4));
  fx.dust = mkBurst(60, 0xd8b090, softDot(32)); fx.dust.material.blending = THREE.NormalBlending; fx.dust.material.opacity = 0.5;
  // mist wisps drifting past Pip (S2a)
  fx.mist = [];
  for (let i = 0; i < 4; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(700 + i, 256, 160), transparent: true, opacity: 0.0, depthWrite: false })); sp.scale.set(0.7, 0.4, 1); scene.add(sp); fx.mist.push(sp); }

  // ---------------- waterfalls that appear after the rain ----------------
  fx.falls = [];
  const fallMat = (dl) => new THREE.ShaderMaterial({
    uniforms: { uT: G.uTime, uD: { value: dl } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uT, uD; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5); }
      void main(){ float grow = clamp((uT - uD) / 1.2, 0.0, 1.0); if (1.0 - vUv.y > grow) discard;
        float s = h(vec2(floor(vUv.x * 24.0), 0.0)); float streak = fract(vUv.y * 3.0 + uT * (1.2 + s) + s);
        float a = (0.35 + 0.65 * smoothstep(0.3, 1.0, streak)) * smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x) * smoothstep(0.0, 0.2, vUv.y);
        vec3 c = mix(vec3(0.7, 0.92, 1.0), vec3(1.0), streak);
        gl_FragColor = vec4(c * a * 1.4, a); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const fallSpots = city.towers.filter(t => Math.hypot(t.x, t.z) < 120).slice(0, 14);
  for (const tw of fallSpots) {
    const a = r() * 6.28; const x = tw.x + Math.cos(a) * (tw.rad + 0.3), z = tw.z + Math.sin(a) * (tw.rad + 0.3);
    const y0 = tw.top * (0.4 + r() * 0.4) - 4; const hgt = 30 + r() * 30;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2 + r() * 1.8, hgt), fallMat(delayAt(V(x, y0, z), 0.6)));
    p.position.set(x, y0 - hgt / 2, z); p.rotation.y = -a + Math.PI / 2; scene.add(p); fx.falls.push(p);
  }
  // little gutter stream off Pip's balcony
  { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 6), fallMat(WAVE_START + 0.6)); p.position.set(-0.08, -3.1, -1.0); p.rotation.y = Math.PI / 2; scene.add(p); fx.falls.push(p); }

  // ---------------- title card ----------------
  return fx;
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function updateFX(w, t, look, T) {
  const fx = w.fx; const cam = w.camera;
  const ts = t - T.sneeze;
  // global bloom state
  const bloom = smooth(22.1, 26.0, t);
  G.uBloom.value = bloom; G.uBloomT.value = ts;
  w.scene.fog.color.setRGB(lerp(0.85, 0.93, bloom), lerp(0.72, 0.8, bloom), lerp(0.77, 0.88, bloom));
  w.scene.fog.density = lerp(0.0048, 0.0036, bloom);
  w.hemi.color.setRGB(lerp(0.52, 0.62, bloom), lerp(0.65, 0.78, bloom), lerp(0.88, 0.95, bloom));
  w.hemi.groundColor.setRGB(lerp(0.75, 0.55, bloom), lerp(0.48, 0.7, bloom), lerp(0.45, 0.5, bloom));
  w.hemi.intensity = lerp(0.8, 1.0, bloom);
  const vegOn = t > WAVE_START + 0.2;
  fx.flowers.visible = fx.centers.visible = fx.leaves.visible = vegOn; if (fx.vines) fx.vines.visible = vegOn;
  fx.falls.forEach(f => f.visible = vegOn);
  fx.canopy.forEach(c => c.visible = ts > 0.5 && ts < 7);
  // plume
  fx.plume.visible = ts > 0 && ts < 6;
  fx.plume.material.uniforms.uT.value = ts;
  fx.plume.material.uniforms.uScale.value = 1080 / (2 * Math.tan(cam.fov * Math.PI / 360));
  // ribbons
  for (const rb of fx.ribbons) {
    const k = clamp((ts - 0.05 - rb.delay) / 1.9); rb.m.visible = k > 0 && ts < 7;
    rb.m.material.uniforms.uK.value = easeOut(k) * 1.02; rb.m.material.uniforms.uFade.value = 1 - smooth(3.5, 5.5, ts);
  }
  // shockwave ring
  const rk = clamp(ts / 0.9); fx.ring.visible = ts > 0 && ts < 0.9;
  fx.ring.position.copy(ORIGIN); fx.ring.scale.setScalar(0.2 + easeOut(rk) * 9); fx.ring.material.opacity = 0.7 * (1 - rk);
  // canopy
  for (const sp of fx.canopy) {
    const k = smooth(0.6, 2.4, ts); sp.material.opacity = k * (1 - smooth(4.5, 6.5, ts)) * 0.75;
    sp.scale.set(sp.userData.base * (0.4 + k * 0.8), sp.userData.base * 0.62 * (0.4 + k * 0.8), 1);
  }
  // rain
  const rainAmt = smooth(0.8, 1.6, ts) * (1 - smooth(4.6, 5.6, ts));
  fx.rainNear.material.uniforms.uAmt.value = rainAmt * 0.7; fx.rainNear.material.uniforms.uCam.value.copy(cam.position);
  fx.rainFar.material.uniforms.uAmt.value = rainAmt * 0.55; fx.rainFar.material.uniforms.uR.value = Math.max(0, (t - WAVE_START) * WAVE_SPEED + 20);
  fx.rainNear.visible = fx.rainFar.visible = rainAmt > 0.001;
  // petals swirl near the camera after the bloom
  const petalAmt = smooth(23.0, 24.0, t);
  fx.petals.visible = petalAmt > 0;
  if (fx.petals.visible) {
    const box = 7; const base = cam.position.clone().sub(V(box / 2, box / 2, box / 2));
    fx.petalSeeds.forEach((s, i) => {
      _p.set(s[0] * box + Math.sin(t * 0.7 + s[3] * 20) * 0.6 + t * 0.9, s[1] * box - t * 0.35 + Math.sin(t + s[2] * 10) * 0.3, s[2] * box + Math.cos(t * 0.6 + s[0] * 20) * 0.5 + t * 0.4);
      _p.set(((_p.x - base.x) % box + box) % box + base.x, ((_p.y - base.y) % box + box) % box + base.y, ((_p.z - base.z) % box + box) % box + base.z);
      _e.set(t * (2 + s[0] * 3), t * (1.5 + s[1] * 2), t * s[2] * 2); _q.setFromEuler(_e);
      const near = clamp((_p.distanceTo(cam.position) - 0.5) / 1.0); const sc = petalAmt * near * (0.6 + s[3] * 0.6);
      _m4.compose(_p, _q, _s.set(sc, sc, sc)); fx.petals.setMatrixAt(i, _m4);
    });
    fx.petals.instanceMatrix.needsUpdate = true;
  }
  // motes
  fx.motes.material.uniforms.uCam.value.copy(cam.position);
  // vendor hat bloom / helmet flower / noodle flowers
  const hk = clamp((t - 24.25) / 0.45); fx.hatFlowers.visible = hk > 0; fx.hatFlowers.scale.setScalar(Math.max(0.001, hk < 1 ? 1 + Math.sin(hk * 9) * 0.25 * (1 - hk) : 1) * hk);
  const gk = clamp((t - delayAt(V(-6.5, -2, 0))) / 0.5); fx.helm.forEach(m => { m.visible = gk > 0; }); fx.helm[0].scale.setScalar(0.18 * gk); fx.helm[1].scale.y = Math.max(0.001, gk);
  const nk = clamp((t - 24.15) / 0.5); fx.noodleFl.visible = nk > 0; fx.noodleFl.scale.setScalar(Math.max(0.001, nk));
  // bursts
  burst(fx.dust, look.dust, t, (s, k) => V((s[0] - 0.5) * 0.5 * k, s[1] * 0.18 * k, (s[2] - 0.5) * 0.5 * k), 0.6, 0.06);
  burst(fx.sparkle, look.sparkle, t, (s, k) => V((s[0] - 0.5) * 1.0 * k, (s[1] - 0.2) * 0.9 * k - k * k * 0.2, (s[2] - 0.5) * 1.0 * k), 0.9, 0.04);
  if (look.sparks) {
    const pp = look.sparks; fx.sparks.visible = true; const pos = fx.sparks.geometry.attributes.position;
    fx.sparks.userData.seeds.forEach((s, i) => { const age = (t * 3 + s[3]) % 1; pos.setXYZ(i, pp.x + (s[0] - 0.5) * 0.4 * age, pp.y + 0.02 + (s[1] * 0.4 - age * 0.5) * age, pp.z + (s[2] - 0.2) * 0.8 * age); });
    pos.needsUpdate = true; fx.sparks.material.size = 0.035;
  } else fx.sparks.visible = false;
  // mist wisps
  fx.mist.forEach((m, i) => {
    const k = inv(2.95 + i * 0.08, 3.75 + i * 0.08, t); m.visible = k > 0 && k < 1 && !!look.mist;
    m.material.opacity = Math.sin(k * Math.PI) * 0.75;
    m.position.set(1.15 - 0.6 + (1 - k) * 1.2 * 0 + lerp(0.6, -0.9, k) * 0.9, 0.55 + i * 0.07 + k * 0.15, 0.0 + lerp(0.7, -0.4, k) + i * 0.05);
    m.scale.set(0.5 + i * 0.12, 0.3 + i * 0.07, 1);
  });
}
function burst(pts, spec, t, fn, life, size) {
  if (!spec) { pts.visible = false; return; }
  const [origin, t0] = spec; const k = clamp((t - t0) / life);
  pts.visible = t >= t0 && k < 1; if (!pts.visible) return;
  const pos = pts.geometry.attributes.position;
  pts.userData.seeds.forEach((s, i) => { const d = fn(s, easeOut(k)); pos.setXYZ(i, origin.x + d.x, origin.y + d.y, origin.z + d.z); });
  pos.needsUpdate = true; pts.material.size = size; pts.material.opacity = (pts.material.blending === THREE.NormalBlending ? 0.5 : 1) * (1 - k);
}
