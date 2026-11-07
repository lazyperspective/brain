// WebGL2 renderer: every dab is an instanced quad. Pass 1 lays the dabs down in painting order into two float
// targets, colour (premultiplied, linear light) and paint height. Pass 2 lights the paint surface (impasto: each dab
// gets a lit edge and a shadowed edge from the studio light, upper left) over the primed canvas with its weave.
// Pass 3 resamples to the output size and encodes sRGB. All motion is computed in the vertex shader from t.
(function (G) {
  'use strict';
  const VS_DAB = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 iA;
layout(location=2) in vec4 iB;
layout(location=3) in vec4 iC0;
layout(location=4) in vec4 iC1;
layout(location=5) in vec4 iP;
layout(location=6) in vec4 iQ;
uniform float uPh;
uniform vec2 uMaster;
uniform float uScale;
out vec2 vUV; out vec4 vCol; out float vH; out float vSeed; out float vThin; out float vPx;
const float TAU = 6.28318530718;
void main(){
  vec2 pos = iA.xy; float len = iA.z, wid = iA.w; float ang = iB.x; float type = iB.w;
  vec3 col = iC0.rgb; float thin = 0.0;
  if (type > 0.5 && type < 1.5) {            // water: the dab's colour drifts between two reflections, now and then a glint
    float w = smoothstep(0.12, 0.88, 0.5 + 0.5*sin(TAU*(iC1.a*uPh + iP.x)));
    col = mix(iC0.rgb, iC1.rgb, w*iP.y);
    float sp = pow(max(0.0, sin(TAU*(iP.z*uPh + iP.w))), 14.0) * iQ.x;
    col = mix(col, vec3(1.0, 0.93, 0.78), sp);
    pos.x += iQ.y * sin(TAU*(iC1.a*uPh + iP.x + 0.25));
    len *= 1.0 + 0.2*sp;
  } else if ((type > 1.5 && type < 2.5) || (type > 5.5 && type < 6.5)) {  // a poplar swaying as one
    float hrel = clamp((iP.x - pos.y)/iP.y, 0.0, 1.0);
    float s = 0.74*sin(TAU*(uPh + iP.z)) + 0.26*sin(TAU*(3.0*uPh + iQ.x));
    float dx = iP.w * pow(hrel, 1.6) * s;
    pos.x += dx; pos.y += 0.1*abs(dx)*hrel;
    ang += 0.6*dx/iP.y;
    if (type > 5.5) thin = 1.0;
  } else if (type > 2.5 && type < 3.5) {     // far fields under a drifting cloud shadow
    float dz = max(pos.y - 1290.0, 0.0);
    float u = (pos.x - 1080.0)/(2160.0*(1.0 + dz/420.0)) - uPh;   // nearer ground: shadows broader, a little faster
    float yy = dz/(40.0*(1.0 + dz/110.0));                        // depth, compressed toward the horizon
    float f = 0.55*cos(TAU*u + 0.35*yy + 1.0) + 0.3*cos(TAU*2.0*u - 0.6*yy + 2.3) + 0.17*cos(TAU*3.0*u + 0.9*yy + 4.1) + 0.09*cos(TAU*5.0*u - yy + 0.7);
    float m = smoothstep(0.18 + iP.x - 0.16, 0.18 + iP.x + 0.16, f);
    col = mix(iC0.rgb, iC1.rgb, m);
  } else if (type > 3.5 && type < 4.5) {     // grass bending in a passing breath of wind
    float ph = TAU*(iC1.a*uPh - pos.x/iP.x - pos.y/iP.y + iP.z);
    float w = pow(0.5 + 0.5*sin(ph), 3.0);
    col = mix(iC0.rgb, iC1.rgb, w*iP.w);
    ang += 0.12*w*iQ.x; pos.x += 1.4*w*iQ.x;
  } else if (type > 4.5 && type < 5.5) {
    thin = 1.0;
  }
  float c = cos(ang), s = sin(ang);
  vec2 q = aQ * 1.2;
  vec2 off = vec2(q.x*len*0.5, q.y*wid*0.5);
  vec2 p = pos + vec2(c*off.x - s*off.y, s*off.x + c*off.y);
  vec2 ndc = vec2(p.x/uMaster.x*2.0 - 1.0, 1.0 - p.y/uMaster.y*2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
  vUV = q; vCol = vec4(col, iC0.a); vH = iB.y; vSeed = iB.z; vThin = thin; vPx = min(len, wid)*uScale;
}`;
  const FS_DAB = `#version 300 es
precision highp float;
in vec2 vUV; in vec4 vCol; in float vH; in float vSeed; in float vThin; in float vPx;
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
void main(){
  vec2 uv = vUV;
  float a = atan(uv.y, uv.x);
  float sd = vSeed*61.0;
  float rr = 1.0 + 0.085*sin(3.0*a + sd) + 0.055*sin(5.0*a + sd*1.7) + 0.03*sin(9.0*a + sd*2.3);
  float n = 2.3;
  float d = pow(pow(abs(uv.x), n) + pow(abs(uv.y), n), 1.0/n) / rr;
  float fw = max(fwidth(d), 1e-4);
  float cov = 1.0 - smoothstep(1.0 - fw, 1.0 + fw, d);
  if (cov <= 0.002) discard;
  float alpha = cov * vCol.a;
  float dome = sqrt(max(0.0, 1.0 - min(d*d, 1.0)));
  float dir = fract(vSeed*7.31) > 0.5 ? 1.0 : -1.0;
  float load = 0.78 + 0.3*uv.x*dir;                         // the brush is loaded at one end of the touch
  float ridge = 0.5*sin(uv.y*7.0 + sd) + 0.3*sin(uv.y*15.0 + sd*2.0); // bristle furrows along the stroke
  float rim = smoothstep(0.6, 0.92, d) * (1.0 - smoothstep(0.92, 1.04, d));
  float h = vH * (pow(dome, 0.85)*load + 0.1*ridge*dome + 0.12*rim);
  vec3 col = vCol.rgb * (1.0 + 0.035*ridge*dome);
  if (vThin > 0.5) { h *= 0.18; }
  o0 = vec4(col*alpha, alpha);
  o1 = vec4(h*alpha, alpha, 0.0, (vThin > 0.5 ? 0.9 : 0.5)*alpha);
}`;
  const VS_FULL = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQ;
out vec2 vT;
void main(){ vT = aQ*0.5 + 0.5; gl_Position = vec4(aQ, 0.0, 1.0); }`;
  const FS_COMP = `#version 300 es
precision highp float;
uniform sampler2D uC; uniform sampler2D uHt; uniform sampler2D uWv;
uniform vec2 uRes; uniform float uScale; uniform vec2 uMaster;
in vec2 vT;
out vec4 o;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
// linen weave: alternating over/under threads with slubs
float weave(vec2 p){
  vec2 q = p / 5.2;
  vec2 c = floor(q); vec2 f = fract(q);
  float slubX = 0.75 + 0.5*vn(vec2(c.y*3.1, p.x/40.0));
  float slubY = 0.75 + 0.5*vn(vec2(c.x*2.7 + 9.0, p.y/40.0));
  float tx = sin(3.14159*f.y) * slubX;   // horizontal thread profile
  float ty = sin(3.14159*f.x) * slubY;   // vertical thread profile
  float over = mod(c.x + c.y, 2.0);
  float hx = tx * (0.55 + 0.45*(over > 0.5 ? sin(3.14159*f.x) : 0.3));
  float hy = ty * (0.55 + 0.45*(over < 0.5 ? sin(3.14159*f.y) : 0.3));
  return max(hx, hy);
}
float H(ivec2 ip){
  ip = clamp(ip, ivec2(0), ivec2(uRes) - 1);
  vec4 h = texelFetch(uHt, ip, 0);
  float th = clamp(h.g*1.1, 0.0, 1.0);
  return h.r + 1.1*texelFetch(uWv, ip, 0).r*(1.0 - 0.85*th);
}
void main(){
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec4 c = texelFetch(uC, ip, 0);
  float hl = H(ip + ivec2(-1, 0)), hr = H(ip + ivec2(1, 0)), hd = H(ip + ivec2(0, -1)), hu = H(ip + ivec2(0, 1));
  float dx = (hr - hl) * 0.5 * uScale, dy = (hu - hd) * 0.5 * uScale;
  vec3 n = normalize(vec3(-dx*0.32, -dy*0.32, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.62, 0.56));
  float diff = dot(n, L) / L.z;
  float shade = clamp(mix(1.0, diff, 0.75), 0.72, 1.25);
  vec3 Hh = normalize(L + vec3(0.0, 0.0, 1.0));
  float th = clamp(texelFetch(uHt, ip, 0).g, 0.0, 1.0);
  float spec = max(0.0, pow(max(dot(n, Hh), 0.0), 40.0) - pow(Hh.z, 40.0)) * 0.10 * th;
  vec2 mp = (vec2(ip) + 0.5) / uScale;
  // primed canvas, a little warm, uneven
  vec3 ground = vec3(0.80, 0.76, 0.66) * (0.94 + 0.08*vn(mp/37.0));
  vec3 col = ground*(1.0 - c.a) + c.rgb;
  col = col*shade + vec3(spec);
  o = vec4(col, 1.0);
}`;
  const FS_WEAVE = FS_COMP.replace(/void main\(\)\{[\s\S]*$/, `void main(){
  vec2 mp = (floor(gl_FragCoord.xy) + 0.5) / uScale;
  o = vec4(weave(mp), 0.0, 0.0, 1.0);
}`);
  const FS_COPY = `#version 300 es
precision highp float;
uniform sampler2D uB0; uniform sampler2D uB1;
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
void main(){ ivec2 ip = ivec2(gl_FragCoord.xy); o0 = texelFetch(uB0, ip, 0); o1 = texelFetch(uB1, ip, 0); }`;
  const FS_OUT = `#version 300 es
precision highp float;
uniform sampler2D uS; uniform vec2 uSrc; uniform vec2 uDst; uniform float uFlip; uniform float uHalf;
in vec2 vT;
out vec4 o;
vec3 enc(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 px = gl_FragCoord.xy;
  if (uFlip > 0.5) px.y = uDst.y - px.y;
  vec3 c;
  if (uHalf > 0.5) {
    // 2x downscale with a [1 3 3 1]/8 kernel per axis, as four bilinear taps
    vec2 b = floor(px) * 2.0;
    c = 0.25*(texture(uS, (b + vec2(0.25, 0.25))/uSrc).rgb + texture(uS, (b + vec2(1.75, 0.25))/uSrc).rgb
            + texture(uS, (b + vec2(0.25, 1.75))/uSrc).rgb + texture(uS, (b + vec2(1.75, 1.75))/uSrc).rgb);
  } else {
    c = texture(uS, px/uDst).rgb;
  }
  o = vec4(enc(c), 1.0);
}`;

  function Renderer(canvas, data, opts) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) gl.getExtension('EXT_color_buffer_half_float');
    this.gl = gl; this.canvas = canvas;
    this.MW = opts.width; this.MH = opts.height;
    const prog = (vs, fs) => {
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    };
    this.pDab = prog(VS_DAB, FS_DAB); this.pComp = prog(VS_FULL, FS_COMP); this.pOut = prog(VS_FULL, FS_OUT);
    this.pWeave = prog(VS_FULL, FS_WEAVE); this.pCopy = prog(VS_FULL, FS_COPY);
    // geometry: one instance buffer, two views of it (static dabs, then dynamic dabs)
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const inst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.bufferData(gl.ARRAY_BUFFER, data.buf, gl.STATIC_DRAW);
    const view = (first) => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      for (let i = 0; i < 6; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, 96, first * 96 + i * 16); gl.vertexAttribDivisor(1 + i, 1); }
      return vao;
    };
    this.nStatic = data.nStatic; this.nDyn = data.count - data.nStatic;
    this.vaoStatic = view(0); this.vaoDyn = view(data.nStatic);
    this.count = data.count;
    this.vaoFull = gl.createVertexArray(); gl.bindVertexArray(this.vaoFull);
    const fq = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fq);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.targets = {};
  }
  Renderer.prototype.tex = function (w, h, fmt, filter) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  Renderer.prototype.mrt = function (c, h) {
    const gl = this.gl, fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, c, 0);
    if (h) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, h, 0);
    return fb;
  };
  Renderer.prototype.full = function (prog, fb, T, bufs) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.drawBuffers(bufs); gl.viewport(0, 0, T.w, T.h);
    gl.useProgram(prog); gl.bindVertexArray(this.vaoFull); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  Renderer.prototype.dabs = function (vao, n, ph, scale) {
    const gl = this.gl;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.pDab);
    gl.uniform1f(gl.getUniformLocation(this.pDab, 'uPh'), ph);
    gl.uniform2f(gl.getUniformLocation(this.pDab, 'uMaster'), this.MW, this.MH);
    gl.uniform1f(gl.getUniformLocation(this.pDab, 'uScale'), scale);
    gl.bindVertexArray(vao);
    if (n > 0) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.disable(gl.BLEND);
  };
  Renderer.prototype.setup = function (scale) {
    if (this.targets.scale === scale) return this.targets;
    const gl = this.gl, A0 = gl.COLOR_ATTACHMENT0, A1 = gl.COLOR_ATTACHMENT1;
    const w = Math.round(this.MW * scale), h = Math.round(this.MH * scale);
    const T = { scale, w, h };
    T.cTex = this.tex(w, h, gl.RGBA16F, gl.NEAREST); T.hTex = this.tex(w, h, gl.RGBA16F, gl.NEAREST); T.fbDab = this.mrt(T.cTex, T.hTex);
    T.bcTex = this.tex(w, h, gl.RGBA16F, gl.NEAREST); T.bhTex = this.tex(w, h, gl.RGBA16F, gl.NEAREST); T.fbBake = this.mrt(T.bcTex, T.bhTex);
    T.compTex = this.tex(w, h, gl.RGBA16F, gl.LINEAR); T.fbComp = this.mrt(T.compTex);
    T.wvTex = this.tex(w, h, gl.RGBA16F, gl.NEAREST); T.fbWv = this.mrt(T.wvTex);
    this.targets = T;
    // the canvas weave, once
    gl.useProgram(this.pWeave);
    gl.uniform1f(gl.getUniformLocation(this.pWeave, 'uScale'), scale);
    this.full(this.pWeave, T.fbWv, T, [A0]);
    // the static paint, once (it does not depend on t)
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbBake); gl.drawBuffers([A0, A1]); gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    this.dabs(this.vaoStatic, this.nStatic, 0, scale);
    return T;
  };
  // draw the painting at time phase ph (t / duration) at render scale `scale` into the composite texture
  Renderer.prototype.paint = function (ph, scale) {
    const gl = this.gl, T = this.setup(scale), A0 = gl.COLOR_ATTACHMENT0, A1 = gl.COLOR_ATTACHMENT1;
    // start from the baked static paint, then lay the moving dabs over it
    gl.useProgram(this.pCopy);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.bcTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.bhTex);
    gl.uniform1i(gl.getUniformLocation(this.pCopy, 'uB0'), 0); gl.uniform1i(gl.getUniformLocation(this.pCopy, 'uB1'), 1);
    this.full(this.pCopy, T.fbDab, T, [A0, A1]);
    this.dabs(this.vaoDyn, this.nDyn, ph, scale);
    // light the surface
    gl.useProgram(this.pComp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.cTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.hTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.wvTex);
    gl.uniform1i(gl.getUniformLocation(this.pComp, 'uC'), 0); gl.uniform1i(gl.getUniformLocation(this.pComp, 'uHt'), 1); gl.uniform1i(gl.getUniformLocation(this.pComp, 'uWv'), 2);
    gl.uniform2f(gl.getUniformLocation(this.pComp, 'uRes'), T.w, T.h);
    gl.uniform2f(gl.getUniformLocation(this.pComp, 'uMaster'), this.MW, this.MH);
    gl.uniform1f(gl.getUniformLocation(this.pComp, 'uScale'), scale);
    this.full(this.pComp, T.fbComp, T, [A0]);
  };
  // resample the composite to (dw, dh) into the bound framebuffer (null = canvas). half: dw = w/2 exactly
  Renderer.prototype.output = function (fb, dw, dh, flip, half) {
    const gl = this.gl, T = this.targets;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    if (fb) gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.viewport(0, 0, dw, dh);
    gl.useProgram(this.pOut);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.compTex);
    gl.uniform1i(gl.getUniformLocation(this.pOut, 'uS'), 0);
    gl.uniform2f(gl.getUniformLocation(this.pOut, 'uSrc'), T.w, T.h);
    gl.uniform2f(gl.getUniformLocation(this.pOut, 'uDst'), dw, dh);
    gl.uniform1f(gl.getUniformLocation(this.pOut, 'uFlip'), flip ? 1 : 0);
    gl.uniform1f(gl.getUniformLocation(this.pOut, 'uHalf'), half ? 1 : 0);
    gl.bindVertexArray(this.vaoFull);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  // render and read back RGBA rows top-down: full master size (half=false) or half size (half=true)
  Renderer.prototype.readback = function (ph, half, scale) {
    const gl = this.gl;
    scale = scale || 1;
    this.paint(ph, scale);
    const dw = Math.round((half ? this.MW / 2 : this.MW) * scale), dh = Math.round((half ? this.MH / 2 : this.MH) * scale);
    const key = dw + 'x' + dh;
    if (!this.rb || this.rb.key !== key) {
      const t = this.tex(dw, dh, gl.RGBA8, gl.NEAREST);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      this.rb = { key, fb, px: new Uint8Array(dw * dh * 4), dw, dh };
    }
    this.output(this.rb.fb, dw, dh, true, half);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.rb.fb);
    gl.readPixels(0, 0, dw, dh, gl.RGBA, gl.UNSIGNED_BYTE, this.rb.px);
    return this.rb;
  };
  G.Renderer = Renderer;
})(window);
