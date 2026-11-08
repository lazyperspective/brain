// Reference "observation" for the still life: a ray-marched set-up rendered in WebGL2.
// Mode 0 -> colour (display-referred), mode 1 -> aux (object id, stroke angle, flag, direct light).
(function (G) {
  'use strict';
  const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform int uMode;
out vec4 outC;

const float ZF = 1.0;
const vec3 LDIR = normalize(vec3(-0.80, 0.62, 0.44));
const vec3 LCOL = vec3(1.0, 0.89, 0.72) * 2.0;
const vec3 RO = vec3(-0.12, 1.45, 6.4);
const vec3 TA = vec3(-0.10, 0.66, 0.0);
const float FOVT = 0.336;

const vec3 GC = vec3(-1.12, 0.0, -0.42);
const float GRO = 0.385, GRI = 0.355, GH = 1.16, GHB = 0.11, GHW = 0.66;

// pears
const vec3 PA = vec3(-0.08, -0.025, 0.12);
const vec3 PC = vec3(1.22, -0.025, -0.55);
const vec3 PBc = vec3(0.86, 0.37, 0.42);   // body centre of lying pear
const vec3 PBax = normalize(vec3(0.93, -0.22, 0.30));

// knife
const vec2 KT = vec2(-0.78, 0.02);
const vec2 KE = vec2(0.40, 1.62);
const float KS = 1.3;

// leaf
const vec3 LFc = vec3(0.78, 0.0, 0.86);
const float LFa = -0.35;

vec3 camF, camR, camU;

float hash3(vec3 p){ p = fract(p*0.3183099 + vec3(0.71,0.113,0.419)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise3(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i+vec3(0,0,0)),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm3(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*noise3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5;} return s/0.9375; }
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h)-r; }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }

// ---------------- pear (local, base at y=0, height ~1.15)
float pearL(vec3 q){
  q.x += 0.07*q.y*q.y;
  float body = length(q - vec3(0.0,0.41,0.0)) - 0.41;
  float mid  = length((q - vec3(0.02,0.76,0.0))*vec3(1.0,0.92,1.0)) - 0.245;
  float neck = length(q - vec3(0.03,0.99,0.0)) - 0.145;
  float d = smin(body, mid, 0.24);
  d = smin(d, neck, 0.15);
  // dimple at stem
  d += 0.05*exp(-dot(q-vec3(0.03,1.13,0.0),q-vec3(0.03,1.13,0.0))/0.004);
  d = max(d, 0.025 - q.y);
  return d;
}
float stemL(vec3 q){
  q.x += 0.07*q.y*q.y;
  float a = sdCapsule(q, vec3(0.03,1.07,0.0), vec3(0.05,1.21,0.01), 0.018);
  float b = sdCapsule(q, vec3(0.05,1.21,0.01), vec3(0.12,1.29,0.03), 0.014);
  return min(a,b);
}
vec3 toPearA(vec3 p){ return rotY(0.5)*(p-PA); }
vec3 toPearC(vec3 p){ return rotY(-0.9)*((p-PC)/0.93); }
mat3 pearBBasis(){
  vec3 ay = PBax; vec3 ax = normalize(cross(ay, vec3(0,1,0))); vec3 az = cross(ax, ay);
  return mat3(ax, ay, az);
}
vec3 toPearB(vec3 p){ mat3 B = pearBBasis(); vec3 d = (p - (PBc - PBax*0.41*0.95))/0.95; return vec3(dot(d,B[0]), dot(d,B[1]), dot(d,B[2])); }

