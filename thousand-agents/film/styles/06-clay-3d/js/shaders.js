// 1000 Agents — the film, DESKTOP section, clay / vinyl-toy style. Hand-written raymarched SDF renderer (raw WebGL2).
// Extended from the 3 s style preview: the folder is gone; four window slabs, a login panel with an avatar ring, a plinth with
// an input field and a blinking cursor join the hero. All GLSL lives here; js/piece.js owns the timeline and the GL plumbing.
(function () {
'use strict';

const VS_FULL = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FS_SCENE = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform vec3  uRo, uCu, uCv, uCw;
uniform float uTanH, uNear, uFar, uFrame;
uniform vec3  uFit;       // anchor fit in NDC: scale, shift x, shift y

uniform vec3  uHPos;
uniform float uHYaw, uHLean, uHPitch;
uniform vec3  uHScale;
uniform vec2  uLook;
uniform float uBlink, uMouth, uArm;

uniform vec4  uWinP[4];   // window centre xyz, pop scale
uniform vec4  uWinS[4];   // half width, half height, yaw, squash
uniform vec4  uLogP;      // login panel centre xyz (base on the floor), scale
uniform vec4  uLogS;      // half width, half height, squash, ring glow
uniform vec4  uPlin;      // plinth centre xz, height, scale
uniform float uCursor;    // cursor visible 0..1
uniform float uType;      // dots typed into the field (0..6)
uniform vec3  uWarmP;     // a warm key from the swarm
uniform float uWarmI;

const float PI = 3.14159265;

float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i),               hash13(i+vec3(1,0,0)), f.x),
                 mix(hash13(i+vec3(0,1,0)),   hash13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i+vec3(0,0,1)),   hash13(i+vec3(1,0,1)), f.x),
                 mix(hash13(i+vec3(0,1,1)),   hash13(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float sdRBox(vec3 p, vec3 b, float r){ vec3 q = abs(p)-b+r; return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r; }
float sdCaps(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0); return length(pa-ba*h)-r; }
float sdRCyl(vec3 p, float ra, float rb, float h){ vec2 d = vec2(length(p.xz)-ra+rb, abs(p.y)-h+rb); return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - rb; }
float sdTorusZ(vec3 p, float R, float r){ vec2 q = vec2(length(p.xy)-R, p.z); return length(q)-r; }
float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.0)/k; return min(a,b)-h*h*k*0.25; }
float smax(float a, float b, float k){ return -smin(-a,-b,k); }

// ---- hero
vec3 heroLocal(vec3 p){
  p -= uHPos;
  float c = cos(uHYaw), s = sin(uHYaw);
  p = vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z);
  c = cos(uHLean); s = sin(uHLean);
  p = vec3(c*p.x - s*p.y, s*p.x + c*p.y, p.z);
  c = cos(uHPitch); s = sin(uHPitch); p.y -= 0.25;
  p = vec3(p.x, c*p.y - s*p.z + 0.25, s*p.y + c*p.z);
  return p/uHScale;
}
vec3 eyeC(float sx){ return vec3(sx*0.2 + uLook.x*0.055, 0.6 + uLook.y*0.055, 0.3); }
vec3 eyeR(){ return vec3(0.058, 0.066*(1.0-0.9*uBlink), 0.05); }
const vec3 MOUTH_C = vec3(0.0, 0.405, 0.33);
float mouthD(vec3 q){ vec3 r = vec3(0.035+0.07*uMouth, 0.012+0.075*uMouth, 0.16); return (length((q-MOUTH_C)/r)-1.0)*min(r.x,r.y); }
vec2 hero(vec3 q){
  float lump = 0.0045*sin(q.x*8.0+1.0)*sin(q.y*10.0+0.5)*sin(q.z*9.0+2.0) + 0.003*sin(q.x*19.0)*sin(q.y*17.0+2.0)*sin(q.z*21.0);
  float body = sdRBox(q-vec3(0.0,0.53,0.0), vec3(0.5,0.3,0.31), 0.15);
  vec3 lq = vec3(abs(q.x)-0.3, q.y-0.15, abs(q.z)-0.17);
  float leg = sdRCyl(lq, 0.105, 0.05, 0.16);
  body = smin(body, leg, 0.06);
  float armL = sdCaps(q, vec3(-0.45,0.5,0.02), vec3(-0.565,0.46,0.03), 0.088);
  vec3 ad = normalize(mix(vec3(1.0,-0.3,0.08), vec3(0.5,1.0,0.12), uArm));
  vec3 a0 = vec3(0.45, 0.5+0.03*uArm, 0.02);
  float armR = sdCaps(q, a0, a0+ad*mix(0.115,0.30,uArm), mix(0.088,0.078,uArm));
  body = smin(body, min(armL,armR), 0.05);
  body += lump;
  float mat = 1.0;
  if(uMouth > 0.01){ float m = mouthD(q); body = smax(body, -m, 0.025); if(m < 0.012) mat = 3.0; }
  vec3 er = eyeR();
  vec3 e = vec3(abs(q.x - uLook.x*0.055) - 0.2, q.y - 0.6 - uLook.y*0.055, q.z - 0.3);
  float eye = (length(e/er)-1.0)*min(er.y, er.z);
  if(eye < body){ body = eye; mat = 2.0; }
  return vec2(body, mat);
}

