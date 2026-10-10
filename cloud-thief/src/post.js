// Painterly post-processing: Kuwahara brush filter, bloom, god rays, ink outlines, grade, grain.
import * as THREE from 'three';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function fsq(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); mesh.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(mesh);
  return { m, sc, u: m.uniforms };
}

const KUWAHARA = `
uniform sampler2D tSrc; uniform vec2 uRes; uniform float uRadius; varying vec2 vUv;
void main(){
  vec2 px = 1.0 / uRes;
  vec3 m[4]; vec3 s[4];
  for (int k=0;k<4;k++){ m[k]=vec3(0.0); s[k]=vec3(0.0); }
  const int R = 3;
  for (int j=-R; j<=0; j++) for (int i=-R; i<=0; i++) {
    vec2 o = vec2(float(i), float(j)) * px * uRadius / 3.0;
    vec3 c0 = texture2D(tSrc, vUv + o).rgb;               m[0]+=c0; s[0]+=c0*c0;
    vec3 c1 = texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb; m[1]+=c1; s[1]+=c1*c1;
    vec3 c2 = texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb; m[2]+=c2; s[2]+=c2*c2;
    vec3 c3 = texture2D(tSrc, vUv - o).rgb;               m[3]+=c3; s[3]+=c3*c3;
  }
  float n = float((R+1)*(R+1));
  float best = 1e9; vec3 outc = vec3(0.0);
  for (int k=0;k<4;k++){
    vec3 mu = m[k]/n; vec3 v = abs(s[k]/n - mu*mu);
    float sig = v.r + v.g + v.b;
    if (sig < best) { best = sig; outc = mu; }
  }
  gl_FragColor = vec4(outc, 1.0);
}`;

const BRIGHT = `uniform sampler2D tSrc; uniform float uThresh; varying vec2 vUv;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = dot(c, vec3(0.299,0.587,0.114)); gl_FragColor = vec4(c * smoothstep(uThresh, uThresh+0.6, l), 1.0); }`;

const BLUR = `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;
  c += texture2D(tSrc, vUv + uDir*1.3846).rgb * 0.3162162; c += texture2D(tSrc, vUv - uDir*1.3846).rgb * 0.3162162;
  c += texture2D(tSrc, vUv + uDir*3.2308).rgb * 0.0702703; c += texture2D(tSrc, vUv - uDir*3.2308).rgb * 0.0702703;
  gl_FragColor = vec4(c, 1.0); }`;

const RAYS = `uniform sampler2D tSrc; uniform sampler2D tDepth; uniform vec2 uSun; uniform float uOn; varying vec2 vUv;
void main(){
  vec2 d = (vUv - uSun) / 40.0 * 0.9; vec2 uv = vUv; vec3 acc = vec3(0.0); float w = 1.0;
  for (int i=0;i<40;i++){ uv -= d; float dep = texture2D(tDepth, uv).r; vec3 c = texture2D(tSrc, uv).rgb;
    float sky = step(0.99995, dep); acc += c * sky * w * smoothstep(0.6, 1.6, dot(c, vec3(0.33))); w *= 0.965; }
  gl_FragColor = vec4(acc / 40.0 * uOn, 1.0); }`;

