// "Still Life, Tilted": a sixth-plate daguerreotype of a still life, in its open hinged case, held in the hand.
// WebGL2. At load, deterministic generation passes build the plate (the developed image as a frosted amalgam
// density, buffing lines and hairline scratches, the tarnish film thickness, a fingerprint, spots), the brass mat and
// its gilt preserver (height, then normals), and the pressed velvet of the lid. Each frame then ray-casts the case in
// perspective at the hand's tilt and shades every surface against the room it reflects: a dark room, the viewer's
// dark silhouette, and one soft window behind the viewer's left shoulder. Where the bare silver reflects the dark,
// the image reads positive; where it reflects the window, it turns negative.
// Every frame is a pure function of t. ?t=3.5 freezes; ?export exposes window.__piece.
(function () {
  'use strict';
  const DURATION = 20;
  const qs = new URLSearchParams(location.search);
  const EXPORT = qs.has('export');
  const canvas = document.getElementById('art');
  const SCALE = +(qs.get('scale') || (EXPORT ? 1 : 0.5));
  const CW = Math.round(2160 * SCALE), CH = Math.round(2700 * SCALE);
  canvas.width = CW; canvas.height = CH;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false });
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  // ------------------------------------------------------------------------------------------------ GLSL common
  const COMMON = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
#define PI 3.14159265
#define TAU 6.2831853
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float h1(float n){ return float(pcg(uint(int(n) + 1000000))) * 2.3283064e-10; }
float h2(vec2 c){ ivec2 i = ivec2(floor(c)); return float(pcg(uint(i.x) * 1597334677u ^ pcg(uint(i.y) + 3812015801u))) * 2.3283064e-10; }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.07 + vec2(13.1, 7.7); a *= 0.5; } return s; }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  vec2 o = vec2(i.z * 17.0, i.z * 31.0); vec2 o2 = o + vec2(17.0, 31.0);
  float a = mix(vn(p.xy + o), vn(p.xy + o2), f.z); return a; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float segT(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); }
// signed distance to the mat's oval aperture (negative inside), mm
const vec2 OV = vec2(33.0, 26.5);
float sdOval(vec2 p){ float k0 = length(p / OV), k1 = length(p / (OV * OV)); return k0 * (k0 - 1.0) / k1; }
float bump(float d, float w){ float x = clamp(1.0 - d / w, 0.0, 1.0); return sqrt(x * (2.0 - x)); }
`;
  const VERT = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  // ------------------------------------------------------------------------------------------------ plate generation
  // Output RGBA8 over the plate region (74 x 59.7 mm, the region the still life was photographed for):
  // R = image density (frosted amalgam coverage, with its fine grain), G = scratch scattering (buffing lines,
  // hairlines, a wiped patch), B = tarnish film thickness (x 320 nm), A = stains (0.5 neutral, below = dark
  // corrosion spots, above = haze / dust specks).
  const PLATE_GEN = COMMON + `