// ---------------- cloth
float clothH(vec2 q){
  float x=q.x, z=q.y;
  float h = 0.013;
  float rz = z - 0.45*x;
  h += 0.055*smoothstep(0.30,0.0,abs(rz-0.95-0.12*sin(x*2.1+0.4)))*(0.6+0.4*sin(x*2.3+1.0));
  h += 0.035*smoothstep(0.22,0.0,abs(rz-0.35-0.10*sin(x*3.0)))*(0.5+0.5*sin(x*1.7+2.0));
  h += 0.020*smoothstep(0.12,0.0,abs(x+0.75-0.1*z))*smoothstep(-0.2,0.6,z);
  h += 0.010*sin(x*5.1+z*2.3)*sin(z*4.4-x*1.2);
  h += 0.018*smoothstep(0.18,0.0,abs(x+1.75+0.12*z));
  h += 0.022*smoothstep(0.10,0.0,abs(z-0.78+0.05*x))*smoothstep(-0.7,-1.6,x);
  return h;
}
float sdCloth(vec3 p){
  float ex = p.x - (-0.64 + 0.16*(p.z-0.4) + 0.012*sin(p.z*5.0));
  float ez = (-0.24 + 0.08*p.x) - p.z;
  float region = max(max(ex, ez), p.z - ZF - 0.004);
  float h = clothH(p.xz);
  float slab = max(p.y - h, -p.y - 0.002);
  float top = max(slab*0.8, region*0.9);
  // hanging part
  float xr = -0.62;
  float xn = clamp((p.x + 1.30)/0.68, -1.0, 1.0);
  float hang = 0.05 + 0.70*pow(max(1.0 - xn*xn, 0.0), 1.6)*(1.0 - 0.25*max(xn,0.0)) + 0.035*sin(p.x*9.0+1.0)*smoothstep(0.0,0.4,1.0-abs(xn));
  float down = smoothstep(0.02, -0.55, p.y);
  float xc = (p.x + 1.30)/(0.35 + 0.65*(1.0+p.y));
  float f = down*(0.050*sin(xc*6.1+1.1) + 0.028*sin(xc*13.0+0.4) + 0.02*sin(xc*3.0+2.0)) + 0.008*sin(p.x*17.0);
  float sheet = abs(p.z - (ZF + 0.016 + 0.045*down + f)) - 0.007;
  float hy = max(-(p.y + hang), p.y - 0.012);
  float hx = p.x - xr - 0.06*p.y;
  float hangD = max(max(sheet*0.6, hy*0.8), hx*0.9);
  return smin(top, hangD, 0.018);
}

// ---------------- knife (local: x along from tip, z across, y up)
vec3 toKnife(vec3 p){
  vec2 u = normalize(KE-KT); vec2 v = vec2(-u.y, u.x);
  vec2 d = p.xz - KT;
  return vec3(dot(d,u), p.y, dot(d,v))/KS;
}
float sdBlade(vec3 q){
  float x = q.x;
  float wSpine = 0.030;
  float wEdge = 0.050*sqrt(clamp(x/0.32,0.0,1.0)) - 0.012*smoothstep(0.6,0.95,x);
  float zc = 0.5*(wSpine - wEdge);
  float hw = 0.5*(wSpine + wEdge);
  float d2 = abs(q.z - zc) - hw;
  float dl = max(-x, x - 0.97);
  float yb = 0.008 + 0.034*smoothstep(0.0,1.0,x/0.97);
  float dt = abs(q.y - yb) - 0.005;
  return max(max(d2*0.9, dl), dt);
}
float sdBolster(vec3 q){ return sdCapsule(q, vec3(0.96,0.045,0.0), vec3(1.02,0.045,0.0), 0.034); }
float sdHandle(vec3 q){
  float sw = 1.0 + 0.10*sin(clamp((q.x-1.02)/0.56,0.0,1.0)*3.14159);
  vec3 c = q - vec3(1.30, 0.044, 0.0);
  return sdBox(c, vec3(0.28, 0.026*sw, 0.036*sw)) - 0.012;
}

// ---------------- leaf
vec3 toLeaf(vec3 p){ return rotY(LFa)*(p - LFc)/1.45; }
float leafH(vec2 q){ float a = q.x/0.52 + 0.5; return 0.006 + 0.12*pow(clamp(a,0.0,1.0),3.0) + 0.55*q.y*q.y + 0.02*sin(a*9.0)*q.y; }
float sdLeaf(vec3 p){
  vec3 q = toLeaf(p);
  float a = q.x/0.52 + 0.5;
  float hw = 0.135*pow(max(sin(3.14159*clamp(a,0.0,1.0)),0.0),0.75)*(1.0+0.15*(1.0-a));
  float out2 = max(abs(q.z) - hw, max(-a, a-1.0)*0.52);
  float sl = abs(q.y - leafH(q.xz)) - 0.0045;
  float lf = max(sl*0.6, out2*0.8);
  float pet = sdCapsule(q, vec3(-0.26,0.008,0.0), vec3(-0.36,0.03,0.02), 0.007);
  return min(lf, pet)*1.45;
}

