// Painterly material language: textured enamel/copper with brush-stroke albedo breakup and rim light.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

export const G = { // global uniforms shared by all custom shaders
  uTime: { value: 0 },
  uBloom: { value: 0 },        // 0 = dry city, 1 = fully bloomed
  uBloomOrigin: { value: new THREE.Vector3(0, 0, 0) },
  uBloomT: { value: -100 },    // seconds since sneeze
  uSunDir: { value: new THREE.Vector3(0.5, 0.35, 0.6).normalize() },
};

// Procedural brush-stroke texture (tileable), drawn once on a canvas.
function strokeCanvas(size = 512, seed = 7) {
  const r = mulberry32(seed);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const x = r() * size, y = r() * size, len = 8 + r() * 40, w = 2 + r() * 7;
    const a = (r() - 0.5) * 0.9 + (i % 2 ? 0.3 : -0.4);
    const v = Math.floor(70 + r() * 120);
    g.strokeStyle = `rgba(${v},${v},${v},${0.10 + r() * 0.22})`;
    g.lineWidth = w; g.lineCap = 'round';
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      g.beginPath(); g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + Math.cos(a) * len * 0.5 + (r() - 0.5) * 6, y + oy + Math.sin(a) * len * 0.5 + (r() - 0.5) * 6, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
      g.stroke();
    }
  }
  return c;
}
let _strokeTex;
export function strokeTex() {
  if (!_strokeTex) {
    _strokeTex = new THREE.CanvasTexture(strokeCanvas());
    _strokeTex.wrapS = _strokeTex.wrapT = THREE.RepeatWrapping;
    _strokeTex.colorSpace = THREE.NoColorSpace;
  }
  return _strokeTex;
}

// Inject triplanar stroke breakup + rim light + optional wind sway into a standard material.
export function paintify(mat, { strokeAmt = 0.22, strokeScale = 0.6, rim = 0.35, rimColor = 0xffd9a8, sway = 0, wet = true } = {}) {
  mat.userData.paint = { strokeAmt, strokeScale, rim, rimColor };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uStroke = { value: strokeTex() };
    sh.uniforms.uStrokeAmt = { value: strokeAmt };
    sh.uniforms.uStrokeScale = { value: strokeScale };
    sh.uniforms.uRim = { value: new THREE.Color(rimColor).multiplyScalar(rim) };
    sh.uniforms.uTime = G.uTime;
    sh.uniforms.uBloom = G.uBloom;
    sh.uniforms.uSway = { value: sway };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm; uniform float uTime; uniform float uSway;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (uSway > 0.0) { float h = max(position.y, 0.0); transformed.x += sin(uTime*2.3 + position.y*3.0 + position.z) * uSway * h; transformed.z += cos(uTime*1.9 + position.x*2.0) * uSway * 0.6 * h; }`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        { vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          #endif
          wp = modelMatrix * wp; vWPos = wp.xyz;
          vWNrm = normalize(mat3(modelMatrix) * objectNormal); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm; uniform sampler2D uStroke; uniform float uStrokeAmt; uniform float uStrokeScale; uniform vec3 uRim; uniform float uBloom;
        float triStroke(vec3 p, vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x+w.y+w.z+1e-4);
          float a = texture2D(uStroke, p.zy*uStrokeScale).r, b = texture2D(uStroke, p.xz*uStrokeScale).r, c = texture2D(uStroke, p.xy*uStrokeScale).r;
          return a*w.x + b*w.y + c*w.z; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { float s = triStroke(vWPos, normalize(vWNrm)); float s2 = triStroke(vWPos*0.13+3.1, normalize(vWNrm));
          diffuseColor.rgb *= 1.0 + (s - 0.5) * 2.0 * uStrokeAmt + (s2-0.5)*uStrokeAmt*1.2;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05,1.0,1.03), uBloom*0.5); }`)
      .replace('#include <opaque_fragment>', `
        { float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0); outgoingLight += uRim * fr; }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `paint_${strokeAmt}_${strokeScale}_${rim}_${sway}`;
  return mat;
}

export function paint(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.62, metalness: opts.metalness ?? 0.15,
    vertexColors: !!opts.vertexColors, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide, transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    flatShading: !!opts.flat,
  });
  return paintify(m, opts);
}

// Soft fluffy cloud material — wrap lighting, pastel gradient, fresnel glow. Used for Puff.
export function fluffMat(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: G.uTime, uSunDir: G.uSunDir,
      uTop: { value: new THREE.Color(opts.top ?? 0xfffaf2) },
      uMid: { value: new THREE.Color(opts.mid ?? 0xf3e4f3) },
      uBot: { value: new THREE.Color(opts.bot ?? 0xa9b4e8) },
      uRimC: { value: new THREE.Color(opts.rim ?? 0xffd6c4) },
      uGlow: { value: opts.glow ?? 0.0 },
      uBlush: { value: 1.0 },
      uWobble: { value: opts.wobble ?? 0.04 },
      uCenter: { value: new THREE.Vector3() },
    },
    vertexShader: `
      uniform float uTime; uniform float uWobble;
      varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec3 vWN;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        vec3 p = position;
        float d = n3(normal*3.0 + uTime*0.6) * 0.6 + n3(normal*7.0 - uTime*0.4)*0.4;
        p += normal * (d - 0.5) * uWobble * 2.0;
        vec4 wp = modelMatrix * vec4(p,1.0);
        #ifdef USE_INSTANCING
        wp = modelMatrix * instanceMatrix * vec4(p,1.0);
        #endif
        vWN = normalize(mat3(modelMatrix) * normal);
        vL = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vV = -mv.xyz; vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uTop, uMid, uBot, uRimC, uSunDir; uniform float uGlow;
      varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec3 vWN;
      void main(){
        vec3 n = normalize(vWN);
        float up = n.y*0.5+0.5;
        vec3 base = mix(uBot, uMid, smoothstep(0.0,0.55,up)); base = mix(base, uTop, smoothstep(0.5,1.0,up));
        float wrap = clamp((dot(n, normalize(uSunDir)) + 0.6)/1.6, 0.0, 1.0);
        vec3 c = base * (0.62 + 0.55*wrap);
        float fr = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)),0.0,1.0), 2.2);
        c += uRimC * fr * 0.55;
        c += vec3(1.0,0.95,0.98) * uGlow;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Generic soft particle sprite texture
