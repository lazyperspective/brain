// 1000 Agents — clay / vinyl-toy style. Hand-written raymarched SDF renderer (raw WebGL2).
// All GLSL lives here; js/piece.js owns the timeline and the GL plumbing.
(function () {
'use strict';

const VS_FULL = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// ---------------------------------------------------------------- scene (raymarch)
const FS_SCENE = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform vec3  uRo, uCu, uCv, uCw;
uniform float uTanH, uNear, uFar, uFrame;

uniform vec3  uHPos;      // hero feet
uniform float uHYaw, uHLean, uHPitch;
uniform vec3  uHScale;
uniform vec2  uLook;
uniform float uBlink, uMouth, uArm;

uniform vec3  uFPos;      // folder base centre
uniform float uFYaw, uFOpen;
uniform vec3  uFScale;
uniform float uGlow;      // warm light inside the folder
uniform vec3  uFount;     // fountain light position
uniform float uFountI;
uniform sampler2D uLabel;

const float PI = 3.14159265;

// ---- hashing / noise
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i),               hash13(i+vec3(1,0,0)), f.x),
                 mix(hash13(i+vec3(0,1,0)),   hash13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i+vec3(0,0,1)),   hash13(i+vec3(1,0,1)), f.x),
                 mix(hash13(i+vec3(0,1,1)),   hash13(i+vec3(1,1,1)), f.x), f.y), f.z);
}

// ---- sdf helpers
float sdRBox(vec3 p, vec3 b, float r){
  vec3 q = abs(p)-b+r;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}
float sdCaps(vec3 p, vec3 a, vec3 b, float r){
  vec3 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa-ba*h)-r;
}
float sdRCyl(vec3 p, float ra, float rb, float h){
  vec2 d = vec2(length(p.xz)-ra+rb, abs(p.y)-h+rb);
  return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - rb;
}
float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.0)/k; return min(a,b)-h*h*k*0.25; }
float smax(float a, float b, float k){ return -smin(-a,-b,k); }

// ---- hero ------------------------------------------------------------
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
vec3 eyeC(float sx){ return vec3(sx*0.2 + uLook.x*0.055, 0.6 + uLook.y*0.04, 0.3); }
vec3 eyeR(){ return vec3(0.058, 0.066*(1.0-0.9*uBlink), 0.05); }
const vec3 MOUTH_C = vec3(0.0, 0.405, 0.33);
float mouthD(vec3 q){
  vec3 r = vec3(0.035+0.07*uMouth, 0.012+0.075*uMouth, 0.16);
  return (length((q-MOUTH_C)/r)-1.0)*min(r.x,r.y);
}
// returns (distance, material): 1 body, 2 eye, 3 mouth cavity
vec2 hero(vec3 q){
  float lump = 0.0045*sin(q.x*8.0+1.0)*sin(q.y*10.0+0.5)*sin(q.z*9.0+2.0)
             + 0.003*sin(q.x*19.0)*sin(q.y*17.0+2.0)*sin(q.z*21.0);
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
  if(uMouth > 0.01){
    float m = mouthD(q);
    body = smax(body, -m, 0.025);
    if(m < 0.012) mat = 3.0;
  }
  vec3 er = eyeR();
  vec3 e = vec3(abs(q.x - uLook.x*0.055) - 0.2, q.y - 0.6 - uLook.y*0.04, q.z - 0.3);
  float eye = (length(e/er)-1.0)*min(er.y, er.z);
  if(eye < body){ body = eye; mat = 2.0; }
  return vec2(body, mat);
}

// ---- folder ----------------------------------------------------------
vec3 folderLocal(vec3 p){
  p -= uFPos;
  float c = cos(uFYaw), s = sin(uFYaw);
  p = vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z);
  return p/uFScale;
}
vec3 flapLocal(vec3 q){
  vec3 f = q - vec3(0.0, 0.06, 0.075);
  float c = cos(uFOpen), s = sin(uFOpen);
  return vec3(f.x, c*f.y + s*f.z, -s*f.y + c*f.z);
}
// material 4 = folder
float folder(vec3 q){
  float lump = 0.004*sin(q.x*9.0+2.0)*sin(q.y*8.0+1.0) + 0.002*sin(q.x*23.0)*sin(q.y*19.0+q.z*20.0);
  float back = sdRBox(q-vec3(0.0,0.42,-0.075), vec3(0.58,0.40,0.05), 0.045);
  float tab  = sdRBox(q-vec3(-0.30,0.80,-0.075), vec3(0.24,0.13,0.05), 0.045);
  back = smin(back, tab, 0.06);
  vec3 f = flapLocal(q);
  float front = sdRBox(f-vec3(0.0,0.33,0.0), vec3(0.58,0.35,0.05), 0.045);
  float base = sdRBox(q-vec3(0.0,0.06,0.0), vec3(0.58,0.06,0.125), 0.05);
  float d = smin(min(back,front), base, 0.04);
  return d + lump;
}

