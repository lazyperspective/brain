/* Five Strangers — 04
 * "Mr. Pruett Was Left on the Radiator"
 * A plasticine man on a miniature set, photographed. Everything is a signed distance field,
 * ray-marched in WebGL2, accumulated progressively in tiles, then given a lens (depth of field),
 * a film stock and a stop-motion boil.
 */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((c) => Math.pow(c, 2.2));
  };

  /* ------------------------------------------------------------------ shaders */
  const VS = `#version 300 es
in vec2 aP; void main(){ gl_Position = vec4(aP,0.,1.); }`;

  const SCENE = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes; uniform vec2 uJit;
uniform vec3 uCam, uFw, uRt, uUp; uniform float uTanH, uPix;
uniform sampler2D uPrev; uniform float uN;
uniform vec3 uO; uniform float uYaw, uTilt, uMelt, uLid;
uniform vec3 uFP; uniform vec4 uHP1, uHP2;
uniform vec3 uCCard, uCTrou, uCTie, uCWallA, uCWallB, uCWallC;
uniform float uBoil;
out vec4 oC;

#define WZ (-3.3)
#define RX0 (-7.2)
#define RP 0.8
#define RN 15.
#define RZ (-1.65)

float P[13];
int gM;

float h13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec3 h33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ return 0.5*vn(p)+0.25*vn(p*2.03+7.1)+0.125*vn(p*4.07+3.3); }

float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.)/k; return min(a,b) - h*h*k*0.25; }
float smax(float a, float b, float k){ return -smin(-a,-b,k); }
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r); float k1 = length(p/(r*r)); return k0*(k0-1.)/k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-r; }
float sdRC(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b-a; float l2 = dot(ba,ba); float rr = r1-r2; float a2 = l2-rr*rr; float il2 = 1./l2;
  vec3 pa = p-a; float y = dot(pa,ba); float z = y-l2;
  vec3 xv = pa*l2-ba*y; float x2 = dot(xv,xv); float y2 = y*y*l2; float z2 = z*z*l2;
  float k = sign(rr)*rr*rr*x2;
  if (sign(z)*a2*z2 > k) return sqrt(x2+z2)*il2-r2;
  if (sign(y)*a2*y2 < k) return sqrt(x2+y2)*il2-r1;
  return (sqrt(x2*a2*il2)+y*rr)*il2-r1;
}
float sdRBox(vec3 p, vec3 b, float r){ vec3 q = abs(p)-b+r; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r; }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }

/* ---------------- the set ---------------- */
float radiator(vec3 p){
  float px = p.x-RX0; float i = clamp(floor(px/RP+0.5),0.,RN-1.);
  vec3 s = vec3(px-i*RP, p.y-2.75, p.z-RZ);
  // each section: two tubes (front/back) joined top and bottom, a slot through the middle
  float w = 0.27 - 0.025*smoothstep(0.6,0.0,abs(abs(s.y)-1.65));
  float d = sdRBox(s, vec3(w,2.45,1.2), 0.26);
  float slot = sdRBox(s, vec3(1.,1.6,0.42), 0.3);
  d = smax(d, -slot, 0.12);
  // hubs between sections
  float xc = clamp(p.x, RX0, RX0+(RN-1.)*RP);
  vec2 hy = vec2(p.y-0.85, p.z-RZ); vec2 hy2 = vec2(p.y-4.7, p.z-RZ);
  float hub = min(length(hy), length(hy2))-0.36;
  hub = max(hub, abs(p.x-(RX0+(RN-1.)*RP*0.5))-(RN-1.)*RP*0.5-0.1);
  d = min(d, hub);
  // feet
  float fx = min(abs(p.x-(RX0+RP)), abs(p.x-(RX0+(RN-2.)*RP)));
  d = min(d, sdRBox(vec3(fx, p.y-0.2, p.z-RZ), vec3(0.24,0.2,1.0), 0.08));
  return d;
}
float valve(vec3 p){
  vec3 q = p-vec3(RX0-0.75, 0., RZ+0.3);
  float pipe = sdCap(q, vec3(0,-1,0), vec3(0,0.85,0), 0.13);
  pipe = min(pipe, sdCap(q, vec3(0,0.85,0), vec3(0.6,0.85,-0.3), 0.13));
  float body = sdRBox(q-vec3(0,0.85,0), vec3(0.17,0.22,0.17), 0.08);
  float head = sdRBox(q-vec3(0,1.25,0), vec3(0.2,0.1,0.2), 0.08);
  float wheel = length(vec2(length(q.xz)-0.24, q.y-1.38))-0.05;
  return min(min(pipe,body),min(head,wheel));
}

