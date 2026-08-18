/**
 * Shared GLSL. The palette is deliberately narrow: a violet/magenta body with
 * amber and ice only as accents, so the scene reads as one luminous material
 * rather than a rainbow.
 */
export const GLSL_PALETTE = /* glsl */ `
vec3 animaPalette(float t){
  t = fract(t);
  vec3 A = vec3(0.357, 0.247, 0.910);   // indigo violet
  vec3 B = vec3(1.000, 0.322, 0.784);   // electric orchid
  vec3 C = vec3(1.000, 0.690, 0.478);   // warm amber rose
  vec3 D = vec3(0.498, 0.941, 1.000);   // pale ice
  float s = t * 4.0;
  vec3 col = A;
  col = mix(col, B, smoothstep(0.0, 1.0, clamp(s,       0.0, 1.0)));
  col = mix(col, C, smoothstep(0.0, 1.0, clamp(s - 1.0, 0.0, 1.0)));
  col = mix(col, D, smoothstep(0.0, 1.0, clamp(s - 2.0, 0.0, 1.0)));
  col = mix(col, A, smoothstep(0.0, 1.0, clamp(s - 3.0, 0.0, 1.0)));
  return col;
}
`;

export const GLSL_BEZIER = /* glsl */ `
vec3 animaBez(vec3 a, vec3 b, vec3 c, float t){
  float u = 1.0 - t;
  return u*u*a + 2.0*u*t*c + t*t*b;
}
vec3 animaBezTan(vec3 a, vec3 b, vec3 c, float t){
  return 2.0*(1.0 - t)*(c - a) + 2.0*t*(b - c);
}
`;

export const GLSL_NOISE = /* glsl */ `
float animaHash(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float animaNoise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(animaHash(i + vec3(0,0,0)), animaHash(i + vec3(1,0,0)), f.x),
        mix(animaHash(i + vec3(0,1,0)), animaHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(animaHash(i + vec3(0,0,1)), animaHash(i + vec3(1,0,1)), f.x),
        mix(animaHash(i + vec3(0,1,1)), animaHash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float animaFbm(vec3 p){
  float s = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for(int i = 0; i < 5; i++){
    s += a * animaNoise(p);
    p.xy = rot * p.xy;
    p *= 2.02;
    a *= 0.5;
  }
  return s;
}
`;

/** Billboarded ribbon offset: perpendicular to the curve tangent, in view space. */
export const GLSL_RIBBON = /* glsl */ `
vec2 animaPerp(vec3 tangentView){
  vec2 tp = tangentView.xy;
  float l = length(tp);
  return l > 1e-4 ? vec2(-tp.y, tp.x) / l : vec2(1.0, 0.0);
}
`;
