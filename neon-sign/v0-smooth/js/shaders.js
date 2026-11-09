// GLSL for the piece. Build passes (once): the scene's geometry is rasterised at 2x and box-filtered down, in nine
// modes - base radiance, per-source sign light (two textures of four sources), per-source haze in-scatter (two),
// position, normal, coverage masks, switchable rooms. Frame passes (every t): emission, bloom chain, composite,
// reflections + rain + tone map.
(function () {
  const NS = window.NS || (window.NS = {});

  const COMMON = `
precision highp float;
precision highp int;
const float PI = 3.14159265;
uint hu(uint x){ x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
uint ui(float a){ return uint(int(floor(a)) + 65536); }
float h1(float a){ return float(hu(ui(a))) / 4294967295.0; }
float h2(vec2 p){ return float(hu(ui(p.x)*1973U + hu(ui(p.y)*9277U))) / 4294967295.0; }
float h3(vec3 p){ return float(hu(ui(p.x)*1973U + hu(ui(p.y)*9277U + hu(ui(p.z)*26699U)))) / 4294967295.0; }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
vec3 signCol(){ return vec3(0.47, 1.26, 0.0); }
`;

  // ---------------------------------------------------------------- build (geometry) pass
  const GEO_VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNrm; in float aMat; in vec4 aPrm;
uniform vec4 uProj; uniform vec2 uDepth;
out vec3 vPos; out vec3 vNrm; flat out int vMat; flat out vec4 vPrm;
invariant gl_Position;
void main(){
  vPos = aPos; vNrm = aNrm; vMat = int(aMat + 0.5); vPrm = aPrm;
  if (vMat == 0) { gl_Position = vec4(aPos.xy, 0.99999, 1.0); return; }
  gl_Position = vec4(uProj.x*aPos.x + uProj.y*aPos.z, uProj.z*aPos.y + uProj.w*aPos.z, uDepth.x*aPos.z + uDepth.y, aPos.z);
}`;

  const GEO_FS = `#version 300 es
${COMMON}
in vec3 vPos; in vec3 vNrm; flat in int vMat; flat in vec4 vPrm;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
layout(location = 3) out vec4 o3;
layout(location = 4) out vec4 o4;
uniform int uMode;            // 0: base, pos, normal, masks, rooms   1: S0-3, S4-7   2: I0-3, I4-7   3: depth only
uniform vec4 uCam;            // f, cx, cy, H (target pixels)
uniform vec4 uL[128];         // sign light sample points: xyz, weight
uniform ivec2 uRange[8];      // [start, end) per source
uniform vec3 uWL; uniform vec3 uWLdir;   // work light
uniform vec4 uDyn[4];         // switchable rooms: bay, floor, -, -
uniform float uCloudY;

struct Surf { vec3 alb; vec3 emis; float rough; float spec; float refl; float kind; vec3 n; float dyn[4]; float srough; };

vec2 faceUV(vec3 P, vec3 N){ if (abs(N.z) > 0.5) return P.xy; if (abs(N.x) > 0.5) return vec2(P.z, P.y); return P.xz; }
float box2(vec2 p, vec2 a, vec2 b){ return step(a.x, p.x)*step(p.x, b.x)*step(a.y, p.y)*step(p.y, b.y); }
// smooth box for antialiased procedural edges, w = filter width
float sbox(vec2 p, vec2 a, vec2 b, vec2 w){ vec2 s = smoothstep(a - w, a + w, p) * (1.0 - smoothstep(b - w, b + w, p)); return s.x*s.y; }
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// ---- lit hotel room behind the glass: lamp pools, sheer curtains with folds, blackout panels drawn to the sides
vec3 roomLight(vec2 w, vec2 cell, float seed, vec3 col){
  float a = h2(cell*1.7 + seed), b = h2(cell*3.1 + seed + 7.0), c = h2(cell*5.3 + seed + 13.0);
  float lampX = 0.15 + 0.7*a;
  float I = 0.32 + 0.95*exp(-pow((w.x-lampX)*2.4, 2.0) - pow((w.y-0.30)*2.0, 2.0)) + 0.22*smoothstep(0.55, 1.0, w.y);
  float sheer = step(0.3, b);
  float folds = 0.80 + 0.2*sin(w.x*PI*2.0*(7.0+3.0*c) + 2.0*sin(w.x*13.0 + c*6.0));
  I *= mix(1.0, folds, sheer);
  float cl = 0.08 + 0.3*c, cr = 0.06 + 0.3*fract(c*7.13);
  if (a > 0.82) { cl = 0.42; cr = 0.4; }
  float pnl = max(1.0 - smoothstep(cl - 0.015, cl + 0.015, w.x), smoothstep(1.0 - cr - 0.015, 1.0 - cr + 0.015, w.x));
  float pf = 0.5 + 0.5*sin(w.x*PI*2.0*11.0);
  vec3 lit = col * I;
  vec3 panel = col * (0.03 + 0.10*pf*pf) * (0.6 + 0.6*I);
  // a warm table-lamp shade silhouette in some rooms
  float shade = (c > 0.6 && sheer < 0.5) ? sbox(w, vec2(lampX-0.06, 0.18), vec2(lampX+0.06, 0.30), vec2(0.01)) : 0.0;
  lit += col * shade * 1.2;
  return mix(lit, panel, pnl);
}

vec3 roomColor(float h){
  if (h < 0.55) return vec3(1.0, 0.56, 0.24);     // 2700K
  if (h < 0.80) return vec3(1.0, 0.70, 0.42);     // 3300K
  if (h < 0.92) return vec3(0.95, 0.80, 0.62);    // 4000K
  return vec3(0.42, 0.55, 0.95);                  // tv glow
}

Surf blank(vec3 n){ Surf s; s.alb = vec3(0.1); s.emis = vec3(0); s.rough = 0.6; s.spec = 0.0; s.refl = 0.0; s.kind = 0.0; s.n = n; for (int i=0;i<4;i++) s.dyn[i]=0.0; s.srough = -1.0; return s; }

// streaky wet staining for masonry
float stain(vec2 uv){ return 0.75 + 0.25*vnoise(vec2(uv.x*2.3, uv.y*0.06)) + 0.12*(vnoise(vec2(uv.x*9.0, uv.y*0.25)) - 0.5); }

Surf hotel(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  vec2 uv = faceUV(P, N);
  if (prm.y > 1.5) { // projecting pier: dark brick with a stone face strip
    Surf q = blank(N);
    q.alb = vec3(0.13, 0.068, 0.046)*(0.85 + 0.25*vnoise(vec2(uv.x*4.6, uv.y*14.6)))*stain(uv);
    float strip = abs(N.z) > 0.5 ? 1.0 - smoothstep(0.16, 0.2, abs(fract((uv.x + 32.0)/6.4 + 0.5) - 0.5)*6.4) : 0.0;
    q.alb = mix(q.alb, vec3(0.27, 0.245, 0.21)*stain(uv + 3.0), strip);
    q.rough = 0.5; q.spec = 0.35;
    return q;
  }
  bool crown = prm.y > 0.5;
  float x0 = crown ? -30.5 : -32.0, bw = crown ? 3.05 : 3.2;
  float fy = (uv.y + 59.9)/3.3, fl = floor(fy), ly = (fy - fl)*3.3;
  float fx = (uv.x - x0)/bw, bay = floor(fx), lx = (fx - bay)*bw;
  float aa = max(fwidth(uv.x), 0.004);
  // masonry: dark brown brick with pale stone pilasters every bay
  float bk = vnoise(vec2(uv.x*4.6, uv.y*14.6))*0.25 + 0.88;
  vec3 brick = vec3(0.085, 0.046, 0.034)*bk*stain(uv);
  vec3 stone = vec3(0.24, 0.215, 0.185)*stain(uv + 3.0);
  float pil = 1.0 - smoothstep(0.32 - aa, 0.32 + aa, min(lx, bw - lx));
  vec3 wall = mix(brick, stone, pil);
  // spandrel: a stone-framed recessed panel between windows
  float spY = ly > 2.95 || ly < 0.6 ? 1.0 : 0.0;
  bool balc = !crown && (bay == 1.0 || bay == 2.0 || bay == 17.0 || bay == 18.0);
  float wx0 = 0.62, wx1 = bw - 0.62, wy0 = balc ? 0.08 : 0.95, wy1 = 2.92;
  if (crown) { wx0 = 0.7; wx1 = bw - 0.7; wy0 = 1.0; wy1 = 2.85; }
  s.alb = wall; s.rough = 0.55; s.spec = 0.35;
  // frieze line under each sill
  if (!balc && ly > 0.72 && ly < 0.86 && lx > wx0 - 0.15 && lx < wx1 + 0.15) s.alb = stone*1.05;
  // PTAC grille under the window
  if (!balc && !crown && lx > wx0 + 0.42 && lx < wx0 + 1.42 && ly > 0.30 && ly < 0.66) {
    float sl = 0.5 + 0.5*sin(ly*PI*2.0/0.045);
    s.alb = vec3(0.20, 0.20, 0.19)*(0.55 + 0.45*sl); s.spec = 0.4; s.rough = 0.4;
    s.alb *= 0.8 + 0.4*h2(vec2(bay, fl) + 3.0);
  }
  vec2 wp = vec2(lx, ly);
  float inWin = sbox(wp, vec2(wx0, wy0), vec2(wx1, wy1), vec2(aa*0.7));
  if (inWin > 0.0) {
    vec2 w = (wp - vec2(wx0, wy0)) / vec2(wx1 - wx0, wy1 - wy0);
    float fw = 0.06/(wx1 - wx0), fh = 0.06/(wy1 - wy0);
    float frame = 1.0 - sbox(w, vec2(fw, fh), vec2(1.0 - fw, 1.0 - fh), vec2(aa/(wx1-wx0)));
    float mull = 1.0 - smoothstep(0.012 - aa/(wx1-wx0), 0.012 + aa/(wx1-wx0), abs(w.x - 0.5));
    float trans = balc ? 1.0 - smoothstep(0.012, 0.02, abs(w.y - 0.80)) : 0.0;
    float metal = max(frame, max(mull, trans));
    vec2 cell = vec2(bay + (crown ? 40.0 : 0.0), fl);
    float hl = h2(cell*1.31 + 5.0);
    bool lit = hl < (crown ? 0.13 : 0.15);
    bool dynHere = false;
    for (int i = 0; i < 4; i++) if (!crown && abs(uDyn[i].x - bay) < 0.5 && abs(uDyn[i].y - fl) < 0.5) { dynHere = true; }
    vec3 glass;
    // dark room: glass holds a dim reflection of the overcast and the far city, and the curtain behind it
    float g = 0.5 + 0.5*vnoise(vec2(bay*3.7, fl*2.1));
    glass = vec3(0.006, 0.008, 0.013)*(0.6 + 0.8*g)*(0.7 + 0.6*w.y);
    s.spec = 0.9; s.rough = 0.08;
    if (lit && !dynHere) glass = roomLight(w, cell, 1.0, roomColor(h2(cell + 11.0))) * (0.22 + 0.95*pow(h2(cell + 21.0), 1.5));
    if (dynHere) {
      for (int i = 0; i < 4; i++) if (abs(uDyn[i].x - bay) < 0.5 && abs(uDyn[i].y - fl) < 0.5) s.dyn[i] = lum(roomLight(w, cell, 2.0, vec3(1.0))) * inWin * (1.0 - metal);
    }
    s.emis = glass * inWin * (1.0 - metal);
    s.alb = mix(s.alb, vec3(0.035, 0.032, 0.03), inWin*metal);
    s.alb *= 1.0 - inWin*(1.0 - metal)*0.9;
  }
  return s;
}

Surf stoneS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  vec2 uv = faceUV(P, N);
  s.alb = vec3(0.30, 0.275, 0.235)*stain(uv*1.3)*(0.9 + 0.2*vnoise(uv*3.0));
  if (prm.x == 4.0 && abs(N.z) > 0.5) { // deco fins: fluted
    float fl = 0.5 + 0.5*cos(uv.x*PI*2.0/0.32);
    s.alb *= 0.8 + 0.25*fl;
  }
  if (prm.x == 7.0) s.alb = vec3(0.16, 0.14, 0.12)*stain(uv);
  if (N.y > 0.5) { s.rough = 0.12; s.spec = 1.0; s.alb *= 0.6; } else { s.rough = 0.45; s.spec = 0.4; }
  return s;
}

Surf steelS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  float r = vnoise(P.xy*vec2(2.0, 0.7) + P.z) ;
  s.alb = vec3(0.11, 0.115, 0.118)*(prm.x/0.32)*(0.85 + 0.3*r);
  if (prm.y == 1.0) s.alb = vec3(0.26, 0.27, 0.27)*(0.8 + 0.4*r);
  s.alb = mix(s.alb, vec3(0.11, 0.06, 0.035), smoothstep(0.62, 0.8, vnoise(P.xy*vec2(5.0, 0.9) + 31.0))*0.7);  // rust runs
  s.rough = 0.28; s.spec = 0.8;
  if (N.y > 0.5) { s.rough = 0.12; s.spec = 1.0; }
  return s;
}