vec2 map(vec3 p){
  vec2 r = vec2(p.z + 1.75, 3.0); // wall
  float tb = sdBox(p - vec3(0.0,-3.0,ZF-6.0), vec3(40.0,2.988,5.988)) - 0.012;
  if (tb < r.x) r = vec2(tb, 1.0);
  float d;
  vec3 q = toPearA(p); d = pearL(q); if (d < r.x) r = vec2(d, 6.0);
  d = stemL(q); if (d < r.x) r = vec2(d, 12.0);
  q = toPearC(p); d = pearL(q)*0.93; if (d < r.x) r = vec2(d, 8.0);
  d = stemL(q)*0.93; if (d < r.x) r = vec2(d, 12.0);
  q = toPearB(p); d = pearL(q)*0.95; if (d < r.x) r = vec2(d, 7.0);
  d = stemL(q)*0.95; if (d < r.x) r = vec2(d, 12.0);
  d = sdCloth(p); if (d < r.x) r = vec2(d, 4.0);
  vec3 k = toKnife(p);
  d = sdBlade(k)*KS; if (d < r.x) r = vec2(d, 9.0);
  d = sdBolster(k)*KS; if (d < r.x) r = vec2(d, 9.5);
  d = sdHandle(k)*KS; if (d < r.x) r = vec2(d, 10.0);
  d = sdLeaf(p); if (d < r.x) r = vec2(d, 11.0);
  return r;
}
vec3 calcN(vec3 p){
  const vec2 e = vec2(0.0007,-0.0007);
  return normalize(e.xyy*map(p+e.xyy).x + e.yyx*map(p+e.yyx).x + e.yxy*map(p+e.yxy).x + e.xxx*map(p+e.xxx).x);
}
vec2 march(vec3 ro, vec3 rd, float tmax){
  float t = 0.01;
  for (int i=0;i<220;i++){
    vec2 h = map(ro+rd*t);
    if (h.x < 0.0004*t) return vec2(t,h.y);
    t += h.x;
    if (t>tmax) break;
  }
  return vec2(-1.0, 0.0);
}
// glass cylinder intersection (outer), returns t or -1
float hitCyl(vec3 ro, vec3 rd, vec3 c, float r, float y0, float y1){
  vec2 o = ro.xz - c.xz; vec2 d = rd.xz;
  float a = dot(d,d), b = dot(o,d), cc = dot(o,o) - r*r;
  float disc = b*b - a*cc; if (disc < 0.0) return -1.0;
  float s = sqrt(disc);
  float t = (-b - s)/a;
  if (t > 0.001) { float y = ro.y + rd.y*t; if (y>y0 && y<y1) return t; }
  t = (-b + s)/a;
  if (t > 0.001) { float y = ro.y + rd.y*t; if (y>y0 && y<y1) return t; }
  return -1.0;
}
float softShadow(vec3 ro, vec3 rd){
  float res = 1.0, t = 0.012;
  for (int i=0;i<90;i++){
    float h = map(ro+rd*t).x;
    res = min(res, 9.0*h/t);
    t += clamp(h, 0.006, 0.12);
    if (res < 0.002 || t > 6.0) break;
  }
  res = clamp(res,0.0,1.0);
  // glass: partial occluder with a caustic streak
  float tg = hitCyl(ro, rd, GC, GRO, 0.0, GH);
  if (tg > 0.0) {
    vec3 hp = ro + rd*tg;
    vec2 o = ro.xz - GC.xz; vec2 dd = normalize(rd.xz);
    float off = abs(o.x*dd.y - o.y*dd.x)/GRO; // impact parameter
    float inW = step(hp.y, GHW);
    float caust = inW*(1.6*exp(-off*off/0.025) + 0.25);
    float edge = smoothstep(0.75,1.0,off);
    res *= mix(mix(0.42, 1.0, 0.0) + caust*0.7, 0.18, edge);
  }
  return clamp(res, 0.0, 2.2);
}
float calcAO(vec3 p, vec3 n){
  float occ = 0.0, sca = 1.0;
  for (int i=0;i<6;i++){
    float h = 0.012 + 0.07*float(i);
    float d = map(p + h*n).x;
    occ += (h-d)*sca; sca *= 0.82;
  }
  return clamp(1.0 - 2.4*occ, 0.0, 1.0);
}
vec3 envRoom(vec3 d){
  vec3 c = vec3(0.030,0.026,0.020)*(0.7+0.5*clamp(d.y,0.0,1.0));
  // window, to the left and a little in front, high
  float az = atan(d.x, d.z), el = asin(clamp(d.y,-1.0,1.0));
  float az0 = -1.15, el0 = 0.30;
  vec2 w = vec2((az-az0)/0.36, (el-el0)/0.62);
  float win = smoothstep(1.0,0.9,abs(w.x))*smoothstep(1.0,0.9,abs(w.y));
  float bars = smoothstep(0.035,0.06,abs(w.x)) * smoothstep(0.035,0.06,abs(w.y+0.15));
  c += vec3(2.6,2.45,2.2)*win*mix(0.25,1.0,bars)*(0.85+0.15*w.y);
  // warm table bounce below
  c += vec3(0.10,0.07,0.045)*smoothstep(0.0,-0.4,d.y);
  return c;
}