uniform sampler2D uPhoto; uniform vec2 uPhotoRes; uniform vec2 uRes; uniform float uExpo;
uniform vec4 uArc[28]; uniform vec4 uArc2[28];
out vec4 o;
float photoE(vec2 uv){ // Catmull-Rom bicubic on the log-exposure image
  vec2 p = uv * uPhotoRes - 0.5; vec2 i = floor(p), f = p - i;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  float s = 0.0;
  for (int y = -1; y <= 2; y++){
    float wy = y == -1 ? w0.y : (y == 0 ? w1.y : (y == 1 ? w2.y : w3.y));
    for (int x = -1; x <= 2; x++){
      float wx = x == -1 ? w0.x : (x == 0 ? w1.x : (x == 1 ? w2.x : w3.x));
      ivec2 c = clamp(ivec2(i) + ivec2(x, y), ivec2(0), ivec2(uPhotoRes) - 1);
      s += wx * wy * texelFetch(uPhoto, c, 0).r;
    }
  }
  return exp2(s);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 P = (uv - 0.5) * vec2(74.0, 59.7);
  ivec2 tc = ivec2(gl_FragCoord.xy);
  // ---- the image: exposure -> density of the mercury-silver amalgam particles
  float x = photoE(uv) * uExpo;
  float D = 1.0 - exp(-1.15 * pow(x, 1.35));
  D *= 1.0 - 0.10 * smoothstep(2.4, 7.0, x);                      // solarisation of the very brightest passages
  float n1 = h2(vec2(tc)) - 0.5, n2 = vn(P * 28.0) - 0.5, n3 = vn(P * 7.0) - 0.5;
  D = D + D * (1.0 - D) * (0.20 * n1 + 0.12 * n2 + 0.05 * n3) + 0.010 * n1 * (1.0 - D);
  D *= 1.0 + 0.035 * (fbm(P * 0.5) - 0.5);                        // uneven mercury development
  D = clamp(D, 0.0, 1.0);
  // ---- scratches
  float yy = P.y + 0.12 * sin(P.x * 0.06 + 1.3) + 0.05 * sin(P.x * 0.31);
  float S = 0.0;
  { // dense fine buffing lines (horizontal: the final buff ran along the plate)
    float row = floor(yy * 34.0);
    float e = smoothstep(0.35, 0.85, vn(vec2(P.x * 0.09 + h1(row) * 50.0, row * 0.37)));
    S += 0.035 * step(0.72, h2(vec2(row, 7.0))) * e * (0.5 + h2(vec2(row, 9.0)));
  }
  { // sparser, longer, stronger buffing lines
    float cell = floor(yy * 5.0);
    for (int k = -1; k <= 1; k++){
      float c = cell + float(k);
      float cy = (c + h2(vec2(c, 3.0))) / 5.0;
      float d = abs(yy - cy);
      float e = smoothstep(0.3, 0.75, vn(vec2(P.x * 0.05 + h2(vec2(c, 5.0)) * 40.0, c)));
      S += 0.11 * h2(vec2(c, 11.0)) * e * smoothstep(0.022, 0.0, d);
    }
  }
  for (int i = 0; i < 28; i++){ // hairline arcs from careless wiping
    vec4 a = uArc[i], b = uArc2[i];
    vec2 r = P - a.xy; float L = length(r);
    float d = abs(L - a.z);
    if (d > 0.1) continue;
    float ang = atan(r.y, r.x);
    float t = (mod(ang - b.x + PI, TAU) - PI) / b.y;     // -1..1 along the arc
    if (abs(t) > 1.0) continue;
    float taper = smoothstep(1.0, 0.55, abs(t)) * (0.6 + 0.4 * vn(vec2(t * 9.0, float(i))));
    S += a.w * taper * smoothstep(b.z, b.z * 0.3, d);
  }
  { // a wiped patch over the dark table: a sheaf of fine concentric scratches
    vec2 wc = vec2(-58.0, -78.0);
    float q = length(P - wc);
    float m = smoothstep(11.0, 4.0, length((P - vec2(8.0, -15.0)) * vec2(0.8, 1.25)));
    float ph = q * 9.0 + 1.5 * vn(P * 0.8);
    float line = smoothstep(0.92, 1.0, sin(ph * TAU)) * step(0.45, vn(vec2(floor(ph), P.x * 0.12)));
    S += 0.14 * m * line;
  }
  S = clamp(S, 0.0, 1.0);
  // ---- tarnish: a halo creeping in from the mat aperture, thickest at the edge, in irregular tongues
  float s = -sdOval(P);                                             // mm inside the aperture
  float th = atan(P.y / OV.y, P.x / OV.x);
  float creep = s - 2.4 * fbm(P * 0.16 + 3.0) - 0.9 * fbm(P * 0.55 + 9.0) + 1.2;
  vec2 dirn = normalize(P + 1e-4);
  float thick = 0.22 + 0.14 * fbm(vec2(th * 2.2, 1.7)) + 0.09 * smoothstep(0.1, -0.9, dirn.x * 0.6 - dirn.y * 0.8);
  float lam = 1.4 + 2.2 * fbm(vec2(th * 3.1, 5.3)) * fbm(P * 0.3 + 2.0) * 1.6;
  float T = thick * exp(-max(creep, 0.0) / lam);
  T += 0.035 + 0.04 * fbm(P * 0.12 + 20.0);                         // the faint overall film
  // ---- fingerprint, a partial thumb near the upper right edge: its sweat etched the tarnish in ridges
  float X = 0.5;
  {
    vec2 fc = vec2(22.5, 15.0);
    vec2 q = rot(-0.5) * (P - fc);
    float e = length(q / vec2(7.2, 9.6));
    float m = smoothstep(1.0, 0.6, e) * smoothstep(-3.0, 2.0, q.x + q.y * 0.3) * 0.9;
    vec2 qw = q + 0.6 * vec2(vn(q * 0.35), vn(q * 0.35 + 5.0)) - vec2(0.0, 1.2);
    float ph = length(qw * vec2(1.0, 0.78)) / 0.47 + 0.8 * atan(qw.y, qw.x) / TAU;
    float ridge = smoothstep(0.25, 0.75, 0.5 + 0.5 * sin(ph * TAU)) * smoothstep(0.15, 0.4, vn(q * 3.0));
    T += m * 0.05 * ridge;
    X += m * 0.022 * ridge;
  }
  // ---- corrosion spots (dark, ringed with tarnish) and dust specks on the glass (white)
  for (int i = 0; i < 14; i++){
    vec2 c = vec2(h1(float(i) * 3.0 + 1.0) - 0.5, h1(float(i) * 3.0 + 2.0) - 0.5) * vec2(64.0, 50.0);
    float r = 0.05 + 0.22 * pow(h1(float(i) * 3.0 + 3.0), 2.0);
    float d = length((P - c) * vec2(1.0, 1.0 + 0.3 * h1(float(i) + 50.0)));
    if (i < 8){
      X -= 0.42 * smoothstep(r, r * 0.4, d);
      T += 0.22 * smoothstep(r * 3.5, r * 1.2, d) * smoothstep(r * 0.6, r * 1.3, d);
      D *= 1.0 - 0.5 * smoothstep(r * 1.5, r * 0.7, d);
    } else {
      X += 0.45 * smoothstep(r * 0.5, r * 0.15, d);
    }
  }
  o = vec4(D, S, clamp(T, 0.0, 1.0), clamp(X, 0.0, 1.0));
}`;

  // ------------------------------------------------------------------------------------------------ mat + preserver
  // Height field over the package (85 x 72 mm): the brass mat with its beaded oval aperture, a running scroll and
  // corner sprays on a stippled ground; around it the gilt preserver foil with its stamped bead and leaf border.
  // R = height (mm), G = roughness, B = id (0 mat, 1 preserver).
  const FRAME_H = COMMON + `
