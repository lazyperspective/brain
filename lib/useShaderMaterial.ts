"use client";

import { useEffect, useMemo } from "react";
import { ShaderMaterial, type ShaderMaterialParameters } from "three";

/**
 * Own the ShaderMaterial outright instead of declaring <shaderMaterial>.
 *
 * R3F's prop applier shallow-copies every uniform holder
 * (`uniforms[name] = { ...uniform }`), so a memoized uniforms object handed in
 * as a prop is NOT the object the renderer reads. Scalar writes like
 * `u.uTime.value = t` silently go nowhere — only object values survive, because
 * the spread copies those by reference. Constructing the material here keeps a
 * single uniforms object shared by the frame loop and the GPU.
 */
export function useShaderMaterial(build: () => ShaderMaterialParameters) {
  const material = useMemo(() => new ShaderMaterial(build()), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => material.dispose(), [material]);
  return material;
}
