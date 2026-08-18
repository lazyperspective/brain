import {
  analyticField,
  analyticNormal,
  brainField,
  regionTint,
  BOUNDS,
} from "./brainField";
import { perlin3, rng } from "./noise";

export type BrainData = {
  count: number;
  positions: Float32Array;
  normals: Float32Array;
  seeds: Float32Array;
  depths: Float32Array;
  /** 0 in a sulcal valley, 1 on a gyral crown. Shades the folds. */
  ridges: Float32Array;
  /** Per-structure hue offset, so the lobes read apart. */
  tints: Float32Array;
  /** Baked ambient occlusion: dark where the anatomy folds in on itself. */
  ao: Float32Array;
  scatter: Float32Array;
  nodes: Float32Array;
  nodeNormals: Float32Array;
  nodeCount: number;
  edges: Uint32Array;
  edgeCount: number;
  buildMs: number;
};

const SURFACE_TARGET = 76000;
const INTERIOR_TARGET = 24000;
const MAX_ITER = 4_000_000;

/**
 * Ambient occlusion by hemisphere sampling.
 *
 * Marching the field along the normal does NOT work here: `analyticField` is a
 * scaled approximation, not a true distance, so the value grows slower than the
 * step and every point reads as occluded. Testing whether sample points around
 * the hemisphere land inside the body is immune to that scaling, and measures
 * the thing we actually want — where the anatomy folds back on itself, under
 * the temporal lobes, in the notch above the cerebellum, down the fissure.
 */
function bakeAO(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number
) {
  // Orthonormal basis around the normal.
  let tx: number, ty: number, tz: number;
  if (Math.abs(nz) < 0.9) {
    tx = -ny;
    ty = nx;
    tz = 0;
  } else {
    tx = 0;
    ty = -nz;
    tz = ny;
  }
  const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
  tx /= tl;
  ty /= tl;
  tz /= tl;
  const bx = ny * tz - nz * ty;
  const by = nz * tx - nx * tz;
  const bz = nx * ty - ny * tx;

  // Soft inside test, so occlusion ramps rather than banding across samples.
  const inside = (px: number, py: number, pz: number) => {
    const f = analyticField(px, py, pz);
    return f > 0.05 ? 0 : f < 0 ? 1 : 1 - f / 0.05;
  };

  let occ = 0;
  let n = 0;
  // Straight out along the normal, at two scales.
  for (const r of [0.09, 0.2]) {
    occ += inside(x + nx * r, y + ny * r, z + nz * r);
    n++;
  }
  // Two rings tilted off the normal — these are what catch the creases.
  for (const ring of [
    { r: 0.11, c: 0.62 },
    { r: 0.24, c: 0.44 },
  ]) {
    const s2 = Math.sqrt(1 - ring.c * ring.c);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.4;
      const ca = Math.cos(a) * s2;
      const sa = Math.sin(a) * s2;
      const dx = nx * ring.c + tx * ca + bx * sa;
      const dy = ny * ring.c + ty * ca + by * sa;
      const dz = nz * ring.c + tz * ca + bz * sa;
      occ += inside(x + dx * ring.r, y + dy * ring.r, z + dz * ring.r);
      n++;
    }
  }
  const ao = 1 - occ / n;
  return ao < 0 ? 0 : ao > 1 ? 1 : ao;
}

const NODE_MIN_DIST = 0.082;
const NODE_CAP = 1600;
const LOCAL_RADIUS = 0.19;
const LOCAL_DEGREE = 7;