vec3 pearAlb(vec3 q, float sd, vec3 blushDir){
  vec3 green = vec3(0.40,0.44,0.10), yellow = vec3(0.74,0.55,0.12);
  vec3 blush = vec3(0.55,0.15,0.05), russet = vec3(0.34,0.20,0.07);
  vec3 pw = q*3.2 + sd;
  float n = fbm3(pw);
  vec3 c = mix(green, yellow, smoothstep(0.30,0.72, n + 0.12 + 0.25*q.y*0.0));
  vec3 cq = normalize(q - vec3(0.0,0.5,0.0));
  float bl = smoothstep(0.15, 0.95, dot(cq, blushDir)*0.5 + 0.5 + (fbm3(pw*2.3+4.0)-0.5)*0.7);
  c = mix(c, blush, bl*0.72);
  c = mix(c, russet, smoothstep(0.88,1.08,q.y)*0.75);
  c = mix(c, russet, smoothstep(0.12,0.02,q.y)*0.6);
  float sp = smoothstep(0.80,0.92, noise3(q*55.0+sd));
  c *= 1.0 - 0.35*sp;
  float st = smoothstep(0.62,0.82, fbm3(q*9.0+sd*2.0)) * 0.5;
  c = mix(c, russet*0.9, st*0.6);
  return c;
}

struct Hit { vec3 col; float id; vec3 p; vec3 n; float direct; };

