/// <reference lib="webworker" />
import { buildBrain, type BrainData } from "./brainGeometry";

self.onmessage = () => {
  const d = buildBrain();
  // The returned views are subarrays of larger scratch allocations. Copying
  // them tight avoids transferring shared parent buffers, and 2MB of memcpy is
  // nothing next to the sampling that just happened.
  const out: BrainData = {
    ...d,
    positions: d.positions.slice(),
    normals: d.normals.slice(),
    seeds: d.seeds.slice(),
    depths: d.depths.slice(),
    ridges: d.ridges.slice(),
    tints: d.tints.slice(),
    ao: d.ao.slice(),
    scatter: d.scatter.slice(),
  };
  (self as unknown as Worker).postMessage(out, [
    out.positions.buffer,
    out.normals.buffer,
    out.seeds.buffer,
    out.depths.buffer,
    out.ridges.buffer,
    out.tints.buffer,
    out.ao.buffer,
    out.scatter.buffer,
    out.nodes.buffer,
    out.nodeNormals.buffer,
    out.edges.buffer,
  ]);
};
