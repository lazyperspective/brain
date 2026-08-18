"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { NoToneMapping } from "three";
import { buildBrainAsync } from "@/lib/buildBrainAsync";
import { type BrainData } from "@/lib/brainGeometry";
import { BrainPoints } from "./BrainPoints";
import { Dust } from "./Dust";
import { Effects } from "./Effects";
import { Motes } from "./Motes";
import { Nebula } from "./Nebula";
import { refs, Rig } from "./Rig";
import { Synapses } from "./Synapses";
import { ThoughtNodes } from "./ThoughtNodes";
import { ThoughtOrb } from "./ThoughtOrb";
import { useAnima } from "@/lib/store";

export function Scene() {
  const [data, setData] = useState<BrainData | null>(null);
  const init = useAnima((s) => s.init);

  useEffect(() => {
    init();
    // Sampling the cortex is ~600ms of arithmetic, so it runs in a worker.
    // Two frames of grace first, so the nebula and dust are already on screen.
    let cancelled = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        buildBrainAsync().then((d) => {
          if (!cancelled) setData(d);
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [init]);

  return (
    <Canvas
      className="canvas"
      dpr={[1, 2]}
      gl={{
        antialias: false,
        alpha: false,
        stencil: false,
        powerPreference: "high-performance",
        toneMapping: NoToneMapping,
      }}
      camera={{ fov: 38, near: 0.1, far: 60, position: [0, 0, 3.42] }}
    >
      <Rig active={!!data} />
      <Nebula />
      <Dust />
      {data && (
        <>
          <group
            ref={(g) => {
              refs.brain = g;
            }}
          >
            <BrainPoints data={data} />
            <Synapses data={data} />
            <Motes data={data} />
            <ThoughtNodes data={data} />
          </group>
          {/* Outside the brain group: the orb flies in world space, so it does
              not spin with the cortex while it is still on its way there. */}
          <ThoughtOrb data={data} />
        </>
      )}
      <Effects />
    </Canvas>
  );
}
