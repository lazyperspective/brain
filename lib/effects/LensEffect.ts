import { BlendFunction, Effect } from "postprocessing";
import { Uniform, Vector4 } from "three";

/**
 * Screen-space refraction. Three lenses warp the frame:
 *   0 — the cursor, a soft constant presence
 *   1 — a thought droplet in flight
 *   2 — the expanding shockwave when one lands
 * Each also splits colour channels along the displacement, which is what reads
 * as glass rather than as a wobble.
 */
const fragment = /* glsl */ `
uniform vec4 uLenses[3];
uniform float uAspect;
uniform float uWarp;

vec2 animaToUv(vec2 v){ return vec2(v.x / uAspect, v.y); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec2 off = vec2(0.0);

  // Droplet lenses: pull samples toward the centre, which magnifies.
  for (int i = 0; i < 2; i++) {
    vec4 L = uLenses[i];
    if (L.w > 0.001) {
      vec2 d = (uv - L.xy) * vec2(uAspect, 1.0);
      float t = length(d) / max(L.z, 1e-4);
      if (t < 1.0) {
        float bend = 1.0 - t * t;
        bend *= bend;
        off -= animaToUv(normalize(d + 1e-6)) * bend * L.w * 0.034;
      }
    }
  }

  // Shockwave: a travelling ring rather than a lens.
  vec4 S = uLenses[2];
  if (S.w > 0.001) {
    vec2 d = (uv - S.xy) * vec2(uAspect, 1.0);
    float band = (length(d) - S.z) * 9.0;
    off += animaToUv(normalize(d + 1e-6)) * exp(-band * band) * S.w * 0.05;
  }

  // Whole-frame breathing barrel, tied to the brain's own rhythm.
  vec2 cc = (uv - 0.5) * vec2(uAspect, 1.0);
  off += animaToUv(cc) * dot(cc, cc) * uWarp;

  vec2 base = clamp(uv + off, vec2(0.0), vec2(1.0));
  vec2 split = off * 0.13;
  vec4 cr = texture2D(inputBuffer, clamp(base + split, vec2(0.0), vec2(1.0)));
  vec4 cg = texture2D(inputBuffer, base);
  vec4 cb = texture2D(inputBuffer, clamp(base - split, vec2(0.0), vec2(1.0)));

  outputColor = vec4(cr.r, cg.g, cb.b, 1.0);
}
`;

export class LensEffect extends Effect {
  constructor() {
    super("LensEffect", fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        [
          "uLenses",
          new Uniform([new Vector4(), new Vector4(), new Vector4()]),
        ],
        ["uAspect", new Uniform(1)],
        ["uWarp", new Uniform(0)],
      ]),
    });
  }

  setLens(i: number, x: number, y: number, radius: number, strength: number) {
    const arr = this.uniforms.get("uLenses")!.value as Vector4[];
    arr[i].set(x, y, radius, strength);
  }

  setAspect(a: number) {
    this.uniforms.get("uAspect")!.value = a;
  }

  setWarp(w: number) {
    this.uniforms.get("uWarp")!.value = w;
  }
}
