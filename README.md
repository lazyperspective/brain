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

`lib/brainGeometry.ts` rejection-samples that field into ~90k points — a dense
shell hugging the cortex plus a sparser interior fill — and thins the surface set
into ~1200 evenly-spread synapse anchors with a candidate edge graph over them.
The smooth field acts as a cheap prefilter so the expensive noise only runs on
samples near the surface. Whole build: ~380ms, deferred two frames past first
paint so the backdrop is on screen before it runs.

### Rendering layers

| Layer | Technique |
|---|---|
| Backdrop | Clip-space quad, domain-warped fbm thresholded into sparse wisps |
| Cortex | Two point passes — dim wide sprites for a continuous body, full-density small sprites for grain |
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
9.4ms. DPR is capped at 2 and the composer runs without MSAA.