/* ---------------- Mr. Pruett ---------------- */
// man space: origin on the radiator top under his seat, +z toward us, +x his left
vec3 headSpace(vec3 q){
  vec3 v = q-vec3(0.,4.2,0.);
  v.xy = rot(uTilt)*v.xy; v.yz = rot(0.07)*v.yz;
  return v+vec3(0.,4.2,0.)-vec3(0.,5.75,0.05);
}
float man(vec3 q, vec3 p, float rad, float dc, bool full){
  float m = uMelt;
  const float BIG = 1e5;
  float skin=BIG, card=BIG, trou=BIG, shoe=BIG, hair=BIG, eye=BIG, shirt=BIG, tie=BIG, porc=BIG, tea=BIG, btn=BIG, spoon=BIG;
  float bnd = BIG, b;
  // ---------- head ----------
  b = sdBox(q-vec3(0.,5.8,0.35), vec3(1.65,1.75,1.7));
  if (full || b < dc) {
    vec3 h = headSpace(q);
    skin = smin(sdEll(h-vec3(0.,0.25,-0.05), vec3(1.22,1.35,1.22)), sdEll(h-vec3(0.,-0.55,0.3), vec3(1.15,0.92,1.05)), 0.5);
    skin = smin(skin, sdEll(h-vec3(0.,-0.62,0.98), vec3(0.52,0.36,0.36)), 0.22);
    skin = smin(skin, sdEll(h-vec3(0.,-1.2,0.8), vec3(0.42,0.26,0.3)), 0.2);
    float nose = length(h-vec3(0.02,-0.12,1.42))-0.38;
    nose = smin(nose, sdCap(h, vec3(0.,0.42,1.06), vec3(0.01,0.0,1.36), 0.16), 0.15);
    nose = smin(nose, length(h-vec3(0.02,-0.28,1.3))-0.3, 0.1);
    float lid = BIG;
    for (int k=0;k<2;k++){
      float s = k==0 ? -1. : 1.;
      skin = smin(skin, sdEll(h-vec3(s*0.6,-0.4,0.72), vec3(0.42,0.36,0.38)), 0.25);
      vec3 ec = vec3(s*0.45, 0.28, 0.98);
      skin = smax(skin, -(length(h-vec3(s*0.45,0.31,1.08))-0.3), 0.12);
      skin = smin(skin, sdEll(h-vec3(s*0.48,0.0,1.02), vec3(0.28,0.1,0.14)), 0.08);
      eye = min(eye, length(h-ec)-0.17);
      vec3 nl = normalize(vec3(s*0.4,1.,0.3));
      lid = min(lid, max(length(h-ec)-0.174, -(dot(h-ec,nl)-uLid)));
      skin = smin(skin, sdEll(h-vec3(s*1.18,-0.05,0.0), vec3(0.18,0.45,0.32)), 0.08);
      skin = smax(skin, -(length(h-vec3(s*1.33,-0.07,0.08))-0.17), 0.05);
    }
    skin = smin(skin, lid, 0.025);
    skin = smin(skin, nose, 0.06);
    // a short, polite mouth
    float mouth = min(sdCap(h, vec3(-0.25,-0.93,1.22), vec3(0.,-0.88,1.29), 0.034), sdCap(h, vec3(0.,-0.88,1.29), vec3(0.23,-0.94,1.21), 0.034));
    skin = smax(skin, -mouth, 0.035);
    skin = smin(skin, sdEll(h-vec3(0.,-1.02,1.18), vec3(0.2,0.07,0.09)), 0.05);
    // hair: a grey horseshoe fringe, worried brows, a moustache, a hopeful comb-over
    float band = sdEll(h-vec3(0.,0.2,-0.1), vec3(1.31,1.44,1.31));
    float top = 0.62+0.05*sin(h.z*8.+h.x*3.)+0.12*smoothstep(0.,-1.,h.z);
    hair = smax(band, max(max(h.y-top, -0.45-h.y), h.z-0.12+0.25*h.y), 0.12);
    for (int k=0;k<2;k++){
      float s = k==0 ? -1. : 1.;
      hair = min(hair, sdRC(h, vec3(s*0.15,0.82,1.02), vec3(s*0.74,0.62,0.86), 0.09, 0.06));
      float mo = sdRC(h, vec3(s*0.03,-0.52,1.36), vec3(s*0.46,-0.64,1.16), 0.19, 0.12);
      mo = smin(mo, sdRC(h, vec3(s*0.46,-0.64,1.16), vec3(s*0.64,-0.9,1.02), 0.12, 0.06), 0.1);
      hair = min(hair, mo);
    }
    hair = min(hair, min(sdCap(h, vec3(-1.02,1.0,0.15), vec3(-0.35,1.54,0.15), 0.045), sdCap(h, vec3(-0.35,1.54,0.15), vec3(0.45,1.5,0.15), 0.045)));
    hair = min(hair, min(sdCap(h, vec3(-0.97,0.91,0.45), vec3(-0.3,1.46,0.45), 0.04), sdCap(h, vec3(-0.3,1.46,0.45), vec3(0.36,1.43,0.45), 0.04)));
    skin = smin(skin, sdCap(q, vec3(0.,3.9,-0.05), vec3(0.,4.7,0.05), 0.55), 0.2);
  } else bnd = min(bnd, b);
  // ---------- torso: cardigan over shirt and tie ----------
  b = sdBox(q-vec3(0.,2.3,0.15), vec3(1.95,2.2,1.7));
  if (full || b < dc) {
    float torso = smin(sdEll(q-vec3(0.,1.9,0.15), vec3(1.8,1.55,1.45)), sdEll(q-vec3(0.,3.1,-0.05), vec3(1.5,1.1,1.12)), 0.6);
    torso = smin(torso, sdCap(q, vec3(-1.15,3.65,-0.15), vec3(1.15,3.65,-0.15), 0.55), 0.5);
    float vd = max(abs(q.x)-(q.y-2.4)*0.42, 0.25-q.z);
    card = smax(torso, -vd, 0.04);
    shirt = torso+0.05;
    shirt = min(shirt, length(vec2(length(q.xz-vec2(0.,0.02))-0.62, q.y-4.15))-0.15);
    tie = sdRC(vec3(q.x*1.8, q.y, q.z), vec3(0.,3.85,0.82), vec3(0.,2.62,1.45), 0.08, 0.13);
    tie = min(tie, sdEll(q-vec3(0.,4.0,0.84), vec3(0.15,0.14,0.1)));
    for (int k=0;k<2;k++){ float s = k==0 ? -1. : 1.; shirt = min(shirt, sdRC(q, vec3(s*0.12,4.1,0.74), vec3(s*0.44,3.8,0.86), 0.09, 0.045)); }
    btn = min(min(sdEll(q-vec3(0.,2.2,1.54), vec3(0.1,0.1,0.06)), sdEll(q-vec3(0.,1.65,1.55), vec3(0.1,0.1,0.06))), sdEll(q-vec3(0.,1.1,1.36), vec3(0.1,0.1,0.06)));
  } else bnd = min(bnd, b);
  // ---------- arms ----------
  b = min(sdBox(q-vec3(1.4,2.75,0.9), vec3(1.05,1.45,1.55)), sdBox(q-vec3(-1.85,1.8,0.95), vec3(1.0,2.35,1.6)));
  if (full || b < dc) {
    // his left arm: holding the cup, properly
    float arm = sdRC(q, vec3(1.3,3.6,-0.1), vec3(1.95,2.05,0.45), 0.44, 0.38);
    arm = smin(arm, sdRC(q, vec3(1.95,2.05,0.45), vec3(1.15,2.65,1.75), 0.38, 0.33), 0.15);
    // his right arm: has been here too long, holds the saucer at the end of a longer arm
    float sag = 0.18-0.3*(m-1.);
    arm = min(arm, sdRC(q, vec3(-1.3,3.6,-0.1), vec3(-2.42,sag,0.42), 0.44, 0.22));
    arm = smin(arm, sdRC(q, vec3(-2.42,sag,0.42), vec3(-2.3,0.82,1.72), 0.24, 0.32), 0.3);
    card = min(card, arm);
    float hand = sdRC(q, vec3(1.1,2.7,1.82), vec3(0.78,2.88,2.1), 0.3, 0.25);
    hand = smin(hand, sdCap(q, vec3(0.92,2.98,1.95), vec3(0.66,3.12,2.1), 0.1), 0.06);
    float hand2 = sdEll(q-vec3(-2.3,0.9,2.05), vec3(0.36,0.2,0.42));
    hand2 = smin(hand2, sdCap(q, vec3(-2.02,0.94,1.92), vec3(-1.86,1.13,2.12), 0.1), 0.06);
    skin = min(skin, min(hand, hand2));
  } else bnd = min(bnd, b);
  // ---------- trousers, and the melt ----------
  b = min(sdBox(q-vec3(0.05,0.4,0.6), vec3(2.85,1.2,2.35)), sdBox(q-vec3(0.05,-2.3,2.0), vec3(1.7,3.1,1.1)));
  if (full || b < dc) {
    trou = sdEll(q-vec3(0.,0.68,-0.1), vec3(1.85,0.9,1.5));
    trou = smin(trou, sdRC(q, vec3(-0.85,0.68,0.15), vec3(-0.95,0.55,1.95), 0.78, 0.6), 0.3);
    trou = smin(trou, sdRC(q, vec3(0.85,0.66,0.15), vec3(0.97,0.5,1.95), 0.78, 0.59), 0.3);
    // one shin civil, one gone to the floor
    trou = smin(trou, sdRC(q, vec3(-0.95,0.35,2.05), vec3(-0.92,-1.95,1.95), 0.56, 0.44), 0.25);
    float ls = sdRC(q, vec3(0.97,0.3,2.05), vec3(1.02,-2.3,2.0), 0.55, 0.3);
    ls = smin(ls, sdRC(q, vec3(1.02,-2.3,2.0), vec3(1.08,-4.55,1.98), 0.3, 0.42), 0.5);
    trou = smin(trou, ls, 0.2);
    // the seat, spreading over the ribs (carved by the radiator below)
    trou = smin(trou, sdEll(q-vec3(0.05,0.1,0.15), vec3(2.0+0.5*m,0.55,1.55)), 0.5);
  } else bnd = min(bnd, b);
  // drips follow gravity, not him: world space
  b = min(sdBox(p-vec3(1.6,2.6,-0.4), vec3(0.5,2.8,0.4)), sdBox(p-vec3(1.9,0.1,0.35), vec3(1.6,0.35,1.25)));
  b = min(b, sdBox(p-vec3(1.0,4.15,-0.45), vec3(2.3,1.35,0.4)));
  b = min(b, min(sdBox(p-vec3(-1.8,2.75,-0.65), vec3(1.65,2.95,0.65)), sdBox(p-vec3(-3.0,0.1,0.15), vec3(1.0,0.3,0.8))));
  if (full || b < dc) {
    // the long drip: off the front of the seat, between his knees, necking, beading, pooling
    float X = 1.62;
    float dr = sdEll(p-vec3(X-0.05,4.95,-0.49), vec3(0.4,0.5,0.18));
    dr = smin(dr, sdRC(p, vec3(X-0.04,4.7,-0.47), vec3(X+0.06,3.65,-0.49), 0.25, 0.13), 0.35);
    dr = smin(dr, sdRC(p, vec3(X+0.06,3.65,-0.49), vec3(X-0.04,2.5,-0.48), 0.13, 0.17), 0.25);
    dr = smin(dr, sdEll(p-vec3(X-0.04,2.4,-0.45), vec3(0.24,0.3,0.15)), 0.15);
    dr = smin(dr, sdRC(p, vec3(X-0.04,2.25,-0.48), vec3(X+0.04,1.15,-0.49), 0.15, 0.11), 0.2);
    dr = smin(dr, sdRC(p, vec3(X+0.04,1.15,-0.49), vec3(X,0.25,-0.42), 0.11, 0.2), 0.25);
    float pool = sdEll(p-vec3(X-0.05,0.0,0.0), vec3(0.9*m,0.15,0.62*m));
    pool = smin(pool, sdEll(p-vec3(X+0.55,0.0,0.55), vec3(0.75*m,0.12,0.6*m)), 0.4);
    pool = smin(pool, sdEll(p-vec3(X-0.75,0.0,0.32), vec3(0.42*m,0.09,0.32*m)), 0.3);
    dr = smin(dr, pool, 0.45);
    // a tongue of him has crept along the radiator to the left, over the edge and down to the floor
    float tg = sdRC(p, vec3(-0.2,5.38,-1.05), vec3(-1.6,5.3,-0.88), 0.36, 0.26);
    tg = smin(tg, sdRC(p, vec3(-1.6,5.3,-0.88), vec3(-2.7,5.27,-0.74), 0.26, 0.21), 0.2);
    tg = smin(tg, sdRC(p, vec3(-2.7,5.27,-0.74), vec3(-3.2,5.0,-0.5), 0.21, 0.2), 0.2);
    tg = smin(tg, sdRC(p, vec3(-3.2,5.0,-0.5), vec3(-3.16,3.55,-0.5), 0.2, 0.12), 0.25);
    tg = smin(tg, sdEll(p-vec3(-3.2,2.5,-0.47), vec3(0.2,0.32,0.14)), 0.25);
    tg = smin(tg, sdRC(p, vec3(-3.16,3.55,-0.5), vec3(-3.22,1.1,-0.5), 0.12, 0.11), 0.2);
    tg = smin(tg, sdRC(p, vec3(-3.22,1.1,-0.5), vec3(-3.2,0.22,-0.42), 0.11, 0.2), 0.25);
    float pl2 = sdEll(p-vec3(-3.15,0.0,0.02), vec3(0.85*m,0.14,0.62*m));
    pl2 = smin(pl2, sdEll(p-vec3(-2.6,0.0,0.38), vec3(0.5*m,0.1,0.4*m)), 0.3);
    tg = smin(tg, pl2, 0.45);
    // and one that gave up halfway, with a bead at the end
    tg = min(tg, smin(sdRC(p, vec3(-2.42,5.1,-0.52), vec3(-2.4,4.05-0.6*m,-0.5), 0.15, 0.07), length(p-vec3(-2.4,4.0-0.6*m,-0.47))-0.13, 0.1));
    dr = min(dr, tg);
    // lips of clay hanging from the gaps
    dr = min(dr, sdRC(p, vec3(-0.4,5.1,-0.47), vec3(-0.4,4.45-0.4*m,-0.44), 0.17, 0.11));
    dr = min(dr, sdRC(p, vec3(2.8,5.1,-0.47), vec3(2.8,4.55-0.5*m,-0.44), 0.16, 0.1));
    dr = min(dr, length(p-vec3(2.8,4.5-0.5*m,-0.43))-0.13);
    dr = min(dr, sdRC(p, vec3(0.4,5.1,-0.47), vec3(0.4,4.7-0.3*m,-0.45), 0.15, 0.1));
    trou = smin(trou, dr, 0.15);
  } else bnd = min(bnd, b);
  if (trou < BIG*0.5) trou = smax(trou, -(rad-0.004), 0.06);
  // ---------- shoes ----------
  b = min(sdBox(q-vec3(-0.92,-2.25,2.3), vec3(0.65,0.5,0.95)), sdBox(q-vec3(1.12,-5.0,2.45), vec3(0.8,0.4,1.1)));
  if (full || b < dc) {
    shoe = max(sdEll(q-vec3(-0.92,-2.22,2.3), vec3(0.48,0.34,0.8)), -(q.y+2.46));
    shoe = min(shoe, sdEll(q-vec3(1.12,-5.02,2.45), vec3(0.68,0.3,0.98)));
  } else bnd = min(bnd, b);
  // ---------- tea ----------
  b = min(sdBox(q-vec3(0.25,3.0,2.28), vec3(0.75,0.45,0.55)), sdBox(q-vec3(-2.25,1.12,2.1), vec3(0.82,0.25,0.82)));
  if (full || b < dc) {
    vec3 cq = q-vec3(0.05,2.68,2.28);
    float cupO = sdRC(cq, vec3(0.,0.12,0.), vec3(0.,0.45,0.), 0.25, 0.42);
    float cupI = sdRC(cq, vec3(0.,0.17,0.), vec3(0.,0.5,0.), 0.21, 0.385);
    float cup = max(max(cupO, -cupI), cq.y-0.6);
    cup = min(cup, length(vec2(length(cq.xz)-0.2, cq.y-0.06))-0.05);
    vec3 hd = cq-vec3(0.46,0.36,0.);
    cup = min(cup, max(length(vec2(length(hd.xy)-0.13, hd.z))-0.04, -hd.x));
    tea = max(cupI, cq.y-0.48);
    vec3 sq = q-vec3(-2.25,1.08,2.1);
    float rho = length(sq.xz);
    float sau = max(abs(sq.y-0.11*rho*rho)-0.035, rho-0.7)-0.012;
    sau = min(sau, length(vec2(rho-0.33, sq.y+0.02))-0.035);
    porc = min(cup, sau);
    // a teaspoon, resting on the saucer
    spoon = sdCap(sq, vec3(-0.42,0.075,-0.18), vec3(0.12,0.05,0.12), 0.022);
    spoon = min(spoon, sdEll(sq-vec3(0.22,0.05,0.18), vec3(0.11,0.025,0.075)));
  } else bnd = min(bnd, b);
  P[0]=skin; P[1]=card; P[2]=trou; P[3]=shoe; P[4]=hair; P[5]=eye; P[6]=shirt; P[7]=tie; P[8]=porc; P[9]=tea; P[10]=btn; P[11]=spoon;
  float d = min(skin, card);
  d = smin(d, trou, 0.06);
  d = min(min(d, shoe), min(hair, eye));
  d = min(d, min(min(shirt, tie), btn));
  d = min(d, min(min(porc, tea), spoon));
  return min(d, bnd);
}

