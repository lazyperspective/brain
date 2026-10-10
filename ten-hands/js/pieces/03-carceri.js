/* Carcere XVII: The Well of Stairs
 * A mezzotint in the manner of the Carceri d'invenzione. The architecture is ray-marched as signed
 * distance fields into a tonal image (tiled over several frames), then "printed": a rocked copper
 * ground of serrated pits is scraped and burnished back toward that tone, inked, wiped and pulled
 * onto laid paper with a plate mark. */
(function () {
  'use strict';

  const DBG = (typeof window !== 'undefined' && window.__CARCERI_DEBUG) || null;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const NP = 8; // rocker passes

  /* ------------------------------------------------------------------ shaders */
  const VS = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const SCENE_FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 frag;
uniform vec2 uRes;
uniform vec3 uCam;
uniform float uYaw;
uniform float uTanW;
uniform float uHor;
uniform vec3 uSun;
uniform vec4 uVar;
uniform vec4 uFig[5];
uniform vec4 uPose[5];

#define PI 3.14159265

const float WINX = -8.0;   // grated window on the far wall
const float WY0 = 50.0;   // sill
const float WY1 = 58.5;   // springing of its round head
const float WH = 4.4;     // half width
const float WPZ = 93.2;   // plane of the grating
const float BA = -0.9;   // plan angle of the bridge
const vec3 DRUM = vec3(11.770, 31.0, 35.208);

float dot2(vec3 v){ return dot(v,v); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float sdBox2(vec2 p, vec2 b){ vec2 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,q.y),0.0); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h)-r; }
vec3 toLocal(vec3 p, vec3 o, float a){ vec3 d=p-o; float c=cos(a), s=sin(a); return vec3(c*d.x+s*d.z, d.y, -s*d.x+c*d.z); }
float archOpen(vec2 q, float hw, float spring, float bottom){
  float r = sdBox2(q-vec2(0.0,(spring+bottom)*0.5), vec2(hw,(spring-bottom)*0.5));
  float c = length(q-vec2(0.0,spring))-hw;
  return min(r,c);
}
float sdLink(vec3 p, float le, float r1, float r2){
  vec3 q = vec3(p.x, max(abs(p.y)-le,0.0), p.z);
  return length(vec2(length(q.xy)-r1,q.z))-r2;
}
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba,ba); float rr = r1 - r2; float a2 = l2 - rr*rr; float il2 = 1.0/l2;
  vec3 pa = p - a; float y = dot(pa,ba); float z = y - l2;
  vec3 xv = pa*l2 - ba*y; float x2 = dot(xv,xv); float y2 = y*y*l2; float z2 = z*z*l2;
  float k = sign(rr)*rr*rr*x2;
  if (sign(z)*a2*z2 > k) return sqrt(x2 + z2)*il2 - r2;
  if (sign(y)*a2*y2 < k) return sqrt(x2 + y2)*il2 - r1;
  return (sqrt(x2*a2*il2)+y*rr)*il2 - r1;
}
float sdCappedCone(vec3 p, float h, float r1, float r2){
  vec2 q = vec2(length(p.xz), p.y);
  vec2 k1 = vec2(r2,h); vec2 k2 = vec2(r2-r1,2.0*h);
  vec2 ca = vec2(q.x-min(q.x,(q.y<0.0)?r1:r2), abs(q.y)-h);
  vec2 cb = q - k1 + k2*clamp(dot(k1-q,k2)/dot(k2,k2), 0.0, 1.0);
  float s = (cb.x<0.0 && ca.y<0.0) ? -1.0 : 1.0;
  return s*sqrt(min(dot(ca,ca),dot(cb,cb)));
}
// quadratic bezier distance (after Inigo Quilez); returns (distance, t)
vec2 sdBezier(vec3 pos, vec3 A, vec3 B, vec3 C){
  vec3 a = B - A; vec3 b = A - 2.0*B + C; vec3 c = a*2.0; vec3 d = A - pos;
  float kk = 1.0/dot(b,b);
  float kx = kk*dot(a,b);
  float ky = kk*(2.0*dot(a,a)+dot(d,b))/3.0;
  float kz = kk*dot(d,a);
  vec2 res;
  float p = ky - kx*kx; float p3 = p*p*p;
  float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
  float h = q*q + 4.0*p3;
  if (h >= 0.0){
    h = sqrt(h);
    vec2 x = (vec2(h,-h) - q)/2.0;
    vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
    float t = clamp(uv.x+uv.y-kx, 0.0, 1.0);
    res = vec2(dot2(d+(c+b*t)*t), t);
  } else {
    float z = sqrt(-p);
    float v = acos(q/(p*z*2.0))/3.0;
    float m = cos(v); float n = sin(v)*1.732050808;
    vec3 t = clamp(vec3(m+m,-n-m,n-m)*z-kx, 0.0, 1.0);
    float dis = dot2(d+(c+b*t.x)*t.x); res = vec2(dis, t.x);
    dis = dot2(d+(c+b*t.y)*t.y); if (dis < res.x) res = vec2(dis, t.y);
  }
  res.x = sqrt(res.x);
  return res;
}

vec2 opU(vec2 a, vec2 b){ return a.x < b.x ? a : b; }

// a straight flight of stairs climbing along local +x; q local (x run, y up, z across, centred)
float flight(vec3 q, float L, float W, float rise, float run, float thick){
  float slope = rise/run;
  float k = floor(q.x/run);
  float d = 1e5;
  for (int i=-1;i<=1;i++){
    float kk = k + float(i);
    float top = (kk+1.0)*rise;
    d = min(d, sdBox2(vec2(q.x-(kk+0.95)*run, q.y-(top-40.0)), vec2(0.95*run, 40.0)));
  }
  float under = -(q.y - q.x*slope + thick)*inversesqrt(1.0+slope*slope);
  d = max(d, under);
  d = max(d, abs(q.z)-W*0.5);
  d = max(d, max(-q.x, q.x-L));
  return d;
}
// sloping parapet wall alongside a flight
float rampWall(vec3 q, float L, float slope, float h0, float h1, float zc, float th){
  float yy = q.y - slope*q.x;
  float d = max(h0-yy, yy-h1)*inversesqrt(1.0+slope*slope);
  d = max(d, max(-q.x, q.x-L));
  d = max(d, abs(q.z-zc)-th);
  return d;
}

// a small cloaked human figure; f.xyz feet, f.w facing; pose.x stride, pose.y arm, pose.z lean
float figure(vec3 p, vec4 f, vec4 pose){
  vec3 q = p - f.xyz;
  float bd = length(q - vec3(0.0,0.9,0.0)) - 1.3;
  if (bd > 0.4) return bd;
  q.xz = rot(f.w)*q.xz;               // local: +z forward
  q.yz = rot(-pose.z)*q.yz;           // lean
  float st = pose.x;
  float d = sdRoundCone(q, vec3(0.0,0.42,-0.04), vec3(0.0,1.40,0.0), 0.30, 0.15);   // cloak
  d = min(d, length(q-vec3(0.0,1.60,0.03))-0.115);                                 // head
  d = min(d, sdCap(q, vec3(0.09,0.5,0.0), vec3(0.11,0.04, 0.22*st), 0.075));        // legs
  d = min(d, sdCap(q, vec3(-0.09,0.5,0.0), vec3(-0.11,0.04,-0.22*st), 0.075));
  vec3 hand = mix(vec3(0.30,0.85,0.12), vec3(0.34,1.95,0.45), pose.y);
  d = min(d, sdCap(q, vec3(0.17,1.36,0.0), hand, 0.055));                           // arm
  d = min(d, sdCappedCone(q-vec3(0.0,1.72,0.02), 0.05, 0.12, 0.09));               // cap
  return d;
}

float gMat;

float aabb(vec3 p, vec3 a, vec3 b){ return sdBox(p - 0.5*(a + b), 0.5*abs(b - a)); }
float rope(vec3 p, vec3 A, vec3 B, vec3 C, float r, float best){
  float bb = aabb(p, min(min(A, B), C) - r, max(max(A, B), C) + r);
  if (bb > best) return bb;
  return sdBezier(p, A, B, C).x - r;
}

