// "Still Life, Tilted": the subject. A small path tracer (WebGL2 fragment shader over signed-distance geometry) that
// photographs the arranged still life the way an 1840s Petzval-type portrait lens would: one large window as the only
// light, deep falloff, shallow depth of field with a curved field and cat's-eye vignetting, mild spherical-aberration
// glow. It is run ONCE, offline (production/bake.js), and its result is stored in js/photo-data.js as the latent image
// that the plate shader develops. Fully deterministic: every random number comes from a hash of (pixel, sample).
(function (root) {
  'use strict';

  const FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform int uSpp;
uniform int uSampleBase;
uniform vec3 uChain[64];
uniform float uChainS[64];
uniform int uChainN;
uniform vec3 uChainLo, uChainHi;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outDepth;

#ifndef MAXB
#define MAXB 4
#endif
#define PI 3.14159265
#define TAU 6.2831853

// ------------------------------------------------------------------ random
uint gSeed;
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(){ gSeed = pcg(gSeed); return float(gSeed) * 2.3283064e-10; }
// stratified sample pairs: sample n of 64 lands in stratum perm_d(n) of an 8 x 8 grid, a different bijection per pair
vec2 strat(int n, int d, uint pix){
  int A = d == 0 ? 1 : (d == 1 ? 27 : (d == 2 ? 45 : 13));
  int off = int(pcg(pix * 7u + uint(d) * 1013u) & 63u);
  int m = (n * A + off) & 63;
  return (vec2(float(m & 7), float(m >> 3)) + vec2(rnd(), rnd())) * 0.125;
}
int gN; uint gPix; int gDim;
vec2 rnd2(){ if (gDim < 4){ gDim++; return strat(gN, gDim - 1, gPix); } return vec2(rnd(), rnd()); }
float hi(int n){ return float(pcg(uint(n) * 2654435761u + 12345u)) * 2.3283064e-10; }
float h3(ivec3 c){ return float(pcg(uint(c.x) * 73856093u ^ pcg(uint(c.y) * 19349663u ^ pcg(uint(c.z) * 83492791u + 7u)))) * 2.3283064e-10; }
float vnoise(vec3 p){
  ivec3 i = ivec3(floor(p)); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = h3(i), b = h3(i + ivec3(1,0,0)), c = h3(i + ivec3(0,1,0)), d = h3(i + ivec3(1,1,0));
  float e = h3(i + ivec3(0,0,1)), g = h3(i + ivec3(1,0,1)), h = h3(i + ivec3(0,1,1)), k = h3(i + ivec3(1,1,1));
  return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z);
}
float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdEllipsoid(vec3 p, vec3 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdRoundCylY(vec3 p, float ra, float hh, float rb){ vec2 d = vec2(length(p.xz) - ra + rb, abs(p.y) - hh + rb); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rb; }

// ------------------------------------------------------------------ scene layout (cm; table top y = 0, front edge z = 0)
const vec3 BLOOM_C = vec3(-5.6, 4.5, -11.8);
const float BLOOM_S = 0.86;
vec3 bA, bT, bB;                       // bloom frame
const vec3 WATCH_C = vec3(2.2, 0.0, -4.0);
const float WATCH_ROT = -0.42;         // crown direction, radians about +y (0 = +x)
const float LID_OPEN = 1.86;           // hunter lid opening angle
const vec3 EGG_C = vec3(8.3, 0.0, -10.6);
const vec3 SHELL_C = vec3(9.0, 0.0, -3.6);
const vec3 MOTH_C = vec3(-4.4, 0.0, -1.0);
const float MOTH_ROT = 0.55;

// light: one tall window, upper left, in front of the table
const vec3 LC = vec3(-46.0, 44.0, 16.0);
vec3 LN, LU, LV; const float LA = 15.0, LB = 22.0; // half sizes (u horizontal, v vertical)
const vec3 LE = vec3(1.0, 0.985, 0.95) * 9.0;

// ------------------------------------------------------------------ petals
// q in the petal frame: x along the petal from its base, y across, z out of its inner face
float petal(vec3 q, float L, float W, float cup, float curl, float ruf, float rf, float sd){
  float un = clamp(q.x / L, 0.0, 1.0);
  float s15 = un * sqrt(un);
  float hw = 0.5 * W * sqrt(max(4.0 * s15 * (1.0 - s15), 0.0)) + 0.05;
  float vn = q.y / (0.5 * W);
  float edge = smoothstep(0.3, 1.0, un);
  float sA = smoothstep(0.0, 0.55, un);
  float ph1 = q.y * rf + sd * 6.3 + q.x * 0.9, ph2 = q.y * rf * 2.3 + sd * 11.0;
  float s1 = sin(ph1), c1 = cos(ph1), s2 = sin(ph2), c2 = cos(ph2);
  float av = 0.6 + 0.4 * abs(vn);
  float rw = ruf * W * edge;
  float w = cup * vn * vn * 0.22 * W * sA + curl * un * un * L * 0.35 + rw * (0.11 * s1 * av + 0.05 * edge * s2);
  // slope of the sheet, so the distance stays honest on cupped, ruffled petals (no tunnelling of shadow rays)
  float gy = 0.88 * cup * vn * sA + rw * (0.11 * rf * c1 * av + 0.05 * edge * rf * 2.3 * c2);
  float gx = 0.7 * curl * un + rw * 0.099 * c1 * av;
  float Le = L * (1.0 + 0.05 * sin(q.y * rf * 1.3 + sd * 5.0));
  float dSheet = abs(q.z - w) * inversesqrt(1.0 + gx * gx + gy * gy) * 0.9 - 0.022;
  float dOut = max(abs(q.y) - hw, max(-q.x, q.x - Le));
  return length(max(vec2(dSheet, dOut), 0.0)) + min(max(dSheet, dOut), 0.0);
}

// rings (from JS): uRing[3r] = N, r0, z0, theta; uRing[3r+1] = L, W, cup, curl; uRing[3r+2] = ruf, rf, offset, bound
// petals: uPet[12r+i] = cos a, sin a, sin t, cos t; uPetB[12r+i] = L scale, W scale, curl add, seed
uniform vec4 uRing[24];
uniform vec4 uPet[96];
uniform vec4 uPetB[96];
uniform int uRings;
float ringSD(vec3 q, int ring, float cur){
  vec4 R0 = uRing[3 * ring], R1 = uRing[3 * ring + 1], R2 = uRing[3 * ring + 2];
  float bd = length(q - vec3(0.0, 0.0, R0.z)) - R2.w;
  if (bd > cur) return bd + 0.1;
  float N = R0.x, sector = TAU / N;
  float phi = atan(q.y, q.x) - R2.z;
  float fi = phi / sector;
  float i0 = floor(fi + 0.5);
  float side = fi - i0 > 0.0 ? 1.0 : -1.0;
  float best = 1e9;
  for (int kk = 0; kk < 3; kk++){
    if (kk == 2 && ring >= 3) break; // inner rings: the petal and its nearer neighbour
    int k = kk == 0 ? 0 : (kk == 1 ? 1 : -1);
    float i = i0 + float(k) * side;
    int id = 12 * ring + int(mod(i + 0.5 * N * 4.0, N));
    vec4 P = uPet[id], B = uPetB[id];
    vec2 xy = vec2(P.x * q.x + P.y * q.y, -P.y * q.x + P.x * q.y);
    vec3 rel = vec3(xy.x - R0.y, xy.y, q.z - R0.z);
    vec3 pq = vec3(P.z * rel.x + P.w * rel.z, rel.y, -P.w * rel.x + P.z * rel.z);
    best = min(best, petal(pq, R1.x * B.x, R1.y * B.y, R1.z, R1.w + B.z, R2.x, R2.y, B.w));
  }
  return best;
}

float bloomSD(vec3 p){
  vec3 rel = p - BLOOM_C;
  vec3 q = vec3(dot(rel, bT), dot(rel, bB), dot(rel, bA)) / BLOOM_S;
  float d = length(q - vec3(0.0, 0.0, 0.2)) - 0.9;
  for (int r = 0; r < 8; r++){ if (r >= uRings) break; d = min(d, ringSD(q, r, d)); }
  return d * BLOOM_S;
}

// fallen petals lying on the table: position, yaw, flip (+1 cup up, -1 cup down)
float fallen(vec3 p, vec3 c, float yaw, float flip, float L, float W, float sd){
  vec3 r = p - c;
  r.xz = rot(yaw) * r.xz;
  vec3 q = vec3(r.x + L * 0.5, r.z, flip * r.y);
  return petal(q, L, W, 1.2, 0.15 * flip, 0.5, 3.5, sd);
}

// ------------------------------------------------------------------ stem and leaf
const int STEMN = 6;
vec3 stemP(float t){
  vec3 p0 = BLOOM_C - vec3(-0.6, 1.6, 2.5) * 0.0 - bA * 1.3;
  vec3 p2 = vec3(BLOOM_C.x + 10.5, 0.42, BLOOM_C.z - 7.5);
  vec3 p1 = vec3(p0.x + 3.5, 0.6, p0.z - 3.0);
  return mix(mix(p0, p1, t), mix(p1, p2, t), t);
}
float stemSD(vec3 p){
  float d = 1e9;
  vec3 a = stemP(0.0);
  for (int i = 1; i <= STEMN; i++){ vec3 b = stemP(float(i) / float(STEMN)); d = min(d, sdCapsule(p, a, b, 0.42 - 0.05 * float(i) / float(STEMN))); a = b; }
  return d;
}
float leafSD(vec3 p, vec3 c, float yaw, float L, float W, float sd, float lift){
  vec3 r = p - c; r.xz = rot(yaw) * r.xz;
  vec3 q = vec3(r.x, r.z, r.y - lift);
  return petal(q, L, W, 0.35, 0.05, 0.12, 2.0, sd) - 0.01;
}

// ------------------------------------------------------------------ pocket watch (local: crown along +x, dial up)
vec3 watchLocal(vec3 p){ vec3 l = p - WATCH_C; l.xz = rot(WATCH_ROT) * l.xz; return l; }
const float WR = 2.45;
vec3 lidLocal(vec3 l){ // into the closed-lid frame (hinge along x at y = 1.12, z = -WR)
  vec3 h = l - vec3(0.0, 1.12, -WR);
  h.yz = rot(LID_OPEN) * h.yz;
  return h + vec3(0.0, 1.12, -WR);
}
float watchSD(vec3 p, out float part){
  vec3 l = watchLocal(p);
  float r = length(l.xz);
  float body = sdRoundCylY(l - vec3(0.0, 0.58, 0.0), WR, 0.52, 0.36);
  float rec = max(r - 2.05, 0.95 - l.y);
  body = max(body, -rec);
  float bez = length(vec2(r - 2.13, l.y - 1.04)) - 0.085;
  body = min(body, bez);
  part = 0.0;                                   // 0 case, 1 dial, 2 lid
  float dial = max(r - 2.06, abs(l.y - 0.93) - 0.03);
  if (dial < body){ body = dial; part = 1.0; }
  // pendant, crown, bow
  float pend = sdCapsule(l, vec3(WR - 0.1, 0.58, 0.0), vec3(WR + 0.42, 0.58, 0.0), 0.16);
  vec3 cq = l - vec3(WR + 0.62, 0.58, 0.0);
  float ang = atan(cq.z, cq.y);
  float crown = max(length(cq.yz) - 0.27 - 0.018 * cos(ang * 22.0), abs(cq.x) - 0.16) - 0.02;
  vec3 bq = l - vec3(WR + 0.85, 0.5, 0.0);
  bq.xy = rot(0.32) * bq.xy;
  float bow = length(vec2(length(vec2(bq.x * 0.85, bq.z)) - 0.62, bq.y)) - 0.07;
  bow = max(bow, -(bq.x + 0.1));
  float misc = min(min(pend, crown), bow);
  if (misc < body){ body = misc; part = 0.0; }
  // hunter lid, open, hinged at the back
  vec3 h = lidLocal(l);
  vec3 lq = h - vec3(0.0, 1.22, 0.0);
  float rr = length(lq.xz);
  float dome = 0.24 * (1.0 - rr * rr / (WR * WR));
  float lid = sdRoundCylY(vec3(lq.x, lq.y - dome, lq.z), WR, 0.075, 0.07);
  float hinge = sdCapsule(l, vec3(-0.7, 1.12, -WR - 0.05), vec3(0.7, 1.12, -WR - 0.05), 0.12);
  lid = min(lid, hinge);
  if (lid < body){ body = lid; part = 2.0; }
  return body;
}
// analytic crystal: sphere cap over the dial
const float CR_R = 8.2;
vec3 crystalCenterLocal(){ return vec3(0.0, 1.30 - CR_R, 0.0); }

// ------------------------------------------------------------------ egg + half shell
float eggSD(vec3 q){ // axis along x, pointed end at +x
  float a = 2.85, b = 2.12;
  float s = 1.0 - 0.11 * clamp(q.x / a, -1.0, 1.0);
  return sdEllipsoid(vec3(q.x, q.yz / s), vec3(a, b, b)) * 0.92;
}
vec3 eggLocal(vec3 p){ vec3 r = p - (EGG_C + vec3(0.0, 2.10, 0.0)); r.xz = rot(-0.55) * r.xz; r.xy = rot(0.05) * r.xy; return r; }
vec3 shellLocal(vec3 p){
  vec3 r = p - (SHELL_C + vec3(0.0, 1.6, 0.0));
  r.xz = rot(0.35) * r.xz;
  r.xy = rot(-1.05) * r.xy; // axis tipped so the open end faces up and toward the camera
  r.yz = rot(-0.35) * r.yz;
  return r;
}
float rimJag(vec3 q){
  float an = atan(q.z, q.y);
  float t1 = abs(fract(an * 7.0 / TAU + 0.13) - 0.5);
  float t2 = abs(fract(an * 17.0 / TAU + 0.61) - 0.5);
  float t3 = abs(fract(an * 3.0 / TAU + 0.2) - 0.5);
  return 0.42 * t1 + 0.18 * t2 + 0.35 * t3;
}
float shellSD(vec3 p, out float inner){
  vec3 q = shellLocal(p);
  float e = eggSD(q);
  inner = e < 0.0 ? 1.0 : 0.0;
  float sh = abs(e + 0.03) - 0.03;
  float cut = q.x - (-0.05 + rimJag(q) * 0.9);
  return max(sh, cut);
}

// ------------------------------------------------------------------ moth (local: body along -z = head, wings in xz)
vec3 mothLocal(vec3 p){ vec3 l = p - MOTH_C; l.xz = rot(MOTH_ROT) * l.xz; return l; }
float sdQuad2(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d){
  vec2 v[4]; v[0]=a; v[1]=b; v[2]=c; v[3]=d;
  float dd = dot(p - v[0], p - v[0]); float s = 1.0;
  for (int i = 0, j = 3; i < 4; j = i, i++){
    vec2 e = v[j] - v[i], w = p - v[i];
    vec2 bb = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    dd = min(dd, dot(bb, bb));
    bvec3 cnd = bvec3(p.y >= v[i].y, p.y < v[j].y, e.x * w.y > e.y * w.x);
    if (all(cnd) || all(not(cnd))) s *= -1.0;
  }
  return s * sqrt(dd);
}
float smax(float a, float b, float k){ return -smin(-a, -b, k); }
// wings in their own frames: x along the leading edge (costa) from the root, y back toward the inner margin
vec2 foreF(vec2 w){ vec2 c = normalize(vec2(1.0, -0.36)), n = vec2(-c.y, c.x); vec2 q = w - vec2(0.14, -0.18); return vec2(dot(q, c), dot(q, n)); }
vec2 hindF(vec2 w){ vec2 c = normalize(vec2(1.0, 0.45)), n = vec2(-c.y, c.x); vec2 q = w - vec2(0.12, 0.05); return vec2(dot(q, c), dot(q, n)); }
float foreW(vec2 w){
  vec2 f = foreF(w);
  const float L = 2.3, W = 1.42;
  float u = f.x / L;
  float costa = -0.07 * sin(PI * clamp(u, 0.0, 1.0)) - f.y;                  // slightly arched leading edge
  float inner = f.y - W * pow(clamp(u, 0.0, 1.0), 0.55) * (1.0 - 0.15 * u);  // the inner margin widening outward
  float termen = f.x - (L - 0.42 * f.y - 0.18 * f.y * f.y);                // the outer margin, slanted and convex
  return smax(smax(costa, inner, 0.08), smax(termen, -f.x, 0.06), 0.14) * 0.8;
}
float hindW(vec2 w){
  vec2 f = hindF(w);
  float e = length((f - vec2(0.84, 0.06)) / vec2(0.9, 0.64)) - 1.0;
  return smax(e * 0.7, -f.x, 0.1);
}
float mothSD(vec3 p, out float part){
  vec3 l = mothLocal(p);
  vec2 w = vec2(abs(l.x), l.z);
  float lift = 0.16 + 0.05 * w.x;               // slight dihedral
  float fw = max(foreW(w), abs(l.y - lift - 0.012) - 0.008);
  float hw = max(hindW(w), abs(l.y - lift + 0.006) - 0.008);
  float wing = min(fw, hw);
  part = 0.0;
  float th = sdEllipsoid(l - vec3(0.0, 0.25, -0.05), vec3(0.27, 0.2, 0.38));
  float ab = sdEllipsoid(l - vec3(0.0, 0.2, 0.72), vec3(0.19, 0.15, 0.72));
  float hd = length(l - vec3(0.0, 0.24, -0.52)) - 0.16;
  float body = smin(smin(th, ab, 0.08), hd, 0.05);
  vec3 la = vec3(abs(l.x), l.y, l.z);
  float ant = sdCapsule(la, vec3(0.06, 0.3, -0.62), vec3(0.42, 0.36, -1.35), 0.014);
  ant = min(ant, sdCapsule(la, vec3(0.42, 0.36, -1.35), vec3(0.9, 0.34, -1.8), 0.011));
  body = min(body, ant);
  if (body < wing){ part = 1.0; return body; }
  return wing;
}

// ------------------------------------------------------------------ watch chain (polyline from JS, links by arc length)
float chainSD(vec3 p){
  vec3 bq = max(max(uChainLo - p, p - uChainHi), 0.0);
  float bd = length(bq);
  if (bd > 0.3) return bd - 0.15;
  float best = 1e9; int bi = 0; float bt = 0.0;
  for (int i = 0; i < 63; i++){
    if (i >= uChainN - 1) break;
    vec3 a = uChain[i], b = uChain[i + 1];
    vec3 pa = p - a, ba = b - a;
    float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba * t);
    if (d < best){ best = d; bi = i; bt = t; }
  }
  if (best > 0.4) return best - 0.2;
  vec3 a = uChain[bi], b = uChain[bi + 1];
  float s0 = uChainS[bi], s1 = uChainS[bi + 1];
  float s = mix(s0, s1, bt);
  vec3 tg = normalize(b - a);
  vec3 up = abs(tg.y) > 0.8 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 nb = normalize(cross(tg, up)), nn = cross(nb, tg);
  const float PITCH = 0.27;
  float k0 = floor(s / PITCH);
  float d = 1e9;
  for (int k = -1; k <= 1; k++){
    float kk = k0 + float(k);
    float sc = (kk + 0.5) * PITCH;
    vec3 c = a + tg * (sc - s0);
    vec3 r = p - c;
    vec3 q = vec3(dot(r, tg), dot(r, nn), dot(r, nb));
    if (mod(kk, 2.0) > 0.5) q = vec3(q.x, q.z, q.y);
    float d2 = length(vec2(max(abs(q.x) - 0.075, 0.0), q.z)) - 0.085;
    d = min(d, length(vec2(d2, q.y)) - 0.026);
  }
  return d;
}

// ------------------------------------------------------------------ table and backdrop
float tableSD(vec3 p){
  vec2 q = vec2(p.z, p.y) - vec2(-40.0, -2.5);
  vec2 b = vec2(40.0, 2.5);
  float r = 0.55;
  vec2 dq = abs(q) - b + r;
  float d = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - r;
  float groove = length(vec2(p.z - 0.04, p.y + 1.55)) - 0.2;
  d = max(d, -groove);
  float bead = length(vec2(p.z + 0.02, p.y + 2.35)) - 0.14;
  return min(d, bead);
}
float backSD(vec3 p){ return p.z + 44.0 + 2.2 * sin(p.x * 0.22 + 1.3 * sin(p.y * 0.09)) + 1.1 * sin(p.x * 0.53 + 0.7); }

// ------------------------------------------------------------------ map
// materials: 1 wood, 2 cloth, 3 petal, 4 stem/leaf, 5 silver case, 6 dial, 7 egg out, 8 egg in, 9 wing, 10 moth body, 11 chain, 12 lid
vec2 map(vec3 p){
  vec2 res = vec2(tableSD(p), 1.0);
#ifdef ONLYTABLE
  return res;
#endif
  float d = backSD(p) * 0.8; if (d < res.x) res = vec2(d, 2.0);
  // bloom
  float bs = length(p - BLOOM_C) - 7.2;
#ifdef NOBLOOM
  bs = 1e9;
#endif
  if (bs < res.x){ d = bloomSD(p); if (d < res.x) res = vec2(d, 3.0); }
  else res.x = min(res.x, bs + 0.2);
  // fallen petals
  if (p.y < 1.6){
    d = length(p - vec3(-0.7, 0.0, -2.3)) - 2.6; if (d < res.x){ d = fallen(p, vec3(-0.7, 0.06, -2.3), 2.75, 1.0, 3.3, 2.9, 0.37); if (d < res.x) res = vec2(d, 3.0); }
    d = length(p - vec3(-9.0, 0.0, -6.2)) - 3.0; if (d < res.x){ d = fallen(p, vec3(-9.0, 0.07, -6.2), 2.1, -1.0, 4.0, 3.5, 0.71); if (d < res.x) res = vec2(d, 3.0); }
    d = length(p - vec3(-0.6, 0.0, -15.8)) - 5.0; if (d < res.x){
      d = leafSD(p, vec3(-3.4, 0.0, -15.2), -0.45, 7.2, 2.5, 0.2, 0.12); if (d < res.x) res = vec2(d, 4.0);
      d = leafSD(p, vec3(-3.0, 0.0, -15.6), 0.35, 6.4, 2.2, 0.5, 0.16); if (d < res.x) res = vec2(d, 4.0);
    }
  } else res.x = min(res.x, p.y - 1.4);
  // stem
  d = length(p - vec3(BLOOM_C.x + 5.0, 1.5, BLOOM_C.z - 4.0)) - 8.0;
  if (d < res.x){ d = stemSD(p); if (d < res.x) res = vec2(d, 4.0); }
  // watch
  float ws = length(p - WATCH_C - vec3(0.0, 1.5, 0.0)) - 5.6;
  if (ws < res.x){ float part; d = watchSD(p, part); if (d < res.x) res = vec2(d, part == 1.0 ? 6.0 : (part == 2.0 ? 12.0 : 5.0)); }
  else res.x = min(res.x, ws + 0.2);
  // chain
  d = chainSD(p); if (d < res.x) res = vec2(d, 11.0);
  d = sdCapsule(p, vec3(4.35, -3.55, 0.16), vec3(5.45, -3.55, 0.16), 0.075); // the chain's T-bar
  d = min(d, length(vec2(length(p.xy - vec2(4.9, -3.42)) - 0.13, p.z - 0.13)) - 0.03);
  if (d < res.x) res = vec2(d, 11.0);
  // egg and shell
  d = length(p - EGG_C - vec3(0.0, 2.1, 0.0)) - 3.3;
  if (d < res.x){ d = eggSD(eggLocal(p)); if (d < res.x) res = vec2(d, 7.0); }
  float es = length(p - SHELL_C - vec3(0.0, 1.6, 0.0)) - 3.6;
  if (es < res.x){ float inn; d = shellSD(p, inn) * 0.8; if (d < res.x) res = vec2(d, inn > 0.5 ? 8.0 : 7.0); }
  else res.x = min(res.x, es + 0.2);
  // moth
  float ms = length(p - MOTH_C) - 2.8;
  if (ms < res.x){ float part; d = mothSD(p, part); if (d < res.x) res = vec2(d, part > 0.5 ? 10.0 : 9.0); }
  else res.x = min(res.x, ms + 0.2);
  return res;
}
float mapD(vec3 p){ return map(p).x; }
vec3 calcNormal(vec3 p, float e){
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}

int gSteps = 0;
bool march(vec3 ro, vec3 rd, float tmax, out float t, out float mat){
  t = 0.002; mat = 0.0;
  for (int i = 0; i < 220; i++){
    gSteps++;
    vec3 p = ro + rd * t;
    vec2 h = map(p);
    float eps = 0.0006 + 0.00025 * t;
    if (h.x < eps){ mat = h.y; return true; }
    t += h.x * 0.85;
    if (t > tmax) break;
  }
  return false;
}
float shadowT(vec3 ro, vec3 rd, float tmax){
  float t = 0.01;
  for (int i = 0; i < 120; i++){
    gSteps++;
    float h = mapD(ro + rd * t);
    if (h < 0.0006 + 0.0002 * t) return 0.0;
    t += h * 0.9;
    if (t > tmax) return 1.0;
  }
  return 1.0;
}

// ------------------------------------------------------------------ lighting
vec3 envL(vec3 d){ // the dark studio, very faint
  float up = d.y * 0.5 + 0.5;
  return vec3(0.010, 0.0095, 0.009) * (0.5 + 0.8 * up) + vec3(0.02, 0.018, 0.015) * smoothstep(0.2, 0.9, -d.x) * smoothstep(-0.2, 0.5, d.y);
}
float windowMask(vec2 uv){ // uv in [-1,1]: two casements, a transom bar, slight curtain falloff
  float bars = smoothstep(0.012, 0.02, abs(uv.x)) * smoothstep(0.012, 0.02, abs(uv.y - 0.32));
  bars *= smoothstep(0.008, 0.014, abs(abs(uv.x) - 0.5)) ;
  bars *= smoothstep(0.008, 0.014, abs(uv.y + 0.35));
  float frame = smoothstep(1.0, 0.96, abs(uv.x)) * smoothstep(1.0, 0.97, abs(uv.y));
  return bars * frame * (0.75 + 0.25 * smoothstep(-1.0, 0.6, uv.x)) * (0.85 + 0.15 * uv.y);
}
bool hitLight(vec3 ro, vec3 rd, out float t, out vec3 Le){
  float dn = dot(rd, LN);
  if (dn >= 0.0) return false;
  t = dot(LC - ro, LN) / dn;
  if (t <= 0.0) return false;
  vec3 r = ro + rd * t - LC;
  vec2 uv = vec2(dot(r, LU) / LA, dot(r, LV) / LB);
  if (abs(uv.x) > 1.0 || abs(uv.y) > 1.0) return false;
  Le = LE * windowMask(uv);
  return true;
}

struct Mat { vec3 alb; float kind; float rough; vec3 f0; float trans; float spec; };
// kind: 0 diffuse(+coat), 1 metal, 2 translucent sheet

vec3 woodAlb(vec3 p){
  float g = fbm(vec3(p.x * 0.08, p.y * 3.0 + fbm(p * vec3(0.05, 0.6, 1.2)) * 2.0, p.z * 2.2));
  float rings = sin((p.z * 6.0 + g * 9.0) * 1.3) * 0.5 + 0.5;
  float v = 0.65 + 0.35 * g + 0.15 * rings;
  return vec3(0.095, 0.058, 0.034) * v;
}
vec3 dialAlb(vec3 l){
  vec2 d = l.xz; // dial plane, crown (12) along +x
  float r = length(d);
  float a = atan(d.y, d.x); // 0 at 12
  float ink = 0.0;
  // minute track
  ink = max(ink, smoothstep(0.012, 0.0, abs(r - 1.84)) );
  ink = max(ink, smoothstep(0.012, 0.0, abs(r - 1.96)) );
  float m = abs(fract(a / TAU * 60.0 + 0.5) - 0.5);
  ink = max(ink, step(1.84, r) * step(r, 1.96) * smoothstep(0.06, 0.03, m));
  // hour batons
  float hm = abs(fract(a / TAU * 12.0 + 0.5) - 0.5);
  float hb = smoothstep(0.075, 0.045, hm * r / 1.7 * 6.0) * step(1.42, r) * step(r, 1.80);
  ink = max(ink, hb);
  // seconds subdial at 6
  vec2 sc = d - vec2(-1.05, 0.0);
  float sr = length(sc);
  ink = max(ink, smoothstep(0.01, 0.0, abs(sr - 0.42)));
  float sa = atan(sc.y, sc.x);
  ink = max(ink, step(0.32, sr) * step(sr, 0.42) * smoothstep(0.07, 0.035, abs(fract(sa / TAU * 12.0 + 0.5) - 0.5)));
  // hands: minute toward ~10 past, hour toward ~10
  vec2 hmD = vec2(cos(-0.9), sin(-0.9)), hhD = vec2(cos(-5.15), sin(-5.15)), hsD = vec2(cos(2.2), sin(2.2));
  float tm = dot(d, hmD), sm = abs(dot(d, vec2(-hmD.y, hmD.x)));
  ink = max(ink, step(-0.25, tm) * step(tm, 1.75) * smoothstep(0.04, 0.025, sm - 0.02 * (1.0 - tm / 1.75)));
  float th2 = dot(d, hhD), sh2 = abs(dot(d, vec2(-hhD.y, hhD.x)));
  float spade = smoothstep(0.03, 0.0, length(d - hhD * 0.95) - 0.13);
  ink = max(ink, max(step(-0.2, th2) * step(th2, 1.2) * smoothstep(0.05, 0.03, sh2 - 0.015), spade));
  ink = max(ink, smoothstep(0.03, 0.0, length(d) - 0.1));
  float ts = dot(sc, hsD), ss = abs(dot(sc, vec2(-hsD.y, hsD.x)));
  ink = max(ink, step(-0.08, ts) * step(ts, 0.36) * smoothstep(0.02, 0.008, ss));
  vec3 enamel = vec3(0.86, 0.85, 0.80) * (0.96 + 0.04 * vnoise(vec3(d * 30.0, 1.0)));
  return mix(enamel, vec3(0.03, 0.035, 0.06), ink);
}
vec3 wingAlb(vec3 l){
  vec2 w = vec2(abs(l.x), l.z);
  float fore = foreW(w);
  float sc = 0.9 + 0.2 * vnoise(vec3(w * 26.0, 3.0)) + 0.06 * vnoise(vec3(w * 70.0, 5.0));
  if (fore < 0.004){
    vec2 f = foreF(w);
    float u = f.x / 2.3, v = clamp(f.y / 1.3, 0.0, 1.0);
    vec3 base = vec3(0.37, 0.33, 0.28);
    float am = 0.31 + 0.06 * v + 0.012 * sin(v * 25.0);
    float pm = 0.66 - 0.10 * v + 0.02 * sin(v * 31.0 + 1.0) + 0.015 * abs(sin(v * 47.0));
    float t = 1.0;
    t *= mix(1.0, 0.78, smoothstep(am, am + 0.02, u) * smoothstep(pm + 0.02, pm, u));     // the darker median band
    t *= 1.0 - 0.55 * smoothstep(0.022, 0.0, abs(u - am));
    t *= 1.0 + 0.55 * smoothstep(0.03, 0.0, abs(u - am - 0.035));
    t *= 1.0 - 0.6 * smoothstep(0.02, 0.0, abs(u - pm));
    t *= 1.0 + 0.7 * smoothstep(0.035, 0.0, abs(u - pm - 0.04));
    float st = 0.86 - 0.05 * v + 0.012 * sin(v * 40.0);
    t *= 1.0 + 0.45 * smoothstep(0.025, 0.0, abs(u - st));
    t *= 1.0 - 0.25 * smoothstep(st + 0.02, st + 0.08, u);                                  // darker outer border
    vec2 ds = (f - vec2(0.5 * 2.3, 0.33 * 1.3)) / vec2(0.09, 0.13);
    t *= 1.0 - 0.6 * smoothstep(1.0, 0.6, length(ds)) * smoothstep(0.2, 0.55, length(ds)); // ringed discal spot
    float ang = atan(f.y, f.x);
    t *= 1.0 - 0.10 * smoothstep(0.02, 0.0, abs(fract(ang * 3.2 + 0.1) - 0.5) * length(f)) * step(0.15, u); // veins
    t *= 1.0 - 0.35 * smoothstep(-0.05, 0.0, fore) * step(0.5, fract(v * 9.0));            // chequered fringe
    t *= 1.0 + 0.2 * smoothstep(0.12, 0.0, f.y + 0.07 * sin(PI * clamp(u, 0.0, 1.0)) ) * step(u, 0.9); // paler costa
    return base * t * sc;
  }
  vec2 g = hindF(w);
  float r = length((g - vec2(0.0, 0.1)) / vec2(1.7, 1.2));
  float t = 0.95 - 0.4 * smoothstep(0.02, 0.0, abs(r - 0.72 - 0.015 * sin(atan(g.y, g.x) * 20.0)));
  t *= 0.85 + 0.15 * smoothstep(0.2, 0.7, r);
  return vec3(0.40, 0.36, 0.30) * t * sc;
}
Mat material(float id, vec3 p, inout vec3 n){
  Mat m; m.alb = vec3(0.5); m.kind = 0.0; m.rough = 0.5; m.f0 = vec3(0.04); m.trans = 0.0; m.spec = 0.0;
  if (id == 1.0){
    m.alb = woodAlb(p); m.spec = 0.10; m.rough = 0.22;
    n = normalize(n + 0.02 * vec3(vnoise(p * vec3(0.3, 8.0, 8.0)) - 0.5, 0.0, vnoise(p * vec3(0.3, 9.0, 9.0) + 3.0) - 0.5));
  } else if (id == 2.0){
    m.alb = vec3(0.05, 0.047, 0.044) * (0.8 + 0.4 * fbm(p * 0.4));
  } else if (id == 3.0){
    m.alb = vec3(0.93, 0.88, 0.88); m.kind = 2.0; m.trans = 0.42; m.spec = 0.03; m.rough = 0.35;
    m.alb *= 0.94 + 0.06 * vnoise(p * 9.0);
  } else if (id == 4.0){
    m.alb = vec3(0.07, 0.12, 0.04) * (0.8 + 0.4 * vnoise(p * 3.0)); m.spec = 0.08; m.rough = 0.3; m.kind = 0.0;
  } else if (id == 5.0 || id == 12.0 || id == 11.0){
    m.kind = 1.0; m.f0 = vec3(0.94, 0.92, 0.88); m.rough = id == 11.0 ? 0.1 : (id == 12.0 ? 0.0 : 0.02);
    if (id == 12.0){ // lid: engine-turned (guilloché) outside, polished inside
      vec3 l = lidLocal(watchLocal(p)) - vec3(0.0, 1.22, 0.0);
      if (l.y > 0.05){ float rr = length(l.xz); n = normalize(n + 0.12 * vec3(sin(rr * 60.0 + 3.0 * sin(atan(l.z, l.x) * 12.0)), 0.0, 0.0)); m.rough = 0.12; }
    }
  } else if (id == 6.0){
    m.alb = dialAlb(watchLocal(p)); m.spec = 0.05; m.rough = 0.08;
  } else if (id == 7.0){
    m.alb = vec3(0.9, 0.86, 0.78) * (0.95 + 0.05 * vnoise(p * 14.0)); m.spec = 0.04; m.rough = 0.4;
    m.alb *= 1.0 - 0.12 * smoothstep(0.72, 0.8, vnoise(p * 6.0));
  } else if (id == 8.0){
    m.alb = vec3(0.92, 0.9, 0.86); m.spec = 0.02; m.rough = 0.5;
  } else if (id == 9.0){
    m.alb = wingAlb(mothLocal(p)); m.spec = 0.03; m.rough = 0.45; m.kind = 2.0; m.trans = 0.12;
  } else if (id == 10.0){
    m.alb = vec3(0.36, 0.32, 0.27) * (0.8 + 0.4 * vnoise(p * 40.0));
    n = normalize(n + 0.35 * (vec3(vnoise(p * 50.0), vnoise(p * 50.0 + 7.0), vnoise(p * 50.0 + 13.0)) - 0.5));
  }
  return m;
}

vec3 cosHemi(vec3 n){
  vec2 uu = rnd2(); float u = uu.x, v = uu.y;
  float r = sqrt(u), a = TAU * v;
  vec3 t = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
  vec3 b = cross(n, t);
  return normalize(t * r * cos(a) + b * r * sin(a) + n * sqrt(max(0.0, 1.0 - u)));
}
vec3 glossy(vec3 r, float rough){
  vec3 d = r + rough * (vec3(rnd(), rnd(), rnd()) * 2.0 - 1.0) * 0.9;
  return normalize(d);
}
vec3 fresnelS(vec3 f0, float c){ return f0 + (1.0 - f0) * pow(1.0 - c, 5.0); }

// direct light from the window (next-event estimation)
vec3 sampleLight(vec3 p, vec3 n, out vec3 wi, out float ok){
  vec2 uv = rnd2() * 2.0 - 1.0;
  vec3 lp = LC + LU * uv.x * LA + LV * uv.y * LB;
  vec3 d = lp - p; float dist = length(d); wi = d / dist;
  float cl = -dot(wi, LN);
  ok = 0.0;
  if (cl <= 0.0) return vec3(0.0);
  float vis = shadowT(p + n * 0.004, wi, dist);
  ok = 1.0;
  return LE * windowMask(uv) * vis * cl * (4.0 * LA * LB) / (dist * dist);
}

// crystal hit (analytic), in world space
bool hitCrystal(vec3 ro, vec3 rd, float tmax, out float t, out vec3 n){
  vec3 lo = ro - WATCH_C; lo.xz = rot(WATCH_ROT) * lo.xz;
  vec3 ld = rd; ld.xz = rot(WATCH_ROT) * ld.xz;
  vec3 c = crystalCenterLocal();
  vec3 oc = lo - c;
  float b = dot(oc, ld), cc = dot(oc, oc) - CR_R * CR_R;
  float h = b * b - cc;
  if (h < 0.0) return false;
  h = sqrt(h);
  float ts[2]; ts[0] = -b - h; ts[1] = -b + h;
  for (int i = 0; i < 2; i++){
    float tt = ts[i];
    if (tt > 0.003 && tt < tmax){
      vec3 q = lo + ld * tt;
      if (q.y > 1.0 && length(q.xz) < 2.08){
        vec3 nl = normalize(q - c);
        n = nl; n.xz = rot(-WATCH_ROT) * n.xz;
        t = tt; return true;
      }
    }
  }
  return false;
}

vec3 trace(vec3 ro, vec3 rd){
  vec3 L = vec3(0.0), thr = vec3(1.0);
  bool countEmit = true, diffused = false;
  for (int bounce = 0; bounce < MAXB; bounce++){
    float t, id;
    bool hit = march(ro, rd, 140.0, t, id);
    if (!hit) t = 1e5;
    float tl; vec3 Le;
    bool lh = hitLight(ro, rd, tl, Le);
    float tc; vec3 cn;
    if (hitCrystal(ro, rd, min(t, lh ? tl : 1e5), tc, cn)){
      float c = abs(dot(rd, cn));
      float F = 0.04 + 0.96 * pow(1.0 - c, 5.0);
      vec3 pc = ro + rd * tc;
      // the crystal's reflection, taken deterministically (the window, or the dark room) instead of by a random pick
      vec3 rr = reflect(rd, cn); float tl2; vec3 Le2;
      L += thr * F * (hitLight(pc, rr, tl2, Le2) ? Le2 : envL(rr)) * (diffused ? 0.3 : 1.0);
      thr *= 1.0 - F;
      ro = pc + rd * 0.003;
      continue;
    }
    if (lh && tl < t){ if (countEmit) L += diffused ? min(thr * Le, vec3(0.8)) : thr * Le; break; }
    if (!hit){ L += thr * envL(rd); break; }
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p, 0.0015);
    Mat m = material(id, p, n);
    bool back = dot(n, rd) > 0.0;
    vec3 nf = back ? -n : n;
    vec3 wo = -rd;
    if (m.kind == 1.0){
      float c = max(dot(nf, wo), 0.0);
      thr *= fresnelS(m.f0, c);
      rd = glossy(reflect(rd, nf), m.rough);
      if (dot(rd, nf) < 0.0) rd = reflect(rd, nf);
      ro = p + nf * 0.003;
      countEmit = true;
    } else {
      bool sampleSpec = m.spec > 0.0 && m.rough < 0.15;
      float F = sampleSpec ? m.spec + (1.0 - m.spec) * pow(1.0 - max(dot(nf, wo), 0.0), 5.0) * 0.5 : 0.0;
      if (rnd() < F){
        rd = glossy(reflect(rd, nf), m.rough);
        if (dot(rd, nf) < 0.0) rd = reflect(rd, nf);
        ro = p + nf * 0.003; countEmit = true;
      } else {
        // direct: diffuse (+ translucent) and, for rough dielectrics, a GGX highlight evaluated here (noise-free)
        vec3 wi; float ok;
        vec3 Ld = sampleLight(p, nf, wi, ok);
        if (ok > 0.0){
          float cs = dot(wi, nf);
          float spec = 0.0;
          if (!sampleSpec && m.spec > 0.0 && cs > 0.0 && !diffused){
            vec3 hv = normalize(wi + wo);
            float nh = max(dot(nf, hv), 0.0), no = max(dot(nf, wo), 1e-3);
            float a2 = m.rough * m.rough * m.rough * m.rough;
            float dd = nh * nh * (a2 - 1.0) + 1.0;
            float D = a2 / (PI * dd * dd);
            float k = m.rough * m.rough * 0.5;
            float G = (cs / (cs * (1.0 - k) + k)) * (no / (no * (1.0 - k) + k));
            float Fs = m.spec + (1.0 - m.spec) * pow(1.0 - max(dot(hv, wo), 0.0), 5.0);
            spec = min(Fs * D * G / (4.0 * cs * no), 30.0);
          }
          if (m.kind == 2.0){
            if (cs > 0.0) L += thr * (m.alb * (1.0 - m.trans) / PI + spec) * cs * Ld;
            else {
              vec3 Lt = sampleLight(p - nf * 0.06, -nf, wi, ok);
              float ct = -dot(wi, nf);
              if (ct > 0.0) L += thr * m.alb * m.trans / PI * ct * Lt;
            }
          } else if (cs > 0.0) L += thr * (m.alb / PI + spec) * cs * Ld;
        }
        // indirect
        if (m.kind == 2.0 && rnd() < m.trans){
          rd = cosHemi(-nf); ro = p - nf * 0.06;
        } else {
          rd = cosHemi(nf); ro = p + nf * 0.003;
        }
        thr *= m.alb;
        countEmit = false; diffused = true;
      }
    }
    if (bounce >= 2){ float q = max(thr.r, max(thr.g, thr.b)); if (rnd() > q) break; thr /= q; }
  }
  return L;
}

