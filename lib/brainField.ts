import { perlin3 } from "./noise";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

const GYRI_MAIN = 0.058;
const GYRI_FINE = 0.020;

/** Scratch for the warp, so the hot path allocates nothing. */
const _warp = { x: 0, y: 0, z: 0 };

/**
 * Slow domain warp applied before the ridge noise. Un-warped ridged noise is
 * isotropic and reads as coral; bending the sample point with a low-frequency
 * field turns the ridge contours into the meandering runs a cortex has.
 */
function gyriWarp(x: number, y: number, z: number) {
  const wf = 1.9;
  const wa = 0.085;
  _warp.x = x + perlin3(x * wf + 11.3, y * wf - 4.1, z * wf + 7.7) * wa;
  _warp.y = y + perlin3(x * wf - 3.7, y * wf + 9.2, z * wf - 2.4) * wa;
  _warp.z = z + perlin3(x * wf + 5.1, y * wf + 1.8, z * wf + 13.6) * wa;
  return _warp;
}

/**
 * Ridged noise, smoothstepped. Plain `1 - |n|` is a tent — it leaves a crease
 * along every crest and every valley floor, which reads as sharp coral rather
 * than tissue. Smoothstepping flattens the derivative at both ends, giving
 * rounded crowns and soft-bottomed sulci.
 */
function ridged(x: number, y: number, z: number) {
  const r = clamp01(1 - Math.abs(perlin3(x, y, z)) / 0.42);
  return r * r * (3 - 2 * r);
}