vec2 map(vec3 p){
  vec2 res = vec2(p.y, 0.0);                          // floor of the well
  res = opU(res, vec2(100.0 - p.y, 0.0));             // vault
  res = opU(res, vec2(160.0 - p.x, 0.0));             // far end walls
  res = opU(res, vec2(222.0 - p.z, 0.0));
  res = opU(res, vec2(p.x + 48.0, 0.0));              // back of the left galleries
  // ---------------- left wall of the well: three tiers of arches
  {
    float slab = max(abs(p.x + 29.0) - 3.0, abs(p.z - 56.0) - 42.0);
    if (slab < res.x + 2.0) {
      float k = floor((p.z - 28.0)/16.0 + 0.5);
      float lz = p.z - 28.0 - k*16.0;
      float o1 = archOpen(vec2(lz, p.y), 5.2, 15.0, -1.0);
      float o2 = archOpen(vec2(lz, p.y), 4.0, 37.0, 27.0);
      float o = min(min(o1, o2), archOpen(vec2(lz, p.y), 2.0, 60.0, 54.0));
      float d = max(slab, -o);
      float sc = max(abs(p.x + 29.0) - 3.45, min(abs(p.y - 15.0), abs(p.y - 37.0)) - 0.45);
      sc = max(sc, abs(p.z - 56.0) - 42.0);
      sc = max(sc, -(o1 + 0.5));
      sc = max(sc, -(o2 + 0.5));
      d = min(d, sc);
      float cor = max(abs(p.x + 29.0) - 3.6, abs(p.y - 24.5) - 0.9);
      d = min(d, max(cor, abs(p.z - 56.0) - 42.0));
      res = opU(res, vec2(d, 0.0));
    }
  }
  // ---------------- far wall: arcade below, blind arches above, the grated window
  {
    float slab = max(abs(p.z - 95.0) - 3.0, abs(p.x + 0.5) - 31.5);
    if (slab < res.x + 2.0) {
      float k = clamp(floor((p.x + 16.0)/16.0 + 0.5), 0.0, 3.0);
      float lx = p.x + 16.0 - k*16.0;
      float o = archOpen(vec2(lx, p.y), 5.4, 15.0, -1.0);
      float win = archOpen(vec2(p.x - WINX, p.y), WH, WY1, WY0);
      float d = max(slab, -min(o, win));
      float k2 = clamp(floor((p.x - 8.0)/16.0 + 0.5), -2.0, 1.0);
      float lx2 = p.x - 8.0 - k2*16.0;
      float blind = max(archOpen(vec2(lx2, p.y), 4.6, 34.0, 23.0), p.z - 92.7);
      d = max(d, -blind);
      float sc = max(abs(p.z - 95.0) - 3.45, min(abs(p.y - 15.0), abs(p.y - 41.0)) - 0.45);
      sc = max(sc, abs(p.x + 0.5) - 31.5);
      sc = max(sc, -(o + 0.5));
      sc = max(sc, -(win + 0.3));
      d = min(d, sc);
      // moulded frame around the window
      float fr = max(max(abs(win - 0.55) - 0.55, abs(p.z - 92.3) - 0.5), WY0 - 0.9 - p.y);
      d = min(d, fr);
      float gz = sdBox2(vec2(p.z - WPZ, mod(p.x - WINX + 0.6, 1.2) - 0.6), vec2(0.17, 0.17));
      float gy = sdBox2(vec2(p.z - WPZ, mod(p.y - WY0 + 1.25, 2.5) - 1.25), vec2(0.17, 0.17));
      d = min(d, max(min(gz, gy), win - 0.3));
      res = opU(res, vec2(d, 0.0));
      res = opU(res, vec2(max(abs(p.z - 97.4) - 0.3, win - 0.6), 5.0));    // sky beyond the bars
    }
  }
  // ---------------- the hypostyle of colossal piers beyond the well
  if (p.x > 26.0 || p.z > 85.0) {
    vec2 g = p.xz - vec2(34.0, 20.0);
    vec2 c = floor(g/18.0 + 0.5);
    vec2 l = g - c*18.0;
    vec2 u = mod(g, 18.0) - 9.0;
    float pier = sdBox2(l, vec2(2.8));
    float bandY = min(abs(p.y - 20.0) - 6.0, abs(p.y - 46.0) - 6.0);
    float ox = min(archOpen(vec2(u.x, p.y), 6.2, 14.0, -1.0), archOpen(vec2(u.x, p.y), 6.2, 40.0, 27.0));
    float oz = min(archOpen(vec2(u.y, p.y), 6.2, 14.0, -1.0), archOpen(vec2(u.y, p.y), 6.2, 40.0, 27.0));
    float wx = max(max(abs(l.y) - 2.8, bandY), -ox);
    float wz = max(max(abs(l.x) - 2.8, bandY), -oz);
    float d = min(pier, min(wx, wz));
    d = min(d, max(sdBox2(l, vec2(3.25)), min(abs(p.y - 14.0), abs(p.y - 40.0)) - 0.5));
    d = min(d, max(sdBox2(l, vec2(3.4)), p.y - 1.6));
    float well = sdBox2(p.xz - vec2(-14.0, 20.0), vec2(45.2, 69.2));
    d = max(d, -well);
    res = opU(res, vec2(d, 0.0));
  } else {
    res.x = min(res.x, min(26.0 - p.x, 85.0 - p.z) + 0.5);
  }
  // ---------------- foreground pier (left), rusticated, with ring and timber beam
  {
    vec3 q = p - vec3(-19.5, 0.0, 17.0);
    float d = sdBox(q - vec3(0.0, 50.0, 0.0), vec3(3.5, 50.0, 4.0));
    if (d < res.x + 3.0) {
      // channelled joints between the blocks
      float jy = abs(mod(q.y + 0.8, 1.6) - 0.8);
      float groove = max(jy - 0.07, -(d + 0.09));
      d = max(d, -groove);
      d = min(d, sdBox(q - vec3(0.0, 1.0, 0.0), vec3(4.1, 1.0, 4.6)));
      d = min(d, sdBox(q - vec3(0.0, 33.0, 0.0), vec3(4.05, 0.6, 4.55)));
      d = min(d, sdBox(q - vec3(0.0, 32.2, 0.0), vec3(3.8, 0.3, 4.3)));
      res = opU(res, vec2(d, 0.0));
    }
    vec3 r = p - vec3(-17.6, 9.6, 12.86);
    float ring = length(vec2(length(r.xy) - 0.55, r.z + 0.05)) - 0.085;
    ring = min(ring, sdBox(p - vec3(-17.6, 10.2, 12.95), vec3(0.12, 0.12, 0.18)));
    res = opU(res, vec2(ring, 2.0));
    float bm = sdBox(p - vec3(-14.2, 26.0, 17.0), vec3(1.9, 0.38, 0.38));
    bm = min(bm, sdCap(p, vec3(-16.0, 23.6, 17.0), vec3(-13.6, 25.7, 17.0), 0.24));
    vec3 pq = p - vec3(-12.8, 25.2, 17.0);
    bm = min(bm, max(length(pq.xy) - 0.62, abs(pq.z) - 0.16));
    bm = min(bm, sdBox(pq - vec3(0.0, 0.45, 0.0), vec3(0.16, 0.55, 0.3)));
    res = opU(res, vec2(bm, 1.0));
  }
  // ---------------- bridge flung across the well
  {
    vec3 q = toLocal(p, vec3(4.0, 0.0, 45.0), BA);
    float body = sdBox(q - vec3(0.0, 10.75, 0.0), vec3(60.0, 10.75, 1.7));
    if (body < res.x + 3.0) {
      float ax = q.x - 30.0*floor(q.x/30.0 + 0.5);
      body = max(body, -archOpen(vec2(ax, q.y), 12.6, 7.0, -1.0));
      float imp = max(sdBox(q - vec3(0.0, 7.0, 0.0), vec3(60.0, 0.35, 2.0)), -archOpen(vec2(ax, q.y), 12.2, 7.0, -1.0));
      float arv = max(max(abs(q.z) - 1.85, length(vec2(ax, q.y - 7.0)) - 13.4), -archOpen(vec2(ax, q.y), 12.6, 7.0, -1.0));
      arv = max(arv, 7.0 - q.y);
      float cor = sdBox(q - vec3(0.0, 21.75, 0.0), vec3(60.0, 0.28, 2.05));
      float px = q.x - 1.6*floor(q.x/1.6 + 0.5);
      float rail = sdBox(vec3(px, q.y - 22.5, abs(q.z) - 1.65), vec3(0.09, 0.5, 0.09));
      rail = min(rail, sdBox(vec3(q.x, q.y - 23.0, abs(q.z) - 1.65), vec3(60.0, 0.07, 0.11)));
      res = opU(res, vec2(min(min(min(body, imp), min(cor, arv)), rail), 0.0));
    }
  }
  // ---------------- stair climbing the far wall, right to left
  {
    vec3 q = p - vec3(28.0, 0.0, 90.3);
    q.x = -q.x;
    float bd = sdBox(q - vec3(24.0, 16.0, 0.0), vec3(26.0, 18.0, 2.5));
    if (bd < res.x + 1.0) {
      float d = flight(q, 48.0, 3.0, 0.3, 0.45, 1.6);
      d = min(d, rampWall(q, 48.0, 0.3/0.45, -0.6, 1.05, -1.62, 0.2));
      d = min(d, sdBox(q - vec3(50.0, 31.6, 0.0), vec3(2.2, 0.8, 1.6)));
      res = opU(res, vec2(d, 0.0));
    }
  }
  // ---------------- foreground stair seen side-on, rising out of the bottom of the plate
  {
    vec3 q = toLocal(p, vec3(-14.9, 0.0, 24.1), -0.42);
    float bd = sdBox(q - vec3(13.0, 9.0, 0.0), vec3(14.5, 10.0, 3.0));
    if (bd < res.x + 1.0) {
      float solid = flight(q, 21.15, 4.0, 0.3, 0.45, 60.0);
      solid = max(solid, -(length(vec2(q.x - 19.5, q.y + 5.5)) - 13.0));   // rampant arch under the upper flight
      solid = max(solid, q.x - 13.5);
      float d = min(solid, flight(q, 21.15, 4.0, 0.3, 0.45, 1.0));      // which flies on, and simply stops
      res = opU(res, vec2(d, 0.0));
    }
  }
  // ---------------- landing struck by the light, and the well-head upon it
  {
    float d = sdBox(p - vec3(12.0, 1.3, 63.0), vec3(6.0, 1.3, 6.0));
    d = min(d, sdBox(p - vec3(12.0, 0.65, 56.4), vec3(4.0, 0.65, 0.6)));
    vec3 w = p - vec3(11.0, 2.6, 63.5);
    float rr = length(w.xz);
    float well = max(abs(rr - 1.9) - 0.32, abs(w.y - 0.5) - 0.5);
    well = min(well, max(abs(rr - 1.9) - 0.42, abs(w.y - 1.05) - 0.1));
    d = min(d, well);
    d = max(d, -max(rr - 1.58, -w.y - 6.0));                 // the shaft of the well itself
    res = opU(res, vec2(d, 0.0));
    // iron overthrow with its pulley
    float ov = length(vec2(length(vec2(w.x, w.y - 1.1)) - 1.9, w.z)) - 0.06;
    ov = max(ov, 1.1 - w.y);
    ov = min(ov, max(length(vec2(w.x, w.y - 2.75)) - 0.28, abs(w.z) - 0.05));
    ov = min(ov, sdCap(w, vec3(0.0, 2.75, 0.0), vec3(0.0, 1.2, 0.0), 0.025));
    res = opU(res, vec2(ov, 2.0));
  }
  // ---------------- the great wheel, mounted on the bridge
  {
    vec3 q = toLocal(p, vec3(4.0, 0.0, 45.0), BA) - vec3(12.5, 31.0, 0.0);
    float bd = length(q) - 10.0;
    if (bd < res.x + 1.0) {                // wheel plane = bridge plane (local x,y), axle along local z
      float R = 7.6;
      float r = length(q.xy);
      float an = atan(q.y, q.x);
      float d = sdBox2(vec2(r - R, abs(q.z) - 0.85), vec2(0.36, 0.2));
      float sec = 6.2831853/12.0;
      float la = an - sec*floor(an/sec + 0.5);
      vec2 sp = r*vec2(cos(la), sin(la));
      d = min(d, sdBox(vec3(sp.x - R*0.5, sp.y, abs(q.z) - 0.85), vec3(R*0.5, 0.17, 0.13)));
      float sec2 = 6.2831853/44.0;
      float la2 = an - sec2*floor(an/sec2 + 0.5);
      vec2 sp2 = r*vec2(cos(la2), sin(la2));
      d = min(d, sdBox(vec3(sp2.x - R - 0.12, sp2.y, q.z), vec3(0.1, 0.2, 1.0)));
      d = min(d, max(r - 1.5, abs(q.z) - 1.2));
      d = min(d, max(r - 0.5, abs(q.z) - 2.6));
      for (int s=0;s<2;s++){
        float zz = s==0 ? -2.1 : 2.1;
        d = min(d, sdCap(q, vec3(0.0,0.0,zz), vec3(-3.9,-8.3,zz*0.75), 0.28));
        d = min(d, sdCap(q, vec3(0.0,0.0,zz), vec3( 3.9,-8.3,zz*0.75), 0.28));
        d = min(d, sdCap(q, vec3(-2.3,-4.9,zz*0.88), vec3(2.3,-4.9,zz*0.88), 0.2));
      }
      res = opU(res, vec2(d, 1.0));
    }
  }
  // ---------------- ropes, chains, lantern
  {
    float rp = rope(p, vec3(-12.2, 25.2, 17.0), vec3(8.0, 14.0, 30.0), DRUM + vec3(-0.6, 1.3, 0.0), 0.08, res.x);
    rp = min(rp, rope(p, vec3(-16.0, 34.0, 19.0), vec3(8.0, 30.0, 24.0), vec3(40.0, 52.0, 30.0), 0.1, res.x));
    rp = min(rp, sdCap(p, DRUM + vec3(-1.4, -0.2, 0.0), vec3(DRUM.x - 1.7, 4.5, DRUM.z), 0.07));
    rp = min(rp, sdCap(p, DRUM + vec3(1.4, -0.2, 0.0), vec3(DRUM.x + 1.6, 9.0, DRUM.z), 0.07));
    res = opU(res, vec2(rp, 3.0));
    // a hanging cage at the end of the rope
    {
      vec3 g = p - vec3(DRUM.x - 1.7, 2.6, DRUM.z);
      float gb = length(g) - 2.6;
      if (gb < res.x + 0.3) {
        float an = atan(g.z, g.x);
        float sec = 6.2831853/10.0;
        float la = an - sec*floor(an/sec + 0.5);
        vec2 hp = length(g.xz)*vec2(cos(la), sin(la));
        float cage = sdBox(vec3(hp.x - 0.8, g.y, hp.y), vec3(0.04, 1.0, 0.04));
        cage = min(cage, length(vec2(length(g.xz) - 0.8, abs(g.y) - 1.0)) - 0.06);
        cage = min(cage, sdCappedCone(g - vec3(0.0, 1.35, 0.0), 0.35, 0.82, 0.12));
        cage = min(cage, sdCap(g, vec3(0.0, 1.7, 0.0), vec3(0.0, 1.95, 0.0), 0.1));
        res = opU(res, vec2(cage, 2.0));
      }
    }
    vec3 c = p - vec3(-8.2, 0.0, 34.3);
    float cb = sdBox(c - vec3(0.0, 60.0, 0.0), vec3(1.2, 40.0, 1.2));
    if (cb < res.x + 1.0) {
      float s = 0.22;
      float per = 4.44*s;
      float y1 = c.y - per*floor(c.y/per + 0.5);
      float ch = sdLink(vec3(c.x, y1, c.z), 0.7*s, 0.55*s, 0.14*s);
      float y2 = c.y + per*0.5; y2 -= per*floor(y2/per + 0.5);
      ch = min(ch, sdLink(vec3(c.z, y2, c.x), 0.7*s, 0.55*s, 0.14*s));
      ch = max(ch, 28.0 - c.y);
      res = opU(res, vec2(ch, 2.0));
    }
    vec3 l = (c - vec3(0.0, 24.4, 0.0))/1.15;
    float lb = (length(l) - 3.2)*1.15;
    if (lb < res.x + 0.5) {
      float an = atan(l.z, l.x);
      float sec = 6.2831853/6.0;
      float la = an - sec*floor(an/sec + 0.5);
      vec2 hp = length(l.xz)*vec2(cos(la), sin(la));
      float lt = sdBox(vec3(hp.x - 0.95, l.y, hp.y), vec3(0.06, 1.15, 0.06));
      float hex = hp.x - 0.95;
      lt = min(lt, max(abs(hex) - 0.06, abs(abs(l.y) - 1.15) - 0.09));
      lt = min(lt, max(abs(hex + 0.05) - 0.03, abs(l.y + 0.1) - 0.04));
      lt = min(lt, max(abs(hp.y) - 0.025, max(abs(hex) - 0.03, abs(l.y) - 1.1)));
      lt = min(lt, sdCappedCone(l - vec3(0.0, 1.75, 0.0), 0.55, 1.15, 0.25));
      lt = min(lt, sdCappedCone(l - vec3(0.0, 2.45, 0.0), 0.2, 0.25, 0.08));
      lt = min(lt, length(vec2(length(l.xy - vec2(0.0, 2.9)) - 0.22, l.z)) - 0.05);
      lt = min(lt, sdCappedCone(l - vec3(0.0, -1.5, 0.0), 0.3, 0.15, 0.95));
      lt = min(lt, length(l - vec3(0.0, -1.95, 0.0)) - 0.16);
      res = opU(res, vec2(lt*1.15, 2.0));
    }
  }
  // ---------------- figures
  for (int i=0;i<5;i++){
    if (uFig[i].y < -50.0) continue;
    res = opU(res, vec2(figure(p, uFig[i], uPose[i]), 4.0));
  }
  return res;
}