uniform vec2 uRes; uniform float uArcLen[65]; uniform float uQLen;
out vec4 o;
float arcU(vec2 q){ // arc length along the aperture for a first-quadrant point
  float ph = atan(q.y / OV.y, q.x / OV.x) / (0.5 * PI) * 64.0;
  int i = int(clamp(floor(ph), 0.0, 63.0)); float f = clamp(ph - float(i), 0.0, 1.0);
  return mix(uArcLen[i], uArcLen[i + 1], f);
}
float spiralD(vec2 p, float r0, float k, float turns){
  float r = length(p), a = atan(p.y, p.x);
  float best = 1e9;
  for (int n = 0; n < 3; n++){
    float aa = a + TAU * float(n);
    if (aa > turns * TAU) break;
    float rs = r0 * exp(-k * aa);
    best = min(best, abs(r - rs));
  }
  return best;
}
float leafD(vec2 p, vec2 c, float ang, float L, float W){ // pointed leaf, returns distance-like (negative inside)
  vec2 q = rot(-ang) * (p - c);
  float t = clamp(q.x / L, -1.0, 1.0);
  float w = W * (1.0 - t * t) * (1.0 + 0.25 * t);
  return abs(q.y) - w + max(abs(q.x) - L, 0.0);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 P = (uv - 0.5) * vec2(85.0, 72.0);
  vec2 Q = abs(P);
  float h = 0.0, rough = 0.45, id = 0.0;
  float inner = sdRR(P, vec2(38.5, 32.0), 1.2);
  if (inner > 0.0){
    // ---- preserver: a domed foil band 4 mm wide, stamped
    id = 1.0;
    float w = inner;                                                // 0 at the inner edge .. 4 at the well
    float sideBand = (Q.x - 38.5) > (Q.y - 32.0) ? 1.0 : 0.0;
    float v = sideBand > 0.5 ? P.y : P.x;
    h = 0.42 * pow(sin(PI * clamp(w / 4.0, 0.0, 1.0)), 0.65) - 0.05;
    // beads near the inner edge
    float bv = fract(v / 0.95) - 0.5;
    h += 0.07 * bump(length(vec2(bv * 0.95, w - 0.75)), 0.3);
    // leaves along the crest, alternating with dots
    float cell = v / 2.1; float lc = fract(cell) - 0.5;
    float leaf = leafD(vec2(lc * 2.1, w - 2.2), vec2(0.0), 0.0, 0.8, 0.42);
    h += 0.09 * smoothstep(0.08, -0.12, leaf) * (0.7 + 0.3 * smoothstep(0.0, -0.3, leaf));
    h += 0.06 * bump(length(vec2((fract(cell + 0.5) - 0.5) * 2.1, w - 2.2)), 0.22);
    h += 0.05 * bump(abs(w - 3.3), 0.12);
    // corner rosettes
    vec2 cq = Q - vec2(40.5, 34.0);
    float cr = length(cq), ca = atan(cq.y, cq.x);
    float pet = cr - 1.25 * (0.65 + 0.35 * abs(cos(ca * 3.0)));
    float ros = smoothstep(0.1, -0.15, pet);
    h = mix(h, 0.42 + 0.12 * ros * bump(cr, 1.4), smoothstep(1.8, 1.4, cr));
    rough = 0.16 + 0.25 * smoothstep(0.2, 0.0, h - 0.25);
  } else {
    // ---- mat
    float sd = sdOval(P);                                           // mm outside the aperture
    if (sd < 0.35){                                                 // the bevelled cut edge
      h = -0.25 + 0.25 * clamp(sd / 0.35, 0.0, 1.0);
      rough = 0.10;
    } else {
      float u = arcU(Q);
      // ground: stippled (punched) texture
      float st = vn(P * 22.0) * 0.6 + vn(P * 47.0) * 0.4;
      h = 0.012 * st; rough = 0.34;
      // beads around the aperture
      float bs = 1.02;
      float bu = (fract(u / bs) - 0.5) * bs;
      float bead = bump(length(vec2(bu, sd - 0.95)), 0.42);
      // a polished fillet and an engraved line
      float fil = bump(abs(sd - 0.45), 0.11);
      float groove = smoothstep(0.07, 0.0, abs(sd - 1.75));
      // the running scroll: n motifs per quadrant, each symmetric (a leaf, and two scrolls curling away from it)
      float lam = uQLen / 8.0;
      float cx = (fract(u / lam + 0.5) - 0.5) * lam;              // -lam/2 .. lam/2, motif centred at 0
      float ax = abs(cx);
      float y = sd - 3.35;
      float orn = 0.0;
      // stem: a gentle wave
      float stemY = -0.55 * cos(ax / (0.5 * lam) * PI);
      float dStem = abs(y - stemY) * 0.92;
      orn = max(orn, bump(dStem, 0.16 + 0.05 * smoothstep(0.5 * lam, 0.0, ax)));
      // the scroll curling under the stem toward the next motif
      vec2 sp = vec2(ax - 0.62 * 0.5 * lam, y + 0.22);
      sp = rot(1.2) * sp;
      float dSp = spiralD(sp * vec2(1.0, 1.1), 1.25, 0.21, 1.5);
      orn = max(orn, bump(dSp, 0.13) * smoothstep(1.6, 0.9, length(sp)));
      orn = max(orn, bump(length(rot(1.2) * vec2(ax - 0.62 * 0.5 * lam, y + 0.22)) , 0.24));   // the scroll's eye
      // the central leaf, pointing outward, and two small side leaves
      float lf = leafD(vec2(cx, y), vec2(0.0, 0.75), 1.5708, 1.05, 0.42);
      orn = max(orn, smoothstep(0.06, -0.10, lf) * (0.75 + 0.25 * smoothstep(0.0, -0.25, lf)) * (1.0 - 0.35 * smoothstep(0.05, 0.0, abs(cx))));
      float lf2 = leafD(vec2(ax, y), vec2(0.95, -0.95), -0.55, 0.62, 0.26);
      orn = max(orn, smoothstep(0.05, -0.08, lf2) * 0.85);
      orn *= smoothstep(5.6, 4.9, sd);
      // corner sprays: a rosette on the diagonal with two acanthus strokes along the band
      vec2 R0 = vec2(34.9, 28.1);
      vec2 rq = Q - R0; float rr = length(rq), ra = atan(rq.y, rq.x);
      float petal = rr - 1.85 * (0.62 + 0.38 * pow(abs(cos(ra * 4.0)), 0.7));
      float ros = smoothstep(0.08, -0.12, petal) * (0.8 + 0.2 * bump(rr, 1.9));
      ros = max(ros, bump(rr, 0.55) * 1.2);
      float ac = 0.0;
      for (int s2 = 0; s2 < 2; s2++){
        vec2 a0 = R0 + (s2 == 0 ? vec2(-1.9, 0.6) : vec2(0.6, -1.9));
        vec2 a1 = s2 == 0 ? vec2(29.0, 30.3) : vec2(37.2, 22.6);
        vec2 a2 = s2 == 0 ? vec2(24.5, 29.3) : vec2(37.3, 17.5);
        vec2 pp = a0; float best = 1e9, bt = 0.0;
        for (int k = 1; k <= 8; k++){
          float t = float(k) / 8.0;
          vec2 pn = mix(mix(a0, a1, t), mix(a1, a2, t), t);
          float dd = sdSeg(Q, pp, pn);
          if (dd < best){ best = dd; bt = (float(k) - 1.0 + segT(Q, pp, pn)) / 8.0; }
          pp = pn;
        }
        float wdt = mix(0.75, 0.12, bt) * (1.0 + 0.35 * sin(bt * 34.0));
        ac = max(ac, bump(best, wdt) * smoothstep(1.0, 0.85, bt));
      }
      float corner = max(ros, ac) * smoothstep(4.6, 6.0, sd);
      float raised = max(orn, corner);
      h += 0.075 * bead + 0.04 * fil - 0.02 * groove + 0.095 * raised;
      rough = mix(rough, 0.13, clamp(max(max(bead, fil), raised) * 1.6, 0.0, 1.0));
      // a raised fillet just inside the preserver
      float edgeLine = bump(abs(inner + 0.75), 0.16);
      h += 0.05 * edgeLine; rough = mix(rough, 0.14, edgeLine);
    }
  }
  o = vec4(h, rough, id, 1.0);
}`;
  // normals from a height texture (mm), plus a cavity (dirt) term from the local mean height
  const NORMALS = COMMON + `
