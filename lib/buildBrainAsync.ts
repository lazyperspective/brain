import { buildBrain, type BrainData } from "./brainGeometry";

/**
 * Builds the cortex off the main thread.
 *
 * Sampling the field, baking occlusion and resolving the node graph is ~600ms
 * of solid arithmetic. On the main thread that lands as a visible freeze right
 * as the backdrop finishes fading in.
 *
 * This lives in its own module on purpose. If the `new URL(...worker...)`
 * reference sat inside brainGeometry.ts — which the worker itself imports —
 * the worker's module graph would point back at the worker, and Turbopack's
 * production build walks that cycle forever. Dev tolerates it; `next build`
 * hangs. Keeping the reference outside the worker's own dependency graph is
 * what makes both work.
 *
 * Falls back to building inline if a module worker cannot be constructed.
 */
export function buildBrainAsync(): Promise<BrainData> {
  return new Promise((resolve) => {
    let worker: Worker | null = null;
    const inline = () => {
      worker?.terminate();
      resolve(buildBrain());
    };

    try {
      worker = new Worker(new URL("./brainGeometry.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      inline();
      return;
    }

    worker.onmessage = (e: MessageEvent<BrainData>) => {
      resolve(e.data);
      worker?.terminate();
    };
    worker.onerror = inline;
    worker.postMessage(null);
  });
}