vec3 calcNormal(vec3 p, float t){
  float e = 0.0012*t + 0.002;
  vec2 k = vec2(1.0,-1.0);
  return normalize(k.xyy*map(p+k.xyy*e).x + k.yyx*map(p+k.yyx*e).x + k.yxy*map(p+k.yxy*e).x + k.xxx*map(p+k.xxx*e).x);
}

float aperture(vec3 p, out float tw){
  tw = (WPZ - p.z)/uSun.z;
  if (tw < 0.0) return 0.0;
  vec3 h = p + uSun*tw;
  float d = archOpen(vec2(h.x - WINX, h.y), WH, WY1, WY0);
  float pen = 0.05 + tw*0.0045;
  float a = smoothstep(pen, -pen, d);
  float bx = abs(mod(h.x - WINX + 0.6, 1.2) - 0.6);
  float by = abs(mod(h.y - WY0 + 1.25, 2.5) - 1.25);
  float bw = 0.16;
  float bars = smoothstep(bw - pen, bw + pen, bx)*smoothstep(bw - pen, bw + pen, by);
  return a*bars;
}

float softShadow(vec3 ro, vec3 rd, float tmax){
  float res = 1.0; float t = 0.08;
  for (int i=0;i<56;i++){
    float h = map(ro + rd*t).x;
    res = min(res, 14.0*h/t);
    t += clamp(h, 0.06, 3.0);
    if (res < 0.003 || t > tmax) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n){
  float occ = 0.0, sca = 1.0;
  for (int i=0;i<5;i++){
    float h = 0.08 + 1.6*float(i)/4.0;
    float d = map(p + h*n).x;
    occ += (h - d)*sca;
    sca *= 0.8;
  }
  return clamp(1.0 - 0.9*occ, 0.0, 1.0);
}

float hash13(vec3 p3){ p3 = fract(p3*0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y)*p3.z); }
float vnoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y), f.z);
}