vec3 toMan(vec3 p){ vec3 q = p-uO; q.xz = rot(uYaw)*q.xz; return q; }

#define XE 10.6
float map(vec3 p){
  // the set: a wallpapered board and a floor of boards, which end where the set ends
  float d = sdBox(p-vec3(XE-40.,40.,WZ-0.3), vec3(40.,40.,0.3)); gM = 1;
  float fl = sdBox(p-vec3(XE-40.,-0.35,10.), vec3(40.,0.35,20.));
  if (fl < d){ d = fl; gM = 3; }
  float tb = p.y+3.;
  if (tb < d){ d = tb; gM = 9; }
  // skirting with a moulded top
  float sk = sdRBox(p-vec3(XE-40.,0.55,WZ+0.05), vec3(40.,0.55,0.2), 0.04);
  sk = min(sk, max(length(vec2(p.y-1.08, p.z-(WZ+0.2)))-0.09, p.x-XE));
  if (sk < d){ d = sk; gM = 2; }
  // picture on the wall
  float fr = sdRBox(p-vec3(-6.4,11.4,WZ), vec3(2.3,1.75,0.22), 0.06);
  fr = smax(fr, -sdBox(p-vec3(-6.4,11.4,WZ+0.25), vec3(1.85,1.3,0.2)), 0.04);
  if (fr < d){ d = fr; gM = 6; }
  // a kitchen clock: it is later than he thinks
  vec3 cp = p-vec3(6.3,11.6,WZ);
  float ck = max(length(cp.xy)-1.25, abs(cp.z-0.2)-0.2)-0.05;
  ck = smax(ck, -max(length(cp.xy)-1.05, -(cp.z-0.32)), 0.05);
  if (ck < d){ d = ck; gM = 7; }
  float rb = sdBox(p-vec3(RX0+(RN-1.)*RP*0.5, 2.6, RZ), vec3((RN-1.)*RP*0.5+0.35, 2.65, 1.25));
  float rad = rb > 0.15 ? rb : radiator(p);
  float vb = sdBox(p-vec3(RX0-0.6, 0.8, RZ+0.1), vec3(0.6,0.9,0.45));
  float va = vb > 0.15 ? vb : valve(p);
  if (min(rad,va) < d){ d = min(rad,va); gM = 4; }
  // the man (bounded)
  vec3 q = toMan(p);
  float bb = sdBox(q-vec3(-0.2,1.3,0.9), vec3(3.5,6.6,2.9));
  bb = min(bb, sdBox(p-vec3(1.6,2.6,0.2), vec3(2.0,2.7,1.4)));
  bb = min(bb, sdBox(p-vec3(-1.9,2.7,-0.4), vec3(1.8,2.9,1.1)));
  if (bb < 0.3){
    float dm = man(q, p, rad, d, false);
    if (dm < d){ d = dm; gM = 10; }
  } else d = min(d, bb+0.2);
  return d;
}

vec3 calcN(vec3 p, float e){
  vec2 k = vec2(1.,-1.);
  return normalize(k.xyy*map(p+k.xyy*e)+k.yyx*map(p+k.yyx*e)+k.yxy*map(p+k.yxy*e)+k.xxx*map(p+k.xxx*e));
}

/* ---------------- clay surface: fingerprints, smears, tool marks ---------------- */
float onePrint(vec3 q, vec3 n, vec3 c, float R, vec3 r, float sw, float fade){
  vec3 v = q-c;
  float dist = length(v);
  if (dist > R) return 0.;
  vec3 t1 = normalize(r-n*dot(r,n)+1e-4); vec3 t2 = cross(n,t1);
  vec2 uv = vec2(dot(v,t1), dot(v,t2)*1.75);
  uv.x += 0.25*uv.y*uv.y/max(R,0.01);
  float rr = length(uv); float an = atan(uv.y, uv.x);
  // a loop/whorl: rings, wound into a slight spiral, pinched on one side like a real print
  float ph = rr/0.068 + sw*an/6.2831 + 0.5*sin(an+sw*7.)*(rr/R) + 0.8*smoothstep(0.,R,rr)*uv.x/max(R,0.01);
  float ridge = cos(6.2831*ph);
  ridge *= smoothstep(0.15,0.45,vn(q*26.+c*3.)+0.25); // broken ridges, minutiae
  float msk = smoothstep(R, R*0.4, dist);
  // a print is partial: the pad rolled off one side
  msk *= smoothstep(-0.05, 0.15, dot(uv, normalize(r.yz+0.01)) + R*0.6);
  return msk*(ridge*0.0052*fade - 0.016*(1.-rr/R)*(1.-rr/R));
}
float prints(vec3 q, vec3 n, float fade){
  float acc = 0.;
  vec3 g = q/1.5+uFP+uBoil*vec3(0.031,0.017,0.023);
  vec3 b = floor(g-0.5);
  for (int k=0;k<8;k++){
    vec3 cell = b+vec3(float(k&1), float((k>>1)&1), float((k>>2)&1));
    vec3 hh = h33(cell);
    if (hh.x > 0.55) continue;
    vec3 c = (cell+0.15+0.7*h33(cell+11.3)-uFP)*1.5;
    acc += onePrint(q, n, c, 0.4+0.2*hh.y, h33(cell+3.7)-0.5, (hh.z-0.5)*2., fade);
  }
  // the sculptor's own, left where the eye goes
  acc += onePrint(q, n, uHP1.xyz, uHP1.w, vec3(0.3,0.5,-0.2), 0.6, fade);
  acc += onePrint(q, n, uHP2.xyz, uHP2.w, vec3(-0.4,0.2,0.3), -0.4, fade);
  return acc;
}