const FINAL = `
uniform sampler2D tPaint, tSharp, tBloom1, tBloom2, tBloom3, tRays, tDepth, tTitle;
uniform vec2 uMotion; uniform float uTitle;
uniform vec2 uRes; uniform float uTime, uExposure, uBloomAmt, uRaysAmt, uInk, uSat, uVignette, uGrain, uCA, uNear, uFar, uFlash, uSharpMix;
uniform vec3 uLift, uGain, uTint; uniform float uLetter;
varying vec2 vUv;
float lin(float d){ float z = d*2.0-1.0; return (2.0*uNear*uFar)/(uFar+uNear - z*(uFar-uNear)); }
vec3 aces(vec3 x){ const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 px = 1.0/uRes;
  vec2 dc = vUv - 0.5;
  // subtle chromatic aberration toward the edges
  vec2 caOff = dc * uCA * dot(dc,dc) * 4.0;
  vec3 paint = vec3(texture2D(tPaint, vUv + caOff).r, texture2D(tPaint, vUv).g, texture2D(tPaint, vUv - caOff).b);
  if (dot(uMotion, uMotion) > 1e-7) { vec3 acc = paint; for (int i = 1; i < 10; i++) { float f = float(i) / 9.0 - 0.5; acc += texture2D(tPaint, vUv + uMotion * f).rgb; } paint = acc / 10.0; }
  vec3 sharp = texture2D(tSharp, vUv).rgb;
  vec3 c = mix(paint, sharp, uSharpMix);
  // ink outlines from depth discontinuities (stronger for near geometry)
  float d0 = lin(texture2D(tDepth, vUv).r);
  float dx = lin(texture2D(tDepth, vUv + vec2(px.x,0)).r) + lin(texture2D(tDepth, vUv - vec2(px.x,0)).r) - 2.0*d0;
  float dy = lin(texture2D(tDepth, vUv + vec2(0,px.y)).r) + lin(texture2D(tDepth, vUv - vec2(0,px.y)).r) - 2.0*d0;
  float edge = smoothstep(0.04, 0.25, (abs(dx)+abs(dy)) / max(d0, 0.5)) * (1.0 - smoothstep(30.0, 140.0, d0));
  c = mix(c, c * vec3(0.32, 0.22, 0.28), edge * uInk);
  // bloom + rays
  vec3 bl = texture2D(tBloom1, vUv).rgb * 0.5 + texture2D(tBloom2, vUv).rgb * 0.8 + texture2D(tBloom3, vUv).rgb * 1.1;
  c += bl * uBloomAmt;
  c += texture2D(tRays, vUv).rgb * uRaysAmt * vec3(1.0, 0.85, 0.65);
  c *= uExposure;
  c += uFlash;
  c = aces(c);
  // grade: split tone (teal shadows, warm highlights), saturation
  float l = dot(c, vec3(0.299,0.587,0.114));
  c = mix(c, c * uTint, 0.5);
  c = c * uGain + uLift * (1.0 - c);
  c += (vec3(0.0, 0.03, 0.05) * (1.0 - smoothstep(0.0, 0.45, l)) + vec3(0.04, 0.015, -0.02) * smoothstep(0.5, 1.0, l));
  l = dot(c, vec3(0.299,0.587,0.114));
  c = mix(vec3(l), c, uSat);
  // vignette & grain
  c *= mix(1.0, smoothstep(0.95, 0.25, length(dc * vec2(1.0, 0.8))), uVignette);
  c += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * uGrain;
  c = pow(max(c, 0.0), vec3(1.0/2.2));
  vec4 ti = texture2D(tTitle, vUv); c = mix(c, ti.rgb, ti.a * uTitle);
  float lb = step(abs(dc.y), 0.5 - uLetter);
  gl_FragColor = vec4(c * lb, 1.0);
}`;

