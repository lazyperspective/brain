"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useShaderMaterial } from "@/lib/useShaderMaterial";
import { AdditiveBlending } from "three";
import type { BrainData } from "@/lib/brainGeometry";
import { motesFrag, motesVert } from "@/lib/shaders/motes";
import { world } from "@/lib/world";

const MOTES = 560;
const TRAIL = 4;
const COUNT = MOTES * TRAIL;

/** Charge travelling the fibre network. Position is entirely GPU-side. */
export function Motes({ data }: { data: BrainData }) {
  const buf = useMemo(() => {
    const aA = new Float32Array(COUNT * 3);
    const aB = new Float32Array(COUNT * 3);
    const aC = new Float32Array(COUNT * 3);
    const aMeta = new Float32Array(COUNT * 4);
    const aTrail = new Float32Array(COUNT);
    const position = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) aTrail[i] = i % TRAIL;
    return { aA, aB, aC, aMeta, aTrail, position };
  }, []);

  // Wall-clock at which each mote finishes its current run.
  const cycleEnd = useMemo(() => new Float32Array(MOTES), []);

  const assign = useRef((m: number, now: number) => {
    const { nodes, nodeNormals, edges, edgeCount } = data;
    const e = Math.floor(Math.random() * edgeCount);
    const a = edges[e * 2];
    const b = edges[e * 2 + 1];
    const flip = Math.random() < 0.5;
    const s = flip ? b : a;
    const t = flip ? a : b;

    const sx = nodes[s * 3];
    const sy = nodes[s * 3 + 1];
    const sz = nodes[s * 3 + 2];
    const tx = nodes[t * 3];
    const ty = nodes[t * 3 + 1];
    const tz = nodes[t * 3 + 2];

    const dx = tx - sx;
    const dy = ty - sy;
    const dz = tz - sz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4;

    let nx = nodeNormals[s * 3] + nodeNormals[t * 3];
    let ny = nodeNormals[s * 3 + 1] + nodeNormals[t * 3 + 1];
    let nz = nodeNormals[s * 3 + 2] + nodeNormals[t * 3 + 2];
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;

    const k =
      len < 0.32
        ? (0.18 + Math.random() * 0.30) * len
        : (Math.random() < 0.6 ? -0.34 : 0.14) * Math.min(len, 0.9);

    const cx = (sx + tx) * 0.5 + nx * k;
    const cy = (sy + ty) * 0.5 + ny * k;
    const cz = (sz + tz) * 0.5 + nz * k;

    const speed = 0.1 + Math.random() * 0.26;
    // Phase the mote so it starts at t=0 exactly now.
    const offset = -now * speed;
    const size = 0.5 + Math.random() * 1.5;
    const hue =
      Math.random() < 0.14 ? 0.44 + Math.random() * 0.16 : 0.04 + Math.random() * 0.2;

    for (let k2 = 0; k2 < TRAIL; k2++) {
      const i = m * TRAIL + k2;
      const o = i * 3;
      buf.aA[o] = sx;
      buf.aA[o + 1] = sy;
      buf.aA[o + 2] = sz;
      buf.aB[o] = tx;
      buf.aB[o + 1] = ty;
      buf.aB[o + 2] = tz;
      buf.aC[o] = cx;
      buf.aC[o + 1] = cy;
      buf.aC[o + 2] = cz;
      const q = i * 4;
      buf.aMeta[q] = offset;
      buf.aMeta[q + 1] = speed;
      buf.aMeta[q + 2] = size;
      buf.aMeta[q + 3] = hue;
    }
    cycleEnd[m] = now + 1 / speed;
  }).current;

  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    for (let m = 0; m < MOTES; m++) {
      assign(m, 0);
      // Scatter starting phases so traffic is already in flight at t=0.
      const q = m * TRAIL * 4;
      const phase = Math.random();
      const speed = buf.aMeta[q + 1];
      for (let k = 0; k < TRAIL; k++) buf.aMeta[(m * TRAIL + k) * 4] = phase;
      cycleEnd[m] = (1 - phase) / speed;
    }
  }

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uBreath: { value: 0 },
      uScale: { value: 600 },
      uSize: { value: 0.0062 },
    }),
    []
  );

  const geoRef = useRef<import("three").BufferGeometry>(null);

  useFrame((state) => {
    uniforms.uTime.value = world.time;
    uniforms.uReveal.value = world.reveal;
    uniforms.uBreath.value = world.breath;
    uniforms.uScale.value =
      state.size.height *
      state.gl.getPixelRatio() *
      0.5 *
      state.camera.projectionMatrix.elements[5];

    // Re-route motes only as they finish a run, so nothing ever teleports.
    const now = world.time;
    let dirty = false;
    for (let m = 0; m < MOTES; m++) {
      if (now >= cycleEnd[m]) {
        assign(m, now);
        dirty = true;
      }
    }
    if (dirty && geoRef.current) {
      for (const n of ["aA", "aB", "aC", "aMeta"]) {
        const attr = geoRef.current.getAttribute(n);
        if (attr) attr.needsUpdate = true;
      }
    }
  });

  const material = useShaderMaterial(() => ({
    vertexShader: motesVert,
    fragmentShader: motesFrag,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[buf.position, 3]} />
        <bufferAttribute attach="attributes-aA" args={[buf.aA, 3]} />
        <bufferAttribute attach="attributes-aB" args={[buf.aB, 3]} />
        <bufferAttribute attach="attributes-aC" args={[buf.aC, 3]} />
        <bufferAttribute attach="attributes-aMeta" args={[buf.aMeta, 4]} />
        <bufferAttribute attach="attributes-aTrail" args={[buf.aTrail, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}
