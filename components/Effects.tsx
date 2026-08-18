"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  Noise,
  ToneMapping,
  Vignette,
  wrapEffect,
} from "@react-three/postprocessing";
import {
  BlendFunction,
  ChromaticAberrationEffect,
  ToneMappingMode,
  type BloomEffect,
} from "postprocessing";
import { Vector2 } from "three";
import { LensEffect } from "@/lib/effects/LensEffect";
import { world } from "@/lib/world";

const Lens = wrapEffect(LensEffect);
// The packaged <ChromaticAberration> loses its props through an Omit over an
// optional constructor param, so wrap the raw effect instead.
const Chroma = wrapEffect(ChromaticAberrationEffect);

export function Effects() {
  const lens = useRef<LensEffect>(null);
  const bloom = useRef<BloomEffect>(null);
  const chroma = useMemo(() => new Vector2(0.0005, 0.0008), []);

  useFrame((state) => {
    const l = lens.current;
    if (l) {
      const aspect = state.size.width / Math.max(1, state.size.height);
      l.setAspect(aspect);
      for (let i = 0; i < 3; i++) {
        const s = world.lenses[i];
        l.setLens(i, s[0], s[1], s[2], s[3]);
      }
      // A barely-perceptible pulse of the whole frame, in time with the breath.
      l.setWarp(world.breath * 0.004 + world.flash * 0.02);
    }
    if (bloom.current) {
      bloom.current.intensity = 1.15 + world.bloomPump * 1.7;
    }
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Lens ref={lens} />
      <Bloom
        ref={bloom}
        mipmapBlur
        intensity={1.15}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.35}
        radius={0.86}
      />
      <Chroma offset={chroma} radialModulation modulationOffset={0.42} />
      <Vignette offset={0.26} darkness={0.66} eskil={false} />
      <Noise opacity={0.035} blendFunction={BlendFunction.SOFT_LIGHT} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}