Surf tankS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  vec3 c = vec3(prm.x, P.y, prm.y);
  vec3 d = P - c; s.n = normalize(vec3(d.x, 0.0, d.z));
  float ang = atan(d.z, d.x), arc = ang*prm.z;
  float stave = floor(arc/0.13);
  float aa = max(fwidth(arc), 0.002);
  float gap = 1.0 - smoothstep(0.004, 0.004 + aa, abs(fract(arc/0.13) - 0.5)*0.13 - 0.0605) ;
  vec3 wood = vec3(0.20, 0.135, 0.085)*(0.75 + 0.5*h1(stave + prm.w*100.0))*(0.8 + 0.3*vnoise(vec2(arc*8.0, P.y*0.6)));
  wood *= 0.55 + 0.45*smoothstep(0.0, 1.0, vnoise(vec2(arc*1.3, P.y*0.4)));   // wet dark patches
  float yy = P.y - 19.05;
  float sp = 0.32 + 0.06*yy;
  float hoop = 1.0 - smoothstep(0.025, 0.025 + max(fwidth(P.y), 0.003), abs(fract(yy/sp) - 0.5)*sp - (sp*0.5 - 0.04));
  s.alb = mix(wood*(1.0 - 0.6*gap), vec3(0.07, 0.065, 0.06), hoop);
  s.rough = mix(0.35, 0.22, hoop); s.spec = mix(0.6, 1.0, hoop);
  return s;
}