export function softDot(size = 64, hard = 0.0) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(hard, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); return t;
}

// Painted cumulus cloud texture variants (for sky/cloud-sea billboards)
export function cloudTexture(seed, w = 512, h = 320, opts = {}) {
  const r = mulberry32(seed);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const puffs = [];
  const n = 26 + Math.floor(r() * 14);
  for (let i = 0; i < n; i++) {
    const u = r();
    const x = w * (0.12 + 0.76 * u);
    const top = Math.sin(u * Math.PI);
    const rad = h * (0.10 + 0.20 * top * (0.6 + r() * 0.6));
    const y = h * 0.78 - rad * (0.3 + r() * 0.9) * top - r() * h * 0.05;
    puffs.push([x, y, rad]);
  }
  puffs.sort((a, b) => b[1] - a[1]);
  const top = opts.top || [255, 247, 238], mid = opts.mid || [246, 200, 214], bot = opts.bot || [150, 150, 205];
  // shadow layer
  for (const [x, y, rad] of puffs) {
    const gr = g.createRadialGradient(x, y + rad * 0.2, rad * 0.2, x, y + rad * 0.25, rad * 1.05);
    gr.addColorStop(0, `rgba(${mid[0]},${mid[1]},${mid[2]},0.95)`);
    gr.addColorStop(0.75, `rgba(${bot[0]},${bot[1]},${bot[2]},0.9)`);
    gr.addColorStop(1, `rgba(${bot[0]},${bot[1]},${bot[2]},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad * 1.05, 0, 7); g.fill();
  }
  // lit tops
  for (const [x, y, rad] of puffs) {
    const gr = g.createRadialGradient(x - rad * 0.25, y - rad * 0.4, rad * 0.05, x, y - rad * 0.1, rad * 0.9);
    gr.addColorStop(0, `rgba(${top[0]},${top[1]},${top[2]},0.95)`);
    gr.addColorStop(0.6, `rgba(${(top[0] + mid[0]) / 2},${(top[1] + mid[1]) / 2},${(top[2] + mid[2]) / 2},0.55)`);
    gr.addColorStop(1, `rgba(${mid[0]},${mid[1]},${mid[2]},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad * 0.9, 0, 7); g.fill();
  }
  // flat base fade
  g.globalCompositeOperation = 'destination-out';
  const fade = g.createLinearGradient(0, h * 0.72, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
