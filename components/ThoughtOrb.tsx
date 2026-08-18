"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useShaderMaterial } from "@/lib/useShaderMaterial";
import {
  AdditiveBlending,
  BufferGeometry,
  Mesh,
  Vector3,
} from "three";
import type { BrainData } from "@/lib/brainGeometry";
import { orbFrag, orbVert, trailFrag, trailVert } from "@/lib/shaders/orb";
import { useAnima } from "@/lib/store";
import { hashId } from "@/lib/thoughts";
import { uiRefs, world } from "@/lib/world";
import { refs } from "./Rig";
import { synapseApi } from "./Synapses";
import { assignNodes } from "./ThoughtNodes";

const FORM = 0.30;
const FLY = 1.35;
const TRAIL_POINTS = 22;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack = (t: number) => {
  const c1 = 1.9;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

type Flight = {
  seq: number;
  hue: number;
  node: number;
  /** world-space */
  start: Vector3;
  ctrl: Vector3;
  targetLocal: Vector3;
  t: number;
  landed: boolean;
};

/**
 * A submitted thought becomes a droplet at the input, arcs into the brain, and
 * detonates on the cortical node it will permanently occupy.
 */
export function ThoughtOrb({ data }: { data: BrainData }) {
  const { camera } = useThree();
  const pending = useAnima((s) => s.pending);
  const thoughts = useAnima((s) => s.thoughts);
  const clearPending = useAnima((s) => s.clearPending);

  const mesh = useRef<Mesh>(null);
  const trailGeo = useRef<BufferGeometry>(null);
  const flight = useRef<Flight | null>(null);

  const scratch = useMemo(
    () => ({
      p: new Vector3(),
      prev: new Vector3(),
      dir: new Vector3(),
      tgt: new Vector3(),
      a: new Vector3(),
      b: new Vector3(),
      c: new Vector3(),
    }),
    []
  );

  const trail = useMemo(() => {
    const position = new Float32Array(TRAIL_POINTS * 3);
    const aIndex = new Float32Array(TRAIL_POINTS);
    for (let i = 0; i < TRAIL_POINTS; i++) aIndex[i] = i / (TRAIL_POINTS - 1);
    return { position, aIndex };
  }, []);

  const orbUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSquash: { value: 0 },
      uDir: { value: new Vector3(0, 1, 0) },
      uWobble: { value: 1 },
      uHue: { value: 0.46 },
      uIntensity: { value: 0 },
    }),
    []
  );

  const trailUniforms = useMemo(
    () => ({
      uScale: { value: 600 },
      uSize: { value: 0.0110 },
      uAlpha: { value: 0 },
      uHue: { value: 0.46 },
    }),
    []
  );

  // Launch
  useEffect(() => {
    if (!pending) return;
    const map = assignNodes(thoughts, data.nodeCount);
    const node = map.get(pending.id) ?? hashId(pending.id) % data.nodeCount;

    // The droplet is born exactly where the composer sits on screen, so the
    // collapsing text and the forming orb occupy the same point.
    let ndcX = 0;
    let ndcY = -0.78;
    const el = uiRefs.composer;
    if (el && typeof window !== "undefined") {
      const r = el.getBoundingClientRect();
      ndcX = ((r.left + r.width / 2) / window.innerWidth) * 2 - 1;
      ndcY = -(((r.top + r.height / 2) / window.innerHeight) * 2 - 1);
    }
    const ndc = new Vector3(ndcX, ndcY, 0.5).unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const start = camera.position.clone().addScaledVector(dir, 1.75);

    const targetLocal = new Vector3(
      data.nodes[node * 3],
      data.nodes[node * 3 + 1],
      data.nodes[node * 3 + 2]
    );
    const targetWorld = targetLocal.clone();
    if (refs.brain) refs.brain.localToWorld(targetWorld);

    // Swing wide before curving in, so the arc is legible rather than a straight line.
    const side = Math.random() < 0.5 ? -1 : 1;
    const ctrl = start
      .clone()
      .lerp(targetWorld, 0.45)
      .add(new Vector3(side * (0.30 + Math.random() * 0.22), 0.52, 0.30));

    flight.current = {
      seq: pending.seq,
      hue: 0.44 + Math.random() * 0.12,
      node,
      start,
      ctrl,
      targetLocal,
      t: 0,
      landed: false,
    };
    orbUniforms.uHue.value = flight.current.hue;
    trailUniforms.uHue.value = flight.current.hue;
    clearPending();
  }, [pending, thoughts, data, camera, clearPending, orbUniforms, trailUniforms]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 20);
    const f = flight.current;
    const m = mesh.current;
    if (!m) return;

    orbUniforms.uTime.value = world.time;
    trailUniforms.uScale.value =
      state.size.height *
      state.gl.getPixelRatio() *
      0.5 *
      state.camera.projectionMatrix.elements[5];

    if (!f) {
      m.visible = false;
      orbUniforms.uIntensity.value = 0;
      trailUniforms.uAlpha.value = 0;
      world.lenses[1][3] = 0;
      return;
    }

    f.t += dt;
    m.visible = true;

    const { p, prev, dir, tgt, a, b, c } = scratch;
    // The target rides the rotating brain, so the orb homes rather than aims.
    tgt.copy(f.targetLocal);
    if (refs.brain) refs.brain.localToWorld(tgt);

    if (f.t < FORM) {
      // Gather: the droplet condenses out of nothing with an elastic overshoot.
      const k = f.t / FORM;
      p.copy(f.start);
      const s = easeOutBack(k) * 0.0135;
      m.scale.setScalar(Math.max(s, 0.001));
      orbUniforms.uSquash.value = 0;
      orbUniforms.uWobble.value = 1.5 - k * 0.6;
      orbUniforms.uIntensity.value = k;
      trailUniforms.uAlpha.value = 0;
      m.position.copy(p);
    } else if (!f.landed) {
      const k = Math.min(1, (f.t - FORM) / FLY);
      const e = easeInOutCubic(k);

      a.copy(f.start);
      b.copy(tgt);
      c.copy(f.ctrl);
      const u = 1 - e;
      p.copy(a).multiplyScalar(u * u)
        .addScaledVector(c, 2 * u * e)
        .addScaledVector(b, e * e);

      prev.copy(m.position);
      m.position.copy(p);
      dir.copy(p).sub(prev);
      const speed = dir.length() / Math.max(dt, 1e-4);
      if (dir.lengthSq() > 1e-9) dir.normalize();
      else dir.set(0, 1, 0);

      orbUniforms.uDir.value.copy(dir);
      // Stretch into a teardrop in proportion to how fast it is moving.
      orbUniforms.uSquash.value = Math.min(speed * 0.16, 0.85);
      orbUniforms.uWobble.value = 0.9;
      orbUniforms.uIntensity.value = 1;
      m.scale.setScalar(0.0135 * (1 - k * 0.22));

      // Trail: sample the same curve slightly behind the head. Exact, and no
      // ring buffer to drift out of sync.
      for (let i = 0; i < TRAIL_POINTS; i++) {
        const te = Math.max(0, e - i * 0.022);
        const uu = 1 - te;
        const x = a.x * uu * uu + c.x * 2 * uu * te + b.x * te * te;
        const y = a.y * uu * uu + c.y * 2 * uu * te + b.y * te * te;
        const z = a.z * uu * uu + c.z * 2 * uu * te + b.z * te * te;
        trail.position[i * 3] = x;
        trail.position[i * 3 + 1] = y;
        trail.position[i * 3 + 2] = z;
      }
      if (trailGeo.current) {
        const attr = trailGeo.current.getAttribute("position");
        if (attr) attr.needsUpdate = true;
      }
      trailUniforms.uAlpha.value = Math.min(1, k * 4) * (1 - k * 0.15);

      // Refraction lens follows the droplet across the screen.
      scratch.a.copy(p).project(state.camera);
      const lens = world.lenses[1];
      lens[0] = (scratch.a.x + 1) * 0.5;
      lens[1] = (scratch.a.y + 1) * 0.5;
      lens[2] = 0.11;
      lens[3] = 0.55;

      if (k >= 1) {
        f.landed = true;
        // Impact: shockwave through the cortex, fibre burst, bloom pump, wash.
        world.impact.copy(f.targetLocal);
        world.impactAge = 0;
        world.flash = 1;
        world.bloomPump = 1;
        world.zoomTarget = Math.max(-0.75, world.zoomTarget - 0.10);
        synapseApi.burst(f.node, f.hue);
        const shock = world.lenses[2];
        const sp = scratch.b.copy(tgt).project(state.camera);
        shock[0] = (sp.x + 1) * 0.5;
        shock[1] = (sp.y + 1) * 0.5;
      }
    } else {
      // Bloom out and vanish.
      const k = Math.min(1, (f.t - FORM - FLY) / 0.42);
      m.position.copy(tgt);
      m.scale.setScalar(0.0135 * (1 + k * 3.4));
      orbUniforms.uIntensity.value = Math.pow(1 - k, 2.2);
      orbUniforms.uWobble.value = 0.9 + k * 2.2;
      trailUniforms.uAlpha.value = Math.pow(1 - k, 2) * 0.8;
      world.lenses[1][3] = 0.55 * (1 - k);
      if (k >= 1) {
        flight.current = null;
        world.lenses[1][3] = 0;
      }
    }
  });

  const orbMaterial = useShaderMaterial(() => ({
    vertexShader: orbVert,
    fragmentShader: orbFrag,
    uniforms: orbUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));

  const trailMaterial = useShaderMaterial(() => ({
    vertexShader: trailVert,
    fragmentShader: trailFrag,
    uniforms: trailUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  }));

  return (
    <>
      <mesh ref={mesh} visible={false} frustumCulled={false}>
        <icosahedronGeometry args={[1, 5]} />
        <primitive object={orbMaterial} attach="material" />
      </mesh>
      <points frustumCulled={false}>
        <bufferGeometry ref={trailGeo}>
          <bufferAttribute attach="attributes-position" args={[trail.position, 3]} />
          <bufferAttribute attach="attributes-aIndex" args={[trail.aIndex, 1]} />
        </bufferGeometry>
        <primitive object={trailMaterial} attach="material" />
      </points>
    </>
  );
}