Surf metalS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  vec2 uv = faceUV(P, N);
  s.alb = vec3(0.17, 0.175, 0.18)*(prm.x/0.4)*(0.85 + 0.3*vnoise(uv*2.0));
  s.rough = 0.25; s.spec = 0.9;
  if (prm.y == 1.0) { // conical roof: radial sheet seams
    float a = atan(P.z - 0.0, P.x); s.alb *= 0.9 + 0.1*sin(a*40.0);
  }
  if (prm.y == 2.0 && abs(N.z) > 0.5) { float sl = 0.5 + 0.5*sin(uv.y*PI*2.0/0.06); s.alb *= 0.55 + 0.45*sl; }
  if (prm.y == 3.0) { float seam = 1.0 - smoothstep(0.0, 0.02, abs(fract(uv.x/0.6) - 0.5) - 0.48); s.alb *= 1.0 - 0.4*seam; }
  return s;
}

Surf roomWallS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  vec2 uv = faceUV(P, N);
  s.alb = vec3(0.13, 0.125, 0.12)*stain(uv*1.5);
  s.rough = 0.5; s.spec = 0.3;
  if (N.x < -0.5) { // louvre on the face turned to the sign
    float l = sbox(uv, vec2(104.6, 18.0), vec2(107.8, 20.6), vec2(0.01));
    float sl = 0.5 + 0.5*sin(uv.y*PI*2.0/0.09);
    s.alb = mix(s.alb, vec3(0.16)*(0.4 + 0.6*sl), l); s.spec = mix(s.spec, 0.8, l);
  }
  if (N.z < -0.5) { // steel door and a caged bulb over it
    float dr = sbox(uv, vec2(28.4, 16.0), vec2(29.6, 18.6), vec2(0.01));
    s.alb = mix(s.alb, vec3(0.06, 0.09, 0.08), dr);
    float bulb = 1.0 - smoothstep(0.05, 0.09, length(uv - vec2(29.0, 19.25)));
    s.emis += vec3(1.0, 0.62, 0.30)*6.0*bulb;
  }
  return s;
}

Surf glassS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  vec2 uv = faceUV(P, N);           // (z, y) on the face turned to us
  float pw = 1.5, fh = 4.0;
  float pz = floor(uv.x/pw), fl = floor((uv.y + 64.0)/fh);
  float lz = fract(uv.x/pw), ly = fract((uv.y + 64.0)/fh);
  float aa = max(fwidth(uv.x/pw), 0.002), aay = max(fwidth(uv.y/fh), 0.002);
  float mull = 1.0 - smoothstep(0.025 - aa, 0.025 + aa, min(lz, 1.0 - lz));
  float spand = smoothstep(0.74 - aay, 0.74 + aay, ly);
  float trans = 1.0 - smoothstep(0.012 - aay, 0.012 + aay, min(ly, 1.0 - ly));
  // each pane slightly out of plane (oil-canning): reflections break between panes
  float hz = h2(vec2(pz, fl) + 77.0) - 0.5, hy = h2(vec2(pz, fl) + 91.0) - 0.5;
  s.n = normalize(N + vec3(0.0, 0.014*hy, 0.05*hz));
  // offices: a few floors still lit, fluorescent rows on the ceiling, a dim interior below
  float lit = step(h2(vec2(fl, 3.0)), 0.09) * step(0.25, h2(vec2(floor(pz/6.0), fl) + 5.0));
  vec3 office = vec3(0.70, 0.82, 0.95)*(0.10 + 0.55*smoothstep(0.55, 0.72, ly)*(0.6 + 0.4*sin(lz*PI)) + 0.6*(1.0 - smoothstep(0.0, 0.03, abs(ly - 0.69))));
  vec3 vision = mix(vec3(0.003, 0.004, 0.006), office*0.22, lit);
  s.emis = vision*(1.0 - spand)*(1.0 - mull)*(1.0 - trans);
  s.alb = mix(vec3(0.010, 0.013, 0.018), vec3(0.05, 0.055, 0.065), max(mull, trans));
  s.alb = mix(s.alb, vec3(0.012, 0.016, 0.022), spand*(1.0 - mull));
  s.kind = 1.0; s.rough = 0.02; s.spec = 0.0;
  s.refl = mix(0.24, 0.08, max(mull, trans));
  return s;
}