uniform sampler2D uH; uniform vec2 uRes; uniform vec2 uSize; uniform float uCav;
out vec4 o;
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy), mx = ivec2(uRes) - 1;
  float hl = texelFetch(uH, clamp(c - ivec2(1, 0), ivec2(0), mx), 0).r, hr = texelFetch(uH, clamp(c + ivec2(1, 0), ivec2(0), mx), 0).r;
  float hd = texelFetch(uH, clamp(c - ivec2(0, 1), ivec2(0), mx), 0).r, hu = texelFetch(uH, clamp(c + ivec2(0, 1), ivec2(0), mx), 0).r;
  vec4 me = texelFetch(uH, c, 0);
  vec2 px = uSize / uRes;
  vec3 n = normalize(vec3(-(hr - hl) / (2.0 * px.x), -(hu - hd) / (2.0 * px.y), 1.0));
  float avg = 0.0;
  for (int k = 0; k < 8; k++){ float a = float(k) * 0.785398; avg += texelFetch(uH, clamp(c + ivec2(round(vec2(cos(a), sin(a)) * 5.0)), ivec2(0), mx), 0).r; }
  avg /= 8.0;
  float cav = clamp((avg - me.r) * uCav, 0.0, 1.0);
  o = vec4(n.xy * 0.5 + 0.5, me.g, cav);
}`;

  // ------------------------------------------------------------------------------------------------ velvet pad
  // Pressed pattern in the lid's velvet (85 x 72 mm pad): border lines, corner fans, a laurel wreath, a rosette.
  // R = pressed depth (mm), G = pressed mask, B = fibre noise.
  const VELVET_H = COMMON + `
uniform vec2 uRes;
out vec4 o;
float leafD(vec2 p, vec2 c, float ang, float L, float W){
  vec2 q = rot(-ang) * (p - c);
  float t = clamp(q.x / L, -1.0, 1.0);
  return abs(q.y) - W * (1.0 - t * t) + max(abs(q.x) - L, 0.0);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 P = (uv - 0.5) * vec2(85.0, 72.0);
  vec2 Q = abs(P);
  float press = 0.0;
  // border: a soft pressed band, and an inner line of small scallops
  float b1 = abs(sdRR(P, vec2(39.4, 32.9), 3.0));
  press = max(press, smoothstep(0.75, 0.2, b1));
  float b2 = sdRR(P, vec2(37.1, 30.6), 2.5);
  float per = (Q.x - 37.1 > Q.y - 30.6) ? P.y : P.x;
  float sc = abs(b2 + 0.45 * abs(sin(per * PI / 2.4)));
  press = max(press, smoothstep(0.5, 0.15, sc) * 0.9);
  float inField = smoothstep(0.0, -0.8, b2);
  // corner fans
  vec2 fq = Q - vec2(36.4, 29.9);
  float fr = length(fq), fa = atan(-fq.y, -fq.x);
  float fan = smoothstep(7.0, 6.4, fr) * smoothstep(-0.05, 0.05, fa) * smoothstep(1.62, 1.52, fa);
  float ribs = smoothstep(0.45, 0.1, abs(fract(fa / 1.5708 * 9.0) - 0.5) * fr * 0.17) * smoothstep(1.4, 2.6, fr);
  press = max(press, fan * max(ribs * 0.85, smoothstep(0.6, 0.2, abs(fr - 6.5))));
  press = max(press, smoothstep(0.55, 0.2, abs(fr - 2.6)) * fan);
  press = max(press, smoothstep(1.4, 1.0, fr) * fan * 0.8);
  // laurel wreath on an oval
  vec2 e = P / vec2(23.0, 16.5);
  float ang = atan(e.y, e.x);
  float N = 34.0;
  float wreath = 0.0;
  for (int j = 0; j < 2; j++){
    float k = floor(ang / TAU * N + 0.5) + float(j) * (fract(ang / TAU * N + 0.5) > 0.5 ? 1.0 : -1.0);
    float a0 = k / N * TAU;
    vec2 c0 = vec2(cos(a0), sin(a0)) * vec2(23.0, 16.5);
    vec2 tng = normalize(vec2(-sin(a0) * 23.0, cos(a0) * 16.5));
    float side = mod(k, 2.0) < 0.5 ? 1.0 : -1.0;
    vec2 nrm = vec2(tng.y, -tng.x);
    float la = atan(tng.y, tng.x) + side * 0.6;
    float lf = leafD(P, c0 + nrm * side * 0.95, la, 1.85, 0.7);
    wreath = max(wreath, smoothstep(0.25, -0.3, lf) * (0.7 + 0.3 * smoothstep(-0.05, 0.08, abs(dot(rot(-la) * (P - c0 - nrm * side * 0.95), vec2(0.0, 1.0))))));
  }
  press = max(press, wreath);
  press = max(press, smoothstep(0.5, 0.15, abs(length(e) - 1.0) * 19.0));
  // the central rosette: pressed petals, raised outlines
  float r = length(P), ra = atan(P.y, P.x);
  float prof = 6.8 * (0.55 + 0.45 * pow(abs(cos(ra * 4.0)), 0.6));
  float pet = r - prof;
  press = max(press, smoothstep(0.3, -0.4, pet) * (0.55 + 0.45 * smoothstep(0.0, -1.2, pet)) * smoothstep(1.9, 2.5, r));
  press = max(press, smoothstep(0.5, 0.15, abs(r - 2.2)));
  press = max(press, smoothstep(1.2, 0.8, r) * 0.95);
  // a small pressed diaper in the field between the scallops and the wreath
  vec2 dg = rot(0.7854) * P / 3.4;
  vec2 dc = abs(fract(dg) - 0.5);
  float dia = smoothstep(0.17, 0.1, dc.x + dc.y);
  float field = inField * smoothstep(1.1, 1.35, length(P / vec2(23.0, 16.5))) * (1.0 - fan);
  press = max(press, dia * field * 0.5);
  float fibre = vn(P * 9.0) * 0.5 + h2(gl_FragCoord.xy) * 0.5;
  o = vec4(-0.45 * press, press, fibre, 1.0);
}`;

  // ------------------------------------------------------------------------------------------------ main shader
  const MAIN = COMMON + `
uniform vec2 uRes; uniform mat3 uM; uniform vec3 uT; uniform float uLid; uniform vec3 uCam; uniform vec3 uTgt;
uniform float uTanH; uniform int uSS;
uniform sampler2D uPlate, uFrame, uVelvet, uFilm;
out vec4 o;
// ---- the room the silver reflects (world directions; the viewer is at +z)
const vec3 LDIR = vec3(-0.44, 0.47, 0.76);
vec3 env(vec3 R, float blur){
  float el = asin(clamp(R.y, -1.0, 1.0)), az = atan(R.x, R.z);
  float b = 0.075 + blur;
  float win = smoothstep(0.045 - b, 0.045 + b, el) * smoothstep(0.92 + b, 0.92 - b, el)
            * smoothstep(-1.08 - b, -1.08 + b, az) * smoothstep(-0.06 + b, -0.06 - b, az);
  float bar = 1.0 - 0.32 * exp(-pow((az + 0.56) / (0.035 + b * 0.7), 2.0)) - 0.26 * exp(-pow((el - 0.46) / (0.035 + b * 0.7), 2.0));
  vec3 L = vec3(0.95, 0.97, 1.0) * 2.3 * win * bar * (0.9 + 0.12 * el);
  float head = smoothstep(1.0 + b * 4.0, 1.0 - b * 4.0, length(vec2((az - 0.03) / 0.19, (el + 0.02) / 0.33)));
  L *= 1.0 - 0.94 * head;
  vec3 room = vec3(0.012, 0.0105, 0.009) + vec3(0.03, 0.026, 0.022) * smoothstep(0.25, 1.0, el) + vec3(0.014, 0.012, 0.010) * smoothstep(0.1, 1.2, az) * smoothstep(-0.2, 0.4, el);
  return L + room * (1.0 - 0.7 * head);
}
float irr(vec3 N){ return 0.85 * pow(clamp(dot(N, LDIR) * 0.75 + 0.25, 0.0, 1.0), 1.4) + 0.045 + 0.025 * N.y; }
vec3 fres(vec3 f0, float c){ return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }

