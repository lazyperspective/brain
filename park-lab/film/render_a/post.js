// Post-processing: gouache (Kuwahara paint flattening, stroke-following bristles, pigment pooling, paper,
// abandoned->alive grade for shot 07) and pixel (outline + palette quantisation with Bayer dithering).
import * as THREE from 'three';
import { NOISE } from './mats.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
function pass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const s = new THREE.Scene(); const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); q.frustumCulled = false; s.add(q); return { m, s };
}
const CAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export function gouachePost(renderer, W, H) {
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  rt.depthTexture = new THREE.DepthTexture(W, H); rt.depthTexture.type = THREE.UnsignedIntType;
  const rt2 = new THREE.WebGLRenderTarget(W >> 1, H >> 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const px = new THREE.Vector2(1 / W, 1 / H);
  // pass 1: wobble + generalised Kuwahara (8 sectors approximated by 4 overlapping quadrants, radius 3) + stroke-aligned bristles
  const p1 = pass(`precision highp float; varying vec2 vUv; uniform sampler2D tC; uniform sampler2D tD; uniform vec2 px; uniform float uT; uniform float uR;
    ${NOISE}
    vec3 S(vec2 uv){ return texture2D(tC, uv).rgb; }
    void main(){
      vec2 uv = vUv; vec2 wob = vec2(fbm3(uv*vec2(48.,27.)), fbm3(uv*vec2(48.,27.)+7.3)) - .5; uv += wob*px*3.5;
      vec3 m0=vec3(0.),m1=vec3(0.),m2=vec3(0.),m3=vec3(0.), s0=vec3(0.),s1=vec3(0.),s2=vec3(0.),s3=vec3(0.);
      for(int j=-3;j<=3;j++) for(int i=-3;i<=3;i++){
        vec3 c = S(uv + vec2(float(i),float(j))*px*uR);
        if(i<=0 && j<=0){ m0+=c; s0+=c*c; } if(i>=0 && j<=0){ m1+=c; s1+=c*c; }
        if(i<=0 && j>=0){ m2+=c; s2+=c*c; } if(i>=0 && j>=0){ m3+=c; s3+=c*c; }
      }
      m0/=16.; m1/=16.; m2/=16.; m3/=16.;
      float v0 = dot(abs(s0/16.-m0*m0), vec3(1.)), v1 = dot(abs(s1/16.-m1*m1), vec3(1.)), v2 = dot(abs(s2/16.-m2*m2), vec3(1.)), v3 = dot(abs(s3/16.-m3*m3), vec3(1.));
      float w0 = 1./(1.+pow(v0*600.,2.)), w1 = 1./(1.+pow(v1*600.,2.)), w2 = 1./(1.+pow(v2*600.,2.)), w3 = 1./(1.+pow(v3*600.,2.));
      vec3 c = (m0*w0+m1*w1+m2*w2+m3*w3)/(w0+w1+w2+w3);
      c = mix(c, S(uv), .15);
      gl_FragColor = vec4(c, 1.);
    }`, { tC: { value: rt.texture }, tD: { value: rt.depthTexture }, px: { value: px }, uT: { value: 0 }, uR: { value: 2.2 } });
  // pass 2: pigment pooling (colour + depth edges), paper grain, granulation, vignette, warm grade, abandoned grade
  const p2 = pass(`precision highp float; varying vec2 vUv; uniform sampler2D tC; uniform sampler2D tF; uniform sampler2D tD; uniform vec2 px; uniform float uT;
    uniform float uWakeOn; uniform float uTime; uniform mat4 uInvVP; uniform vec3 uCam; uniform vec3 uWakeO; uniform vec3 uCamW; uniform float uLamp; uniform vec2 uLampUV;
    ${NOISE}
    float D(vec2 uv){ return texture2D(tD, uv).r; }
    vec3 lin2s(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
    float LS(vec2 uv){ return dot(lin2s(clamp(texture2D(tC,uv).rgb,0.,1.)), vec3(.3,.59,.11)); }
    float lin(float d){ float n = .3, f = 6000.; return 2.*n*f/(f+n-(2.*d-1.)*(f-n)); }
    vec3 worldAt(vec2 uv, float d){ vec4 p = uInvVP*vec4(uv*2.-1., d*2.-1., 1.); return p.xyz/p.w; }
    void main(){
      vec2 uv = vUv; vec3 c = lin2s(clamp(mix(texture2D(tC, uv).rgb, texture2D(tF, uv).rgb, .3), 0., 1.));
      // brush dabs: each screen cell carries one elongated stroke whose paint is the colour at its centre;
      // strokes only blend into similar colours so shapes keep their edges
      { vec2 P = uv/px; const float CS = 11.; vec2 gc = floor(P/CS); vec3 acc = vec3(0.); float ws = 0.;
        for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){
          vec2 cell = gc + vec2(i,j); vec2 ctr = (cell + .5 + (vec2(h21(cell), h21(cell+13.)) - .5)*.9)*CS;
          float ang = (fbm3(ctr*px*2.5) - .5)*2.6 - .5 + (h21(cell+5.) - .5)*.7; vec2 d = vec2(cos(ang), sin(ang));
          vec2 r = P - ctr; float u = dot(r, d)/(CS*1.35), v = dot(r, vec2(-d.y, d.x))/(CS*.55);
          float sh = smoothstep(1., .55, abs(u))*smoothstep(1., .35, abs(v)); if (sh <= 0.) continue;
          vec3 sc = lin2s(clamp(texture2D(tC, ctr*px).rgb, 0., 1.));
          float sim = exp(-dot(sc-c, sc-c)*90.);
          float bristle = .85 + .3*vn(vec2(u*2.5, v*7.) + cell*3.1);
          float w = sh*sim*(.5 + h21(cell+7.)); acc += sc*bristle*w; ws += w; }
        if (ws > 0.) c = mix(c, acc/ws, clamp(ws, 0., 1.)*.75); }
      float lum = dot(c, vec3(.3,.59,.11));
      // pigment pooling at colour edges
      float l1=LS(uv+vec2(2.,0.)*px), l2=LS(uv-vec2(2.,0.)*px), l3=LS(uv+vec2(0.,2.)*px), l4=LS(uv-vec2(0.,2.)*px);
      float g = length(vec2(l1-l2,l3-l4)); c *= 1. - .16*smoothstep(.04,.3,g);
      // soft painted outline at depth discontinuities (darker, slightly cool)
      float d0 = D(uv); float z0 = lin(d0); float zmax = 0.;
      for (int k=0;k<4;k++){ vec2 o = vec2(k==0?1.5:k==1?-1.5:0., k==2?1.5:k==3?-1.5:0.)*px; float z = lin(D(uv+o)); zmax = max(zmax, (z - z0)/z0); }
      float ol = smoothstep(.06,.35,zmax)*(1.-smoothstep(1500.,3000.,z0)); c = mix(c, c*vec3(.55,.5,.6), ol*.45);
      // abandoned -> alive (shot 07)
      if (uWakeOn > .5) {
        vec3 wp = d0 < .99999 ? worldAt(uv, d0) : uCam + normalize(worldAt(uv, .9) - uCam)*600.;
        float dl = length((wp.xz - uWakeO.xz)); float dc = length(wp.xz - uCamW.xz);
        float near = pow(clamp(1. - dc/55., 0., 1.), 1.5);
        float arr = 24.5 + .55*dl/50. + 1.9*near + (fbm3(wp.xz*.035) - .5)*.55;
        if (d0 >= .99999) arr = 25.4 + (fbm3(uv*vec2(3.,2.)) - .5)*.6 + .6*(1.-uv.y);
        float w = smoothstep(0., .45, uTime - arr);
        vec3 ab = vec3(lum); ab = mix(ab, c, .18); ab = ab*vec3(.88,.92,.92) + vec3(.02,.03,.03);
        // rust/grime on lit structures, mist banks low and far
        ab = mix(ab, ab*vec3(1.05,.9,.78), .25*smoothstep(.4,.7,fbm3(wp.xz*.4 + wp.y*.3)));
        float mist = fbm3(uv*vec2(2.2,5.) + vec2(uTime*.06, uTime*.01));
        float hgt = clamp(1. - (wp.y - 0.)/18., 0., 1.); float far = smoothstep(20., 140., length(wp - uCam));
        ab = mix(ab, vec3(.68,.72,.73), clamp((.3 + .6*mist)*(.4 + .6*far)*(.45+.55*hgt), 0., .86));
        ab *= .84;
        vec3 alive = c*vec3(1.04,1.01,.95); alive = mix(vec3(dot(alive,vec3(.3,.59,.11))), alive, 1.12);
        c = mix(ab, alive, w);
        float band = w*(1.-w)*4.; c += vec3(1.,.8,.5)*band*.12;
      }
      // lighthouse lamp glow
      if (uLamp > 0.) { vec2 dv = (uv - uLampUV)*vec2(1.7778,1.); float r = length(dv); c += vec3(1.,.85,.55)*uLamp*(exp(-r*r*900.)*1.2 + exp(-r*r*60.)*.25); }
      // paper: fibres + granulation + tooth
      float grain = fbm3(uv*vec2(720.,405.)); float fib = vn(uv*vec2(2400.,140.))*vn(uv*vec2(120.,1400.));
      c *= .955 + .075*grain - .05*fib;
      c *= 1. - .08*(vn(uv*vec2(1100.,620.))-.5)*(1.-lum);
      // warm grade + gentle vignette
      c = mix(c, c*vec3(1.04,.99,.9), .35);
      float sat = .08; float L2 = dot(c, vec3(.3,.59,.11)); c = mix(vec3(L2), c, 1. + sat);
      float vg = length((vUv-vec2(.5,.48))*vec2(1.25,1.)); c *= 1. - .28*pow(vg, 2.4);
      gl_FragColor = vec4(c, 1.);
    }`, { tC: { value: rt2.texture }, tF: { value: rt.texture }, tD: { value: rt.depthTexture }, px: { value: px }, uT: { value: 0 }, uWakeOn: { value: 0 }, uTime: { value: 0 }, uInvVP: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uWakeO: { value: new THREE.Vector3(-218, 16, 52) }, uCamW: { value: new THREE.Vector3(-175, 0, 88) }, uLamp: { value: 0 }, uLampUV: { value: new THREE.Vector2() } });
  return {
    rt, p1, p2,
    render(scene, camera, t) {
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      p1.m.uniforms.uT.value = t; renderer.setRenderTarget(rt2); renderer.render(p1.s, CAM);
      const u = p2.m.uniforms; u.uTime.value = t; u.uInvVP.value.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).invert(); u.uCam.value.copy(camera.position);
      renderer.setRenderTarget(null); renderer.render(p2.s, CAM);
    },
  };
}

