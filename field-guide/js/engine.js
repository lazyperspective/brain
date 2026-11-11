/* Fable 5.2: A Field Guide. The renderer: raw WebGL2, flat-shaded low poly.
   Scene pass at SS x the output size (shadow-mapped warm key light, PCF; lilac sky ambient; rim; atmospheric fog),
   in-scene text quads from a glyph atlas, additive glows; then a resolve to the output size that keeps linear depth,
   a quarter-size blur for depth of field and bloom, and a final pass with crease AO, DOF, bloom, filmic tone and grade. */
(function (root) {
  'use strict';
  var FG = root.FG, M = FG.mat, V = FG.v;

  FG.LIGHT_DIR = V.norm([-0.36, 0.50, 0.79]);     // toward the low dusk sun (south-south-west)

  var SKY_GLSL = [
    'uniform vec3 uL;',
    'vec3 sky(vec3 d){',
    '  float h=d.y;',
    '  vec3 zen=vec3(0.135,0.105,0.300), mid=vec3(0.360,0.285,0.660), hor=vec3(0.960,0.540,0.400), low=vec3(0.560,0.420,0.700), nad=vec3(0.300,0.230,0.480);',
    '  vec3 c;',
    '  if(h>=0.){ c=mix(hor, mid, smoothstep(0.0,0.30,h)); c=mix(c, zen, smoothstep(0.30,0.95,h)); }',
    '  else { c=mix(hor, low, smoothstep(0.0,-0.12,h)); c=mix(c, nad, smoothstep(-0.12,-0.8,h)); }',
    '  float s=max(dot(d,uL),0.);',
    '  c+=vec3(1.0,0.62,0.42)*(pow(s,6.)*0.32+pow(s,40.)*0.55);',
    '  return c;',
    '}'].join('\n');

  function Renderer(canvas, W, H, SS) {
    this.W = W; this.H = H; this.SS = SS;
    var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl; this.canvas = canvas;
    canvas.width = W; canvas.height = H;
    var floatOK = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');
    var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    while (SS > 1 && Math.max(W, H) * SS > maxTex) SS--;
    this.SS = SS;
    var FW = W * SS, FH = H * SS; this.FW = FW; this.FH = FH;
    var self = this;

    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n'));
      return s;
    }
    function prog(vs, fs, attribs) {
      var p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, '#version 300 es\nprecision highp float;\n' + vs));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\nprecision highp sampler2DShadow;\n' + fs));
      for (var i = 0; i < attribs.length; i++) gl.bindAttribLocation(p, i, attribs[i]);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i), nm = info.name.replace('[0]', ''); u[nm] = gl.getUniformLocation(p, nm); }
      return { p: p, u: u };
    }
    var HASH = 'float hash12(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }';

    /* ---------------------------------------------------------------- scene program */
    this.pScene = prog([
      'in vec3 aPos; in vec3 aNor; in vec3 aCol; in vec2 aMat;',
      'uniform mat4 uVP, uLVP;',
      'out vec3 vW; out vec3 vS; flat out vec3 vN; flat out vec3 vC; flat out vec2 vM;',
      'void main(){ vW=aPos; vN=aNor; vC=aCol; vM=aMat;',
      '  vec4 s=uLVP*vec4(aPos+aNor*0.012,1.); vS=s.xyz*.5+.5;',
      '  gl_Position=uVP*vec4(aPos,1.); }'].join('\n'), [
      'in vec3 vW; in vec3 vS; flat in vec3 vN; flat in vec3 vC; flat in vec2 vM;',
      'uniform sampler2DShadow uSh; uniform vec3 uCam; uniform float uShTex, uFogD, uFogK, uKeyI, uAmbI;',
      'out vec4 o;', SKY_GLSL, HASH,
      'void main(){',
      '  vec3 N=normalize(vN); float emis=vM.x; float fl=vM.y;',
      '  vec3 Vd=normalize(uCam-vW);',
      '  if(dot(N,Vd)<0. && fl<2.5) N=-N;',
      '  float ndl=max(dot(N,uL),0.);',
      '  float shd=1.;',
      '  if(ndl>0. && vS.x>0.001 && vS.x<0.999 && vS.y>0.001 && vS.y<0.999 && vS.z<0.999){',
      '    float a=hash12(gl_FragCoord.xy)*6.2832; float bias=mix(0.0016,0.0005,ndl); shd=0.;',
      '    for(int i=0;i<10;i++){ float fi=float(i)+.5; float r=sqrt(fi/10.)*uShTex; float th=a+fi*2.39996;',
      '      shd+=texture(uSh, vec3(vS.xy+vec2(cos(th),sin(th))*r, vS.z-bias)); }',
      '    shd/=10.; }',
      '  vec3 keyC=vec3(1.0,0.80,0.62)*uKeyI;',
      '  vec3 skyA=vec3(0.36,0.32,0.56), gndA=vec3(0.40,0.27,0.20);',
      '  vec3 amb=mix(gndA, skyA, N.y*.5+.5)*uAmbI;',
      '  float nv=max(dot(N,Vd),0.);',
      '  vec3 rim=vec3(0.55,0.42,0.75)*pow(1.-nv,3.)*0.55*(0.4+0.6*max(dot(N,-uL)*.5+.5,0.));',
      '  vec3 c;',
      '  if(fl>1.5) c=vC;',
      '  else c=vC*(keyC*ndl*shd + amb + rim);',
      '  c+=vC*emis;',
      '  float dist=length(vW-uCam);',
      '  float f=1.-exp(-pow(max(dist-uFogD,0.)*uFogK,1.25));',
      '  vec3 fd=normalize(vW-uCam); fd.y=fd.y*0.55;',
      '  c=mix(c, sky(normalize(fd))*0.94, clamp(f,0.,0.97));',
      '  o=vec4(c,1.); }'].join('\n'), ['aPos', 'aNor', 'aCol', 'aMat']);

    this.pShadow = prog('in vec3 aPos; uniform mat4 uLVP; void main(){ gl_Position=uLVP*vec4(aPos,1.); }',
      'out vec4 o; void main(){ o=vec4(1.); }', ['aPos']);

    this.pSky = prog('in vec2 aP; out vec2 vP; void main(){ vP=aP; gl_Position=vec4(aP,0.9999,1.); }', [
      'in vec2 vP; uniform vec3 uF,uR,uU; out vec4 o;', SKY_GLSL, HASH,
      'void main(){ vec3 d=normalize(uF+uR*vP.x+uU*vP.y); o=vec4(sky(d),1.); }'].join('\n'), ['aP']);

    // text quads: pos3 uv2 col3 light1 ; alpha from the atlas (R8)
    this.pText = prog([
      'in vec3 aPos; in vec2 aUv; in vec4 aCol; in float aFade; uniform mat4 uVP; out vec2 vUv; out vec4 vC; out vec3 vW; out float vF;',
      'void main(){ vUv=aUv; vC=aCol; vW=aPos; vF=aFade; gl_Position=uVP*vec4(aPos,1.); }'].join('\n'), [
      'in vec2 vUv; in vec4 vC; in vec3 vW; in float vF; uniform sampler2D uAt; uniform vec3 uCam; uniform float uFogD, uFogK; out vec4 o;', SKY_GLSL,
      'void main(){ float a=texture(uAt,vUv).r*vF; if(a<0.003) discard;',
      '  vec3 c=vC.rgb*vC.a;',
      '  float dist=length(vW-uCam); float f=1.-exp(-pow(max(dist-uFogD,0.)*uFogK,1.25));',
      '  vec3 fd=normalize(vW-uCam); fd.y*=.55; c=mix(c, sky(normalize(fd))*0.94, clamp(f,0.,0.97));',
      '  o=vec4(c*a,a); }'].join('\n'), ['aPos', 'aUv', 'aCol', 'aFade']);

    // glows: pos3 uv2 col3 ; additive soft discs
    this.pGlow = prog([
      'in vec3 aPos; in vec2 aUv; in vec3 aCol; uniform mat4 uVP; out vec2 vUv; out vec3 vC;',
      'void main(){ vUv=aUv; vC=aCol; gl_Position=uVP*vec4(aPos,1.); }'].join('\n'), [
      'in vec2 vUv; in vec3 vC; out vec4 o;',
      'void main(){ float r=clamp(1.-length(vUv),0.,1.); o=vec4(vC*r*r*r,1.); }'].join('\n'), ['aPos', 'aUv', 'aCol']);

    // resolve: SSxSS box down to output size; alpha = linear depth
    this.pResolve = prog('in vec2 aP; void main(){ gl_Position=vec4(aP,0.,1.); }', [
      'uniform sampler2D uT; uniform sampler2D uD; uniform int uSS; uniform float uN, uF; out vec4 o;',
      'float lin(float z){ z=z*2.-1.; return 2.*uN*uF/(uF+uN-z*(uF-uN)); }',
      'void main(){ ivec2 b=ivec2(gl_FragCoord.xy)*uSS; vec3 c=vec3(0.); float d=0.;',
      '  for(int j=0;j<uSS;j++) for(int i=0;i<uSS;i++){ vec3 s=texelFetch(uT,b+ivec2(i,j),0).rgb; c+=s/(1.+max(max(s.r,s.g),s.b)*0.25); d+=lin(texelFetch(uD,b+ivec2(i,j),0).r); }',
      '  float n=float(uSS*uSS); c/=n; c=c/(1.-max(max(c.r,c.g),c.b)*0.25); o=vec4(c, d/n); }'].join('\n'), ['aP']);

    // quarter-size downsample (13-tap-ish) and separable blur
    this.pDown = prog('in vec2 aP; void main(){ gl_Position=vec4(aP,0.,1.); }', [
      'uniform sampler2D uT; uniform vec2 uTex; out vec4 o;',
      'void main(){ vec2 uv=(gl_FragCoord.xy*4.)*uTex; vec4 c=vec4(0.);',
      '  for(int j=-1;j<=2;j++) for(int i=-1;i<=2;i++) c+=texture(uT, uv+vec2(float(i)-.5,float(j)-.5)*uTex);',
      '  o=c/16.; }'].join('\n'), ['aP']);
    this.pBlur = prog('in vec2 aP; void main(){ gl_Position=vec4(aP,0.,1.); }', [
      'uniform sampler2D uT; uniform vec2 uDir; out vec4 o;',
      'void main(){ vec2 sz=vec2(textureSize(uT,0)); vec2 uv=gl_FragCoord.xy/sz; vec4 c=texture(uT,uv)*0.2270;',
      '  c+=(texture(uT,uv+uDir*1.3846/sz)+texture(uT,uv-uDir*1.3846/sz))*0.3162;',
      '  c+=(texture(uT,uv+uDir*3.2308/sz)+texture(uT,uv-uDir*3.2308/sz))*0.0703;',
      '  o=c; }'].join('\n'), ['aP']);

    // final: crease AO, DOF, bloom, veil, tone, grade, vignette, dither
    this.pFinal = prog('in vec2 aP; void main(){ gl_Position=vec4(aP,0.,1.); }', [
      'uniform sampler2D uR; uniform sampler2D uB; uniform sampler2D uB2; uniform vec2 uRes; uniform float uFocal, uFocus, uDof, uAoK, uBloom, uExpo;',
      'uniform vec4 uVeil; uniform vec3 uLift; out vec4 o;', HASH,
      'vec3 tone(vec3 x){ vec3 a=vec3(.70); return mix(x, a+(1.-a)*tanh((x-a)/(1.-a)), step(a,x)); }',
      'void main(){ vec2 p=gl_FragCoord.xy; vec2 uv=p/uRes; vec4 R=texelFetch(uR,ivec2(p),0); vec3 c=R.rgb; float d0=R.a;',
      // crease AO: pairs of opposite samples; a plane gives dA+dB=2*d0, a crease gives less
      '  float rad=clamp(0.42*uFocal/max(d0,0.1), 2.5, 34.); float a0=hash12(p)*3.1416; float occ=0.;',
      '  for(int i=0;i<4;i++){ float th=a0+float(i)*0.7854; vec2 dir=vec2(cos(th),sin(th))*rad*(0.65+0.35*float(i&1));',
      '    float dA=texture(uR,(p+dir)/uRes).a, dB=texture(uR,(p-dir)/uRes).a;',
      '    float rng=0.55; float eA=clamp(d0-dA,-rng,rng), eB=clamp(d0-dB,-rng,rng);',
      '    float fall=1.-smoothstep(rng*0.6,rng*1.4,max(d0-dA,d0-dB));',
      '    occ+=clamp((eA+eB)/(0.06+0.012*d0),0.,1.)*fall; }',
      '  float ao=1.-uAoK*occ/4.; c*=ao;',
      // depth of field from the quarter blur
      '  vec4 Bl=texture(uB,uv); vec4 Bl2=texture(uB2,uv);',
      '  float coc=smoothstep(uFocus*1.25, uFocus*3.6, d0)*uDof + smoothstep(uFocus*0.55, uFocus*0.25, d0)*0.9;',
      '  c=mix(c, mix(Bl.rgb,Bl2.rgb,0.5), clamp(coc,0.,1.)*0.85);',
      // bloom
      '  vec3 bl=max(Bl2.rgb-vec3(0.95),0.)*0.6+max(Bl.rgb-vec3(1.05),0.)*0.4; c+=bl*uBloom;',
      '  c*=uExpo;',
      '  c=mix(c, uVeil.rgb, uVeil.a);',
      '  c=tone(c);',
      '  c=max(c,0.)+uLift*(1.-c);',
      '  vec2 q=(uv-.5)*vec2(0.85,1.); c*=1.-.32*dot(q,q)*1.6;',
      '  c=pow(clamp(c,0.,1.),vec3(1./2.2));',
      '  c+=(hash12(p)+hash12(p.yx+17.3)-1.)/255.;',
      '  o=vec4(c,1.); }'].join('\n'), ['aP']);

    /* ---------------------------------------------------------------- buffers */
    var S = FG.STRIDE;
    function sceneVAO(buf) {
      var v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      var B4 = 4 * S;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, B4, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, B4, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, B4, 24);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, B4, 36);
      return v;
    }
    this.sceneVAO = sceneVAO;
    this.bufStatic = gl.createBuffer(); this.vaoStatic = sceneVAO(this.bufStatic); this.nStatic = 0;
    this.bufDyn = gl.createBuffer(); this.vaoDyn = sceneVAO(this.bufDyn); this.dynCap = 0;
    this.bufText = gl.createBuffer(); this.vaoText = gl.createVertexArray(); gl.bindVertexArray(this.vaoText); gl.bindBuffer(gl.ARRAY_BUFFER, this.bufText);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 40, 36);
    this.bufGlow = gl.createBuffer(); this.vaoGlow = gl.createVertexArray(); gl.bindVertexArray(this.vaoGlow); gl.bindBuffer(gl.ARRAY_BUFFER, this.bufGlow);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20);
    this.bufQuad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.bufQuad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.vaoQuad = gl.createVertexArray(); gl.bindVertexArray(this.vaoQuad);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    /* ---------------------------------------------------------------- targets */
    function tex(w, h, ifmt, fmt, type, filt) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function fbo(colTex, depTex) {
      var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      if (colTex) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colTex, 0);
      if (depTex) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depTex, 0);
      if (!colTex) { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
      return f;
    }
    var HF = floatOK ? gl.RGBA16F : gl.RGBA8, HT = floatOK ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    this.texScene = tex(FW, FH, HF, gl.RGBA, HT, gl.NEAREST);
    this.texDepth = tex(FW, FH, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
    this.fbScene = fbo(this.texScene, this.texDepth);
    var RF = floatOK ? gl.RGBA32F : gl.RGBA8, RT = floatOK ? gl.FLOAT : gl.UNSIGNED_BYTE;
    this.texRes = tex(W, H, RF, gl.RGBA, RT, gl.NEAREST);
    this.fbRes = fbo(this.texRes, null);
    var QW = Math.ceil(W / 4), QH = Math.ceil(H / 4); this.QW = QW; this.QH = QH;
    this.texQ = [tex(QW, QH, HF, gl.RGBA, HT, gl.LINEAR), tex(QW, QH, HF, gl.RGBA, HT, gl.LINEAR), tex(QW, QH, HF, gl.RGBA, HT, gl.LINEAR)];
    this.fbQ = this.texQ.map(function (t) { return fbo(t, null); });
    var Q2W = Math.ceil(QW / 3), Q2H = Math.ceil(QH / 3); this.Q2W = Q2W; this.Q2H = Q2H;
    this.texQ2 = [tex(Q2W, Q2H, HF, gl.RGBA, HT, gl.LINEAR), tex(Q2W, Q2H, HF, gl.RGBA, HT, gl.LINEAR)];
    this.fbQ2 = this.texQ2.map(function (t) { return fbo(t, null); });
    this.SHADOW = 2048;
    this.texSh = tex(this.SHADOW, this.SHADOW, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, this.texSh);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.fbSh = fbo(null, this.texSh);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.texAtlas = null;
  }

  Renderer.prototype.setStatic = function (B, casters) {
    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufStatic);
    gl.bufferData(gl.ARRAY_BUFFER, B.a.subarray(0, B.n * FG.STRIDE), gl.STATIC_DRAW);
    this.nStatic = B.n; this.nStaticCast = casters == null ? B.n : casters;
  };
  Renderer.prototype.setAtlas = function (cv) {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // red channel of the 2D canvas = coverage
    var ctx = cv.getContext('2d'), id = ctx.getImageData(0, 0, cv.width, cv.height).data, r = new Uint8Array(cv.width * cv.height);
    for (var i = 0, j = 0; i < r.length; i++, j += 4) r[i] = id[j + 3];
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, cv.width, cv.height, 0, gl.RED, gl.UNSIGNED_BYTE, r);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texAtlas = t;
  };

  // camera matrices for a frame description (also used by the compositor to project anchors)
  Renderer.prototype.camera = function (cam) {
    var W = this.W, H = this.H;
    var fwd = V.norm(V.sub(cam.tgt, cam.eye));
    var up0 = [Math.sin(cam.roll || 0) * 0, 1, 0];
    var right = V.norm(V.cross(fwd, up0)), up = V.cross(right, fwd);
    if (cam.roll) { var cr = Math.cos(cam.roll), sr = Math.sin(cam.roll); var r2 = V.add(V.mul(right, cr), V.mul(up, sr)), u2 = V.add(V.mul(up, cr), V.mul(right, -sr)); right = r2; up = u2; }
    var view = M.look(cam.eye, cam.tgt, up);
    var near = cam.near || 0.12, far = cam.far || 400;
    var P = M.persp(cam.fov, W / H, near, far);
    return { VP: M.mul(P, view), fwd: fwd, right: right, up: up, near: near, far: far, eye: cam.eye, fov: cam.fov };
  };
  Renderer.prototype.project = function (C, p) {
    var m = C.VP, x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(x / w * 0.5 + 0.5) * this.W, (1 - (y / w * 0.5 + 0.5)) * this.H, w];
  };

  Renderer.prototype.render = function (F) {
    var gl = this.gl, W = this.W, H = this.H, FW = this.FW, FH = this.FH, S = FG.STRIDE;
    var C = this.camera(F.cam);
    var L = F.light || FG.LIGHT_DIR;
    // shadow frustum: centred on F.shadowC with radius F.shadowR, snapped to texels to keep edges still
    var R = F.shadowR || 10, SH = this.SHADOW;
    var lview = M.look([0, 0, 0], V.mul(L, -1), [0, 1, 0]);
    var c = M.xf(lview, F.shadowC || F.cam.tgt), texel = 2 * R / SH;
    c[0] = Math.round(c[0] / texel) * texel; c[1] = Math.round(c[1] / texel) * texel;
    var LP = M.ortho(c[0] - R, c[0] + R, c[1] - R, c[1] + R, -c[2] - 80, -c[2] + 80);
    var LVP = M.mul(LP, lview);

    var dyn = F.dyn, nd = dyn ? dyn.n : 0;
    if (nd) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufDyn);
      if (nd * S * 4 > this.dynCap) { this.dynCap = Math.max(nd * S * 4, this.dynCap * 2); gl.bufferData(gl.ARRAY_BUFFER, this.dynCap, gl.DYNAMIC_DRAW); }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dyn.a.subarray(0, nd * S));
    }
    var ndc = F.dynCasters == null ? nd : F.dynCasters;

    gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    // shadow pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbSh); gl.viewport(0, 0, SH, SH);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.6, 2.5);
    gl.useProgram(this.pShadow.p); gl.uniformMatrix4fv(this.pShadow.u.uLVP, false, LVP);
    if (this.nStaticCast) { gl.bindVertexArray(this.vaoStatic); gl.drawArrays(gl.TRIANGLES, 0, this.nStaticCast); }
    if (ndc) { gl.bindVertexArray(this.vaoDyn); gl.drawArrays(gl.TRIANGLES, 0, ndc); }
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // scene pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbScene); gl.viewport(0, 0, FW, FH);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    var th = Math.tan(C.fov / 2), asp = W / H;
    gl.useProgram(this.pSky.p);
    gl.uniform3fv(this.pSky.u.uL, L);
    gl.uniform3fv(this.pSky.u.uF, C.fwd);
    gl.uniform3f(this.pSky.u.uR, C.right[0] * th * asp, C.right[1] * th * asp, C.right[2] * th * asp);
    gl.uniform3f(this.pSky.u.uU, C.up[0] * th, C.up[1] * th, C.up[2] * th);
    gl.bindVertexArray(this.vaoQuad); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.DEPTH_TEST);
    var u = this.pScene.u; gl.useProgram(this.pScene.p);
    gl.uniformMatrix4fv(u.uVP, false, C.VP); gl.uniformMatrix4fv(u.uLVP, false, LVP);
    gl.uniform3fv(u.uCam, F.cam.eye); gl.uniform3fv(u.uL, L);
    gl.uniform1f(u.uShTex, (F.shadowSoft || 2.2) / SH * (12 / Math.max(R, 4)) * Math.max(1, R / 12));
    gl.uniform1f(u.uFogD, F.fogD == null ? 14 : F.fogD); gl.uniform1f(u.uFogK, F.fogK == null ? 0.022 : F.fogK);
    gl.uniform1f(u.uKeyI, F.keyI || 1.0); gl.uniform1f(u.uAmbI, F.ambI || 1.0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texSh); gl.uniform1i(u.uSh, 0);
    if (this.nStatic) { gl.bindVertexArray(this.vaoStatic); gl.drawArrays(gl.TRIANGLES, 0, this.nStatic); }
    if (nd) { gl.bindVertexArray(this.vaoDyn); gl.drawArrays(gl.TRIANGLES, 0, nd); }

    // text quads (premultiplied alpha, depth-tested, no depth write)
    if (F.text && F.text.n && this.texAtlas) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufText);
      gl.bufferData(gl.ARRAY_BUFFER, F.text.a.subarray(0, F.text.n * 10), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4);
      var ut = this.pText.u; gl.useProgram(this.pText.p);
      gl.uniformMatrix4fv(ut.uVP, false, C.VP); gl.uniform3fv(ut.uCam, F.cam.eye); gl.uniform3fv(ut.uL, L);
      gl.uniform1f(ut.uFogD, F.fogD == null ? 14 : F.fogD); gl.uniform1f(ut.uFogK, F.fogK == null ? 0.022 : F.fogK);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texAtlas); gl.uniform1i(ut.uAt, 0);
      gl.bindVertexArray(this.vaoText); gl.drawArrays(gl.TRIANGLES, 0, F.text.n);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    // glows (additive)
    if (F.glow && F.glow.n) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufGlow);
      gl.bufferData(gl.ARRAY_BUFFER, F.glow.a.subarray(0, F.glow.n * 8), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.useProgram(this.pGlow.p); gl.uniformMatrix4fv(this.pGlow.u.uVP, false, C.VP);
      gl.bindVertexArray(this.vaoGlow); gl.drawArrays(gl.TRIANGLES, 0, F.glow.n);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    gl.disable(gl.DEPTH_TEST);

    // resolve
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbRes); gl.viewport(0, 0, W, H);
    gl.useProgram(this.pResolve.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texScene); gl.uniform1i(this.pResolve.u.uT, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texDepth); gl.uniform1i(this.pResolve.u.uD, 1);
    gl.uniform1i(this.pResolve.u.uSS, this.SS); gl.uniform1f(this.pResolve.u.uN, C.near); gl.uniform1f(this.pResolve.u.uF, C.far);
    gl.bindVertexArray(this.vaoQuad); gl.drawArrays(gl.TRIANGLES, 0, 6);
    // quarter + blur, then a further third + blur (wide)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbQ[0]); gl.viewport(0, 0, this.QW, this.QH);
    gl.useProgram(this.pDown.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texRes);
    // texRes is NEAREST float; sample it at texel centres via the down shader's offsets
    gl.uniform1i(this.pDown.u.uT, 0); gl.uniform2f(this.pDown.u.uTex, 1 / W, 1 / H);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.useProgram(this.pBlur.p); gl.uniform1i(this.pBlur.u.uT, 0);
    for (var pass = 0; pass < 2; pass++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbQ[1]); gl.bindTexture(gl.TEXTURE_2D, this.texQ[0]); gl.uniform2f(this.pBlur.u.uDir, 1, 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbQ[0]); gl.bindTexture(gl.TEXTURE_2D, this.texQ[1]); gl.uniform2f(this.pBlur.u.uDir, 0, 1); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbQ2[0]); gl.viewport(0, 0, this.Q2W, this.Q2H);
    gl.useProgram(this.pBlur.p); gl.bindTexture(gl.TEXTURE_2D, this.texQ[0]); gl.uniform2f(this.pBlur.u.uDir, 1, 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
    for (pass = 0; pass < 2; pass++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbQ2[1]); gl.bindTexture(gl.TEXTURE_2D, this.texQ2[0]); gl.uniform2f(this.pBlur.u.uDir, pass ? 1 : 0, pass ? 0 : 1); gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbQ2[0]); gl.bindTexture(gl.TEXTURE_2D, this.texQ2[1]); gl.uniform2f(this.pBlur.u.uDir, pass ? 0 : 1, pass ? 1 : 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    // final
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    var uf = this.pFinal.u; gl.useProgram(this.pFinal.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texRes); gl.uniform1i(uf.uR, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texQ[0]); gl.uniform1i(uf.uB, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.texQ2[0]); gl.uniform1i(uf.uB2, 2);
    gl.uniform2f(uf.uRes, W, H);
    gl.uniform1f(uf.uFocal, H / 2 / Math.tan(C.fov / 2));
    gl.uniform1f(uf.uFocus, F.focus || 6); gl.uniform1f(uf.uDof, F.dof == null ? 0.6 : F.dof);
    gl.uniform1f(uf.uAoK, F.ao == null ? 0.55 : F.ao); gl.uniform1f(uf.uBloom, F.bloom == null ? 1 : F.bloom);
    gl.uniform1f(uf.uExpo, F.expo || 1);
    gl.uniform4fv(uf.uVeil, F.veil || [0, 0, 0, 0]);
    gl.uniform3fv(uf.uLift, F.lift || [0.012, 0.008, 0.02]);
    gl.bindVertexArray(this.vaoQuad); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    return C;
  };

  FG.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