// ---- windows: rounded clay slabs with a title groove, raised line marks, a teal "done" bead
// materials: 4 lilac clay, 5 pale marks, 6 teal, 7 dark field, 8 plinth clay
vec2 window(vec3 p, vec4 P, vec4 S, vec3 LL, float k){
  vec3 q = p - P.xyz;
  float c = cos(S.z), s = sin(S.z);
  q = vec3(c*q.x - s*q.z, q.y, s*q.x + c*q.z);
  vec3 sc = vec3(P.w*(1.0+0.5*S.w), P.w*(1.0-S.w), P.w*(1.0+0.5*S.w));
  q /= sc; float ms = min(sc.x, min(sc.y, sc.z));
  // a cheap bound first: most samples never get closer than this
  vec3 bq = abs(q) - vec3(S.x+0.05, S.y+0.05, 0.13);
  float bb = length(max(bq, 0.0)) + min(max(bq.x, max(bq.y, bq.z)), 0.0);
  if(bb > 0.05) return vec2(bb*ms, 4.0);
  float lump = 0.004*sin(q.x*9.0+2.0)*sin(q.y*8.0+1.0+k) + 0.002*sin(q.x*23.0)*sin(q.y*19.0+q.z*20.0);
  float d = sdRBox(q, vec3(S.x, S.y, 0.07), 0.065) + lump;
  d = smax(d, -sdRBox(q - vec3(0.0, S.y-0.13, 0.075), vec3(S.x-0.1, 0.032, 0.03), 0.02), 0.015);
  float mat = 4.0;
  vec3 len = LL*(S.x-0.18);
  float lines = sdRBox(q - vec3(-S.x+0.18+len.x, S.y-0.34, 0.078), vec3(len.x, 0.028, 0.026), 0.022);
  lines = min(lines, sdRBox(q - vec3(-S.x+0.18+len.y, S.y-0.51, 0.078), vec3(len.y, 0.028, 0.026), 0.022));
  lines = min(lines, sdRBox(q - vec3(-S.x+0.18+len.z, S.y-0.68, 0.078), vec3(len.z, 0.028, 0.026), 0.022));
  float dot_ = length(q - vec3(S.x-0.14, S.y-0.13, 0.06)) - 0.035;
  if(lines < d) mat = 5.0;
  d = smin(d, lines, 0.01);
  if(dot_ < d){ d = dot_; mat = 6.0; }
  return vec2(d*ms, mat);
}
// ---- the login: an upright panel with a raised avatar ring, and a plinth in front with a field and a cursor
vec2 login(vec3 p){
  vec3 q = p - uLogP.xyz;
  float s = uLogP.w; vec3 sc = vec3(s*(1.0+0.5*uLogS.z), s*(1.0-uLogS.z), s*(1.0+0.5*uLogS.z));
  q.y -= uLogS.y*sc.y; q /= sc; float ms = min(sc.x, min(sc.y, sc.z));
  vec3 bq = abs(q) - vec3(uLogS.x+0.05, uLogS.y+0.05, 0.2);
  float bb = length(max(bq, 0.0)) + min(max(bq.x, max(bq.y, bq.z)), 0.0);
  if(bb > 0.05) return vec2(bb*ms, 4.0);
  float lump = 0.004*sin(q.x*7.0+1.0)*sin(q.y*9.0+2.0) + 0.002*sin(q.x*21.0)*sin(q.y*17.0+q.z*19.0);
  float d = sdRBox(q, vec3(uLogS.x, uLogS.y, 0.09), 0.08) + lump;
  // the avatar ring: centred where the hero will stand on the plinth
  float ring = sdTorusZ(q - vec3(0.0, uPlin.z + 0.47 - uLogS.y, 0.1), 0.66, 0.045);
  float mat = 4.0;
  if(ring < d){ d = smin(d, ring, 0.02); mat = 5.0; }
  return vec2(d*ms, mat);
}
vec2 plinth(vec3 p){
  vec3 q = p - vec3(uPlin.x, 0.0, uPlin.y);
  float s = uPlin.w, h = uPlin.z;
  q /= s;
  float d = sdRBox(q - vec3(0.0, h*0.5, 0.0), vec3(0.62, h*0.5, 0.42), 0.07);
  d += 0.003*sin(q.x*11.0)*sin(q.y*13.0+1.0);
  // the field: a dark inset across the front face
  float field = sdRBox(q - vec3(-0.02, h*0.5, 0.42), vec3(0.47, 0.075, 0.03), 0.03);
  d = smax(d, -field, 0.01);
  float mat = 8.0;
  if(field < 0.012) mat = 7.0;
  // the dots typed so far, then the cursor
  float marks = 1e9;
  for(int i=0;i<6;i++){ float fi = float(i); if(fi >= uType) break; marks = min(marks, length(q - vec3(-0.38+fi*0.1, h*0.5, 0.405)) - 0.024); }
  float cur = sdRBox(q - vec3(-0.38 + uType*0.1 - 0.02, h*0.5, 0.405), vec3(0.01, 0.045, 0.012), 0.006);
  if(uCursor > 0.5) marks = min(marks, cur);
  if(marks < d){ d = marks; mat = 5.0; }
  return vec2(d*s, mat);
}

