import { GLSL_PALETTE } from "./common";

export const pointsVert = /* glsl */ `
uniform float uTime;
uniform float uReveal;
uniform float uBreath;
uniform vec3  uCursor;
uniform float uCursorStr;
uniform vec3  uImpact;
uniform float uImpactAge;
uniform float uSize;
uniform float uScale;
uniform float uDim;

attribute float aSeed;
attribute float aDepth;
attribute float aRidge;
attribute float aTint;
attribute float aAO;
attribute vec3  aNormal;
attribute vec3  aScatter;

varying float vAlpha;
varying float vGlow;
varying float vHue;
varying float vCore;

void main(){
  vec3 p = position;

  // Arrival: points condense inward from a loose shell, staggered by seed.
  float rv = clamp((uReveal - aSeed * 0.42) / 0.58, 0.0, 1.0);
  rv = rv * rv * (3.0 - 2.0 * rv);
  p = mix(aScatter, p, rv);

  // Breath: inflate along the surface normal, plus a whole-body scale.
  p += aNormal * uBreath * (0.014 + 0.011 * aSeed);
  p *= 1.0 + uBreath * 0.011;

  // Slow organic shimmer so nothing is ever perfectly still.
  p += aNormal * sin(uTime * 0.35 + aSeed * 6.2831) * 0.004;
  p.x += sin(uTime * 0.21 + p.y * 3.1 + aSeed * 3.0) * 0.005;
  p.y += cos(uTime * 0.19 + p.z * 2.7 + aSeed * 4.0) * 0.005;

  // Cursor pushes a soft bulge through the cortex.
  vec3 toCursor = p - uCursor;
  float cd = length(toCursor);
  float infl = exp(-cd * cd * 6.5) * uCursorStr;
  p += normalize(toCursor + 1e-5) * infl * 0.07;

  // Thought impact: an expanding shell of displacement and light.
  float ring = 0.0;
  if (uImpactAge < 2.6) {
    float r = length(p - uImpact);
    float front = uImpactAge * 0.9;
    float band = (r - front) * 6.5;
    ring = exp(-band * band) * (1.0 - uImpactAge / 2.6);
    p += normalize(p - uImpact + 1e-5) * ring * 0.055;
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // Facing term: points on the far side dim, which is what makes a point cloud
  // read as a solid body instead of a haze.
  vec3 nView = normalize((modelViewMatrix * vec4(aNormal, 0.0)).xyz);
  vec3 viewDir = normalize(-mv.xyz);
  float facing = dot(nView, viewDir);
  float rim = pow(1.0 - abs(facing), 3.0);
  float faceDim = mix(0.14, 1.0, smoothstep(-0.75, 0.45, facing));

  // A ray grazing the shell crosses ~1/cos(theta) times as many points as one
  // hitting it face-on, which renders the cortex as a hollow ring. Scaling
  // brightness by cos(theta) — i.e. |facing| — cancels that almost exactly.
  float graze = 0.22 + 0.78 * abs(facing);

  // Interior points carry a synthetic radial normal, so neither term is
  // meaningful for them; hold both near neutral instead.
  faceDim = mix(faceDim, 0.72, aDepth);
  graze = mix(graze, 0.9, aDepth);

  // Slow activation swells drifting through the cortex. Per-point twinkle alone
  // is uniform noise; these give the body large-scale structure and are what
  // actually reads as thinking.
  vec3 w1 = vec3(sin(uTime * 0.23) * 0.55,
                 cos(uTime * 0.19) * 0.34,
                 sin(uTime * 0.17 + 2.0) * 0.60);
  vec3 w2 = vec3(cos(uTime * 0.14 + 1.0) * 0.62,
                 sin(uTime * 0.21 + 3.0) * 0.30,
                 cos(uTime * 0.26) * 0.52);
  vec3 w3 = vec3(sin(uTime * 0.11 + 4.0) * 0.45,
                 cos(uTime * 0.29 + 1.5) * 0.38,
                 sin(uTime * 0.13 + 0.5) * 0.55);
  vec3 d1 = p - w1;
  vec3 d2 = p - w2;
  vec3 d3 = p - w3;
  float act = exp(-dot(d1, d1) * 3.4)
            + exp(-dot(d2, d2) * 4.2) * 0.85
            + exp(-dot(d3, d3) * 5.0) * 0.7;

  float pulse = 0.5 + 0.5 * sin(uTime * 1.15 + aSeed * 41.0 + p.z * 3.0);
  // Twinkle concentrates wherever a swell is currently passing.
  float firing = smoothstep(0.94 - act * 0.22, 1.0, pulse);

  // --- form lighting -------------------------------------------------------
  // Every other term here is view-relative, which means the body had no light
  // direction and therefore no form. A fixed key/fill pair in VIEW space gives
  // it a lit side and a shadowed side that hold as the brain turns beneath it.
  vec3 KEY  = normalize(vec3(-0.40, 0.66, 0.62));
  vec3 FILL = normalize(vec3( 0.76, -0.28, 0.34));

  // Biased past half-lambert so a real portion of the body falls into shadow.
  float key = clamp(dot(nView, KEY) * 0.62 + 0.38, 0.0, 1.0);
  key = key * key * (3.0 - 2.0 * key);
  key = pow(key, 1.5);
  float fill = clamp(dot(nView, FILL) * 0.5 + 0.5, 0.0, 1.0);

  // Sulci are cavities: they lose the key light first and stay dark, which is
  // what reads as folding rather than as texture.
  float cavity = mix(0.15, 1.0, aRidge);
  float occl = mix(0.10, 1.0, aAO);
  float lit = (0.05 + 1.20 * key * cavity + 0.20 * fill * mix(0.35, 1.0, aRidge)) * occl;
  // Interior points carry synthetic normals, so light them flatly.
  lit = mix(lit, 0.42, aDepth);

  // Aerial perspective: the near half of the body sits forward of the far half.
  float relZ = mv.z - (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z;
  float depthCue = mix(0.58, 1.12, clamp(relZ / 1.9 + 0.5, 0.0, 1.0));

  float body = mix(1.30, 0.40, aDepth);
  vGlow = body * faceDim * graze * depthCue * lit
          * (0.70 + 0.10 * pulse + 0.09 * rim + min(act, 1.3) * 0.20)
        + firing * 0.85
        + infl * 2.6
        + ring * 2.0;

  // Idle cortex sits in the violet band; firing shifts it toward amber and ice.
  // Hue has to vary SPATIALLY, not per point. Randomising hue per point makes
  // neighbouring sprites cancel under additive blending and the whole body
  // averages to white; coherent regions instead read as actual colour.
  // Weighted to the vertical axis on purpose: the camera looks roughly along z,
  // so any hue variation in z gets integrated away along each view ray. Varying
  // it in y keeps the gradient coherent from front to back and it survives.
  vHue = 0.92
       + aTint * (1.0 - aDepth * 0.6)
       + 0.13 * sin(p.y * 1.6 + uTime * 0.04)
       + 0.06 * sin(p.x * 1.4 + uTime * 0.031)
       + 0.035 * fract(aSeed * 13.7)
       // Lit crowns run warm, shadowed sulci fall cool — colour temperature
       // doing the same job as the value shading.
       + key * 0.10
       - (1.0 - aRidge) * 0.09 * (1.0 - aDepth)
       - (1.0 - aAO) * 0.10 * (1.0 - aDepth)
       - (1.0 - depthCue) * 0.10
       + firing * 0.30 + ring * 0.28 + min(act, 1.2) * 0.09;

  vCore = firing + ring;
  vAlpha = rv * mix(1.0, 0.5, aDepth) * mix(0.45, 1.0, faceDim) * uDim;

  float size = uSize * mix(1.0, 0.62, aDepth) * (0.68 + aSeed * 0.62);
  size *= 1.0 + firing * 1.0 + act * 0.28 + infl * 3.2 + ring * 2.4;
  gl_PointSize = size * uScale / max(0.001, -mv.z);
}
`;

export const pointsFrag = /* glsl */ `
precision highp float;
varying float vAlpha;
varying float vGlow;
varying float vHue;
varying float vCore;

${GLSL_PALETTE}

void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float r2 = dot(uv, uv);
  if (r2 > 0.25) discard;
  float d = sqrt(r2) * 2.0;

  float core = pow(1.0 - d, 2.4);
  float halo = exp(-d * 2.1) * 0.55;
  float a = (core + halo) * vAlpha;

  vec3 col = animaPalette(vHue) * vGlow;
  col += vec3(1.0, 0.96, 0.92) * core * core * vCore * 1.15;

  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
`;