/** Uniform spatial hash for nearest-neighbour queries over the node set. */
class Grid {
  cell: number;
  map = new Map<number, number[]>();
  constructor(cell: number) {
    this.cell = cell;
  }
  key(ix: number, iy: number, iz: number) {
    return (ix + 512) * 1_048_576 + (iy + 512) * 1024 + (iz + 512);
  }
  coords(x: number, y: number, z: number) {
    return [
      Math.floor(x / this.cell),
      Math.floor(y / this.cell),
      Math.floor(z / this.cell),
    ] as const;
  }
  insert(x: number, y: number, z: number, id: number) {
    const [ix, iy, iz] = this.coords(x, y, z);
    const k = this.key(ix, iy, iz);
    const arr = this.map.get(k);
    if (arr) arr.push(id);
    else this.map.set(k, [id]);
  }
  /** Ids within `rings` cells of the point. */
  near(x: number, y: number, z: number, rings = 1): number[] {
    const [ix, iy, iz] = this.coords(x, y, z);
    const out: number[] = [];
    for (let a = -rings; a <= rings; a++)
      for (let b = -rings; b <= rings; b++)
        for (let c = -rings; c <= rings; c++) {
          const arr = this.map.get(this.key(ix + a, iy + b, iz + c));
          if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
        }
    return out;
  }
}