float detail(vec3 q, vec3 p, vec3 n, int part, float fade, float melt){
  float d = 0.;
  float sm = 1.-melt;
  // hand-made unevenness and the long drag of a thumb smoothing it
  d += (fbm(q*2.1+uFP+uBoil*0.05)-0.5)*0.05*sm;
  d += (vn(q*5.3+uFP.yzx)-0.5)*0.012*sm;
  float sdir = dot(q, normalize(vec3(0.7,0.4,0.2)));
  d += (vn(vec3(sdir*2.5, dot(q,vec3(-0.3,0.9,0.1))*14., q.z*3.))-0.5)*0.01*sm;
  if (part==0 || part==1 || part==2 || part==6 || part==3) d += prints(q, n, fade)*sm;
  if (part==1){
    // ribbed waistband and cuffs, pressed in with the edge of a tool
    float an = atan(q.z, q.x);
    float hem = smoothstep(1.25,1.1,q.y)*smoothstep(0.35,0.55,q.y);
    d -= hem*0.012*smoothstep(0.55,0.95,abs(sin(an*30.)))*fade;
    vec3 cw = q-vec3(1.2,2.68,1.68);
    float cuff = smoothstep(0.32,0.22,length(cw))*0.;
    d -= 0.004*smoothstep(0.6,1.,sin(q.x*40.+q.y*12.))*smoothstep(1.4,1.6,q.z)*0.;
  }
  if (part==2){
    // trousers: a crease pinched down the front of each leg
    float cr = min(abs(q.x+0.93), abs(q.x-1.0));
    d += 0.014*smoothstep(0.07,0.0,cr)*smoothstep(1.3,2.0,q.z)*sm;
  }
  if (part==4){
    // hair combed with a toothed tool
    vec3 h = headSpace(q);
    d += 0.012*sin(h.y*60.+h.x*25.+sin(h.z*9.)*3.)*fade;
  }
  return d;
}

/* ---------------- lighting ---------------- */
const vec3 LK = normalize(vec3(-0.6,0.58,0.55));
const vec3 CK = vec3(1.0,0.79,0.58)*2.35;
const vec3 LF = normalize(vec3(0.9,0.2,0.45));
const vec3 CF = vec3(0.45,0.55,0.7)*0.38;
const vec3 LR = normalize(vec3(0.55,0.75,-0.4));
const vec3 CR = vec3(1.0,0.9,0.78)*1.4;

float shadow(vec3 ro, vec3 rd, float k){
  float res = 1., t = 0.015, ph = 1e10;
  for (int i=0;i<56;i++){
    float h = map(ro+rd*t);
    float y = h*h/(2.*ph); float dd = sqrt(max(h*h-y*y,0.));
    res = min(res, k*dd/max(0.0001,t-y));
    ph = h; t += clamp(h, 0.012, 0.7);
    if (res < 0.003 || t > 22.) break;
  }
  res = clamp(res,0.,1.);
  return res*res*(3.-2.*res);
}
float occl(vec3 p, vec3 n){
  float o = 0., s = 1.;
  for (int i=0;i<5;i++){ float h = 0.02+0.12*float(i); float d = map(p+n*h); o += (h-d)*s; s *= 0.72; }
  return clamp(1.-1.8*o, 0., 1.);
}
vec3 env(vec3 r){
  vec3 c = mix(vec3(0.04,0.035,0.03), vec3(0.2,0.17,0.13), smoothstep(-0.4,0.6,r.y));
  c += CK*0.8*smoothstep(0.85,0.97,dot(r,LK));
  c += vec3(0.6,0.75,0.95)*0.8*smoothstep(0.8,0.95,dot(r,normalize(vec3(0.9,0.35,0.3))));
  return c;
}

vec3 clayCol(vec3 q, int part, float melt){
  vec3 c;
  if (part==0) c = vec3(0.82,0.34,0.18);
  else if (part==1) c = uCCard;
  else if (part==2) c = uCTrou;
  else if (part==3) c = vec3(0.022,0.018,0.016);
  else if (part==4) c = vec3(0.24,0.21,0.18);
  else if (part==6) c = vec3(0.72,0.7,0.62);
  else if (part==7) c = uCTie;
  else c = vec3(0.25,0.15,0.08);
  float st = vn(vec3(q.x*2.5,q.y*10.,q.z*2.5)+fbm(q*1.5)*3.);
  if (part==2){
    // where he has melted, the cardigan has run into the trousers
    // where he has run, the cardigan has run with him: streaks drawn out along the flow
    vec3 pw = q*vec3(7.,0.7,7.);
    float fl = vn(pw+fbm(q*2.)*2.);
    float fl2 = vn(pw*1.6+4.+fl);
    c = mix(c, uCCard, smoothstep(0.45,0.62,fl)*melt*0.85);
    c = mix(c, vec3(0.8,0.37,0.22), smoothstep(0.62,0.75,fl2)*melt*0.7);
    c = mix(c, uCTrou*1.25, smoothstep(0.75,0.9,vn(pw*2.3+9.))*melt*0.6);
    c *= 1.-0.1*melt;
  }
  if (part==0){
    vec3 h = headSpace(q);
    // rosy clay worked into nose and cheeks; streaks where it was kneaded
    float rose = smoothstep(0.42,0.1,length(h-vec3(0.02,-0.15,1.4)));
    rose = max(rose, 0.5*smoothstep(0.55,0.15,length(h-vec3(sign(h.x)*0.65,-0.35,0.85))));
    c = mix(c, vec3(0.7,0.2,0.13), rose*0.55);
    c = mix(c, vec3(0.86,0.5,0.34), smoothstep(0.55,0.8,st)*0.35);
  }
  if (part==1) c = mix(c, c*vec3(1.15,1.05,0.9), smoothstep(0.6,0.85,st)*0.4);
  c *= 0.9+0.2*fbm(q*4.+3.);
  // lint, dust, a crumb of another colour
  c = mix(c, c*0.3, step(0.9985, h13(floor(q*55.))));
  c = mix(c, vec3(0.75,0.72,0.66), step(0.99975, h13(floor(q*41.)+5.)));
  if (part!=0) c = mix(c, vec3(0.8,0.37,0.22), step(0.9994, h13(floor(q*30.)+9.)));
  return c;
}

float fiber(vec3 q, vec3 a, vec3 b, vec3 c){
  // a stray hair or lint fibre lying on the clay: distance to a bent segment
  return min(sdCap(q,a,b,0.), sdCap(q,b,c,0.));
}

vec3 wallpaper(vec3 p){
  vec2 u = p.xy;
  // hung in strips; this one dropped a few millimetres at the join
  float sw = 3.4;
  float strip = floor((u.x+1.1)/sw);
  u.y += strip*0.23;
  // regency stripe with sprigs
  float sx = fract(u.x/0.62);
  float band = step(0.5, fract(u.x/1.24));
  vec3 c = mix(uCWallA, mix(uCWallA, uCWallB, 0.35), band);
  c = mix(c, uCWallB, smoothstep(0.035,0.0,abs(sx-0.5)-0.012)*0.5);
  vec2 g = vec2(u.x/1.24, u.y/0.9);
  vec2 cell = floor(g); vec2 f = fract(g)-vec2(0.25,0.5);
  if (mod(cell.y,2.)>0.5) f.y = fract(g.y+0.5)-0.5;
  float r = length(f*vec2(2.4,1.));
  float petal = smoothstep(0.13,0.09,r-0.025*sin(atan(f.y,f.x*2.4)*5.));
  float stem = smoothstep(0.02,0.0,abs(f.x*2.4+0.15*sin(f.y*9.))-0.004)*step(f.y,-0.05)*step(-0.35,f.y);
  c = mix(c, uCWallB*0.85, stem*0.8);
  c = mix(c, uCWallC, petal*0.85);
  c = mix(c, uCWallB*0.7, smoothstep(0.035,0.02,r)*0.8);
  float seam = smoothstep(0.025,0.0,abs(fract((p.x+1.1)/sw)*sw));
  c *= 1.-0.3*seam;
  // age: yellowing, faint foxing, paper grain
  c *= mix(vec3(1.), vec3(1.0,0.93,0.8), 0.35*fbm(vec3(p.xy*0.35,1.)));
  c *= 0.93+0.07*vn(vec3(p.xy*30.,2.));
  // a scorched tide-mark of heat above the radiator
  float heat = smoothstep(7.4,5.3,p.y+0.6*fbm(vec3(p.xy*0.7,4.)))*smoothstep(-8.3,-6.8,p.x)*smoothstep(5.0,3.6,p.x);
  c *= mix(vec3(1.), vec3(0.9,0.8,0.62), heat*0.8);
  return c;
}

