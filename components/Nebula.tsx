"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useShaderMaterial } from "@/lib/useShaderMaterial";
import { Vector2 } from "three";
import { nebulaFrag, nebulaVert } from "@/lib/shaders/nebula";
import { world } from "@/lib/world";

/** Fullscreen backdrop. Bypasses the camera entirely via a clip-space quad. */
export function Nebula() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
      uParallax: { value: new Vector2() },
      uBreath: { value: 0 },
      uFlash: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    uniforms.uTime.value = world.time;
    uniforms.uRes.value.set(state.size.width, state.size.height);
    uniforms.uParallax.value.set(world.pointerSmooth.x, world.pointerSmooth.y);
    uniforms.uBreath.value = world.breath;
    uniforms.uFlash.value = world.flash;
  });

  const material = useShaderMaterial(() => ({
    vertexShader: nebulaVert,
    fragmentShader: nebulaFrag,
    uniforms,
    depthWrite: false,
    depthTest: false,
  }));

  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