vec3 shadeOpaque(vec3 p, vec3 rd, float id, vec3 n, out float direct, vec3 reflCol){
  vec3 alb; float specK = 0.0, specP = 30.0, wrap = 0.0, metal = 0.0;
  if (id < 1.5) { // table top / front
    bool front = p.z > ZF - 0.01 && n.z > 0.5;
    float g = fbm3(vec3(p.x*1.4, p.y*1.4, p.z*5.0));
    alb = vec3(0.24,0.175,0.115)*(0.82+0.36*g);
    alb *= 1.0 - 0.12*smoothstep(0.55,0.75,fbm3(p*7.0));
    if (front) alb = vec3(0.15,0.105,0.068)*(0.85+0.3*fbm3(p*vec3(3.0,6.0,3.0)))*(0.35+0.65*smoothstep(-1.3,-0.05,p.y));
    specK = 0.05; specP = 12.0;
  } else if (id < 3.5) { // wall
    float g = fbm3(p*vec3(1.1,1.1,1.0));
    alb = vec3(0.085,0.068,0.045)*(0.75+0.5*g);
  } else if (id < 4.5) { // linen
    float g = fbm3(p*8.0);
    alb = vec3(0.86,0.84,0.77)*(0.95+0.08*g);
    wrap = 0.35; specK = 0.04; specP = 8.0;
  } else if (id < 8.5) { // pears
    vec3 q; vec3 bd;
    if (id < 6.5) { q = toPearA(p); bd = normalize(vec3(-0.9,0.2,0.4)); }
    else if (id < 7.5) { q = toPearB(p); bd = normalize(vec3(0.2,0.9,-0.4)); }
    else { q = toPearC(p); bd = normalize(vec3(-0.6,0.1,0.8)); }
    alb = pearAlb(q, id*3.7, bd);
    specK = 0.30; specP = 34.0; wrap = 0.08;
  } else if (id < 9.8) { // blade / bolster
    alb = vec3(0.62,0.62,0.60); metal = 1.0; specK = 1.6; specP = 120.0;
    if (id > 9.2) { alb = vec3(0.70,0.58,0.36); specP = 60.0; }
  } else if (id < 10.5) { // handle: dark fruitwood
    vec3 k = toKnife(p);
    float gr = sin(k.x*22.0 + 7.0*fbm3(k*vec3(3.0,20.0,20.0)))*0.5+0.5;
    alb = mix(vec3(0.12,0.065,0.035), vec3(0.20,0.11,0.055), gr);
    specK = 0.35; specP = 40.0;
  } else if (id < 11.5) { // leaf
    vec3 q = toLeaf(p);
    float a = q.x/0.52 + 0.5;
    float vein = smoothstep(0.012,0.0,abs(q.z)) + 0.6*smoothstep(0.008,0.0,abs(fract(a*7.0 - abs(q.z)*5.0)-0.5)*0.12);
    vec3 c = mix(vec3(0.62,0.34,0.10), vec3(0.50,0.13,0.05), smoothstep(0.2,0.8, fbm3(q*9.0+2.0)));
    c = mix(c, vec3(0.30,0.20,0.06), smoothstep(0.75,0.95,abs(q.z)/0.14));
    alb = mix(c, vec3(0.70,0.52,0.25), clamp(vein,0.0,1.0)*0.6);
    specK = 0.12; specP = 20.0; wrap = 0.25;
  } else { // stems
    alb = vec3(0.16,0.10,0.05); specK = 0.1;
  }
  float sh = softShadow(p + n*0.004, LDIR);
  float ndl = dot(n, LDIR);
  float dif = clamp((ndl + wrap)/(1.0+wrap), 0.0, 1.0);
  direct = dif*sh;
  float ao = calcAO(p, n);
  vec3 fillDir = normalize(vec3(-0.5,0.55,0.75));
  vec3 amb = vec3(0.10,0.09,0.085)*(0.45+0.55*clamp(dot(n,fillDir)*0.5+0.5,0.0,1.0));
  // bounce from linen and table
  float clothNear = smoothstep(-0.2,-1.0,p.x) * smoothstep(-0.6,0.3,p.z);
  vec3 bounce = mix(vec3(0.07,0.05,0.032), vec3(0.16,0.15,0.13), clothNear)*clamp(-n.y*0.6+0.4,0.0,1.0);
  vec3 col;
  if (metal > 0.5) {
    vec3 r = reflect(rd, n);
    vec3 rc = reflCol;
    float fr = 0.65 + 0.35*pow(1.0 - clamp(dot(-rd,n),0.0,1.0), 5.0);
    col = rc*alb*fr*1.15 + alb*0.05*(LCOL*dif*sh*0.3 + amb);
  } else {
    col = alb*(LCOL*dif*sh + amb*ao + bounce*ao);
  }
  vec3 hv = normalize(LDIR - rd);
  col += LCOL*specK*pow(clamp(dot(n,hv),0.0,1.0), specP)*sh*(metal>0.5?0.6:1.0);
  if (id >= 4.5 && id < 8.5) { // waxy sheen reflecting window
    vec3 r = reflect(rd,n);
    float fr = 0.04 + 0.5*pow(1.0-clamp(dot(-rd,n),0.0,1.0),5.0);
    col += envRoom(r)*fr*0.35*ao;
  }
  // wall: window light falloff, darker at top and far left
  if (id > 2.5 && id < 3.5) {
    vec2 s = p.xy;
    float g = exp(-pow((s.x-0.9)/2.6,2.0) - pow((s.y-0.7)/1.7,2.0));
    col *= 0.35 + 1.05*g;
  }
  return col;
}

