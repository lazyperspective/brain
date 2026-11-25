// mat.js: material factory shared by the three styles (low-poly, tilt-shift miniature, snow globe).
// Every MeshStandardMaterial is patched once with optional features driven by global uniforms:
//   BP   : blueprint wave (low-poly shot 04): geometry grows from the ground behind a moving front, cyan flash, grid ground
//   SNOW : snow cover on up-facing surfaces (globe shot 16), strength per material (snowK)
//   GUEST: per-part colouring + limb animation for the instanced little people
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  // blueprint
  uFront: { value: 1e6 }, uBand: { value: 16 }, uDir: { value: new THREE.Vector2(0.7071, -0.7071) }, uCyan: { value: new THREE.Color(0x48e0ff) },
  uZoneA: { value: new THREE.Vector4(1e6, 1e6, 1e6, 1e6) }, uZoneB: { value: new THREE.Vector4(1e6, 1e6, 1e6, 1e6) }, uZoneC: { value: new THREE.Vector4(1e6, 1e6, 1e6, 1e6) },
  // snow
  uSnow: { value: 0 },
  // night: global multiplier for window glow etc.
  uNight: { value: 0 },
  uClip: { value: new THREE.Vector4(0, 0, 1e9, 0) },
};

const COMMON_V = `
uniform float uTime; uniform float uFront; uniform float uBand; uniform vec2 uDir; uniform vec4 uZoneA, uZoneB, uZoneC;
varying vec3 vWP; varying vec3 vWN; varying float vBpR;
float bpZone(vec2 p){ float z = 0.0;
  z = max(z, step(uZoneA.x, p.x) * step(p.x, uZoneA.z) * step(uZoneA.y, p.y) * step(p.y, uZoneA.w));
  z = max(z, step(uZoneB.x, p.x) * step(p.x, uZoneB.z) * step(uZoneB.y, p.y) * step(p.y, uZoneB.w));
  z = max(z, step(uZoneC.x, p.x) * step(p.x, uZoneC.z) * step(uZoneC.y, p.y) * step(p.y, uZoneC.w));
  return z; }
`;
const COMMON_F = `
uniform float uTime; uniform float uFront; uniform float uBand; uniform vec3 uCyan; uniform float uSnow; uniform float uNight; uniform vec2 uDir; uniform vec4 uClip;
varying vec3 vWP; varying vec3 vWN; varying float vBpR;
float mh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float mn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(mh(i),mh(i+vec2(1,0)),f.x), mix(mh(i+vec2(0,1)),mh(i+vec2(1,1)),f.x), f.y); }
float bpGrid(vec2 p, float s, float w){ vec2 g = abs(fract(p / s - 0.5) - 0.5) * s; vec2 fw = fwidth(p); vec2 l = 1.0 - smoothstep(vec2(0.0), fw * w, g); return max(l.x, l.y); }
`;

// guest attributes
const GUEST_V = `
attribute float aPart; attribute float aSwing; attribute float aPivot;
attribute vec3 iTop; attribute vec3 iBot; attribute vec3 iHair; attribute vec3 iSkin; attribute vec4 iAnim;
varying vec3 vGCol;
`;

