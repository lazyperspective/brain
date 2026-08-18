import { GLSL_PALETTE, GLSL_BEZIER } from "./common";

export const motesVert = /* glsl */ `
uniform float uTime;
uniform float uReveal;
uniform float uBreath;
uniform float uScale;
uniform float uSize;

attribute vec3  aA;
attribute vec3  aB;
attribute vec3  aC;
attribute vec4  aMeta;   // offset, speed, size, hue
attribute float aTrail;  // 0 = head, 3 = tail

varying float vAlpha;
varying float vHue;
varying float vHead;

${GLSL_BEZIER}

void main(){
  float t = fract(uTime * aMeta.y + aMeta.x - aTrail * 0.014);
  vec3 P = animaBez(aA, aB, aC, t) * (1.0 + uBreath * 0.011);

  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mv;

  // Fade at both ends of the path so the loop point is never visible.
  float ends = smoothstep(0.0, 0.10, t) * (1.0 - smoothstep(0.88, 1.0, t));
  float trailFade = 1.0 - aTrail * 0.26;

  vHead = 1.0 - aTrail * 0.33;
  vHue = aMeta.w;
  vAlpha = ends * trailFade * uReveal;

  gl_PointSize = uSize * aMeta.z * (1.0 - aTrail * 0.18) * uScale / max(0.001, -mv.z);
}
`;

export const motesFrag = /* glsl */ `
precision highp float;
varying float vAlpha;
varying float vHue;
varying float vHead;

${GLSL_PALETTE}

void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float r2 = dot(uv, uv);
  if (r2 > 0.25) discard;
  float d = sqrt(r2) * 2.0;
  float core = pow(1.0 - d, 2.2);
  float halo = exp(-d * 2.6) * 0.5;

  vec3 col = animaPalette(vHue) * (0.85 + vHead * 1.05);
  col += vec3(1.0, 0.97, 0.94) * core * core * vHead * 1.6;

  gl_FragColor = vec4(col, (core + halo) * vAlpha);
  #include <colorspace_fragment>
}
`;
