"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useShaderMaterial } from "@/lib/useShaderMaterial";
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  PlaneGeometry,
  Sphere,
  Vector3,
} from "three";
import type { BrainData } from "@/lib/brainGeometry";
import { synapseFrag, synapseVert } from "@/lib/shaders/synapse";
import { world } from "@/lib/world";

const COUNT = 780;
const SEGMENTS = 30;

/** Imperative hook so a landing thought can ignite fibres around its node. */
export const synapseApi = { burst: (_node: number, _hue: number) => {} };

export function Synapses({ data }: { data: BrainData }) {
  const pool = useMemo(() => {
    const aStart = new Float32Array(COUNT * 3);
    const aEnd = new Float32Array(COUNT * 3);
    const aCtrl = new Float32Array(COUNT * 3);
    const aMeta = new Float32Array(COUNT * 4);
    const aHue = new Float32Array(COUNT);
    return { aStart, aEnd, aCtrl, aMeta, aHue };
  }, []);

  // node -> incident candidate edges, for targeted bursts
  const adjacency = useMemo(() => {
    const adj: number[][] = Array.from({ length: data.nodeCount }, () => []);
    for (let e = 0; e < data.edgeCount; e++) {
      const a = data.edges[e * 2];
      const b = data.edges[e * 2 + 1];
      if (adj[a]) adj[a].push(e);
      if (adj[b]) adj[b].push(e);
    }
    return adj;
  }, [data]);

  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(1, 1, SEGMENTS, 1);
    const g = new InstancedBufferGeometry();
    g.index = plane.index;
    g.setAttribute("position", plane.getAttribute("position"));
    g.setAttribute("uv", plane.getAttribute("uv"));
    g.instanceCount = COUNT;
    g.setAttribute("aStart", new InstancedBufferAttribute(pool.aStart, 3));
    g.setAttribute("aEnd", new InstancedBufferAttribute(pool.aEnd, 3));
    g.setAttribute("aCtrl", new InstancedBufferAttribute(pool.aCtrl, 3));
    g.setAttribute("aMeta", new InstancedBufferAttribute(pool.aMeta, 4));
    g.setAttribute("aHue", new InstancedBufferAttribute(pool.aHue, 1));
    // The ribbons are displaced in the shader, so let the CPU bound stay generous.
    g.boundingSphere = new Sphere(new Vector3(), 3);
    return g;
  }, [pool]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uBreath: { value: 0 },
      uImpact: { value: new Vector3() },
      uImpactAge: { value: 99 },
    }),
    []
  );

  const assign = useRef(
    (i: number, now: number, opts?: { edge?: number; hue?: number; hot?: boolean }) => {
      const { nodes, nodeNormals, edges, edgeCount } = data;
      const e = opts?.edge ?? Math.floor(Math.random() * edgeCount);
      const a = edges[e * 2];
      const b = edges[e * 2 + 1];

      const ax = nodes[a * 3];
      const ay = nodes[a * 3 + 1];
      const az = nodes[a * 3 + 2];
      const bx = nodes[b * 3];
      const by = nodes[b * 3 + 1];
      const bz = nodes[b * 3 + 2];

      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4;

      let nx = nodeNormals[a * 3] + nodeNormals[b * 3];
      let ny = nodeNormals[a * 3 + 1] + nodeNormals[b * 3 + 1];
      let nz = nodeNormals[a * 3 + 2] + nodeNormals[b * 3 + 2];
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;

      // Short fibres arch just above the cortex; long association fibres dive
      // inward through the volume, which is what creates the sense of depth.
      const local = len < 0.32;
      const k = local
        ? (0.18 + Math.random() * 0.32) * len
        : (Math.random() < 0.6 ? -0.34 : 0.14) * Math.min(len, 0.9);

      const o = i * 3;
      pool.aStart[o] = ax;
      pool.aStart[o + 1] = ay;
      pool.aStart[o + 2] = az;
      pool.aEnd[o] = bx;
      pool.aEnd[o + 1] = by;
      pool.aEnd[o + 2] = bz;
      pool.aCtrl[o] = (ax + bx) * 0.5 + nx * k + (Math.random() - 0.5) * 0.05;
      pool.aCtrl[o + 1] = (ay + by) * 0.5 + ny * k + (Math.random() - 0.5) * 0.05;
      pool.aCtrl[o + 2] = (az + bz) * 0.5 + nz * k + (Math.random() - 0.5) * 0.05;

      const m = i * 4;
      const hot = opts?.hot ?? false;
      pool.aMeta[m] = now;
      pool.aMeta[m + 1] = hot
        ? 1.6 + Math.random() * 1.4
        : 2.6 + Math.random() * 4.8;
      pool.aMeta[m + 2] =
        (local ? 0.0042 + Math.random() * 0.0055 : 0.0028 + Math.random() * 0.0032) *
        (hot ? 2.1 : 1);
      pool.aMeta[m + 3] = Math.random();

      pool.aHue[i] =
        opts?.hue ??
        (Math.random() < 0.09 ? 0.42 + Math.random() * 0.12 : 0.02 + Math.random() * 0.2);
    }
  ).current;

  // Seed the pool mid-life so the very first frame already shows live traffic.
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    for (let i = 0; i < COUNT; i++) {
      assign(i, 0);
      pool.aMeta[i * 4] = -Math.random() * pool.aMeta[i * 4 + 1];
    }
  }

  const cursor = useRef(0);

  useEffect(() => {
    synapseApi.burst = (node: number, hue: number) => {
      const inc = adjacency[node];
      if (!inc || !inc.length) return;
      const now = world.time;
      for (let n = 0; n < 26; n++) {
        const i = cursor.current;
        cursor.current = (cursor.current + 1) % COUNT;
        assign(i, now + Math.random() * 0.12, {
          edge: inc[Math.floor(Math.random() * inc.length)],
          hue,
          hot: true,
        });
      }
      markDirty.current = true;
    };
    return () => {
      synapseApi.burst = () => {};
    };
  }, [adjacency, assign]);

  const markDirty = useRef(false);

  useFrame(() => {
    uniforms.uTime.value = world.time;
    uniforms.uReveal.value = world.reveal;
    uniforms.uBreath.value = world.breath;
    uniforms.uImpact.value.copy(world.impact);
    uniforms.uImpactAge.value = world.impactAge;

    const now = world.time;
    let dirty = markDirty.current;
    markDirty.current = false;
    for (let i = 0; i < COUNT; i++) {
      const m = i * 4;
      if (now - pool.aMeta[m] >= pool.aMeta[m + 1]) {
        // Small random delay on rebirth so fibres re-form in drifting waves
        // rather than a uniform flicker.
        assign(i, now + Math.random() * 0.9);
        dirty = true;
      }
    }
    if (dirty) {
      for (const name of ["aStart", "aEnd", "aCtrl", "aMeta", "aHue"]) {
        const attr = geometry.getAttribute(name);
        if (attr) attr.needsUpdate = true;
      }
    }
  });

  const material = useShaderMaterial(() => ({
    vertexShader: synapseVert,
    fragmentShader: synapseFrag,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <primitive object={material} attach="material" />
    </mesh>
  );
}