// palette for the pixel style: prototype palette + park key colours
const PAL = ['#2f7d3a', '#3f9a43', '#56b04a', '#78c656', '#1f5a34', '#2c6f37', '#e8c690', '#d3a86c', '#b4844e', '#f4dcb4', '#e7a6a0', '#2a6fc9', '#3f8fe6', '#9fd8ff', '#1d4f99',
  '#a8784a', '#8a5d38', '#e43b44', '#a22633', '#f4f4f4', '#c0cbdc', '#8b9bb4', '#5a6988', '#262b44', '#feae34', '#f77622', '#ff6fa8', '#c23f7d', '#3a6ee8', '#26419c', '#2ce8d0', '#1b9e8f',
  '#9a4fd8', '#5f2f96', '#9e5b30', '#6b3b22', '#f2c39a', '#b9774f', '#3b2416', '#1f6b3a', '#2f8f45', '#5cbf4e', '#9be05c', '#ffd541', '#ff8a2a', '#fff1d6', '#8cf2b0',
  '#e23b2e', '#f4ebd9', '#d9b98c', '#6b4a2e', '#2bb3a3', '#f5c542', '#b5563f', '#7a3b2e', '#4e5d6c', '#cdbb97', '#d8d2c4', '#c49a6c', '#55585c', '#3d4046', '#7f8c8d', '#e8dcc8', '#1f2a44', '#f5a6c8', '#a8d8ea'];