vec3 shade(vec3 ro, vec3 rd, float t){
  vec3 p = ro+rd*t;
  float pixw = t*uPix;
  float e = max(0.0006, pixw*0.4);
  vec3 n = calcN(p, e);
  map(p); int mat = gM;
  vec3 alb = vec3(0.5); float rough = 0.6; float f0 = 0.04; float wrap = 0.15; float spec = 1.;
  vec3 sss = vec3(0.); float catchl = 0.;
  vec3 q = toMan(p);
  if (mat==10){
    man(q, p, radiator(p), 1e5, true);
    int part = 0; float best = 1e5;
    for (int i=0;i<12;i++){ if (P[i] < best){ best = P[i]; part = i; } }
    float melt = 0.;
    if (part==2){
      melt = smoothstep(-0.05,-0.25,p.z)*smoothstep(5.6,5.2,p.y);
      melt = max(melt, smoothstep(0.3,-0.5,p.x)*smoothstep(5.8,5.45,p.y));
      melt = max(melt, smoothstep(0.35,0.15,p.y));
      melt = max(melt, smoothstep(0.4,0.7,q.x)*smoothstep(-2.,-4.5,q.y)*0.6);
      melt = max(melt, smoothstep(0.3,-0.2,q.y)*smoothstep(1.4,1.1,q.z)*0.8);
    }
    if (part==5){ alb = vec3(0.008); rough = 0.1; f0 = 0.05; wrap = 0.; catchl = 1.; }
    else if (part==8){
      alb = vec3(0.82,0.8,0.74); rough = 0.12; f0 = 0.05; wrap = 0.25; sss = vec3(0.3,0.3,0.28);
      vec3 cq = q-vec3(0.05,2.68,2.28);
      float rc = length(cq.xz);
      if (rc < 0.6 && cq.y > 0.5) alb = mix(alb, vec3(0.6,0.42,0.12), smoothstep(0.55,0.565,cq.y));
      if (rc < 0.6 && cq.y > 0.2 && cq.y < 0.5) {
        float an = atan(cq.z,cq.x);
        float spr = smoothstep(0.45,0.85,sin(an*7.)*sin(cq.y*30.+an));
        alb = mix(alb, vec3(0.45,0.08,0.1), spr*0.75);
        alb = mix(alb, vec3(0.1,0.25,0.1), smoothstep(0.7,0.95,sin(an*7.+1.2)*sin(cq.y*30.-1.))*0.6);
      }
      vec3 sq = q-vec3(-2.25,1.08,2.1);
      float rho = length(sq.xz);
      if (rho < 0.75 && abs(sq.y) < 0.15) alb = mix(alb, vec3(0.6,0.42,0.12), smoothstep(0.63,0.65,rho));
    }
    else if (part==9){ alb = vec3(0.2,0.085,0.03); rough = 0.05; f0 = 0.03; wrap = 0.; }
    else if (part==10){ alb = vec3(0.16,0.09,0.05); rough = 0.35; f0 = 0.04; }
    else if (part==11){ alb = vec3(0.02); rough = 0.18; f0 = 0.85; wrap = 0.; }
    else {
      alb = clayCol(q, part, melt);
      rough = mix(0.52, 0.26, melt); f0 = 0.03; wrap = 0.5; spec = mix(0.75, 1.0, melt);
      if (part==3){ rough = 0.32; wrap = 0.2; spec = 1.; }
      if (part==4) { rough = 0.7; }
      sss = part==0 ? vec3(0.95,0.25,0.12) : alb*0.7;
      float fade = smoothstep(1.6, 3.4, 0.068/pixw);
      float de = max(0.003, pixw*0.5);
      float d0 = detail(q,p,n,part,fade,melt);
      vec3 gq = vec3(detail(q+vec3(de,0,0),p,n,part,fade,melt)-d0,
                     detail(q+vec3(0,de,0),p,n,part,fade,melt)-d0,
                     detail(q+vec3(0,0,de),p,n,part,fade,melt)-d0)/de;
      gq.xz = rot(-uYaw)*gq.xz;
      n = normalize(n-(gq-n*dot(gq,n)));
      // a stray hair on the cardigan, a blue lint fibre on the trousers
      float fb = fiber(q, vec3(0.55,2.2,1.5), vec3(0.75,1.95,1.5), vec3(0.62,1.7,1.52));
      alb = mix(alb, vec3(0.03,0.025,0.02), smoothstep(0.012,0.004,fb)*(part==1 ? 1. : 0.));
      float fb2 = fiber(q, vec3(-1.0,0.95,1.7), vec3(-0.8,1.08,1.85), vec3(-0.92,1.2,2.0));
      alb = mix(alb, vec3(0.05,0.12,0.4), smoothstep(0.014,0.005,fb2)*(part==2 ? 1. : 0.));
    }
  } else if (mat==9){
    alb = vec3(0.012,0.011,0.01); rough = 0.9;
  } else if (mat==1 && (n.x > 0.5 || p.z < WZ-0.05)){
    // the raw edge of the board: the set is a set
    alb = vec3(0.32,0.22,0.13)*(0.8+0.3*fbm(p*vec3(1.,6.,6.))); rough = 0.8; spec = 0.2;
    alb = mix(alb, wallpaper(p), smoothstep(-0.03,-0.0,p.z-WZ));
  } else if (mat==1){
    alb = wallpaper(p); rough = 0.85; wrap = 0.1; spec = 0.25;
    // the paper is wrapped round the board's edge and has lifted a little at the corner
    alb *= 1.-0.35*smoothstep(XE-0.25,XE,p.x);
  } else if (mat==2){
    alb = vec3(0.6,0.55,0.45)*(0.9+0.1*fbm(p*3.)); rough = 0.28; spec = 0.9;
    alb *= 1.-0.3*smoothstep(0.35,0.0,p.y)*fbm(p*5.);
  } else if (mat==3 && (n.y < 0.5)){
    alb = vec3(0.05,0.035,0.025)*(0.8+0.3*fbm(p*vec3(6.,1.,6.))); rough = 0.8; spec = 0.2;
  } else if (mat==3){
    // floorboards running along the wall, varnished dark, scuffed
    float bw = 1.05; float bz0 = (p.z+30.)/bw; float bi = floor(bz0); float fz = fract(bz0);
    float off = h13(vec3(bi,3.,1.))*20.; float bx = (p.x+off)/11.; float bj = floor(bx);
    vec3 wd = vec3(0.15,0.07,0.032)*(0.75+0.45*h13(vec3(bi,bj,2.)));
    float grain = fbm(vec3(p.x*0.6, p.z*16.+sin(p.x*0.5+bi)*2., bi));
    wd *= 0.7+0.6*grain;
    float gap = smoothstep(0.03,0.0,min(fz,1.-fz));
    float butt = smoothstep(0.03,0.0,abs(fract(bx)-0.5)-0.485);
    alb = mix(wd, vec3(0.006), max(gap,butt)*0.9);
    rough = 0.25+0.35*fbm(p*1.5); spec = 0.8;
    n = normalize(n+vec3(0.,0.,(grain-0.5)*0.05));
  } else if (mat==4){
    // cream gloss over cast iron: many coats, chipped, scorched on top
    float ch = fbm(p*vec3(2.6,1.3,2.6)+5.);
    float cn = ch+0.07*vn(p*30.);
    float chip = smoothstep(0.69,0.71, cn+0.05*smoothstep(4.6,5.2,p.y));
    vec3 cream = vec3(0.5,0.4,0.24)*(0.85+0.2*fbm(p*7.));
    cream = mix(cream, vec3(0.3,0.24,0.15), smoothstep(0.55,0.75,fbm(p*vec3(1.,4.,1.)+1.))*0.5);
    cream = mix(cream, vec3(0.42,0.3,0.15), smoothstep(4.4,5.3,p.y)*0.45*fbm(p*3.+2.));
    vec3 under = vec3(0.17,0.22,0.15);
    vec3 iron = vec3(0.05,0.035,0.03)+vec3(0.1,0.04,0.015)*vn(p*20.);
    alb = mix(cream, under, chip);
    alb = mix(alb, iron, smoothstep(0.73,0.75, cn+0.05*smoothstep(4.6,5.2,p.y)));
    rough = mix(0.28, 0.7, chip); spec = 0.9;
    n = normalize(n + (vec3(vn(p*vec3(5.,35.,5.)), vn(p*vec3(5.,35.,5.)+3.), vn(p*6.+9.))-0.5)*0.14);
    if (p.x < RX0-0.4) { alb = vec3(0.5,0.34,0.12); rough = 0.3; f0 = 0.5; }
    alb *= 1.-0.4*smoothstep(1.0,0.0,p.y);
  } else if (mat==7){
    vec3 cp = p-vec3(6.3,11.6,WZ);
    float r = length(cp.xy);
    if (r < 1.06 && cp.z < 0.36){
      alb = vec3(0.75,0.7,0.58);
      float an = atan(cp.x, cp.y);
      float tk = smoothstep(0.92,0.98,cos(an*12.))*smoothstep(0.78,0.82,r)*smoothstep(0.98,0.94,r);
      alb = mix(alb, vec3(0.05), tk);
      // ten to six
      vec2 hm = vec2(sin(-0.35*6.2831/6.), cos(-0.35*6.2831/6.));
      float ah = 5.83/12.*6.2831; vec2 hh = vec2(sin(ah), cos(ah));
      float am = 50./60.*6.2831; vec2 mm = vec2(sin(am), cos(am));
      float hd = length(cp.xy-hh*clamp(dot(cp.xy,hh),-0.1,0.5));
      float md = length(cp.xy-mm*clamp(dot(cp.xy,mm),-0.1,0.85));
      alb = mix(alb, vec3(0.03), smoothstep(0.06,0.04,min(hd,md)));
      rough = 0.15; f0 = 0.04;
    } else { alb = vec3(0.12,0.05,0.04); rough = 0.25; f0 = 0.05; }
  } else if (mat==6){
    vec3 l = p-vec3(-6.4,11.4,WZ);
    if (abs(l.x)<1.86 && abs(l.y)<1.31 && l.z < 0.1){
      // a seaside, somewhere cool
      float hz = smoothstep(-0.15,-0.05,l.y+0.05*sin(l.x*3.));
      alb = mix(vec3(0.04,0.13,0.2), vec3(0.42,0.56,0.66), hz);
      alb = mix(alb, vec3(0.55,0.45,0.3), smoothstep(-0.65,-0.75,l.y+0.15*sin(l.x*1.3)));
      alb = mix(alb, vec3(0.85,0.8,0.65), smoothstep(0.14,0.0,length(l.xy-vec2(0.9,0.6))));
      rough = 0.5;
    } else { alb = vec3(0.4,0.26,0.08)*(0.7+0.4*fbm(p*9.)); rough = 0.3; f0 = 0.5; }
  }

  vec3 v = -rd;
  float ao = occl(p, n);
  vec3 col = vec3(0.);
  // key: a warm spot, pooled on him
  vec3 C = vec3(1.3,8.6,-0.6);
  float dperp = length(cross(p-C, LK));
  float pool = mix(0.22, 1.12, exp(-dperp*dperp/(2.*4.6*4.6)));
  float sh = shadow(p+n*0.01, LK, 9.);
  float ndl = dot(n, LK);
  float dif = clamp((ndl+wrap)/(1.+wrap), 0., 1.);
  vec3 h = normalize(LK+v);
  float a2 = rough*rough*rough*rough;
  float nh = max(dot(n,h),0.);
  float D = a2/(3.1416*pow(nh*nh*(a2-1.)+1.,2.));
  float F = f0+(1.-f0)*pow(1.-max(dot(h,v),0.),5.);
  float spk = D*F*clamp(ndl,0.,1.)*0.25/max(0.25,dot(n,v));
  vec3 sssTerm = sss*smoothstep(-0.45,0.2,ndl)*smoothstep(0.55,-0.05,ndl)*0.4;
  col += CK*pool*(alb*dif*sh + sssTerm*mix(0.35,1.,sh) + spec*spk*sh);
  float df = clamp((dot(n,LF)+0.3)/1.3,0.,1.);
  col += CF*alb*df*mix(0.5,1.,ao);
  float dr = clamp(dot(n,LR),0.,1.);
  col += CR*alb*dr*0.3*ao + CR*spec*pow(clamp(1.-dot(n,v),0.,1.),4.)*dr*0.5*ao*(1.-rough*0.6);
  col += alb*ao*(vec3(0.09,0.077,0.065)+vec3(0.1,0.06,0.035)*clamp(-n.y,0.,1.));
  vec3 rf = reflect(rd, n);
  float fr = f0+(1.-f0)*pow(1.-max(dot(n,v),0.),5.);
  col += env(rf)*fr*spec*ao*(1.-rough)*(1.-rough)*1.1;
  col *= mix(0.5,1.,ao);
  col += catchl*vec3(3.2,2.9,2.5)*smoothstep(0.955,0.985,dot(rf, normalize(vec3(-0.35,0.12,0.93))));
  return col;
}

