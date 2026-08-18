# ANIMA — a collective mind

A living brain assembled from people's thoughts. It arrives already thinking:
fibres forming and fading, charge running the network, slow swells of activation
drifting through the cortex. Add a thought and it collapses into a droplet,
arcs into the brain, and detonates on the cortical node it will occupy from then on.

Hover any light to read the thought living there.

## Running it

```bash
npm run dev
```

```bash
npm run build && npm start
```

## How it is put together

Everything is generated at runtime. There are no models, textures, or asset files.

### The brain is a signed distance field, not a mesh

`lib/brainField.ts` builds the anatomy from smooth-min unions: two cerebral
hemispheres fused across the midline, temporal lobes, a cerebellum, and a tapered
brainstem capsule — then carves the four sulci that actually carry the silhouette
(longitudinal, lateral/Sylvian, central, and the transverse notch separating
occipital lobe from cerebellum).

Gyri come from **ridged noise**: the zero-crossing contours of a 3D Perlin field
are winding closed curves, which is the topology of cortical folds. Pushing the
surface outward along those contours raises gyri and leaves sulci between them.

`lib/brainGeometry.ts` rejection-samples that field into ~100k points — a dense
shell hugging the cortex plus a sparser interior fill — and thins the surface set
into ~1200 evenly-spread synapse anchors with a candidate edge graph over them.
Each surface point also carries its fold height, its baked occlusion, and a hue
offset for the structure it belongs to. The smooth field acts as a cheap
prefilter so the expensive noise only runs on samples near the surface.

Whole build is ~600ms, so it runs in a **worker** and never touches the frame
loop; the backdrop is already on screen while it works.

### Rendering layers

| Layer | Technique |
|---|---|
| Backdrop | Clip-space quad, domain-warped fbm thresholded into sparse wisps |
| Cortex | Two point passes — dim wide sprites for a continuous body, full-density small sprites for grain. Lit by a fixed key/fill pair with baked occlusion |
| Fibres | ~780 instanced billboard ribbons on quadratic Béziers, recycled from a lifetime pool |
| Charge | ~560 GPU-animated motes with 4-point trails, re-routed only as each run completes |
| Depth | 3400 drifting dust motes outside the brain group, so parallax comes from real 3D depth |
| Thoughts | One bright node per thought, hover-tested in screen space |
| Post | Custom refraction pass → bloom → chromatic aberration → vignette → grain → tone map |

### Notes on things that are easy to get wrong

**R3F copies the `uniforms` prop.** `applyProps` does
`uniforms[name] = { ...uniform }`, so a memoized uniforms object passed to
`<shaderMaterial>` is *not* the object the renderer reads. Scalar writes like
`u.uTime.value = t` silently go nowhere. Every material here is constructed
through `lib/useShaderMaterial.ts` and mounted with `<primitive>` so there is one
uniforms object shared by the frame loop and the GPU.

**A point-cloud shell renders as a hollow ring.** A view ray grazing the shell
crosses roughly `1/cos θ` as many points as one hitting it face-on, so the limb
piles up and the middle looks empty. Scaling each point's brightness by `cos θ`
cancels it almost exactly. Interior points carry a synthetic radial normal, so
they are held out of that term.

**Additive blending destroys colour if hue varies per point.** Neighbouring
sprites of different hues sum toward white. Hue here varies *spatially* and is
weighted to the vertical axis on purpose — the camera looks roughly along z, so
any hue variation in z gets integrated away along each view ray.

**Tone mapping choice matters for emissive work.** AgX deliberately desaturates
highlights toward white, which is wrong when the colour *is* the subject. This
uses Khronos Neutral, which preserves hue through the roll-off.

**`gl_PointSize = size * uScale / dist` makes `size` a world diameter,** not
pixels — with `uScale = height · dpr · 0.5 / tan(fov/2)`.

**A point cloud shaded only by view-relative terms has no form.** Facing, grazing
and rim angle all move with the camera, so the body reads as an even glow no
matter how much contrast you put into them. What gives it shape is a light
*direction*: a fixed key/fill pair in **view space**, so the brain has a lit side
and a shadowed side that hold as it rotates under them.

**Occlusion cannot be measured by marching the field along the normal.**
`analyticField` is a scaled approximation, not a true distance — the value grows
slower than the step, so every point reads as occluded and the whole body just
dims. Sampling a hemisphere and asking which points land *inside* the body is
immune to that scaling, and it finds the creases that actually define the
anatomy: the longitudinal fissure, the notch above the cerebellum, the underside
of the temporal lobes.

**Bloom erases form.** At a low luminance threshold with a wide radius, every lit
point bleeds into the sulci and flattens the occlusion back out. It is restricted
here to genuine highlights, which is what let the folds and the shadow side read.

**A worker must not import the module that references it.** Putting
`new Worker(new URL('./x.worker.ts', ...))` inside a module that `x.worker.ts`
itself imports makes the worker's dependency graph point back at the worker. Dev
tolerates the cycle; `next build` walks it forever and never finishes. The
reference lives in `lib/buildBrainAsync.ts`, outside the worker's own graph.

### Colour and shadow

Value alone would not separate the structures, so colour carries part of the
load. `regionTint` in `lib/brainField.ts` works out which component a point
belongs to — cerebrum, temporal lobe, cerebellum, stem — by re-evaluating the
same primitives the field is built from, and returns a hue offset on the palette
ring. Weights are soft, so points near a boundary blend instead of banding. The
cerebellum runs sky blue, the stem orange, the cerebrum stays on the base hue.

The palette ring is indigo → orchid → orange → sky blue. The cortex only samples
the cool arc of it, which is why sky blue lands on the body for free while
orange stays an accent: only elements that are actively firing — sparking
points, charge pulses on a minority of fibres, the brainstem, an arriving
thought — travel far enough round the ring to reach it. Widening that sampling
range is what would turn the accent into a scheme, and is deliberately not done.

Colour temperature also follows the light: lit crowns drift warm, sulci and
occluded creases fall cool, and the far half of the body cools as it recedes.

### State

Per-frame values (breath, cursor, impact, lenses) live in a plain mutable
singleton at `lib/world.ts`, written only by `Rig` at `useFrame` priority
`-1000`, which sorts first. Routing them through React would re-render the tree
120 times a second. Zustand holds only the thought list and hover identity; the
hover label is positioned by direct DOM writes from the render loop.

### Interaction

Drag rotates with a release fling that bleeds into the permanent idle drift;
scroll or pinch dollies; the cursor is projected onto the cortex and pushes a
bulge through it; camera and look-at target lean in opposite directions, which
roughly doubles perceived parallax without a large camera move. Lateral parallax
and framing distance are both derived from the viewport aspect, so the brain fits
and stays fitted from ultrawide to phone.

`prefers-reduced-motion` damps camera drift, spin, and parallax to a quarter.

### Persistence

Thoughts are seeded from `lib/thoughts.ts` and the visitor's own are kept in
`localStorage` (`anima.thoughts.v1`). There is no backend — swapping
`loadThoughts`/`persistOwn` for a real store is the only change needed to make
the collective genuinely shared.

## Performance

120fps (display-capped) at a 1332×1724 draw buffer on an M-series Mac; p95 frame
9.3ms. DPR is capped at 2 and the composer runs without MSAA. Geometry is built
in a worker, so the ~600ms of field sampling never costs a frame.