float gHS;
vec2 mapO(vec3 p, float lim){
  vec2 res = vec2(lim, 0.0);
  vec3 hc = uHPos + vec3(0.0,0.5,0.0);
  float bd = length(p-hc) - 1.0;
  if(bd < res.x){
    if(bd > 0.25){ res.x = min(res.x, bd); }
    else { vec2 h = hero(heroLocal(p)); h.x *= gHS; if(h.x < res.x) res = h; }
  }
  if(uWinP[0].w > 0.02){ vec2 w = window(p, uWinP[0], uWinS[0], vec3(0.78, 0.55, 0.66), 0.0); if(w.x < res.x) res = w; }
  if(uWinP[1].w > 0.02){ vec2 w = window(p, uWinP[1], uWinS[1], vec3(0.6, 0.82, 0.45), 1.0); if(w.x < res.x) res = w; }
  if(uWinP[2].w > 0.02){ vec2 w = window(p, uWinP[2], uWinS[2], vec3(0.85, 0.5, 0.7), 2.0); if(w.x < res.x) res = w; }
  if(uWinP[3].w > 0.02){ vec2 w = window(p, uWinP[3], uWinS[3], vec3(0.55, 0.75, 0.6), 3.0); if(w.x < res.x) res = w; }
  if(uLogP.w > 0.02){ vec2 w = login(p); if(w.x < res.x) res = w; }
  if(uPlin.w > 0.02){
    bd = length(p - vec3(uPlin.x, uPlin.z*0.5, uPlin.y)) - 0.9*uPlin.w;
    if(bd < res.x){
      if(bd > 0.25){ res.x = min(res.x, bd); }
      else { vec2 w = plinth(p); if(w.x < res.x) res = w; }
    }
  }
  return res;
}
vec2 map(vec3 p){ return mapO(p, p.y); }