vec3 glassPath(vec3 ro, vec3 rd, out float hitOpaque){
  // walk through layered media of glass/water analytically
  vec3 acc = vec3(0.0);
  vec3 thr = vec3(1.0);
  vec3 pos = ro, dir = rd;
  hitOpaque = 0.0;
  for (int it=0; it<10; it++){
    // candidate surfaces
    float tBest = 1e9; vec3 nBest = vec3(0.0);
    vec2 o = pos.xz - GC.xz; vec2 d = dir.xz;
    float a = dot(d,d), b = dot(o,d);
    for (int k=0;k<2;k++){
      float r = k==0 ? GRO : GRI;
      float ylo = k==0 ? 0.0 : GHB;
      float cc = dot(o,o) - r*r;
      float disc = b*b - a*cc;
      if (disc > 0.0 && a > 1e-8) {
        float s = sqrt(disc);
        for (int j=0;j<2;j++){
          float t = (-b + (j==0?-s:s))/a;
          if (t > 0.0005 && t < tBest) {
            vec3 hp = pos + dir*t;
            if (hp.y > ylo && hp.y < GH) { tBest = t; nBest = vec3(hp.x-GC.x, 0.0, hp.z-GC.z)/r; }
          }
        }
      }
    }
    // planes: base top, water surface, rim
    float planes[3]; planes[0]=GHB; planes[1]=GHW; planes[2]=GH;
    for (int k=0;k<3;k++){
      if (abs(dir.y) > 1e-5) {
        float t = (planes[k]-pos.y)/dir.y;
        if (t > 0.0005 && t < tBest) {
          vec3 hp = pos + dir*t; float rr = length(hp.xz - GC.xz);
          bool ok = (k<2) ? rr < GRI : (rr > GRI && rr < GRO);
          if (ok) { tBest = t; nBest = vec3(0.0,1.0,0.0); }
        }
      }
    }
    if (tBest > 1e8) break;
    vec3 hp = pos + dir*tBest;
    // media before/after
    vec3 pb = hp - dir*0.0004, pa = hp + dir*0.0004;
    float mb, ma;
    for (int k=0;k<2;k++){
      vec3 q = k==0 ? pb : pa;
      float rr = length(q.xz - GC.xz); float m;
      if (q.y < 0.0 || q.y > GH || rr > GRO) m = 1.0;
      else if (rr > GRI || q.y < GHB) m = 1.5;
      else if (q.y < GHW) m = 1.333;
      else m = 1.0;
      if (k==0) mb = m; else ma = m;
    }
    // absorption inside glass
    if (mb > 1.4) thr *= exp(-tBest*vec3(1.4,0.55,1.1));
    else if (mb > 1.3) thr *= exp(-tBest*vec3(0.20,0.06,0.05));
    vec3 n = nBest; if (dot(n,dir) > 0.0) n = -n;
    float eta = mb/ma;
    float cosi = clamp(-dot(n,dir),0.0,1.0);
    float f0 = pow((mb-ma)/(mb+ma),2.0);
    float F = f0 + (1.0-f0)*pow(1.0-cosi,5.0);
    vec3 rdir = reflect(dir, n);
    vec3 tdir = refract(dir, n, eta);
    if (dot(tdir,tdir) < 0.5) { // TIR
      pos = hp + rdir*0.0006; dir = rdir; continue;
    }
    acc += thr*F*envRoom(rdir)*(it==0?1.0:0.6);
    thr *= (1.0-F);
    pos = hp + tdir*0.0006; dir = tdir;
    // exited the glass entirely?
    float rr = length(pa.xz - GC.xz);
    if (ma < 1.01 && (rr > GRO || pa.y > GH)) {
      // left the glass volume: check whether ray re-enters
      float tg = hitCyl(pos, dir, GC, GRO, 0.0, GH);
      float tr = -1.0;
      if (abs(dir.y) > 1e-5) { float t=(GH-pos.y)/dir.y; vec3 q=pos+dir*t; if (t>0.0005 && length(q.xz-GC.xz)<GRO) tr=t; }
      if (tg < 0.0 && tr < 0.0) break;
    }
  }
  // continue into the opaque scene
  vec2 h = march(pos, dir, 20.0);
  vec3 c;
  if (h.x < 0.0) c = envRoom(dir);
  else { vec3 p = pos + dir*h.x; vec3 n = calcN(p); float dd; c = shadeOpaque(p, dir, h.y, n, dd, envRoom(reflect(dir,n))); hitOpaque = h.y; }
  return acc + thr*c;
}

vec2 projectS(vec3 p){
  vec3 v = p - RO; float z = dot(v, camF);
  return vec2(dot(v,camR), dot(v,camU))/(z*FOVT);
}
float screenAngle(vec3 p, vec3 t){
  vec2 a = projectS(p), b = projectS(p + t*0.01);
  vec2 d = b - a;
  float ang = atan(-d.y, d.x);
  if (ang < 0.0) ang += 3.14159265;
  if (ang >= 3.14159265) ang -= 3.14159265;
  return ang/3.14159265;
}