export function patch(m, o = {}) {
  const BP = !!o.bp, SNOW = !!o.snow, GUEST = !!o.guest, kind = o.kind || 'solid';
  if (kind === 'ground') o = Object.assign({}, o, { bpPerVertex: true, noZone: true });
  const snowK = o.snowK == null ? 1 : o.snowK;
  m.userData.patch = o;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    let v = sh.vertexShader, f = sh.fragmentShader;
    v = v.replace('#include <common>', '#include <common>\n' + COMMON_V + (GUEST ? GUEST_V : ''));
    f = f.replace('#include <common>', '#include <common>\n' + COMMON_F + (GUEST ? 'varying vec3 vGCol;\n' : ''));
    if (GUEST) {
      v = v.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float ph = iAnim.x + uTime * 7.0; float walk = iAnim.y; float up = iAnim.z;
        float a = 0.0;
        if (aSwing != 0.0) {
          bool isArm = abs(aSwing) > 1.5;
          float sw = sin(ph) * (isArm ? -0.55 : 0.5) * sign(aSwing) * max(walk, 0.0);
          if (isArm) a = sw * (1.0 - up) - up * (2.75 + 0.25 * sin(uTime * 3.0 + iAnim.x) * sign(aSwing));
          else a = sw;
          if (walk < 0.0 && !isArm) a = -1.5;           // seated
          if (walk < 0.0 && isArm) a = mix(-0.55, a, up); // hands on lap / bar
          float yy = transformed.y - aPivot, zz = transformed.z;
          float c = cos(a), s = sin(a);
          transformed.y = aPivot + yy * c - zz * s; transformed.z = yy * s + zz * c;
          if (isArm && up > 0.0) transformed.x += sign(transformed.x) * up * 0.08 * max(0.0, aPivot - transformed.y + 0.6);
        }
        if (aPart > 4.5 && iAnim.w < 0.5) transformed = vec3(0.0, 1.5, 0.0); // no hat
        if (walk > 0.0) transformed.y += abs(sin(ph)) * 0.035 * walk;
        vec3 cc = iSkin;
        if (aPart > 0.5 && aPart < 1.5) cc = iTop; else if (aPart > 1.5 && aPart < 2.5) cc = iBot; else if (aPart > 2.5 && aPart < 3.5) cc = iHair;
        else if (aPart > 3.5 && aPart < 4.5) cc = vec3(0.13, 0.12, 0.12); else if (aPart > 4.5) cc = iTop * 0.55 + vec3(0.25);
        vGCol = cc;
      }`);
      f = f.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= vGCol;');
    }
    // world position / normal + blueprint lift
    v = v.replace('#include <project_vertex>', `
      vec4 bpW = vec4(transformed, 1.0);
      vec3 bpN = ${o.basic ? 'vec3(0.0, 1.0, 0.0)' : 'objectNormal'};
      #ifdef USE_INSTANCING
        bpW = instanceMatrix * bpW; bpN = mat3(instanceMatrix) * bpN;
      #endif
      bpW = modelMatrix * bpW;
      vWN = normalize(mat3(modelMatrix) * bpN);
      ${BP ? `
      { vec4 org = modelMatrix * ${'vec4(0.0,0.0,0.0,1.0)'};
        #ifdef USE_INSTANCING
          org = modelMatrix * instanceMatrix[3];
        #endif
        float s = dot(${o.bpPerVertex ? 'bpW.xz' : 'org.xz'}, uDir);
        float r = clamp((uFront - s) / uBand, 0.0, 1.0) * ${o.noZone ? '1.0' : "(1.0 - bpZone(" + (o.bpPerVertex ? 'bpW.xz' : 'org.xz') + "))"};
        vBpR = r;
        ${kind === 'solid' ? `float bx = r - 1.0; float e = 1.0 + 2.70158 * bx * bx * bx + 1.70158 * bx * bx; bpW.y = ${o.bpBase != null ? o.bpBase.toFixed(2) : '0.0'} + (bpW.y - ${o.bpBase != null ? o.bpBase.toFixed(2) : '0.0'}) * max(0.0, e);` : ''}
      }` : 'vBpR = 1.0;'}
      vWP = bpW.xyz;
      vec4 mvPosition = viewMatrix * bpW;
      gl_Position = projectionMatrix * mvPosition;
    `);
    // shadows on lifted geometry are fine; MeshStandard uses worldPosition for shadow coords: recompute from bpW
    v = v.replace('#include <worldpos_vertex>', `
      vec4 worldPosition = vec4(vWP, 1.0);
      #if defined( USE_SHADOWMAP ) || defined( USE_ENVMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
      #endif
    `);
    f = f.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (uClip.w > 0.5 && uClip.w < 1.5 && length(vWP.xz - uClip.xy) > uClip.z) discard;');
    f = f.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n if (uClip.w > 1.5) gl_FragColor.rgb *= 1.0 - (uClip.w - 2.0) * smoothstep(uClip.z - 10.0, uClip.z + 40.0, length(vWP.xz - uClip.xy));');
    if (SNOW) {
      f = f.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float upn = normalize(vWN).y;
        float nz = mn(vWP.xz * 0.45) * 0.6 + mn(vWP.xz * 1.7) * 0.4;
        float cover = smoothstep(0.25, 0.75, upn + (nz - 0.5) * 0.45);
        float s = clamp(uSnow * 1.3 - (1.0 - cover) * 1.1 - nz * 0.2 * (1.0 - uSnow), 0.0, 1.0) * cover * ${snowK.toFixed(2)};
        vec3 snowc = vec3(0.90, 0.93, 1.0) * (0.9 + 0.1 * nz);
        diffuseColor.rgb = mix(diffuseColor.rgb, snowc, s);
      }`);
    }
    if (BP) {
      if (kind === 'ground') {
        f = f.replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          float r = vBpR;
          vec2 rp = vWP.xz;
          float g1 = bpGrid(rp, 4.0, 1.0), g2 = bpGrid(rp, 20.0, 1.6);
          vec3 bp = vec3(0.022, 0.07, 0.23) + uCyan * (g1 * 0.13 + g2 * 0.38) ${o.bpPath ? '+ uCyan * 0.11' : ''};
          float k = smoothstep(0.05, 0.8, r);
          gl_FragColor.rgb = mix(bp, gl_FragColor.rgb, k);
          float s = dot(vWP.xz, uDir);
          float dd = abs(uFront - s);
          gl_FragColor.rgb += (uCyan * exp(-dd * 0.22) * 0.45 + vec3(0.6, 0.92, 1.0) * exp(-dd * 2.0) * 0.35) * (1.0 - smoothstep(0.0, 0.9, r) * 0.6);
        }`);
      } else {
        f = f.replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          float r = vBpR;
          if (r < 0.02) discard;
          float glow = 1.0 - smoothstep(0.05, 0.85, r);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uCyan * 1.25, glow * 0.7);
        }`);
      }
    }
    if (o.fragExtra) f = o.fragExtra(f);
    if (o.vertExtra) v = o.vertExtra(v);
    sh.vertexShader = v; sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => JSON.stringify({ BP, SNOW, GUEST, kind, snowK, pv: !!o.bpPerVertex, nz: !!o.noZone, bb: o.bpBase, p: !!o.bpPath, x: o.key || '', b: !!o.basic });
  return m;
}