// ---- backdrop (seamless cyclorama) -------------------------------------
float backdrop(vec3 p){
  return p.y;   // seamless: the floor simply dissolves into the dark
}

float gHS, gFS; // min scales
vec2 map(vec3 p){
  vec2 res = vec2(backdrop(p), 0.0);
  vec3 hc = uHPos + vec3(0.0,0.5,0.0);
  float bd = length(p-hc) - 1.0;
  if(bd < res.x){
    if(bd > 0.25){ res.x = min(res.x, bd); }
    else { vec2 h = hero(heroLocal(p)); h.x *= gHS; if(h.x < res.x) res = h; }
  }
  if(gFS > 0.03){
    vec3 fc = uFPos + vec3(0.0,0.45,0.0)*gFS;
    bd = length(p-fc) - 1.05*max(uFScale.x, uFScale.y);
    if(bd < res.x){
      if(bd > 0.25){ res.x = min(res.x, bd); }
      else { float f = folder(folderLocal(p))*gFS; if(f < res.x) res = vec2(f, 4.0); }
    }
  }
  return res;
}

vec3 calcNormal(vec3 p){
  const vec2 e = vec2(1.0,-1.0)*0.0012;
  return normalize(e.xyy*map(p+e.xyy).x + e.yyx*map(p+e.yyx).x + e.yxy*map(p+e.yxy).x + e.xxx*map(p+e.xxx).x);
}

float softShadow(vec3 ro, vec3 rd, float tmax, float k, int steps){
  float res = 1.0, t = 0.03;
  for(int i=0;i<40;i++){
    if(i >= steps) break;
    float h = map(ro+rd*t).x;
    res = min(res, k*h/t);
    t += clamp(h, 0.03, 0.35);
    if(res < 0.004 || t > tmax) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res*res*(3.0-2.0*res);
}
float calcAO(vec3 p, vec3 n){
  float occ = 0.0, sca = 1.0;
  for(int i=0;i<5;i++){
    float h = 0.015 + 0.11*float(i);
    occ += (h - map(p+n*h).x)*sca;
    sca *= 0.72;
  }
  return clamp(1.0 - 1.35*occ, 0.0, 1.0);
}

// thumbed clay: iso-lines of smooth noise read as fingerprint whorls, in patches
float clayH(vec3 q){
  float n = vnoise(q*2.3 + 7.0);
  float mask = smoothstep(0.50, 0.72, vnoise(q*1.7 + 31.0));
  float ridges = sin(n*58.0);
  float dents = vnoise(q*9.0);
  float grain = vnoise(q*70.0);
  return ridges*mask*0.11 + dents*1.1 + grain*0.07;
}
vec3 bumpN(vec3 p, vec3 n, float mat, float amt){
  const float e = 0.004;
  vec3 g;
  if(mat < 2.5){
    float h0 = clayH(heroLocal(p));
    g = vec3(clayH(heroLocal(p+vec3(e,0,0))), clayH(heroLocal(p+vec3(0,e,0))), clayH(heroLocal(p+vec3(0,0,e)))) - h0;
  } else {
    float h0 = clayH(folderLocal(p)+11.0);
    g = vec3(clayH(folderLocal(p+vec3(e,0,0))+11.0), clayH(folderLocal(p+vec3(0,e,0))+11.0), clayH(folderLocal(p+vec3(0,0,e))+11.0)) - h0;
  }
  g /= e;
  g -= n*dot(n,g);
  return normalize(n - g*amt);
}

vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 tonemap(vec3 x){
  x *= 1.0;
  return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0);
}

