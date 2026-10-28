# Part IV — third pass: flow (fewer, longer, connected shots), villain motion, richer fight shots

## The user's feedback (verbatim)
> "Need to polish a bit more, some cuts are abrupt, the action sequence felt smoother and natural before, now it feels
> like it has too many cuts, stiff villain movements. Let's first work on the abrupt cuts in the action sequence, and
> critique each shot and make it better. Some shots of the villain fighting look plain"

## Diagnosis (measured)
**Shot lengths in the action passages** (`shot()` boundaries):
- **58–72:** 15 shots, many 0.4–0.8 s: 62.0–62.6, 62.6–63.0, 64.2–64.6, 64.6–65.2, 65.2–66.0, 67.0–67.75, 67.75–68.4, 68.4–69.0.
- **88.9–101.25:** 14 shots, mostly 0.45–0.9 s: 90.6–91.4, 91.4–92.0, 92.0–92.45, 92.45–93.0, 93.0–93.6, 93.6–94.15, 96.5–97.3, 97.3–98.2, 98.2–98.9, 100.0–100.6, 100.6–101.25.
- **139.6–144.75:** 7 shots of 0.55–0.7 s.

**Why the motion looks choppy and stiff:**
- When the camera, scale and screen side change every half second, the eye never settles and the choreography can't be followed.
- Every cut also resets the per-draw physics: the villain's arm springs, the hero's `life()` and the slash trails. That makes his motion look stiff and snapped, because each new shot starts his arms "fresh".
- The hit-stop holds added in the last pass freeze motion on top of the cuts.

## What to do: edit for flow
1. **Merge each run of short shots into one or two longer continuous shots, about 2–4 s each.**
   - One shared world and one camera that MOVES between the beats: tracks the hero, pans with the blow, pushes in on a contact, pulls out for scale, rolls into a turn, whip-pans to the next target (`WHIPS` / `whip`).
   - The beats (HIT times in `cues.md`) stay exactly where they are; only the cutting changes.
   - Where a cut is still needed, make it motivated and connected:
     - a match cut on action, where the motion continues across the cut in the same direction and screen position;
     - a whip pan;
     - or a cut on the impact frame.

   Never cut mid-wind-up or mid-recovery. Keep screen direction consistent: hero on the left, him on the right, unless the camera visibly travels round.
2. **Hit-stop:**
   - at most 2 frames, and only on the biggest hits;
   - motion must never freeze for longer than that;
   - prefer slowing time (easing the tracks) to freezing it.
3. **Villain motion must be big and fluid.** He should fight with his whole body, not just move wrists:
   - big arcs for the fists, with wind-ups that pull the shoulder and body back (`o.lean` and `nod` well beyond ±10, e.g. lean −25 → +30 in local units);
   - follow-through that carries him through and round;
   - recovery while drifting into the next blow (overlap the next wind-up with the last recovery).

   Because his arm physics needs consecutive frames in the same shot, long shots are what make it work. Remember `SLIFE.n` now resets every frame in `z_frame.js`, so you no longer need your own reset. A local reset is harmless but redundant.
4. **No plain fight shots.** Every shot of him fighting needs:
   - depth: foreground elements (spray, rocks, ash, cloud wisps) passing the camera, plus mid-ground and background layers;
   - light interaction: his fire lighting the hero, the hero's light rim-lighting him, light shafts, embers in depth;
   - environmental reaction to each blow: the sea displaced, clouds pushed in rings, debris and dust;
   - a strong composition, with a camera angle that sells scale (low angles on him, the hero small against him).

   Flat gradient backgrounds behind him are not acceptable.
5. **Critique every shot** in your range with `strip.js` at step 1 and 2 across each merged sequence. Fix anything that reads stiff, unclear, plain or abrupt.
6. **Verify:**
   - the build passes and every frame of your range renders;
   - `flashcheck` (≤ ~3 flashes/s, impact frames one frame) and render cost ≤ ~45 ms/frame average;
   - `node cutscan.js BUILT t0 t1` lists the real cuts in a range (histogram jumps). Report the shot count and the average shot length of your action passages before and after.

Captions, cue times and the story stay exactly as they are. Avoid imagery resembling hate symbols or hooded robes. No git.
