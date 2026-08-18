"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useShaderMaterial } from "@/lib/useShaderMaterial";
import { AdditiveBlending, BufferGeometry, Vector3 } from "three";
import { nodesFrag, nodesVert } from "@/lib/shaders/nodes";
import { useAnima } from "@/lib/store";
import { hashId, type Thought } from "@/lib/thoughts";
import { domRefs, world } from "@/lib/world";
import { refs } from "./Rig";
import type { BrainData } from "@/lib/brainGeometry";

const CAPACITY = 512;
const HOVER_RADIUS = 0.045; // in NDC

/** Every thought is anchored to one cortical node — the brain is made of them. */
export function assignNodes(thoughts: Thought[], nodeCount: number) {
  const used = new Set<number>();
  const map = new Map<string, number>();
  for (const t of thoughts) {
    let n = hashId(t.id) % nodeCount;
    let probe = 0;
    while (used.has(n) && probe < nodeCount) {
      n = (n + 1) % nodeCount;
      probe++;
    }
    used.add(n);
    map.set(t.id, n);
  }
  return map;
}

export function ThoughtNodes({ data }: { data: BrainData }) {
  const thoughts = useAnima((s) => s.thoughts);
  const setHovered = useAnima((s) => s.setHovered);
  const geoRef = useRef<BufferGeometry>(null);

  const buf = useMemo(
    () => ({
      position: new Float32Array(CAPACITY * 3),
      aSeed: new Float32Array(CAPACITY),
      aBorn: new Float32Array(CAPACITY).fill(-1),
      aOwn: new Float32Array(CAPACITY),
    }),
    []
  );

  // Live list of what is actually on screen, for hover hit-testing.
  const shown = useRef<{ id: string; text: string; idx: number }[]>([]);

  useEffect(() => {
    const map = assignNodes(thoughts, data.nodeCount);
    const list: { id: string; text: string; idx: number }[] = [];
    const n = Math.min(thoughts.length, CAPACITY);
    for (let i = 0; i < n; i++) {
      const t = thoughts[i];
      const node = map.get(t.id) ?? 0;
      buf.position[i * 3] = data.nodes[node * 3];
      buf.position[i * 3 + 1] = data.nodes[node * 3 + 1];
      buf.position[i * 3 + 2] = data.nodes[node * 3 + 2];
      buf.aSeed[i] = (hashId(t.id) % 10000) / 10000;
      // Seeded thoughts have always been here; only new arrivals flare.
      buf.aBorn[i] = t.at === 0 ? -1 : world.time;
      buf.aOwn[i] = t.own ? 1 : 0;
      list.push({ id: t.id, text: t.text, idx: i });
    }
    shown.current = list;
    const g = geoRef.current;
    if (g) {
      g.setDrawRange(0, n);
      for (const name of ["position", "aSeed", "aBorn", "aOwn"]) {
        const attr = g.getAttribute(name);
        if (attr) attr.needsUpdate = true;
      }
    }
  }, [thoughts, data, buf]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uBreath: { value: 0 },
      uScale: { value: 600 },
      uSize: { value: 0.0130 },
      uHover: { value: new Vector3(0, 0, 999) },
    }),
    []
  );

  const proj = useRef(new Vector3()).current;
  const hoverPos = useRef(new Vector3()).current;
  const lastId = useRef<string | null>(null);

  useFrame((state) => {
    uniforms.uTime.value = world.time;
    uniforms.uReveal.value = world.reveal;
    uniforms.uBreath.value = world.breath;
    uniforms.uScale.value =
      state.size.height *
      state.gl.getPixelRatio() *
      0.5 *
      state.camera.projectionMatrix.elements[5];

    const brain = refs.brain;
    if (!brain || world.reveal < 0.85 || world.dragging) {
      if (lastId.current) {
        lastId.current = null;
        setHovered(null);
        uniforms.uHover.value.set(0, 0, 999);
      }
      return;
    }

    // Screen-space nearest-node search; far cheaper than raycasting a point cloud.
    let bestI = -1;
    let bestD = HOVER_RADIUS * HOVER_RADIUS;
    let bestX = 0;
    let bestY = 0;
    const list = shown.current;
    for (let k = 0; k < list.length; k++) {
      const i = list[k].idx;
      proj.set(buf.position[i * 3], buf.position[i * 3 + 1], buf.position[i * 3 + 2]);
      proj.applyMatrix4(brain.matrixWorld).project(state.camera);
      if (proj.z > 1) continue;
      const dx = proj.x - world.pointer.x;
      const dy = proj.y - world.pointer.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestI = k;
        bestX = proj.x;
        bestY = proj.y;
      }
    }

    if (bestI < 0) {
      if (lastId.current) {
        lastId.current = null;
        setHovered(null);
        uniforms.uHover.value.set(0, 0, 999);
      }
      return;
    }

    const entry = list[bestI];
    const i = entry.idx;
    hoverPos.set(
      buf.position[i * 3],
      buf.position[i * 3 + 1],
      buf.position[i * 3 + 2]
    );
    uniforms.uHover.value.copy(hoverPos);

    if (lastId.current !== entry.id) {
      lastId.current = entry.id;
      setHovered({ id: entry.id, text: entry.text, x: 0, y: 0 });
    }

    // The label tracks the node every frame via direct DOM writes — putting
    // this through React state would re-render the tree 60 times a second.
    const el = domRefs.label;
    if (el) {
      const px = (bestX * 0.5 + 0.5) * state.size.width;
      const py = (-bestY * 0.5 + 0.5) * state.size.height;
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
      // Flip to whichever side actually fits. Width is estimated from the text
      // rather than measured, so the frame loop never forces a layout read.
      const estW = 24 + entry.text.length * 6.6;
      let side = px + 16 + estW > state.size.width - 20 ? "left" : "right";
      if (side === "left" && px - 16 - estW < 20) side = "right";
      if (el.dataset.side !== side) el.dataset.side = side;
    }
  });

  const material = useShaderMaterial(() => ({
    vertexShader: nodesVert,
    fragmentShader: nodesFrag,
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
        <bufferAttribute attach="attributes-aSeed" args={[buf.aSeed, 1]} />
        <bufferAttribute attach="attributes-aBorn" args={[buf.aBorn, 1]} />
        <bufferAttribute attach="attributes-aOwn" args={[buf.aOwn, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}