// ---- case geometry (case-local mm; base front face z = 0, lid hinged along the top edge)
const vec2 CASE = vec2(46.0, 39.5);
vec3 toLid(vec3 p){ vec3 h = p - vec3(0.0, CASE.y, 0.0); h.yz = rot(uLid) * h.yz; return h + vec3(0.0, CASE.y, 0.0); }
float sdCaseBox(vec3 p, float z0, float z1, float re){
  float dxy = sdRR(p.xy, CASE, 5.0);
  float zc = 0.5 * (z0 + z1), zh = 0.5 * (z1 - z0);
  vec2 w = vec2(dxy + re, abs(p.z - zc) - zh + re);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - re;
}
float sdBase(vec3 p){ return sdCaseBox(p, -14.0, 0.0, 1.6); }
float sdLid(vec3 p){
  vec3 q = toLid(p);
  float d = sdCaseBox(q, 0.0, 8.0, 1.6);
  // the padded velvet cushion bulging out of the lid's inside face
  float dxy = sdRR(q.xy, vec2(42.6, 36.1), 3.0);
  vec2 w = vec2(dxy + 1.9, abs(q.z + 0.9) - 0.9 + 1.9);
  float pad = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 1.9;
  return min(d, pad);
}
float sdScene(vec3 p){ return min(sdBase(p), sdLid(p)); }
vec3 nScene(vec3 p){
  const vec2 k = vec2(1.0, -1.0); float e = 0.02;
  return normalize(k.xyy * sdScene(p + k.xyy * e) + k.yyx * sdScene(p + k.yyx * e) + k.yxy * sdScene(p + k.yxy * e) + k.xxx * sdScene(p + k.xxx * e));
}

vec3 leather(vec3 pl, vec3 Nw, vec3 V, float gilt){
  float g = vn3(pl * 1.6) * 0.6 + vn3(pl * 4.1 + 3.0) * 0.4;
  vec3 base = vec3(0.022, 0.0135, 0.0095) * (0.85 + 0.3 * g);
  float E = irr(Nw);
  vec3 R = reflect(-V, Nw);
  float c = max(dot(Nw, V), 0.0);
  vec3 col = base * E + fres(vec3(0.035), c) * env(R, 0.35 + 0.15 * g) * (0.55 + 0.45 * g);
  if (gilt > 0.0){
    vec3 gc = fres(vec3(0.92, 0.70, 0.36), c) * env(R, 0.28) * 0.9 + vec3(0.92, 0.70, 0.36) * 0.10 * E;
    col = mix(col, gc * (0.7 + 0.3 * g), gilt);
  }
  return col;
}

vec3 velvet(vec2 P, vec3 Nl_closed, vec3 V, vec3 Nw_face, mat3 toW){
  vec2 uv = P / vec2(85.0, 72.0) + 0.5;
  vec4 tv = texture(uVelvet, uv);
  vec2 dn = (tv.xy * 2.0 - 1.0);
  float press = tv.z, fib = tv.w;
  // cushion normal (closed frame, face points -z), bent by the pressed relief
  vec3 n = normalize(Nl_closed + vec3(dn.x, dn.y, 0.0) * vec3(1.0, 1.0, 0.0) * -1.0);
  vec3 Nw = normalize(toW * n);
  float c = clamp(dot(Nw, V), 0.0, 1.0);
  vec3 base = vec3(0.075, 0.0075, 0.016) * (0.88 + 0.24 * fib);
  float E = irr(Nw);
  vec3 R = reflect(-V, Nw);
  // pile: deep colour at normal view, a bright rim sheen at grazing; pressed: flattened, satin, darker head-on
  float sheen = pow(1.0 - c, 2.2);
  vec3 pile = base * E * 1.1 + vec3(0.20, 0.032, 0.045) * sheen * (0.3 + 0.8 * E) * (0.8 + 0.4 * fib);
  vec3 flat_ = base * E * 0.62 + fres(vec3(0.012, 0.005, 0.006), c) * env(R, 0.3) * vec3(1.0, 0.4, 0.45) * 1.2 + vec3(0.2, 0.03, 0.05) * 0.05 * E;
  return mix(pile, flat_, press);
}

