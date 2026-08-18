import { GLSL_PALETTE } from "./common";

export const dustVert = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uFade;

attribute float aSeed;
attribute float aSize;
attribute float aHue;

varying float vAlpha;
varying float vHue;
varying float vSoft;

void main(){
  vec3 p = position;

  // Each mote drifts on its own slow lissajous; nothing marches in lockstep.
  float t = uTime * 0.05;
  p.x += sin(t * 1.3 + aSeed * 62.0) * 0.5;
  p.y += cos(t * 1.1 + aSeed * 47.0) * 0.5;
  p.z += sin(t * 0.9 + aSeed * 31.0) * 0.5;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float dist = -mv.z;
  // Large, faint, out-of-focus motes sit far back; small crisp ones sit near.
  vSoft = aSize;
  vHue = aHue;
  vAlpha = uFade
         * mix(0.34, 0.045, aSize)
         * smoothstep(1.2, 4.0, dist)
         * (1.0 - smoothstep(14.0, 26.0, dist))
         * (0.5 + 0.5 * sin(uTime * 0.6 + aSeed * 90.0));

  gl_PointSize = (0.004 + aSize * 0.070) * uScale / max(0.001, dist);
}
`;

export const dustFrag = /* glsl */ `
precision highp float;
varying float vAlpha;
varying float vHue;
varying float vSoft;

${GLSL_PALETTE}

void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float r2 = dot(uv, uv);
  if (r2 > 0.25) discard;
  float d = sqrt(r2) * 2.0;

  // Soft motes are near-flat discs (bokeh); crisp ones are tight points.
  float core = pow(1.0 - d, mix(3.0, 0.9, vSoft));
  float ring = mix(0.0, smoothstep(0.55, 0.95, d) * (1.0 - smoothstep(0.95, 1.0, d)) * 0.4, vSoft);

  vec3 col = animaPalette(vHue) * mix(1.0, 0.55, vSoft);
  gl_FragColor = vec4(col, (core + ring) * vAlpha);
  #include <colorspace_fragment>
}
`;
