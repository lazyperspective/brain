import { GLSL_PALETTE, GLSL_NOISE } from "./common";

export const orbVert = /* glsl */ `
uniform float uTime;
uniform float uSquash;   // 0 = sphere, 1 = stretched along travel
uniform vec3  uDir;
uniform float uWobble;

varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;

${GLSL_NOISE}

void main(){
  vec3 p = position;

  // Liquid surface: low-frequency noise breathing over the droplet.
  float n = animaNoise(p * 3.2 + vec3(uTime * 0.9)) - 0.5;
  float n2 = animaNoise(p * 6.4 - vec3(uTime * 1.4)) - 0.5;
  p += normal * (n * 0.095 + n2 * 0.035) * uWobble;

  // Stretch into a teardrop along the direction of travel.
  float along = dot(normalize(p + 1e-5), uDir);
  p += uDir * along * uSquash * 0.55;
  p -= normalize(p + 1e-5) * uSquash * 0.12;

  vLocal = p;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const orbFrag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uHue;
uniform float uIntensity;

varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;

${GLSL_PALETTE}
${GLSL_NOISE}

void main(){
  float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);

  // Energy churning inside the droplet. Band-passing the noise draws literal
  // iso-contour rings, so ramp it instead and let the shell read as light.
  float swirl = animaFbm(vLocal * 3.4 + vec3(uTime * 1.3, uTime * -0.9, uTime * 0.7));
  float energy = smoothstep(0.34, 0.86, swirl);

  vec3 col = animaPalette(uHue + swirl * 0.05) * (0.55 + energy * 1.5);
  col += animaPalette(uHue + 0.26) * fres * 2.2;
  col += vec3(1.0, 0.96, 0.92) * pow(energy, 2.6) * 1.35;

  float a = clamp(0.34 + fres * 0.8 + energy * 0.42, 0.0, 1.0);
  gl_FragColor = vec4(col * uIntensity, a * uIntensity);
  #include <colorspace_fragment>
}
`;

export const trailVert = /* glsl */ `
uniform float uScale;
uniform float uSize;
uniform float uAlpha;
attribute float aIndex;
varying float vFade;
varying float vI;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vFade = pow(1.0 - aIndex, 1.7) * uAlpha;
  vI = aIndex;
  gl_PointSize = uSize * (1.0 - aIndex * 0.75) * uScale / max(0.001, -mv.z);
}
`;

export const trailFrag = /* glsl */ `
precision highp float;
uniform float uHue;
varying float vFade;
varying float vI;

${GLSL_PALETTE}

void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float r2 = dot(uv, uv);
  if (r2 > 0.25) discard;
  float d = sqrt(r2) * 2.0;
  float core = pow(1.0 - d, 2.4);
  vec3 col = animaPalette(uHue + vI * 0.12) * 1.6;
  col += vec3(1.0, 0.95, 0.9) * core * core * (1.0 - vI);
  gl_FragColor = vec4(col, (core + exp(-d * 2.8) * 0.4) * vFade);
  #include <colorspace_fragment>
}
`;
