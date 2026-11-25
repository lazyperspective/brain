// common.js: sky, horizon, composer passes shared by styles
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function skyDome(r = 5000) {
  const U = { top: { value: new THREE.Color('#6fa3e0') }, hor: { value: new THREE.Color('#d6e8ff') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff1dc') }, sunK: { value: 0.5 }, stars: { value: 0 }, below: { value: new THREE.Color('#9db88a') } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, hor, sunDir, sunCol, below; uniform float sunK, stars; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ vec3 d = normalize(vD); float y = d.y;
        vec3 c = mix(hor, top, pow(smoothstep(-0.02, 0.6, y), 0.8));
        float sd = max(dot(d, normalize(sunDir)), 0.0); c += sunCol * (pow(sd, 8.0) * 0.35 + pow(sd, 90.0) * 0.8 + pow(sd, 2000.0) * 6.0) * sunK;
        vec3 q = floor(d * 420.0); float st = step(0.9965, h(q)) * stars * smoothstep(0.03, 0.35, y) * (0.5 + 0.5 * h(q + 1.7)); c += vec3(st) * 1.5;
        c = mix(c, below, smoothstep(0.0, -0.05, y));
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  m.frustumCulled = false; m.renderOrder = -10;
  return { mesh: m, U };
}

// distant land around the site: a big ground disc + low hills ring + forest band (cheap)
export function horizon(M, opts = {}) {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.RingGeometry(330, 6000, 96, 6).rotateX(-Math.PI / 2), M.std({ color: opts.ground || 0x5a8a42, snowK: 1, kind: 'ground', key: 'farground',
    fragExtra: f => f.replace('#include <color_fragment>', `#include <color_fragment>\n { vec2 p = vWP.xz; float fld = mh(floor(p / 140.0)); diffuseColor.rgb *= 0.8 + 0.35 * fld; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62,0.6,0.38), step(0.82, fld) * 0.6); }`) }));
  ground.position.y = -0.4; ground.receiveShadow = true; g.add(ground);
  // forest band just outside the site
  const n = 2600; const geo = new THREE.IcosahedronGeometry(1, 0); const im = new THREE.InstancedMesh(geo, M.std({ snowK: 0.7 }), n);
  const m4 = new THREE.Matrix4(), c = new THREE.Color(); let k = 0; let seed = 3;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (k < n) { const a = r() * Math.PI * 2, rr = 360 + Math.pow(r(), 1.6) * 900; const x = Math.cos(a) * rr, z = Math.sin(a) * rr + 25; if (Math.abs(x) < 345 && z > -275 && z < 325) continue; const s = 4 + r() * 4;
    m4.compose(new THREE.Vector3(x, s * 0.6, z), new THREE.Quaternion(), new THREE.Vector3(s, s * (0.9 + r() * 0.5), s)); im.setMatrixAt(k, m4); im.setColorAt(k, c.set([0x4f7f3a, 0x3f6e33, 0x2f5a3a, 0x5e8c40][Math.floor(r() * 4)])); k++; }
  im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = true; g.add(im);
  // hills ring
  const N = 180, pos = [], idx = [];
  for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2; const h = 40 + Math.sin(a * 3) * 25 + Math.sin(a * 7 + 1) * 14 + Math.sin(a * 17) * 6; const R1 = 2600, R2 = 3000; pos.push(Math.cos(a) * R1, -1, Math.sin(a) * R1, Math.cos(a) * R2, h * 3, Math.sin(a) * R2); }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setIndex(idx); hg.computeVertexNormals();
  g.add(new THREE.Mesh(hg, M.std({ color: opts.hills || 0x5f8a58, snowK: 1, side: THREE.DoubleSide })));
  return g;
}

export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.12 }, uVig: { value: 0.3 }, uWarm: { value: 0.5 }, uNight: { value: 0 }, uGrain: { value: 0.012 }, uSeed: { value: 0 }, uCA: { value: 0.0 }, uContrast: { value: 0.25 }, uLift: { value: new THREE.Color(0, 0, 0) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uVig, uWarm, uNight, uGrain, uSeed, uCA, uContrast; uniform vec3 uLift; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uSeed)*43758.5453); }
    void main(){ vec2 c = vUv - 0.5; float r2 = dot(c, c); vec2 ca = c * uCA;
      vec3 col = vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b);
      float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, uSat);
      col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(1.06, 1.0, 0.9), uWarm * 0.5);
      col = mix(col, col * mix(vec3(0.8, 0.85, 1.2), vec3(1.0), smoothstep(0.2, 0.7, lum)), uNight);
      col += uLift * (1.0 - lum);
      col *= 1.0 - smoothstep(0.1, 0.65, r2) * uVig;
      col += (hash(gl_FragCoord.xy) - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0); }`,
};

// variable-radius disc blur (tilt-shift); band around focusY (0..1, uv), radius grows outside band
export const TiltShader = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1920, 1080) }, focusY: { value: 0.5 }, band: { value: 0.12 }, maxR: { value: 14 }, rot: { value: 0 }, skew: { value: 1.25 }, bokeh: { value: 4.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float focusY, band, maxR, rot, skew, bokeh; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      float d = abs(vUv.y - focusY) * (vUv.y > focusY ? 1.0 : skew);
      float r = maxR * pow(smoothstep(band, band + 0.32, d), 1.25);
      vec4 base = texture2D(tDiffuse, vUv);
      if (r < 0.6) { gl_FragColor = base; return; }
      vec3 acc = vec3(0.0); float ws = 0.0; float jit = hash(gl_FragCoord.xy) * 6.283 + rot;
      for (int i = 0; i < 40; i++) {
        float fi = float(i) + 0.5; float rr = sqrt(fi / 40.0) * r; float a = fi * 2.39996 + jit;
        vec3 c = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rr / res).rgb;
        float l = dot(c, vec3(0.3, 0.59, 0.11));
        float w = 1.0 + smoothstep(1.2, 4.0, l) * bokeh;
        acc += c * w; ws += w;
      }
      gl_FragColor = vec4(acc / ws, 1.0);
    }`,
};
export function tiltPass(W, H) { const p = new ShaderPass(TiltShader); p.uniforms.res.value.set(W, H); return p; }