// the layered package seen through the base's well
vec3 package(vec3 ro, vec3 rd, mat3 toW, vec3 Vw, out float hitZ){
  vec3 Nw = toW * vec3(0.0, 0.0, 1.0);
  // preserver crown plane
  vec3 pa = ro + rd * ((-0.62 - ro.z) / rd.z);
  float inner = sdRR(pa.xy, vec2(38.5, 32.0), 1.2);
  float well = sdRR(pa.xy, vec2(42.5, 36.0), 2.5);
  hitZ = -0.62;
  if (well > 0.0) return vec3(0.004, 0.003, 0.0025);              // the dark gap at the well wall
  float aaw = fwidth(inner) * 0.75 + 1e-4;
  vec3 pres = vec3(0.0);
  float wPres = smoothstep(-aaw, aaw, inner);
  if (wPres > 0.0){
    vec2 uv = pa.xy / vec2(85.0, 72.0) + 0.5;
    vec4 f = texture(uFrame, uv);
    vec3 n = normalize(vec3((f.xy * 2.0 - 1.0), 0.0) + vec3(0.0, 0.0, 1.0) * sqrt(max(0.0, 1.0 - dot(f.xy * 2.0 - 1.0, f.xy * 2.0 - 1.0))));
    vec3 Nn = normalize(toW * n);
    float c = max(dot(Nn, Vw), 0.0);
    vec3 R = reflect(-Vw, Nn);
    vec3 F0 = vec3(0.96, 0.76, 0.42);
    pres = fres(F0, c) * env(R, f.z * 0.55) + F0 * 0.04 * irr(Nn);
    pres *= 1.0 - 0.75 * f.w;
    pres *= 0.55 + 0.45 * smoothstep(3.9, 3.0, inner);              // the foil turns down into the well
  }
  if (wPres >= 1.0) return pres;
  // the cover glass (faintly wavy, as old glass is)
  vec3 pg = ro + rd * ((-1.0 - ro.z) / rd.z);
  vec3 gn = normalize(vec3(0.0025 * sin(pg.y * 0.21 + 1.0) + 0.0015 * sin(pg.x * 0.37), 0.002 * sin(pg.x * 0.17 + 2.0), 1.0));
  vec3 gnw = normalize(toW * gn);
  float cg = max(dot(gnw, Vw), 0.0);
  float Fg = 0.04 + 0.96 * pow(1.0 - cg, 5.0);
  vec3 glassRefl = Fg * env(reflect(-Vw, gnw), 0.0);
  vec3 rr = refract(rd, vec3(0.0, 0.0, 1.0), 1.0 / 1.52);
  vec3 pm = pg + rr * ((-2.3 - pg.z) / rr.z);
  float so = sdOval(pm.xy);
  float aao = fwidth(so) * 0.75 + 1e-4;
  vec3 col = vec3(0.0);
  float wMat = smoothstep(-aao, aao, so);
  vec3 matc = vec3(0.0), platec = vec3(0.0);
  if (wMat > 0.0){
    vec2 uv = pm.xy / vec2(85.0, 72.0) + 0.5;
    vec4 f = texture(uFrame, uv);
    vec2 d = f.xy * 2.0 - 1.0;
    vec3 n = normalize(vec3(d, sqrt(max(0.0, 1.0 - dot(d, d)))));
    vec3 Nn = normalize(toW * n);
    float c = max(dot(Nn, Vw), 0.0);
    vec3 R = reflect(-Vw, Nn);
    vec3 F0 = vec3(0.93, 0.71, 0.38);
    float rough = f.z;
    matc = fres(F0, c) * env(R, rough * 0.55) * (1.0 - 0.2 * rough) + F0 * (0.02 + 0.07 * rough) * irr(Nn);
    matc *= 1.0 - 0.8 * f.w;
    matc *= mix(vec3(1.0), vec3(0.75, 0.68, 0.6), smoothstep(0.3, 0.9, f.w));   // grime in the recesses
    float sh = smoothstep(0.0, 1.6, -inner);                          // the preserver's lip shades the mat edge
    matc *= 0.55 + 0.45 * sh;
  }
  if (wMat < 1.0){
    vec3 pp = pm + rr * ((-2.6 - pm.z) / rr.z);
    vec2 uv = pp.xy / vec2(74.0, 59.7) + 0.5;
    vec4 pt = texture(uPlate, uv);
    float D = pt.r, S = pt.g, T = pt.b * 320.0, X = pt.a;
    vec3 R = reflect(-Vw, Nw);
    float ci = clamp(dot(Nw, Vw), 0.0, 1.0);
    float dEff = T * sqrt(1.0 - (1.0 - ci * ci) / (1.7 * 1.7));
    vec3 tint = texture(uFilm, vec2(dEff / 320.0, 0.5)).rgb;
    float tl = dot(tint, vec3(0.3, 0.55, 0.15));
    tint = mix(vec3(tl), tint, 0.55);
    vec3 Ls = env(R, 0.0);
    float E = irr(Nw) * 0.95;
    float cover = clamp(D * 0.96 + S * 0.6, 0.0, 1.0);
    float spot = clamp(X * 2.0, 0.0, 1.0), haze = clamp(X * 2.0 - 1.0, 0.0, 1.0);
    vec3 spec = (1.0 - cover) * vec3(0.93, 0.915, 0.88) * tint * Ls;
    vec3 diff = (D * 0.40 + S * 0.36) * E * mix(vec3(1.0), tint, 0.45) * vec3(1.0, 0.985, 0.955);
    diff += 0.06 * E * pt.b * mix(vec3(0.5), tint, 1.0) * (1.0 - cover);   // the film itself, faintly seen in the dark
    platec = (spec + diff) * spot + haze * (0.55 * E + 0.2 * Ls);
    float edge = smoothstep(0.0, 0.5, -so);
    platec *= 0.6 + 0.4 * edge;                                       // the mat's cut edge shades the plate
  }
  col = mix(platec, matc, wMat) * vec3(0.955, 0.965, 0.945) + glassRefl;
  hitZ = -2.6;
  return mix(col, pres, wPres);
}

vec3 shade(vec2 frag){
  vec2 ndc = (frag / uRes) * 2.0 - 1.0;
  vec3 fw = normalize(uTgt - uCam), rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0))), up = cross(rt, fw);
  float aspect = uRes.x / uRes.y;
  vec3 rdw = normalize(fw + rt * ndc.x * uTanH + up * ndc.y * uTanH / aspect);
  vec3 ro = uM * (uCam - uT), rd = uM * rdw;
  mat3 toW = transpose(uM);
  vec3 Vw = -rdw;
  // background: the dark room, softly
  vec2 bq = frag / uRes - vec2(0.48, 0.55);
  vec3 bg = vec3(0.0105, 0.0092, 0.0082) * (1.15 - 0.9 * dot(bq, bq)) * (0.92 + 0.08 * vn(frag * 0.004));
  // march the case shell
  float t = 0.0;
  float pixA = 2.0 * uTanH / uRes.x;
  bool hit = false;
  float tb0 = length(ro) - 140.0;
  t = max(tb0, 0.0);
  for (int i = 0; i < 90; i++){
    vec3 p = ro + rd * t;
    float d = sdScene(p);
    if (d < 0.004 * t * pixA * 300.0 * 0.01 + 0.002){ hit = true; break; }
    t += d;
    if (t > length(ro) + 160.0) break;
  }
  if (!hit) return bg;
  vec3 p = ro + rd * t;
  vec3 nl = nScene(p);
  vec3 Nw = normalize(toW * nl);
  float db = sdBase(p), dl = sdLid(p);
  vec3 col;
  if (db <= dl){
    vec2 wq = p.xy;
    float well = sdRR(wq, vec2(42.5, 36.0), 2.5);
    if (nl.z > 0.6 && well < 0.0 && p.z > -0.3){
      float hz;
      col = package(ro, rd, toW, Vw, hz);
    } else {
      // leather; a gilt fillet tooled round the rim of the base
      float rim = sdRR(p.xy, CASE, 5.0);
      float gl1 = smoothstep(0.22, 0.08, abs(rim + 1.55)) * step(0.6, nl.z);
      float gl2 = smoothstep(0.1, 0.03, abs(rim + 2.55)) * step(0.6, nl.z) * step(0.5, fract((atan(p.y, p.x) * 60.0)));
      col = leather(p, Nw, Vw, max(gl1, gl2 * 0.8));
      col *= 0.6 + 0.4 * smoothstep(0.0, 1.2, well);                 // shadow at the lip of the well
    }
  } else {
    vec3 q = toLid(p);
    // the inverse rotation for normals: rotate by +uLid as for points
    vec3 nq = nl; nq.yz = rot(uLid) * nq.yz;
    float padR = sdRR(q.xy, vec2(42.6, 36.1), 3.0);
    if (q.z < 0.05 && padR < 0.4){
      // cushion normal: the dome of the pad with its puffed edge (closed frame)
      vec3 nc = nq;
      vec2 dome = q.xy / vec2(85.0, 72.0);
      nc = normalize(nc + vec3(dome * 0.35, 0.0));
      col = velvet(q.xy, nc, Vw, Nw, toW * mat3(1.0, 0.0, 0.0, 0.0, cos(uLid), -sin(uLid), 0.0, sin(uLid), cos(uLid)));
      float seam = smoothstep(-0.6, 0.3, padR);
      col *= 1.0 - 0.6 * seam;
    } else {
      float rim = sdRR(q.xy, CASE, 5.0);
      float gl1 = smoothstep(0.2, 0.07, abs(rim + 1.5)) * step(0.6, -nq.z);
      col = leather(q, Nw, Vw, gl1);
    }
  }
  return col;
}