void main(){
  gHS = min(uHScale.x, min(uHScale.y, uHScale.z));
  gFS = min(uFScale.x, min(uFScale.y, uFScale.z));

  vec2 uv = (gl_FragCoord.xy/uRes)*2.0-1.0;
  vec3 rd = normalize(uv.x*uTanH*(uRes.x/uRes.y)*uCu + uv.y*uTanH*uCv + uCw);
  vec3 ro = uRo;

  float t = 0.5; vec2 h = vec2(0.0);
  for(int i=0;i<110;i++){
    h = map(ro+rd*t);
    if(h.x < 0.0006*t || t > 60.0) break;
    t += h.x*0.9;
  }
  vec3 p = ro+rd*t;
  float mat = h.y;
  vec3 n = mat < 0.5 ? vec3(0.0,1.0,0.0) : calcNormal(p);
  vec3 ng = n;

  // ---- material
  vec3 alb; float sheen = 0.1, gloss = 14.0, sss = 0.0; vec3 emis = vec3(0.0);
  vec3 CORAL = lin(vec3(0.851,0.467,0.341)), CLIGHT = lin(vec3(0.949,0.647,0.522)),
       CSHADE = lin(vec3(0.659,0.333,0.231)), CDARK = lin(vec3(0.431,0.165,0.102));
  if(mat < 0.5){
    // backdrop: deep indigo paper
    float g = vnoise(p*3.0)*0.5 + vnoise(p*40.0)*0.5;
    alb = lin(vec3(0.115,0.082,0.215))*(0.86+0.28*g);
    sheen = 0.03; gloss = 8.0;
  } else if(mat < 1.5){
    vec3 q = heroLocal(p);
    n = bumpN(p, n, mat, 0.0105);
    float v = vnoise(q*5.0+3.0);
    alb = mix(CORAL, CLIGHT, 0.16*v)*vec3(1.0,0.9,0.86);
    alb = mix(alb, CSHADE, 0.55*smoothstep(0.34, 0.02, q.y)*0.6);   // legs / belly a touch deeper
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
  } else {
    vec3 q = folderLocal(p);
    n = bumpN(p, n, mat, 0.009);
    vec3 LIL = lin(vec3(0.44,0.40,0.80));
    alb = LIL*(0.86+0.2*vnoise(q*5.0+9.0))*(0.94+0.1*vnoise(q*60.0));
    // "0 items" stamped into the front flap
    vec3 f = flapLocal(q);
    if(f.z > 0.02){
      vec2 luv = (f.xy - vec2(0.0, 0.3))/vec2(0.84, 0.21) + 0.5;
      if(luv.x > 0.0 && luv.x < 1.0 && luv.y > 0.0 && luv.y < 1.0){
        float a  = texture(uLabel, luv).r;
        float ax = texture(uLabel, luv+vec2(0.006,0.0)).r - texture(uLabel, luv-vec2(0.006,0.0)).r;
        float ay = texture(uLabel, luv+vec2(0.0,0.024)).r - texture(uLabel, luv-vec2(0.0,0.024)).r;
        alb = mix(alb, lin(vec3(0.90,0.87,1.0)), a*0.92);
        n = normalize(n + (uCu*ax - uCv*ay)*0.5);
      }
    }
    sss = 0.5;
  }

  float ao = calcAO(p, ng);

  // ---- lights
  vec3 L1 = normalize(vec3(-0.5, 0.85, 0.55));
  vec3 kcol = vec3(1.0,0.93,0.84)*2.15;
  float pool = smoothstep(mat < 0.5 ? 7.5 : 13.0, 0.8, length(p.xz - vec2(0.0,0.3)));
  pool *= pool;
  float sh = softShadow(p+ng*0.004, L1, 7.0, 6.5, 30);
  float ndl = dot(n, L1);
  vec3 col = vec3(0.0);
  vec3 V = -rd;

  // key, with wrap + warm terminator for the clay (cheap subsurface)
  float wrap = 0.38*sss;
  float dif = clamp((ndl+wrap)/(1.0+wrap), 0.0, 1.0);
  vec3 scat = mix(vec3(1.0), vec3(1.0,0.36,0.2), sss*(1.0-smoothstep(0.0,0.55,dif)));
  vec3 shcol = mix(vec3(sh), mix(vec3(0.62,0.2,0.12), vec3(1.0), sh)*max(sh,0.1), sss*0.8);
  col += alb*kcol*dif*scat*shcol*pool;
  vec3 H = normalize(L1+V);
  col += kcol*pool*sh*sheen*pow(max(dot(n,H),0.0), gloss)*max(ndl,0.0);
  if(mat > 1.5 && mat < 2.5) col += kcol*sh*2.0*pow(max(dot(n,H),0.0), 300.0);

  // thin-part translucency
  if(sss > 0.0){
    float thick = clamp(-map(p - ng*0.11).x/0.11, 0.0, 1.0);
    col += alb*vec3(1.0,0.4,0.25)*(1.0-thick)*0.5*sss*pool*(0.4+0.6*sh);
  }

  // cool fill from the right, lilac
  vec3 L2 = normalize(vec3(0.75, 0.25, 0.6));
  col += alb*vec3(0.36,0.33,0.7)*0.55*clamp((dot(n,L2)+0.5)/1.5,0.0,1.0)*ao*pool;
  // sky / ambient
  col += alb*vec3(0.10,0.085,0.19)*(0.55+0.45*n.y)*ao;
  // rim from behind
  if(mat > 0.5){
    vec3 L3 = normalize(vec3(0.35, 0.55, -0.76));
    float rim = pow(clamp(1.0-dot(n,V),0.0,1.0), 2.6)*clamp(dot(n,L3)*0.6+0.5,0.0,1.0);
    col += (alb*0.7+0.03)*vec3(0.62,0.56,1.0)*1.5*rim*ao;
  }

  // warm light from inside the folder + the fountain above it
  vec3 WARM = vec3(1.0,0.58,0.3);
  if(uGlow > 0.001){
    vec3 lp = uFPos + vec3(0.0,0.34,0.02)*uFScale;
    vec3 Lv = lp - p; float d2 = dot(Lv,Lv); Lv *= inversesqrt(d2);
    float nl = clamp(dot(n,Lv)*0.8+0.2, 0.0, 1.0);
    float leak = mat > 3.5 ? 1.0 : 0.16;
    col += alb*WARM*uGlow*4.2*nl*leak/(1.0+9.0*d2);
    if(mat > 3.5){
      // inner faces: glow by how enclosed / near the mouth the point is
      vec3 q = folderLocal(p);
      vec3 f = flapLocal(q);
      float inner = max(smoothstep(-0.05,-0.03,q.z)*step(f.z,-0.045), smoothstep(-0.03,-0.048,f.z)*step(-0.03,q.z));
      col += WARM*uGlow*inner*(0.45 + 1.5*smoothstep(0.85, 0.05, q.y));
    }
  }
  if(uFountI > 0.001){
    vec3 Lv = uFount - p; float d2 = dot(Lv,Lv); float d = sqrt(d2); Lv /= d;
    float nl = clamp((dot(n,Lv)+0.25*sss)/(1.0+0.25*sss), 0.0, 1.0);
    float s2 = softShadow(p+ng*0.004, Lv, d, 5.0, 18);
    col += alb*WARM*uFountI*8.5*nl*s2/(1.0+0.75*d2);
    col += WARM*uFountI*0.5*sheen*pow(max(dot(n,normalize(Lv+V)),0.0), gloss)*s2;
  }
  col += emis;

  // depth haze into the backdrop
  vec3 bg = lin(vec3(0.026,0.018,0.058)) + lin(vec3(0.115,0.07,0.21))*exp(-22.0*(rd.y-0.01)*(rd.y-0.01) - 2.2*rd.x*rd.x);
  col = mix(col, bg, 1.0-exp(-0.00009*t*t*t));

  col = tonemap(col);
  col = pow(col, vec3(1.0/2.2));
  col += (hash12(gl_FragCoord.xy + uFrame*17.0)-0.5)/255.0;
  outColor = vec4(col, 1.0);

  float zv = dot(p-ro, uCw);
  float ndc = (uFar+uNear)/(uFar-uNear) - 2.0*uFar*uNear/((uFar-uNear)*zv);
  gl_FragDepth = clamp(ndc*0.5+0.5, 0.0, 0.99999);
}
`;

// ---------------------------------------------------------------- beads (instanced impostor spheres)
const VS_BEAD = `#version 300 es
in vec2 aCorner;
in vec4 aPosR;     // xyz, radius
in vec4 aCol;      // rgb, seed
uniform vec3 uRo, uCu, uCv, uCw;
uniform float uTanH, uAspect, uNear, uFar, uGrow;
out vec2 vUv; out vec3 vCol; out float vZ; out float vR; out float vSeed;
void main(){
  vec3 d = aPosR.xyz - uRo;
  vec3 v = vec3(dot(d,uCu), dot(d,uCv), dot(d,uCw));
  float r = aPosR.w*uGrow;
  v.xy += aCorner*r;
  float A = (uFar+uNear)/(uFar-uNear), B = -2.0*uFar*uNear/(uFar-uNear);
  gl_Position = vec4(v.x/(uAspect*uTanH), v.y/uTanH, A*v.z+B, v.z);
  vUv = aCorner; vCol = aCol.rgb; vZ = v.z; vR = aPosR.w; vSeed = aCol.a;
}
`;
const FS_BEAD = `#version 300 es
precision highp float;
in vec2 vUv; in vec3 vCol; in float vZ; in float vR; in float vSeed;
uniform vec3 uCu, uCv, uCw;
uniform float uNear, uFar, uGlowPass;
out vec4 outColor;
void main(){
  float r2 = dot(vUv,vUv);
  if(uGlowPass > 0.5){
    float a = exp(-r2*5.5)*0.04 + exp(-r2*26.0)*0.06;
    a *= smoothstep(1.0, 0.7, r2);
    outColor = vec4(vec3(1.0,0.50,0.27)*a, 1.0);
    return;
  }
  if(r2 > 1.0) discard;
  float nz = sqrt(1.0-r2);
  vec3 n = normalize(vUv.x*uCu + vUv.y*uCv - nz*uCw);
  vec3 L = normalize(vec3(-0.5,0.85,0.55));
  float dif = clamp(dot(n,L)*0.6+0.4, 0.0, 1.0);
  // matte clay bead lit from within: hot core falling to coral at the limb
  vec3 col = pow(vCol, vec3(2.2))*(0.75 + 0.9*dif);
  col += vec3(1.0,0.55,0.3)*pow(nz, 2.0)*0.38;
  col += vec3(1.0,0.95,0.9)*pow(max(dot(n, normalize(L - uCw)),0.0), 30.0)*0.25;
  col = clamp(col, 0.0, 1.0);
  outColor = vec4(pow(col, vec3(1.0/2.2)), 1.0);
  float zv = vZ - nz*vR;
  float ndc = (uFar+uNear)/(uFar-uNear) - 2.0*uFar*uNear/((uFar-uNear)*zv);
  gl_FragDepth = clamp(ndc*0.5+0.5, 0.0, 0.99999);
}
`;

// ---------------------------------------------------------------- final (downsample, vignette, overlay, grain)
const FS_FINAL = `#version 300 es
precision highp float;
uniform sampler2D uScene, uOverlay;
uniform vec2 uOut;
uniform float uFrame, uOverlayA;
out vec4 outColor;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 uv = gl_FragCoord.xy/uOut;
  vec2 px = 0.25/uOut;
  vec3 c = 0.25*(texture(uScene, uv+vec2(-px.x,-px.y)).rgb + texture(uScene, uv+vec2(px.x,-px.y)).rgb
               + texture(uScene, uv+vec2(-px.x,px.y)).rgb  + texture(uScene, uv+vec2(px.x,px.y)).rgb);
  vec2 q = uv-0.5;
  float vig = 1.0 - 0.55*smoothstep(0.25, 0.95, length(q*vec2(1.0,0.82))*1.25);
  c *= vig;
  vec4 o = texture(uOverlay, vec2(uv.x, 1.0-uv.y));
  c = c*(1.0-o.a*uOverlayA) + o.rgb*uOverlayA;
  float g = hash12(gl_FragCoord.xy + uFrame*31.0) + hash12(gl_FragCoord.yx*1.7 + uFrame*13.0) - 1.0;
  c += g*(1.6/255.0);
  outColor = vec4(c, 1.0);
}
`;

window.__clayShaders = { VS_FULL, FS_SCENE, VS_BEAD, FS_BEAD, FS_FINAL };
})();