Surf brickS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  vec2 uv = faceUV(P, N);
  float row = floor(uv.y/0.0762);
  float bx = (uv.x + 0.5*mod(row, 2.0)*0.2)/0.203;
  float aa = max(fwidth(uv.y/0.0762), 0.01);
  float mort = 1.0 - smoothstep(0.08, 0.08 + aa, min(fract(uv.y/0.0762), 1.0 - fract(uv.y/0.0762)));
  vec3 br = vec3(0.095, 0.048, 0.034)*(0.8 + 0.4*h2(vec2(floor(bx), row)));
  br = mix(br, vec3(0.10, 0.09, 0.085), mort*(1.0 - smoothstep(0.2, 0.5, aa)));
  br *= stain(uv*0.8);
  s.alb = br; s.rough = 0.5; s.spec = 0.3;
  // sash windows with roller shades
  float bw = 2.75, fh = 3.35;
  float bay = floor((uv.x - 60.0)/bw), lx = fract((uv.x - 60.0)/bw)*bw;
  float fl = floor((uv.y + 64.0)/fh), ly = fract((uv.y + 64.0)/fh)*fh;
  float faa = max(fwidth(uv.x), 0.004);
  float inW = sbox(vec2(lx, ly), vec2(0.8, 1.0), vec2(1.95, 2.75), vec2(faa));
  if (inW > 0.0) {
    vec2 w = (vec2(lx, ly) - vec2(0.8, 1.0))/vec2(1.15, 1.75);
    float frame = 1.0 - sbox(w, vec2(0.06, 0.05), vec2(0.94, 0.95), vec2(faa));
    float rail = 1.0 - smoothstep(0.02, 0.035, abs(w.y - 0.5));
    vec2 cell = vec2(bay, fl) + 300.0;
    bool lit = h2(cell) < 0.32;
    float shade = 0.25 + 0.6*h2(cell + 4.0);
    vec3 c = lit ? roomColor(h2(cell + 8.0)*0.85)*(0.25 + 0.35*h2(cell + 2.0)) : vec3(0.004, 0.005, 0.008);
    c *= w.y > 1.0 - shade ? (lit ? 0.55 : 1.0) : 1.0;
    float m = max(frame, rail);
    s.emis = c*inW*(1.0 - m);
    s.alb = mix(s.alb, vec3(0.06, 0.055, 0.05), inW*m);
    s.alb *= 1.0 - inW*(1.0 - m)*0.9;
  }
  return s;
}

Surf farS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  vec2 uv = faceUV(P, N);
  float seed = prm.x;
  float bw = 3.0 + 1.5*h1(seed), fh = 3.4 + 0.6*h1(seed + 3.0);
  vec2 g = vec2(uv.x/bw, (uv.y + 70.0)/fh) + h1(seed + 5.0)*10.0;
  vec2 cell = floor(g), f = fract(g);
  float fw = max(fwidth(g.x), fwidth(g.y));
  float win = sbox(f, vec2(0.18, 0.25), vec2(0.82, 0.8), vec2(fw*0.6));
  float clusters = smoothstep(0.35, 0.65, vnoise(cell*vec2(0.25, 0.15) + seed));
  float lit = step(h2(cell + seed*13.0), prm.y*(0.25 + 0.9*clusters));
  vec3 c = roomColor(h2(cell + seed*7.0)*0.95)*(0.12 + 0.3*h2(cell + seed));
  float fade = smoothstep(0.35, 0.9, fw);   // too small to resolve: the average
  vec3 detail = c*lit*win;
  vec3 avg = roomColor(0.4)*0.21*prm.y*0.7*0.4;
  s.emis = mix(detail, avg, fade);
  s.alb = vec3(0.03, 0.032, 0.036);
  if (prm.z > 0.5 && uv.y > 0.0) { // a lit crown band near the top of some towers
    float top = P.y;
    s.emis += vec3(0.9, 0.75, 0.55)*0.12*smoothstep(0.0, 1.0, vnoise(vec2(uv.x*0.5, seed)))*0.0;
  }
  s.rough = 0.4; s.spec = 0.2;
  return s;
}

Surf roofS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  if (N.y < 0.5) { s.alb = vec3(0.05); return s; }
  vec2 uv = P.xz;
  float n = fbm(uv*vec2(0.22, 0.35) + 3.0);
  float n2 = vnoise(uv*1.7);
  float pv = n + 0.04*n2;
  float puddle = smoothstep(0.56, 0.585, pv);
  float margin = smoothstep(0.47, 0.56, pv);           // soaked, darker ground around each puddle
  // membrane: dark granular cap sheet with seams and patches
  vec3 tar = vec3(0.026, 0.027, 0.029)*(0.8 + 0.4*vnoise(uv*0.9))*(0.85 + 0.3*n2);
  float aa = max(fwidth(uv.x), 0.004);
  float seam = 1.0 - smoothstep(0.02, 0.02 + aa*2.0, abs(fract(uv.x/1.0) - 0.5) - 0.47);
  tar = mix(tar, vec3(0.045), seam*0.6);
  s.alb = tar*(1.0 - 0.45*margin)*(1.0 - 0.5*puddle);
  float sheen = smoothstep(0.25, 0.75, vnoise(uv*vec2(0.6, 1.4) + 9.0));
  s.srough = mix(0.42, 0.24, max(sheen*0.7, margin));
  s.spec = 0.10*(0.4 + 0.6*sheen + 0.8*margin)*(1.0 - puddle);
  s.rough = mix(0.45, 0.012, puddle);
  s.kind = puddle > 0.5 ? 2.0 : 0.0;
  s.refl = mix(0.05 + 0.1*margin, 1.0, puddle);
  return s;
}

Surf concreteS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  vec2 uv = faceUV(P, N);
  s.alb = vec3(0.14, 0.135, 0.13)*(0.8 + 0.3*vnoise(uv*3.0));
  s.rough = N.y > 0.5 ? 0.2 : 0.5; s.spec = 0.6;
  return s;
}

Surf balconyS(vec3 P, vec3 N, vec4 prm){
  Surf s = blank(N);
  vec2 uv = faceUV(P, N);
  s.alb = vec3(0.28, 0.255, 0.22)*stain(uv*1.2);
  if (prm.x == 1.0 && N.z < -0.5) { // fluted deco front with a band
    float fl = 0.5 + 0.5*cos(uv.x*PI*2.0/0.22);
    s.alb *= 0.78 + 0.28*fl;
  }
  s.rough = 0.45; s.spec = 0.35;
  return s;
}