void main(){
  vec2 fc = gl_FragCoord.xy+uJit;
  vec2 uv = (fc-0.5*uRes)/uRes.y*2.*uTanH;
  vec3 rd = normalize(uFw+uv.x*uRt+uv.y*uUp);
  vec3 ro = uCam;
  // enter the set box (z<6)
  float t = 0.;
  if (ro.z > 7.) t = (ro.z-7.)/max(-rd.z,1e-3);
  float tmax = 120.;
  bool hit = false;
  for (int i=0;i<220;i++){
    float d = map(ro+rd*t);
    if (d < 0.00035*t){ hit = true; break; }
    t += d*0.85;
    if (t > tmax) break;
  }
  vec3 col = vec3(0.02);
  if (hit) col = shade(ro, rd, t);
  float depth = t*dot(rd,uFw);
  vec4 cur = vec4(col, depth*0.01);
  vec4 prev = texelFetch(uPrev, ivec2(gl_FragCoord.xy), 0);
  oC = uN < 0.5 ? cur : mix(prev, cur, 1./(uN+1.));
}
`;

  const DOF = `#version 300 es
precision highp float;
uniform sampler2D uAcc; uniform sampler2D uPrevD; uniform vec2 uRes;
uniform float uFocus, uCocK, uMaxC, uN, uRot;
uniform vec3 uCam, uFw, uRt, uUp; uniform float uTanH;
out vec4 oC;
// a tilted lens: the plane of focus stands upright through his face, parallel to the wall
float focusAt(vec2 fc){
  vec2 uv = (fc-0.5*uRes)/uRes.y*2.*uTanH;
  vec3 rd = normalize(uFw+uv.x*uRt+uv.y*uUp);
  return (uFocus-uCam.z)/rd.z*dot(rd,uFw);
}
float coc(float z, vec2 fc){ return clamp(uCocK*abs(1./focusAt(fc)-1./max(z,0.01)), 0., uMaxC); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec4 c0 = texelFetch(uAcc, ip, 0);
  float z0 = c0.a*100.; float k0 = coc(z0, gl_FragCoord.xy);
  vec3 sum = c0.rgb/max(k0*k0,1.); float ws = 1./max(k0*k0,1.);
  float rot = h12(gl_FragCoord.xy)*6.2831+uRot;
  const int NT = 72;
  vec2 isz = 1./uRes;
  for (int i=0;i<NT;i++){
    float fi = float(i)+0.5;
    float r = sqrt(fi/float(NT))*uMaxC;
    float a = fi*2.39996+rot;
    vec2 o = vec2(cos(a),sin(a))*r;
    vec4 s = texture(uAcc, (gl_FragCoord.xy+o)*isz);
    float z = s.a*100.;
    float k = coc(z, gl_FragCoord.xy+o);
    if (z > z0+0.15) k = min(k, k0);
    float w = clamp(k-r+1., 0., 1.)/max(k*k,1.);
    sum += s.rgb*w; ws += w;
  }
  vec3 c = sum/ws;
  vec4 pv = texelFetch(uPrevD, ip, 0);
  oC = uN < 0.5 ? vec4(c,1.) : mix(pv, vec4(c,1.), 1./(uN+1.));
}`;

  const PRESENT = `#version 300 es
