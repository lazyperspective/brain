// The painter. A scene supplies a "plan" (a GLSL value-and-colour study plus direction, brush size and material
// maps) and a list of painting layers. The engine then paints like a painter in oil:
//   - every layer is a pass of real brush strokes laid on a canvas texture in WebGL2: each stroke is a ribbon that
//     follows the direction field and stops at edges (after Hertzmann's painterly rendering), carries a colour that
//     is mixed on the palette (with a little of a neighbouring colour), has bristle streaks, runs out of paint (dry
//     brush breaks up on the tooth of the canvas), drags the still-wet paint under it, and deposits paint thickness
//   - glazes are transparent multiplicative veils that pool in the weave and in brush grooves
//   - the result is a colour layer and a paint height field; the final pass lights the height field (paint + linen
//     weave where the paint is thin) with a raking light, adds a varnish sheen and warmth, and optional craquelure
(function (G) {
  'use strict';
  const R = G.RNG;
  const DW = 2160, DH = 2700; // design size: all scene coordinates are in these pixels, y down

  const COMMON = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float noise1(float x){ float i=floor(x), f=fract(x); float u=f*f*(3.-2.*f); return mix(hash11(i+0.17), hash11(i+1.17), u); }
float fbm(vec2 p, int oct){ float a=.5, s=0., n=0.; for(int i=0;i<8;i++){ if(i>=oct) break; s+=a*vnoise(p); n+=a; p = mat2(1.6,1.2,-1.2,1.6)*p + 17.3; a*=.5;} return s/n; }
// plain-weave linen: p in output pixels, sp thread pitch in output pixels; ~0..1.2
float weave(vec2 p, float sp){
  vec2 w = p / sp;
  w += vec2(vnoise(p*0.006 + 3.1) - .5, vnoise(p*0.0055 + 7.7) - .5) * 1.2;
  w += vec2(vnoise(vec2(w.y*0.35, 2.)) - .5, vnoise(vec2(w.x*0.35, 9.)) - .5) * 0.35;
  vec2 c = floor(w), f = fract(w);
  float tx = 0.7 + 0.6*vnoise(vec2(c.x*7.31, w.y*0.09));
  float ty = 0.7 + 0.6*vnoise(vec2(w.x*0.09, c.y*7.77 + 50.));
  float sx = pow(max(sin(3.14159*f.x), 0.), 0.7);
  float sy = pow(max(sin(3.14159*f.y), 0.), 0.7);
  float warp = sx * tx * (0.62 + 0.38*cos(3.14159*(w.y - .5 + c.x)));
  float weft = sy * ty * (0.62 + 0.38*cos(3.14159*(w.x + .5 + c.y)));
  return max(warp, weft) + 0.08*vnoise(p*0.9);
}
`;

  const FS_VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1,-1), vec2(3,-1), vec2(-1,3));
void main(){ gl_Position = vec4(P[gl_VertexID], 0., 1.); }`;

  // ---------------------------------------------------------------- strokes
  const STROKE_VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; in vec4 a_s0; in vec4 a_s1; in vec4 a_s2; in vec4 a_s3; in vec2 a_dir;
uniform vec2 u_res; uniform float u_scale;
out vec2 v_uv; out vec2 v_dir;
flat out vec4 v_s0; flat out vec4 v_s1; flat out vec4 v_s2; flat out vec4 v_s3;
void main(){
  vec2 p = a_pos * u_scale;
  gl_Position = vec4(p.x / u_res.x * 2. - 1., 1. - p.y / u_res.y * 2., 0., 1.);
  v_uv = a_uv; v_dir = vec2(a_dir.x, -a_dir.y);
  v_s0 = a_s0; v_s1 = a_s1; v_s2 = a_s2; v_s3 = a_s3;
}`;
  const STROKE_FS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec2 v_dir;
flat in vec4 v_s0; flat in vec4 v_s1; flat in vec4 v_s2; flat in vec4 v_s3;
uniform sampler2D u_plan; uniform sampler2D u_prev; uniform sampler2D u_prevH;
uniform vec2 u_res; uniform float u_scale; uniform float u_weaveSp; uniform float u_kind;
uniform float u_bristle; uniform float u_tooth; uniform float u_pool; uniform float u_ridge; uniform float u_furrow; uniform float u_level;
layout(location=0) out vec4 o_col; layout(location=1) out vec4 o_h;
${COMMON}
const float MARGIN = 1.3;
void main(){
  float u = v_uv.x, v = v_uv.y * MARGIN;
  float len = v_s0.x, rad = v_s0.y, seed = v_s0.z, alpha = v_s0.w;
  vec3 col = v_s1.rgb; float thick = v_s1.a; vec3 col2 = v_s2.rgb; float load0 = v_s2.a;
  float fid = v_s3.x, smear = v_s3.y, dry = v_s3.z, mixk = v_s3.w;
  float t = clamp(u / max(len, 1.), 0., 1.);
  // outline: rounded, slightly flattened start (the brush is set down), tapering lift at the end
  float sU = clamp(-u / (rad * 0.95), 0., 1.);
  float wS = sqrt(max(0., 1. - sU*sU*sU));
  float eU = clamp((u - len) / (rad * 1.1), 0., 1.);
  float wE = 1. - eU*eU;
  float wob = 0.93 + 0.14 * noise1(u / (rad * 2.7) + seed * 31.);
  float w = min(wS, wE) * wob;
  // bristles: clumps across the brush, each with its own load, streaking along the stroke
  float NB = clamp(rad * u_bristle, 5., 70.);
  float bi = (v * 0.5 + 0.5) * NB + seed * 97.;
  float bA = noise1(bi);
  float bB = vnoise(vec2(bi * 1.3, u / (rad * 2.6) + seed * 5.));
  float bC = noise1(bi * 2.9 + 11.);
  float edge = abs(v) - w + 0.22 * (bA - 0.5) * (0.4 + abs(v)) + 0.10 * (bC - .5);
  float px = 1.0 / max(rad * u_scale, 0.5);
  float cov = 1. - smoothstep(-px * 1.2, px * 1.2, edge);
  // every bristle starts and lifts at its own place: ragged, splayed stroke ends
  float bEnd = len + rad * (0.1 + 1.05 * noise1(bi * 1.9 + 7.));
  float bStart = -rad * (0.15 + 0.8 * noise1(bi * 2.3 + 1.));
  cov *= (1. - smoothstep(bEnd - rad * 0.3, bEnd, u)) * smoothstep(bStart, bStart + rad * 0.3, u);
  // the load runs out along the stroke; when it is low only the tooth of the canvas and the ridges take paint
  float L = load0 - dry * t;
  float tooth = weave(gl_FragCoord.xy, u_weaveSp);
  float hb = texture(u_prevH, gl_FragCoord.xy / u_res).r;
  float ho = 4. * u_scale;
  float hn = 0.125 * (texture(u_prevH, (gl_FragCoord.xy + vec2(ho, 0.)) / u_res).r + texture(u_prevH, (gl_FragCoord.xy - vec2(ho, 0.)) / u_res).r
                   + texture(u_prevH, (gl_FragCoord.xy + vec2(0., ho)) / u_res).r + texture(u_prevH, (gl_FragCoord.xy - vec2(0., ho)) / u_res).r
                   + texture(u_prevH, (gl_FragCoord.xy + vec2(ho, ho)*0.7) / u_res).r + texture(u_prevH, (gl_FragCoord.xy - vec2(ho, ho)*0.7) / u_res).r
                   + texture(u_prevH, (gl_FragCoord.xy + vec2(ho, -ho)*0.7) / u_res).r + texture(u_prevH, (gl_FragCoord.xy - vec2(ho, -ho)*0.7) / u_res).r);
  float relief = clamp((hb - hn) * 4.0 + 0.5, 0., 1.); // 1 on local peaks, 0 in valleys
  float grain = vnoise(gl_FragCoord.xy * 0.31 / u_scale + seed) * 0.6 + vnoise(gl_FragCoord.xy * 0.09 / u_scale - seed) * 0.4;
  float s = mix(bB, clamp((tooth * 0.3 + grain * 0.6) * (1. - clamp(hb*2.,0.,0.6)) + relief * 0.4, 0., 1.), u_tooth);
  float keep = smoothstep(1. - L - 0.14, 1. - L + 0.14, s);
  vec2 tc = gl_FragCoord.xy / u_res;
  if (u_kind < 0.5 || u_kind > 1.5) {
    cov *= keep;
    // per-bristle value and the second colour picked up on the brush
    vec3 c = col * (1. + (bA - 0.5) * 0.09 + (bB - 0.5) * 0.05);
    float m2 = smoothstep(0.52, 0.86, vnoise(vec2(bi * 0.31 + 5., u / (rad * 5.) + seed)));
    c = mix(c, col2, m2 * mixk);
    vec3 pc = texture(u_plan, tc).rgb;
    c = mix(c, pc, fid);
    // drag of the wet paint underneath, pulled along the stroke
    vec3 prev = texture(u_prev, (gl_FragCoord.xy - v_dir * rad * u_scale * (0.6 + 0.8 * bC)) / u_res).rgb;
    float sm = smear * (0.25 + 0.75 * t) * (0.4 + 0.6 * bB) + smear * 0.5 * smoothstep(0.55, 1.0, abs(v) / max(w, 1e-3));
    c = mix(c, prev, clamp(sm, 0., 0.95));
    float a = cov * alpha;
    o_col = vec4(c * a, a);
    // relief: fine bristle furrows along the stroke, a slight ridge where paint is pushed to the edges, a little more
    // paint where the brush was set down; older paint under a fresh stroke is partly levelled
    float fur = noise1(bi * 1.7 + 3.) * 0.6 + vnoise(vec2(bi * 0.8, u / (rad * 4.) + seed * 2.)) * 0.4;
    float ridge = 1. + u_ridge * smoothstep(0.55, 0.97, abs(v) / max(w, 1e-3));
    float blob = 1. + u_ridge * 0.8 * exp(-max(u + rad * 0.3, 0.) / (rad * 1.0));
    float h = thick * clamp(L, 0.3, 1.3) * (1. - u_furrow + u_furrow * fur) * ridge * blob * cov;
    h += u_level * cov * alpha * (hn - hb);
    o_h = vec4(h, 0., 0., 0.);
  } else {
    // glaze: a transparent veil, denser where it pools in the weave and in brush grooves
    float pool = 1. + u_pool * (0.7 - tooth * 0.6 + (0.5 - relief) * 0.8);
    float a = clamp(cov * alpha * (0.75 + 0.5 * bB) * pool, 0., 1.);
    o_col = vec4(mix(vec3(1.), col, a), 1.);
    o_h = vec4(thick * a * 0.3, 0., 0., 0.);
  }
}`;

  // ---------------------------------------------------------------- plan
  const PLAN_FS = (body) => `#version 300 es
precision highp float;
uniform vec2 u_res; uniform float u_scale;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2;
${COMMON}
${body}
void main(){
  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_scale;
  vec4 a, b, c; plan(p, a, b, c);
  o0 = a; o1 = b; o2 = c;
}`;

  // ---------------------------------------------------------------- final
  const COMP_FS = (extra) => `#version 300 es
precision highp float;
uniform sampler2D u_col; uniform sampler2D u_h; uniform sampler2D u_plan;
uniform vec2 u_res; uniform float u_scale; uniform float u_weaveSp; uniform float u_view;
uniform vec3 u_light; uniform float u_hk; uniform float u_wk; uniform float u_tau; uniform float u_kd; uniform float u_ks; uniform float u_shin;
uniform vec3 u_varnish; uniform float u_crack; uniform float u_crackSc;
out vec4 o;
${COMMON}
float paintH(vec2 fc){
  vec2 o = vec2(0.75);
  return 0.25 * (texture(u_h, (fc + o) / u_res).r + texture(u_h, (fc - o) / u_res).r + texture(u_h, (fc + vec2(o.x, -o.y)) / u_res).r + texture(u_h, (fc + vec2(-o.x, o.y)) / u_res).r);
}
float surf(vec2 fc){
  float ph = max(paintH(fc), 0.);
  float wv = weave(fc, u_weaveSp);
  return ph * u_hk + wv * u_wk * (0.12 + 0.88 * exp(-ph / u_tau));
}
// craquelure: an irregular network of fine cracks (voronoi cell borders, warped)
float crack(vec2 p){
  p += (vec2(vnoise(p*0.02), vnoise(p*0.02+9.)) - .5) * 40.;
  vec2 g = p / u_crackSc; vec2 i = floor(g), f = fract(g);
  float d1 = 9., d2 = 9.;
  for (int y=-1; y<=1; y++) for (int x=-1; x<=1; x++){
    vec2 o = vec2(x,y); vec2 r = o + hash22(i+o)*0.9 + 0.05 - f;
    r.y *= 1.35;
    float d = dot(r,r);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  float e = sqrt(d2) - sqrt(d1);
  return 1. - smoothstep(0.0, 0.035 + 0.02*vnoise(p*0.05), e);
}
${extra || ''}
vec3 toSrgb(vec3 c){ c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1./2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec3 alb = texture(u_col, fc / u_res).rgb;
  if (u_view > 1.5) { o = vec4(toSrgb(alb), 1.); return; }
  if (u_view > 0.5) { alb = texture(u_plan, fc / u_res).rgb; o = vec4(toSrgb(alb), 1.); return; }
  // surface normal from the height field, derivatives per design pixel
  float hl = surf(fc - vec2(1,0)), hr = surf(fc + vec2(1,0)), hd = surf(fc - vec2(0,1)), hu = surf(fc + vec2(0,1));
  float hl2 = surf(fc - vec2(2,0)), hr2 = surf(fc + vec2(2,0)), hd2 = surf(fc - vec2(0,2)), hu2 = surf(fc + vec2(0,2));
  vec2 g = (vec2(hr - hl, hu - hd) * 0.5 * 0.6 + vec2(hr2 - hl2, hu2 - hd2) * 0.25 * 0.4) * u_scale;
  float ph = max(paintH(fc), 0.);
  float cr = 0.;
  if (u_crack > 0.) {
    vec2 dp = fc / u_scale;
    cr = crack(dp) * smoothstep(0.02, 0.25, ph + 0.05) * u_crack;
    float ce = crack(dp + vec2(1.2, 0.)) - crack(dp - vec2(1.2, 0.));
    float cf = crack(dp + vec2(0., 1.2)) - crack(dp - vec2(0., 1.2));
    g -= vec2(ce, cf) * 0.35 * u_crack;
  }
  vec3 n = normalize(vec3(-g, 1.));
  vec3 L = normalize(u_light);
  float dif = dot(n, L) / L.z;
  float shade = max(mix(1., dif, u_kd), 0.2);
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float sp = pow(max(dot(n, H), 0.), u_shin) - pow(H.z, u_shin);
  sp = max(sp, 0.) * u_ks * smoothstep(0.04, 0.5, ph);
  vec3 c = alb * shade;
  c = c * u_varnish;
  c *= 1. - cr * 0.35;
  c += sp * vec3(1.0, 0.96, 0.88) * (0.35 + 0.65 * sqrt(max(dot(alb, vec3(.3,.5,.2)), 0.)));
  c = finishColour(c, fc / u_res);
  vec3 s = toSrgb(c);
  s += (hash12(fc + 0.5) + hash12(fc + 17.3) - 1.) / 255.;
  o = vec4(clamp(s, 0., 1.), 1.);
}`;

  // ---------------------------------------------------------------- GL helpers
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error(log + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
    }
    return s;
  }
  function program(gl, vs, fs, attribs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    if (attribs) attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); U[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, U };
  }
  function tex(gl, w, h, ifmt, fmt, type, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, ifmt, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function fbo(gl, texs) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo incomplete ' + st);
    return f;
  }

  // ---------------------------------------------------------------- CPU plan access
  function PlanMaps(w, h, k, A, B, C) {
    // A: rgb colour (linear) + a; B: dir.xy, size, material; C: impasto, edge-follow, cross, extra
    this.w = w; this.h = h; this.k = k; this.A = A; this.B = B; this.C = C;
    const n = w * h;
    this.per = new Float32Array(n * 3); // perceptual (gamma) colour for distances
    this.lum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = A[i * 4], g = A[i * 4 + 1], b = A[i * 4 + 2];
      this.per[i * 3] = Math.sqrt(Math.max(r, 0)); this.per[i * 3 + 1] = Math.sqrt(Math.max(g, 0)); this.per[i * 3 + 2] = Math.sqrt(Math.max(b, 0));
      this.lum[i] = Math.sqrt(Math.max(0.2126 * r + 0.7152 * g + 0.0722 * b, 0));
    }
  }
  PlanMaps.prototype.idx = function (x, y) {
    const k = this.k;
    const xi = R.clamp(Math.round(x * k), 0, this.w - 1), yi = R.clamp(Math.round(y * k), 0, this.h - 1);
    return yi * this.w + xi;
  };
  PlanMaps.prototype.bil = function (arr, stride, ch, x, y) {
    const k = this.k;
    let fx = x * k - 0.5, fy = y * k - 0.5;
    fx = R.clamp(fx, 0, this.w - 1.001); fy = R.clamp(fy, 0, this.h - 1.001);
    const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
    const i00 = (y0 * this.w + x0) * stride + ch, i10 = i00 + stride, i01 = i00 + this.w * stride, i11 = i01 + stride;
    return (arr[i00] * (1 - tx) + arr[i10] * tx) * (1 - ty) + (arr[i01] * (1 - tx) + arr[i11] * tx) * ty;
  };
  PlanMaps.prototype.colour = function (x, y) { return [this.bil(this.A, 4, 0, x, y), this.bil(this.A, 4, 1, x, y), this.bil(this.A, 4, 2, x, y)]; };
  PlanMaps.prototype.percep = function (x, y) { return [this.bil(this.per, 3, 0, x, y), this.bil(this.per, 3, 1, x, y), this.bil(this.per, 3, 2, x, y)]; };
  // box blur of the perceptual colour at radius r (plan pixels): the colour a brush of that size would lay down
  PlanMaps.prototype.blurred = function (r) {
    this._bl = this._bl || {};
    if (this._bl[r]) return this._bl[r];
    const w = this.w, h = this.h, src = this.per, tmp = new Float32Array(w * h * 3), out = new Float32Array(w * h * 3);
    const pass = (S, D, horiz) => {
      const nOuter = horiz ? h : w, nInner = horiz ? w : h;
      for (let o = 0; o < nOuter; o++) {
        for (let c = 0; c < 3; c++) {
          let acc = 0;
          const at = (i) => { i = i < 0 ? 0 : i >= nInner ? nInner - 1 : i; return (horiz ? o * w + i : i * w + o) * 3 + c; };
          for (let i = -r; i <= r; i++) acc += S[at(i)];
          for (let i = 0; i < nInner; i++) {
            D[(horiz ? o * w + i : i * w + o) * 3 + c] = acc / (2 * r + 1);
            acc += S[at(i + r + 1)] - S[at(i - r)];
          }
        }
      }
    };
    pass(src, tmp, true); pass(tmp, out, false);
    this._bl[r] = out;
    return out;
  };
  // direction field: authored orientation, bent toward the tangent of strong edges (structure tensor)
  PlanMaps.prototype.buildDirections = function (edgeRef) {
    const w = this.w, h = this.h, L = this.lum;
    const jxx = new Float32Array(w * h), jxy = new Float32Array(w * h), jyy = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = (L[i + 1 - w] + 2 * L[i + 1] + L[i + 1 + w]) - (L[i - 1 - w] + 2 * L[i - 1] + L[i - 1 + w]);
      const gy = (L[i + w - 1] + 2 * L[i + w] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - w] + L[i - w + 1]);
      jxx[i] = gx * gx; jxy[i] = gx * gy; jyy[i] = gy * gy;
    }
    const blur = (a, r) => {
      const t = new Float32Array(w * h), o = new Float32Array(w * h);
      for (let y = 0; y < h; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += a[y * w + R.clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { t[y * w + x] = acc / (2 * r + 1); acc += a[y * w + Math.min(x + r + 1, w - 1)] - a[y * w + Math.max(x - r, 0)]; } }
      for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[R.clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = acc / (2 * r + 1); acc += t[Math.min(y + r + 1, h - 1) * w + x] - t[Math.max(y - r, 0) * w + x]; } }
      return o;
    };
    const r = Math.max(2, Math.round(4 * this.k * 2));
    const bxx = blur(jxx, r), bxy = blur(jxy, r), byy = blur(jyy, r);
    this.dx = new Float32Array(w * h); this.dy = new Float32Array(w * h); this.edge = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const ax = this.B[i * 4], ay = this.B[i * 4 + 1];
      const al = Math.hypot(ax, ay) || 1;
      const ca = ax / al, sa = ay / al;
      let vx = ca * ca - sa * sa, vy = 2 * ca * sa; // doubled angle of the authored orientation
      // gradient doubled angle (bxx-byy, 2bxy); the tangent is its negative
      const gx2 = bxx[i] - byy[i], gy2 = 2 * bxy[i];
      const m = Math.hypot(gx2, gy2);
      const e = Math.min(1, m / edgeRef);
      const follow = this.C[i * 4 + 1] * e;
      if (m > 1e-9) { vx += -gx2 / m * follow * 2; vy += -gy2 / m * follow * 2; }
      const th = Math.atan2(vy, vx) / 2;
      this.dx[i] = Math.cos(th); this.dy[i] = Math.sin(th); this.edge[i] = e;
    }
  };
  PlanMaps.prototype.dir = function (x, y) { const i = this.idx(x, y); return [this.dx[i], this.dy[i]]; };

  // ---------------------------------------------------------------- the painter
  function Painter(canvas, scene, opts) {
    this.scene = scene; this.opts = opts || {};
    const s = this.scale = this.opts.scale || 1;
    this.W = Math.round(DW * s); this.H = Math.round(DH * s);
    canvas.width = this.W; canvas.height = this.H;
    const gl = this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is required');
    gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_float_blend'); gl.getExtension('OES_texture_float_linear');
    this.dbi = gl.getExtension('OES_draw_buffers_indexed');
    if (!this.dbi) throw new Error('OES_draw_buffers_indexed is required');
    this.vao = gl.createVertexArray();
    this.stats = { strokes: 0, layers: [] };
  }

  Painter.prototype.renderPlan = function (k, forRead) {
    // render the plan at scale k (relative to design) into three float targets; return them (and read back if asked)
    const gl = this.gl;
    const w = Math.round(DW * k), h = Math.round(DH * k);
    const F = forRead ? gl.RGBA32F : gl.RGBA16F;
    const t = [0, 1, 2].map(() => tex(gl, w, h, F, gl.RGBA, gl.FLOAT, gl.LINEAR));
    const f = fbo(gl, t);
    if (!this.planProg) this.planProg = program(gl, FS_VS, PLAN_FS(this.scene.planGLSL));
    const P = this.planProg;
    gl.useProgram(P.p);
    gl.uniform2f(P.U.u_res, w, h); gl.uniform1f(P.U.u_scale, k);
    gl.viewport(0, 0, w, h); gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return { w, h, t, f };
  };
  Painter.prototype.readPlan = function (k) {
    const gl = this.gl;
    const r = this.renderPlan(k, true);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, r.f);
    const out = [];
    for (let i = 0; i < 3; i++) {
      gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
      const a = new Float32Array(r.w * r.h * 4);
      gl.readPixels(0, 0, r.w, r.h, gl.RGBA, gl.FLOAT, a);
      // flip rows to y-down
      const row = r.w * 4, flipped = new Float32Array(a.length);
      for (let y = 0; y < r.h; y++) flipped.set(a.subarray((r.h - 1 - y) * row, (r.h - y) * row), y * row);
      out.push(flipped);
    }
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    r.t.forEach((t) => gl.deleteTexture(t)); gl.deleteFramebuffer(r.f);
    return new PlanMaps(r.w, r.h, k, out[0], out[1], out[2]);
  };

  Painter.prototype.setupCanvas = function () {
    const gl = this.gl, W = this.W, H = this.H;
    this.colT = tex(gl, W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    this.hT = tex(gl, W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    this.prevColT = tex(gl, W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    this.prevHT = tex(gl, W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
    this.canvasF = fbo(gl, [this.colT, this.hT]);
    this.prevColF = fbo(gl, [this.prevColT]);
    this.prevHF = fbo(gl, [this.prevHT]);
    this.colOnlyF = fbo(gl, [this.colT]);
    this.hOnlyF = fbo(gl, [this.hT]);
    const pc = this.scene.primer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.canvasF);
    gl.clearBufferfv(gl.COLOR, 0, [pc[0], pc[1], pc[2], 1]);
    gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
    this.strokeProg = program(gl, STROKE_VS, STROKE_FS, ['a_pos', 'a_uv', 'a_s0', 'a_s1', 'a_s2', 'a_s3', 'a_dir']);
    this.vbo = gl.createBuffer(); this.ibo = gl.createBuffer(); this.svao = gl.createVertexArray();
    gl.bindVertexArray(this.svao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const S = 22 * 4;
    const lay = [[0, 2, 0], [1, 2, 2], [2, 4, 4], [3, 4, 8], [4, 4, 12], [5, 4, 16], [6, 2, 20]];
    for (const [loc, n, off] of lay) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, S, off * 4); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bindVertexArray(null);
    this.CAP_V = 1 << 19; this.CAP_I = this.CAP_V * 3;
    this.vbuf = new Float32Array(this.CAP_V * 22); this.ibuf = new Uint32Array(this.CAP_I);
    this.nv = 0; this.ni = 0;
  };

  Painter.prototype.snapshotPrev = function () {
    const gl = this.gl, W = this.W, H = this.H;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.colOnlyF); gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.prevColF);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.hOnlyF); gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.prevHF);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  };

  Painter.prototype.beginLayer = function (L) {
    const gl = this.gl, P = this.strokeProg, dbi = this.dbi;
    this.snapshotPrev();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.canvasF);
    gl.viewport(0, 0, this.W, this.H);
    gl.useProgram(P.p);
    gl.uniform2f(P.U.u_res, this.W, this.H); gl.uniform1f(P.U.u_scale, this.scale);
    gl.uniform1f(P.U.u_weaveSp, this.scene.weavePitch * this.scale);
    const kind = L.kind === 'glaze' ? 1 : L.kind === 'scumble' ? 2 : 0;
    gl.uniform1f(P.U.u_kind, kind);
    gl.uniform1f(P.U.u_bristle, L.bristle != null ? L.bristle : 0.7);
    gl.uniform1f(P.U.u_tooth, L.tooth != null ? L.tooth : (kind === 2 ? 0.6 : 0.12));
    gl.uniform1f(P.U.u_pool, L.pool != null ? L.pool : 0.6);
    gl.uniform1f(P.U.u_ridge, L.ridge != null ? L.ridge : 0.35);
    gl.uniform1f(P.U.u_furrow, L.furrow != null ? L.furrow : 0.55);
    gl.uniform1f(P.U.u_level, L.level != null ? L.level : 0.0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.planT); gl.uniform1i(P.U.u_plan, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.prevColT); gl.uniform1i(P.U.u_prev, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.prevHT); gl.uniform1i(P.U.u_prevH, 2);
    gl.enable(gl.BLEND);
    dbi.enableiOES(gl.BLEND, 0); dbi.enableiOES(gl.BLEND, 1);
    if (kind === 1) dbi.blendFunciOES(0, gl.DST_COLOR, gl.ZERO);
    else dbi.blendFunciOES(0, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    dbi.blendFunciOES(1, gl.ONE, gl.ONE);
    gl.bindVertexArray(this.svao);
  };
  Painter.prototype.flush = function () {
    if (!this.ni) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vbuf.subarray(0, this.nv * 22), gl.STREAM_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.ibuf.subarray(0, this.ni), gl.STREAM_DRAW);
    gl.drawElements(gl.TRIANGLES, this.ni, gl.UNSIGNED_INT, 0);
    this.nv = 0; this.ni = 0;
  };
  // stroke: { pts:[[x,y],...], r, col:[r,g,b], col2, alpha, thick, load, fid, smear, dry, mix, seed }
  Painter.prototype.addStroke = function (st) {
    const pts = st.pts, n = pts.length;
    if (n < 2) return;
    const nvNeed = (n + 2) * 2;
    if (this.nv + nvNeed > this.CAP_V || this.ni + (n + 1) * 6 > this.CAP_I) this.flush();
    // arc length and tangents
    const s = new Float32Array(n); const tx = new Float32Array(n), ty = new Float32Array(n);
    for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1;
      tx[i] = dx / l; ty[i] = dy / l;
    }
    const len = s[n - 1], r = st.r;
    const P = [], U = [], T = [];
    P.push([pts[0][0] - tx[0] * r, pts[0][1] - ty[0] * r]); U.push(-r); T.push([tx[0], ty[0]]);
    for (let i = 0; i < n; i++) { P.push(pts[i]); U.push(s[i]); T.push([tx[i], ty[i]]); }
    P.push([pts[n - 1][0] + tx[n - 1] * r * 1.25, pts[n - 1][1] + ty[n - 1] * r * 1.25]); U.push(len + r * 1.25); T.push([tx[n - 1], ty[n - 1]]);
    const hw = r * 1.3;
    const base = this.nv;
    const vb = this.vbuf;
    for (let i = 0; i < P.length; i++) {
      const nx = -T[i][1], ny = T[i][0];
      for (let side = -1; side <= 1; side += 2) {
        let o = this.nv * 22;
        vb[o++] = P[i][0] + nx * hw * side; vb[o++] = P[i][1] + ny * hw * side;
        vb[o++] = U[i]; vb[o++] = side;
        vb[o++] = Math.max(len, 1); vb[o++] = r; vb[o++] = st.seed; vb[o++] = st.alpha;
        vb[o++] = st.col[0]; vb[o++] = st.col[1]; vb[o++] = st.col[2]; vb[o++] = st.thick;
        vb[o++] = st.col2[0]; vb[o++] = st.col2[1]; vb[o++] = st.col2[2]; vb[o++] = st.load;
        vb[o++] = st.fid; vb[o++] = st.smear; vb[o++] = st.dry; vb[o++] = st.mix;
        vb[o++] = T[i][0]; vb[o++] = T[i][1];
        this.nv++;
      }
    }
    const ib = this.ibuf;
    for (let i = 0; i < P.length - 1; i++) {
      const a = base + i * 2;
      ib[this.ni++] = a; ib[this.ni++] = a + 1; ib[this.ni++] = a + 2;
      ib[this.ni++] = a + 1; ib[this.ni++] = a + 3; ib[this.ni++] = a + 2;
    }
    this.stats.strokes++;
  };

  // trace a stroke through the direction field, both ways from the seed, stopping at colour edges
  Painter.prototype.trace = function (rng, x0, y0, r, Lmax, tol, Cp, opt) {
    const M = this.maps;
    const step = Math.max(1.2, r * (opt.stepK || 0.55));
    const maxTurn = opt.maxTurn || 0.28;
    const ang0 = (opt.angJit || 0) * rng.gauss();
    const ca = Math.cos(ang0), sa = Math.sin(ang0);
    const seedMat = Math.round(M.B[M.idx(x0, y0) * 4 + 3]);
    const fwdShare = opt.oneWay ? 1 : R.mix(0.3, 0.7, rng());
    const run = (sign, maxLen) => {
      const out = [];
      let x = x0, y = y0, px = 0, py = 0, L = 0;
      while (L < maxLen) {
        let [dx, dy] = M.dir(x, y);
        let ddx = dx * ca - dy * sa, ddy = dx * sa + dy * ca;
        if (opt.dirFn) { const d = opt.dirFn(x, y, ddx, ddy); ddx = d[0]; ddy = d[1]; }
        if (px === 0 && py === 0) { ddx *= sign; ddy *= sign; }
        else if (ddx * px + ddy * py < 0) { ddx = -ddx; ddy = -ddy; }
        if (px !== 0 || py !== 0) {
          // limit the turn per step: a brush cannot bend sharply
          const cr = px * ddy - py * ddx, dt = px * ddx + py * ddy;
          let a = Math.atan2(cr, dt);
          a = R.clamp(a, -maxTurn, maxTurn);
          const c = Math.cos(a), s2 = Math.sin(a);
          ddx = px * c - py * s2; ddy = px * s2 + py * c;
        }
        const nx = x + ddx * step, ny = y + ddy * step;
        if (nx < -r || ny < -r || nx > DW + r || ny > DH + r) break;
        const pc = M.percep(nx, ny);
        const d = Math.hypot(pc[0] - Cp[0], pc[1] - Cp[1], pc[2] - Cp[2]);
        if (L > (opt.minLen || 0) && d > tol) break;
        { const j = M.idx(nx, ny); const m = Math.round(M.B[j * 4 + 3]);
          if (m !== seedMat && !(opt.cross && M.C[j * 4 + 2] > 0.5) && L > r * 0.35) break;
          if (this.blocked(nx, ny, ddx, ddy, r, seedMat)) break; }
        x = nx; y = ny; px = ddx; py = ddy; L += step;
        out.push([x, y]);
      }
      return out;
    };
    const f = run(1, Lmax * fwdShare);
    const b = opt.oneWay ? [] : run(-1, Lmax * (1 - fwdShare));
    const pts = b.reverse().concat([[x0, y0]], f);
    if (pts.length < 2) {
      let [dx, dy] = M.dir(x0, y0);
      const l = r * 0.7;
      return [[x0 - dx * l * 0.5, y0 - dy * l * 0.5], [x0 + dx * l * 0.5, y0 + dy * l * 0.5]];
    }
    // light smoothing
    if (pts.length > 3) for (let it = 0; it < 2; it++) for (let i = 1; i < pts.length - 1; i++) {
      pts[i] = [(pts[i - 1][0] + 2 * pts[i][0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * pts[i][1] + pts[i + 1][1]) / 4];
    }
    return rng() < 0.5 ? pts : pts.reverse();
  };

  // does the brush footprint at (x,y) touch a protected shape of another material?
  Painter.prototype.blocked = function (x, y, dx, dy, r, mat) {
    const M = this.maps;
    for (const k of [-1.05, -0.6, 0.6, 1.05]) {
      for (const a of [0, 0.9]) {
        const j = M.idx(x - dy * r * k + dx * r * a, y + dx * r * k + dy * r * a);
        const m = Math.round(M.B[j * 4 + 3]);
        if (m !== mat && M.C[j * 4 + 2] < 0.5) return true;
      }
    }
    return false;
  };
  // an automatic layer: brushes of a size laid where that size is needed
  Painter.prototype.autoLayer = function (L) {
    const M = this.maps, rng = R.make(this.scene.seed + ':' + L.name);
    const sp = L.spacing || 0.9;
    const Rm = (L.R[0] + L.R[1]) / 2;
    const cell = Rm * sp;
    let errMap = null;
    if (L.thr > 0) {
      const br = Math.max(1, Math.round(Rm * (L.thrScale || 1.6) * M.k));
      errMap = M.blurred(br);
    }
    const errAt = (x, y) => {
      const i = M.idx(x, y) * 3;
      return Math.hypot(M.per[i] - errMap[i], M.per[i + 1] - errMap[i + 1], M.per[i + 2] - errMap[i + 2]);
    };
    const seeds = [];
    const nx = Math.ceil(DW / cell) + 1, ny = Math.ceil(DH / cell) + 1;
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
      for (let rep = 0; rep < (L.density || 1); rep++) {
        let bx = (gx + rng()) * cell - cell * 0.5, by = (gy + rng()) * cell - cell * 0.5;
        if (errMap) {
          let best = -1;
          for (let k = 0; k < 4; k++) {
            const x = (gx + rng()) * cell - cell * 0.5, y = (gy + rng()) * cell - cell * 0.5;
            const e = errAt(R.clamp(x, 0, DW - 1), R.clamp(y, 0, DH - 1));
            if (e > best) { best = e; bx = x; by = y; }
          }
          if (best < L.thr * (0.7 + 0.6 * rng())) continue;
        }
        const x = R.clamp(bx, 0, DW - 1), y = R.clamp(by, 0, DH - 1);
        seeds.push([x, y, rng()]);
      }
    }
    // random painting order
    for (let i = seeds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = seeds[i]; seeds[i] = seeds[j]; seeds[j] = t; }
    // painter's order: background shapes first, then what stands in front of them
    const order = this.scene.order;
    if (order) {
      const rank = (sd) => { const m = Math.round(M.B[M.idx(sd[0], sd[1]) * 4 + 3]); return order[m] || 0; };
      seeds.forEach((sd) => { sd[3] = rank(sd); });
      seeds.sort((a, b) => a[3] - b[3]);
    }
    this.beginLayer(L);
    let count = 0;
    for (const [x, y] of seeds) {
      const i = M.idx(x, y);
      const mat = Math.round(M.B[i * 4 + 3]);
      if (L.where) { const p = L.where(x, y, mat, M, i); if (p <= 0 || rng() > p) continue; }
      const sizeMul = M.B[i * 4 + 2] || 1;
      let r = R.mix(L.R[0], L.R[1], rng()) * (L.useSize === false ? 1 : sizeMul);
      let r2 = r;
      { const d0 = M.dir(x, y); let tries = 0; while (tries < 3 && this.blocked(x, y, d0[0], d0[1], r2, mat)) { r2 *= 0.55; tries++; } }
      if (r2 < Math.max(0.6, (L.minR || 0))) continue;
      r = r2;
      const Cp = M.percep(x, y);
      const Lmax = r * R.mix(L.len[0], L.len[1], rng());
      const pts = this.trace(rng, x, y, r, Lmax, L.tol != null ? L.tol : 0.08, Cp, { minLen: r * (L.minLenK || 0.6), cross: L.cross || (L.cross !== false && M.C[i * 4 + 2] > 0.5), angJit: L.angJit || 0.12, maxTurn: L.maxTurn, stepK: L.stepK, dirFn: L.dirFn });
      // colour: the plan colour along the first part of the stroke (a loaded brush), varied by hand
      let c = [0, 0, 0]; const nS = Math.min(pts.length, 3);
      for (let k = 0; k < nS; k++) { const q = M.colour(pts[k][0], pts[k][1]); c[0] += q[0] / nS; c[1] += q[1] / nS; c[2] += q[2] / nS; }
      const ang = rng() * 6.283, dd = r * R.mix(1.5, 4, rng());
      const x2 = R.clamp(x + Math.cos(ang) * dd, 0, DW - 1), y2 = R.clamp(y + Math.sin(ang) * dd, 0, DH - 1);
      let c2 = Math.round(M.B[M.idx(x2, y2) * 4 + 3]) === mat ? M.colour(x2, y2) : M.colour(x, y);
      const soft = M.C[i * 4 + 2] > 0.5;
      const jv = L.jitV != null ? L.jitV : 0.06, jh = L.jitH != null ? L.jitH : 0.04;
      const vmul = Math.exp(jv * rng.gauss());
      const hm = [1 + jh * rng.gauss(), 1 + jh * rng.gauss(), 1 + jh * rng.gauss()];
      c = c.map((v, k) => Math.max(0, v * vmul * hm[k]));
      if (L.colour) { c = L.colour(c, x, y, mat, rng, M, i); c2 = L.colour(c2, x, y, mat, rng, M, i); }
      if (!c) continue;
      const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      const imp = M.C[i * 4] != null ? M.C[i * 4] : 1;
      const thick = (L.thick || 0.3) * imp * (L.lumThick ? R.mix(1 - L.lumThick, 1 + L.lumThick, R.clamp(Math.sqrt(lum) * 1.6 - 0.3, 0, 1)) : 1);
      this.addStroke({
        pts, r, col: c, col2: c2, alpha: (L.alpha || 0.9) * R.mix(0.85, 1.0, rng()), thick,
        load: (L.load || 1.25) * R.mix(0.85, 1.15, rng()), fid: L.fid || 0, smear: (L.smear || 0) * (soft ? 1 : 0.35), dry: (L.dry != null ? L.dry : 0.6) * (soft ? 1 : 0.35),
        mix: L.mix != null ? L.mix : 0.35, seed: rng() * 100,
      });
      count++;
    }
    this.flush();
    this.stats.layers.push([L.name, count]);
  };
  // a layer of hand-placed strokes: the scene generates them
  Painter.prototype.customLayer = function (L) {
    const rng = R.make(this.scene.seed + ':' + L.name);
    this.beginLayer(L);
    let count = 0;
    const add = (st) => {
      this.addStroke(Object.assign({ alpha: 0.9, thick: 0.2, load: 1.2, fid: 0, smear: 0, dry: 0.5, mix: 0.2, seed: rng() * 100 }, st, { col2: st.col2 || st.col }));
      count++;
    };
    L.generate({ rng, add, maps: this.maps, trace: (x, y, r, Lmax, tol, opt) => this.trace(rng, x, y, r, Lmax, tol, this.maps.percep(x, y), opt || {}), W: DW, H: DH });
    this.flush();
    this.stats.layers.push([L.name, count]);
  };

  Painter.prototype.composite = function (view) {
    const gl = this.gl, sc = this.scene, W = this.W, H = this.H;
    if (!this.compProg) {
      this.compProg = program(gl, FS_VS, COMP_FS(sc.finishGLSL || 'vec3 finishColour(vec3 c, vec2 uv){ return c; }'));
      this.outT = tex(gl, W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
      this.outF = fbo(gl, [this.outT]);
    }
    const P = this.compProg, F = sc.finish;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.outF);
    gl.viewport(0, 0, W, H); gl.disable(gl.BLEND);
    for (let i = 0; i < 2; i++) this.dbi.disableiOES(gl.BLEND, i);
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.colT); gl.uniform1i(P.U.u_col, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.hT); gl.uniform1i(P.U.u_h, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.planT); gl.uniform1i(P.U.u_plan, 2);
    gl.uniform2f(P.U.u_res, W, H); gl.uniform1f(P.U.u_scale, this.scale);
    gl.uniform1f(P.U.u_weaveSp, sc.weavePitch * this.scale); gl.uniform1f(P.U.u_view, view === 'plan' ? 1 : view === 'albedo' ? 2 : 0);
    gl.uniform3fv(P.U.u_light, F.light); gl.uniform1f(P.U.u_hk, F.hk); gl.uniform1f(P.U.u_wk, F.wk); gl.uniform1f(P.U.u_tau, F.tau);
    gl.uniform1f(P.U.u_kd, F.kd); gl.uniform1f(P.U.u_ks, F.ks); gl.uniform1f(P.U.u_shin, F.shin);
    gl.uniform3fv(P.U.u_varnish, F.varnish); gl.uniform1f(P.U.u_crack, F.crack || 0); gl.uniform1f(P.U.u_crackSc, F.crackScale || 60);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.outF);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  };

  Painter.prototype.run = function (view) {
    const t0 = performance.now();
    const sc = this.scene;
    const full = this.renderPlan(this.scale);
    this.planT = full.t[0];
    this.setupCanvas();
    const t1 = performance.now();
    this.maps = this.readPlan(sc.planRes || 0.5);
    this.maps.buildDirections(sc.edgeRef || 0.02);
    const t2 = performance.now();
    if (view !== 'plan') {
      const only = this.opts.layers; // debug: paint only the first N layers
      sc.layers.forEach((L, li) => {
        if (only != null && li >= only) return;
        if (L.generate) this.customLayer(L); else this.autoLayer(L);
      });
    }
    this.gl.finish();
    const t3 = performance.now();
    this.composite(view);
    const gl = this.gl; gl.finish();
    this.stats.ms = { plan: t1 - t0, maps: t2 - t1, paint: t3 - t2, comp: performance.now() - t3 };
  };
  Painter.prototype.pixels = function () {
    const gl = this.gl, W = this.W, H = this.H;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.outF);
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const out = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W * 4, dst = y * W * 3;
      for (let x = 0; x < W; x++) { out[dst + x * 3] = px[src + x * 4]; out[dst + x * 3 + 1] = px[src + x * 4 + 1]; out[dst + x * 3 + 2] = px[src + x * 4 + 2]; }
    }
    return out;
  };

  G.PaintEngine = { Painter, DW, DH, COMMON };
})(typeof window !== 'undefined' ? window : globalThis);
