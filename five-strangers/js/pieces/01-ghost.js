/* Five Strangers — 01 · Where It Hung
 *
 * A wall, painted a deep colour a long time ago and bleached by forty years of
 * window light, except where a portrait hung. Almost nothing is drawn: the
 * work is in the material (distemper over plaster, baked once into an albedo
 * map and a 16-bit height map) and in the light (an area-lit window on the
 * left wall, and a raking patch of sun cast through a six-over-six sash that
 * crosses the wall during a compressed afternoon, then dusk, then morning).
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
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const DEG = Math.PI / 180;

  const NC = 72; // crack polyline points (x, y, width mm; width < 0 breaks the line)

  const VS = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';

  const COMMON = `
precision highp float;
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float gnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  float a=dot(hash22(i)*2.-1., f);
  float b=dot(hash22(i+vec2(1.,0.))*2.-1., f-vec2(1.,0.));
  float c=dot(hash22(i+vec2(0.,1.))*2.-1., f-vec2(0.,1.));
  float d=dot(hash22(i+vec2(1.,1.))*2.-1., f-vec2(1.,1.));
  return 1.6*mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
`;

  /* ------------------------------------------------------------------ bake */
  const BAKE_FS = COMMON + `
#define NC ${NC}
uniform vec3 uCam;      // mm at device pixel (0,0); mm per device px
uniform float uMode;    // 0 albedo, 1 height
uniform vec4 uG;  uniform vec2 uGr;   // big ghost centre, half size (mm); cos/sin of tilt
uniform vec4 uS;  uniform vec2 uSr;   // small ghost
uniform vec4 uGl;                     // big ghost light penetration: side-bottom, side-top, top, bottom (mm)
uniform vec4 uGa;                     // and how much got in at each edge
uniform vec3 uC0;  uniform vec3 uPale; // original and fully bleached colour (sRGB)
uniform float uSmallAge;              // how much the small ghost had faded before it was hung
uniform vec2 uOff;
uniform vec3 uCrack[NC];
uniform vec2 uHole;  uniform vec2 uNail;
uniform float uXw;

float fbm(vec2 p, float pxs){ // pxs: noise units per pixel
  float s=0., a=.5, w=0.;
  for(int i=0;i<5;i++){
    float fade = 1.-smoothstep(.25,.6,pxs);
    s += a*gnoise(p)*fade; w += a;
    p = mat2(1.6,1.2,-1.2,1.6)*p + 5.3; a *= .5; pxs *= 2.;
  }
  return s/w;
}

// Distemper brush strokes, laid in criss-cross; the top-most stroke wins.
// Returns (edge ridge 0..1, striation -1..1, stroke tone -.5...5, coverage).
vec4 strokes(vec2 p, float k){
  float C = 140.;
  vec2 cell = floor(p/C);
  vec4 acc = vec4(0.); float ws = 0.;
  float fs = 1.-smoothstep(.22,.55,k/4.);   // striations fade out below resolution
  float ff = 1.-smoothstep(.22,.55,k/1.6);
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 c = cell+vec2(float(i),float(j));
    vec2 h = hash22(c+uOff);
    vec2 h2 = hash22(c+uOff+19.7);
    vec2 ctr = (c+.15+.7*h)*C;
    float ang = (h2.x<.5? .79 : -.79) + (h2.y-.5)*.9;
    vec2 dir = vec2(cos(ang),sin(ang));
    vec2 d = p-ctr;
    float a = dot(d,dir), b = dot(d,vec2(-dir.y,dir.x));
    float len = 120.+170.*h.x, wid = 45.+45.*h.y;
    b += 7.*gnoise(vec2(a/80.,h.x*40.)) + 2.*gnoise(vec2(a/14.,h.y*40.));
    float sa = 1.-smoothstep(len*.55,len,abs(a));
    float sb = 1.-smoothstep(wid*.78,wid,abs(b));
    float sh = sa*sb;
    float pr = .35+.65*hash12(c+uOff+3.3);
    float w = pow(sh*pr+1e-3, 2.2);
    float dry = smoothstep(-len, len, a*(h2.x<.5?1.:-1.));   // brush running dry towards one end
    float s = gnoise(vec2(a/70.,b/3.2)+h*71.)*fs*.65 + gnoise(vec2(a/30.,b/1.4)+h*37.)*ff*.35;
    float edge = 4.*sb*(1.-sb)*sa;
    acc += w*vec4(edge, s*(.6+.8*dry), (hash12(c+uOff+8.1)-.5) - .25*dry, sh);
    ws += w;
  }
  return acc/ws;
}

// fraction of the wall protected from light by a hanging object (1 = fully protected)
float protect(vec2 p, vec4 G, vec2 r, vec4 lam, vec4 amp, float k, float wob, out vec4 dd){
  vec2 q = p-G.xy; q = vec2(r.x*q.x + r.y*q.y, -r.y*q.x + r.x*q.y);
  float wl = wob*gnoise(vec2(q.y/110.,1.3)+uOff), wr = wob*gnoise(vec2(q.y/110.,7.9)+uOff);
  float wt = wob*gnoise(vec2(q.x/120.,3.1)+uOff), wb = wob*.5*gnoise(vec2(q.x/120.,5.7)+uOff);
  float dl = q.x+G.z+wl, dr = G.z-q.x+wr, db = q.y+G.w+wb, dt = G.w-q.y+wt;
  dd = vec4(dl,dr,dt,db);
  float ty = clamp((q.y+G.w)/(2.*G.w),0.,1.);
  float ls = mix(lam.x, lam.y, ty*ty);           // sides: crisp below, softer where the frame leaned out
  float as = mix(amp.x, amp.y, ty);
  float lv = 1.+.25*gnoise(vec2(q.x/180.,q.y/180.)+uOff*.3);
  float aa = max(k*.6, .3);
  // light crept in past each edge: a step at the frame line, then an exponential tail
  float el = mix(1., as*exp(-max(dl,0.)/(ls*lv)), smoothstep(-aa,aa,dl));
  float er = mix(1., as*exp(-max(dr,0.)/(ls*lv)), smoothstep(-aa,aa,dr));
  float et = mix(1., amp.z*exp(-max(dt,0.)/(lam.z*lv)), smoothstep(-aa,aa,dt));
  float eb = mix(1., amp.w*exp(-max(db,0.)/(lam.w*lv)), smoothstep(-aa,aa,db));
  return (1.-el)*(1.-er)*(1.-et)*(1.-eb);
}

void main(){
  float k = uCam.z;
  vec2 p = uCam.xy + gl_FragCoord.xy*k;

  vec4 sk = strokes(p, k);
  float cloud = fbm(p/210.+uOff, k/210.);
  float cloud2 = fbm(p/48.+uOff*1.7, k/48.);

  // ---------- crack (hairline, through the plaster, older than the picture)
  float cd = 1e5, cw = 0., cside = 0.;
  vec2 pcr = p + vec2(gnoise(p/6.+uOff), gnoise(p/6.+uOff+9.))*.9 + vec2(gnoise(p/31.+uOff), gnoise(p/31.+uOff+4.))*3.;
  for(int i=0;i<NC-1;i++){
    vec3 a = uCrack[i], b = uCrack[i+1];
    if(a.z<0. || b.z<0.) continue;
    vec2 ab = b.xy-a.xy, ap = pcr-a.xy;
    float t = clamp(dot(ap,ab)/dot(ab,ab),0.,1.);
    vec2 cp = a.xy+ab*t;
    float d = length(pcr-cp);
    if(d<cd){ cd=d; cw=mix(a.z,b.z,t); cside = sign(ab.x*ap.y-ab.y*ap.x); }
  }
  float fw = max(k*.9, cw);
  float crack = (cw/(cw+k*.9)) * (1.-smoothstep(0., .5*fw+.35*k, cd)) * 1.25;
  crack = clamp(crack,0.,1.);
  float crackHalo = exp(-cd/(1.2+k)) * smoothstep(0.,.05,cw);   // lifted paint lip

  // ---------- pits in the plaster
  vec2 pc = floor(p/7.);
  vec2 hp = hash22(pc+uOff*2.1);
  float pitR = .3+1.0*pow(hash12(pc+uOff+5.1),3.);
  float pit = 0.;
  if(hash12(pc+uOff+1.7) < .007){
    float d = length(p-(pc+.2+.6*hp)*7.);
    pit = clamp(3.1*pitR*pitR/(k*k),0.,1.)*(1.-smoothstep(pitR-.3*k, pitR+.6*k, d));
  }

  // ---------- nail holes
  float dn = length(p-uNail), dh = length(p-uHole);
  float holeN = 1.-smoothstep(1.4, 1.4+k, dn);
  float holeS = 1.-smoothstep(1.1, 1.1+k, dh);
  float chipS = (1.-smoothstep(2.4,2.4+k*1.2, length((p-uHole)*vec2(1.,1.3)+vec2(.6,-.4))))*(1.-holeS);
  float chipN = (1.-smoothstep(2.6,2.6+k*1.2, length((p-uNail)*vec2(1.2,1.)-vec2(.5,.7))))*(1.-holeN);

  if(uMode < .5){
    // ---------- how much light this spot received over forty years
    float dx = p.x-uXw;
    float expo = .86 + .11*exp(-(dx-400.)/2300.) + .03*fbm(p/1100.+uOff*.5, k/1100.)
               + .012*cloud + .012*sk.z + .008*cloud2;
    expo += .015*smoothstep(-900.,600.,p.y);           // the upper wall saw more sky
    float fOut = clamp(expo, 0., .985);
    vec4 dd, ds;
    float mG = protect(p, uG, uGr, uGl, uGa, k, 1.6, dd);
    float mS = protect(p, uS, uSr, vec4(3.,4.,4.5,3.), vec4(.3,.35,.4,.3), k, .8, ds);
    float fIn = .035 + .03*cloud2 + .02*sk.z;
    float f = mix(fOut, fIn, mG);
    f = mix(f, uSmallAge + .1*cloud2, mS);
    // the frame's own shade: less bleaching in a broad band right of / below the frame
    vec2 qg = p-uG.xy;
    float shR = exp(-max(dd.y*-1.,0.)/60.)*step(dd.y,0.)*smoothstep(-uG.w-40.,-uG.w+200.,qg.y)*(1.-smoothstep(uG.w-60.,uG.w+20.,qg.y));
    f -= .035*shR*(1.-mG);

    vec3 c = mix(uC0, uPale, f);
    // binder slightly yellowed where light never reached
    c *= mix(vec3(1.), vec3(1.0,.975,.93), mG*.8);
    // limewash clouds and brushing: chalkier where bleached
    float chalk = mix(.06,.017,f)*cloud + mix(.09,.024,sqrt(f))*sk.z + mix(.06,.013,f)*cloud2;
    c *= 1.+chalk + mix(.035,.012,f)*sk.y - .006*sk.x;
    // deep madder goes slightly bluer and chalkier as it starts to fade
    c = mix(c, c*vec3(.97,1.0,1.05), 4.*f*(1.-f)*.5);
    c = mix(c, vec3(dot(c,vec3(.3,.55,.15))), .1*f*(.6+cloud));
    // distemper is matte: a chalky bloom lies over the surviving colour too
    float bloom = smoothstep(-.2,.6,cloud+.5*sk.z)*mG;
    c = mix(c, uPale, .07*bloom);
    // grime frame a few mm inside the edge, where air circulated behind the frame
    float dmin = min(min(dd.x,dd.y),min(dd.z,dd.w));
    float gband = smoothstep(1.,5.,dmin)*(1.-smoothstep(9.,22.,dmin));
    gband *= .75+.5*gnoise(p/35.+uOff*1.1);
    c *= 1.-.075*gband*mix(1.,.7,step(dd.w,min(min(dd.x,dd.y),dd.z)));
    float dminS = min(min(ds.x,ds.y),min(ds.z,ds.w));
    c *= 1.-.05*smoothstep(.5,2.,dminS)*(1.-smoothstep(4.,9.,dminS));
    // powdery speckle
    vec2 gc = floor(p/.8);
    float sp = (hash12(gc+uOff)-.5) * clamp(.8/k,0.,1.);
    c *= 1.+.05*sp*f + .02*sp;

    // dust deposited by the air rising behind the frame and leaving at its top
    float above = -dd.z;
    float span = smoothstep(-30.,60.,min(dd.x,dd.y));
    float streak = .7+.18*gnoise(vec2(p.x/9.,p.y/40.)+uOff) + .3*gnoise(vec2(p.x/45.,p.y/90.)+uOff) + .2*cloud2;
    float dust = .16*exp(-max(above,0.)/11.)*smoothstep(-2.,3.,above)*span*streak;
    dust += .05*exp(-max(above,0.)/45.)*smoothstep(-2.,8.,above)*span;
    // a fainter grey where the frame sides breathed
    float sideD = exp(-max(-dd.x,0.)/9.)*step(dd.x,0.)+exp(-max(-dd.y,0.)/9.)*step(dd.y,0.);
    sideD *= smoothstep(0.,uG.w*1.6, (p.y-uG.y)+uG.w*.9)*.045*(1.-step(0.,-dd.z));
    float aboveS = -ds.z;
    dust += .06*exp(-max(aboveS,0.)/7.)*smoothstep(-1.,2.,aboveS)*smoothstep(-15.,20.,min(ds.x,ds.y))*streak;
    c *= 1.-dust-sideD*streak;
    c = mix(c, c*vec3(.96,.95,.97), dust*3.);

    // crack and pits read darker; holes are dark; chips show grey plaster
    c *= 1.-.5*crack;
    c *= 1.+.04*crackHalo*(1.-crack);
    c *= 1.-.12*pit;
    vec3 plaster = vec3(.80,.78,.74);
    c = mix(c, plaster, .85*(chipS+chipN));
    c = mix(c, vec3(.16,.14,.13), holeS+holeN*.0);
    gl_FragColor = vec4(clamp(c,0.,1.), 1.);
  } else {
    // ---------- height (mm), packed into 16 bits
    float h = 1.4*fbm(p/1300.+uOff, k/1300.) + 1.5*gnoise(p/230.+uOff) + .55*gnoise(p/60.+uOff*1.3)
            + .2*gnoise(p/24.+uOff*.7);
    float peel = gnoise(p/7.+uOff*2.3)*.6 + gnoise(p/3.1+uOff*1.9)*.4*(1.-smoothstep(.2,.5,k/3.1));
    h += .13*peel*(1.-smoothstep(.2,.5,k/7.));
    h += .12*sk.x + .08*sk.y + .08*sk.z + .03*cloud2;
    h -= .25*pit;
    h -= .16*crack;
    h += .035*crackHalo*cside;
    h -= .8*holeN + .8*holeS;
    h -= .08*(chipS+chipN);
    float h01 = clamp((h+4.)/8., 0., 1.);
    float hi = floor(h01*255.)/255.;
    float lo = fract(h01*255.);
    float ao = 1.-.2*pit-.2*crack;
    gl_FragColor = vec4(hi, lo, ao, 1.);
  }
}
`;

  /* -------------------------------------------------------------- lighting */
  const LIGHT_FS = COMMON + `
uniform sampler2D tA; uniform sampler2D tB;
uniform vec2 uRes;
uniform vec3 uCam;
uniform float uXw;
uniform vec4 uWin;        // sill y, head y, z near, z far (mm)
uniform vec3 uSunL;       // towards the sun
uniform vec3 uSunC;       // sun colour * intensity
uniform vec3 uSkyC;       // sky colour * intensity (scaled to form factor)
uniform vec3 uAmbC;
uniform vec3 uN0; uniform vec3 uN1; uniform vec3 uN2;  // nail: hole, bend, head (x,y,height)
uniform float uGlass;
uniform float uSkyNorm;

const float PI = 3.14159265;

float edgeTerm(vec3 a, vec3 b, vec3 n){
  vec3 c = cross(a,b);
  float l = length(c);
  if(l<1e-6) return 0.;
  return acos(clamp(dot(a,b),-1.,1.)) * dot(n, c/l);
}
float rectFF(vec3 p, vec3 n, float y0, float y1, float z0, float z1){
  vec3 v0 = normalize(vec3(uXw,y0,z0)-p), v1 = normalize(vec3(uXw,y0,z1)-p);
  vec3 v2 = normalize(vec3(uXw,y1,z1)-p), v3 = normalize(vec3(uXw,y1,z0)-p);
  float s = edgeTerm(v0,v1,n)+edgeTerm(v1,v2,n)+edgeTerm(v2,v3,n)+edgeTerm(v3,v0,n);
  return abs(s)/(2.*PI);
}
float band(float x, float a, float b, float pen){ return smoothstep(a-pen,a+pen,x)*(1.-smoothstep(b-pen,b+pen,x)); }
float bar(float x, float c, float hw, float pen){ return 1.-(smoothstep(c-hw-pen,c-hw+pen,x)-smoothstep(c+hw-pen,c+hw+pen,x)); }

// sunlight reaching wall point p through the sash window
float sunVis(vec2 p){
  if(uSunL.x >= -1e-4) return 0.;
  float t = (uXw-p.x)/uSunL.x;
  float wy = p.y + t*uSunL.y, wz = t*uSunL.z;
  float pen = 1.5 + t*.0105;
  float v = band(wz, uWin.z, uWin.w, pen) * band(wy, uWin.x, uWin.y, pen);
  float zw = uWin.w-uWin.z, yh = uWin.y-uWin.x;
  v *= bar(wz, uWin.z+zw*.5, 13., pen);                  // central glazing bar
  v *= bar(wy, uWin.x+yh*.5, 24., pen);                  // meeting rails
  v *= bar(wy, uWin.x+yh*.25, 11., pen);
  v *= bar(wy, uWin.x+yh*.75, 11., pen);
  // old drawn glass: faint streaks that travel with the light
  vec2 pane = floor(vec2((wz-uWin.z)/zw*2., (wy-uWin.x)/yh*4.));
  float g = 1. + uGlass*(.06*gnoise(vec2(wz/26., wy/240.)+pane*7.1) + .03*gnoise(vec2(wz/9., wy/90.)+pane*3.3))
               + .03*(hash12(pane+2.)-.5);
  return v*g;
}

float segD(vec2 p, vec2 a, vec2 b, out float t){
  vec2 ab=b-a; t = clamp(dot(p-a,ab)/dot(ab,ab),0.,1.); return length(p-a-ab*t);
}
// soft shadow of the nail cast along direction L (towards light); spread: penumbra per mm of height
float nailShadow(vec2 p, vec3 L, float spread, float minPen){
  vec2 o = -L.xy/max(L.z,.05);
  vec2 a = uN0.xy, b = uN1.xy+o*uN1.z, c = uN2.xy+o*uN2.z;
  float t1, t2;
  float d1 = segD(p,a,b,t1), d2 = segD(p,b,c,t2);
  float h1 = mix(0.,uN1.z,t1), h2 = mix(uN1.z,uN2.z,t2);
  float r = 2.1;
  float pen1 = minPen + h1*spread, pen2 = minPen + h2*spread;
  float s1 = (r/(r+pen1*.5))*(1.-smoothstep(r-pen1, r+pen1, d1));
  float s2 = (r/(r+pen2*.5))*(1.-smoothstep(r-pen2, r+pen2, d2));
  float rh = 5.2, penh = minPen + uN2.z*spread;
  float sh = (rh/(rh+penh*.5))*(1.-smoothstep(rh-penh, rh+penh, length(p-c)));
  return clamp(max(max(s1,s2),sh),0.,1.);
}

vec3 srgb2lin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 tone(vec3 x){
  float a = .8;
  vec3 y = mix(x, a+(1.-a)*(1.-exp(-(x-a)/(1.-a))), step(a,x));
  return y;
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  float k = uCam.z;
  vec2 p = uCam.xy + fc*k;
  vec2 tc = fc/uRes;
  vec2 px = 1./uRes;
  vec3 alb = srgb2lin(texture2D(tA, tc).rgb);
  vec4 b0 = texture2D(tB, tc);
  vec4 bx1 = texture2D(tB, tc+vec2(px.x,0.)), bx0 = texture2D(tB, tc-vec2(px.x,0.));
  vec4 by1 = texture2D(tB, tc+vec2(0.,px.y)), by0 = texture2D(tB, tc-vec2(0.,px.y));
  float hx1 = bx1.r+bx1.g/255., hx0 = bx0.r+bx0.g/255., hy1 = by1.r+by1.g/255., hy0 = by0.r+by0.g/255.;
  vec2 grad = vec2(hx1-hx0, hy1-hy0)*8./(2.*k);
  vec3 n = normalize(vec3(-grad, 1.));
  float ao = b0.b;

  vec3 P = vec3(p, 0.);
  // window light: lower half sees the street, upper half sees sky
  float ym = mix(uWin.x, uWin.y, .45);
  float ffLow = rectFF(P, n, uWin.x, ym, uWin.z, uWin.w);
  float ffHigh = rectFF(P, n, ym, uWin.y, uWin.z, uWin.w);
  float sky = pow(max((ffLow*.55 + ffHigh)*uSkyNorm, 0.), .6);
  vec3 Lw = normalize(vec3(uXw, mix(uWin.x,uWin.y,.6), mix(uWin.z,uWin.w,.5)) - vec3(uN0.xy,0.));
  float occW = nailShadow(p, Lw, .42, 1.2);
  vec3 E = uSkyC*sky*(1.-.6*occW);
  // soft contact shadow: the nail blocks the diffuse room light just below and right of it
  float tq1, tq2;
  vec2 pc = p - vec2(2.5,-4.);
  float dc = min(segD(pc, uN0.xy, uN1.xy, tq1), segD(pc, uN1.xy, uN2.xy, tq2));
  dc = min(dc, length(pc-uN2.xy)-2.5);
  float occC = .42*exp(-max(dc-1.,0.)/6.5);
  // room bounce: warmer and stronger low down (a wooden floor), a little less near the ceiling
  float amb = (.9 + .12*smoothstep(400.,-1600.,p.y) - .06*smoothstep(300.,1300.,p.y)) * (.75+.25*n.z);
  E += uAmbC*amb*(1.-occC);
  E *= ao*(1.-.25*occC);

  float sv = sunVis(p);
  if(sv > 0.){
    float lam = max(dot(n, uSunL), 0.);
    float occS = nailShadow(p, uSunL, .0105, .35);
    E += uSunC*sv*lam*(1.-occS*.92);
  }
  vec3 col = alb*E;

  // ---------- the nail, seen almost end-on
  vec2 axis2 = uN2.xy-uN1.xy;
  float t1, t2;
  float d1 = segD(p, uN0.xy, uN1.xy, t1), d2 = segD(p, uN1.xy, uN2.xy, t2);
  float aa = .7*k;
  float shaft = max(1.-smoothstep(2.1-aa,2.1+aa,d1), 1.-smoothstep(2.1-aa,2.1+aa,d2));
  vec2 hq = p-uN2.xy;
  float hd = length(hq*vec2(1., 1.25));
  float head = 1.-smoothstep(5.1-aa, 5.1+aa, hd);
  if(shaft+head > 0.){
    vec3 axis = normalize(uN2-uN1);
    vec3 steel = vec3(.05,.046,.042);
    // shaft: a cylinder, lit across its width
    vec2 sd = normalize(vec2(-(uN2.y-uN0.y), uN2.x-uN0.x));
    float across = clamp(dot(p-uN1.xy, sd)/2.1, -1., 1.);
    vec3 ns = normalize(vec3(sd*across, sqrt(1.-across*across)));
    vec3 hn = normalize(axis + vec3(hq/5.1*.55, 0.));       // slightly domed head
    vec3 Lsun = uSunL;
    vec3 sunAt = uSunC*sunVis(uN2.xy);
    vec3 cs = steel*.85*(uSkyC*sky*1.1*max(dot(ns,Lw),.15) + uAmbC*.6 + sunAt*max(dot(ns,Lsun),0.)*.8);
    vec3 ch = steel*.8*(uSkyC*sky*1.1*max(dot(hn,Lw),.2) + uAmbC*.7 + sunAt*max(dot(hn,Lsun),0.));
    vec3 hv = normalize(Lsun+vec3(0.,0.,1.));
    ch += sunAt*.35*pow(max(dot(hn,hv),0.),40.) + uSkyC*sky*.6*pow(max(dot(hn,normalize(Lw+vec3(0,0,1))),0.),18.);
    float rim = smoothstep(3.4,5.1,hd);
    ch *= 1.-.35*rim;
    col = mix(col, cs, shaft*(1.-head));
    col = mix(col, ch, head);
  }

  col = tone(col);
  col = pow(max(col,0.), vec3(1./2.2));
  col += (hash12(fc+.5)+hash12(fc+17.3)-1.)/255.;
  gl_FragColor = vec4(col, 1.);
}
`;

  /* ------------------------------------------------------------- the piece */
  (window.PIECES = window.PIECES || []).push({
    id: 'ghost',
    title: 'Where It Hung',
    medium: 'Distemper, daylight and forty years · WebGL',
    note: 'An afternoon passes in about six minutes',
    about: 'A wall painted a deep colour long ago and bleached by forty years of window light, except where a portrait hung. Nothing is drawn but what is missing; the sun crosses the wall so slowly you may not notice, until it reaches the colour that survived.',
    tone: 'light',
    room: '#c9b3ad',

    mount(el, api) {
      const rnd = mulberry32(api.seed ^ 0x51ED5EED);
      const R = (a, b) => a + (b - a) * rnd();

      /* ---- the history of this wall (seeded) */
      // Original colour: a deep madder-and-earth rose, the kind of 'Pompeian' red people
      // chose for a dining room in 1958. Bleached, it is a chalky shell pink.
      const hueJ = R(-1, 1);
      const C0 = [0.43 - 0.02 * hueJ, 0.165 + 0.005 * hueJ, 0.195 + 0.03 * hueJ];
      const PALE = [0.9, 0.795, 0.775 + 0.01 * hueJ];

      const gh = R(880, 980);                  // the portrait: frame height, mm
      const gw = gh * R(0.68, 0.76);
      const tilt = (rnd() < 0.5 ? -1 : 1) * R(0.18, 0.55) * DEG; // it never hung quite straight
      const G = { x: 0, y: 0, hw: gw / 2, hh: gh / 2 };
      // nail above, on the wire's slack
      const nail = { x: R(-18, 18) + Math.sin(tilt) * 0, y: G.hh + R(70, 110) };
      // the small photograph: hung later, to the left and lower; taken away with its nail
      const sl = rnd() < 0.6;
      const S = {
        hw: (sl ? R(98, 112) : R(70, 80)), hh: (sl ? R(72, 82) : R(95, 108)),
        x: 0, y: 0,
      };
      S.x = -G.hw - R(170, 240) - S.hw;
      S.y = -G.hh * R(0.55, 0.75) + S.hh;
      const sTilt = R(-0.9, 0.9) * DEG;
      const hole = { x: S.x + R(-3, 3), y: S.y + S.hh - R(9, 13) }; // sawtooth hanger: hole inside the ghost
      const smallAge = R(0.6, 0.68);

      // crack: from high on the left, down through the lower part of the portrait's ghost
      const crack = [];
      (function makeCrack() {
        const pts = [];
        const a = [G.x - G.hw - R(500, 800), G.y + G.hh + R(150, 500)];
        const b = [G.x + G.hw * R(0.2, 0.9), G.y - G.hh - R(500, 900)];
        const via = [G.x - G.hw * R(0.2, 0.6), G.y - G.hh * R(0.1, 0.5)];
        // quadratic through 'via', with fractal jitter
        const N = 56;
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * via[0] + t * t * b[0];
          const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * via[1] + t * t * b[1];
          pts.push([x, y]);
        }
        for (let pass = 0; pass < 3; pass++) {
          const amp = [22, 9, 3.5][pass];
          for (let i = 1; i < pts.length - 1; i++) {
            const dx = pts[i + 1][0] - pts[i - 1][0], dy = pts[i + 1][1] - pts[i - 1][1];
            const l = Math.hypot(dx, dy) || 1;
            const o = (rnd() - 0.5) * 2 * amp;
            pts[i][0] += -dy / l * o; pts[i][1] += dx / l * o;
          }
        }
        for (let it = 0; it < 1; it++) {
          for (let i = 1; i < pts.length - 1; i++) {
            pts[i][0] = pts[i][0] * 0.6 + 0.2 * (pts[i - 1][0] + pts[i + 1][0]);
            pts[i][1] = pts[i][1] * 0.6 + 0.2 * (pts[i - 1][1] + pts[i + 1][1]);
          }
        }
        for (let i = 0; i < pts.length; i++) {
          const t = i / (pts.length - 1);
          const w = 0.32 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7) * (0.75 + 0.5 * rnd());
          crack.push(pts[i][0], pts[i][1], Math.max(0.02, w));
        }
        // a short branch
        crack.push(0, 0, -1);
        const bi = 16 + Math.floor(rnd() * 20);
        let bx = pts[bi][0], by = pts[bi][1];
        let ang = Math.atan2(pts[bi + 1][1] - pts[bi][1], pts[bi + 1][0] - pts[bi][0]) + (rnd() < 0.5 ? -1 : 1) * R(0.5, 0.9);
        const rest = NC - crack.length / 3;
        for (let i = 0; i < rest; i++) {
          const t = i / (rest - 1);
          crack.push(bx, by, Math.max(0.02, 0.18 * (1 - t)));
          ang += (rnd() - 0.5) * 0.7;
          bx += Math.cos(ang) * 14; by += Math.sin(ang) * 14;
        }
      })();

      // room: window in the left wall
      const WIN = { sill: -350, head: 900, z0: R(1450, 1550), z1: 0 };
      WIN.z1 = WIN.z0 + R(560, 620);
      const period = R(330, 390);                  // seconds for a day
      let u0 = R(0.17, 0.23);
      const qs = new URLSearchParams(location.search);
      if (qs.has('ghostu')) u0 = parseFloat(qs.get('ghostu'));
      const freeze = qs.has('ghostfreeze');
      const off = [R(0, 300), R(0, 300)];

      /* ---- canvas and GL */
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      el.appendChild(canvas);
      el.style.background = '#c9b3ad';
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false })
        || canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false });
      if (!gl) {
        el.removeChild(canvas);
        const d = document.createElement('div');
        d.style.cssText = 'position:absolute;left:52%;top:24%;width:20vh;height:26vh;background:#8e3a44';
        el.appendChild(d);
        api.ready();
        return { destroy() {} };
      }

      function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      }
      function program(fs) {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, VS));
        gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(pr, 0, 'aPos');
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        const U = {};
        const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) {
          const info = gl.getActiveUniform(pr, i);
          const name = info.name.replace(/\[0\]$/, '');
          U[name] = gl.getUniformLocation(pr, info.name);
        }
        return { pr, U };
      }
      const bake = program(BAKE_FS);
      const light = program(LIGHT_FS);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

      function makeTarget(w, h) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { t, fb };
      }
      function freeTarget(o) { if (o) { gl.deleteTexture(o.t); gl.deleteFramebuffer(o.fb); } }

      /* ---- framing: the wall is fixed in millimetres; each viewport is a different photograph of it */
      function frame(cw, ch) {
        const A = cw / ch;
        const land = sstep(0.62, 1.35, A);
        const ghPx = mix(Math.min(0.53 * cw * gh / gw, 0.4 * ch), 0.46 * ch, land);
        const mmPerCss = gh / ghPx;
        const cx = cw * mix(0.635, 0.615, land);
        const cy = ch * mix(0.4, 0.43, land);             // from the top
        let dpr = Math.min(window.devicePixelRatio || 1, 2);
        const budget = 8.5e6;
        if (cw * ch * dpr * dpr > budget) dpr = Math.sqrt(budget / (cw * ch));
        let W = Math.max(2, Math.round(cw * dpr)), H = Math.max(2, Math.round(ch * dpr));
        const lim = Math.min(maxTex, 8192);
        if (W > lim || H > lim) { const s = Math.min(lim / W, lim / H); W = Math.floor(W * s); H = Math.floor(H * s); }
        const k = mmPerCss * cw / W;                       // mm per device px
        const x0 = G.x - cx * mmPerCss;
        const y0 = G.y - (ch - cy) * mmPerCss;
        const xw = Math.min(-3300, x0 - 300);
        return { W, H, k, x0, y0, xw, cw, ch };
      }

      let F = null, A0 = null, B0 = null, raf = 0, dead = false, readyCalled = false;
      let bakeJob = 0;
      const startT = performance.now();

      function setBakeUniforms(fr) {
        const U = bake.U;
        gl.useProgram(bake.pr);
        gl.uniform3f(U.uCam, fr.x0, fr.y0, fr.k);
        gl.uniform4f(U.uG, G.x, G.y, G.hw, G.hh);
        gl.uniform2f(U.uGr, Math.cos(tilt), Math.sin(tilt));
        gl.uniform4f(U.uS, S.x, S.y, S.hw, S.hh);
        gl.uniform2f(U.uSr, Math.cos(sTilt), Math.sin(sTilt));
        gl.uniform4f(U.uGl, 3, 10, 16, 3);
        gl.uniform4f(U.uGa, 0.22, 0.5, 0.62, 0.25);
        gl.uniform3fv(U.uC0, C0);
        gl.uniform3fv(U.uPale, PALE);
        gl.uniform1f(U.uSmallAge, smallAge);
        gl.uniform2f(U.uOff, off[0], off[1]);
        gl.uniform3fv(U.uCrack, new Float32Array(crack));
        gl.uniform2f(U.uHole, hole.x, hole.y);
        gl.uniform2f(U.uNail, nail.x, nail.y);
        gl.uniform1f(U.uXw, fr.xw);
      }

      async function rebake() {
        const job = ++bakeJob;
        const cw = el.clientWidth || window.innerWidth, ch = el.clientHeight || window.innerHeight;
        const fr = frame(cw, ch);
        const A = makeTarget(fr.W, fr.H), B = makeTarget(fr.W, fr.H);
        const rows = Math.max(16, Math.floor(220000 / fr.W));
        for (let mode = 0; mode < 2; mode++) {
          for (let y = 0; y < fr.H; y += rows) {
            if (dead || job !== bakeJob) { freeTarget(A); freeTarget(B); return; }
            gl.bindFramebuffer(gl.FRAMEBUFFER, mode ? B.fb : A.fb);
            gl.viewport(0, 0, fr.W, fr.H);
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(0, y, fr.W, Math.min(rows, fr.H - y));
            setBakeUniforms(fr);
            gl.uniform1f(bake.U.uMode, mode);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.disable(gl.SCISSOR_TEST);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            await new Promise((r) => requestAnimationFrame(r));
          }
        }
        if (dead || job !== bakeJob) { freeTarget(A); freeTarget(B); return; }
        freeTarget(A0); freeTarget(B0);
        A0 = A; B0 = B; F = fr;
        canvas.width = fr.W; canvas.height = fr.H;
        draw(performance.now());
        if (!readyCalled) { readyCalled = true; requestAnimationFrame(() => api.ready()); }
      }

      /* ---- the day */
      function day(u) {
        // sun phase: u in [0, .66)
        const s = u / 0.66;
        const out = {};
        let sunI = 0, phi = 46 * DEG, alt = 27 * DEG;
        if (s < 1) {
          phi = mix(46, 17, s) * DEG;
          alt = 27 * Math.pow(1 - s, 2) * DEG;
          sunI = sstep(0, 0.05, s) * sstep(0.2 * DEG, 3.5 * DEG, alt);
        }
        const L = [-Math.cos(alt) * Math.cos(phi), Math.sin(alt), Math.cos(alt) * Math.sin(phi)];
        const warm = sstep(1 * DEG, 22 * DEG, alt);
        const sc = [1.0, mix(0.6, 0.86, warm), mix(0.33, 0.7, warm)];
        const cloud = 1 - 0.06 * (0.5 + 0.5 * Math.sin(u * 97.0)) * (0.5 + 0.5 * Math.sin(u * 41.0 + 1.3));
        const SUN = 1.25 * sunI * cloud;
        out.L = L;
        out.sun = sc.map((c) => c * SUN);
        // sky and room light
        const dusk = sstep(0.6, 0.8, u) * (1 - sstep(0.84, 0.99, u));
        const sk = mix(1, 0.15, dusk);
        const skc = [mix(0.97, 0.74, dusk), mix(0.985, 0.8, dusk), mix(1.0, 0.98, dusk)];
        const glow = sstep(0.4, 0.62, u) * (1 - sstep(0.62, 0.72, u)); // late light warms the room
        out.sky = skc.map((c, i) => c * sk * (1 + glow * [0.08, 0.0, -0.08][i]));
        const amb = mix(1, 0.2, dusk) * (1 + 0.16 * sunI);   // sun in the room lifts the whole room a little
        out.amb = [0.37 * amb * (1 + 0.12 * glow), 0.355 * amb, 0.34 * amb * (1 - 0.08 * glow) + 0.02 * dusk];
        return out;
      }

      // nail geometry in mm (x, y, height off the wall): driven in pointing slightly up, bent down by the weight
      const nb = (rnd() < 0.5 ? -1 : 1) * R(0.55, 1);
      const N0 = [nail.x, nail.y, 0];
      const N1 = [nail.x + 1.0 * nb, nail.y + 9.0, 21];
      const N2 = [nail.x + 4.5 * nb, nail.y + 15.5, 40];

      // form factor normalisation so the wall at the ghost reads at a constant brightness
      function ffAt(px, py, xw) {
        const P = [px, py, 0];
        const corner = (y, z) => { const v = [xw - P[0], y - P[1], z - P[2]]; const l = Math.hypot(...v); return v.map((c) => c / l); };
        const ym = mix(WIN.sill, WIN.head, 0.45);
        const rect = (y0, y1) => {
          const v = [corner(y0, WIN.z0), corner(y0, WIN.z1), corner(y1, WIN.z1), corner(y1, WIN.z0)];
          let s = 0;
          for (let i = 0; i < 4; i++) {
            const a = v[i], b = v[(i + 1) % 4];
            const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
            const l = Math.hypot(...c);
            s += Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)) * (c[2] / l);
          }
          return Math.abs(s) / (2 * Math.PI);
        };
        return rect(WIN.sill, ym) * 0.55 + rect(ym, WIN.head);
      }

      let lastDraw = 0;
      function draw(now) {
        if (!F || !A0) return;
        const t = freeze ? 0 : (now - startT) / 1000;
        const uu = freeze && el.dataset.u ? +el.dataset.u : u0;   // ?ghostfreeze: a capture tool may set the hour on the element
        const u = ((uu + t / period) % 1 + 1) % 1;
        const d = day(u);
        const ff0 = ffAt(0, 0, F.xw);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, F.W, F.H);
        gl.useProgram(light.pr);
        const U = light.U;
        gl.uniform1f(U.uSkyNorm, 1 / ff0);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A0.t);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B0.t);
        gl.uniform1i(U.tA, 0); gl.uniform1i(U.tB, 1);
        gl.uniform2f(U.uRes, F.W, F.H);
        gl.uniform3f(U.uCam, F.x0, F.y0, F.k);
        gl.uniform1f(U.uXw, F.xw);
        gl.uniform4f(U.uWin, WIN.sill, WIN.head, WIN.z0, WIN.z1);
        gl.uniform3fv(U.uSunL, d.L);
        gl.uniform3fv(U.uSunC, d.sun);
        gl.uniform3fv(U.uSkyC, d.sky.map((c) => c * 0.36));
        gl.uniform3fv(U.uAmbC, d.amb);
        gl.uniform3fv(U.uN0, N0); gl.uniform3fv(U.uN1, N1); gl.uniform3fv(U.uN2, N2);
        gl.uniform1f(U.uGlass, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      function loop(now) {
        if (dead) return;
        if (!api.isCurrent()) { destroy(); return; }
        raf = requestAnimationFrame(loop);
        if (now - lastDraw < 45) return;   // the light moves slowly; ~20 frames a second is plenty
        lastDraw = now;
        draw(now);
      }

      let rsTimer = 0, lastSize = '';
      const ro = new ResizeObserver(() => {
        const key = el.clientWidth + 'x' + el.clientHeight;
        if (key === lastSize) return;
        const first = !lastSize;
        lastSize = key;
        clearTimeout(rsTimer);
        if (first) rebake(); else rsTimer = setTimeout(rebake, 260);
      });
      ro.observe(el);
      raf = requestAnimationFrame(loop);

      function destroy() {
        if (dead) return;
        dead = true;
        cancelAnimationFrame(raf);
        clearTimeout(rsTimer);
        ro.disconnect();
        freeTarget(A0); freeTarget(B0);
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
      return { destroy };
    },
  });
})();
