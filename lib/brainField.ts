import { perlin3 } from "./noise";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Cheap normalized ellipsoid field from pre-centred deltas. */
function ellip(
  dx: number,
  dy: number,
  dz: number,
  rx: number,
  ry: number,
  rz: number
) {
  const a = dx / rx;
  const b = dy / ry;
  const c = dz / rz;
  const k = Math.sqrt(a * a + b * b + c * c);
  return (k - 1) * Math.min(rx, Math.min(ry, rz));
}

export const BOUNDS = {
  xMin: -0.92,
  xMax: 0.92,
  yMin: -1.08,
  yMax: 0.86,
  zMin: -1.1,
  zMax: 1.12,
};

/**
 * Smooth anatomical mass: two hemispheres, temporal lobes, cerebellum, stem,
 * plus the three sulci that actually carry the silhouette.
 * Negative = inside.
 */
export function analyticField(x: number, y: number, z: number): number {
  // Frontal and occipital poles are narrower than the parietal midsection.
  const front = smoothstep(0.08, 0.94, z);
  const back = smoothstep(-0.12, -0.92, z);
  const widen = 1 + 0.34 * front + 0.3 * back;
  const xs = x * widen;

  // Orbital surface sits high and flat; the vertex slopes down toward the frontal pole.
  const ys =
    y -
    0.16 * front * smoothstep(0.08, -0.44, y) +
    0.1 * front * smoothstep(0.05, 0.45, y);

  // Cerebral hemispheres, softly fused across the midline.
  const dy = ys - 0.115;
  const dz = z + 0.03;
  const left = ellip(xs + 0.285, dy, dz, 0.415, 0.545, 0.865);
  const right = ellip(xs - 0.285, dy, dz, 0.415, 0.545, 0.865);
  let f = smin(left, right, 0.3);

  // Temporal lobes (mirrored via |x|, they never cross the midline).
  const temporal = ellip(Math.abs(xs) - 0.42, y + 0.3, z - 0.14, 0.2, 0.235, 0.42);
  f = smin(f, temporal, 0.2);

  // Cerebellum: two tucked lobes behind and below.
  const cereb = ellip(Math.abs(x) - 0.2, y + 0.45, z + 0.63, 0.26, 0.215, 0.28);
  f = smin(f, cereb, 0.13);

  // Brain stem: tapered capsule dropping from the midbrain.
  {
    const pax = x;
    const pay = y + 0.26;
    const paz = z + 0.3;
    // The stem lies on the midline, so the axis has no x component.
    const bay = -0.52;
    const baz = 0.16;
    const bb = bay * bay + baz * baz;
    let h = (pay * bay + paz * baz) / bb;
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const qx = pax;
    const qy = pay - bay * h;
    const qz = paz - baz * h;
    const r = 0.115 - 0.055 * h;
    const stem = Math.sqrt(qx * qx + qy * qy + qz * qz) - r;
    f = smin(f, stem, 0.1);
  }

  // --- sulci: positive terms carve inward ---
  // Their combined amplitude is bounded by 0.21, so far from the surface they
  // cannot change the sign of f. Skipping them there removes four exp() calls
  // from the ~70% of samples that the sampler rejects outright.
  if (f > 0.22 || f < -0.22) return f;


  // Longitudinal fissure down the midline of the cerebrum.
  f += 0.078 * Math.exp((-x * x) / (2 * 0.058 * 0.058)) * smoothstep(-0.22, 0.16, y);

  // Lateral (Sylvian) fissure, ascending toward the back.
  const dLat = y + 0.11 + 0.16 * z;
  f +=
    0.044 *
    Math.exp((-dLat * dLat) / (2 * 0.045 * 0.045)) *
    smoothstep(0.24, 0.46, Math.abs(x)) *
    smoothstep(-0.78, -0.5, z);

  // Central sulcus, running anterolaterally down from the vertex.
  const dCen = z - (0.02 + 0.42 * Math.abs(x) - 0.3 * (y - 0.4));
  f +=
    0.032 *
    Math.exp((-dCen * dCen) / (2 * 0.042 * 0.042)) *
    smoothstep(-0.18, 0.14, y);

  // Transverse fissure: the notch that separates occipital lobe from cerebellum.
  // Masked away from the midline so the cerebellum stays tethered to the stem.
  const dTr = y + 0.29;
  f +=
    0.055 *
    Math.exp((-dTr * dTr) / (2 * 0.05 * 0.05)) *
    smoothstep(-0.26, -0.52, z) *
    smoothstep(0.08, 0.24, Math.abs(x));

  return f;
}

/**
 * Full field including gyri. Ridged noise: the zero-crossing contours of a
 * Perlin field are winding closed curves, which is exactly the topology of
 * cortical folds. Pushing outward along them raises gyri and leaves sulci.
 */
export function brainField(x: number, y: number, z: number): number {
  let f = analyticField(x, y, z);

  const n1 = perlin3(x * 5.6, y * 5.9, z * 5.2);
  const r1 = 1 - Math.min(1, Math.abs(n1) / 0.42);
  const n2 = perlin3(x * 11.5 + 31.2, y * 12.1 - 8.4, z * 11.0 + 17.7);
  const r2 = 1 - Math.min(1, Math.abs(n2) / 0.42);
  f -= 0.05 * r1 * r1 + 0.016 * r2 * r2;

  // Cerebellum wears much finer, near-horizontal striations.
  const cd = Math.sqrt(
    x * x * 0.55 + (y + 0.45) * (y + 0.45) * 1.6 + (z + 0.63) * (z + 0.63) * 1.4
  );
  const cbMask = smoothstep(0.44, 0.14, cd);
  if (cbMask > 0.002) {
    const nc = perlin3(x * 4.0, (y + 0.45) * 30.0, (z + 0.63) * 21.0);
    f -= cbMask * 0.03 * (1 - Math.min(1, Math.abs(nc) / 0.45));
  }

  return f;
}

/** Gradient of the smooth field only — enough for shading direction, 4 taps. */
export function analyticNormal(x: number, y: number, z: number) {
  const e = 0.012;
  const a = analyticField(x + e, y - e, z - e);
  const b = analyticField(x - e, y - e, z + e);
  const c = analyticField(x - e, y + e, z - e);
  const d = analyticField(x + e, y + e, z + e);
  let nx = a - b - c + d;
  let ny = -a - b + c + d;
  let nz = -a + b - c + d;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / len, ny / len, nz / len] as const;
}
