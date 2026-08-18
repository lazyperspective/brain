"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useShaderMaterial } from "@/lib/useShaderMaterial";
import { AdditiveBlending } from "three";
import { dustFrag, dustVert } from "@/lib/shaders/dust";
import { world } from "@/lib/world";

const COUNT = 3400;

/**
 * Ambient depth field. Sits outside the brain group so it does not spin with
 * it — the parallax comes purely from camera movement against real 3D depth.
 */
export function Dust() {
  const geo = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    const hue = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // Shell distribution: keeps the volume around the brain clear.
      const r = 2.2 + Math.pow(Math.random(), 0.65) * 15;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.75;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      seed[i] = Math.random();
      // Most motes are crisp; a minority are large, soft and far — bokeh depth.
      size[i] = Math.pow(Math.random(), 3.1);
      hue[i] = 0.02 + Math.random() * 0.22 + (Math.random() < 0.06 ? 0.55 : 0);
    }
    return { pos, seed, size, hue };
  }, []);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uScale: { value: 600 }, uFade: { value: 0 } }),
    []
  );

  useFrame((state) => {
    uniforms.uTime.value = world.time;
    // Dust arrives before the brain does, so the first frame is never empty.
    uniforms.uFade.value = Math.min(1, world.time / 1.6);
    uniforms.uScale.value =
      state.size.height *
      state.gl.getPixelRatio() *
      0.5 *
      state.camera.projectionMatrix.elements[5];
  });

  const material = useShaderMaterial(() => ({
    vertexShader: dustVert,
    fragmentShader: dustFrag,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geo.pos, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[geo.seed, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[geo.size, 1]} />
        <bufferAttribute attach="attributes-aHue" args={[geo.hue, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}
