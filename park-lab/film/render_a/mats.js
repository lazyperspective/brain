// Style materials: gouache (Lambert + world-space mottling) or pixel (toon, 3 tones).
// Every material gets a world-position varying and optional fragment snippet (patterns).
export const NOISE = `
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm3(vec2 p){ return .5*vn(p)+.25*vn(p*2.03+7.1)+.125*vn(p*4.01+3.3); }
vec2 vor(vec2 p){ vec2 g=floor(p), f=fract(p); float d1=8., d2=8.; float id=0.;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(i,j); vec2 r=o+vec2(h21(g+o),h21(g+o+17.))*.85-f; float d=dot(r,r); if(d<d1){d2=d1;d1=d;id=h21(g+o+3.);} else if(d<d2) d2=d; }
  return vec2(sqrt(d2)-sqrt(d1), id); }
`;

export function makeMats(THREE, style) {
  const pixel = style === 'pixel';
  const U = { uTime: { value: 0 }, uWake: { value: 1 }, uBuild: { value: 1e9 } };
  let grad = null;
  if (pixel) {
    const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 225, 225, 225, 255, 255, 255, 255, 255]);
    grad = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  }
  const cache = {};
  // o: {color, vc, inst, side, frag (glsl using p=vWPos, col=diffuseColor), vert, emissive, key, transparent, opacity, mot}
  function mat(o = {}) {
    const key = o.key || JSON.stringify([o.color, !!o.vc, o.side, o.frag, o.vert, o.emissive, o.transparent, o.opacity, o.mot, o.flat, o.unlit]);
    if (cache[key]) return cache[key];
    const params = { color: o.color ?? 0xffffff, vertexColors: !!o.vc, side: o.side ?? THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1 };
    let m;
    if (o.unlit) m = new THREE.MeshBasicMaterial(params);
    else if (pixel) m = new THREE.MeshToonMaterial(Object.assign(params, { gradientMap: grad }));
    else m = new THREE.MeshLambertMaterial(params);
    if (o.emissive) m.emissive = new THREE.Color(o.emissive);
    const mot = o.mot ?? (pixel ? 0 : 0.16);
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vWPos; uniform float uTime; uniform float uBuild; ${o.vhead || ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
${o.vert || ''}`)
        .replace('#include <project_vertex>', `#include <project_vertex>
{ vec4 wp = vec4(transformed,1.0);
#ifdef USE_INSTANCING
 wp = instanceMatrix*wp;
#endif
 vWPos = (modelMatrix*wp).xyz; }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWPos; uniform float uTime; uniform float uWake; uniform float uBuild; ${o.fhead || ''}
${NOISE}`)
        .replace('#include <opaque_fragment>', (pixel || o.unlit || o.raw) ? '#include <opaque_fragment>' : `{ // illustrative light: warm lit / cool violet shadow bands
  vec3 base = max(diffuseColor.rgb, vec3(1e-3)); float s = dot(outgoingLight, vec3(.3,.59,.11)) / max(dot(base, vec3(.3,.59,.11)), 1e-3);
  float k = smoothstep(.42, .78, s); vec3 sh = base*vec3(.40,.42,.58), li = base*vec3(1.04,.99,.88);
  vec3 band = mix(sh, li, k) * (.82 + .22*clamp(s, 0., 1.4));
  outgoingLight = mix(outgoingLight, band, .62); }
#include <opaque_fragment>`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 p = vWPos;
  ${mot ? `diffuseColor.rgb *= 1.0 + (fbm3(p.xz*0.45 + p.y*0.3) - 0.5) * ${mot.toFixed(3)} + (vn(p.xz*3.1+p.y*2.7)-.5)*${(mot * 0.5).toFixed(3)};` : ''}
  ${o.frag || ''} }`);
    };
    m.customProgramCacheKey = () => key;
    cache[key] = m; return m;
  }
  return { mat, U, pixel, THREE };
}
