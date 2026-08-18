"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Group,
  Matrix4,
  PerspectiveCamera,
  Raycaster,
  Ray,
  Sphere,
  Vector2,
  Vector3,
} from "three";
import { world } from "@/lib/world";

/** Shared handles other components register into. */
export const refs = { brain: null as Group | null };

const BRAIN_RADIUS = 0.88;
/** Half-extents the framing must keep on screen, including fibre overhang. */
const FIT_HALF_W = 0.95;
const FIT_HALF_H = 0.98;
const IDLE_SPIN = 0.055; // rad/s
const DRAG_YAW = 0.0058; // rad per px
const DRAG_PITCH = 0.0040;

const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt));

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export function Rig({ active }: { active: boolean }) {
  const { camera, size } = useThree();

  const raycaster = useRef(new Raycaster()).current;
  const localRay = useRef(new Ray()).current;
  const sphere = useRef(new Sphere(new Vector3(0, 0, 0), BRAIN_RADIUS)).current;
  const hit = useRef(new Vector3()).current;
  const invMat = useRef(new Matrix4()).current;

  // Angular state in radians and rad/s.
  const spin = useRef({ y: 0.4, x: 0.05, vy: IDLE_SPIN, vx: 0 });
  // Pointer delta accumulated between frames, consumed in useFrame.
  const pend = useRef({ dx: 0, dy: 0, on: false });
  const prevPointer = useRef(new Vector2());

  useEffect(() => {
    world.reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let lx = 0;
    let ly = 0;
    // Active touch points, for pinch-to-zoom.
    const touches = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let pinchZoomStart = 0;

    const onMove = (e: PointerEvent) => {
      world.pointer.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1)
      );
      world.hasPointer = true;

      if (touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) {
          const [a, b] = [...touches.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchStart > 0) {
            world.zoomTarget = clamp(
              pinchZoomStart - (d / pinchStart - 1) * 2.4,
              -0.75,
              1.75
            );
          }
          return; // a pinch is not a drag
        }
      }

      if (pend.current.on) {
        pend.current.dx += e.clientX - lx;
        pend.current.dy += e.clientY - ly;
      }
      lx = e.clientX;
      ly = e.clientY;
    };

    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest("[data-ui]")) return; // never steal a UI interaction
      if (e.pointerType === "touch") {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) {
          const [a, b] = [...touches.values()];
          pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
          pinchZoomStart = world.zoomTarget;
          pend.current.on = false;
          world.dragging = false;
          return;
        }
      }
      pend.current.on = true;
      pend.current.dx = 0;
      pend.current.dy = 0;
      lx = e.clientX;
      ly = e.clientY;
      world.dragging = true;
    };

    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinchStart = 0;
      pend.current.on = false;
      world.dragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      world.zoomTarget = clamp(world.zoomTarget + e.deltaY * 0.0016, -0.75, 1.75);
    };

    const onLeave = () => {
      world.hasPointer = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 20);
    const rm = world.reducedMotion ? 0.25 : 1;
    world.time = state.clock.elapsedTime;
    const t = world.time;

    // Two detuned sinusoids: one sine alone reads mechanical, two do not.
    world.breath = Math.sin(t * 0.55) * 0.62 + Math.sin(t * 0.31 + 1.3) * 0.38;

    if (active) world.reveal = Math.min(1, world.reveal + dt / 2.1);

    const pv = world.pointer.distanceTo(prevPointer.current) / Math.max(dt, 1e-4);
    prevPointer.current.copy(world.pointer);
    world.pointerVel = damp(world.pointerVel, Math.min(pv, 6), 6, dt);
    // When the cursor leaves the window the camera drifts back to centre
    // rather than holding whatever lean it was last given.
    const aimX = world.hasPointer ? world.pointer.x : 0;
    const aimY = world.hasPointer ? world.pointer.y : 0;
    const lag = world.hasPointer ? 4.2 : 1.1;
    world.pointerSmooth.x = damp(world.pointerSmooth.x, aimX, lag, dt);
    world.pointerSmooth.y = damp(world.pointerSmooth.y, aimY, lag, dt);

    world.impactAge += dt;
    world.flash = damp(world.flash, 0, 2.6, dt);
    world.bloomPump = damp(world.bloomPump, 0, 2.2, dt);
    world.zoom = damp(world.zoom, world.zoomTarget, 3.2, dt);

    // --- brain rotation ----------------------------------------------------
    const s = spin.current;
    if (pend.current.on) {
      // 1:1 with the pointer while held, recording velocity for the release fling.
      const ry = pend.current.dx * DRAG_YAW;
      const rx = pend.current.dy * DRAG_PITCH;
      pend.current.dx = 0;
      pend.current.dy = 0;
      s.y += ry;
      s.x = clamp(s.x + rx, -0.9, 0.9);
      s.vy = clamp(ry / dt, -7, 7);
      s.vx = clamp(rx / dt, -7, 7);
    } else {
      s.y += s.vy * dt;
      s.x = clamp(s.x + s.vx * dt, -0.9, 0.9);
      // The fling bleeds off into the permanent idle drift.
      s.vy = damp(s.vy, IDLE_SPIN * rm, 1.1, dt);
      s.vx = damp(s.vx, 0, 2.2, dt);
      // and the pitch drifts slowly back toward level.
      s.x = damp(s.x, Math.sin(t * 0.09) * 0.1 * rm, 0.55, dt);
    }

    const brain = refs.brain;
    if (brain) {
      brain.rotation.set(s.x, s.y, Math.sin(t * 0.077) * 0.045 * rm);
      brain.updateMatrixWorld();
    }

    // --- camera ------------------------------------------------------------
    const px = world.pointerSmooth.x;
    const py = world.pointerSmooth.y;
    // Frame from the actual FOV and aspect rather than a breakpoint, so the
    // brain fits any viewport — a tall phone needs roughly twice the distance
    // a landscape desktop does.
    const aspect = size.width / Math.max(1, size.height);
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 38;
    const tanHalf = Math.tan((fov * Math.PI) / 360);

    // Narrow viewports get less lateral lean — there is simply less room for
    // the brain to swing into before it clips.
    const par = Math.min(1, aspect / 1.15) * rm;
    // The parallax excursion has to be inside the framing budget, or the lean
    // pushes the brain off the edge of a portrait window.
    const halfW = FIT_HALF_W + 0.58 * par;
    const base = Math.max(
      3.42,
      Math.max(FIT_HALF_H / tanHalf, halfW / (tanHalf * aspect)) * 1.06
    );

    camera.position.x = Math.sin(t * 0.071) * 0.22 * rm - px * 0.62 * par;
    camera.position.y =
      0.05 + Math.sin(t * 0.053 + 2.0) * 0.13 * rm - py * 0.36 * rm;
    camera.position.z = base - world.zoom + Math.sin(t * 0.041) * 0.09 * rm;
    // The target leans *with* the cursor while the camera leans against it,
    // which roughly doubles perceived parallax without a large camera move.
    camera.lookAt(px * 0.3 * par, 0.02 + py * 0.2 * rm, 0);
    camera.rotation.z += Math.sin(t * 0.037) * 0.035 * rm;

    // --- cursor projected onto the cortex ----------------------------------
    let over = false;
    if (world.hasPointer && brain) {
      raycaster.setFromCamera(world.pointer, camera);
      invMat.copy(brain.matrixWorld).invert();
      localRay.copy(raycaster.ray).applyMatrix4(invMat);
      if (localRay.intersectSphere(sphere, hit)) {
        over = true;
      } else {
        localRay.closestPointToPoint(sphere.center, hit);
        const d = hit.length();
        if (d > 1e-4) hit.multiplyScalar(BRAIN_RADIUS / d);
      }
      world.cursorLocal.copy(hit);
    }
    world.cursorStrength = damp(
      world.cursorStrength,
      over ? 1 + Math.min(world.pointerVel * 0.22, 0.9) : 0,
      over ? 7 : 3,
      dt
    );

    // --- screen-space lenses for the refraction pass ------------------------
    const cursorLens = world.lenses[0];
    cursorLens[0] = (world.pointerSmooth.x + 1) * 0.5;
    cursorLens[1] = (world.pointerSmooth.y + 1) * 0.5;
    cursorLens[2] = 0.17;
    cursorLens[3] = world.hasPointer
      ? (0.07 + Math.min(world.pointerVel * 0.05, 0.13)) * world.reveal * rm
      : 0;

    const shock = world.lenses[2];
    if (world.impactAge < 1.9) {
      const a = world.impactAge;
      shock[2] = 0.05 + a * 0.42;
      shock[3] = 0.55 * (1 - a / 1.9) * (1 - a / 1.9);
    } else {
      shock[3] = 0;
    }
  }, -1000);

  return null;
}