Surf surface(vec3 P, vec3 N){
  Surf s;
  if (vMat == 1) s = hotel(P, N, vPrm);
  else if (vMat == 2) s = stoneS(P, N, vPrm);
  else if (vMat == 3) s = steelS(P, N, vPrm);
  else if (vMat == 4) { s = blank(N); s.alb = vec3(0.25, 0.30, 0.22); s.kind = 3.0; s.rough = 0.15; s.spec = 0.3; }
  else if (vMat == 5) { s = blank(N); s.alb = vec3(0.045, 0.055, 0.05)*(0.85 + 0.3*vnoise(P.xy*3.0)); s.rough = 0.3; s.spec = 0.6; }
  else if (vMat == 6) { s = blank(N); vec2 uv = faceUV(P, N); float b = 0.5 + 0.5*sin(uv.x*PI*2.0/0.04); s.alb = vec3(0.06, 0.065, 0.065)*(0.7 + 0.4*b); s.rough = 0.35; s.spec = 0.6; }
  else if (vMat == 7) s = tankS(P, N, vPrm);
  else if (vMat == 8) s = metalS(P, N, vPrm);
  else if (vMat == 9) s = roomWallS(P, N, vPrm);
  else if (vMat == 10) s = glassS(P, N, vPrm);
  else if (vMat == 11) s = brickS(P, N, vPrm);
  else if (vMat == 12) s = farS(P, N, vPrm);
  else if (vMat == 13) s = roofS(P, N, vPrm);
  else if (vMat == 14) s = concreteS(P, N, vPrm);
  else if (vMat == 15) s = balconyS(P, N, vPrm);
  else if (vMat == 16) { s = blank(N); s.alb = vec3(0.1); s.emis = vec3(1.0, 0.70, 0.42)*14.0; }
  else { s = blank(N); s.alb = vec3(0.025); s.rough = 0.25; s.spec = 0.7; }
  return s;
}

// ambient light of the city at night: an overcast sky lit from below, sodium from the street far below
vec3 ambient(vec3 P, vec3 N){
  float up = 0.5 + 0.5*N.y;
  vec3 sky = vec3(0.0030, 0.0038, 0.0068)*up;
  float street = 0.14*exp(-(P.y + 5.0)/10.5);
  vec3 sod = vec3(1.0, 0.46, 0.13)*street*(0.25 + 0.75*(0.5 - 0.5*N.y));
  vec3 bounce = vec3(0.0016, 0.0017, 0.0022);
  return sky + sod + bounce;
}
// haze between the camera and a point: thicker and warmer low down
vec3 fogColor(vec3 d){
  vec3 low = vec3(0.048, 0.026, 0.014), mid = vec3(0.016, 0.016, 0.022);
  return mix(low, mid, smoothstep(-0.10, 0.20, d.y));
}
float transmit(float dist){ return exp(-dist*0.0010 - max(dist - 300.0, 0.0)*0.0011); }

// light sample points: lobe of a diffuser face pointing at -z
float lobe(float c){ return c > 0.0 ? 0.10 + 0.90*c : 0.03*(1.0 + c); }

float signLight(vec3 P, vec3 N, vec3 V, Surf s, int k){
  float acc = 0.0;
  float sr = s.srough >= 0.0 ? s.srough : s.rough;
  float a0 = max(sr*sr, 0.002);
  float albG = dot(s.alb, vec3(0.20, 0.80, 0.0));
  for (int i = uRange[k].x; i < uRange[k].y; i++) {
    vec4 L = uL[i];
    vec3 d = L.xyz - P; float d2 = dot(d, d), dist = sqrt(d2);
    vec3 l = d/dist;
    float ndl = dot(N, l);
    if (ndl <= 0.0) continue;
    float E = L.w*lobe(l.z)/(d2 + 1.2);
    float diff = albG*ndl/PI;
    float spec = 0.0;
    if (s.kind < 0.5 && s.spec > 0.0) {
      float a = clamp(a0 + 0.55/dist, 0.0, 1.0);
      vec3 h = normalize(l + V);
      float ndh = max(dot(N, h), 0.0), ndv = max(dot(N, V), 0.02);
      float a2 = a*a, dd = ndh*ndh*(a2 - 1.0) + 1.0;
      float D = a2/(PI*dd*dd);
      float F = 0.04 + 0.96*pow(1.0 - max(dot(h, V), 0.0), 5.0);
      float Vis = 0.5/(ndl*sqrt(ndv*ndv*(1.0 - a2) + a2) + ndv*sqrt(ndl*ndl*(1.0 - a2) + a2));
      spec = s.spec*D*F*Vis*ndl;
    }
    acc += E*(diff + spec);
  }
  return acc;
}

// in-scatter of one source along the view ray (unit dir d) up to distance Dm (closed form for 1/(r^2+r0^2))
float inscatter(vec3 d, float Dm, int k){
  float acc = 0.0;
  for (int i = uRange[k].x; i < uRange[k].y; i++) {
    vec4 L = uL[i];
    float s0 = dot(d, L.xyz);
    float hh = dot(L.xyz, L.xyz) - s0*s0 + 2.0;
    float h = sqrt(max(hh, 1e-3));
    float I = (atan((Dm - s0)/h) + atan(s0/h))/h;
    vec3 c = s0*d - L.xyz; float cl = length(c);
    vec3 dl = cl > 1e-3 ? c/cl : -d;
    float cosT = dot(dl, -d);          // scattering angle at the closest point
    float g = 0.35, ph = (1.0 - g*g)/pow(1.0 + g*g - 2.0*g*cosT, 1.5);
    acc += L.w*lobe(-dl.z)*ph*I*exp(-max(s0, 0.0)*0.0006)*exp(-h*0.12);
  }
  return acc;
}
float cloudLight(vec3 H, int k){
  float acc = 0.0;
  for (int i = uRange[k].x; i < uRange[k].y; i++) {
    vec4 L = uL[i];
    vec3 d = H - L.xyz; float d2 = dot(d, d); vec3 l = d*inversesqrt(d2);
    acc += L.w*(0.35 + 0.65*lobe(-l.z))*max(l.y, 0.0)/(d2 + 400.0)*exp(-sqrt(d2)*0.008);
  }
  return acc;
}