precision highp float;
uniform sampler2D uImg; uniform vec2 uRes; uniform float uGrain;
out vec4 oC;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  // a touch of lateral chromatic aberration toward the corners
  vec2 dc = (uv-0.5);
  vec3 c;
  c.r = texture(uImg, uv-dc*0.0016).r;
  c.g = texture(uImg, uv).g;
  c.b = texture(uImg, uv+dc*0.0016).b;
  // halation: highlights bleed a little warm light into their surroundings, as film does
  vec3 bl = vec3(0.);
  for (int i=0;i<12;i++){
    float a = float(i)*2.39996; float r = (0.004+0.012*sqrt(float(i)/12.));
    vec3 s = texture(uImg, uv+vec2(cos(a),sin(a))*r*vec2(uRes.y/uRes.x,1.)).rgb;
    bl += max(s-1.8, 0.);
  }
  c += bl/12.*vec3(0.35,0.22,0.12);
  float vig = 1.-0.55*pow(length(dc*vec2(uRes.x/uRes.y,1.)*0.85), 2.2);
  c *= vig;
  c = aces(c*1.05);
  c = pow(c, vec3(1./2.2));
  // warm print, lifted blacks
  float L = dot(c, vec3(0.3,0.59,0.11));
  c = mix(c, c*vec3(1.04,1.0,0.92), smoothstep(0.3,0.9,L));
  c = mix(c, c*vec3(0.94,1.0,1.05), smoothstep(0.35,0.0,L)*0.7);
  c = c*0.96+0.018;
  float g = h12(gl_FragCoord.xy+uGrain*17.)+h12(gl_FragCoord.yx*1.3+uGrain*31.)-1.;
  c += g*0.022*(1.-c*0.6);
  oC = vec4(c,1.);
}`;

  /* ---------------------------------------------------------------- the piece */
  (window.PIECES = window.PIECES || []).push({
    id: 'plasticine',
    title: 'Mr. Pruett Was Left on the Radiator',
    medium: 'Plasticine, cast iron, wallpaper, tea; ray-marched in WebGL2',
    note: 'He is perfectly fine, thank you.',
    about: 'A twelve-centimetre plasticine gentleman, photographed on a miniature set after a long afternoon on the radiator. Every thumbprint, drip and teacup is a signed distance field, lit and focused like a tilted macro lens, because only clay can be this polite about melting.',
    tone: 'dark',
    room: '#17120e',
    mount(el, api) {
      const rnd = mulberry32(api.seed ^ 0x9e3779b9);
      const pick = (a) => a[Math.floor(rnd() * a.length)];
      const cardigans = ['#b8862c', '#3d6448', '#7c2c2a', '#bfa985', '#3b6577', '#8a5a2e'];
      const trousers = ['#6b665c', '#5c4635', '#4a4d57', '#6f6450'];
      const ties = ['#8c2526', '#203461', '#2c5838', '#6a2350'];
      const walls = [
        ['#a9ad86', '#7f8a62', '#e3d7b4'],
        ['#c7a790', '#9a7a68', '#ead8c0'],
        ['#9fb4ab', '#6f8a80', '#e6dcc4'],
        ['#c2b07a', '#8f7d4c', '#efe2bd'],
      ];
      const S = {
        card: hex(pick(cardigans)), trou: hex(pick(trousers)), tie: hex(pick(ties)),
        wall: pick(walls).map(hex),
        melt: 0.8 + rnd() * 0.35,
        yaw: 0.12 + (rnd() - 0.5) * 0.12,
        tilt: -0.09 + (rnd() - 0.5) * 0.08,
        fp: [rnd() * 50, rnd() * 50, rnd() * 50],
      };
      {
        // one print where the eye lands (brow, cheek or dome), one on the body
        const face = [[-0.42, 6.62, 0.98, 0.5], [0.78, 5.3, 1.05, 0.48], [0.5, 7.15, 0.6, 0.5], [-0.75, 5.25, 0.95, 0.46]];
        const body = [[0.75, 1.75, 1.5, 0.55], [-0.95, 1.25, 1.62, 0.5], [-1.4, 2.6, 1.0, 0.5], [0.9, 0.6, 2.0, 0.5]];
        const jig = (v, i) => v + (i < 3 ? (rnd() - 0.5) * 0.15 : 0);
        S.hp1 = face[Math.floor(rnd() * face.length)].map(jig);
        S.hp2 = body[Math.floor(rnd() * body.length)].map(jig);
      };

      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      el.style.background = '#17120e';
      el.appendChild(canvas);
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) {
        el.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cbb;font-style:italic">This work needs WebGL2.</div>';
        api.ready();
        return { destroy() {} };
      }
      const fext = gl.getExtension('EXT_color_buffer_float');
      const IFMT = fext ? gl.RGBA16F : gl.RGBA8, TYPE = fext ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

      function compile(fs) {
        const p = gl.createProgram();
        for (const [t, s] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
          const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
          gl.attachShader(p, sh);
        }
        gl.bindAttribLocation(p, 0, 'aP');
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const u = {};
        const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); }
        return { p, u };
      }
      let progS, progD, progP;
      try { progS = compile(SCENE); progD = compile(DOF); progP = compile(PRESENT); }
      catch (e) { console.error(e); el.textContent = 'This work failed to compile.'; api.ready(); return { destroy() {} }; }

      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      function makeTarget(w, h) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, IFMT, w, h, 0, gl.RGBA, TYPE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return { tex, fb };
      }
      function freeTarget(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } }

      let CW = 0, CH = 0;
      let levels = [];
      let cam = null;
      let alive = true, raf = 0, readyCalled = false;
      let job = null;
      const MAXPASS = +(location.search.match(/passes=(\d+)/) || [0, 12])[1];
      const DBG = /pdbg/.test(location.search);
      const cost = { scene: 0.06, dof: 0.004 }; // ms of GPU time per pixel, learned as we go
      const inflight = [];
      let lastSignal = 0;

      function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
      function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
      function setupCamera() {
        const aspect = CW / CH;
        const O = [1.3, 5.2, -1.65];
        const face = [O[0] + 0.2, O[1] + 6.05, O[2] + 1.15];
        const needH = 14.6, needW = aspect < 1 ? 8.6 : 21;
        let visH = Math.max(needH, needW / aspect);
        const tanH = Math.tan(13.5 * Math.PI / 180);
        const dir = norm([0.3, 0.3, 1]);
        let target = [aspect < 1 ? 1.1 : (aspect > 2 ? -1.0 : 0.6), aspect < 1 ? 6.0 : 6.7, -0.2];
        const view = (location.search.match(/view=(\w+)/) || [])[1];
        if (view === 'face') { visH = 4.2; target = face.slice(); }
        if (view === 'body') { visH = 8; target = [O[0], O[1] + 2.5, O[2] + 1.5]; }
        if (view === 'drip') { visH = 6.5; target = [-0.6, 2.6, -0.4]; }
        const dist = 13.6 / (2 * tanH);
        const pos = [target[0] + dir[0] * dist, target[1] + dir[1] * dist, target[2] + dir[2] * dist];
        const fw = norm([-dir[0], -dir[1], -dir[2]]);
        const rt = norm(cross(fw, [0, 1, 0]));
        const up = cross(rt, fw);
        const fd = [face[0] - pos[0], face[1] - pos[1], face[2] - pos[2]];
        const focus = fd[0] * fw[0] + fd[1] * fw[1] + fd[2] * fw[2];
        cam = { pos, fw, rt, up, tanH: tanH * visH / 13.6, focus, zf: -0.42, cocK: 2.7 * (dist / 30) * 13.6 / visH, maxC: 0.02 };
      }

      function mkLevel(scale, maxPass) {
        const w = Math.max(32, Math.round(CW * scale)), h = Math.max(32, Math.round(CH * scale));
        return { w, h, acc: [makeTarget(w, h), makeTarget(w, h)], dof: [makeTarget(w, h), makeTarget(w, h)], passN: 0, dofN: 0, maxPass };
      }
      let takes = null, blinkT = 0, playing = 0;
      function freeLevels() {
        for (const l of levels) { l.acc.forEach(freeTarget); l.dof.forEach(freeTarget); }
        levels = [];
        if (takes) { takes.scratch.forEach(freeTarget); takes.frames.forEach((t) => freeTarget(t.img)); takes = null; }
        clearTimeout(blinkT); clearTimeout(playing);
      }
      function resize() {
        const r = el.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let w = Math.max(64, Math.round(r.width * dpr)), h = Math.max(64, Math.round(r.height * dpr));
        const maxPix = 4.2e6;
        if (w * h > maxPix) { const s = Math.sqrt(maxPix / (w * h)); w = Math.round(w * s); h = Math.round(h * s); }
        if (w === CW && h === CH) return false;
        CW = w; CH = h;
        canvas.width = CW; canvas.height = CH;
        freeLevels();
        setupCamera();
        // a quick half-resolution proof first, then the real thing, refined pass by pass
        levels = [mkLevel(0.5, 1), mkLevel(1, MAXPASS)];
        queue = [];
        for (let li = 0; li < levels.length; li++) for (let n = 0; n < levels[li].maxPass; n++) queue.push(levelPass(li));
        queue.push(() => buildTakes());
        job = null;
        return true;
      }

      function jitter(n) {
        if (n === 0) return [0.5, 0.5];
        const r = mulberry32(n * 7919 + 13);
        return [r(), r()];
      }
      const LID = 0.085;
      function drawScene(o, x0, y0, w, rows) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, o.dst.fb);
        gl.viewport(0, 0, o.w, o.h);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(x0, y0, w, rows);
        gl.useProgram(progS.p);
        const u = progS.u;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.src.tex);
        gl.uniform1i(u.uPrev, 0);
        gl.uniform1f(u.uN, o.n);
        gl.uniform2f(u.uRes, o.w, o.h);
        const j = jitter(o.n);
        gl.uniform2f(u.uJit, j[0] - 0.5, j[1] - 0.5);
        gl.uniform3fv(u.uCam, cam.pos); gl.uniform3fv(u.uFw, cam.fw); gl.uniform3fv(u.uRt, cam.rt); gl.uniform3fv(u.uUp, cam.up);
        gl.uniform1f(u.uTanH, cam.tanH); gl.uniform1f(u.uPix, 2 * cam.tanH / o.h);
        gl.uniform3f(u.uO, 1.3, 5.2, -1.65);
        gl.uniform1f(u.uYaw, S.yaw); gl.uniform1f(u.uTilt, S.tilt); gl.uniform1f(u.uMelt, S.melt);
        gl.uniform1f(u.uLid, o.lid); gl.uniform1f(u.uBoil, o.boil);
        gl.uniform3fv(u.uFP, S.fp); gl.uniform4fv(u.uHP1, S.hp1); gl.uniform4fv(u.uHP2, S.hp2);
        gl.uniform3fv(u.uCCard, S.card); gl.uniform3fv(u.uCTrou, S.trou); gl.uniform3fv(u.uCTie, S.tie);
        gl.uniform3fv(u.uCWallA, S.wall[0]); gl.uniform3fv(u.uCWallB, S.wall[1]); gl.uniform3fv(u.uCWallC, S.wall[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.SCISSOR_TEST);
      }
      function drawDof(o, x0, y0, w, rows) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, o.dst.fb);
        gl.viewport(0, 0, o.w, o.h);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(x0, y0, w, rows);
        gl.useProgram(progD.p);
        const u = progD.u;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.acc.tex); gl.uniform1i(u.uAcc, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, o.prev.tex); gl.uniform1i(u.uPrevD, 1);
        gl.uniform2f(u.uRes, o.w, o.h);
        gl.uniform1f(u.uFocus, cam.zf); gl.uniform3fv(u.uCam, cam.pos); gl.uniform3fv(u.uFw, cam.fw); gl.uniform3fv(u.uRt, cam.rt); gl.uniform3fv(u.uUp, cam.up); gl.uniform1f(u.uTanH, cam.tanH); gl.uniform1f(u.uCocK, cam.cocK * o.h); gl.uniform1f(u.uMaxC, Math.max(2, cam.maxC * o.h));
        gl.uniform1f(u.uN, o.n); gl.uniform1f(u.uRot, o.n * 2.3999);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.SCISSOR_TEST);
        gl.activeTexture(gl.TEXTURE0);
      }
      function blit(from, to, w, h) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.fb);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to.fb);
        gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      }
      function present(tex) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, CW, CH);
        gl.useProgram(progP.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(progP.u.uImg, 0);
        gl.uniform2f(progP.u.uRes, CW, CH);
        gl.uniform1f(progP.u.uGrain, 3.5);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      const fullRect = (lv) => [0, 0, lv.w, lv.h];

      // one refinement pass of a level: scene (tiled), then lens (tiled), then show it
      function levelPass(li) {
        return () => {
          const lv = levels[li];
          const sc = { src: lv.acc[lv.passN % 2], dst: lv.acc[(lv.passN + 1) % 2], w: lv.w, h: lv.h, n: lv.passN, lid: LID, boil: 0 };
          const df = { acc: sc.dst, prev: lv.dof[lv.dofN % 2], dst: lv.dof[(lv.dofN + 1) % 2], w: lv.w, h: lv.h, n: lv.dofN };
          return [
            { kind: 'scene', rect: fullRect(lv), run: (x, y, w, r) => drawScene(sc, x, y, w, r) },
            { kind: 'dof', rect: fullRect(lv), run: (x, y, w, r) => drawDof(df, x, y, w, r),
              done: () => {
                lv.passN++; lv.dofN++;
                present(df.dst.tex);
                shownTex = df.dst.tex;
                if (!readyCalled) { readyCalled = true; api.ready(); }
                if (DBG) console.log('level', li, 'pass', lv.passN, 'shown at', Math.round(performance.now()), JSON.stringify(cost));
              } },
          ];
        };
      }

      // the blink: a few extra frames of the eyes only, re-handled like real stop-motion frames
      function eyeRect(lv) {
        const yaw = S.yaw, c = Math.cos(yaw), sn = Math.sin(yaw);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (let i = 0; i < 8; i++) {
          const qx = i & 1 ? 1.15 : -1.15, qy = i & 2 ? 6.75 : 5.45, qz = i & 4 ? 1.5 : 0.55;
          const px = 1.3 + c * qx + sn * qz, py = 5.2 + qy, pz = -1.65 - sn * qx + c * qz;
          const d = [px - cam.pos[0], py - cam.pos[1], pz - cam.pos[2]];
          const z = d[0] * cam.fw[0] + d[1] * cam.fw[1] + d[2] * cam.fw[2];
          const ux = (d[0] * cam.rt[0] + d[1] * cam.rt[1] + d[2] * cam.rt[2]) / z;
          const uy = (d[0] * cam.up[0] + d[1] * cam.up[1] + d[2] * cam.up[2]) / z;
          const fx = ux * lv.h / (2 * cam.tanH) + lv.w / 2, fy = uy * lv.h / (2 * cam.tanH) + lv.h / 2;
          x0 = Math.min(x0, fx); x1 = Math.max(x1, fx); y0 = Math.min(y0, fy); y1 = Math.max(y1, fy);
        }
        const m = 6;
        x0 = Math.max(0, Math.floor(x0 - m)); y0 = Math.max(0, Math.floor(y0 - m));
        x1 = Math.min(lv.w, Math.ceil(x1 + m)); y1 = Math.min(lv.h, Math.ceil(y1 + m));
        if (x1 - x0 < 4 || y1 - y0 < 4) return null;
        return [x0, y0, x1 - x0, y1 - y0];
      }
      function buildTakes() {
        const lv = levels[levels.length - 1];
        const rect = eyeRect(lv);
        if (!rect) return [];
        const A = { acc: lv.acc[lv.passN % 2], img: lv.dof[lv.dofN % 2] };
        takes = { scratch: [makeTarget(lv.w, lv.h), makeTarget(lv.w, lv.h)], frames: [], ready: false, A };
        const K = 4;
        const out = [];
        [[0.0, 1], [-0.2, 2]].forEach(([lid, boil]) => {
          const fr = { img: makeTarget(lv.w, lv.h) };
          takes.frames.push(fr);
          out.push({ kind: 'copy', rect: [0, 0, 1, 1], run: () => { blit(A.acc, takes.scratch[0], lv.w, lv.h); blit(A.acc, takes.scratch[1], lv.w, lv.h); blit(A.img, fr.img, lv.w, lv.h); } });
          for (let n = 0; n < K; n++) {
            const sc = { src: takes.scratch[n % 2], dst: takes.scratch[(n + 1) % 2], w: lv.w, h: lv.h, n, lid, boil };
            out.push({ kind: 'scene', rect, run: (x, y, w, r) => drawScene(sc, x, y, w, r) });
          }
          const df = { acc: takes.scratch[K % 2], prev: A.img, dst: fr.img, w: lv.w, h: lv.h, n: 0 };
          out.push({ kind: 'dof', rect, run: (x, y, w, r) => drawDof(df, x, y, w, r) });
        });
        out.push({ kind: 'copy', rect: [0, 0, 1, 1], run: () => {}, done: () => {
          takes.ready = true;
          if (DBG) console.log('takes ready', Math.round(performance.now()));
          const st = (location.search.match(/showtake=(\d)/) || [])[1];
          if (st) { present(takes.frames[+st].img.tex); return; }
          scheduleBlink();
        } });
        return out;
      }
      const brnd = mulberry32(api.seed ^ 0x51ed);
      function scheduleBlink() {
        clearTimeout(blinkT);
        blinkT = setTimeout(() => {
          if (!alive || !api.isCurrent() || !takes || !takes.ready) return;
          const [B1, B2] = takes.frames.map((f) => f.img.tex);
          const A = takes.A.img.tex;
          // slow, resigned blinks at twelve frames a second; now and then a second one
          let seq = [B1, B2, B2, B2, B1, A];
          if (brnd() < 0.25) seq = seq.concat([A, A, A, B1, B2, B2, B1, A]);
          let i = 0;
          const tick = () => {
            if (!alive || !api.isCurrent() || !takes) return;
            present(seq[i++]);
            if (i < seq.length) playing = setTimeout(tick, 1000 / 12); else scheduleBlink();
          };
          tick();
        }, 3500 + brnd() * 6500);
      }

      let queue = [], shownTex = null;
      function nextJob() {
        while (!job || job.stages.length === 0) {
          if (!queue.length) { job = null; return; }
          job = { stages: queue.shift()() };
        }
        const st = job.stages[0];
        st.y = st.y || 0;
      }

      function step() {
        raf = 0;
        if (!alive || !api.isCurrent()) return;
        while (inflight.length) {
          const st = gl.clientWaitSync(inflight[0].sync, 0, 0);
          if (st === gl.TIMEOUT_EXPIRED) break;
          const f = inflight.shift();
          gl.deleteSync(f.sync);
          const now = performance.now();
          const dt = now - Math.max(f.t0, lastSignal);
          lastSignal = now;
          if (f.kind !== 'copy') cost[f.kind] = cost[f.kind] * 0.5 + (dt / f.px) * 0.5;
        }
        nextJob();
        if (DBG && job && performance.now() - (step.lt || 0) > 3000) { step.lt = performance.now(); console.log('job', job.stages[0].kind, job.stages[0].y, Math.round(step.lt), JSON.stringify(cost), inflight.length); }
        while (job && inflight.length < 2) {
          const st = job.stages[0];
          const [rx, ry, rw, rh] = st.rect;
          const rows = st.kind === 'copy' ? rh : Math.max(1, Math.min(rh - st.y, Math.floor(40 / (cost[st.kind] * rw))));
          st.run(rx, ry + st.y, rw, rows);
          st.y += rows;
          inflight.push({ sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), t0: performance.now(), px: rows * rw, kind: st.kind });
          gl.flush();
          if (st.y >= rh) {
            job.stages.shift();
            if (st.done) st.done();
            const more = job.stages.length === 0 && queue.length && typeof queue[0] === 'function';
            if (job.stages.length === 0) { job = null; nextJob(); }
            if (job && job.stages.length) job.stages[0].y = job.stages[0].y || 0;
            void more;
          }
        }
        if (job || inflight.length || queue.length) raf = requestAnimationFrame(step);
      }

      const ro = new ResizeObserver(() => {
        clearTimeout(resizeT);
        resizeT = setTimeout(() => { if (resize() && !raf) raf = requestAnimationFrame(step); }, CW ? 250 : 0);
      });
      let resizeT = 0;
      ro.observe(el);

      return {
        destroy() {
          alive = false;
          cancelAnimationFrame(raf);
          clearTimeout(resizeT); clearTimeout(blinkT); clearTimeout(playing);
          ro.disconnect();
          const ext = gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        },
      };
    },
  });
})();