vec2 slabT(float o, float d, float lo, float hi){
  if (abs(d) < 1e-6) return (o > lo && o < hi) ? vec2(-1e9, 1e9) : vec2(1e9, -1e9);
  float a = (lo - o)/d, b = (hi - o)/d;
  return vec2(min(a, b), max(a, b));
}

vec2 project(vec3 w){
  vec3 d = w - uCam;
  d.xz = rot(-uYaw)*d.xz;
  return d.xy/d.z;
}

void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  float sx = (uv.x - 0.5)*2.0*uTanW;
  float sy = (uv.y - uHor)*2.0*uTanW*uRes.y/uRes.x;
  vec3 rd = normalize(vec3(sx, sy, 1.0));
  rd.xz = rot(uYaw)*rd.xz;
  vec3 ro = uCam;
  float t = 0.3; float m = -1.0;
  for (int i=0;i<200;i++){
    vec2 h = map(ro + rd*t);
    if (h.x < 0.0008*t){ m = h.y; break; }
    t += h.x*0.92;
    if (t > 330.0) break;
  }
  float L = 0.0;
  float ang = 0.5*PI;
  vec3 p = ro + rd*t;
  if (m < 0.0){
    L = 0.02; t = 330.0;
  } else if (m > 4.5){
    L = 8.0;                       // open sky beyond the grating
  } else {
    vec3 n = calcNormal(p, t);
    float alb = m < 0.5 ? 0.62 : (m < 1.5 ? 0.42 : (m < 2.5 ? 0.2 : (m < 3.5 ? 0.35 : 0.3)));
    if (m < 0.5){
      vec3 an = abs(n);
      vec2 fq = an.x > 0.6 ? p.zy : (an.z > 0.6 ? p.xy : p.xz);
      float course = 1.15;
      float row = floor(fq.y/course);
      float jy = abs(fract(fq.y/course) - 0.5)*course;
      float jx = abs(fract(fq.x/2.3 + 0.5*mod(row, 2.0)) - 0.5)*2.3;
      float joint = smoothstep(0.02, 0.07, min(jy, jx));
      if (an.y > 0.6) joint = smoothstep(0.02, 0.07, min(abs(fract(p.x/2.1) - 0.5), abs(fract(p.z/2.1) - 0.5))*2.1);
      float fw = t*(2.0*uTanW/uRes.x)/max(abs(dot(n, rd)), 0.12);
      alb *= mix(1.0, mix(0.6, 1.0, joint), 1.0 - smoothstep(0.03, 0.2, fw));
      alb *= 0.7 + 0.55*vnoise(p*vec3(0.21, 0.09, 0.21));
    }
    float tw;
    float ap = aperture(p, tw);
    float ndl = dot(n, uSun);
    float sun = 0.0;
    if (ap > 0.002 && ndl > 0.0) sun = ap*ndl*softShadow(p + n*0.04, uSun, tw - 0.7);
    float ao = calcAO(p, n);
    // convexity: scraped light along arrises and nosings, dark in re-entrant angles
    float e2 = 0.12 + 0.002*t;
    vec2 kk = vec2(1.0, -1.0);
    float conv = (map(p + kk.xyy*e2).x + map(p + kk.yyx*e2).x + map(p + kk.yxy*e2).x + map(p + kk.xxx*e2).x - 4.0*map(p).x)/(4.0*e2);
    float edge = smoothstep(0.04, 0.35, conv)*(m < 0.5 ? 1.0 : 0.4);
    ao *= 1.0 - 0.5*smoothstep(0.03, 0.3, -conv);
    float amb = (0.45 + 0.55*n.y)*0.022 + 0.01;
    vec3 lb = vec3(12.0, 4.0, 63.0) - p; float db = length(lb);
    float bounce = 0.9*max(0.0, dot(n, lb/db) + 0.15)/(1.0 + db*db/110.0);
    float fill = 0.032*max(0.0, dot(n, normalize(vec3(0.8, 0.3, -0.5))))*(1.0 - smoothstep(25.0, 60.0, t));
    L = alb*(sun*8.0 + (amb + bounce + fill)*ao) + edge*(0.03 + 0.5*bounce + 0.4*sun)*(0.6 + 0.4*max(n.y, 0.0));
    vec3 T = abs(n.z) > 0.7 ? vec3(0.0, 1.0, 0.0) : normalize(cross(n, vec3(0.0, 0.0, 1.0)));
    if (abs(n.x) > 0.7) T = vec3(0.0, 1.0, 0.0);
    vec2 s0 = project(p), s1 = project(p + T*(0.02*t + 0.05));
    ang = atan(s1.y - s0.y, s1.x - s0.x);
  }
  // aerial perspective: pale smoke low in the distance, darkness under the vault
  float fogT = exp(-max(t - 42.0, 0.0)*0.0105);
  float hy = mix(ro.y, p.y, 0.8);
  float haze = mix(0.62, 0.035, smoothstep(6.0, 50.0, hy));
  haze *= mix(0.6, 1.0, smoothstep(60.0, 150.0, t));
  haze += 0.32*smoothstep(40.0, 110.0, p.x)*smoothstep(70.0, 160.0, t)*(1.0 - smoothstep(30.0, 75.0, hy));
  L = L*fogT + haze*(1.0 - fogT);
  // the shaft: single scattering in dusty air, sampled only where the ray crosses the beam
  float vol = 0.0;
  {
    vec3 H0 = ro + uSun*(WPZ - ro.z)/uSun.z;
    vec3 H1 = rd - uSun*rd.z/uSun.z;
    vec2 ix = slabT(H0.x - WINX, H1.x, -WH - 0.8, WH + 0.8);
    vec2 iy = slabT(H0.y, H1.y, WY0 - 0.8, WY1 + WH + 0.8);
    float ta = max(max(ix.x, iy.x), 0.3);
    float tb = min(min(ix.y, iy.y), t);
    if (rd.z > 0.0) tb = min(tb, (WPZ - 0.5 - ro.z)/rd.z);
    if (tb > ta){
      float dt = (tb - ta)/28.0;
      float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)))*43758.5453);
      float tt = ta + dt*jit;
      for (int i=0;i<28;i++){
        vec3 s = ro + rd*tt;
        float tw2;
        float a = aperture(s, tw2);
        float dens = 0.55 + 0.9*vnoise(s*0.2 + vec3(0.0, uVar.x*10.0, 0.0));
        vol += a*dens*dt*exp(-tt*0.002);
        tt += dt;
      }
    }
  }
  vol *= 0.14;
  float shaftW = vol/(vol + L*0.5 + 0.02);
  L += vol;
  if (shaftW > 0.5){
    vec2 s0 = project(p), s1 = project(p - uSun);
    ang = atan(s1.y - s0.y, s1.x - s0.x);
  }
  float l = 1.0 - exp(-L*2.4);
  frag = vec4(l, fract(ang/PI), shaftW, t/330.0);
}`;

  // fragment shader shared header for print & calibration
  const GROUND_GLSL = `