vec3 calcNormal(vec3 p){
  const vec2 e = vec2(1.0,-1.0)*0.0012;
  return normalize(e.xyy*map(p+e.xyy).x + e.yyx*map(p+e.yyx).x + e.yxy*map(p+e.yxy).x + e.xxx*map(p+e.xxx).x);
}
float softShadow(vec3 ro, vec3 rd, float tmax, float k, int steps){
  float res = 1.0, t = 0.03;
  for(int i=0;i<40;i++){
    if(i >= steps) break;
    float h = mapO(ro+rd*t, 4.0).x;
    res = min(res, k*h/t);
    t += clamp(h, 0.03, 1.2);
    if(res < 0.004 || t > tmax) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res*res*(3.0-2.0*res);
}
float calcAO(vec3 p, vec3 n){
  float occ = 0.0, sca = 1.0;
  for(int i=0;i<5;i++){ float h = 0.015 + 0.11*float(i); occ += (h - map(p+n*h).x)*sca; sca *= 0.72; }
  return clamp(1.0 - 1.35*occ, 0.0, 1.0);
}
float clayH(vec3 q){
  float n = vnoise(q*2.3 + 7.0);
  float mask = smoothstep(0.50, 0.72, vnoise(q*1.7 + 31.0));
  return sin(n*64.0)*mask*0.2 + vnoise(q*9.0)*1.1 + vnoise(q*70.0)*0.07;
}
vec3 bumpN(vec3 p, vec3 n, float amt, bool isHero){
  const float e = 0.004;
  vec3 q0 = isHero ? heroLocal(p) : p + 11.0;
  float h0 = clayH(q0);
  vec3 g = isHero ? vec3(clayH(heroLocal(p+vec3(e,0,0))), clayH(heroLocal(p+vec3(0,e,0))), clayH(heroLocal(p+vec3(0,0,e)))) - h0
                  : vec3(clayH(q0+vec3(e,0,0)), clayH(q0+vec3(0,e,0)), clayH(q0+vec3(0,0,e))) - h0;
  g /= e; g -= n*dot(n,g);
  return normalize(n - g*amt);
}
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 tonemap(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }

void main(){
  gHS = min(uHScale.x, min(uHScale.y, uHScale.z));
  vec2 uv = (gl_FragCoord.xy/uRes)*2.0-1.0;
  uv = (uv - uFit.yz)/uFit.x;
  vec3 rd = normalize(uv.x*uTanH*(uRes.x/uRes.y)*uCu + uv.y*uTanH*uCv + uCw);
  vec3 ro = uRo;
  float tF = rd.y < -1e-4 ? -ro.y/rd.y : 200.0;
  float tMax = min(tF, 60.0);
  float t = 0.5; vec2 h = vec2(0.0);
  bool hit = false;
  for(int i=0;i<110;i++){
    h = mapO(ro+rd*t, 8.0);
    if(h.x < 0.0006*t){ hit = true; break; }
    t += h.x*0.9;
    if(t > tMax) break;
  }
  vec3 bg = lin(vec3(0.032,0.022,0.07)) + lin(vec3(0.12,0.076,0.225))*exp(-9.0*(rd.y+0.02)*(rd.y+0.02) - 1.6*rd.x*rd.x);
  if(!hit && tF > 60.0){
    // the ray leaves into the dark backdrop: nothing to light
    vec3 cb = pow(tonemap(bg), vec3(1.0/2.2)) + (hash12(gl_FragCoord.xy + uFrame*17.0)-0.5)/255.0;
    outColor = vec4(cb, 1.0); gl_FragDepth = 0.99999; return;
  }
  if(!hit){ t = min(tF, 200.0); h = vec2(0.0); }
  vec3 p = ro+rd*t;
  float mat = h.y;
  vec3 n = mat < 0.5 ? vec3(0.0,1.0,0.0) : calcNormal(p);
  vec3 ng = n;

  vec3 alb; float sheen = 0.1, gloss = 14.0, sss = 0.0; vec3 emis = vec3(0.0);
  vec3 CORAL = lin(vec3(0.851,0.467,0.341)), CLIGHT = lin(vec3(0.949,0.647,0.522)), CSHADE = lin(vec3(0.659,0.333,0.231)), CDARK = lin(vec3(0.431,0.165,0.102));
  vec3 LIL = lin(vec3(0.44,0.40,0.80));
  if(mat < 0.5){
    float g = vnoise(p*3.0)*0.5 + vnoise(p*40.0)*0.5;
    alb = lin(vec3(0.135,0.097,0.25))*(0.86+0.28*g);
    sheen = 0.03; gloss = 8.0;
  } else if(mat < 1.5){
    vec3 q = heroLocal(p);
    n = bumpN(p, n, 0.014, true);
    float v = vnoise(q*5.0+3.0);
    alb = mix(CORAL, CLIGHT, 0.14*v)*vec3(0.93,0.78,0.72);
    alb = mix(alb, CSHADE, 0.55*smoothstep(0.34, 0.02, q.y)*0.6);
    alb *= 0.93 + 0.1*vnoise(q*60.0);
    sss = 1.0;
  } else if(mat < 2.5){
    alb = vec3(0.012,0.008,0.01); sheen = 0.0; gloss = 220.0;
    vec3 q = heroLocal(p);
    float sx = q.x - uLook.x*0.055 > 0.0 ? 1.0 : -1.0;
    vec3 e = (q - eyeC(sx))/eyeR();
    float gl = smoothstep(0.34, 0.24, length(e.xy - vec2(-0.3, 0.38)));
    gl += 0.6*smoothstep(0.16, 0.10, length(e.xy - vec2(0.3, -0.3)));
    emis = vec3(1.0,0.97,0.93)*gl*(1.0-uBlink)*step(0.0,e.z)*0.9;
  } else if(mat < 3.5){
    vec3 q = heroLocal(p);
    alb = CDARK*mix(0.75, 0.3, smoothstep(0.0, 0.1, 0.33-q.z));
    sheen = 0.04;
  } else if(mat < 4.5){
    n = bumpN(p, n, 0.009, false);
    alb = LIL*(0.86+0.2*vnoise(p*5.0+9.0))*(0.94+0.1*vnoise(p*60.0));
    sss = 0.5;
  } else if(mat < 5.5){
    n = bumpN(p, n, 0.0018, false);
    alb = lin(vec3(0.80,0.77,0.98))*(0.95+0.05*vnoise(p*20.0));
    sss = 0.4;
  } else if(mat < 6.5){
    alb = lin(vec3(0.37,0.84,0.77)); sss = 0.3; emis = lin(vec3(0.37,0.84,0.77))*0.25;
  } else if(mat < 7.5){
    alb = lin(vec3(0.07,0.055,0.15)); sheen = 0.2; gloss = 40.0;
  } else {
    n = bumpN(p, n, 0.008, false);
    alb = LIL*vec3(0.78,0.76,0.86)*(0.86+0.2*vnoise(p*5.0+3.0));
    sss = 0.45;
  }

  // the floor only needs occlusion and shadow near the objects
  float dObj = mat < 0.5 ? mapO(p, 6.0).x : 0.0;
  float ao = (mat < 0.5 && dObj > 0.7) ? 1.0 : calcAO(p, ng);
  vec3 L1 = normalize(vec3(-0.5, 0.85, 0.55));
  vec3 kcol = vec3(1.0,0.93,0.84)*2.15;
  float pool = smoothstep(mat < 0.5 ? 10.5 : 13.0, 0.8, length(p.xz - vec2(0.6,0.0)));
  pool *= pool;
  float sh = (mat < 0.5 && t > 30.0) ? 1.0 : softShadow(p+ng*0.004, L1, 7.0, 6.5, mat < 0.5 ? 22 : 30);
  float ndl = dot(n, L1);
  vec3 col = vec3(0.0);
  vec3 V = -rd;
  float wrap = 0.38*sss;
  float dif = clamp((ndl+wrap)/(1.0+wrap), 0.0, 1.0);
  vec3 scat = mix(vec3(1.0), vec3(1.0,0.36,0.2), sss*(1.0-smoothstep(0.0,0.55,dif)));
  vec3 shcol = mix(vec3(sh), mix(vec3(0.62,0.2,0.12), vec3(1.0), sh)*max(sh,0.1), sss*0.8);
  col += alb*kcol*dif*scat*shcol*pool;
  vec3 H = normalize(L1+V);
  col += kcol*pool*sh*sheen*pow(max(dot(n,H),0.0), gloss)*max(ndl,0.0);
  if(mat > 1.5 && mat < 2.5) col += kcol*sh*2.0*pow(max(dot(n,H),0.0), 300.0);
  if(sss > 0.0){
    float thick = clamp(-map(p - ng*0.11).x/0.11, 0.0, 1.0);
    col += alb*vec3(1.0,0.4,0.25)*(1.0-thick)*0.5*sss*pool*(0.4+0.6*sh);
  }
  vec3 L2 = normalize(vec3(0.75, 0.25, 0.6));
  col += alb*vec3(0.36,0.33,0.7)*0.55*clamp((dot(n,L2)+0.5)/1.5,0.0,1.0)*ao*pool;
  col += alb*vec3(0.10,0.085,0.19)*(0.55+0.45*n.y)*ao;
  if(mat > 0.5){
    vec3 L3 = normalize(vec3(0.35, 0.55, -0.76));
    float rim = pow(clamp(1.0-dot(n,V),0.0,1.0), 2.6)*clamp(dot(n,L3)*0.6+0.5,0.0,1.0);
    col += (alb*0.7+0.03)*vec3(0.62,0.56,1.0)*1.5*rim*ao;
  }
  // the warm light of the swarm
  if(uWarmI > 0.001){
    vec3 Lv = uWarmP - p; float d2 = dot(Lv,Lv); Lv *= inversesqrt(d2);
    float nl = clamp((dot(n,Lv)+0.25*sss)/(1.0+0.25*sss), 0.0, 1.0);
    col += alb*vec3(1.0,0.58,0.3)*uWarmI*nl/(1.0+0.35*d2)*ao;
  }
  // the avatar ring's soft glow once the hero stands in it
  if(mat > 4.5 && mat < 5.5) col += alb*vec3(1.0,0.62,0.4)*uLogS.w*0.35;
  col += emis;
  col = mix(col, bg, 1.0-exp(-0.000018*t*t*t*t));
  col = tonemap(col);
  col = pow(col, vec3(1.0/2.2));
  col += (hash12(gl_FragCoord.xy + uFrame*17.0)-0.5)/255.0;
  outColor = vec4(col, 1.0);
  float zv = dot(p-ro, uCw);
  float ndc = (uFar+uNear)/(uFar-uNear) - 2.0*uFar*uNear/((uFar-uNear)*zv);
  gl_FragDepth = clamp(ndc*0.5+0.5, 0.0, 0.99999);
}
`;

const VS_BEAD = `#version 300 es
in vec2 aCorner;
in vec4 aPosR;
in vec4 aCol;
uniform vec3 uRo, uCu, uCv, uCw;
uniform float uTanH, uAspect, uNear, uFar, uGrow;
uniform vec3 uFit;
out vec2 vUv; out vec3 vCol; out float vZ; out float vR; out float vSeed;
void main(){
  vec3 d = aPosR.xyz - uRo;
  vec3 v = vec3(dot(d,uCu), dot(d,uCv), dot(d,uCw));
  float r = aPosR.w*uGrow;
  v.xy += aCorner*r;
  float A = (uFar+uNear)/(uFar-uNear), B = -2.0*uFar*uNear/(uFar-uNear);
  gl_Position = vec4((v.x/(uAspect*uTanH))*uFit.x + uFit.y*v.z, (v.y/uTanH)*uFit.x + uFit.z*v.z, A*v.z+B, v.z);
  vUv = aCorner; vCol = aCol.rgb; vZ = v.z; vR = aPosR.w; vSeed = aCol.a;
}
`;
const FS_BEAD = `#version 300 es
precision highp float;
in vec2 vUv; in vec3 vCol; in float vZ; in float vR; in float vSeed;
uniform vec3 uCu, uCv, uCw;
uniform float uNear, uFar, uGlowPass, uDim;
out vec4 outColor;
void main(){
  float r2 = dot(vUv,vUv);
  if(uGlowPass > 0.5){
    float a = exp(-r2*5.5)*0.02 + exp(-r2*26.0)*0.03;
    a *= smoothstep(1.0, 0.7, r2)*(0.55 + 0.45*uDim);
    outColor = vec4(vec3(1.0,0.40,0.17)*a, 1.0);
    return;
  }
  if(r2 > 1.0) discard;
  float nz = sqrt(1.0-r2);
  vec3 n = normalize(vUv.x*uCu + vUv.y*uCv - nz*uCw);
  vec3 L = normalize(vec3(-0.5,0.85,0.55));
  float dif = clamp(dot(n,L)*0.6+0.4, 0.0, 1.0);
  vec3 col = pow(vCol, vec3(2.2))*(0.62 + 0.7*dif);
  col += vec3(1.0,0.55,0.3)*pow(nz, 2.0)*0.26*uDim;
  col += vec3(1.0,0.95,0.9)*pow(max(dot(n, normalize(L - uCw)),0.0), 30.0)*0.18;
  col *= 0.7 + 0.3*uDim;
  col = clamp(col, 0.0, 0.92);
  outColor = vec4(pow(col, vec3(1.0/2.2)), 1.0);
  float zv = vZ - nz*vR;
  float ndc = (uFar+uNear)/(uFar-uNear) - 2.0*uFar*uNear/((uFar-uNear)*zv);
  gl_FragDepth = clamp(ndc*0.5+0.5, 0.0, 0.99999);
}
`;
const FS_FINAL = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform vec2 uOut;
uniform float uFrame;
out vec4 outColor;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 uv = gl_FragCoord.xy/uOut;
  vec2 px = 0.25/uOut;
  vec3 c = 0.25*(texture(uScene, uv+vec2(-px.x,-px.y)).rgb + texture(uScene, uv+vec2(px.x,-px.y)).rgb + texture(uScene, uv+vec2(-px.x,px.y)).rgb + texture(uScene, uv+vec2(px.x,px.y)).rgb);
  vec2 q = uv-0.5;
  float vig = 1.0 - 0.55*smoothstep(0.25, 0.95, length(q*vec2(1.0,0.82))*1.25);
  c *= vig;
  float g = hash12(gl_FragCoord.xy + uFrame*31.0) + hash12(gl_FragCoord.yx*1.7 + uFrame*13.0) - 1.0;
  c += g*(1.6/255.0);
  outColor = vec4(c, 1.0);
}
`;
window.__clayShaders = { VS_FULL, FS_SCENE, VS_BEAD, FS_BEAD, FS_FINAL };
})();