// ------------------------------------------------------------------ camera: Petzval-type portrait lens
uniform vec3 CAM, TGT, FOCUSP;
uniform float TANH, APER;      // tan(half horizontal fov), aperture radius (cm)
void main(){
  LN = normalize(vec3(0.0, 0.0, -2.0) - LC);
  LU = normalize(cross(vec3(0.0, 1.0, 0.0), LN)); LV = normalize(cross(LN, LU));
  bA = normalize(vec3(-0.5, 0.42, 0.76));
  bT = normalize(cross(vec3(0.0, 1.0, 0.0), bA)); bB = cross(bA, bT);
  vec3 fw = normalize(TGT - CAM);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0))), up = cross(rt, fw);
  float focusD = dot(FOCUSP - CAM, fw);
  vec2 px = gl_FragCoord.xy;
  vec3 acc = vec3(0.0); float dep = 0.0;
  float aspect = uRes.x / uRes.y;
  for (int s = 0; s < uSpp; s++){
    int si = uSampleBase + s;
    gSeed = pcg(uint(px.x) * 9781u + uint(px.y) * 6271u * 31u + uint(si) * 26699u + 1013u);
    gSeed = pcg(gSeed ^ uint(si) * 0x9E3779B9u);
    gN = si; gPix = uint(px.x) + uint(px.y) * 8191u; gDim = 0;
    vec2 uv = ((px + rnd2()) / uRes) * 2.0 - 1.0;
    uv.y /= aspect;
    // pinhole: depth of field, the lens's curved field and its cat's-eye vignetting are applied after the bake
    vec3 dir = normalize(fw + rt * uv.x * TANH + up * uv.y * TANH);
    vec3 col = trace(CAM, dir);
    acc += min(col, vec3(12.0));
    if (s == 0){ float t, id; if (march(CAM, dir, 140.0, t, id)) dep = t * dot(dir, fw); else dep = 200.0; }
  }