void main(){
  o0 = vec4(0); o1 = vec4(0); o2 = vec4(0); o3 = vec4(0); o4 = vec4(0);
  if (uMode == 3) return;
  vec3 P = vPos, Ng = normalize(vNrm);
  bool sky = vMat == 0;
  vec3 dir;
  if (sky) {
    float fy = uCam.w - gl_FragCoord.y;
    dir = normalize(vec3((gl_FragCoord.x - uCam.y)/uCam.x, (uCam.z - fy)/uCam.x, 1.0));
    float Dm = dir.y > 0.01 ? min(uCloudY/dir.y, 2600.0) : 2600.0;
    vec3 H = dir*Dm;
    if (uMode == 0) { o1 = vec4(dir*5000.0, 0.0); o2 = vec4(0.0, 0.0, -1.0, 1.0); o3 = vec4(0.0, 1.0, 0.0, 0.0); return; }
    if (uMode == 2) {
      vec4 a = vec4(0), b = vec4(0);
      for (int j = 0; j < 8; j++) {
        float v = inscatter(dir, Dm, j);
        if (dir.y > 0.01) v += 30.0*cloudLight(H, j)*exp(-Dm*0.0009);
        if (j < 4) a[j] = v; else b[j - 4] = v;
      }
      o0 = a; o1 = b;
    }
    return;
  }
  if (dot(Ng, P) > 0.0 && vMat != 7) Ng = -Ng;   // two-sided safety
  dir = normalize(P);
  vec3 V = -dir;
  float dist = length(P);
  float T = transmit(dist);
  if (uMode == 2) {
    vec4 a = vec4(0), b = vec4(0);
    for (int j = 0; j < 8; j++) { float v = inscatter(dir, dist, j); if (j < 4) a[j] = v; else b[j - 4] = v; }
    o0 = a; o1 = b;
    return;
  }
  if (uMode == 1 && P.z > 160.0) return;
  Surf s = surface(P, Ng);
  vec3 N = s.n;
  if (uMode == 0) {
    vec3 c = s.alb*ambient(P, N) + s.emis;
    c += s.spec*(0.04 + 0.5*pow(1.0 - max(dot(N, V), 0.0), 5.0))*vec3(0.010, 0.011, 0.016)*(0.5 + 0.5*N.y);
    vec3 wd = uWL - P; float w2 = dot(wd, wd); vec3 wl = wd*inversesqrt(w2);
    if (vMat != 16) c += vec3(1.0, 0.66, 0.36)*0.55*max(dot(N, wl), 0.0)/(w2 + 0.02)*s.alb;
    // floodlit crown: a row of warm uplights on the cornice ledge, scalloping up the top two floors and the fins
    if (P.y > 9.55 && P.y < 21.0 && P.z < 103.0 && abs(P.x) < 31.2) {
      float i0 = floor((P.x + 30.5)/3.05);
      for (int j = -1; j <= 1; j++) {
        vec3 lp = vec3((i0 + 0.5 + float(j))*3.05 - 30.5, 9.8, 100.35);
        vec3 ld = lp - P; float l2 = dot(ld, ld); vec3 ll = ld*inversesqrt(l2);
        float up = smoothstep(0.0, 0.5, -ll.y);
        c += vec3(1.0, 0.56, 0.24)*1.5*up*max(dot(N, ll), 0.0)/(l2 + 0.3)*s.alb;
      }
    }
    vec3 bd = vec3(29.0, 19.25, 103.1) - P; float b2 = dot(bd, bd);
    c += vec3(1.0, 0.62, 0.30)*0.25*max(dot(N, bd*inversesqrt(b2)), 0.0)/(b2 + 0.05)*s.alb;
    c = c*T + fogColor(dir)*(1.0 - T);
    // rain mist between us and everything past our roof: a cool veil that lifts the darks a little with distance
    float veil = (1.0 - exp(-max(dist - 25.0, 0.0)*0.0028));
    c = mix(c, vec3(0.0085, 0.0100, 0.0140), veil*0.55);
    // street glow in the haze of the canyons: strongest low down, only over distance
    c += vec3(1.0, 0.42, 0.12)*0.045*exp(-max(P.y + 9.0, 0.0)/6.0)*smoothstep(35.0, 110.0, dist);
    o0 = vec4(c, 1.0);
    o1 = vec4(P, s.kind);
    o2 = vec4(N, s.rough);
    float F = s.kind == 1.0 ? 0.07 + 0.93*pow(1.0 - max(dot(N, V), 0.0), 5.0) : 0.02 + 0.98*pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float refl = (s.kind == 1.0 || s.kind == 2.0 || vMat == 13) ? s.refl*F*T : 0.0;
    o3 = vec4(s.kind == 3.0 ? 1.0 : 0.0, 0.0, refl, 0.0);
    o4 = vec4(s.dyn[0], s.dyn[1], s.dyn[2], s.dyn[3])*T;
    return;
  }
  if (uMode == 1) {
    if (s.kind > 2.5 || P.z > 160.0) return;   // faces are emitters; far behind the sign the leak is nil
    vec4 a = vec4(0), b = vec4(0);
    for (int j = 0; j < 8; j++) { float v = signLight(P, N, V, s, j)*T; if (j < 4) a[j] = v; else b[j - 4] = v; }
    o0 = a; o1 = b;
    return;
  }
  if (uMode == 2) {
    vec4 a = vec4(0), b = vec4(0);
    for (int j = 0; j < 8; j++) { float v = inscatter(dir, dist, j); if (j < 4) a[j] = v; else b[j - 4] = v; }
    o0 = a; o1 = b;
    return;
  }
}`;

  // ---------------------------------------------------------------- full-screen passes
  const QUAD_VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const DOWN2_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform int uSS;
void main(){ ivec2 p = ivec2(gl_FragCoord.xy)*uSS; vec4 s = vec4(0);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) if (i < uSS && j < uSS) s += texelFetch(uSrc, p + ivec2(i, j), 0);
  o = s/float(uSS*uSS); }`;

  // bloom: downsample (13-tap) and upsample (tent) passes
  const BDOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel;