void main(){
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 4; j++){
    if (j >= uSS * uSS) break;
    vec2 off = uSS == 1 ? vec2(0.5) : vec2(float(j % 2) * 0.5 + 0.25, float(j / 2) * 0.5 + 0.25);
    acc += shade(floor(gl_FragCoord.xy) + off);
  }
  vec3 c = acc / float(uSS * uSS);
  c *= 1.55;
  // filmic shoulder, deep toe
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
  c += (h2(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`;

  // ------------------------------------------------------------------------------------------------ JS helpers
  function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // thin-film interference colour of a silver sulphide film on silver, relative to bare silver, 0..320 nm
  function filmLUT() {
    const n = 256, out = new Uint8Array(n * 4);
    const g = (l, m, s1, s2) => { const s = l < m ? s1 : s2; return Math.exp(-0.5 * ((l - m) / s) ** 2); };
    const cmf = (l) => [1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
      0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1), 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8)];
    const C = (re, im) => ({ re, im }), add = (a, b) => C(a.re + b.re, a.im + b.im), sub = (a, b) => C(a.re - b.re, a.im - b.im);
    const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
    const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
    const cexp = (a) => { const e = Math.exp(a.re); return C(e * Math.cos(a.im), e * Math.sin(a.im)); };
    const refl = (d) => {
      let X = 0, Y = 0, Z = 0;
      for (let l = 380; l <= 720; l += 5) {
        const n1 = C(1, 0), n2 = C(2.35, 0.32), n3 = C(0.05, 2.1 + (l - 400) * 0.0088);
        const r12 = div(sub(n1, n2), add(n1, n2)), r23 = div(sub(n2, n3), add(n2, n3));
        const beta = mul(C(0, 4 * Math.PI * d / l), n2); // 2i * (2 pi n2 d / l)
        const e = cexp(beta);
        const r = div(add(r12, mul(r23, e)), add(C(1, 0), mul(mul(r12, r23), e)));
        const R = r.re * r.re + r.im * r.im;
        const [x, y, z] = cmf(l);
        X += R * x; Y += R * y; Z += R * z;
      }
      return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
    };
    const r0 = refl(0);
    for (let i = 0; i < n; i++) {
      const c = refl(i / (n - 1) * 320);
      for (let k = 0; k < 3; k++) out[i * 4 + k] = Math.max(0, Math.min(255, Math.round(255 * Math.min(1, c[k] / r0[k]))));
      out[i * 4 + 3] = 255;
    }
    return out;
  }

  function compile(src) {
    const sh = (type, s) => { const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) + '\n' + s.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n').slice(0, 0)); return o; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function makeTex(w, h, ifmt, fmt, type, data, filter, mips) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data || null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (mips && aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 16);
    return t;
  }
  function pass(prog, w, h, target, setup) {
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    gl.viewport(0, 0, w, h); gl.useProgram(prog.p);
    if (prog.u.uRes) gl.uniform2f(prog.u.uRes, w, h);
    setup && setup(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb);
  }
  async function inflate(b64) {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const ds = new DecompressionStream('deflate');
    const buf = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint16Array(buf);
  }

  // ------------------------------------------------------------------------------------------------ build
  let ready = false, mainProg, tex = {};
  const t0 = performance.now();
  async function build() {
    const P = window.PHOTO;
    const raw = await inflate(P.data);
    const logE = new Float32Array(P.w * P.h);
    for (let i = 0; i < logE.length; i++) logE[i] = raw[i] / 65535 * 18 - 14;
    const photo = makeTex(P.w, P.h, gl.R32F, gl.RED, gl.FLOAT, logE, gl.NEAREST, false);
    // plate
    const PW = 3072, PH = Math.round(3072 * 59.7 / 74);
    tex.plate = makeTex(PW, PH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR, true);
    const rnd = mulberry(1839);
    const arcA = new Float32Array(28 * 4), arcB = new Float32Array(28 * 4);
    for (let i = 0; i < 28; i++) {
      const cx = (rnd() - 0.5) * 70, cy = (rnd() - 0.5) * 56, R = 15 + rnd() * rnd() * 160, ang = rnd() * Math.PI * 2;
      const len = (2 + rnd() * 16) / R; // half-angle
      // centre so that the arc passes through (cx, cy)
      arcA.set([cx - Math.cos(ang) * R, cy - Math.sin(ang) * R, R, (i < 16 ? 1 : 0) * (0.05 + 0.28 * rnd() * rnd())], i * 4);
      arcB.set([ang, len, 0.018 + 0.03 * rnd(), 0], i * 4);
    }
    const pg = compile(PLATE_GEN);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, photo);
    pass(pg, PW, PH, tex.plate, (u) => {
      gl.uniform1i(u.uPhoto, 0); gl.uniform2f(u.uPhotoRes, P.w, P.h); gl.uniform1f(u.uExpo, 1.9);
      gl.uniform4fv(u.uArc, arcA); gl.uniform4fv(u.uArc2, arcB);
    });
    gl.bindTexture(gl.TEXTURE_2D, tex.plate); gl.generateMipmap(gl.TEXTURE_2D);
    // mat + preserver
    const FW = 2720, FH = Math.round(2720 * 72 / 85);
    const fh = makeTex(FW, FH, gl.RGBA32F, gl.RGBA, gl.FLOAT, null, gl.NEAREST, false);
    const arc = new Float32Array(65); let s = 0, prev = [33, 0];
    for (let i = 0; i <= 64; i++) { const ph = i / 64 * Math.PI / 2, p = [33 * Math.cos(ph), 26.5 * Math.sin(ph)]; s += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; arc[i] = s; }
    pass(compile(FRAME_H), FW, FH, fh, (u) => { gl.uniform1fv(u.uArcLen, arc); gl.uniform1f(u.uQLen, arc[64]); });
    tex.frame = makeTex(FW, FH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR, true);
    const np = compile(NORMALS);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fh);
    pass(np, FW, FH, tex.frame, (u) => { gl.uniform1i(u.uH, 0); gl.uniform2f(u.uSize, 85, 72); gl.uniform1f(u.uCav, 9.0); });
    gl.bindTexture(gl.TEXTURE_2D, tex.frame); gl.generateMipmap(gl.TEXTURE_2D);
    // velvet
    const VW = 2048, VH = Math.round(2048 * 72 / 85);
    const vh = makeTex(VW, VH, gl.RGBA32F, gl.RGBA, gl.FLOAT, null, gl.NEAREST, false);
    pass(compile(VELVET_H), VW, VH, vh);
    tex.velvet = makeTex(VW, VH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR, true);
    // reuse the normal pass: xy normal, G = pressed mask (as "rough"), A from cavity -> we want press & fibre:
    const VELVET_N = NORMALS.replace('o = vec4(n.xy * 0.5 + 0.5, me.g, cav);', 'o = vec4(n.xy * 0.5 + 0.5, me.g, me.b);');
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, vh);
    pass(compile(VELVET_N), VW, VH, tex.velvet, (u) => { gl.uniform1i(u.uH, 0); gl.uniform2f(u.uSize, 85, 72); gl.uniform1f(u.uCav, 0.0); });
    gl.bindTexture(gl.TEXTURE_2D, tex.velvet); gl.generateMipmap(gl.TEXTURE_2D);
    // film LUT
    tex.film = makeTex(256, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, filmLUT(), gl.LINEAR, false);
    gl.deleteTexture(fh); gl.deleteTexture(vh); gl.deleteTexture(photo);
    mainProg = compile(MAIN);
    gl.finish();
    api.buildMs = performance.now() - t0;
    ready = true;
  }

  // ------------------------------------------------------------------------------------------------ motion
  // The hand: one slow sway per loop with a second harmonic, the tilt axes out of phase so the plate's normal draws
  // a soft loop, never a pendulum. All periodic in DURATION.
  const deg = Math.PI / 180;
  function pose(t) {
    const w = 2 * Math.PI * t / DURATION;
    const rx = (-3.2 + 3.0 * Math.sin(w) + 0.55 * Math.sin(2 * w + 1.1)) * deg;   // tilt back/forward
    const ry = (2.6 * Math.sin(w + 1.9) + 0.45 * Math.sin(2 * w + 0.3)) * deg;     // turn left/right
    const rz = (0.5 * Math.sin(w + 0.7)) * deg;
    const ty = 0.5 * Math.sin(w + 2.3), tx = 0.4 * Math.sin(w + 0.4);
    return { rx, ry, rz, tx, ty };
  }
  function matFromPose(p) {
    // local -> world rotation R = Rz * Ry * Rx; the shader wants world -> local (R^T), column-major
    const cx = Math.cos(p.rx), sx = Math.sin(p.rx), cy = Math.cos(p.ry), sy = Math.sin(p.ry), cz = Math.cos(p.rz), sz = Math.sin(p.rz);
    const Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]], Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
    const mm = (A, B) => A.map((r, i) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    const R = mm(Rz, mm(Ry, Rx));
    // world->local = R^T; column-major storage of R^T is R's rows in order
    return new Float32Array([R[0][0], R[0][1], R[0][2], R[1][0], R[1][1], R[1][2], R[2][0], R[2][1], R[2][2]]);
  }

  let lastMs = 0;
  function renderAt(t, ss) {
    if (!ready) return;
    const tm = performance.now();
    const p = pose(((t % DURATION) + DURATION) % DURATION);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, CW, CH);
    gl.useProgram(mainProg.p);
    const u = mainProg.u;
    gl.uniform2f(u.uRes, CW, CH);
    gl.uniformMatrix3fv(u.uM, false, matFromPose(p));
    gl.uniform3f(u.uT, p.tx, p.ty, 0);
    gl.uniform1f(u.uLid, 124 * deg);
    gl.uniform3f(u.uCam, 0, 19.5, 300); gl.uniform3f(u.uTgt, 0, 19.5, 0);
    gl.uniform1f(u.uTanH, 0.174);
    gl.uniform1i(u.uSS, ss || 1);
    const units = [['uPlate', tex.plate], ['uFrame', tex.frame], ['uVelvet', tex.velvet], ['uFilm', tex.film]];
    units.forEach(([n, tx], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(u[n], i); });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    lastMs = performance.now() - tm;
  }
  function pixels() {
    const px = new Uint8Array(CW * CH * 4);
    gl.readPixels(0, 0, CW, CH, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const rgb = new Uint8Array(CW * CH * 3);
    for (let y = 0; y < CH; y++) { const src = (CH - 1 - y) * CW * 4, dst = y * CW * 3; for (let x = 0; x < CW; x++) { rgb[dst + x * 3] = px[src + x * 4]; rgb[dst + x * 3 + 1] = px[src + x * 4 + 1]; rgb[dst + x * 3 + 2] = px[src + x * 4 + 2]; } }
    let s = ''; for (let i = 0; i < rgb.length; i += 32768) s += String.fromCharCode.apply(null, rgb.subarray(i, i + 32768));
    return btoa(s);
  }
  const api = { renderAt, pixels, duration: DURATION, width: CW, height: CH, isReady: () => ready, get lastMs() { return lastMs; }, buildMs: 0, pose };
  if (EXPORT) window.__piece = api;
  build().then(() => {
    if (EXPORT) return;
    const ft = qs.get('t');
    if (ft !== null) { renderAt(+ft); return; }
    const start = performance.now();
    const loop = () => { renderAt(((performance.now() - start) / 1000) % DURATION); requestAnimationFrame(loop); };
    loop();
  }).catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="color:#c99">' + e.message + '</pre>'); });
})();
