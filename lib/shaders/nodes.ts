import { GLSL_PALETTE } from "./common";

export const nodesVert = /* glsl */ `
uniform float uTime;
uniform float uReveal;
uniform float uBreath;
uniform float uScale;
uniform float uSize;
uniform vec3  uHover;

attribute float aSeed;
attribute float aBorn;
attribute float aOwn;

varying float vAlpha;
varying float vHue;
varying float vHot;
varying float vHover;

void main(){
  vec3 p = position * (1.0 + uBreath * 0.011);
  p += normalize(p + 1e-5) * (0.012 + 0.006 * sin(uTime * 0.9 + aSeed * 30.0));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // Arrival flare: a thought burns bright for a few seconds after it lands.
  float age = uTime - aBorn;
  float fresh = aBorn < 0.0 ? 0.0 : exp(-max(age, 0.0) * 0.55);

  float hov = 1.0 - smoothstep(0.0, 0.055, distance(p, uHover));
  vHover = hov;

  float breathe = 0.55 + 0.45 * sin(uTime * 0.8 + aSeed * 44.0);
  vHot = fresh + hov;
  // Seeded thoughts sit violet; the visitor's own thoughts run warm.
  vHue = mix(0.06, 0.46, aOwn) + 0.06 * fract(aSeed * 7.3) + fresh * 0.2;
  vAlpha = uReveal * (0.55 + 0.45 * breathe);

  gl_PointSize = uSize * (0.8 + aSeed * 0.5) * (1.0 + fresh * 2.6 + hov * 1.8)
               * uScale / max(0.001, -mv.z);
}
`;

export const nodesFrag = /* glsl */ `
precision highp float;
varying float vAlpha;
varying float vHue;
varying float vHot;
varying float vHover;

${GLSL_PALETTE}

void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float r2 = dot(uv, uv);
  if (r2 > 0.25) discard;
  float d = sqrt(r2) * 2.0;

  float core = pow(1.0 - d, 3.0);
  float halo = exp(-d * 2.4) * 0.45;
  float ring = smoothstep(0.62, 0.80, d) * (1.0 - smoothstep(0.80, 0.98, d)) * vHover * 0.9;

  vec3 col = animaPalette(vHue) * (1.2 + vHot * 1.8);
  col += vec3(1.0, 0.97, 0.93) * core * core * (0.5 + vHot);

  gl_FragColor = vec4(col, (core + halo + ring) * vAlpha);
  #include <colorspace_fragment>
}
`;