/** Normalised fold height: 0 down in a sulcus, 1 on a gyral crown. */
export function gyralHeight(x: number, y: number, z: number): number {
  const w = gyriWarp(x, y, z);
  return ridged(w.x * 6.4, w.y * 6.2, w.z * 3.4);
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

/** Scratch for shaped coordinates, so the hot path allocates nothing. */
const _shaped = { xs: 0, ys: 0, occ: 0 };

/**
 * Anterior/posterior shaping applied before the hemispheres are evaluated.
 *
 * The two poles are not alike, and that difference is what tells you which way
 * the brain is facing. The frontal pole is markedly narrower than the parietal
 * midsection; the occipital does not merely narrow, it draws down to a blunt
 * point. The crown slopes down toward the front, which puts the highest point
 * of the brain behind centre, the way a real one sits.
 */
function shapeCoords(x: number, y: number, z: number) {
  const front = smoothstep(0.08, 0.94, z);
  const back = smoothstep(-0.12, -0.92, z);
  const occ = smoothstep(-0.46, -0.95, z);
  _shaped.xs = x * (1 + 0.46 * front + 0.16 * back + 0.44 * occ);
  _shaped.ys =
    y -
    0.16 * front * smoothstep(0.08, -0.44, y) +
    0.19 * front * smoothstep(0.05, 0.45, y);
  _shaped.occ = occ;
  return _shaped;
}

// --- the four structures -----------------------------------------------------
// These are the single definition of each lobe. `regionTint` used to carry its
// own copies and they silently drifted out of step with the geometry, which put
// the per-structure colours slightly off the structures they were colouring.

/** Cerebral hemispheres, softly fused across the midline. Squeezing the
 *  vertical extent at the back turns the occipital into a pole, not a round end. */
function cerebrumField(xs: number, ys: number, z: number, occ: number) {
  const dy = (ys - 0.115) * (1 + 0.5 * occ);
  const dz = z + 0.03;
  return smin(
    ellip(xs + 0.285, dy, dz, 0.415, 0.545, 0.865),
    ellip(xs - 0.285, dy, dz, 0.415, 0.545, 0.865),
    0.3
  );
}

/** Temporal lobes, mirrored via |x| — they never cross the midline. */
function temporalField(xs: number, y: number, z: number) {
  return ellip(Math.abs(xs) - 0.42, y + 0.3, z - 0.14, 0.2, 0.235, 0.42);
}

/** Cerebellum: two lobes slung below and behind the occipital pole. */
function cerebellumField(x: number, y: number, z: number) {
  return ellip(Math.abs(x) - 0.215, y + 0.51, z + 0.62, 0.31, 0.255, 0.315);
}

/** Brain stem: tapered capsule dropping from the midbrain. */
function stemField(x: number, y: number, z: number) {
  const pay = y + 0.26;
  const paz = z + 0.3;
  // The stem lies on the midline, so the axis has no x component.
  const bay = -0.68;
  const baz = 0.16;
  let h = (pay * bay + paz * baz) / (bay * bay + baz * baz);
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const qy = pay - bay * h;
  const qz = paz - baz * h;
  return Math.sqrt(x * x + qy * qy + qz * qz) - (0.15 - 0.072 * h);
}

/**
 * The lobe-scale mass alone — hemispheres, temporal lobes, cerebellum, stem —
 * with no sulci carved into it. Occlusion only cares about structure at this
 * scale, and skipping the sulci saves it four exp() calls per sample.
 * Negative = inside.
 */
export function massField(x: number, y: number, z: number): number {
  const s = shapeCoords(x, y, z);
  let f = cerebrumField(s.xs, s.ys, z, s.occ);
  f = smin(f, temporalField(s.xs, y, z), 0.2);
  f = smin(f, cerebellumField(x, y, z), 0.085);
  f = smin(f, stemField(x, y, z), 0.1);
  return f;
}

/**
 * The full smooth field: the mass above, with the sulci that carry the
 * silhouette carved into it. Negative = inside.
 */
export function analyticField(x: number, y: number, z: number): number {
  let f = massField(x, y, z);

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
    0.056 *
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
  const dTr = y + 0.30;
  f +=
    0.082 *
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

  // Gyri shift the surface by at most ~0.08, so past that the detail cannot
  // change the sign and the noise below is wasted work.
  if (f > 0.15 || f < -0.15) return f;

  const w = gyriWarp(x, y, z);
  const s1 = ridged(w.x * 6.4, w.y * 6.2, w.z * 3.4);
  const s2 = ridged(w.x * 10.2 + 31.2, w.y * 10.6 - 8.4, w.z * 6.2 + 17.7);
  f -= GYRI_MAIN * s1 + GYRI_FINE * s2;

  // Cerebellum wears much finer, near-horizontal striations.
  const cd = Math.sqrt(
    x * x * 0.5 + (y + 0.51) * (y + 0.51) * 1.5 + (z + 0.62) * (z + 0.62) * 1.3
  );
  const cbMask = smoothstep(0.48, 0.14, cd);
  if (cbMask > 0.002) {
    const nc = perlin3(x * 4.0, (y + 0.51) * 32.0, (z + 0.62) * 22.0);
    f -= cbMask * 0.04 * (1 - Math.min(1, Math.abs(nc) / 0.45));
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

/**
 * Which structure a point belongs to, as a hue offset on the palette ring
 * (0 indigo, .25 orchid, .5 amber, .75 ice). Colouring the lobes apart is what
 * lets the eye separate cerebrum from cerebellum from stem at a glance.
 *
 * Weights are soft, so points near a boundary blend rather than banding.
 */
export function regionTint(x: number, y: number, z: number): number {
  const s = shapeCoords(x, y, z);
  const cerebrum = cerebrumField(s.xs, s.ys, z, s.occ);
  const temporal = temporalField(s.xs, y, z);
  const cereb = cerebellumField(x, y, z);
  const stem = stemField(x, y, z);

  // Anything at or inside a component weighs 1; influence falls away outside it.
  const w = (d: number) => Math.exp(-Math.max(d, 0) * 16);
  const wc = w(cerebrum);
  const wt = w(temporal);
  const wb = w(cereb);
  const ws = w(stem);
  const total = wc + wt + wb + ws || 1;

  // Cerebrum stays on the base hue; the rest pull away from it.
  const CEREBRUM = 0.0;
  const TEMPORAL = 0.10; // warmer, toward orchid
  const CEREBELLUM = -0.16; // cooler, onto sky blue
  const STEM = 0.56; // warm accent, onto orange

  // A frontal/occipital drift so the front of the brain reads warmer than the back.
  const axial =
    (smoothstep(0.08, 0.94, z) - smoothstep(-0.12, -0.92, z)) * 0.05;

  return (
    (wc * CEREBRUM + wt * TEMPORAL + wb * CEREBELLUM + ws * STEM) / total + axial
  );
}

/**
 * How deep inside a major fissure a point sits, 0..1.
 *
 * Reuses the exact gaussians that carve those fissures in `analyticField`, so
 * the seam always lands in the groove rather than beside it. Three of them:
 * the longitudinal fissure between the hemispheres, the transverse notch where
 * the cerebellum meets the occipital lobe, and the midline where the two
 * cerebellar lobes meet.
 */
export function fissureSeam(x: number, y: number, z: number): number {
  // Between the cerebral hemispheres.
  const longitudinal =
    Math.exp((-x * x) / (2 * 0.058 * 0.058)) * smoothstep(-0.22, 0.16, y);

  // Between cerebellum and occipital lobe.
  const dTr = y + 0.3;
  const transverse =
    Math.exp((-dTr * dTr) / (2 * 0.05 * 0.05)) *
    smoothstep(-0.26, -0.52, z) *
    smoothstep(0.06, 0.22, Math.abs(x));

  // Between the two cerebellar lobes.
  const inCerebellum = smoothstep(0.06, -0.06, cerebellumField(x, y, z));
  const cerebellarMidline =
    Math.exp((-x * x) / (2 * 0.055 * 0.055)) * inCerebellum;

  return clamp01(Math.max(longitudinal, Math.max(transverse, cerebellarMidline)));
}