uniform vec4 uPass[${NP}];
uvec3 pcg3d(uvec3 v){
  v = v*1664525u + 1013904223u;
  v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  v ^= v >> 16u;
  v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  return v;
}
vec3 hash3i(ivec3 c){ return vec3(pcg3d(uvec3(c + 32768)))*(1.0/4294967296.0); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
float vn(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h12(i), h12(i+vec2(1,0)), f.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a*vn(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
// the rocked ground: rows of serrated pits laid by the rocker in many directions,
// with the uneven pressure of the hand clumping them into a velvet
float ground(vec2 p){
  float s = 0.0;
  for (int k=0;k<${NP};k++){
    vec4 P = uPass[k];
    vec2 q = vec2(P.x*p.x + P.y*p.y, -P.y*p.x + P.x*p.y) + P.zw;
    vec2 g = q/vec2(1.0, 0.86);
    vec2 c = floor(g);
    vec2 f = g - c;
    vec2 o = step(0.5, f) - 1.0;
    float press = 0.85 + 0.3*vn(q*0.17 + float(k)*7.3);
    for (int j=0;j<2;j++) for (int i=0;i<2;i++){
      vec2 cc = c + o + vec2(float(i), float(j));
      vec3 h = hash3i(ivec3(int(cc.x), int(cc.y), k));
      vec2 ctr = cc + 0.5 + (h.xy - 0.5)*0.55;
      vec2 d = (g - ctr)*vec2(1.0, 0.86);
      s += exp(-(d.x*d.x*14.0 + d.y*d.y*2.0))*(0.45 + 0.8*h.z)*press;
    }
  }
  return s + 0.3*(vn(p*0.21) - 0.5) + 0.3*(vn(p*0.67 + 31.0) - 0.5);
}`;

  const CAL_FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 frag;
${GROUND_GLSL}
void main(){
  float s = ground(gl_FragCoord.xy*0.731 + 517.0) + 2.0;
  float v = clamp(s/12.0, 0.0, 1.0)*65535.0;
  frag = vec4(floor(v/256.0)/255.0, mod(v, 256.0)/255.0, 0.0, 1.0);
}`;

  const PRINT_FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 frag;
uniform sampler2D uTone;
uniform sampler2D uText;
uniform sampler2D uCdf;
uniform vec2 uView;
uniform float uDpr;
uniform vec4 uSheet;
uniform vec4 uPlate;
uniform vec4 uImg;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec4 uImp;     // plate tone, wipe angle, grain size (css px), seed offset
uniform vec4 uImp2;    // ink density, burnish, chain-line phase, laid phase
uniform float uHasImage;
uniform int uSS;
uniform vec4 uFox[6];
${GROUND_GLSL}

float sdBox2(vec2 p, vec2 b){ vec2 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,q.y),0.0); }
float sdRBox(vec2 p, vec2 b, float r){ return sdBox2(p, b - r) - r; }

float cdf(float s){
  float x = clamp(s/12.0, 0.0, 1.0)*255.0;
  float i = floor(x);
  float a = texelFetch(uCdf, ivec2(int(i), 0), 0).r;
  float b = texelFetch(uCdf, ivec2(int(min(i + 1.0, 255.0)), 0), 0).r;
  return mix(a, b, x - i);
}
float Hc(float x, float w){ return x <= 0.0 ? 0.0 : (x < w ? x*x/(2.0*w) : x - 0.5*w); }
float solveA(float t, float w){
  float lo = -w, hi = 1.0;
  for (int i=0;i<14;i++){
    float a = 0.5*(lo + hi);
    float F = Hc(1.0 - a, w) - Hc(-a, w);
    if (F > t) lo = a; else hi = a;
  }
  return 0.5*(lo + hi);
}

// hand-scraped strokes: short tapered marks laid along a direction
float strokes(vec2 p, float ang, float len, float wid, float seed){
  vec2 d = vec2(cos(ang), sin(ang));
  vec2 q = vec2(dot(p, d), dot(p, vec2(-d.y, d.x)));
  float acc = 0.0;
  for (int l=0;l<2;l++){
    vec2 g = q/vec2(len, wid) + vec2(float(l)*0.5, float(l)*0.37) + seed;
    vec2 c = floor(g);
    vec2 f = g - c;
    float r1 = h12(c + 3.1*float(l));
    float r2 = h12(c + 7.7 + 3.1*float(l));
    float along = smoothstep(0.0, 0.25, f.x)*smoothstep(1.0, 0.6 + 0.3*r1, f.x);
    float across = 1.0 - smoothstep(0.1, 0.5, abs(f.y - 0.5 + (r2 - 0.5)*0.4));
    acc += along*across*(0.4 + 0.6*r2)*step(0.25, r1);
  }
  return acc;
}

void main(){
  vec2 P = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);
  vec2 Pc = P/uDpr;
  vec2 sc = 0.5*(uSheet.xy + uSheet.zw), sh = 0.5*(uSheet.zw - uSheet.xy);
  float sW = uSheet.z - uSheet.x;
  float unit = sW/1000.0;                         // 1/1000 of the sheet width, in css px

  // ---------- the wall and its picture light
  vec2 lc = vec2(sc.x, uSheet.y - 0.10*sh.y);
  vec2 lq = (Pc - lc)/vec2(sh.x*1.55, sh.y*1.9);
  float glow = exp(-dot(lq, lq)*1.6);
  vec3 wall = vec3(0.040, 0.036, 0.033)*(0.45 + 1.25*glow);
  wall *= 0.97 + 0.06*vn(Pc*0.35);
  float shD = sdBox2(Pc - sc - vec2(unit*3.0, unit*14.0), sh);
  wall *= 1.0 - 0.55*(1.0 - smoothstep(-unit*6.0, unit*38.0, shD));

  // ---------- the sheet
  vec2 sp = (Pc - uSheet.xy)/unit;               // sheet units (0..1000 across)
  float edgeN = (fbm(Pc*0.09) - 0.5)*1.4 + (vn(Pc*0.6) - 0.5)*0.5;
  float dS = sdBox2(Pc - sc, sh) + edgeN;
  float inSheet = 1.0 - smoothstep(-0.6, 0.6, dS);

  vec3 paper = uPaper;
  float mott = fbm(sp*0.035 + 3.0);
  paper *= 0.975 + 0.05*mott;
  float fib = vn(Pc*vec2(0.9, 0.45)) * vn(Pc*vec2(0.33, 1.1) + 9.0);
  paper *= 0.985 + 0.03*fib;
  // laid and chain lines (seen faintly in raking light)
  float laid = sin((sp.y + 0.8*sin(sp.x*0.013 + uImp2.w))*2.0*3.14159/1.3);
  float chainX = abs(fract((sp.x + uImp2.z)/34.0) - 0.5)*34.0;
  float chain = exp(-chainX*chainX*0.5);
  float plateD = sdRBox(Pc - 0.5*(uPlate.xy + uPlate.zw), 0.5*(uPlate.zw - uPlate.xy), 3.0*unit);
  float pressed = 1.0 - smoothstep(-1.5, 0.5, plateD);
  float laidAmp = mix(0.010, 0.004, pressed)*smoothstep(0.6, 1.4, unit*1.3*uDpr);
  paper *= 1.0 + laidAmp*laid - 0.012*chain;
  // edge toning and foxing
  float edgeTone = smoothstep(-28.0*unit, 0.0, dS);
  paper *= mix(vec3(1.0), vec3(0.93, 0.89, 0.80), edgeTone*0.5);
  for (int i=0;i<6;i++){
    vec4 F = uFox[i];
    vec2 fp = uSheet.xy + F.xy*vec2(sW, uSheet.w - uSheet.y);
    float r = length(Pc - fp)/(F.z*unit) + 0.35*(vn(Pc*0.5 + float(i)*13.0) - 0.5);
    paper = mix(paper, paper*vec3(0.86, 0.76, 0.62), F.w*(1.0 - smoothstep(0.3, 1.0, r)));
  }

  // picture light across the sheet + slight cockle
  float vy = (Pc.y - uSheet.y)/(uSheet.w - uSheet.y);
  float light = 1.04 - 0.17*vy - 0.05*pow(abs(Pc.x - sc.x)/sh.x, 2.0);
  light *= 1.0 + 0.025*(fbm(sp*0.006 + 11.0) - 0.5);

  // plate mark: a bevelled recess pressed into the damp sheet
  float bev = 2.2*unit + 1.0;
  float hb = smoothstep(-bev, 0.0, plateD) - smoothstep(0.0, 1.2, plateD)*0.0;
  float ddx = dFdx(plateD), ddy = dFdy(plateD);
  vec2 gdir = normalize(vec2(ddx, ddy) + 1e-6);
  float slopeB = (smoothstep(-bev, 0.0, plateD) - smoothstep(-bev, 0.0, plateD - 0.7))/0.7;
  float bevelBand = exp(-pow((plateD + bev*0.5)/(bev*0.6), 2.0));
  // gdir is in window space (y up): outward normal of the plate rectangle
  float facing = gdir.y*0.85 + gdir.x*0.35;            // >0 on the top/right walls
  light *= 1.0 - 0.14*bevelBand*facing;
  light *= 1.0 + 0.07*exp(-pow((plateD - 0.5)/0.6, 2.0))*facing;
  light *= mix(1.0, 1.012, pressed);

  // ---------- ink
  float ink = 0.0;
  vec2 pcPlate = 0.5*(uPlate.xy + uPlate.zw);
  // plate tone: a thin film left by the wiping, heavier toward the bevel
  float wipeAng = uImp.y;
  vec2 wd = vec2(cos(wipeAng), sin(wipeAng));
  float wipe = fbm(vec2(dot(Pc, wd), dot(Pc, vec2(-wd.y, wd.x))*0.25)*0.012/max(unit, 0.2) + uImp.w);
  float plateTone = uImp.x*(0.55 + 0.9*wipe) + 0.05*exp(plateD/(7.0*unit));
  plateTone += 0.10*bevelBand;
  plateTone *= pressed;

  vec2 iu = (Pc - uImg.xy)/(uImg.zw - uImg.xy);
  float inImg = step(0.0, iu.x)*step(iu.x, 1.0)*step(0.0, iu.y)*step(iu.y, 1.0);
  if (uHasImage > 0.5 && inImg > 0.5){
    vec4 T = texture(uTone, vec2(iu.x, 1.0 - iu.y));
    float lum = clamp((T.r - 0.075)/0.85, 0.0, 1.0);
    float t = 1.0 - pow(lum, 0.85);
    float ang = T.g*3.14159265;
    float mid = 4.0*t*(1.0 - t);
    // scraper and burnisher marks, following the forms
    float st1 = strokes(Pc, ang, 26.0, 2.2, 0.0);
    float st2 = strokes(Pc, ang + 0.12, 60.0, 5.5, 7.0);
    t = clamp(t - (st1*0.16 + st2*0.12)*mid + 0.05*(fbm(Pc*0.05) - 0.5)*mid, 0.0, 1.0);
    // the rocked ground, ranked and scraped to the tone; several pits per pixel
    float w = mix(0.55, 0.75, uImp2.y) + (uSS == 1 ? 0.12 : 0.0);
    float a = solveA(t, w);
    float g = 0.0;
    for (int sy=0; sy<uSS; sy++) for (int sx=0; sx<uSS; sx++){
      vec2 o = (vec2(float(sx), float(sy)) + 0.5)/float(uSS) - 0.5;
      vec2 gp = (Pc + o/uDpr)/uImp.z;
      float s = ground(gp) + 2.0;
      g += clamp((cdf(s) - a)/w, 0.0, 1.0);
    }
    g /= float(uSS*uSS);
    // burnished passages flatten the burr; the deepest blacks keep a faint sheen
    float smooth_ = 0.3*smoothstep(0.6, 0.05, t);
    g = mix(g, t, smooth_);
    // barely-scraped burr still holds ink: specks in the darks are grey, not paper;
    // burnished lights keep only a little ink in their deepest pits
    g = mix(g*(1.0 - 0.4*smoothstep(0.35, 0.0, t)), 1.0, 0.6*smoothstep(0.68, 1.0, t));
    g *= 0.965 + 0.035*vn(mat2(0.8, 0.6, -0.6, 0.8)*Pc*0.31 + 5.0);
    ink = g;
    vec4 tx = texture(uText, (Pc - uPlate.xy)/(uPlate.zw - uPlate.xy));
    ink *= 1.0 - 0.9*tx.g;
  }
  // engraved border line and lettering
  vec4 tx = texture(uText, (Pc - uPlate.xy)/(uPlate.zw - uPlate.xy));
  float inPlate = step(plateD, 0.0);
  float bl = sdBox2(Pc - 0.5*(uImg.xy + uImg.zw), 0.5*(uImg.zw - uImg.xy) + vec2(3.2*unit));
  float border = 1.0 - smoothstep(0.25*unit, 0.25*unit + 0.7/uDpr, abs(bl));
  float letters = tx.r*smoothstep(0.25, 0.6, tx.r + 0.25*(vn(Pc*1.7) - 0.5));
  ink = 1.0 - (1.0 - ink)*(1.0 - border*0.92*inPlate)*(1.0 - letters*0.95*inPlate);
  ink = 1.0 - (1.0 - ink)*(1.0 - plateTone);
  ink = clamp(ink*uImp2.x, 0.0, 1.0);

  vec3 inkCol = uInk;
  vec3 sheetCol = mix(paper, inkCol, ink)*light;
  vec3 col = mix(wall, sheetCol, inSheet);
  // dither
  col += (h12(P + 0.5) - 0.5)/255.0;
  frag = vec4(col, 1.0);
}`;

  const BLIT_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform sampler2D uTex;
uniform vec2 uView;
uniform float uMode;
uniform vec4 uRect;
void main(){
  vec2 uv = gl_FragCoord.xy/uView;
  if (uMode > 0.5){
    // debug: show tone texture letterboxed
    vec2 q = (gl_FragCoord.xy - uRect.xy)/uRect.zw;
    if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0){ frag = vec4(0.1,0.1,0.1,1.0); return; }
    vec4 t = texture(uTex, q);
    frag = vec4(vec3(t.r), 1.0);
    return;
  }
  frag = texture(uTex, uv);
}`;

  /* ------------------------------------------------------------------ GL helpers */
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('shader: ' + log);
    }
    return s;
  }
  function program(gl, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }
  function makeTex(gl, w, h, internal, format, type, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function makeFbo(gl, tex) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return f;
  }

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  /* ------------------------------------------------------------------ layout */
  function layout(cssW, cssH) {
    const portrait = cssW / cssH < 0.85;
    const sheetAR = portrait ? 0.74 : 1.39;
    let sh = cssH * (portrait ? 0.84 : 0.92);
    let sw = sh * sheetAR;
    const maxW = cssW * (portrait ? 0.93 : 0.95);
    if (sw > maxW) { sw = maxW; sh = sw / sheetAR; }
    const sx = (cssW - sw) / 2;
    const sy = (cssH - sh) * (portrait ? 0.42 : 0.5);
    const m = portrait ? { l: 0.095, r: 0.095, t: 0.075, b: 0.13 } : { l: 0.095, r: 0.095, t: 0.085, b: 0.135 };
    const plate = [sx + m.l * sw, sy + m.t * sh, sx + sw - m.r * sw, sy + sh - m.b * sh];
    const pw = plate[2] - plate[0], ph = plate[3] - plate[1];
    const img = portrait
      ? [plate[0] + 0.05 * pw, plate[1] + 0.04 * ph, plate[2] - 0.05 * pw, plate[3] - 0.1 * ph]
      : [plate[0] + 0.032 * pw, plate[1] + 0.045 * ph, plate[2] - 0.032 * pw, plate[3] - 0.12 * ph];
    return { portrait, sheet: [sx, sy, sx + sw, sy + sh], plate, img };
  }

  /* ------------------------------------------------------------------ the piece */
  (window.PIECES = window.PIECES || []).push({
    id: 'carceri',
    title: 'Carcere XVII: The Well of Stairs',
    medium: 'Mezzotint, scraped and burnished, on laid paper',
    note: 'Drawn with light, scraped out of a black plate',
    about: 'An imaginary prison in the manner of the Carceri d’invenzione, pulled as a mezzotint: the whole plate is first rocked to a velvet black, and every light in it is scraped and burnished back out of the dark. The vaults are ray-marched as distance fields, then printed through a simulated rocker ground, scraper marks, plate tone and a bevelled plate mark on laid paper.',
    tone: 'dark',
    room: '#0b0a09',
    mount(el, api) {
      const rnd = mulberry32(api.seed);
      el.style.background = '#0b0a09';
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      el.appendChild(canvas);
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      let destroyed = false;
      let job = 0;
      if (!gl) {
        el.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#bbb;font:italic 18px serif">This print needs WebGL2 to be pulled.</div>';
        api.ready();
        return { destroy() {} };
      }

      /* ---- impression (seeded): ink, paper, wiping, foxing, figures */
      const warm = rnd();
      const imp = {
        ink: [0.085 + 0.03 * warm, 0.070 + 0.012 * warm, 0.062 - 0.008 * warm],
        paper: [0.918 + rnd() * 0.02, 0.888 + rnd() * 0.02, 0.815 + rnd() * 0.03],
        plateTone: 0.018 + rnd() * 0.03,
        wipeAng: rnd() * Math.PI,
        grain: 1.5,
        seedOff: rnd() * 100,
        density: 0.97 + rnd() * 0.03,
        burnish: rnd(),
        chainPhase: rnd() * 34,
        laidPhase: rnd() * 6.28,
        fox: [],
        dust: rnd(),
      };
      const nFox = 2 + Math.floor(rnd() * 4);
      for (let i = 0; i < 6; i++) {
        if (i < nFox) {
          // foxing lives mostly in the margins
          let x = rnd(), y = rnd();
          if (rnd() < 0.7) { if (rnd() < 0.5) x = rnd() < 0.5 ? rnd() * 0.1 : 0.9 + rnd() * 0.1; else y = rnd() < 0.5 ? rnd() * 0.09 : 0.86 + rnd() * 0.13; }
          imp.fox.push(x, y, 1.5 + rnd() * 5, 0.15 + rnd() * 0.35);
        } else imp.fox.push(0, 0, 1, 0);
      }
      // figures: feet xyz, facing; pose: stride, arm, lean
      // figures: feet xyz, facing; pose: stride, arm, lean
      const bridgeAt = (lx) => [4 + lx * Math.cos(-0.9), 22.0, 45 + lx * Math.sin(-0.9)];
      const fsTop = [-14.9 + 20.9 * Math.cos(-0.42), 14.1, 24.1 + 20.9 * Math.sin(-0.42)];
      const b1 = bridgeAt(-17 + rnd() * 6), b2 = bridgeAt(8.4);
      const figs = [
        [13.3, 2.6, 62.2, -2.0, 0.25, 0.2 + rnd() * 0.8, 0.35, 0],
        [b1[0], b1[1], b1[2], 0.65, 0.8, 0.1, 0.05, 0],
        [fsTop[0], fsTop[1], fsTop[2], 0.25 + rnd() * 0.5, 0.0, rnd() * 0.5, 0.45, 0],
        [12.0 - rnd() * 14.0, 0, 90.3, -1.57, 0.6, 0.0, 0.1, 0],
        [b2[0], b2[1], b2[2], -2.4, 0.3, 0.9, 0.2, 0],
      ];
      figs[3][1] = (Math.floor((28.0 - figs[3][0]) / 0.45) + 1) * 0.3;
      const passes = [];
      {
        const pr = mulberry32(1749); // the plate itself is the same for every impression
        for (let k = 0; k < NP; k++) {
          const a = ((k + 0.5 + (pr() - 0.5) * 0.7) / NP) * Math.PI;
          passes.push(Math.cos(a), Math.sin(a), pr() * 1000, pr() * 1000);
        }
      }

      let progs;
      try {
        progs = {
          scene: program(gl, SCENE_FS),
          cal: program(gl, CAL_FS),
          print: program(gl, PRINT_FS),
          blit: program(gl, BLIT_FS),
        };
      } catch (e) {
        console.error(e);
        el.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#bbb;font:italic 18px serif">The plate could not be prepared.</div>';
        api.ready();
        return { destroy() {} };
      }
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const floatOK = !!gl.getExtension('EXT_color_buffer_float');

      /* ---- calibrate the rocked ground: rank of burr depth -> uniform */
      let cdfTex = null;
      function calibrate() {
        const N = 96;
        const tex = makeTex(gl, N, N, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
        const fbo = makeFbo(gl, tex);
        gl.viewport(0, 0, N, N);
        gl.useProgram(progs.cal.p);
        gl.uniform4fv(progs.cal.u.uPass, passes);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const px = new Uint8Array(N * N * 4);
        gl.readPixels(0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const hist = new Float64Array(256);
        for (let i = 0; i < N * N; i++) {
          const v = (px[i * 4] * 256 + px[i * 4 + 1]) / 65535; // s/12
          hist[Math.min(255, Math.floor(v * 256))]++;
        }
        const cdf = new Float32Array(256);
        let acc = 0;
        for (let i = 0; i < 256; i++) { cdf[i] = (acc + hist[i] * 0.5) / (N * N); acc += hist[i]; }
        cdfTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, cdfTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 256, 1, 0, gl.RED, gl.FLOAT, cdf);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(tex);
      }
      calibrate();

      /* ---- lettering, drawn once per size into a texture covering the plate */
      function letterTexture(L, dpr) {
        const pw = Math.max(2, Math.round((L.plate[2] - L.plate[0]) * dpr));
        const ph = Math.max(2, Math.round((L.plate[3] - L.plate[1]) * dpr));
        const c = document.createElement('canvas');
        c.width = pw; c.height = ph;
        const g = c.getContext('2d');
        g.clearRect(0, 0, pw, ph);
        const ox = L.plate[0], oy = L.plate[1];
        const X = (x) => (x - ox) * dpr, Y = (y) => (y - oy) * dpr;
        const iw = L.img[2] - L.img[0];
        const below = L.plate[3] - L.img[3];
        const u = (L.sheet[2] - L.sheet[0]) / 1000;
        // engraved (dark) lettering in the red channel
        g.fillStyle = 'rgb(255,0,0)';
        g.textBaseline = 'alphabetic';
        const small = Math.max(5.5, 7.4 * u) * dpr;
        g.font = 'italic ' + small + 'px serif';
        g.textAlign = 'left';
        g.fillText('Tertia Manus inv. et sculp.', X(L.img[0] + 2 * u), Y(L.img[3] + 3.2 * u) + small * 1.25);
        g.textAlign = 'right';
        g.fillText('in maniera nera', X(L.img[2] - 2 * u), Y(L.img[3] + 3.2 * u) + small * 1.25);
        const big = Math.max(7, 13.0 * u) * dpr;
        g.font = big + 'px serif';
        g.textAlign = 'center';
        const title = 'IL POZZO DELLE SCALE';
        const spaced = title.split('').join(' ');
        try { g.letterSpacing = (0.28 * big / dpr) * dpr + 'px'; } catch (e) { /* older engines */ }
        g.fillText(L.portrait ? title : spaced, X((L.img[0] + L.img[2]) / 2), Y(L.img[3] + below * 0.62));
        try { g.letterSpacing = '0px'; } catch (e) { /* noop */ }
        // scraped (light) plate number in the green channel, top right of the image
        g.fillStyle = 'rgb(0,255,0)';
        const num = Math.max(7, 12 * u) * dpr;
        g.font = num + 'px serif';
        g.textAlign = 'right';
        g.fillText('XVII', X(L.img[2] - 9 * u), Y(L.img[1] + 9 * u) + num * 0.8);
        g.globalCompositeOperation = 'lighter';
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
      }

      /* ---- camera framing for each plate orientation */
      function camera(portrait) {
        if (portrait) return { pos: [-12.0, 14.0, 4.0], yaw: -0.38, tanW: 0.6, hor: 0.27 };
        return { pos: [-14.0, 14.0, 4.0], yaw: -0.42, tanW: 0.84, hor: 0.33 };
      }

      /* ---- tiled execution with GPU fences so no frame is held for long */
      async function runTiles(my, w, h, draw) {
        let tile = 64;
        const tiles = [];
        for (let y = 0; y < h; y += tile) for (let x = 0; x < w; x += tile) tiles.push([x, y, Math.min(tile, w - x), Math.min(tile, h - y)]);
        let per = 1;
        let i = 0;
        gl.enable(gl.SCISSOR_TEST);
        while (i < tiles.length) {
          if (destroyed || my !== job) { gl.disable(gl.SCISSOR_TEST); return false; }
          const t0 = performance.now();
          const n = Math.min(per, tiles.length - i);
          for (let k = 0; k < n; k++, i++) {
            const tl = tiles[i];
            gl.scissor(tl[0], tl[1], tl[2], tl[3]);
            draw();
          }
          const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          // eslint-disable-next-line no-await-in-loop
          await nextFrame();
          while (gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED) {
            // eslint-disable-next-line no-await-in-loop
            await nextFrame();
            if (destroyed) { gl.deleteSync(fence); return false; }
          }
          gl.deleteSync(fence);
          const dt = performance.now() - t0;
          const perTile = dt / n;
          per = Math.max(1, Math.min(256, Math.floor((n * 28) / Math.max(dt, 1)) || 1));
          if (perTile > 220 && per === 1) per = 1;
        }
        gl.disable(gl.SCISSOR_TEST);
        return true;
      }

      let tone = null, toneFbo = null, outTex = null, outFbo = null, textTex = null;
      let lastKey = '';

      async function render() {
        const my = ++job;
        const cssW = Math.max(1, el.clientWidth), cssH = Math.max(1, el.clientHeight);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
        const L = layout(cssW, cssH);
        canvas.width = W; canvas.height = H;
        const t0 = performance.now();

        const iwCss = L.img[2] - L.img[0], ihCss = L.img[3] - L.img[1];
        let q = 1.0 * (DBG && DBG.scale ? DBG.scale : 1);
        const budget = 1.1e6;
        if (iwCss * ihCss * q * q > budget) q = Math.sqrt(budget / (iwCss * ihCss));
        const tw = Math.max(16, Math.round(iwCss * q)), th = Math.max(16, Math.round(ihCss * q));

        [tone, outTex, textTex].forEach((t) => t && gl.deleteTexture(t));
        [toneFbo, outFbo].forEach((f) => f && gl.deleteFramebuffer(f));
        tone = floatOK ? makeTex(gl, tw, th, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR) : makeTex(gl, tw, th, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
        toneFbo = makeFbo(gl, tone);
        outTex = makeTex(gl, W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
        outFbo = makeFbo(gl, outTex);
        textTex = letterTexture(L, dpr);

        const cam = camera(L.portrait);
        const sun = [-20.0, 53.4, 30.2];
        const sl = Math.hypot(sun[0], sun[1], sun[2]);
        const figData = [], poseData = [];
        figs.forEach((f) => { figData.push(f[0], f[1], f[2], f[3]); poseData.push(f[4], f[5], f[6], f[7]); });

        const printUniforms = (hasImage) => {
          const u = progs.print.u;
          gl.useProgram(progs.print.p);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tone); gl.uniform1i(u.uTone, 0);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textTex); gl.uniform1i(u.uText, 1);
          gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, cdfTex); gl.uniform1i(u.uCdf, 2);
          gl.uniform2f(u.uView, W, H);
          gl.uniform1f(u.uDpr, dpr);
          gl.uniform4fv(u.uSheet, L.sheet);
          gl.uniform4fv(u.uPlate, L.plate);
          gl.uniform4fv(u.uImg, L.img);
          gl.uniform3fv(u.uInk, imp.ink);
          gl.uniform3fv(u.uPaper, imp.paper);
          gl.uniform4f(u.uImp, imp.plateTone, imp.wipeAng, imp.grain, imp.seedOff);
          gl.uniform4f(u.uImp2, imp.density, imp.burnish, imp.chainPhase, imp.laidPhase);
          gl.uniform1f(u.uHasImage, hasImage ? 1 : 0);
          gl.uniform1i(u.uSS, dpr < 1.5 ? 2 : 1);
          gl.uniform4fv(u.uFox, imp.fox);
          gl.uniform4fv(u.uPass, passes);
        };
        const blit = () => {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, W, H);
          gl.useProgram(progs.blit.p);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, outTex);
          gl.uniform1i(progs.blit.u.uTex, 0);
          gl.uniform2f(progs.blit.u.uView, W, H);
          gl.uniform1f(progs.blit.u.uMode, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        };

        // 1. the blank sheet on the wall, so something sensible shows at once
        if (!(DBG && DBG.toneOnly)) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, outFbo);
          gl.viewport(0, 0, W, H);
          printUniforms(false);
          if (!(await runTiles(my, W, H, () => gl.drawArrays(gl.TRIANGLES, 0, 3)))) return;
          blit();
        }

        // 2. the tonal drawing, ray-marched in tiles
        gl.bindFramebuffer(gl.FRAMEBUFFER, toneFbo);
        gl.viewport(0, 0, tw, th);
        const su = progs.scene.u;
        const drawScene = () => {
          gl.useProgram(progs.scene.p);
          gl.uniform2f(su.uRes, tw, th);
          gl.uniform3fv(su.uCam, cam.pos);
          gl.uniform1f(su.uYaw, cam.yaw);
          gl.uniform1f(su.uTanW, cam.tanW);
          gl.uniform1f(su.uHor, cam.hor);
          gl.uniform3f(su.uSun, sun[0] / sl, sun[1] / sl, sun[2] / sl);
          gl.uniform4f(su.uVar, imp.dust, 0, 0, 0);
          gl.uniform4fv(su.uFig, figData);
          gl.uniform4fv(su.uPose, poseData);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        if (!(await runTiles(my, tw, th, drawScene))) return;
        const t1 = performance.now();

        if (DBG && DBG.toneOnly) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, W, H);
          gl.useProgram(progs.blit.p);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tone);
          gl.uniform1i(progs.blit.u.uTex, 0);
          gl.uniform2f(progs.blit.u.uView, W, H);
          gl.uniform1f(progs.blit.u.uMode, 1);
          const sc = Math.min(W / tw, H / th);
          gl.uniform4f(progs.blit.u.uRect, (W - tw * sc) / 2, (H - th * sc) / 2, tw * sc, th * sc);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          console.log('[carceri] tone ' + tw + 'x' + th + ' in ' + Math.round(t1 - t0) + 'ms');
          document.documentElement.dataset.carceriDone = '1';
          api.ready();
          return;
        }

        // 3. pull the print
        gl.bindFramebuffer(gl.FRAMEBUFFER, outFbo);
        gl.viewport(0, 0, W, H);
        const drawPrint = () => { printUniforms(true); gl.drawArrays(gl.TRIANGLES, 0, 3); };
        if (!(await runTiles(my, W, H, drawPrint))) return;
        blit();
        if (DBG) console.log('[carceri] tone ' + tw + 'x' + th + ' ' + Math.round(t1 - t0) + 'ms, print ' + Math.round(performance.now() - t1) + 'ms');
        if (DBG) document.documentElement.dataset.carceriDone = '1';
        api.ready();
      }

      let rsTimer = 0;
      const ro = new ResizeObserver(() => {
        const key = el.clientWidth + 'x' + el.clientHeight + '@' + Math.min(2, window.devicePixelRatio || 1);
        if (key === lastKey) return;
        const first = lastKey === '';
        lastKey = key;
        clearTimeout(rsTimer);
        rsTimer = setTimeout(() => { render().catch((e) => console.error(e)); }, first ? 0 : 300);
      });
      ro.observe(el);

      return {
        destroy() {
          destroyed = true;
          job++;
          clearTimeout(rsTimer);
          ro.disconnect();
          const ext = gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        },
      };
    },
  });
})();
