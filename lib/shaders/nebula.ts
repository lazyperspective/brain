import { GLSL_NOISE } from "./common";

export const nebulaVert = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export const nebulaFrag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2  uRes;
uniform vec2  uParallax;
uniform float uBreath;
uniform float uFlash;
uniform float uMotion;

varying vec2 vUv;

${GLSL_NOISE}

void main(){
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);

  // Three cloud layers at different scales and parallax depths. The depth comes
  // from them sliding at different rates, not from any explicit z.
  float t = uTime * 0.026 * uMotion;

  vec2 q1 = p * 1.10 + uParallax * 0.030;
  float warp = animaFbm(vec3(q1 * 1.6, t * 2.0));
  vec2 q1w = q1 + vec2(warp, warp * 0.7) * 0.55;
  float far = animaFbm(vec3(q1w, t));

  vec2 q2 = p * 2.20 + uParallax * 0.070 + vec2(3.1, -1.4);
  float mid = animaFbm(vec3(q2 + vec2(far * 0.4), t * 1.7));

  vec2 q3 = p * 4.40 + uParallax * 0.130 + vec2(-7.2, 5.5);
  float near = animaFbm(vec3(q3, t * 2.6));

  // fbm sits around a 0.48 mean, so using it raw paints a flat wash. Threshold
  // it into sparse wisps instead — the darkness between them is the point.
  float f1 = smoothstep(0.46, 0.90, far);
  float f2 = smoothstep(0.52, 0.95, mid);
  float f3 = smoothstep(0.63, 0.97, near);

  vec3 col = vec3(0.007, 0.005, 0.020);

  col += vec3(0.085, 0.030, 0.170) * f1 * 0.26;   // deep plum body
  col += vec3(0.140, 0.055, 0.250) * f2 * 0.16;   // violet mid clouds
  col += vec3(0.230, 0.080, 0.110) * f3 * 0.11;   // sparse warm filaments
  col += vec3(0.020, 0.060, 0.120) * f2           // cool counterweight, low field
       * smoothstep(0.70, -0.10, uv.y) * 0.18;

  // Two light veils crossing at different angles and rates, so the field is
  // never quite still. exp(-v*v) turns each sine into a soft band rather than a
  // stripe, and the differing speeds mean they never settle into a pattern.
  float vt = uTime * uMotion;
  float v1 = sin(p.x * 0.85 - p.y * 1.35 + vt * 0.055);
  col += vec3(0.030, 0.058, 0.135) * exp(-v1 * v1 * 2.1) * 0.55;

  float v2 = sin(p.x * 1.45 + p.y * 0.65 - vt * 0.037 + 2.1);
  col += vec3(0.105, 0.042, 0.016) * exp(-v2 * v2 * 3.0) * 0.42;

  // A third, much broader and slower swell keeps the whole field breathing.
  float v3 = sin(p.y * 0.7 + vt * 0.021 - 1.2);
  col += vec3(0.040, 0.022, 0.075) * exp(-v3 * v3 * 1.4) * 0.5;

  // The halo the brain sits inside, breathing with it.
  vec2 c = p - uParallax * 0.020 - vec2(0.0, -0.02);
  float r = length(c * vec2(1.0, 1.22));
  float halo = exp(-r * r * 2.6);
  col += vec3(0.024, 0.009, 0.046) * halo * (0.9 + uBreath * 0.22);
  col += vec3(0.010, 0.004, 0.020) * exp(-r * 1.4);

  // Thought-submission wash
  col += vec3(0.16, 0.09, 0.26) * halo * uFlash;

  // Vignette
  float vig = 1.0 - smoothstep(0.42, 1.28, length(p));
  col *= mix(0.30, 1.0, vig);

  // Grain, mandatory on gradients this dark or they band badly.
  float g = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  col += (g - 0.5) * 0.016;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #include <colorspace_fragment>
}
`;
