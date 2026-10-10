/* Ten Hands — 02 · karazuri
 *
 * Blind embossing. White paper pressed into a carved block, no ink. The whole image is a height field
 * (paper fibre, laid lines, vole prints, grass, the owl's wing impression) rendered once on the GPU,
 * then lit every frame by a low raking light whose direction follows the pointer. Nothing is drawn in
 * tone: every value on the sheet is light falling across relief.
 */
(function () {
  'use strict';

  const ROOM = '#cdc9c1';
  const A_L = 1.45;          // landscape sheet aspect (w/h)
  const A_P = 0.6;           // portrait sheet aspect
  const D2R = Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ================================================================ shaders */
  const HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\n';
  const QV = HEAD + 'layout(location=0) in vec2 aQ;\nuniform float uAsp;\n' +
    'vec4 toClip(vec2 w){ return vec4(w.x/uAsp*2.0-1.0, w.y*2.0-1.0, 0.0, 1.0); }\n';
  const HS = 'float hs(float n){ return fract(sin(n*91.3458 + 7.13)*43758.5453); }\n';

  // ---- vole foot print: soft pads, toes and claw dots, all depressions (A channel, MAX)
  const PRINT_VS = QV + `
layout(location=1) in vec4 iA;   // x y angle size
layout(location=2) in vec4 iB;   // kind depth side seed
out vec2 vL; flat out vec4 vB;
void main(){
  vec2 c = vec2(cos(iA.z), sin(iA.z)); vec2 n = vec2(-c.y, c.x);
  vec2 lp = aQ * vec2(0.92, 0.82);
  vL = lp; vB = iB;
  gl_Position = toClip(iA.xy + (c*lp.x + n*lp.y) * iA.w);
}`;
  const PRINT_FS = HEAD + HS + `
in vec2 vL; flat in vec4 vB; out vec4 o;
float pad(vec2 p, vec2 c, vec2 r, float a, float soft){
  p -= c; float cs = cos(a), sn = sin(a);
  p = vec2(cs*p.x + sn*p.y, -sn*p.x + cs*p.y);
  float d = length(p / r);
  return 1.0 - smoothstep(0.15, 1.0 + soft, d);
}
void main(){
  vec2 p = vL; p.y *= vB.z;
  float sd = vB.w;
  float soft = 0.2 + 0.7*hs(sd);
  float v = 0.0;
  if (vB.x > 0.5) {
    v = max(v, 0.30*pad(p, vec2(-0.20, 0.0), vec2(0.42, 0.20), 0.0, 0.6));
    v = max(v, 0.62*pad(p, vec2(-0.43, 0.0), vec2(0.10, 0.075), 0.0, soft));
    v = max(v, 0.85*pad(p, vec2(0.02, 0.10), vec2(0.075, 0.06), 0.4, soft));
    v = max(v, 0.85*pad(p, vec2(0.08, 0.03), vec2(0.07, 0.06), 0.0, soft));
    v = max(v, 0.85*pad(p, vec2(0.07, -0.06), vec2(0.07, 0.06), 0.0, soft));
    v = max(v, 0.75*pad(p, vec2(0.00, -0.12), vec2(0.07, 0.055), -0.4, soft));
    float ta[5] = float[5](1.05, 0.32, 0.02, -0.28, -0.85);
    float tl[5] = float[5](0.25, 0.37, 0.41, 0.37, 0.30);
    for (int i = 0; i < 5; i++) {
      float a = ta[i] + (hs(sd + float(i)*3.1) - 0.5)*0.22;
      vec2 d = vec2(cos(a), sin(a));
      vec2 b = vec2(0.10, 0.0);
      v = max(v, pad(p, b + d*tl[i]*0.86, vec2(0.088, 0.055), a, soft));
      v = max(v, 0.7*pad(p, b + d*(tl[i] + 0.085), vec2(0.035, 0.028), a, soft));
      v = max(v, 0.35*pad(p, b + d*tl[i]*0.45, vec2(0.13, 0.04), a, soft));
    }
  } else {
    v = max(v, 0.30*pad(p, vec2(-0.06, 0.0), vec2(0.25, 0.22), 0.0, 0.6));
    v = max(v, 0.82*pad(p, vec2(0.0, 0.075), vec2(0.07, 0.058), 0.0, soft));
    v = max(v, 0.82*pad(p, vec2(0.0, -0.075), vec2(0.07, 0.058), 0.0, soft));
    v = max(v, 0.82*pad(p, vec2(-0.13, 0.0), vec2(0.075, 0.062), 0.0, soft));
    float ta[4] = float[4](1.15, 0.36, -0.36, -1.1);
    float tl[4] = float[4](0.25, 0.33, 0.33, 0.26);
    for (int i = 0; i < 4; i++) {
      float a = ta[i] + (hs(sd + float(i)*5.7) - 0.5)*0.25;
      vec2 d = vec2(cos(a), sin(a));
      vec2 b = vec2(0.05, 0.0);
      v = max(v, pad(p, b + d*tl[i]*0.85, vec2(0.085, 0.058), a, soft));
      v = max(v, 0.7*pad(p, b + d*(tl[i] + 0.08), vec2(0.035, 0.03), a, soft));
    }
  }
  o = vec4(v * vB.y);
}`;

  // ---- feather: elongated depression, rachis groove, barbs, vane splits (R,G channels, OVER)
  const FEATHER_VS = QV + `
layout(location=1) in vec4 iA;  // bx by ang len
layout(location=2) in vec4 iB;  // wOut wIn curv emarg
layout(location=3) in vec4 iC;  // tipR d0 d1 seed
layout(location=4) in vec4 iD;  // detail sOut soft barbSpacing
out vec2 vL; flat out vec4 vA; flat out vec4 vB; flat out vec4 vC; flat out vec4 vD;
void main(){
  float len = iA.w;
  float w = max(iB.x, iB.y);
  float bend = abs(iB.z) * len;
  float m = iD.z * 2.5 + 0.0015;
  vec2 c = vec2(cos(iA.z), sin(iA.z)); vec2 n = vec2(-c.y, c.x);
  float x = mix(-0.09*len - m, len + m, aQ.x*0.5 + 0.5);
  float y = aQ.y * (w + bend + m);
  vL = vec2(x, y); vA = iA; vB = iB; vC = iC; vD = iD;
  gl_Position = toClip(iA.xy + c*x + n*y);
}`;
  const FEATHER_FS = HEAD + HS + `
in vec2 vL; flat in vec4 vA; flat in vec4 vB; flat in vec4 vC; flat in vec4 vD; out vec4 o;
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
  float a = hs(dot(i, vec2(1.0, 57.0))), b = hs(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0)));
  float c = hs(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0))), e = hs(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));
  return mix(mix(a, b, f.x), mix(c, e, f.x), f.y); }
float halfw(float s, bool outer){
  float W = outer ? vB.x : vB.y;
  float pr = smoothstep(-0.08, 0.05, s);
  float e = vB.w;
  if (e > 0.0) pr *= outer ? (1.0 - 0.62*e*smoothstep(0.44, 0.60, s)) : (1.0 - 0.42*e*smoothstep(0.55, 0.70, s));
  float tr = vC.x;
  float tt = (s - (1.0 - tr)) / tr;
  if (tt > 0.0) pr *= sqrt(max(0.0, 1.0 - tt*tt));
  return W * pr;
}
void main(){
  float len = vA.w;
  float s = vL.x / len;
  float yo = vL.y * vD.y;
  float yc = yo + vB.z * len * s * s;
  bool outer = yc >= 0.0;
  float hw = halfw(s, outer);
  float g = (halfw(s + 0.01, outer) - halfw(s - 0.01, outer)) / (0.02 * len);
  float d = (abs(yc) - hw) / sqrt(1.0 + g*g);
  if (s > 1.0) d = max(d, (s - 1.0) * len);
  d += (vn(vL*620.0 + vC.w) - 0.5) * 0.0008 + (vn(vL*2300.0 + vC.w*3.0) - 0.5) * 0.00025;
  float soft = vD.z;
  float m = 1.0 - smoothstep(-soft, soft, d);
  if (m <= 0.0) discard;
  float sc = clamp(s, 0.0, 1.0);
  float q = clamp(abs(yc) / max(hw, 1e-5), 0.0, 1.0);
  float dep = mix(vC.y, vC.z, sc) * (0.92 + 0.08*(1.0 - q*q)) * (1.0 + 0.26*clamp(yc / max(hw, 1e-5), -1.0, 1.0));
  float rw = mix(0.0010, 0.00045, sc);
  float rach = exp(-(yc*yc)/(rw*rw)) * (1.0 - smoothstep(0.82, 1.0, s)) * smoothstep(0.0, 0.1, s);
  float vane = smoothstep(rw*1.3, rw*3.2, abs(yc)) * smoothstep(0.0, 2.5*soft, -d);
  float sd = vC.w;
  float b = (vL.x - abs(yc) * 1.25) / vD.w;
  float stri = (0.5 + 0.5*sin(6.2831853*b + 2.5*sin(vL.x*140.0 + sd) + 1.5*sin(abs(yc)*900.0 + sd*3.0))) * (0.6 + 0.4*sin(vL.x*260.0 + sd*5.0));
  float bb = b / 5.0 + sd * 7.0;
  float fb5 = (fract(bb) - 0.5)/0.07;
  float split = step(0.66, hs(floor(bb) + (outer ? 13.0 : 0.0) + sd)) * exp(-fb5*fb5) * smoothstep(0.35, 0.85, q);
  float de = d / (1.6*soft);
  float rim = exp(-de*de);
  float det = (0.15*rach + vane*(0.02*stri + 0.11*split)) * vD.x - 0.14*rim;
  o = vec4(dep*m, det*m, 0.0, m);
}`;

  // ---- soft ellipse with irregular rim; mode 0 = OVER into R (depth, alpha), mode 1 = plain value
  const BLOB_VS = QV + `
layout(location=1) in vec4 iA;  // x y rx ry
layout(location=2) in vec4 iB;  // ang val pow noise
layout(location=3) in vec4 iC;  // seed mode
out vec2 vL; flat out vec4 vB; flat out vec4 vC;
void main(){
  vec2 c = vec2(cos(iB.x), sin(iB.x)); vec2 n = vec2(-c.y, c.x);
  float k = 1.0 + iB.w*1.2 + 0.06;
  vec2 lp = aQ * k;
  vL = lp; vB = iB; vC = iC;
  gl_Position = toClip(iA.xy + c*lp.x*iA.z + n*lp.y*iA.w);
}`;
  const BLOB_FS = HEAD + `
in vec2 vL; flat in vec4 vB; flat in vec4 vC; out vec4 o;
void main(){
  float th = atan(vL.y, vL.x);
  float sd = vC.x;
  float nz = vB.w * (0.5*sin(2.0*th + sd*6.1) + 0.3*sin(3.0*th + sd*11.7) + 0.2*sin(5.0*th + sd*3.3) + 0.12*sin(9.0*th + sd*5.9));
  float rr = length(vL) / (1.0 + nz);
  float prof = pow(clamp(1.0 - rr*rr, 0.0, 1.0), vB.z);
  if (vC.y < 0.5) {
    float m = 1.0 - smoothstep(0.5, 1.0, rr);
    o = vec4(vB.y * prof * m, 0.0, 0.0, m);
  } else {
    o = vec4(vB.y * prof);
  }
}`;

  // ---- tapered capsule: tail drags, talon slots, grass blades
  const SEG_VS = QV + `
layout(location=1) in vec4 iA;  // ax ay bx by
layout(location=2) in vec4 iB;  // w0 w1 val pow
out vec2 vW; flat out vec4 vA; flat out vec4 vB;
void main(){
  vec2 a = iA.xy, b = iA.zw; vec2 d = b - a; float L = length(d);
  vec2 t = L > 1e-7 ? d / L : vec2(1.0, 0.0); vec2 n = vec2(-t.y, t.x);
  float w = max(iB.x, iB.y) * 1.25 + 0.0004;
  vec2 c = (a + b) * 0.5;
  vec2 wp = c + t * aQ.x * (L*0.5 + w) + n * aQ.y * w;
  vW = wp; vA = iA; vB = iB;
  gl_Position = toClip(wp);
}`;
  const SEG_FS = HEAD + `
in vec2 vW; flat in vec4 vA; flat in vec4 vB; out vec4 o;
void main(){
  vec2 a = vA.xy, b = vA.zw;
  vec2 pa = vW - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
  float d = length(pa - ba*h);
  float w = mix(vB.x, vB.y, h);
  float rr = d / max(w, 1e-6);
  o = vec4(vB.z * pow(clamp(1.0 - rr*rr, 0.0, 1.0), vB.w));
}`;

  // ---- kozo fibres (additive, own target)
  const FIB_VS = HEAD + `
layout(location=0) in vec2 aP; layout(location=1) in vec2 aX;
uniform float uAsp; out vec2 vX;
void main(){ vX = aX; gl_Position = vec4(aP.x/uAsp*2.0-1.0, aP.y*2.0-1.0, 0.0, 1.0); }`;
  const FIB_FS = HEAD + `
in vec2 vX; out vec4 o;
void main(){ o = vec4(clamp(vX.y, 0.0, 2.0) * clamp(1.0 - vX.x*vX.x, 0.0, 1.0)); }`;

  const FULL_VS = HEAD + `
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p*2.0 - 1.0, 0.0, 1.0); }`;

  const BLUR_FS = HEAD + `
uniform sampler2D uT; uniform vec4 uSig; out vec4 o;
void main(){
  ivec2 sz = textureSize(uT, 0); ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 acc = vec4(0.0), ws = vec4(0.0);
  for (int i = -8; i <= 8; i++) {
    float fi = float(i);
    vec4 w = exp(-fi*fi / (2.0*uSig*uSig));
    acc += texelFetch(uT, ivec2(clamp(p.x + i, 0, sz.x - 1), p.y), 0) * w; ws += w;
  }
  o = acc / ws;
}`;

  const NOISE = `
vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz)*p3.zy); }
float gn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0 - 2.0*f);
  return mix(mix(dot(h22(i)*2.0-1.0, f), dot(h22(i + vec2(1,0))*2.0-1.0, f - vec2(1,0)), u.x),
             mix(dot(h22(i + vec2(0,1))*2.0-1.0, f - vec2(0,1)), dot(h22(i + vec2(1,1))*2.0-1.0, f - vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a*gn(p); p = mat2(1.6, 1.2, -1.2, 1.6)*p + 3.1; a *= 0.5; } return s; }
`;

  // ---- compose: vertical blur of the stamp layers + paper relief + deckle + seal + pencil
  const COMPOSE_FS = HEAD + NOISE + `
uniform sampler2D uT; uniform sampler2D uF; uniform sampler2D uSeal; uniform sampler2D uPen;
uniform vec4 uSig; uniform float uAsp; uniform float uTH;
uniform vec4 uSealR; uniform vec4 uPenR; uniform vec4 uK; uniform vec2 uOff; uniform float uLaid;
layout(location=0) out vec4 oH;
layout(location=1) out vec4 oS;
float fib(ivec2 p, ivec2 sz){ return texelFetch(uF, clamp(p, ivec2(0), sz - 1), 0).r; }
void main(){
  ivec2 sz = textureSize(uT, 0); ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 acc = vec4(0.0), ws = vec4(0.0);
  for (int i = -8; i <= 8; i++) {
    float fi = float(i);
    vec4 w = exp(-fi*fi / (2.0*uSig*uSig));
    acc += texelFetch(uT, ivec2(p.x, clamp(p.y + i, 0, sz.y - 1)), 0) * w; ws += w;
  }
  vec4 st = acc / ws;
  vec2 x = (vec2(p) + 0.5) / uTH;
  vec2 xs = x + uOff;
  float fr = fib(p, sz);
  float fb = fr*0.4 + (fib(p + ivec2(1,0), sz) + fib(p - ivec2(1,0), sz) + fib(p + ivec2(0,1), sz) + fib(p - ivec2(0,1), sz))*0.15;

  float dep = max(st.r, st.a);
  float himg = -uK.x * (dep + st.g) + uK.z * st.b;

  float cock = fbm(xs*1.7)*0.0021 + fbm(xs*4.6 + 3.7)*0.00042;
  float form = fbm(xs*30.0)*0.00006 + gn(xs*95.0)*0.00002;
  float lw = x.y * uLaid + fbm(xs*vec2(2.5, 7.0))*1.2;
  float laid = (0.5 + 0.5*sin(6.2831853*lw)) * (0.55 + 0.45*fbm(xs*16.0 + 9.0));
  float cx = x.x / 0.071 + fbm(xs*3.0)*0.25;
  float cq = (fract(cx) - 0.5)/0.045;
  float chain = exp(-cq*cq);
  float hp = cock + form + laid*0.0000085 + chain*0.000018 + fb*uK.w;

  // deckle
  vec2 size = vec2(uAsp, 1.0);
  vec2 q = abs(x - size*0.5) - (size*0.5 - 0.008);
  float de = -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.008);
  float dn = gn(x*48.0 + uOff)*0.0028 + gn(x*190.0 + 7.0)*0.0011 + gn(x*640.0 + 3.0)*0.00045;
  float dd = de - 0.0042 + dn;
  float mask = smoothstep(0.0, 0.0012, dd);
  float hair = smoothstep(0.6, 1.3, fr) * (1.0 - smoothstep(0.0, 0.0025, -dd));
  mask = max(mask, hair*0.4);
  float thin = smoothstep(0.0, 0.02, dd);
  float hedge = -0.0013 * (1.0 - thin);

  // seal
  vec2 sq = x - uSealR.xy; float cs = cos(uSealR.w), sn = sin(uSealR.w);
  sq = vec2(cs*sq.x + sn*sq.y, -sn*sq.x + cs*sq.y) / uSealR.z + 0.5;
  float seal = 0.0;
  if (sq.x > 0.0 && sq.y > 0.0 && sq.x < 1.0 && sq.y < 1.0) seal = textureLod(uSeal, sq, 0.0).a;
  float inkN = 0.5 + 0.5*smoothstep(-0.3, 0.35, fbm(xs*300.0));
  float press = mix(0.62, 1.05, clamp(dot(sq - 0.5, vec2(0.55, 0.8)) + 0.55, 0.0, 1.0));
  float ink = clamp(seal * inkN * press * (0.75 + 6.0*fb), 0.0, 1.0);
  // pencil
  vec2 pq = (x - uPenR.xy) / uPenR.zw;
  float pen = 0.0;
  if (pq.x > 0.0 && pq.y > 0.0 && pq.x < 1.0 && pq.y < 1.0) pen = textureLod(uPen, pq, 0.0).a;
  float gr = pen * clamp(0.4 + 0.6*smoothstep(-0.25, 0.4, gn(x*1400.0)) + 5.0*fb, 0.0, 1.0);

  float h = himg + hp + hedge - seal*0.00010 - pen*0.00003;
  oH = vec4(h, 0.0, 0.0, 1.0);
  oS = vec4(mask, ink, gr, thin);
}`;

  const NORMAL_FS = HEAD + `
uniform sampler2D uH; uniform float uTH; out vec4 o;
float H(ivec2 q, ivec2 sz){ return texelFetch(uH, clamp(q, ivec2(0), sz - 1), 0).r; }
void main(){
  ivec2 sz = textureSize(uH, 0); ivec2 p = ivec2(gl_FragCoord.xy);
  float h = H(p, sz);
  float dx = (H(p + ivec2(1,0), sz) - H(p - ivec2(1,0), sz)) * 0.5 * uTH;
  float dy = (H(p + ivec2(0,1), sz) - H(p - ivec2(0,1), sz)) * 0.5 * uTH;
  float k = uTH / 1400.0;
  float avg = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i)*0.7853982 + 0.39;
    vec2 d = vec2(cos(a), sin(a));
    avg += H(p + ivec2(d*5.0*k), sz) + H(p + ivec2(d*13.0*k), sz) + H(p + ivec2(d*28.0*k), sz) + H(p + ivec2(d*52.0*k), sz);
  }
  o = vec4(dx, dy, h, avg/32.0 - h);
}`;

  const DISPLAY_FS = HEAD + `
uniform vec2 uRes; uniform vec3 uSheet; uniform float uAsp; uniform vec3 uL; uniform float uEx; uniform float uTexH;
uniform sampler2D uN; uniform sampler2D uS;
out vec4 o;
float sdRect(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 sp = (px - uSheet.xy) / uSheet.z;
  vec2 size = vec2(uAsp, 1.0);
  vec2 cen = size * 0.5;
  float cl = length(uL.xy);
  vec2 Ld = uL.xy / max(cl, 1e-4);
  float tanEl = uL.z / max(cl, 1e-3);

  vec2 wq = sp - cen;
  float lampG = dot(wq, Ld) / (length(size) * 0.9);
  vec3 wall = vec3(0.805, 0.79, 0.762) * (1.0 + 0.07*lampG) * (1.0 - 0.06*smoothstep(0.45, 1.5, length(wq / size)));
  float off = clamp(0.0045 / max(tanEl, 0.08), 0.004, 0.03);
  float sdS = sdRect(wq + Ld*off, cen, 0.006);
  float bl = 0.007 + off*0.7;
  float shad = 1.0 - smoothstep(-bl, bl*1.4, sdS);
  float contact = 1.0 - smoothstep(0.0, 0.012, sdRect(wq, cen, 0.006));
  wall *= 1.0 - 0.16*shad - 0.05*contact;

  vec2 uv = sp / size;
  vec2 uvc = clamp(uv, 0.0, 1.0);
  vec4 su = texture(uS, uvc);
  vec4 nt = texture(uN, uvc);
  vec3 col = wall;
  if (uv.x > -0.005 && uv.x < 1.005 && uv.y > -0.005 && uv.y < 1.005 && su.r > 0.002) {
    vec3 N = normalize(vec3(-nt.x*uEx, -nt.y*uEx, 1.0));
    vec3 L = normalize(uL);
    const float wrap = 0.3;
    float rel = max(dot(N, L) + wrap, 0.0) / (L.z + wrap);
    float h0 = textureLod(uN, uvc, 0.0).z;
    vec2 duv = Ld / size;
    float t = 0.6 / uTexH;
    float occ = 0.0;
    for (int i = 0; i < 12; i++) {
      float hq = textureLod(uN, uvc + duv*t, 0.0).z;
      occ = max(occ, (uEx*(hq - h0) - t*tanEl) / (t*0.07 + 0.00005));
      t *= 1.45;
    }
    float sh = 1.0 - smoothstep(0.0, 1.0, occ);
    float I = 0.5 + 0.5*rel*sh;
    I *= 1.0 - clamp(nt.w*125.0, -0.05, 0.34);
    I *= 1.0 + 0.045*lampG;
    float tone = I < 1.0 ? 1.0 - (1.0 - I)*0.8 : 1.0 + 0.085*(1.0 - exp(-(I - 1.0)*1.8));
    vec3 tint = mix(vec3(0.95, 0.967, 1.0), vec3(1.0, 0.988, 0.962), smoothstep(0.6, 1.3, I));
    vec3 paper = vec3(0.952, 0.942, 0.918) * tone * tint;
    vec3 verm = vec3(0.79, 0.235, 0.135) * (0.5 + 0.5*tone);
    paper = mix(paper, verm, su.g*0.92);
    paper = mix(paper, vec3(0.36, 0.365, 0.38)*tone, su.b*0.72);
    paper = mix(mix(wall, paper, 0.75), paper, su.a);
    col = mix(wall, paper, su.r);
  }
  col += (h12(px) - 0.5) / 255.0;
  o = vec4(col, 1.0);

}`;

  /* ================================================================ composition (CPU) */

  // pencil glyphs, box height 1, y down
  const DIG = {
    '0': [[[0.32, 0.02], [0.1, 0.18], [0.04, 0.55], [0.18, 0.95], [0.4, 0.92], [0.54, 0.55], [0.48, 0.15], [0.3, 0.03]]],
    '1': [[[0.12, 0.25], [0.34, 0.02], [0.30, 1.0]]],
    '2': [[[0.05, 0.25], [0.22, 0.02], [0.48, 0.1], [0.47, 0.38], [0.04, 0.98], [0.6, 0.95]]],
    '3': [[[0.06, 0.14], [0.3, 0.0], [0.52, 0.16], [0.44, 0.38], [0.25, 0.47], [0.5, 0.58], [0.55, 0.82], [0.32, 1.0], [0.03, 0.88]]],
    '4': [[[0.4, 1.0], [0.42, 0.02], [0.03, 0.66], [0.62, 0.68]]],
    '5': [[[0.58, 0.03], [0.14, 0.03], [0.09, 0.44], [0.32, 0.36], [0.55, 0.55], [0.47, 0.92], [0.2, 1.0], [0.02, 0.86]]],
    '6': [[[0.52, 0.05], [0.24, 0.22], [0.07, 0.62], [0.2, 0.98], [0.46, 0.9], [0.5, 0.62], [0.27, 0.5], [0.08, 0.66]]],
    '7': [[[0.03, 0.04], [0.6, 0.03], [0.24, 1.0]]],
    '8': [[[0.33, 0.47], [0.08, 0.25], [0.3, 0.01], [0.52, 0.2], [0.33, 0.47], [0.05, 0.74], [0.27, 1.0], [0.56, 0.78], [0.33, 0.47]]],
    '9': [[[0.52, 0.3], [0.3, 0.47], [0.08, 0.3], [0.27, 0.02], [0.5, 0.15], [0.48, 0.6], [0.36, 1.0]]],
    '/': [[[0.48, -0.05], [0.02, 1.05]]],
  };

  function catmull(pts, per) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), i, t]);
      }
    }
    const l = pts[pts.length - 1];
    out.push([l[0], l[1], pts.length - 2, 1]);
    return out;
  }

  function buildComposition(seed, portrait, A, TH) {
    const rnd = mulberry32((seed ^ 0x5bd1e995) >>> 0);
    const r = (a, b) => a + (b - a) * rnd();
    const J = (s) => (rnd() - 0.5) * 2 * s;

    const C = {
      A, prints: [], owlOps: [], blobA: [], segA: [], blobB: [], segB: [],
    };
    const blob = (arr, x, y, rx, ry, ang, val, pw, nz, mode) => arr.push(x, y, rx, ry, ang, val, pw, nz, rnd() * 100, mode, 0, 0);
    const seg = (arr, ax, ay, bx, by, w0, w1, val, pw) => arr.push(ax, ay, bx, by, w0, w1, val, pw);

    /* ---------------- owl ---------------- */
    const kx = portrait ? A / 0.64 : 1;
    const S = portrait ? [0.395 * kx + J(0.012), 0.345 + J(0.015)] : [0.985 + r(-0.025, 0.02), 0.385 + J(0.018)];
    const L = portrait ? 0.166 : 0.345;
    const rot = r(-0.17, -0.03);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const toS = (X, Y) => [S[0] + L * (X * cr + Y * sr), S[1] + L * (X * sr - Y * cr)];
    const dirS = (dx, dy) => [dx * cr + dy * sr, dx * sr - dy * cr];
    const hd = dirS(0, 1);                    // head direction on the sheet
    const soft = 0.00085;
    const barb = 0.0034;

    const env = (X, Y) => 0.84 + 0.24 * Math.exp(-((X - 0.5) * (X - 0.5) + (Y - 0.1) * (Y - 0.1)) / 0.06) - 0.12 * clamp(-Y / 0.3, 0, 1);

    let fbuf = [];
    const tips = [];
    function F(wing, bx, by, thDeg, len, wOut, wIn, o) {
      let th = thDeg * D2R + wing.sw;
      const c = Math.cos(wing.sw), s = Math.sin(wing.sw);
      const dx = bx - wing.sx, dy = by - wing.sy;
      let X = wing.sx + dx * c - dy * s + (wing.ox || 0), Y = wing.sy + dx * s + dy * c + (wing.oy || 0);
      let ux = Math.cos(th), uy = Math.sin(th);
      let nx = -uy, ny = ux;
      if (o.flip) { nx = -nx; ny = -ny; }
      const eb = o.noEnv ? 1 : env(X, Y), et = o.noEnv ? 1 : env(X + ux * len, Y + uy * len);
      if (wing.m < 0) { X = -X; ux = -ux; nx = -nx; }
      const p = toS(X, Y);
      const sd = dirS(ux, uy), on = dirS(nx, ny);
      const ang = Math.atan2(sd[1], sd[0]);
      const sOut = (on[0] * -sd[1] + on[1] * sd[0]) >= 0 ? 1 : -1;
      const dj = (1 + J(0.1)) * (o.weak && rnd() < 0.07 ? 0.6 : 1);
      fbuf.push(p[0], p[1], ang, len * L,
        wOut * L, wIn * L, o.curv || 0, o.emarg || 0,
        o.tipR, o.d0 * eb * wing.dm * dj, o.d1 * et * wing.dm * dj, rnd() * 50,
        o.detail * (wing.det || 1) * (0.85 + 0.3 * rnd()), sOut, soft, barb * (0.9 + 0.2 * rnd()));
      if (o.tip && !wing.ghost) tips.push({ x: p[0] + sd[0] * len * L, y: p[1] + sd[1] * len * L, a: ang, wing: wing.m });
    }
    const flushF = () => { if (fbuf.length) C.owlOps.push({ k: 'f', d: new Float32Array(fbuf) }); fbuf = []; };
    const flushB = (arr) => { if (arr.length) C.owlOps.push({ k: 'b', d: new Float32Array(arr) }); };

    const wings = [];
    const lighter = rnd() < 0.5 ? 1 : -1;
    for (const m of [-1, 1]) {
      wings.push({ m, sw: (m === lighter ? r(-5, 2) : r(4, 11)) * D2R, sx: 0.10, sy: 0.04,
        dm: m === lighter ? r(0.76, 0.86) : 1.0, spread: m === lighter ? r(0.9, 0.98) : r(1.0, 1.08) });
    }
    const jit = []; for (let i = 0; i < 200; i++) jit.push(J(1));     // shared per-feather jitter so the ghost echoes the wing
    function remiges(wing) {
      let q = 0;
      const NS = 13;
      for (let i = 0; i < NS; i++) {
        const t = i / (NS - 1);
        const bx = lerp(0.455, 0.135, t), by = lerp(0.095, 0.035, t) + 0.012 * Math.sin(t * Math.PI);
        const len = lerp(0.385, 0.34, t) * (1 + 0.035 * jit[q++]);
        F(wing, bx, by, lerp(-72, -104, t) + 2.2 * jit[q++], len, 0.038, 0.052,
          { tipR: 0.21, curv: 0.015, d0: 0.86, d1: 0.78, detail: 1, weak: true });
      }
      for (let i = 0; i < 3; i++) {
        F(wing, lerp(0.13, 0.08, i / 2), 0.03, -105 - i * 7 + 2 * jit[q++], 0.29 - i * 0.03, 0.038, 0.05,
          { tipR: 0.22, curv: 0.0, d0: 0.82, d1: 0.7, detail: 0.9 });
      }
      const PL = [0.365, 0.38, 0.395, 0.41, 0.425, 0.435, 0.44, 0.435, 0.415, 0.355];
      const PW = [0.07, 0.069, 0.068, 0.066, 0.064, 0.062, 0.06, 0.058, 0.055, 0.048];
      const PE = [0, 0, 0, 0, 0.05, 0.3, 0.55, 0.75, 0.9, 0.9];
      for (let i = 0; i < 10; i++) {
        const t = i / 9;
        const th = lerp(-60, 5, Math.pow(t, 0.9)) * wing.spread + 2 * jit[q++];
        F(wing, lerp(0.465, 0.625, t), lerp(0.10, 0.13, t), th, PL[i] * (1 + 0.025 * jit[q++]), PW[i] * 0.36, PW[i] * 0.64,
          { tipR: 0.22, curv: 0.04 + 0.03 * t, emarg: PE[i], d0: 0.95, d1: 0.82, detail: 1, tip: i >= 5, weak: true });
      }
    }
    // the sheet is drawn down softly around the deep impression
    {
      const hb = [];
      const p = toS(0, -0.02);
      blob(hb, p[0], p[1], 1.05 * L, 0.62 * L, rot, 0.16, 2.2, 0.12, 0);
      flushB(hb);
    }
    // tail: short rounded fan of rectrices, drawn first (underneath everything)
    {
      const tw = { m: 1, sw: 0, sx: 0, sy: 0, dm: 0.92 };
      const order = [0, 11, 1, 10, 2, 9, 3, 8, 4, 7, 5, 6];
      const fan = r(23, 29);
      for (const k of order) {
        const a = lerp(-fan, fan, k / 11) + J(1.5);
        const lenT = 0.27 * (1 - 0.07 * Math.abs(a) / 28) * (1 + J(0.03));
        F(tw, Math.sin(a * D2R) * 0.025, -0.13, -90 + a, lenT, 0.033, 0.044,
          { tipR: 0.3, d0: 0.7, d1: 0.62, detail: 0.75, curv: 0, noEnv: true, flip: a < 0 });
      }
      flushF();
    }
    // the second, fainter beat: the wing lifting away again, offset back and out
    {
      const w = wings.find((x) => x.m !== lighter);
      remiges(Object.assign({}, w, { sw: w.sw - r(2, 4) * D2R, ox: r(0.012, 0.022), oy: -r(0.018, 0.03), dm: w.dm * 0.3, det: 0.4, ghost: true }));
      flushF();
    }
    for (const wing of wings) {
      remiges(wing);
      // primary coverts
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        F(wing, lerp(0.47, 0.62, t), lerp(0.11, 0.135, t), lerp(-44, 4, t) + J(2), 0.15, 0.023, 0.034,
          { tipR: 0.3, curv: 0.02, d0: 0.92, d1: 0.86, detail: 0.5 });
      }
      // greater coverts
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        F(wing, lerp(0.45, 0.14, t), lerp(0.118, 0.062, t), lerp(-74, -100, t) + J(2.5), lerp(0.185, 0.155, t), 0.029, 0.039,
          { tipR: 0.32, curv: 0.01, d0: 0.92, d1: 0.84, detail: 0.45 });
      }
      // median coverts
      for (let i = 0; i < 11; i++) {
        const t = i / 10;
        F(wing, lerp(0.44, 0.15, t), lerp(0.138, 0.088, t), lerp(-66, -96, t) + J(3), 0.09, 0.022, 0.03,
          { tipR: 0.4, curv: 0, d0: 0.93, d1: 0.88, detail: 0.3 });
      }
      // lesser coverts, two rows
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 12; i++) {
          const t = i / 11;
          F(wing, lerp(0.44, 0.13, t) + row * 0.012, lerp(0.158, 0.10, t) + row * 0.02, lerp(-70, -95, t) + J(4), 0.058, 0.018, 0.023,
            { tipR: 0.45, curv: 0, d0: 0.95, d1: 0.9, detail: 0.2 });
        }
      }
      flushF();
      // leading-edge band (marginal coverts / patagium): smooth, deep
      const band = [];
      for (let i = 0; i < 10; i++) {
        const t = i / 9;
        const qx = (1 - t) * (1 - t) * 0.09 + 2 * (1 - t) * t * 0.28 + t * t * 0.50;
        const qy = (1 - t) * (1 - t) * 0.075 + 2 * (1 - t) * t * 0.205 + t * t * 0.15;
        const tx = 2 * (1 - t) * (0.28 - 0.09) + 2 * t * (0.50 - 0.28), ty = 2 * (1 - t) * (0.205 - 0.075) + 2 * t * (0.15 - 0.205);
        const a = Math.atan2(ty, tx);
        const ry = 0.03;
        let X = qx + Math.sin(a) * ry, Y = qy - Math.cos(a) * ry;
        const c = Math.cos(wing.sw), s = Math.sin(wing.sw);
        const dx = X - wing.sx, dy = Y - wing.sy;
        X = wing.sx + dx * c - dy * s; Y = wing.sy + dx * s + dy * c;
        const ang = a + wing.sw;
        let vx = Math.cos(ang); const vy = Math.sin(ang);
        if (wing.m < 0) { X = -X; vx = -vx; }
        const p = toS(X, Y); const v = dirS(vx, vy);
        blob(band, p[0], p[1], 0.056 * L, ry * L, Math.atan2(v[1], v[0]), 0.9 * wing.dm, 0.45, 0.06, 0);
      }
      flushB(band);
      // alula
      for (let i = 0; i < 3; i++) {
        F(wing, 0.455 + i * 0.008, 0.135, 40 - i * 9 + J(3), 0.10 + i * 0.015, 0.012, 0.018,
          { tipR: 0.35, curv: 0.03, d0: 0.9, d1: 0.82, detail: 0.4 });
      }
      flushF();
    }
    // body: belly and breast pressed down between the wings
    {
      const b = [];
      let p = toS(0, -0.04);
      blob(b, p[0], p[1], 0.145 * L, 0.175 * L, rot, 0.72, 0.5, 0.08, 0);
      p = toS(0, 0.03);
      blob(b, p[0], p[1], 0.12 * L, 0.13 * L, rot, 0.86, 0.5, 0.1, 0);
      // the broad round face, pressed lightly into the snow just beyond the feet
      p = toS(J(0.01), 0.205);
      blob(b, p[0], p[1], 0.125 * L, 0.105 * L, rot + J(0.15), 0.42, 0.7, 0.07, 0);
      flushB(b);
    }
    // the crater: body and feet driven in; deepest at the front where the talons struck
    const hole = toS(0, 0.075);
    const holeR = 0.075 * L;
    {
      const c0 = toS(0, 0.0);
      blob(C.blobA, c0[0], c0[1], 0.105 * L, 0.15 * L, rot, 1.2, 0.45, 0.14, 1);
      blob(C.blobA, hole[0], hole[1], holeR * 1.05, holeR, rot, 2.05, 0.42, 0.3, 1);
      for (let i = 0; i < 4; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * 0.45 * holeR;
        blob(C.blobA, hole[0] + Math.cos(a) * d, hole[1] + Math.sin(a) * d, holeR * r(0.25, 0.4), holeR * r(0.22, 0.35), rnd() * 3, r(2.15, 2.4), 0.7, 0.35, 1);
      }
      for (let i = 0; i < 4; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * 0.9 * holeR;
        const pc = [lerp(hole[0], c0[0], rnd() * 0.7) + Math.cos(a) * d, lerp(hole[1], c0[1], rnd() * 0.7) + Math.sin(a) * d];
        blob(C.blobB, pc[0], pc[1], holeR * r(0.12, 0.22), holeR * r(0.09, 0.16), rnd() * 3, r(0.35, 0.7), 1.0, 0.3, 1);
      }
    }
    // talons: two feet, toes splayed (two forward, one out, one back), soft slots at the front of the crater
    for (const fx of [-1, 1]) {
      const fc = [fx * 0.032, 0.085];
      const toes = [[90 - 16 * fx, 0.072], [90 + 8 * fx, 0.066], [fx > 0 ? 12 : 168, 0.056], [-90 + 10 * fx, 0.05]];
      for (const [aD, ln] of toes) {
        if (rnd() < 0.15) continue;
        const a = (aD + J(7)) * D2R;
        const r0 = ln * 0.4;
        const p0 = toS(fc[0] + Math.cos(a) * r0, fc[1] + Math.sin(a) * r0), p1 = toS(fc[0] + Math.cos(a) * ln, fc[1] + Math.sin(a) * ln);
        seg(C.segA, p0[0], p0[1], p1[0], p1[1], 0.013 * L, 0.006 * L, r(0.85, 1.1), 1.6);
      }
    }
    // rim and spray: clumps thrown forward and sideways, a few skid marks
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2 + J(0.2);
      const rr = holeR * r(1.05, 1.35);
      blob(C.blobB, hole[0] + Math.cos(a) * rr, hole[1] + Math.sin(a) * rr, holeR * r(0.2, 0.35), holeR * r(0.12, 0.2), a, r(0.25, 0.45), 1.2, 0.3, 1);
    }
    const hAng = Math.atan2(hd[1], hd[0]);
    const nSpray = 30 + Math.floor(rnd() * 14);
    for (let i = 0; i < nSpray; i++) {
      const a = hAng + J(2.5) * Math.pow(rnd(), 0.6);
      const rr = holeR * (1.2 + 5.0 * Math.pow(rnd(), 2.2));
      const x = hole[0] + Math.cos(a) * rr, y = hole[1] + Math.sin(a) * rr;
      const sz = L * (0.006 + 0.016 * Math.pow(rnd(), 3));
      blob(C.blobB, x, y, sz * r(0.8, 1.3), sz * r(0.6, 1.0), rnd() * 3, r(0.5, 1.0), 1.2, 0.35, 1);
      if (rnd() < 0.35) {
        const back = sz * r(1.5, 3);
        blob(C.blobA, x - Math.cos(a) * back, y - Math.sin(a) * back, sz * 0.7, sz * 0.5, a, r(0.3, 0.55), 1.0, 0.3, 1);
      }
      if (rnd() < 0.05) {
        const ln = L * r(0.02, 0.05);
        seg(C.segA, x, y, x + Math.cos(a) * ln, y + Math.sin(a) * ln, 0.004 * L, 0.0015 * L, 0.45, 1.0);
      }
    }
    // primary tips brushing the snow on lift-off
    for (const t of tips) {
      if (t.wing === lighter || rnd() < 0.45) continue;
      let x = t.x - Math.cos(t.a) * 0.012 * L, y = t.y - Math.sin(t.a) * 0.012 * L, a = t.a + J(0.12);
      const ln = L * r(0.03, 0.06);
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        const nx = x + Math.cos(a) * ln / steps, ny = y + Math.sin(a) * ln / steps;
        seg(C.segA, x, y, nx, ny, 0.005 * L * (1 - s / steps * 0.7), 0.005 * L * (1 - (s + 1) / steps * 0.7), 0.38 * (1 - s / steps * 0.75), 1.2);
        x = nx; y = ny; a += J(0.06);
      }
    }

    /* ---------------- grass clump ---------------- */
    const gs = portrait ? 0.62 : 1.0;
    const G = portrait ? [0.19 * kx + J(0.01), 0.725 + J(0.012)] : [0.385 + J(0.015), 0.635 + J(0.015)];
    const wind = -2.3 + J(0.18);
    const blades = [
      { len: 0.095, a: wind + 0.12, c0: 1.6, c1: 12, w: 0.0031, type: 'leaf' },
      { len: 0.07, a: wind - 0.6, c0: -1.2, c1: -13, w: 0.0027, type: 'leaf' },
      { len: 0.13, a: wind + 0.5, c0: 1.0, c1: 6.5, w: 0.0013, type: 'seed' },
      { len: 0.072, a: wind - 0.18, c0: 0.4, c1: 2.5, w: 0.0013, type: 'stem' },
      { len: 0.056, a: wind + 1.25, c0: 3.5, c1: 12, w: 0.0024, type: 'leaf' },
      { len: 0.062, a: wind + 2.85, c0: -2.5, c1: -7, w: 0.0022, type: 'leaf' },
      { len: 0.02, a: wind + 0.9, c0: 0, c1: 0, w: 0.0012, type: 'stem' },
      { len: 0.016, a: wind - 1.2, c0: 0, c1: 0, w: 0.0011, type: 'stem' },
    ];
    blob(C.blobA, G[0], G[1], 0.016 * gs, 0.012 * gs, wind, 0.28, 1.6, 0.3, 1);
    for (const bl of blades) {
      let x = G[0] + J(0.005) * gs, y = G[1] + J(0.004) * gs;
      let a = bl.a + J(0.1);
      const len = bl.len * gs * (1 + J(0.1));
      const N = 18, dl = len / N;
      const sg = 1 + J(0.25);
      const pts = [[x, y, a]];
      for (let k = 0; k < N; k++) {
        const t = (k + 0.5) / N;
        a += (bl.c0 + bl.c1 * t * t) * sg * dl / gs;
        x += Math.cos(a) * dl; y += Math.sin(a) * dl;
        pts.push([x, y, a]);
      }
      const w0 = bl.w * (portrait ? 0.8 : 1);
      const wf = (t) => bl.type === 'leaf' ? w0 * (1 - Math.pow(t, 1.7)) * (0.75 + 0.25 * Math.min(1, t * 6)) + 0.00022
        : w0 * (1 - 0.4 * t);
      for (let k = 0; k < N; k++) {
        const t0 = k / N, t1 = (k + 1) / N;
        seg(C.segB, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], wf(t0), wf(t1), bl.type === 'leaf' ? 0.8 : 1.0, 0.55);
        if (bl.type === 'leaf' && t1 < 0.85) seg(C.segA, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], wf(t0) * 0.16, wf(t1) * 0.16, 0.22, 1.0);
      }
      if (bl.type === 'seed') {
        // a drooping panicle: short branches carrying spikelets
        for (let j = 0; j < 7; j++) {
          const t = 0.6 + 0.4 * j / 6;
          const k = Math.min(N, Math.round(t * N));
          const [px, py, pa] = pts[k];
          const side = j % 2 ? 1 : -1;
          const ba = pa + side * (0.55 + 0.2 * rnd());
          const bl2 = (0.006 + 0.008 * rnd()) * gs * (1 - 0.4 * (t - 0.6) / 0.4);
          const ex = px + Math.cos(ba) * bl2, ey = py + Math.sin(ba) * bl2;
          seg(C.segB, px, py, ex, ey, 0.0006 * gs, 0.0005 * gs, 0.8, 0.6);
          const nsp = 2 + (rnd() < 0.5 ? 1 : 0);
          for (let q = 0; q < nsp; q++) {
            const sa = ba + J(0.5) + (q - 1) * 0.35 * side;
            const rx = (0.0036 + 0.0012 * rnd()) * gs, ry = 0.0015 * gs;
            const cx = lerp(px, ex, 0.55 + 0.45 * q / nsp) + Math.cos(sa) * rx * 0.9, cy = lerp(py, ey, 0.55 + 0.45 * q / nsp) + Math.sin(sa) * rx * 0.9;
            blob(C.blobB, cx, cy, rx, ry, sa, 0.95, 0.7, 0.06, 1);
          }
        }
        const [tx2, ty2, ta2] = pts[N];
        blob(C.blobB, tx2 + Math.cos(ta2) * 0.003 * gs, ty2 + Math.sin(ta2) * 0.003 * gs, 0.0038 * gs, 0.0015 * gs, ta2, 0.95, 0.7, 0.05, 1);
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = rnd() * Math.PI * 2, d = (0.012 + 0.04 * rnd()) * gs;
      const x = G[0] + Math.cos(a) * d, y = G[1] + Math.sin(a) * d;
      blob(C.blobB, x, y, 0.0019 * gs, 0.0011 * gs, rnd() * 3, 0.7, 0.8, 0.1, 1);
      if (rnd() < 0.5) blob(C.blobA, x + 0.002 * gs, y + 0.001 * gs, 0.0013 * gs, 0.001 * gs, 0, 0.5, 1, 0.1, 1);
    }

    /* ---------------- vole trail ---------------- */
    const ps = portrait ? 0.0068 : 0.0122;      // hind print length
    const stride0 = ps * 5.0;
    const holeEdge = 0.16 * L;
    const along = (d, side) => [S[0] + hd[0] * d - hd[1] * side, S[1] + hd[1] * d + hd[0] * side];
    const W = (x, y, s, j) => [x * kx + J(0.012), y + J(0.012), s === undefined ? 1 : s, j === undefined ? 0.12 : j];
    let wps;
    if (!portrait) {
      wps = [W(-0.07, 0.80), W(0.05, 0.775), W(0.15, 0.805), W(0.235, 0.765, 0.9),
        W(0.272, 0.728, 0.42, 0.55), W(0.292, 0.708, 0.38, 0.6), W(0.312, 0.695, 0.5, 0.4)];
    } else {
      wps = [W(0.30, 1.04), W(0.275, 0.955), W(0.325, 0.89), W(0.30, 0.84, 0.42, 0.55), W(0.287, 0.818, 0.38, 0.6), W(0.27, 0.80, 0.5, 0.4)];
    }
    const sitIdx = wps.length - 2;
    {
      const last = wps[wps.length - 1];
      const R = (portrait ? 0.055 : 0.088) * (1 + J(0.06));
      const a0 = Math.atan2(last[1] - G[1], last[0] - G[0]);
      const dir = portrait ? 1 : -1;
      const n = 8;
      for (let k = 1; k <= n; k++) {
        const a = a0 + dir * (k / n) * (portrait ? 5.3 : 5.3);
        const rr = R * (1 + J(0.12));
        wps.push([G[0] + Math.cos(a) * rr, G[1] + Math.sin(a) * rr, 0.85, 0.2]);
      }
    }
    if (!portrait) {
      wps.push(W(0.45, 0.535, 0.85, 0.2), W(0.535, 0.49, 0.8, 0.25), W(0.445, 0.435, 0.8, 0.25), W(0.54, 0.38, 0.8, 0.25),
        W(0.455, 0.32, 0.85, 0.25), W(0.53, 0.25, 0.9), W(0.60, 0.165, 1.15), W(0.72, 0.125, 1.2), W(0.83, 0.115, 1.1));
      wps.push(along(holeEdge + 0.25, 0.045), along(holeEdge + 0.13, 0.01));
    } else {
      wps.push(W(0.10, 0.625, 0.85, 0.2), W(0.165, 0.58, 0.8, 0.25), W(0.085, 0.53, 0.8, 0.25), W(0.16, 0.48, 0.8, 0.25),
        W(0.09, 0.43, 0.85, 0.25), W(0.14, 0.37, 0.9), W(0.12, 0.27, 1.1), W(0.17, 0.185, 1.15), W(0.26, 0.135, 1.1));
      wps.push(along(holeEdge + 0.15, -0.03), along(holeEdge + 0.07, -0.005));
    }
    const endD = holeEdge + ps * 0.9;
    wps.push(along(endD, 0));
    for (const w of wps) { if (w.length < 4) { w[2] = 1; w[3] = 0.12; } }
    const dense = catmull(wps, 28);
    const cum = [0];
    for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    const total = cum[cum.length - 1];
    const at = (s) => {
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] < s) lo = mid; else hi = mid; }
      const t = (s - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
      const a = dense[lo], b = dense[hi];
      const i = a[2], u = a[3];
      const w0 = wps[i], w1 = wps[Math.min(wps.length - 1, i + 1)];
      return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), tx: b[0] - a[0], ty: b[1] - a[1],
        st: lerp(w0[2], w1[2], u), jit: lerp(w0[3], w1[3], u) };
    };
    // sit position
    let sitS = 0;
    {
      let best = 1e9;
      for (let i = 0; i < dense.length; i++) {
        const d = Math.hypot(dense[i][0] - wps[sitIdx][0], dense[i][1] - wps[sitIdx][1]);
        if (d < best) { best = d; sitS = cum[i]; }
      }
    }
    const P = C.prints;
    const pushPrint = (x, y, a, size, kind, dep, side) => P.push(x, y, a, size, kind, dep, side, rnd() * 100);
    function group(q, depthMul, isLast) {
      const tl = Math.hypot(q.tx, q.ty) || 1;
      const ang = Math.atan2(q.ty / tl, q.tx / tl) + J(q.jit);
      const tx = Math.cos(ang), ty = Math.sin(ang), nx = -ty, ny = tx;
      const hl = ps * (0.48 + 0.14 * rnd()), hf = ps * (0.55 + 0.2 * rnd());
      const fl = ps * (0.26 + 0.12 * rnd()), fbk = -ps * (0.8 + 0.4 * rnd());
      const stag = J(0.3) * ps;
      const dep = (0.85 + 0.25 * rnd()) * depthMul;
      const sh = rnd() < 0.08 ? 0.55 : 1;
      pushPrint(q.x + tx * hf + nx * hl, q.y + ty * hf + ny * hl, ang + 0.16 + J(0.1), ps * (1 + J(0.06)), 1, dep, -1);
      pushPrint(q.x + tx * (hf + J(0.15) * ps) - nx * hl, q.y + ty * (hf + J(0.15) * ps) - ny * hl, ang - 0.16 + J(0.1), ps * (1 + J(0.06)), 1, dep * sh, 1);
      pushPrint(q.x + tx * (fbk + stag) + nx * fl, q.y + ty * (fbk + stag) + ny * fl, ang + 0.3 + J(0.15), ps * 0.62, 0, dep * 0.95, -1);
      pushPrint(q.x + tx * (fbk - stag) - nx * fl, q.y + ty * (fbk - stag) - ny * fl, ang - 0.3 + J(0.15), ps * 0.62, 0, dep * 0.95, 1);
      if (!isLast && rnd() < 0.5) {
        let x = q.x + tx * (fbk - ps * 0.7), y = q.y + ty * (fbk - ps * 0.7);
        const ln = ps * r(1.2, 3.2), n = 3;
        let a = ang + Math.PI + J(0.2);
        for (let k = 0; k < n; k++) {
          const nx2 = x + Math.cos(a) * ln / n, ny2 = y + Math.sin(a) * ln / n;
          seg(C.segA, x, y, nx2, ny2, ps * 0.075, ps * 0.065, 0.32 * (1 - k * 0.25), 1.0);
          x = nx2; y = ny2; a += J(0.35);
        }
      }
    }
    let s = total;
    let first = true;
    while (s > -0.05) {
      if (Math.abs(s - sitS) < stride0 * 0.3) { s -= stride0 * 0.3; continue; }
      const q = at(Math.max(0, s));
      if (s < 0) { const tl = Math.hypot(q.tx, q.ty) || 1; q.x += q.tx / tl * s; q.y += q.ty / tl * s; }
      group(q, 1, first);
      first = false;
      s -= stride0 * q.st * (0.82 + 0.36 * rnd());
    }
    // sit mark: the vole stopped, sat up on its haunches
    {
      const q = at(sitS);
      const tl = Math.hypot(q.tx, q.ty) || 1;
      const ang = Math.atan2(q.ty, q.tx) + J(0.5);
      const tx = Math.cos(ang), ty = Math.sin(ang), nx = -ty, ny = tx;
      blob(C.blobA, q.x - tx * ps * 0.2, q.y - ty * ps * 0.2, ps * 0.95, ps * 0.62, ang, 0.42, 1.0, 0.15, 1);
      pushPrint(q.x + nx * ps * 0.62 + tx * ps * 0.15, q.y + ny * ps * 0.62 + ty * ps * 0.15, ang + 0.3, ps * 1.05, 1, 1.05, -1);
      pushPrint(q.x - nx * ps * 0.62 + tx * ps * 0.15, q.y - ny * ps * 0.62 + ty * ps * 0.15, ang - 0.3, ps * 1.05, 1, 1.05, 1);
      pushPrint(q.x + tx * ps * 1.25 + nx * ps * 0.2, q.y + ty * ps * 1.25 + ny * ps * 0.2, ang + 0.2, ps * 0.62, 0, 0.8, -1);
      pushPrint(q.x + tx * ps * 1.3 - nx * ps * 0.22, q.y + ty * ps * 1.3 - ny * ps * 0.22, ang - 0.2, ps * 0.62, 0, 0.6, 1);
      let x = q.x - tx * ps * 1.1, y = q.y - ty * ps * 1.1, a = ang + Math.PI + 0.6;
      for (let k = 0; k < 4; k++) {
        const nx2 = x + Math.cos(a) * ps * 0.6, ny2 = y + Math.sin(a) * ps * 0.6;
        seg(C.segA, x, y, nx2, ny2, ps * 0.08, ps * 0.07, 0.35, 1.0);
        x = nx2; y = ny2; a -= 0.35;
      }
    }

    /* ---------------- seal + pencil placement ---------------- */
    C.seal = portrait ? [0.072 + J(0.004), 0.905 + J(0.004), 0.036, J(0.035)] : [0.088 + J(0.005), 0.878 + J(0.005), 0.043, J(0.035)];
    C.pen = portrait ? [0.03, 0.935, A - 0.06, 0.05] : [0.04, 0.922, A - 0.08, 0.055];
    C.edition = (1 + (seed % 30)) + '/30';
    C.penH = portrait ? 0.0105 : 0.0128;
    C.portrait = portrait;

    /* ---------------- kozo fibres ---------------- */
    {
      const frnd = mulberry32((seed * 7919 + 17) >>> 0);
      const fr = () => frnd();
      const n = Math.round(5600 * A);
      const v = [];
      const minW = 1.35 / TH;
      const pref = fr() * Math.PI;
      for (let i = 0; i < n; i++) {
        let x = -0.012 + fr() * (A + 0.024), y = -0.012 + fr() * 1.024;
        let a = fr() < 0.55 ? pref + (fr() - 0.5) * 0.9 : fr() * Math.PI * 2;
        const r1 = fr();
        const len = 0.008 + 0.07 * r1 * r1 * r1 + 0.012 * fr();
        const bundle = fr() < 0.04;
        const w = Math.max(minW, (0.0005 + 0.0008 * fr() * fr()) * (bundle ? 2.2 : 1));
        const amp = (0.35 + 0.65 * fr()) * (bundle ? 1.4 : 1);
        const ns = Math.max(3, Math.min(14, Math.ceil(len / 0.004)));
        const dl = len / ns;
        const curv = (fr() - 0.5) * 0.16;
        const pts = [];
        for (let k = 0; k <= ns; k++) { pts.push([x, y]); x += Math.cos(a) * dl; y += Math.sin(a) * dl; a += curv + (fr() - 0.5) * 0.1; }
        for (let k = 0; k < ns; k++) {
          const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
          const dx = x1 - x0, dy = y1 - y0, dl2 = Math.hypot(dx, dy) || 1;
          const nx = -dy / dl2 * w, ny = dx / dl2 * w;
          const a0 = amp * Math.pow(Math.sin(Math.PI * k / ns), 0.4), a1 = amp * Math.pow(Math.sin(Math.PI * (k + 1) / ns), 0.4);
          v.push(x0 + nx, y0 + ny, 1, a0, x0 - nx, y0 - ny, -1, a0, x1 + nx, y1 + ny, 1, a1,
            x1 + nx, y1 + ny, 1, a1, x0 - nx, y0 - ny, -1, a0, x1 - nx, y1 - ny, -1, a1);
        }
      }
      C.fibres = new Float32Array(v);
    }
    C.off = [rnd() * 50, rnd() * 50];
    C.prints = new Float32Array(C.prints);
    for (const k of ['blobA', 'segA', 'blobB', 'segB']) C[k] = new Float32Array(C[k]);
    C.rnd = rnd;
    return C;
  }

  /* ---------------- seal (vermilion hanko) ---------------- */
  function drawSeal(N, rnd) {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'); const k = N / 100;
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#000';
    const j = () => (rnd() - 0.5) * 1.2;
    const poly = (pts, w) => {
      g.lineWidth = w * k; g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, (p[0] + j()) * k, (p[1] + j()) * k));
      g.stroke();
    };
    // border: slightly irregular rounded square
    g.lineWidth = 6.5 * k; g.beginPath();
    const r0 = 9, x0 = 6, x1 = 94;
    g.moveTo((x0 + r0) * k, x0 * k); g.lineTo((x1 - r0) * k, (x0 + 0.6) * k); g.quadraticCurveTo(x1 * k, x0 * k, x1 * k, (x0 + r0) * k);
    g.lineTo((x1 - 0.4) * k, (x1 - r0) * k); g.quadraticCurveTo(x1 * k, x1 * k, (x1 - r0) * k, x1 * k);
    g.lineTo((x0 + r0) * k, (x1 - 0.5) * k); g.quadraticCurveTo(x0 * k, x1 * k, x0 * k, (x1 - r0) * k);
    g.lineTo((x0 + 0.5) * k, (x0 + r0) * k); g.quadraticCurveTo(x0 * k, x0 * k, (x0 + r0) * k, x0 * k);
    g.stroke();
    // 雪 in a small-seal manner: rain over a hand
    const W = 5.6;
    poly([[19, 18], [81, 18]], W);
    poly([[50, 18], [50, 50]], W);
    poly([[20, 50], [20, 34], [24, 30], [76, 30], [80, 34], [80, 50]], W);
    poly([[31, 37], [38, 43]], W); poly([[31, 46], [38, 52]], W);
    poly([[69, 37], [62, 43]], W); poly([[69, 46], [62, 52]], W);
    poly([[22, 61], [78, 61], [78, 86]], W);
    poly([[29, 73.5], [78, 73.5]], W);
    poly([[20, 86], [80, 86]], W);
    return c;
  }

  /* ---------------- pencil: edition and signature ---------------- */
  function drawPencil(C, TH, rnd) {
    const [, , pw, ph] = C.pen;
    const W = Math.max(64, Math.round(pw * TH)), H = Math.max(16, Math.round(ph * TH));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.lineCap = 'round'; g.lineJoin = 'round';
    const u = TH;                        // px per sheet unit
    const lw = Math.max(0.9, 0.00085 * u);
    const stroke = (pts) => {
      const sm = catmull(pts, 8);
      for (let pass = 0; pass < 3; pass++) {
        g.strokeStyle = 'rgba(0,0,0,' + (0.36 + 0.12 * rnd()) + ')';
        g.lineWidth = lw * (0.75 + 0.35 * rnd());
        g.beginPath();
        const jx = (rnd() - 0.5) * lw * 0.5, jy = (rnd() - 0.5) * lw * 0.5;
        sm.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, p[0] + jx, p[1] + jy));
        g.stroke();
      }
    };
    const hgt = C.penH * u;
    const base = H * 0.62;
    // edition
    let x = 0.025 * u;
    for (const ch of C.edition) {
      const gl = DIG[ch];
      for (const st of gl) {
        stroke(st.map((p) => [x + (p[0] + (1 - p[1]) * 0.16) * hgt * 0.95, base - hgt + p[1] * hgt]));
      }
      x += (ch === '/' ? 0.5 : 0.64) * hgt + (rnd() - 0.5) * hgt * 0.06;
    }
    // signature: a quick cursive scribble with a capital swash
    const sh = hgt * 1.15;
    const sx = W - 0.025 * u - sh * 5.4;
    const cap = [[0.05, 0.95], [0.18, 0.35], [0.32, -0.2], [0.26, 0.25], [0.12, 0.85], [0.3, 0.42], [0.55, 0.28], [0.44, 0.65], [0.58, 0.9]];
    stroke(cap.map((p) => [sx + p[0] * sh, base - sh + p[1] * sh]));
    const heights = [0.4, 1.0, 0.35, 0.45, 0.9, 0.35, 0.4];
    const pts = [];
    const n = heights.length;
    for (let t = 0; t <= n * Math.PI * 2; t += 0.22) {
      const ci = Math.min(n - 1, Math.floor(t / (Math.PI * 2)));
      const amp = heights[ci] * (0.9 + 0.2 * rnd());
      const yy = 1 - amp * (0.5 - 0.5 * Math.cos(t));
      const xx = 0.62 + 0.62 * t / (Math.PI * 2) - 0.13 * amp * Math.sin(t) + (1 - yy) * 0.22;
      pts.push([sx + xx * sh, base - sh + yy * sh]);
    }
    const lp = pts[pts.length - 1];
    pts.push([lp[0] + sh * 0.5, lp[1] - sh * 0.15], [lp[0] + sh * 1.0, lp[1] - sh * 0.35]);
    stroke(pts);
    stroke([[sx + sh * 1.2, base + sh * 0.28], [sx + sh * 3.0, base + sh * 0.2], [sx + sh * 4.6, base + sh * 0.26]]);
    stroke([[sx + sh * 3.35, base - sh * 0.62], [sx + sh * 3.42, base - sh * 0.6]]);
    return c;
  }

  /* ================================================================ piece */
  (window.PIECES = window.PIECES || []).push({
    id: 'karazuri',
    title: 'Vole, Owl, Snow',
    medium: 'Blind embossing (karazuri) on kozo paper',
    note: 'Move your light across the paper.',
    about: 'A sheet of white kozo paper pressed into a carved block with no ink. A line of vole tracks wanders across the snow, circles some grass, and stops at the print of an owl’s wings. Because the image is only relief, it appears only when light rakes across it.',
    tone: 'light',
    room: ROOM,
    mount(el, api) {
      el.style.background = ROOM;
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair';
      el.appendChild(canvas);
      let alive = true;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
      const failMsg = (msg) => {
        const d = document.createElement('div');
        d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#5a554d;font-style:italic;font-size:18px;text-align:center;padding:24px';
        d.textContent = msg; el.appendChild(d); api.ready();
      };
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
        failMsg('This sheet needs WebGL2 with float render targets to be lit.');
        return { destroy() { alive = false; } };
      }
      const floatBlend = !!gl.getExtension('EXT_float_blend');

      /* ---------- GL helpers ---------- */
      function compile(type, src) {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.slice(0, 200));
        return s;
      }
      function program(vs, fs) {
        const p = gl.createProgram();
        gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const cache = {};
        return { p, u: (n) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(p, n))) };
      }
      let P;
      try {
        P = {
          print: program(PRINT_VS, PRINT_FS), feather: program(FEATHER_VS, FEATHER_FS), blob: program(BLOB_VS, BLOB_FS),
          seg: program(SEG_VS, SEG_FS), fib: program(FIB_VS, FIB_FS), blur: program(FULL_VS, BLUR_FS),
          compose: program(FULL_VS, COMPOSE_FS), normal: program(FULL_VS, NORMAL_FS), disp: program(FULL_VS, DISPLAY_FS),
        };
      } catch (e) {
        console.error(e);
        failMsg('This sheet could not be lit on this device.');
        return { destroy() { alive = false; } };
      }
      const textures = new Set();
      function tex(w, h, ifmt, fmt, type, filter, mips) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        textures.add(t);
        return t;
      }
      function canvasTex(cv) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        textures.add(t);
        return t;
      }
      const delTex = (t) => { if (t) { gl.deleteTexture(t); textures.delete(t); } };
      function fbo(list) {
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        list.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
        gl.drawBuffers(list.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
        return f;
      }
      const quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const instBuf = gl.createBuffer();
      const vaoQuad = gl.createVertexArray();
      gl.bindVertexArray(vaoQuad);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      const vaoEmpty = gl.createVertexArray();
      const fibBuf = gl.createBuffer();
      const vaoFib = gl.createVertexArray();
      gl.bindVertexArray(vaoFib);
      gl.bindBuffer(gl.ARRAY_BUFFER, fibBuf);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
      gl.bindVertexArray(null);

      function drawInst(prog, data, nv4, A) {
        const count = data.length / (nv4 * 4);
        if (!count) return;
        gl.useProgram(prog.p);
        gl.uniform1f(prog.u('uAsp'), A);
        gl.bindVertexArray(vaoQuad);
        gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
        for (let i = 0; i < 4; i++) {
          if (i < nv4) {
            gl.enableVertexAttribArray(1 + i);
            gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, nv4 * 16, i * 16);
            gl.vertexAttribDivisor(1 + i, 1);
          } else gl.disableVertexAttribArray(1 + i);
        }
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
        gl.bindVertexArray(null);
      }
      const frame = () => new Promise((res) => requestAnimationFrame(() => res()));

      /* ---------- layout ---------- */
      let dpr = 1, cw = 1, ch = 1;
      function sheetRect(A) {
        const W = cw, H = ch;
        const portrait = A < 1;
        let sh;
        if (portrait) {
          const mx = Math.max(16, W * 0.045), my = Math.max(36, H * 0.07);
          sh = Math.min(H - 2 * my, (W - 2 * mx) / A);
        } else {
          const mx = Math.max(32, W * 0.06), my = Math.max(28, H * 0.075);
          sh = Math.min(H - 2 * my, (W - 2 * mx) / A);
        }
        const sw = sh * A;
        return { left: (W - sw) / 2, top: (H - sh) / 2 - H * 0.01, sw, sh };
      }
      const wantPortrait = () => ch > cw * 1.05;
      // height-field resolution: a little above the displayed sheet, capped for memory
      const texH = (portrait) => clamp(Math.round(sheetRect(portrait ? A_P : A_L).sh * dpr * 1.3), portrait ? 1300 : 1100,
        Math.floor(2304 / Math.max(portrait ? A_P : A_L, 1)));

      /* ---------- generation ---------- */
      let cur = null;            // { A, TH, nTex, sTex }
      let gen = 0, generating = false;
      async function generate() {
        const my = ++gen;
        generating = true;
        const stale = () => !alive || my !== gen || !api.isCurrent();
        const portrait = wantPortrait();
        const A = portrait ? A_P : A_L;
        const TH = texH(portrait);
        const TW = Math.round(TH * A);
        const C = buildComposition(api.seed >>> 0, portrait, A, TH);
        const sealCv = drawSeal(256, C.rnd);
        const penCv = drawPencil(C, TH, C.rnd);
        await frame(); if (stale()) return;

        const stampFmt = floatBlend ? gl.RGBA32F : gl.RGBA16F;
        const tStamp = tex(TW, TH, stampFmt, gl.RGBA, gl.FLOAT, gl.NEAREST, false);
        const tFib = tex(TW, TH, gl.R16F, gl.RED, gl.FLOAT, gl.NEAREST, false);
        const tTmp = tex(TW, TH, gl.RGBA16F, gl.RGBA, gl.FLOAT, gl.NEAREST, false);
        const tH = tex(TW, TH, gl.R32F, gl.RED, gl.FLOAT, gl.NEAREST, false);
        const tS = tex(TW, TH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, true);
        const tN = tex(TW, TH, gl.RGBA16F, gl.RGBA, gl.FLOAT, gl.LINEAR, true);
        const tSeal = canvasTex(sealCv), tPen = canvasTex(penCv);
        const fStamp = fbo([tStamp]), fFib = fbo([tFib]), fTmp = fbo([tTmp]), fHS = fbo([tH, tS]), fN = fbo([tN]);
        const cleanupTemps = () => {
          [tStamp, tFib, tTmp, tH, tSeal, tPen].forEach(delTex);
          [fStamp, fFib, fTmp, fHS, fN].forEach((f) => gl.deleteFramebuffer(f));
        };
        const abort = () => { cleanupTemps(); delTex(tS); delTex(tN); };

        // ---- stamps
        gl.bindFramebuffer(gl.FRAMEBUFFER, fStamp);
        gl.viewport(0, 0, TW, TH);
        gl.disable(gl.SCISSOR_TEST);
        gl.colorMask(true, true, true, true);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        // owl: premultiplied OVER into R (depth) and G (detail)
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.colorMask(true, true, false, false);
        for (const op of C.owlOps) {
          if (op.k === 'f') drawInst(P.feather, op.d, 4, A);
          else drawInst(P.blob, op.d, 3, A);
        }
        // other depressions: MAX into A
        gl.blendEquation(gl.MAX);
        gl.colorMask(false, false, false, true);
        drawInst(P.print, C.prints, 2, A);
        drawInst(P.blob, C.blobA, 3, A);
        drawInst(P.seg, C.segA, 2, A);
        // raised: MAX into B
        gl.colorMask(false, false, true, false);
        drawInst(P.blob, C.blobB, 3, A);
        drawInst(P.seg, C.segB, 2, A);
        gl.colorMask(true, true, true, true);
        // fibres: ADD
        gl.bindFramebuffer(gl.FRAMEBUFFER, fFib);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(P.fib.p);
        gl.uniform1f(P.fib.u('uAsp'), A);
        gl.bindVertexArray(vaoFib);
        gl.bindBuffer(gl.ARRAY_BUFFER, fibBuf);
        gl.bufferData(gl.ARRAY_BUFFER, C.fibres, gl.STATIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, C.fibres.length / 4);
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
        await frame(); if (stale()) { abort(); return; }

        const sig = [0.0013 * TH, 0.00042 * TH, 0.0007 * TH, 0.00048 * TH].map((v) => Math.max(0.35, v));
        const bands = async (n, fb, w, h, draw) => {
          for (let i = 0; i < n; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.viewport(0, 0, w, h);
            gl.disable(gl.BLEND);
            gl.colorMask(true, true, true, true);
            gl.enable(gl.SCISSOR_TEST);
            const y0 = Math.floor(h * i / n), y1 = Math.floor(h * (i + 1) / n);
            gl.scissor(0, y0, w, y1 - y0);
            draw();
            gl.disable(gl.SCISSOR_TEST);
            await frame(); if (stale()) return false;
          }
          return true;
        };
        const nb = Math.max(1, Math.round(TW * TH / 1.2e6));
        // ---- horizontal blur
        if (!await bands(nb, fTmp, TW, TH, () => {
          gl.useProgram(P.blur.p);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tStamp);
          gl.uniform1i(P.blur.u('uT'), 0);
          gl.uniform4fv(P.blur.u('uSig'), sig);
          gl.bindVertexArray(vaoEmpty); gl.drawArrays(gl.TRIANGLES, 0, 3);
        })) { abort(); return; }
        // ---- compose
        if (!await bands(nb, fHS, TW, TH, () => {
          const p = P.compose;
          gl.useProgram(p.p);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tTmp);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tFib);
          gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tSeal);
          gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tPen);
          gl.uniform1i(p.u('uT'), 0); gl.uniform1i(p.u('uF'), 1); gl.uniform1i(p.u('uSeal'), 2); gl.uniform1i(p.u('uPen'), 3);
          gl.uniform4fv(p.u('uSig'), sig);
          gl.uniform1f(p.u('uAsp'), A); gl.uniform1f(p.u('uTH'), TH);
          gl.uniform4fv(p.u('uSealR'), C.seal);
          gl.uniform4fv(p.u('uPenR'), C.pen);
          gl.uniform4f(p.u('uK'), 0.0016, 1.0, 0.0015, 0.000064);
          gl.uniform2fv(p.u('uOff'), C.off);
          gl.uniform1f(p.u('uLaid'), 1 / 0.0058);
          gl.bindVertexArray(vaoEmpty); gl.drawArrays(gl.TRIANGLES, 0, 3);
        })) { abort(); return; }
        // ---- normals
        if (!await bands(nb, fN, TW, TH, () => {
          gl.useProgram(P.normal.p);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tH);
          gl.uniform1i(P.normal.u('uH'), 0);
          gl.uniform1f(P.normal.u('uTH'), TH);
          gl.bindVertexArray(vaoEmpty); gl.drawArrays(gl.TRIANGLES, 0, 3);
        })) { abort(); return; }
        gl.bindTexture(gl.TEXTURE_2D, tN); gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, tS); gl.generateMipmap(gl.TEXTURE_2D);
        cleanupTemps();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (cur) { delTex(cur.nTex); delTex(cur.sTex); }
        cur = { A, TH, nTex: tN, sTex: tS, portrait };
        generating = false;
      }

      /* ---------- light ---------- */
      // idle: a lamp wandering slowly across the top of the sheet, sinking low (image strong) and rising (image fades)
      const baseAz = (t) => -1.75 - 0.6 * Math.cos(t * 0.05) + 0.22 * Math.sin(t * 0.13);
      const baseEl = (t) => 0.19 + 0.27 * (0.5 - 0.5 * Math.cos(t * 0.1));
      const L = { az: baseAz(0), el: baseEl(0), drift: 0, azOff: 0, elOff: 0, last: -1e9, px: 0, py: 0, idle: true };
      function onMove(e) {
        const r = canvas.getBoundingClientRect();
        L.px = e.clientX - r.left; L.py = e.clientY - r.top;
        L.last = performance.now();
      }
      window.addEventListener('pointermove', onMove, { passive: true });
      canvas.addEventListener('pointerdown', onMove, { passive: true });

      /* ---------- render ---------- */
      let raf = 0, lastT = performance.now(), readySent = false, fence = null, lost = false;
      const onLost = (e) => { e.preventDefault(); lost = true; fence = null; };
      canvas.addEventListener('webglcontextlost', onLost);
      const drawn = { az: 1e9, el: 1e9, cur: null, w: 0, h: 0 };
      function render() {
        if (!cur) return;
        const rect = sheetRect(cur.A);
        const ce = Math.cos(L.el);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true);
        const p = P.disp;
        gl.useProgram(p.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur.nTex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cur.sTex);
        gl.uniform1i(p.u('uN'), 0); gl.uniform1i(p.u('uS'), 1);
        gl.uniform2f(p.u('uRes'), canvas.width, canvas.height);
        gl.uniform3f(p.u('uSheet'), rect.left * dpr, rect.top * dpr, rect.sh * dpr);
        gl.uniform1f(p.u('uAsp'), cur.A);
        gl.uniform3f(p.u('uL'), Math.cos(L.az) * ce, Math.sin(L.az) * ce, Math.sin(L.el));
        gl.uniform1f(p.u('uEx'), 0.72);
        gl.uniform1f(p.u('uTexH'), cur.TH);
        gl.bindVertexArray(vaoEmpty);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      function tick(now) {
        if (!alive || lost) return;
        if (!api.isCurrent()) { alive = false; return; }
        raf = requestAnimationFrame(tick);
        const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
        const active = now - L.last < 3500;
        let tAz, tEl, k;
        if (active) {
          const rect = cur ? sheetRect(cur.A) : sheetRect(A_L);
          const cx = rect.left + rect.sw / 2, cy = rect.top + rect.sh / 2;
          const vx = L.px - cx, vy = L.py - cy;
          const d = Math.hypot(vx, vy) / (0.5 * Math.hypot(rect.sw, rect.sh));
          tAz = Math.atan2(vy, vx);
          tEl = lerp(0.62, 0.15, clamp((d - 0.06) / 0.9, 0, 1));
          k = 1 - Math.exp(-dt / 0.14);
          L.idle = false;
        } else {
          if (!L.idle) {
            L.idle = true;
            L.azOff = Math.atan2(Math.sin(L.az - baseAz(L.drift)), Math.cos(L.az - baseAz(L.drift)));
            L.elOff = L.el - baseEl(L.drift);
          }
          L.drift += dt;
          L.azOff *= Math.exp(-dt / 25); L.elOff *= Math.exp(-dt / 12);
          tAz = baseAz(L.drift) + L.azOff; tEl = baseEl(L.drift) + L.elOff;
          k = 1 - Math.exp(-dt / 0.8);
        }
        const da = Math.atan2(Math.sin(tAz - L.az), Math.cos(tAz - L.az));
        L.az += da * k; L.el += (tEl - L.el) * k;
        if (!cur) return;
        // one frame in flight at most; redraw only when the light has visibly moved
        if (fence) {
          if (gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED) return;
          gl.deleteSync(fence); fence = null;
          if (!readySent) { readySent = true; api.ready(); }
        }
        const changed = Math.abs(Math.atan2(Math.sin(L.az - drawn.az), Math.cos(L.az - drawn.az))) > 0.0012 ||
          Math.abs(L.el - drawn.el) > 0.0006 || drawn.cur !== cur || drawn.w !== canvas.width || drawn.h !== canvas.height;
        if (!changed) return;
        render();
        drawn.az = L.az; drawn.el = L.el; drawn.cur = cur; drawn.w = canvas.width; drawn.h = canvas.height;
        fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
      }

      /* ---------- size ---------- */
      let regenTimer = 0;
      function resize() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        cw = Math.max(1, el.clientWidth); ch = Math.max(1, el.clientHeight);
        canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
        if (!cur && !generating) { generate(); return; }
        if (!cur) return;
        const portrait = wantPortrait();
        if (portrait !== cur.portrait || texH(portrait) > cur.TH * 1.3) {
          clearTimeout(regenTimer);
          regenTimer = setTimeout(() => { if (alive) generate(); }, 350);
        }
      }
      const ro = new ResizeObserver(() => resize());
      ro.observe(el);
      resize();
      raf = requestAnimationFrame(tick);

      return {
        destroy() {
          alive = false;
          cancelAnimationFrame(raf);
          clearTimeout(regenTimer);
          if (fence) { try { gl.deleteSync(fence); } catch (e) { /* ignore */ } fence = null; }
          ro.disconnect();
          window.removeEventListener('pointermove', onMove);
          canvas.removeEventListener('pointerdown', onMove);
          canvas.removeEventListener('webglcontextlost', onLost);
          try { for (const t of textures) gl.deleteTexture(t); } catch (e) { /* ignore */ }
          const lc = gl.getExtension('WEBGL_lose_context');
          if (lc) lc.loseContext();
        },
      };
    },
  });
})();