export function buildBrain(): BrainData {
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const total = SURFACE_TARGET + INTERIOR_TARGET;
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const scatter = new Float32Array(total * 3);
  const seeds = new Float32Array(total);
  const depths = new Float32Array(total);
  const ridges = new Float32Array(total);
  const tints = new Float32Array(total);
  const aos = new Float32Array(total);

  const spanX = BOUNDS.xMax - BOUNDS.xMin;
  const spanY = BOUNDS.yMax - BOUNDS.yMin;
  const spanZ = BOUNDS.zMax - BOUNDS.zMin;

  let sCount = 0;
  let iCount = 0;
  let write = 0;
  let iter = 0;

  const push = (
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    depth: number,
    ridge: number,
    ao: number
  ) => {
    const o = write * 3;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = z;
    normals[o] = nx;
    normals[o + 1] = ny;
    normals[o + 2] = nz;
    // Reveal origin: flung outward along the normal into a loose shell, so the
    // brain condenses inward rather than assembling from a uniform ball.
    const spread = 2.0 + rng() * 2.6;
    scatter[o] = x + nx * spread + (rng() - 0.5) * 1.6;
    scatter[o + 1] = y + ny * spread + (rng() - 0.5) * 1.6;
    scatter[o + 2] = z + nz * spread + (rng() - 0.5) * 1.6;
    seeds[write] = rng();
    depths[write] = depth;
    ridges[write] = ridge;
    tints[write] = regionTint(x, y, z);
    aos[write] = ao;
    write++;
  };

  while ((sCount < SURFACE_TARGET || iCount < INTERIOR_TARGET) && iter < MAX_ITER) {
    iter++;
    const x = BOUNDS.xMin + rng() * spanX;
    const y = BOUNDS.yMin + rng() * spanY;
    const z = BOUNDS.zMin + rng() * spanZ;

    // Cheap smooth-field prefilter keeps the expensive noise off ~70% of samples.
    const fa = analyticField(x, y, z);
    if (fa > 0.14) continue;

    if (fa < -0.2) {
      if (iCount < INTERIOR_TARGET && rng() < 0.1) {
        const l = Math.sqrt(x * x + y * y + z * z) || 1;
        push(x, y, z, x / l, y / l, z / l, 0.6 + rng() * 0.4, 0.5, 0.55);
        iCount++;
      }
      continue;
    }

    const f = brainField(x, y, z);
    if (f > 0.004) continue;
    if (f < -0.036) {
      if (iCount < INTERIOR_TARGET && rng() < 0.05) {
        const l = Math.sqrt(x * x + y * y + z * z) || 1;
        push(x, y, z, x / l, y / l, z / l, 0.55 + rng() * 0.45, 0.5, 0.55);
        iCount++;
      }
      continue;
    }
    if (sCount >= SURFACE_TARGET) continue;

    const [nx, ny, nz] = analyticNormal(x, y, z);
    // Same field the gyri were carved from: 1 on a fold crest, 0 in a sulcus.
    const ridge = 1 - Math.min(1, Math.abs(perlin3(x * 5.6, y * 5.9, z * 5.2)) / 0.42);
    push(x, y, z, nx, ny, nz, 0, ridge, bakeAO(x, y, z, nx, ny, nz));
    sCount++;
  }

  const count = write;

  // ---- node graph ----------------------------------------------------------
  // Poisson-ish thinning of the surface points gives evenly spread synapse
  // anchors; clustered anchors would make connections bunch up visually.
  const nodeIdx: number[] = [];
  const grid = new Grid(NODE_MIN_DIST);
  const minD2 = NODE_MIN_DIST * NODE_MIN_DIST;
  const order = new Uint32Array(sCount);
  for (let i = 0; i < sCount; i++) order[i] = i;
  for (let i = sCount - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }

  for (let k = 0; k < sCount && nodeIdx.length < NODE_CAP; k++) {
    const i = order[k];
    if (depths[i] > 0) continue;
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    let ok = true;
    const cand = grid.near(x, y, z, 1);
    for (let c = 0; c < cand.length; c++) {
      const n = cand[c];
      const dx = x - positions[nodeIdx[n] * 3];
      const dy = y - positions[nodeIdx[n] * 3 + 1];
      const dz = z - positions[nodeIdx[n] * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < minD2) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    grid.insert(x, y, z, nodeIdx.length);
    nodeIdx.push(i);
  }

  const nodeCount = nodeIdx.length;
  const nodes = new Float32Array(nodeCount * 3);
  const nodeNormals = new Float32Array(nodeCount * 3);
  for (let n = 0; n < nodeCount; n++) {
    const i = nodeIdx[n];
    nodes[n * 3] = positions[i * 3];
    nodes[n * 3 + 1] = positions[i * 3 + 1];
    nodes[n * 3 + 2] = positions[i * 3 + 2];
    nodeNormals[n * 3] = normals[i * 3];
    nodeNormals[n * 3 + 1] = normals[i * 3 + 1];
    nodeNormals[n * 3 + 2] = normals[i * 3 + 2];
  }

  // ---- candidate edges -----------------------------------------------------
  const nodeGrid = new Grid(LOCAL_RADIUS);
  for (let n = 0; n < nodeCount; n++)
    nodeGrid.insert(nodes[n * 3], nodes[n * 3 + 1], nodes[n * 3 + 2], n);

  const seen = new Set<number>();
  const edgeList: number[] = [];
  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const k = lo * 65536 + hi;
    if (seen.has(k)) return;
    seen.add(k);
    edgeList.push(lo, hi);
  };

  const r2 = LOCAL_RADIUS * LOCAL_RADIUS;
  const scratch: { id: number; d: number }[] = [];
  for (let n = 0; n < nodeCount; n++) {
    const x = nodes[n * 3];
    const y = nodes[n * 3 + 1];
    const z = nodes[n * 3 + 2];
    scratch.length = 0;
    const cand = nodeGrid.near(x, y, z, 1);
    for (let c = 0; c < cand.length; c++) {
      const m = cand[c];
      if (m === n) continue;
      const dx = x - nodes[m * 3];
      const dy = y - nodes[m * 3 + 1];
      const dz = z - nodes[m * 3 + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < r2) scratch.push({ id: m, d });
    }
    scratch.sort((p, q) => p.d - q.d);
    for (let c = 0; c < Math.min(LOCAL_DEGREE, scratch.length); c++)
      addEdge(n, scratch[c].id);

    // Long-range association fibres: a few arcs that dive through the interior.
    if (rng() < 0.45) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const m = Math.floor(rng() * nodeCount);
        const dx = x - nodes[m * 3];
        const dy = y - nodes[m * 3 + 1];
        const dz = z - nodes[m * 3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 0.5 && d < 1.5) {
          addEdge(n, m);
          break;
        }
      }
    }
  }

  const edges = new Uint32Array(edgeList);
  const buildMs =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;

  return {
    count,
    positions: positions.subarray(0, count * 3),
    normals: normals.subarray(0, count * 3),
    seeds: seeds.subarray(0, count),
    depths: depths.subarray(0, count),
    ridges: ridges.subarray(0, count),
    tints: tints.subarray(0, count),
    ao: aos.subarray(0, count),
    scatter: scatter.subarray(0, count * 3),
    nodes,
    nodeNormals,
    nodeCount,
    edges,
    edgeCount: edges.length / 2,
    buildMs,
  };
}
