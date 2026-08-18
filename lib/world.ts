import { Vector2, Vector3 } from "three";

/**
 * Per-frame values shared between scene components. Deliberately not React
 * state: these change every frame and nothing about them should re-render.
 * `Rig` is the sole writer (useFrame priority -1000, which sorts first).
 */
export const world = {
  time: 0,
  /** -1..1 slow sinusoid driving every "alive" motion in the scene. */
  breath: 0,
  /** 0..1 arrival progress. */
  reveal: 0,

  pointer: new Vector2(),
  pointerSmooth: new Vector2(),
  pointerVel: 0,
  hasPointer: false,

  /** Cursor projected into brain-local space, for the cortical bulge. */
  cursorLocal: new Vector3(0, 0, 99),
  cursorStrength: 0,

  /** Last thought impact, in brain-local space. */
  impact: new Vector3(),
  impactAge: 99,
  /** 0..1 screen-wide wash on submit. */
  flash: 0,
  /** Extra bloom on submit. */
  bloomPump: 0,

  /** Scroll-driven dolly, smoothed. */
  zoom: 0,
  zoomTarget: 0,

  dragging: false,
  dragVel: new Vector2(),

  /** Screen-space lenses for the refraction pass: x, y, radius, strength. */
  lenses: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ] as number[][],

  reducedMotion: false,
};

export function resetWorld() {
  world.time = 0;
  world.reveal = 0;
  world.impactAge = 99;
  world.flash = 0;
  world.bloomPump = 0;
}

/** DOM nodes the frame loop writes to directly, bypassing React re-renders. */
export const domRefs = { label: null as HTMLDivElement | null };

/** The composer element, so a launching orb can start exactly where it sits. */
export const uiRefs = { composer: null as HTMLElement | null };