export function pixelPost(renderer, NW, NH) {
  const rt = new THREE.WebGLRenderTarget(NW, NH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  rt.depthTexture = new THREE.DepthTexture(NW, NH); rt.depthTexture.type = THREE.UnsignedIntType;
  const pal = PAL.map(h => new THREE.Color(h)); // three Color.set on hex strings -> linear in r160 with colour management; we want sRGB values
  const palV = PAL.map(h => { const n = parseInt(h.slice(1), 16); return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); });
  const p = pass(`precision highp float; varying vec2 vUv; uniform sampler2D tC; uniform sampler2D tD; uniform vec2 px; uniform vec3 uPal[${PAL.length}]; uniform float uNear; uniform float uFar; uniform float uThr;
    float bayer(vec2 p){ int x = int(mod(p.x,4.)), y = int(mod(p.y,4.)); int i = x + y*4; int b[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return (float(b[i])+.5)/16.; }
    vec3 lin2s(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
    float Z(vec2 uv){ return uNear + texture2D(tD, uv).r*(uFar-uNear); }
    void main(){
      vec2 uv = vUv; vec3 c = lin2s(clamp(texture2D(tC, uv).rgb, 0., 1.));
      // outline: this pixel is in front of a much farther neighbour -> darken (silhouette ink)
      float z0 = Z(uv); float dz = 0.;
      dz = max(dz, Z(uv+vec2(px.x,0.)) - z0); dz = max(dz, Z(uv-vec2(px.x,0.)) - z0); dz = max(dz, Z(uv+vec2(0.,px.y)) - z0); dz = max(dz, Z(uv-vec2(0.,px.y)) - z0);
      float edge = step(uThr, dz);
      c = mix(c, c*vec3(.55,.52,.62), edge*.85);
      // nearest + second nearest palette colour, ordered dither between them
      float d1 = 1e9, d2 = 1e9; vec3 c1 = c, c2 = c;
      vec3 w = vec3(.30,.59,.11)*3.;
      for (int i = 0; i < ${PAL.length}; i++){ vec3 e = (uPal[i]-c); float d = dot(e*e, w); if (d < d1){ d2 = d1; c2 = c1; d1 = d; c1 = uPal[i]; } else if (d < d2){ d2 = d; c2 = uPal[i]; } }
      float r = sqrt(d1)/(sqrt(d1)+sqrt(d2)+1e-6);
      vec3 o = (bayer(gl_FragCoord.xy) < r*1.15 - .12) ? c2 : c1;
      gl_FragColor = vec4(o, 1.);
    }`, { tC: { value: rt.texture }, tD: { value: rt.depthTexture }, px: { value: new THREE.Vector2(1 / NW, 1 / NH) }, uPal: { value: palV }, uNear: { value: 0 }, uFar: { value: 1 }, uThr: { value: 2 } });
  return {
    rt, p,
    render(scene, camera, t) {
      // render scene into rt with sRGB-encoded output so the palette compare happens in display space
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      const u = p.m.uniforms; u.uNear.value = camera.near; u.uFar.value = camera.far;
      renderer.setRenderTarget(null); renderer.render(p.s, CAM);
    },
  };
}