// shadow depth material carrying the same blueprint lift (so unbuilt objects cast no shadow)
export function depthMat(bp, noZone = false) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  if (!bp) return d;
  d.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + COMMON_V).replace('#include <project_vertex>', `
      vec4 bpW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        bpW = instanceMatrix * bpW;
      #endif
      bpW = modelMatrix * bpW;
      vec4 org = modelMatrix * vec4(0.0,0.0,0.0,1.0);
      #ifdef USE_INSTANCING
        org = modelMatrix * instanceMatrix[3];
      #endif
      float s = dot(org.xz, uDir);
      float r = clamp((uFront - s) / uBand, 0.0, 1.0)${noZone ? '' : ' * (1.0 - bpZone(org.xz))'};
      vBpR = r; vWP = bpW.xyz; vWN = vec3(0.0, 1.0, 0.0);
      float bx = r - 1.0; float e = 1.0 + 2.70158 * bx * bx * bx + 1.70158 * bx * bx; bpW.y *= max(0.0, e);
      vec4 mvPosition = viewMatrix * bpW; gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = 'varying float vBpR; varying vec3 vWP; varying vec3 vWN;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (vBpR < 0.02) discard;');
  };
  d.customProgramCacheKey = () => 'bpdepth' + (noZone ? 'nz' : '');
  return d;
}

// Material factory: style = 'lowpoly' | 'mini' ; flags: bp, snow
export function makeFactory(style, flags = {}) {
  const cache = new Map();
  const F = {
    style, flags,
    std(o = {}) {
      const key = JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
      if (cache.has(key)) return cache.get(key);
      const lp = style === 'lowpoly';
      const m = new THREE.MeshStandardMaterial({
        color: o.color != null ? o.color : 0xffffff,
        roughness: o.rough != null ? o.rough : (lp ? 0.88 : 0.42),
        metalness: o.metal || 0,
        flatShading: o.flat != null ? o.flat : lp,
        side: o.side || THREE.FrontSide,
        transparent: !!o.transparent, opacity: o.opacity == null ? 1 : o.opacity,
        emissive: o.emissive != null ? o.emissive : 0x000000, emissiveIntensity: o.emissiveIntensity == null ? 1 : o.emissiveIntensity,
        vertexColors: !!o.vertexColors,
        map: o.map || null, bumpMap: o.bump || null, bumpScale: o.bumpScale || 1,
        envMapIntensity: o.env == null ? 1 : o.env,
        depthWrite: o.depthWrite == null ? true : o.depthWrite,
      });
      if (o.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = o.polygonOffset; m.polygonOffsetUnits = o.polygonOffset; }
      patch(m, { bp: flags.bp && o.bp !== false, snow: flags.snow && o.snowK !== 0, snowK: o.snowK, kind: o.kind, bpPath: o.bpPath, guest: o.guest, bpPerVertex: o.bpPerVertex, noZone: o.noZone, key: o.key, fragExtra: o.fragExtra });
      cache.set(key, m);
      return m;
    },
    basic(o = {}) { // unlit (bulbs, glows)
      const m = new THREE.MeshBasicMaterial({ color: o.color != null ? o.color : 0xffffff, transparent: !!o.transparent, opacity: o.opacity == null ? 1 : o.opacity,
        blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: o.depthWrite == null ? !o.additive : o.depthWrite, map: o.map || null, side: o.side || THREE.FrontSide, toneMapped: o.toneMapped == null ? true : o.toneMapped });
      patch(m, { bp: flags.bp && o.bp !== false, kind: 'solid', basic: true, key: 'basic' + (o.additive ? 'a' : '') });
      return m;
    },
  };
  return F;
}