void main(){
  camF = normalize(TA-RO); camR = normalize(cross(camF, vec3(0,1,0))); camU = cross(camR, camF);
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/(0.5*uRes.y);
  vec3 rd = normalize(camF + FOVT*(uv.x*camR + uv.y*camU));
  vec3 ro = RO;
  vec2 h = march(ro, rd, 30.0);
  float tGlass = hitCyl(ro, rd, GC, GRO, 0.0, GH);
  // rim top
  if (rd.y < 0.0) { float t=(GH-ro.y)/rd.y; vec3 q=ro+rd*t; float rr=length(q.xz-GC.xz); if (rr<GRO && (tGlass<0.0||t<tGlass)) tGlass=t; }
  vec3 col; float id; vec3 p, n; float direct = 0.0;
  if (tGlass > 0.0 && (h.x < 0.0 || tGlass < h.x)) {
    float ho;
    col = glassPath(ro, rd, ho);
    id = 5.0; p = ro + rd*tGlass; n = vec3(0.0);
    // specular glints of the window on the glass
    vec3 gp = p; vec3 gn = normalize(vec3(gp.x-GC.x, 0.0, gp.z-GC.z));
    direct = 0.6;
  } else if (h.x > 0.0) {
    p = ro + rd*h.x; n = calcN(p); id = h.y;
    vec3 rc = envRoom(reflect(rd,n));
    if (id > 8.5 && id < 9.8) {
      vec3 r = reflect(rd, n);
      vec2 h2 = march(p + n*0.01, r, 20.0);
      if (h2.x > 0.0) { vec3 p2 = p + n*0.01 + r*h2.x; vec3 n2 = calcN(p2); float d2; rc = shadeOpaque(p2, r, h2.y, n2, d2, envRoom(reflect(r,n2))); }
    }
    col = shadeOpaque(p, rd, id, n, direct, rc);
  } else { col = envRoom(rd); id = 3.0; p = ro + rd*30.0; }

  if (uMode == 0) {
    col = 1.0 - exp(-col*1.05);
    col = pow(col, vec3(1.0/2.2));
    float l = dot(col, vec3(0.3,0.59,0.11));
    col = mix(vec3(l), col, 1.0);
    outC = vec4(col, 1.0);
  } else {
    float ang = 0.0, flag = 0.0;
    if (id < 1.5) { ang = screenAngle(p, vec3(1.0,0.0,0.0)); if (p.z > ZF-0.01) ang = screenAngle(p, vec3(1.0,0.0,0.0)); }
    else if (id < 3.5) { flag = 1.0; }
    else if (id < 4.5) { flag = 1.0; }
    else if (id < 5.5) { ang = screenAngle(p, vec3(0.0,1.0,0.0)); }
    else if (id < 8.5) {
      vec3 ax = id < 6.5 ? vec3(0.0,1.0,0.0) : (id < 7.5 ? PBax : vec3(0.0,1.0,0.0));
      vec3 t = cross(ax, n); if (length(t) < 1e-3) t = vec3(1.0,0.0,0.0);
      ang = screenAngle(p, normalize(t));
    } else if (id < 10.5) { vec2 u = normalize(KE-KT); ang = screenAngle(p, vec3(u.x,0.0,u.y)); }
    else if (id < 11.5) { ang = screenAngle(p, rotY(-LFa)*vec3(0.0,0.0,1.0)); }
    else { ang = screenAngle(p, vec3(0.0,1.0,0.0)); }
    outC = vec4(id/16.0, ang, flag, direct);
  }
}`;

  const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.0,1.0); }`;

  function renderReference(W, H, opts) {
    opts = opts || {};
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('webgl2 unavailable');
    gl.getExtension('EXT_color_buffer_float');
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, opts.fs || FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, W, H);
    gl.uniform2f(gl.getUniformLocation(pr, 'uRes'), W, H);
    const uMode = gl.getUniformLocation(pr, 'uMode');
    const out = [];
    const tile = opts.tile || 256;
    for (let mode = 0; mode < 2; mode++) {
      gl.uniform1i(uMode, mode);
      gl.enable(gl.SCISSOR_TEST);
      for (let ty = 0; ty < H; ty += tile) for (let tx = 0; tx < W; tx += tile) {
        gl.scissor(tx, ty, tile, tile);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.finish();
      }
      gl.disable(gl.SCISSOR_TEST);
      const px = new Float32Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, px);
      // flip to top-down rows
      const fl = new Float32Array(W * H * 4);
      for (let y = 0; y < H; y++) fl.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      out.push(fl);
    }
    return { col: out[0], aux: out[1] };
  }

  G.Scene07 = { renderReference };
})(window);