void main(){
  vec2 t = uTexel;
  vec4 a = texture(uSrc, vUv + t*vec2(-2,-2)), b = texture(uSrc, vUv + t*vec2(0,-2)), c = texture(uSrc, vUv + t*vec2(2,-2));
  vec4 d = texture(uSrc, vUv + t*vec2(-2,0)), e = texture(uSrc, vUv), f = texture(uSrc, vUv + t*vec2(2,0));
  vec4 g = texture(uSrc, vUv + t*vec2(-2,2)), h = texture(uSrc, vUv + t*vec2(0,2)), i = texture(uSrc, vUv + t*vec2(2,2));
  vec4 j = texture(uSrc, vUv + t*vec2(-1,-1)), k = texture(uSrc, vUv + t*vec2(1,-1)), l = texture(uSrc, vUv + t*vec2(-1,1)), m = texture(uSrc, vUv + t*vec2(1,1));
  o = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
}`;
  const BUP_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform sampler2D uCur; uniform vec2 uTexel; uniform float uW;
void main(){
  vec2 t = uTexel;
  vec4 s = texture(uSrc, vUv)*4.0;
  s += (texture(uSrc, vUv + vec2(-t.x, 0)) + texture(uSrc, vUv + vec2(t.x, 0)) + texture(uSrc, vUv + vec2(0, -t.y)) + texture(uSrc, vUv + vec2(0, t.y)))*2.0;
  s += texture(uSrc, vUv + vec2(-t.x, -t.y)) + texture(uSrc, vUv + vec2(t.x, -t.y)) + texture(uSrc, vUv + vec2(-t.x, t.y)) + texture(uSrc, vUv + vec2(t.x, t.y));
  o = s/16.0 + texture(uCur, vUv)*uW;
}`;

  // per-frame emission: the faces (from the painted channels) times their brightness, plus the beacons
  const EMIT_FS = `#version 300 es
${COMMON}
in vec2 vUv; out vec4 o;
uniform sampler2D uEm0, uEm1, uMask, uPos;
uniform vec4 uB0, uB1; uniform float uEmit;
uniform vec4 uBc[8]; uniform vec4 uBcI[8]; uniform int uNB; uniform vec4 uCam; uniform vec2 uRes;
vec3 colorize(float I){
  vec3 g = signCol()*I;
  vec3 hot = vec3(0.50, 0.55, 0.16)*pow(max(I - 0.70, 0.0), 1.5)*3.0;
  return (g + hot)*uEmit;
}
void main(){
  vec4 e0 = texture(uEm0, vUv), e1 = texture(uEm1, vUv);
  float cov = texture(uMask, vUv).r;
  vec3 c = vec3(0.0);
  if (cov > 0.0) {
    c += colorize(e0.r*uB0.x) + colorize(e0.g*uB0.y) + colorize(e0.b*uB0.z) + colorize(e0.a*uB0.w);
    c += colorize(e1.r*uB1.x) + colorize(e1.g*uB1.y) + colorize(e1.b*uB1.z) + colorize(e1.a*uB1.w);
    c *= cov;
  }
  // beacons: small red discs, hidden by anything nearer
  vec2 px = vUv*uRes;
  for (int i = 0; i < 8; i++) {
    if (i >= uNB) break;
    vec3 p = uBc[i].xyz;
    vec2 sp = vec2(uCam.y + uCam.x*p.x/p.z, uRes.y - (uCam.z - uCam.x*p.y/p.z));
    float r = max(uBcI[i].y*uCam.x/p.z, 0.7*uRes.y/1080.0);
    float d = length(px - sp);
    if (d > 6.0*r + 3.0) continue;
    vec3 sc = texture(uPos, sp/uRes).xyz;
    float vis = length(sc) > length(p) - 1.5 ? 1.0 : 0.0;
    c += vec3(1.0, 0.07, 0.03)*uBcI[i].x*vis*exp(-d*d/(r*r))*uBcI[i].z;
  }
  o = vec4(c, 1.0);
}`;

  // composite: everything but reflections and rain, linear HDR
  const COMP_FS = `#version 300 es
${COMMON}
in vec2 vUv; out vec4 o;
uniform sampler2D uBase, uS0, uS1, uI0, uI1, uMask, uPos, uDynT, uE, uBloom, uBloomS, uNoise;
uniform vec4 uB0, uB1, uRooms; uniform vec3 uRoomCol[4];
uniform float uSpill, uHalo, uBloomK, uTime, uD, uStaticBloom;
uniform vec4 uCam; uniform vec2 uRes;
float nz(vec2 p, int ch){ vec4 v = texture(uNoise, p); return ch == 0 ? v.r : ch == 1 ? v.g : ch == 2 ? v.b : v.a; }
vec3 skyColor(vec3 d, float ph){
  float h = d.y;
  vec3 hor = vec3(0.070, 0.036, 0.018), mid = vec3(0.012, 0.014, 0.026), top = vec3(0.0030, 0.0042, 0.0105);
  vec3 c = mix(hor, mid, smoothstep(-0.02, 0.16, h));
  c = mix(c, top, smoothstep(0.12, 0.42, h));
  vec2 cuv = d.xz/max(d.y, 0.03)*72.0;
  float cl = nz(cuv*0.0016 + vec2(ph, 0.0), 0)*0.65 + nz(cuv*0.0041 + vec2(ph*2.0, 0.37), 1)*0.35;
  c *= 0.55 + 0.9*smoothstep(0.25, 0.8, cl);
  return c;
}
void main(){
  float ph = uTime/uD;
  vec4 base = texture(uBase, vUv);
  vec4 m = texture(uMask, vUv);
  vec3 P = texture(uPos, vUv).xyz;
  vec3 d = normalize(P);
  vec3 c = base.rgb + texture(uBloomS, vUv).rgb*uStaticBloom;
  c += skyColor(d, ph)*m.g;
  // switchable rooms
  vec4 dy = texture(uDynT, vUv);
  c += uRoomCol[0]*dy.r*uRooms.x + uRoomCol[1]*dy.g*uRooms.y + uRoomCol[2]*dy.b*uRooms.z + uRoomCol[3]*dy.a*uRooms.w;
  // sign light on the structure
  float spill = dot(uB0, texture(uS0, vUv)) + dot(uB1, texture(uS1, vUv));
  c += signCol()*spill*uSpill;
  // haze glow, modulated by mist drifting across the light (two layers, opposite drift, whole tiles per loop)
  vec2 a = vec2(vUv.x*uRes.x/uRes.y, vUv.y);
  float mist = nz(a*vec2(0.55, 1.6) + vec2(ph, 0.0), 2)*0.55 + nz(a*vec2(1.3, 3.4) + vec2(-2.0*ph, 0.5), 3)*0.3 + nz(a*vec2(2.6, 7.0) + vec2(3.0*ph, 0.2), 1)*0.15;
  float mistF = 0.30 + 1.6*smoothstep(0.30, 0.72, mist);
  vec2 cuv = d.xz/max(d.y, 0.03)*72.0;
  float cloud = nz(cuv*0.0016 + vec2(ph, 0.0), 0)*0.65 + nz(cuv*0.0041 + vec2(ph*2.0, 0.37), 1)*0.35;
  float cloudF = 0.35 + 1.4*smoothstep(0.25, 0.8, cloud);
  float halo = dot(uB0, texture(uI0, vUv)) + dot(uB1, texture(uI1, vUv));
  c += vec3(0.30, 1.26, 0.30)*halo*uHalo*mix(mistF, mix(mistF, cloudF, 0.6), m.g);
  // mist also catches the city glow a little
  c += vec3(0.010, 0.010, 0.013)*(mistF - 0.9)*0.5*(1.0 - m.g*0.5);
  c = max(c, 0.0);
  vec3 bl = texture(uBloom, vUv).rgb;
  bl = vec3(bl.r*0.74, bl.g, bl.b + bl.g*0.10);
  c += texture(uE, vUv).rgb + bl*uBloomK*(0.55 + 0.45*mistF);
  o = vec4(c, 1.0);
}`;

  // final: reflections in glass and puddles, rain, tone map, grade, dither
  const FINAL_FS = `#version 300 es
${COMMON}
in vec2 vUv; out vec4 o;
uniform sampler2D uL, uPos, uNrm, uMask, uBloom, uNoise;
uniform vec4 uCam; uniform vec2 uRes; uniform float uTime, uD, uExpo, uZr, uRain, uFrame, uLmax;
vec2 proj(vec3 p){ return vec2((uCam.y + uCam.x*p.x/p.z)/uRes.x, 1.0 - (uCam.z - uCam.x*p.y/p.z)/uRes.y); }
vec3 tonemap(vec3 c){
  c *= uExpo;
  float Y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float T = Y*(1.0 + Y/(6.0*6.0))/(1.0 + Y);
  vec3 r = Y > 1e-6 ? c*(T/Y) : c;
  float mx = max(r.r, max(r.g, r.b));
  if (mx > 1.0) { r = mix(r/mx, vec3(1.0), clamp((mx - 1.0)*0.18, 0.0, 0.6)); }
  return clamp(r, 0.0, 1.0);
}
vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
// rain streaks: cells in screen space falling a whole number of cells per loop
float rainLayer(vec2 px, float scale, float speed, float slant, float len, float dens, float seed){
  vec2 p = px/scale;
  p.x += p.y*slant;
  float ph = uTime/uD;
  p.y += ph*speed;
  vec2 cell = floor(vec2(p.x, p.y/len)), f = vec2(fract(p.x), fract(p.y/len));
  float r = h2(cell + seed);
  if (r > dens) return 0.0;
  float x0 = 0.2 + 0.6*h2(cell + seed + 3.0);
  float w = 0.06;
  float sx = 1.0 - smoothstep(0.0, w, abs(f.x - x0));
  float y0 = 0.15 + 0.5*h2(cell + seed + 7.0), y1 = y0 + 0.25 + 0.2*h2(cell + seed + 9.0);
  float sy = smoothstep(y0, y0 + 0.05, f.y)*(1.0 - smoothstep(y1 - 0.08, y1, f.y));
  return sx*sy*(0.5 + 0.5*h2(cell + seed + 11.0));
}
void main(){
  vec2 px = vUv*uRes;
  float sc = uRes.y/1080.0;
  vec3 c = texture(uL, vUv).rgb;
  vec4 m = texture(uMask, vUv);
  vec4 pk = texture(uPos, vUv);
  vec3 P = pk.xyz;
  if (m.b > 0.001) {
    vec4 nr = texture(uNrm, vUv);
    vec3 N = normalize(nr.xyz);
    float rough = nr.a;
    // rain on the puddles: expanding rings from drops on a jittered grid, each cell on its own beat
    if (N.y > 0.9) {
      vec2 q = P.xz*2.2;
      vec2 nrm = vec2(0.0);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 cell = floor(q) + vec2(i, j);
        vec2 ctr = cell + vec2(h2(cell), h2(cell + 17.0));
        float per = 1.0/(3.0 + floor(4.0*h2(cell + 5.0)));
        float age = fract(uTime/uD/per + h2(cell + 9.0))*uD*per;
        float rr = length(q - ctr), R = age*1.6;
        float ring = sin((rr - R)*28.0)*exp(-pow((rr - R)*5.0, 2.0))*exp(-age*2.5);
        nrm += normalize(q - ctr + 1e-4)*ring;
      }
      N = normalize(N + vec3(nrm.x, 0.0, nrm.y)*0.05);
    }
    vec3 V = normalize(P);
    vec3 R = reflect(V, N);
    vec3 rc;
    float t = (uZr - P.z)/max(R.z, 1e-4);
    vec3 Hh = P + R*t;
    vec2 uv = proj(Hh);
    float lod = clamp(log2(1.0 + rough*900.0*sc), 0.0, 4.5 + log2(sc));
    vec3 fallback = vec3(0.012, 0.012, 0.018);
    if (R.z > 0.01 && t > 0.0 && uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      rc = textureLod(uL, uv, lod).rgb;
      float edge = smoothstep(0.0, 0.03, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
      rc = mix(fallback, rc, edge);
    } else rc = fallback;
    c += rc*m.b;
  }
  // rain: three layers, nearer layers bigger and sparser; lit by the glow around them
  float ph = uTime/uD;
  vec3 glow = texture(uBloom, vUv).rgb;
  vec3 lightAt = vec3(0.020, 0.020, 0.024) + glow*0.9;
  float depth = length(P);
  float rn = 0.0;
  rn += rainLayer(px/sc, 9.0, 48.0, 0.10, 6.0, 0.10, 1.0)*0.55 * step(25.0, depth);
  rn += rainLayer(px/sc + 37.0, 14.0, 32.0, 0.10, 5.0, 0.07, 2.0)*0.75 * step(12.0, depth);
  rn += rainLayer(px/sc + 91.0, 23.0, 20.0, 0.10, 4.0, 0.045, 3.0)*1.0;
  c += lightAt*rn*uRain;
  // tone map, grade
  vec3 tm = tonemap(c);
  // vignette
  vec2 vv = (vUv - 0.5)*vec2(1.0, uRes.y/uRes.x)*1.6;
  tm *= 1.0 - 0.34*smoothstep(0.25, 1.05, dot(vv, vv));
  tm *= 1.0 - 0.22*smoothstep(0.55, 1.0, vUv.y);
  vec3 s = srgb(tm);
  // dither / fine grain, on a per-frame seed that wraps with the loop
  float n = (h2(px + uFrame*37.0) + h2(px*1.7 + uFrame*91.0 + 3.0) - 1.0);
  s += n*(1.2/255.0);
  o = vec4(s, 1.0);
}`;

  NS.SH = { GEO_VS, GEO_FS, QUAD_VS, DOWN2_FS, BDOWN_FS, BUP_FS, EMIT_FS, COMP_FS, FINAL_FS };
})();
