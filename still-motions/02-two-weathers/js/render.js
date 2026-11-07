// Two Weathers: WebGL2 lighting of the painted height field.
// Pass 1 (scene, at the map resolution or a multiple): normals from the slope map, a raking key light from a window
// whose direction swings slowly over the loop, soft height-field shadows (ray-marched toward the light), GGX
// specular weighted by the gloss map (oil sheen on ridges and plateaus, matte sunk-in ground), a cool room fill
// with cavity occlusion, and the faint breathing of the glaze layers. Output: display-linear RGBA16F.
// Pass 2 (resolve): area-filtered downsample, sRGB encode, static dither.
(function (root) {
  'use strict';
  const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

  const FS_SCENE = `#version 300 es
precision highp float;
uniform sampler2D tH, tG, tA, tM;
uniform vec2 uMap, uRes;
uniform vec3 uL, uKey, uAmb;
uniform float uHS, uS, uExp;
uniform vec4 uBr;      // red lum, red temp, blue lum, blue temp
uniform float uEm;     // ember glow
uniform vec3 uWin;     // window light: dir.xy (toward light, image plane), strength
uniform vec2 uWinC;    // window patch centre (uv)
out vec4 o;
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
float tone(float x){ return x < 0.78 ? x : 0.78 + 0.22 * (1.0 - exp(-(x - 0.78) / 0.22)); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 g = texture(tG, uv);
  vec3 n = normalize(vec3(-g.x * uHS, -g.y * uHS, 1.0));
  vec3 alb = toLin(texture(tA, uv).rgb);
  vec4 m = texture(tM, uv);
  // breathing of the glaze layers: tiny luminance and temperature drift per field
  float rl = 1.0 + uBr.x * m.r, bl = 1.0 + uBr.z * m.g;
  alb *= rl * bl;
  alb *= vec3(1.0 + uBr.y * m.r, 1.0, 1.0 - uBr.y * m.r);
  alb *= vec3(1.0 - uBr.w * m.g, 1.0, 1.0 + uBr.w * m.g);
  alb *= 1.0 + uEm * m.b * vec3(1.0, 0.85, 0.5);
  float ao = g.z, gloss = g.w;
  float h0 = texture(tH, uv).r;
  // soft height-field shadow toward the light
  vec2 d2 = normalize(uL.xy);
  float tanEl = uL.z / length(uL.xy);
  float sh = 1.0;
  for (int i = 1; i <= 24; i++) {
    float d = 0.55 * pow(float(i), 1.45);
    vec2 q = uv + d2 * d * uS / uMap;
    float hq = texture(tH, q).r;
    float ray = h0 + d * tanEl / uHS;
    float w = 0.05 * d + 0.12;
    sh = min(sh, smoothstep(-w, w, (ray - hq) * uHS));
  }
  vec3 L = normalize(uL);
  float ndl = max(dot(n, L), 0.0);
  // a broad, soft fall-off of the window light across the canvas
  vec2 a = vec2(uMap.x / uMap.y, 1.0);
  float win = 1.0 + uWin.z * dot((uv - uWinC) * a, uWin.xy);
  win *= 1.0 - 0.10 * smoothstep(0.25, 0.75, length((uv - uWinC) * a));
  vec3 key = uKey * win;
  vec3 diff = alb * key * ndl * sh;
  // GGX specular, rougher where the paint is lean and sunk-in
  vec3 V = vec3(0.0, 0.0, 1.0), Hh = normalize(L + V);
  float rough = mix(0.62, 0.24, gloss), a2 = rough * rough * rough * rough;
  float ndh = max(dot(n, Hh), 0.0), ndv = max(n.z, 1e-3), vdh = max(dot(V, Hh), 0.0);
  float D = a2 / (3.14159 * pow(ndh * ndh * (a2 - 1.0) + 1.0, 2.0));
  float k = rough * rough * 0.5;
  float G = (ndl / (ndl * (1.0 - k) + k)) * (ndv / (ndv * (1.0 - k) + k));
  float F = 0.04 + 0.96 * pow(1.0 - vdh, 5.0);
  float spec = D * F * G / max(4.0 * ndv, 1e-3) * mix(0.25, 1.0, gloss);
  vec3 sp = key * spec * sh * vec3(1.0, 0.97, 0.92);
  // room fill: cool, from the front and above, occluded in hollows
  vec3 amb = alb * uAmb * ao * (0.6 + 0.4 * n.z + 0.15 * max(-n.y, 0.0));
  vec3 c = (diff + sp + amb) * uExp;
  o = vec4(tone(c.r), tone(c.g), tone(c.b), 1.0);
}`;

  const FS_RESOLVE = `#version 300 es
precision highp float;
uniform sampler2D tS;
uniform vec2 uSrc, uDst;
uniform float uFlip;
out vec4 o;
float enc(float c){ c = clamp(c, 0.0, 1.0); return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }
float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void main(){
  vec2 fc = gl_FragCoord.xy;
  if (uFlip > 0.5) fc.y = uDst.y - fc.y;
  vec2 r = uSrc / uDst;              // source texels per output pixel
  vec3 acc = vec3(0.0); float wsum = 0.0;
  // area filter: a 4x4 grid of bilinear taps over the footprint (a tent a little wider than a box)
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 off = (vec2(float(i), float(j)) + 0.5) / 4.0 - 0.5;
    vec2 q = (fc + off * 1.15) * r;
    float w = (1.0 - abs(off.x) * 0.6) * (1.0 - abs(off.y) * 0.6);
    acc += texture(tS, q / uSrc).rgb * w; wsum += w;
  }
  vec3 c = acc / wsum;
  float d = (hash(floor(fc)) + hash(floor(fc) + 17.3) - 1.0) / 255.0;
  o = vec4(enc(c.r) + d, enc(c.g) + d, enc(c.b) + d, 1.0);
}`;

  // float32 -> IEEE half (round to nearest), so the GPU receives compact data
  function toHalf(f32) {
    const out = new Uint16Array(f32.length), fv = new Float32Array(1), iv = new Uint32Array(fv.buffer);
    for (let i = 0; i < f32.length; i++) {
      fv[0] = f32[i]; const x = iv[0];
      const sgn = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112; let m = x & 0x7fffff;
      if (e <= 0) { out[i] = e < -10 ? sgn : sgn | ((m | 0x800000) >> (1 - e + 13)); continue; }
      if (e >= 31) { out[i] = sgn | 0x7bff; continue; }
      m += 0x1000; if (m & 0x800000) { m = 0; if (e + 1 >= 31) { out[i] = sgn | 0x7bff; continue; } out[i] = sgn | ((e + 1) << 10); continue; }
      out[i] = sgn | (e << 10) | (m >> 13);
    }
    return out;
  }
  function Renderer(canvas, maps) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: false });
    if (!gl) throw new Error('WebGL2 is required');
    canvas.addEventListener('webglcontextlost', (e) => { console.error('webglcontextlost'); });
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float is required');
    gl.getExtension('OES_texture_float_linear');
    this.gl = gl; this.maps = maps; this.canvas = canvas;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
    this.pScene = prog(FS_SCENE); this.pRes = prog(FS_RESOLVE);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const tex = (ifmt, fmt, type, data, filter) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, maps.W, maps.H, 0, fmt, type, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.tH = tex(gl.R16F, gl.RED, gl.HALF_FLOAT, toHalf(maps.height), gl.LINEAR);
    this.tG = tex(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, toHalf(maps.grad), gl.LINEAR);
    this.tA = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, maps.albedo, gl.LINEAR);
    this.tM = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, maps.masks, gl.LINEAR);
    this.fbo = {};
  }
  Renderer.prototype.target = function (key, w, h, ifmt, fmt, type) {
    const gl = this.gl;
    if (this.fbo[key] && this.fbo[key].w === w && this.fbo[key].h === h) return this.fbo[key];
    if (this.fbo[key]) { gl.deleteTexture(this.fbo[key].t); gl.deleteFramebuffer(this.fbo[key].f); }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return (this.fbo[key] = { t, f, w, h });
  };
  // P: lighting state for time t (from anim). ss: scene resolution as a multiple of the map. out: {w,h} or null (canvas)
  Renderer.prototype.draw = function (P, ss, out) {
    const gl = this.gl, m = this.maps;
    const sw = Math.round(m.W * ss), shh = Math.round(m.H * ss);
    const S = this.target('scene', sw, shh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.f); gl.viewport(0, 0, sw, shh);
    gl.useProgram(this.pScene);
    const u = (n) => gl.getUniformLocation(this.pScene, n);
    [['tH', this.tH], ['tG', this.tG], ['tA', this.tA], ['tM', this.tM]].forEach(([n, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(u(n), i); });
    gl.uniform2f(u('uMap'), m.W, m.H); gl.uniform2f(u('uRes'), sw, shh);
    gl.uniform3fv(u('uL'), P.L); gl.uniform3fv(u('uKey'), P.key); gl.uniform3fv(u('uAmb'), P.amb);
    gl.uniform1f(u('uHS'), P.hs); gl.uniform1f(u('uS'), m.s); gl.uniform1f(u('uExp'), P.exp);
    gl.uniform4fv(u('uBr'), P.br); gl.uniform1f(u('uEm'), P.em);
    gl.uniform3fv(u('uWin'), P.win); gl.uniform2fv(u('uWinC'), P.winC);
    // drawn in bands so no single GPU command runs long (software GL has a watchdog)
    const band = this.band || shh;
    gl.enable(gl.SCISSOR_TEST);
    for (let y = 0; y < shh; y += band) { gl.scissor(0, y, sw, Math.min(band, shh - y)); gl.drawArrays(gl.TRIANGLES, 0, 3); if (band < shh) gl.finish(); }
    gl.disable(gl.SCISSOR_TEST);
    let ow, oh;
    if (out) { const O = this.target('out', out.w, out.h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE); gl.bindFramebuffer(gl.FRAMEBUFFER, O.f); ow = out.w; oh = out.h; }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); ow = this.canvas.width; oh = this.canvas.height; }
    gl.viewport(0, 0, ow, oh);
    gl.useProgram(this.pRes);
    const v = (n) => gl.getUniformLocation(this.pRes, n);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.t); gl.uniform1i(v('tS'), 0);
    gl.uniform2f(v('uSrc'), sw, shh); gl.uniform2f(v('uDst'), ow, oh); gl.uniform1f(v('uFlip'), out ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (gl.isContextLost()) throw new Error('WebGL context lost');
    return { w: ow, h: oh };
  };
  // RGB bytes of the last offscreen output, top row first
  Renderer.prototype.read = function (w, h) {
    const gl = this.gl, buf = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo.out.f);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0, j = 0; i < buf.length; i += 4, j += 3) { rgb[j] = buf[i]; rgb[j + 1] = buf[i + 1]; rgb[j + 2] = buf[i + 2]; }
    return rgb;
  };
  root.TwoWeathersRenderer = Renderer;
})(window);