export class Post {
  constructor(renderer, w, h) {
    this.r = renderer; this.w = w; this.h = h;
    const hf = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.depthTex = new THREE.DepthTexture(w, h); this.depthTex.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { ...hf, samples: 4, depthTexture: this.depthTex });
    this.paintRT = new THREE.WebGLRenderTarget(w, h, hf);
    this.half = [new THREE.WebGLRenderTarget(w / 2, h / 2, hf), new THREE.WebGLRenderTarget(w / 2, h / 2, hf)];
    this.q = [new THREE.WebGLRenderTarget(w / 4, h / 4, hf), new THREE.WebGLRenderTarget(w / 4, h / 4, hf)];
    this.e = [new THREE.WebGLRenderTarget(w / 8, h / 8, hf), new THREE.WebGLRenderTarget(w / 8, h / 8, hf)];
    this.raysRT = new THREE.WebGLRenderTarget(w / 2, h / 2, hf);
    this.kuw = fsq(KUWAHARA, { tSrc: { value: null }, uRes: { value: new THREE.Vector2(w, h) }, uRadius: { value: 3 } });
    this.bright = fsq(BRIGHT, { tSrc: { value: null }, uThresh: { value: 1.0 } });
    this.blur = fsq(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.rays = fsq(RAYS, { tSrc: { value: null }, tDepth: { value: this.depthTex }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uOn: { value: 1 } });
    this.final = fsq(FINAL, {
      tPaint: { value: this.paintRT.texture }, tSharp: { value: this.sceneRT.texture }, tBloom1: { value: this.half[0].texture }, tBloom2: { value: this.q[0].texture }, tBloom3: { value: this.e[0].texture },
      tRays: { value: this.raysRT.texture }, tDepth: { value: this.depthTex },
      uRes: { value: new THREE.Vector2(w, h) }, uTime: { value: 0 }, uExposure: { value: 1.0 }, uBloomAmt: { value: 0.5 }, uRaysAmt: { value: 0.6 },
      uInk: { value: 0.55 }, uSat: { value: 1.12 }, uVignette: { value: 0.55 }, uGrain: { value: 0.025 }, uCA: { value: 0.004 }, uNear: { value: 0.05 }, uFar: { value: 4000 },
      uLift: { value: new THREE.Vector3(0.02, 0.025, 0.05) }, uGain: { value: new THREE.Vector3(1.0, 0.98, 0.95) }, uTint: { value: new THREE.Vector3(1, 1, 1) },
      uFlash: { value: 0 }, uSharpMix: { value: 0.25 }, uLetter: { value: 0.0 }, uMotion: { value: new THREE.Vector2() }, uTitle: { value: 0 }, tTitle: { value: null },
    });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  pass(p, target) { this.r.setRenderTarget(target); this.r.render(p.sc, this.cam); }
  blurPair(pair, scale) {
    const [a, b] = pair; const w = a.width, h = a.height;
    this.blur.u.tSrc.value = a.texture; this.blur.u.uDir.value.set(scale / w, 0); this.pass(this.blur, b);
    this.blur.u.tSrc.value = b.texture; this.blur.u.uDir.value.set(0, scale / h); this.pass(this.blur, a);
  }
  render(scene, camera, opts = {}) {
    const r = this.r;
    r.setRenderTarget(this.sceneRT); r.clear(); r.render(scene, camera);
    this.final.u.uNear.value = camera.near; this.final.u.uFar.value = camera.far;
    // painterly
    this.kuw.u.tSrc.value = this.sceneRT.texture; this.kuw.u.uRadius.value = opts.brush ?? 3; this.pass(this.kuw, this.paintRT);
    // bloom chain
    this.bright.u.tSrc.value = this.paintRT.texture; this.bright.u.uThresh.value = opts.bloomThresh ?? 0.9; this.pass(this.bright, this.half[0]);
    this.blurPair(this.half, 1.0);
    this.bright.u.tSrc.value = this.half[0].texture; this.bright.u.uThresh.value = 0.0; this.pass(this.bright, this.q[0]); this.blurPair(this.q, 1.5);
    this.bright.u.tSrc.value = this.q[0].texture; this.pass(this.bright, this.e[0]); this.blurPair(this.e, 2.0); this.blurPair(this.e, 3.0);
    // god rays toward the sun
    const sunW = camera.position.clone().add(opts.sunDir.clone().multiplyScalar(1000));
    const sp = sunW.project(camera);
    const behind = camera.getWorldDirection(new THREE.Vector3()).dot(opts.sunDir) < 0.1;
    this.rays.u.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
    this.rays.u.uOn.value = behind ? 0 : 1;
    this.rays.u.tSrc.value = this.paintRT.texture; this.pass(this.rays, this.raysRT);
    const u = this.final.u;
    for (const k of ['uExposure', 'uBloomAmt', 'uRaysAmt', 'uInk', 'uSat', 'uVignette', 'uGrain', 'uCA', 'uFlash', 'uSharpMix', 'uLetter']) if (opts[k] !== undefined) u[k].value = opts[k];
    if (opts.uTint) u.uTint.value.copy(opts.uTint);
    u.uMotion.value.set(...(opts.uMotion || [0, 0])); u.uTitle.value = opts.title || 0;
    u.uTime.value = opts.time ?? 0;
    this.pass(this.final, null);
  }
}
