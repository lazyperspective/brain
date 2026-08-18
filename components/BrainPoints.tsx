"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Vector3 } from "three";
import type { BrainData } from "@/lib/brainGeometry";
import { pointsFrag, pointsVert } from "@/lib/shaders/points";
import { useShaderMaterial } from "@/lib/useShaderMaterial";
import { world } from "@/lib/world";

/** Every Nth point feeds the haze layer. Rejection sampling already left the
 *  array in spatially random order, so a stride is an unbiased subset. */
const HAZE_STRIDE = 4;

function buildGeometry(data: BrainData, stride: number) {
  const g = new BufferGeometry();
  if (stride === 1) {
    g.setAttribute("position", new BufferAttribute(data.positions, 3));
    g.setAttribute("aNormal", new BufferAttribute(data.normals, 3));
    g.setAttribute("aScatter", new BufferAttribute(data.scatter, 3));
    g.setAttribute("aSeed", new BufferAttribute(data.seeds, 1));
    g.setAttribute("aDepth", new BufferAttribute(data.depths, 1));
    g.setAttribute("aRidge", new BufferAttribute(data.ridges, 1));
    return g;
  }
  const n = Math.floor(data.count / stride);
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const sca = new Float32Array(n * 3);
  const see = new Float32Array(n);
  const dep = new Float32Array(n);
  const rid = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * stride;
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = data.positions[j * 3 + k];
      nor[i * 3 + k] = data.normals[j * 3 + k];
      sca[i * 3 + k] = data.scatter[j * 3 + k];
    }
    see[i] = data.seeds[j];
    dep[i] = data.depths[j];
    rid[i] = data.ridges[j];
  }
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aNormal", new BufferAttribute(nor, 3));
  g.setAttribute("aScatter", new BufferAttribute(sca, 3));
  g.setAttribute("aSeed", new BufferAttribute(see, 1));
  g.setAttribute("aDepth", new BufferAttribute(dep, 1));
  g.setAttribute("aRidge", new BufferAttribute(rid, 1));
  return g;
}

/**
 * The cortex, in two passes. A sparse pass of large, very dim sprites lays down
 * a continuous luminous body; the full-density pass of small bright sprites
 * puts the grain back on top. One pass alone is either a haze or a sprinkle.
 */
export function BrainPoints({ data }: { data: BrainData }) {
  const grainGeo = useMemo(() => buildGeometry(data, 1), [data]);
  const hazeGeo = useMemo(() => buildGeometry(data, HAZE_STRIDE), [data]);

  // Common uniform holders are shared by reference between both materials, so
  // one write per frame drives both layers.
  const shared = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uBreath: { value: 0 },
      uCursor: { value: new Vector3(0, 0, 99) },
      uCursorStr: { value: 0 },
      uImpact: { value: new Vector3() },
      uImpactAge: { value: 99 },
      uScale: { value: 600 },
    }),
    []
  );

  const grainU = useMemo(
    () => ({ ...shared, uSize: { value: 0.0068 }, uDim: { value: 1.0 } }),
    [shared]
  );
  const hazeU = useMemo(
    () => ({ ...shared, uSize: { value: 0.024 }, uDim: { value: 0.085 } }),
    [shared]
  );

  const base = {
    vertexShader: pointsVert,
    fragmentShader: pointsFrag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  };
  const grainMat = useShaderMaterial(() => ({ ...base, uniforms: grainU }));
  const hazeMat = useShaderMaterial(() => ({ ...base, uniforms: hazeU }));

  useFrame((state) => {
    shared.uTime.value = world.time;
    shared.uReveal.value = world.reveal;
    shared.uBreath.value = world.breath;
    shared.uCursor.value.copy(world.cursorLocal);
    shared.uCursorStr.value = world.cursorStrength;
    shared.uImpact.value.copy(world.impact);
    shared.uImpactAge.value = world.impactAge;
    // gl_PointSize is in device pixels; the projection term is 1/tan(fov/2),
    // which makes uSize a world-space diameter.
    shared.uScale.value =
      state.size.height *
      state.gl.getPixelRatio() *
      0.5 *
      state.camera.projectionMatrix.elements[5];
  });

  return (
    <>
      <points geometry={hazeGeo} frustumCulled={false}>
        <primitive object={hazeMat} attach="material" />
      </points>
      <points geometry={grainGeo} frustumCulled={false}>
        <primitive object={grainMat} attach="material" />
      </points>
    </>
  );
}
