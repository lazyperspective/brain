import { GLSL_PALETTE, GLSL_BEZIER, GLSL_RIBBON } from "./common";

export const synapseVert = /* glsl */ `
uniform float uTime;
uniform float uReveal;
uniform float uBreath;
uniform vec3  uImpact;
uniform float uImpactAge;

attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec3 aCtrl;
attribute vec4 aMeta;   // birth, life, width, seed
attribute float aHue;

varying float vT;
varying float vAcross;
varying float vSeed;
varying float vAge;
varying float vHue;
varying float vFlare;

${GLSL_BEZIER}
${GLSL_RIBBON}

void main(){
  float t = uv.x;
  vAcross = uv.y - 0.5;
  vT = t;
  vSeed = aMeta.w;
  vHue = aHue;

  float age = clamp((uTime - aMeta.x) / aMeta.y, 0.0, 1.0);
  vAge = age;

  vec3 a = aStart * (1.0 + uBreath * 0.011);
  vec3 b = aEnd   * (1.0 + uBreath * 0.011);
  vec3 c = aCtrl  * (1.0 + uBreath * 0.011);

  vec3 P = animaBez(a, b, c, t);
  vec3 T = normalize(animaBezTan(a, b, c, t) + 1e-5);

  // Two out-of-phase lateral waves keep the fibre from ever looking like a wire.
  vec3 side = normalize(cross(T, vec3(0.0, 1.0, 0.0)) + 1e-4);
  vec3 up = cross(side, T);
  float amp = 0.014 * sin(t * 3.14159);
  P += side * sin(t * 9.4 + uTime * 0.9 + aMeta.w * 31.0) * amp;
  P += up   * cos(t * 6.9 - uTime * 0.7 + aMeta.w * 17.0) * amp;

  // Nearby fibres flare when a thought lands.
  float flare = 0.0;
  if (uImpactAge < 2.6) {
    float r = length(P - uImpact);
    float band = (r - uImpactAge * 0.9) * 5.0;
    flare = exp(-band * band) * (1.0 - uImpactAge / 2.6);
  }
  vFlare = flare;

  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  vec3 tanView = (modelViewMatrix * vec4(T, 0.0)).xyz;
  vec2 perp = animaPerp(tanView);

  float w = aMeta.z * pow(max(sin(t * 3.14159), 0.0), 0.35);
  w *= 1.0 + flare * 2.5;
  w *= uReveal;
  mv.xy += perp * w * vAcross;

  gl_Position = projectionMatrix * mv;
}
`;

export const synapseFrag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uReveal;

varying float vT;
varying float vAcross;
varying float vSeed;
varying float vAge;
varying float vHue;
varying float vFlare;

${GLSL_PALETTE}

void main(){
  float edge = max(1.0 - abs(vAcross) * 2.0, 0.0);
  float body = pow(edge, 1.7);
  float core = pow(edge, 9.0);

  // A fibre draws itself in from one end, holds, then erases from the same end.
  float head = smoothstep(0.0, 0.36, vAge);
  float tail = smoothstep(0.64, 1.0, vAge);
  float vis = smoothstep(head, head - 0.10, vT) * smoothstep(tail - 0.02, tail + 0.10, vT);
  float env = smoothstep(0.0, 0.07, vAge) * (1.0 - smoothstep(0.86, 1.0, vAge));

  // Charge packets running the length of the fibre.
  float pulses = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float sp = 0.20 + fi * 0.09 + vSeed * 0.14;
    float ph = fract(uTime * sp + vSeed * 7.3 + fi * 0.41);
    float d = vT - ph;
    pulses += exp(-d * d * 300.0);
  }

  float hue = vHue + pulses * 0.14 + vFlare * 0.3;
  vec3 col = animaPalette(hue) * (0.78 + pulses * 2.5 + vFlare * 2.2);
  col += vec3(1.0, 0.95, 0.9) * core * (pulses * 1.35 + vFlare * 1.1);

  float a = body * env * vis * uReveal * (0.26 + pulses * 0.95 + vFlare * 0.8);

  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;
