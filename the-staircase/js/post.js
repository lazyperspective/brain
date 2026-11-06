// THE STAIRCASE v2 - the frame pipeline (perspective or orthographic camera) (all WebGL2, all deterministic):
//   1. normal + ID pass (depth texture) -> outlines, ambient occlusion, atmospheric depth
//   2. colour pass (toon materials, PCF soft shadows), HDR half-float
//   3. composite: sky (gradient, the glow above, circuit-constellations with pulses climbing them), screen-space
//      outlines (silhouette + contact lines), SSAO, atmospheric perspective by depth
//   4. bloom on the emissive parts (quarter resolution, separable blur)
//   5. final: 2x2 box downsample of the supersampled frame, bloom, grade, vignette, dither -> sRGB canvas
(function () {
  const S = window.STAIR, T3 = THREE;

  const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  const SKY = `vec3 srgb2lin(vec3 c){ return pow(c, vec3(2.2)); }

vec3 skyCol(vec2 uv){
  // deep navy below, indigo-violet through the middle, plum toward the top, and the warm glow above it all
  vec3 c0 = srgb2lin(vec3(0.075, 0.105, 0.230));
  vec3 c1 = srgb2lin(vec3(0.150, 0.140, 0.360));
  vec3 c2 = srgb2lin(vec3(0.300, 0.190, 0.430));
  vec3 c3 = srgb2lin(vec3(0.640, 0.360, 0.470));
  float y = uv.y;
  vec3 c = mix(c0, c1, smoothstep(0.0, 0.45, y));
  c = mix(c, c2, smoothstep(0.4, 0.8, y));
  c = mix(c, c3, smoothstep(0.78, 1.05, y) * 0.75);
  vec2 g = (uv - vec2(0.5, 1.04)) * vec2(1.0, 1.3);
  float r2 = dot(g, g);
  c += srgb2lin(vec3(1.0, 0.78, 0.45)) * 0.95 * exp(-r2 * 9.0);
  c += srgb2lin(vec3(1.0, 0.55, 0.45)) * 0.22 * exp(-r2 * 2.6);
  c += vec3(1.0, 0.93, 0.80) * 1.4 * exp(-r2 * 60.0);
  return c;
}
vec3 skyFull(vec2 uv){
  vec3 c = skyCol(uv);
  vec4 sk = texture2D(tSky, uv);
  // circuit traces (r), travel parameter (g), stars/nodes (b); pulses climb the traces toward the glow
  float up = smoothstep(0.35, 1.0, uv.y);
  float trace = sk.r;
  float ph = fract(sk.g * 3.0 - uT / uD * 2.0);
  float pulse = exp(-pow((ph - 0.5) * 9.0, 2.0));
  vec3 tc = mix(vec3(0.45, 0.95, 0.85), vec3(1.0, 0.85, 0.55), smoothstep(0.4, 1.0, uv.y));
  c += srgb2lin(tc) * trace * (0.02 + 0.1 * up + 0.85 * pulse * up) * smoothstep(0.5, 0.82, uv.y);
  float tw = 0.75 + 0.25 * sin(uT / uD * 6.2831853 * 3.0 + sk.a * 40.0);
  c += vec3(1.0, 0.95, 0.88) * sk.b * (0.12 + 0.6 * up) * tw * (0.4 + 0.6 * smoothstep(0.3, 0.7, uv.y));
  return c;
}

`;
  const SKYPASS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSky;
uniform float uT, uD;
${SKY}
void main(){ gl_FragColor = vec4(skyFull(vUv), 1.0); }`;
  const COMPOSITE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor, tNid, tDepth, tSky;
uniform vec2 uPx;            // 1 / resolution
uniform vec2 uView;          // orthographic: frustum width, height (world units); perspective: 2 tan(fov/2) * (aspect, 1)
uniform float uNear, uFar, uT, uD, uCamDist, uPersp;
uniform vec3 uInk;
uniform float uLineW;

float lin(float d){ return uPersp > 0.5 ? uNear * uFar / (uFar - d * (uFar - uNear)) : uNear + d * (uFar - uNear); }
vec3 viewPos(vec2 uv, float z){ return uPersp > 0.5 ? vec3((uv - 0.5) * uView * z, -z) : vec3((uv - 0.5) * uView, -z); }
${SKY}
void main(){
  vec2 uv = vUv;
  vec4 nid = texture2D(tNid, uv);
  float d = texture2D(tDepth, uv).r;
  vec3 col = texture2D(tColor, uv).rgb;
  float bg = step(0.9999, d);
  vec3 sky = skyCol(uv);
  float z = lin(d);
  // ---- ambient occlusion (hemisphere, view space, orthographic)
  float ao = 0.0;
  if (bg < 0.5) {
    vec3 n = vec3(nid.xy * 2.0 - 1.0, 0.0); n.z = sqrt(max(0.0, 1.0 - dot(n.xy, n.xy)));
    vec3 P = viewPos(uv, z);
    float R = 0.42;
    vec2 rpx = uPersp > 0.5 ? vec2(R / (uView.x * z), R / (uView.y * z)) : vec2(R / uView.x, R / uView.y);
    float a0 = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      float rr = sqrt((fi + 0.5) / 14.0);
      float a = a0 + fi * 2.39996;
      vec2 o = vec2(cos(a), sin(a)) * rr * rpx;
      vec2 su = uv + o;
      float sd = texture2D(tDepth, su).r;
      if (sd > 0.9999) continue;
      vec3 Q = viewPos(su, lin(sd));
      vec3 v = Q - P; float vl = length(v);
      float w = 1.0 - smoothstep(R * 0.6, R * 1.6, vl);
      ao += max(0.0, dot(n, v / max(vl, 1e-4)) - 0.12) * w;
    }
    ao = clamp(ao / 14.0 * 1.9, 0.0, 1.0);
  }
  vec3 aoTint = vec3(0.30, 0.22, 0.42);
  col = mix(col, col * aoTint, ao * 0.85);
  // ---- outlines
  float idC = nid.a;
  float edge = 0.0, edgeZ = z;
  float lw = uLineW;
  for (int i = 0; i < 12; i++) {
    float a = float(i) / 12.0 * 6.2831853;
    vec2 dir = vec2(cos(a), sin(a));
    // silhouette (depth step toward the camera)
    vec2 su = uv + dir * uPx * lw;
    vec4 nn = texture2D(tNid, su);
    float sd = texture2D(tDepth, su).r;
    if (sd < 0.9999) {
      float sz = lin(sd);
      float jump = z - sz;
      float thr = 0.18 + 0.004 * max(0.0, sz - uCamDist);
      float w = nn.b;
      if (jump > thr) { float e = w * smoothstep(thr, thr * 1.8, jump); if (e > edge) { edge = e; edgeZ = sz; } }
      // touching objects of different id: a thinner contact line
      vec2 su2 = uv + dir * uPx * lw * 0.45;
      vec4 n2 = texture2D(tNid, su2);
      float sd2 = texture2D(tDepth, su2).r;
      if (sd2 < 0.9999 && abs(n2.a - idC) > 0.5 / 255.0 && lin(sd2) <= z + 0.02 && idC > 0.0) {
        float e2 = 0.85 * min(w, nid.b) * min(n2.b, 1.0);
        if (e2 > edge) { edge = e2; edgeZ = min(z, lin(sd2)); }
      }
      // crease from normals (sharp folds only)
      vec3 na = vec3(nid.xy * 2.0 - 1.0, 0.0), nb = vec3(n2.xy * 2.0 - 1.0, 0.0);
      na.z = sqrt(max(0.0, 1.0 - dot(na.xy, na.xy))); nb.z = sqrt(max(0.0, 1.0 - dot(nb.xy, nb.xy)));
      if (abs(n2.a - idC) < 0.5 / 255.0 && dot(na, nb) < 0.35 && idC > 0.0) { float e3 = 0.6 * nid.b; if (e3 > edge) { edge = e3; edgeZ = z; } }
    }
  }
  // ---- atmospheric perspective: blend toward the sky by depth beyond the stairs
  float fz = max(0.0, (bg > 0.5 ? 1e4 : z) - uCamDist - 6.0);
  float fog = 1.0 - exp(-fz * 0.02);
  vec3 haze = sky * 0.92 + vec3(0.02, 0.025, 0.05);
  vec3 c = bg > 0.5 ? col : mix(col, haze, clamp(fog, 0.0, 0.94));
  // ink lines fade with the depth of the object they belong to
  float fe = 1.0 - exp(-max(0.0, edgeZ - uCamDist - 6.0) * 0.05);
  vec3 ink = mix(uInk, haze * 0.75, clamp(fe, 0.0, 0.9));
  c = mix(c, ink, clamp(edge, 0.0, 1.0) * (1.0 - 0.75 * clamp(fe, 0.0, 1.0)));
  gl_FragColor = vec4(c, 1.0);
}`;

  const BRIGHT = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uPx;
void main(){ vec3 s = vec3(0.0);
  for (int y = -1; y <= 2; y++) for (int x = -1; x <= 2; x++) s += texture2D(tSrc, vUv + (vec2(float(x), float(y)) - 0.5) * uPx).rgb;
  s /= 16.0; float l = max(s.r, max(s.g, s.b)); float k = smoothstep(0.75, 1.6, l);
  gl_FragColor = vec4(s * k, 1.0); }`;
  const BLUR = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
void main(){ vec3 s = texture2D(tSrc, vUv).rgb * 0.2270270270;
  s += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162; s += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  s += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703; s += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(s, 1.0); }`;
  const FINAL = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc, tB1, tB2; uniform vec2 uPx; uniform float uFrame;
vec3 l2s(vec3 c){ c = max(c, 0.0); return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb;            // bilinear at the output pixel centre = exact 2x2 box of the supersampled frame
  vec3 b = texture2D(tB1, vUv).rgb * 0.55 + texture2D(tB2, vUv).rgb * 0.75;
  c += b * 0.9;
  // gentle shoulder so emissive highlights roll off instead of clipping
  c = c / (1.0 + max(0.0, max(c.r, max(c.g, c.b)) - 0.85) * 0.55);
  vec2 q = vUv - 0.5; float vig = 1.0 - 0.32 * smoothstep(0.25, 0.85, length(q * vec2(1.0, 0.85)));
  c *= vig;
  vec3 s = l2s(c);
  float n = fract(sin(dot(gl_FragCoord.xy + uFrame * 7.13, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  s += n / 255.0 * 1.2;
  gl_FragColor = vec4(s, 1.0);
}`;

  function makeSkyTexture(w, h) {
    // circuit-constellations: traces that run upward with right-angle jogs; g = normalised travel along each trace
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const img = g.createImageData(w, h); const D = img.data;
    const put = (x, y, r, gg, b, a) => {
      x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4; D[i] = Math.max(D[i], r); if (r > 0 && gg >= 0) D[i + 1] = gg; D[i + 2] = Math.max(D[i + 2], b); D[i + 3] = a;
    };
    const H = S.U.hash;
    // traces
    for (let k = 0; k < 26; k++) {
      let x = w * (0.04 + 0.92 * H(k * 3.1 + 1)), y = h * (0.05 + 0.25 * H(k * 7.7 + 2));
      const pts = [[x, y]];
      let len = 0;
      for (let seg = 0; seg < 7; seg++) {
        const up = h * (0.06 + 0.12 * H(k * 11 + seg * 5.3));
        y += up; pts.push([x, y]);
        const side = (H(k * 13 + seg * 3.7) - 0.5) * w * 0.12;
        // 45-degree jog toward the top centre
        const toward = (w * 0.5 - x) * 0.18;
        const dx = side + toward; x += dx; y += Math.abs(dx) * 0.8; pts.push([x, y]);
        if (y > h * 0.98) break;
      }
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
      let acc = 0;
      const off = H(k * 5.5);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], sl = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(sl * 1.5);
        for (let q = 0; q <= n; q++) {
          const u = q / n, px = a[0] + (b[0] - a[0]) * u, py = a[1] + (b[1] - a[1]) * u;
          const tr = (acc + sl * u) / len;
          const gv = Math.floor(((tr * 0.999 + off) % 1) * 255);
          put(px, h - 1 - py, 150, gv, 0, 255); put(px + 1, h - 1 - py, 70, gv, 0, 255);
        }
        acc += sl;
        // node dots at the joints
        for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) if (xx * xx + yy * yy <= 4) put(b[0] + xx, h - 1 - b[1] + yy, 255, Math.floor(((acc / len * 0.999 + off) % 1) * 255), 120, 255);
      }
    }
    // stars
    for (let k = 0; k < 160; k++) {
      const x = w * H(k * 1.37 + 9), y = h * (0.15 + 0.85 * Math.pow(H(k * 2.91 + 4), 0.7));
      const big = H(k * 4.1) > 0.85;
      const tw = Math.floor(H(k * 8.8) * 255);
      put(x, h - 1 - y, 0, -1, big ? 255 : 150, tw);
      if (big) { put(x + 1, h - 1 - y, 0, -1, 90, tw); put(x - 1, h - 1 - y, 0, -1, 90, tw); put(x, h - y, 0, -1, 90, tw); put(x, h - 2 - y, 0, -1, 90, tw); }
    }
    for (let i = 3; i < D.length; i += 4) if (D[i] === 0) D[i] = 0;
    g.putImageData(img, 0, 0);
    const tex = new T3.CanvasTexture(cv);
    tex.flipY = false; tex.colorSpace = T3.NoColorSpace; tex.minFilter = T3.LinearFilter; tex.magFilter = T3.LinearFilter; tex.generateMipmaps = false;
    tex.premultiplyAlpha = false;
    return tex;
  }

  class Post {
    constructor(renderer, W, H, SS) {
      this.r = renderer; this.W = W; this.H = H; this.SS = SS;
      const w = W * SS, h = H * SS;
      const dtex = new T3.DepthTexture(w, h); dtex.type = T3.UnsignedIntType; dtex.minFilter = dtex.magFilter = T3.NearestFilter;
      this.rtN = new T3.WebGLRenderTarget(w, h, { type: T3.UnsignedByteType, minFilter: T3.NearestFilter, magFilter: T3.NearestFilter, depthTexture: dtex, depthBuffer: true });
      this.rtC = new T3.WebGLRenderTarget(w, h, { type: T3.HalfFloatType, minFilter: T3.LinearFilter, magFilter: T3.LinearFilter, depthBuffer: true });
      this.rtK = new T3.WebGLRenderTarget(w, h, { type: T3.HalfFloatType, minFilter: T3.LinearFilter, magFilter: T3.LinearFilter, depthBuffer: false });
      const bw = Math.round(W / 4), bh = Math.round(H / 4);
      this.rtB = [0, 1, 2, 3].map((i) => new T3.WebGLRenderTarget(i < 2 ? bw : bw >> 1, i < 2 ? bh : bh >> 1, { type: T3.HalfFloatType, minFilter: T3.LinearFilter, magFilter: T3.LinearFilter, depthBuffer: false }));
      this.quad = new T3.Mesh(new T3.PlaneGeometry(2, 2));
      this.quad.frustumCulled = false;
      this.qs = new T3.Scene(); this.qs.add(this.quad); this.qc = new T3.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.sky = makeSkyTexture(540, 675);
      const mk = (fs, uniforms) => new T3.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
      this.mComp = mk(COMPOSITE, {
        tColor: { value: this.rtC.texture }, tNid: { value: this.rtN.texture }, tDepth: { value: dtex }, tSky: { value: this.sky },
        uPx: { value: new T3.Vector2(1 / w, 1 / h) }, uView: { value: new T3.Vector2(1, 1) }, uNear: { value: 0.1 }, uFar: { value: 100 },
        uT: { value: 0 }, uD: { value: S.D }, uCamDist: { value: 50 }, uPersp: { value: 0 }, uInk: { value: new T3.Color('#1c1433') }, uLineW: { value: 2.6 * SS },
      });
      this.mSky = mk(SKYPASS, { tSky: { value: this.sky }, uT: { value: 0 }, uD: { value: S.D } });
      this.mBright = mk(BRIGHT, { tSrc: { value: this.rtK.texture }, uPx: { value: new T3.Vector2(1 / w, 1 / h) } });
      this.mBlur = mk(BLUR, { tSrc: { value: null }, uDir: { value: new T3.Vector2() } });
      this.mCopyBright = mk(BRIGHT, { tSrc: { value: null }, uPx: { value: new T3.Vector2() } });
      this.mFinal = mk(FINAL, { tSrc: { value: this.rtK.texture }, tB1: { value: this.rtB[0].texture }, tB2: { value: this.rtB[2].texture }, uPx: { value: new T3.Vector2(1 / W, 1 / H) }, uFrame: { value: 0 } });
    }
    pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.qc); }
    render(scene, camera, meshes, t, frame) {
      const r = this.r;
      // 1. normals + ids
      const swaps = [];
      for (const m of meshes) { if (m.userData.nid) { m.material = m.userData.nid; } else if (m.visible) { swaps.push(m); m.visible = false; } }
      const bgc = scene.background; scene.background = null;
      r.setClearColor(0x808000, 0); r.setRenderTarget(this.rtN); r.clear();
      const sm = r.shadowMap.enabled; r.shadowMap.autoUpdate = false;
      r.render(scene, camera);
      for (const m of meshes) if (m.userData.nid) m.material = m.userData.mat;
      for (const m of swaps) m.visible = true;
      // 2. colour
      r.shadowMap.autoUpdate = true; r.shadowMap.needsUpdate = true;
      r.setClearColor(0x000000, 1); r.setRenderTarget(this.rtC); r.clear();
      this.mSky.uniforms.uT.value = t;
      this.quad.material = this.mSky; r.render(this.qs, this.qc);      // sky first, so translucent things blend over it
      const ac = r.autoClear; r.autoClear = false; r.clearDepth();
      r.render(scene, camera);
      r.autoClear = ac;
      scene.background = bgc;
      // 3. composite
      const u = this.mComp.uniforms;
      if (camera.isPerspectiveCamera) { const th = Math.tan(camera.fov * Math.PI / 360); u.uView.value.set(2 * th * camera.aspect, 2 * th); u.uPersp.value = 1; }
      else { u.uView.value.set(camera.right - camera.left, camera.top - camera.bottom); u.uPersp.value = 0; }
      u.uNear.value = camera.near; u.uFar.value = camera.far;
      u.uT.value = t; u.uCamDist.value = camera.userData.dist;
      this.pass(this.mComp, this.rtK);
      // 4. bloom
      this.mBright.uniforms.uPx.value.set(1 / (this.W * this.SS), 1 / (this.H * this.SS));
      this.pass(this.mBright, this.rtB[0]);
      const b = this.rtB;
      this.mBlur.uniforms.tSrc.value = b[0].texture; this.mBlur.uniforms.uDir.value.set(1 / b[0].width, 0); this.pass(this.mBlur, b[1]);
      this.mBlur.uniforms.tSrc.value = b[1].texture; this.mBlur.uniforms.uDir.value.set(0, 1 / b[0].height); this.pass(this.mBlur, b[0]);
      this.mCopyBright.uniforms.tSrc.value = b[0].texture; this.mCopyBright.uniforms.uPx.value.set(1 / b[0].width, 1 / b[0].height);
      this.mBlur.uniforms.tSrc.value = b[0].texture; this.mBlur.uniforms.uDir.value.set(2 / b[2].width, 0); this.pass(this.mBlur, b[3]);
      this.mBlur.uniforms.tSrc.value = b[3].texture; this.mBlur.uniforms.uDir.value.set(0, 2 / b[2].height); this.pass(this.mBlur, b[2]);
      // 5. final
      this.mFinal.uniforms.uFrame.value = frame || 0;
      this.pass(this.mFinal, null);
    }
  }
  S.Post = Post;
})();