#ifdef STEPVIS
  acc = vec3(float(gSteps) / float(uSpp) / 400.0);
#endif
  outColor = vec4(acc, float(uSpp));
  outDepth = vec4(dep * float(uSpp), float(uSpp), 0.0, 0.0);
}`;

  const VERT = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  // the watch chain: a smooth catenary-ish path from the bow, across the table, over the front edge, hanging
  function chainPath() {
    const rot = -0.42, wc = [2.2, 0.0, -4.0], WR = 2.45;
    const cd = [Math.cos(rot), Math.sin(rot)]; // local +x -> world, rot about y with rot(WATCH_ROT) inverse
    // world crown direction: local x axis mapped back: l.xz = rot(a)*w.xz  => w.xz = rot(-a)*l.xz
    const lx = [Math.cos(-rot) * 1, Math.sin(-rot) * 1]; // mat2 rot(a) = [c s; -s c] in GLSL column-major
    // GLSL rot(a) = mat2(c, s, -s, c) -> columns (c,s), (-s,c): v' = (c*x - s*y, s*x + c*y). Inverse: angle -a.
    const inv = (x, z) => [Math.cos(-rot) * x - Math.sin(-rot) * z, Math.sin(-rot) * x + Math.cos(-rot) * z];
    const b = inv(WR + 1.42, 0.0);
    const start = [wc[0] + b[0], 0.07, wc[2] + b[1]];
    const ctrl = [
      start,
      [6.55, 0.07, -1.95],
      [6.45, 0.07, -1.05],
      [5.7, 0.07, -0.62],
      [5.15, 0.07, -0.28],
      [5.0, -0.12, 0.12],
      [4.96, -0.8, 0.17],
      [4.92, -2.0, 0.13],
      [4.9, -3.3, 0.13],
    ];

    void cd; void lx;
    const pts = [];
    const cr = (p0, p1, p2, p3, t) => p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t * t * t));
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      const steps = 7;
      for (let k = 0; k < steps; k++) pts.push(cr(p0, p1, p2, p3, k / steps));
    }
    pts.push(ctrl[ctrl.length - 1]);
    const out = pts.slice(0, 64);
    const S = [0];
    for (let i = 1; i < out.length; i++) S.push(S[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1], out[i][2] - out[i - 1][2]));
    return { pts: out, S };
  }

  const CAMERA = { pos: [1.4, 19.0, 36.0], tgt: [0.8, 2.6, -5.0], focus: [0.6, 0.8, -3.6], tanh: 0.30, aper: 1.1 };
  // Peony: rings of petals, outermost first. [N, r0, z0, theta, L, W, cup, curl, ruffle, ruffle freq, offset]
  const RINGS = [
    [5, 1.7, -0.9, 1.36, 6.4, 6.2, 1.0, -0.15, 0.16, 1.4, 0.3],
    [6, 1.5, -0.5, 1.12, 5.7, 5.4, 1.25, 0.10, 0.2, 1.8, 1.1],
    [7, 1.25, -0.1, 0.86, 5.0, 4.6, 1.45, 0.38, 0.3, 2.4, 0.5],
    [8, 0.95, 0.2, 0.58, 4.2, 3.7, 1.6, 0.62, 0.55, 3.8, 2.0],
    [9, 0.6, 0.35, 0.36, 3.4, 2.8, 1.8, 0.85, 0.85, 5.5, 0.9],
    [7, 0.3, 0.45, 0.20, 2.5, 2.1, 2.0, 1.0, 1.0, 7.0, 0.2],
  ];
  function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function bloomUniforms(rings) {
    const R = new Float32Array(24 * 4), P = new Float32Array(96 * 4), B = new Float32Array(96 * 4);
    const rnd = mulberry(1847);
    rings.forEach((g, r) => {
      const [N, r0, z0, th, L, W, cup, curl, ruf, rf, off] = g;
      R.set([N, r0, z0, th, L, W, cup, curl, ruf, rf, off, r0 + L * 1.15 + 0.6], r * 12);
      for (let i = 0; i < 12; i++) {
        const h1 = rnd(), h2 = rnd(), h3 = rnd(), h4 = rnd();
        const a = i * (2 * Math.PI / N) + off + (h1 - 0.5) * (2 * Math.PI / N) * 0.35, t = th + (h2 - 0.5) * 0.28;
        P.set([Math.cos(a), Math.sin(a), Math.sin(t), Math.cos(t)], (r * 12 + i) * 4);
        B.set([0.86 + 0.26 * h3, 0.88 + 0.22 * h4, (h2 - 0.5) * 0.2, h1 + r], (r * 12 + i) * 4);
      }
    });
    return { R, P, B, n: rings.length };
  }

  // Bake: tiles x sample passes, accumulated in a float framebuffer with additive blending. Returns Float32Array RGBA.
  async function bake(W, H, spp, opts = {}) {
    const tile = opts.tile || 128, per = opts.per || 4;
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
    const gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
    gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_float_blend');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG.replace('precision highp int;\n', 'precision highp int;\n' + (opts.defs || ''))));
    gl.bindAttribLocation(pr, 0, 'aPos'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const tex2 = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex2, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.enable(gl.SCISSOR_TEST);
    const U = (n) => gl.getUniformLocation(pr, n);
    gl.uniform2f(U('uRes'), W, H);
    const cam = Object.assign({}, CAMERA, opts.cam || {});
    gl.uniform3fv(U('CAM'), cam.pos); gl.uniform3fv(U('TGT'), cam.tgt); gl.uniform3fv(U('FOCUSP'), cam.focus);
    gl.uniform1f(U('TANH'), cam.tanh); gl.uniform1f(U('APER'), cam.aper);
    const ch = chainPath();
    gl.uniform3fv(U('uChain'), new Float32Array(ch.pts.flat()));
    gl.uniform1fv(U('uChainS'), new Float32Array(ch.S));
    gl.uniform1i(U('uChainN'), ch.pts.length);
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const p of ch.pts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - 0.2); hi[i] = Math.max(hi[i], p[i] + 0.2); }
    gl.uniform3fv(U('uChainLo'), lo); gl.uniform3fv(U('uChainHi'), hi);
    const bu = bloomUniforms(opts.rings || RINGS);
    gl.uniform4fv(U('uRing'), bu.R); gl.uniform4fv(U('uPet'), bu.P); gl.uniform4fv(U('uPetB'), bu.B); gl.uniform1i(U('uRings'), bu.n);
    const tiles = [];
    const rg = opts.region || [0, 0, W, H];  // GL pixel coords: x0, y0, x1, y1
    for (let y = rg[1]; y < rg[3]; y += tile) for (let x = rg[0]; x < rg[2]; x += tile) tiles.push([x, y, Math.min(tile, rg[2] - x), Math.min(tile, rg[3] - y)]);
    const passes = Math.ceil(spp / per);
    const t0 = performance.now();
    for (let ps = 0; ps < passes; ps++) {
      gl.uniform1i(U('uSpp'), Math.min(per, spp - ps * per));
      gl.uniform1i(U('uSampleBase'), (opts.base || 0) + ps * per);
      for (const [x, y, tw, th] of tiles) {
        gl.scissor(x, y, tw, th);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.finish();
        if (opts.yieldEvery) await new Promise((r) => setTimeout(r, 0));
      }
      if (opts.progress) opts.progress(ps + 1, passes, performance.now() - t0);
    }
    const out = new Float32Array(W * H * 8);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, out.subarray(0, W * H * 4));
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, out.subarray(W * H * 4));
    return out;
  }

  root.StillLife = { FRAG, VERT, bake, chainPath, RINGS, CAMERA };
})(typeof window !== 'undefined' ? window : globalThis);
