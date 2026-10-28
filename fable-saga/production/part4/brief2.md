# Part IV — second pass: contact, motion, fidelity

## The user's feedback on the finished film (verbatim)
> "I absolutely love this, all we need to do is work on the movement, the areas where the villain and the hero are touching each other, the structure of the villain, his hands, everything is stiff. Also the graphic fidelity seems to be less than the old videos, need a major upgrade in graphic fidelity"

Keep everything they love: story, staging, timing, captions. This pass makes it move like real animation and look as rich
as parts II and III did. `cues.md` stays locked. The photosensitivity rule from `brief.md` still holds: one-frame impact
frames, at most about 3 flashes a second.

## What I changed in the engine (read `src/d_sunderer.js` and `src/e_world.js`)
### Hands
`sHand(x, y, s, a, h, t)` is a real hand: a palm of porcelain plates, four jointed fingers with claws, and a thumb.
- **Pose parameters in `h`:**
  - `curl` 0..1 (open → fist), or per finger `curls: [index, middle, ring, little]`;
  - `thumb` 0..1 (tucked across) and `spread` 0..1;
  - `side` ±1 (thumb side) and `heat`.
- **Layers:** `layer: 'palm' | 'fingers'` draws only one layer.
- **`hold(info)`** is called between the palm and the fingers, so whatever the hand holds (the hero, a blade, an orb, the shard) sits INSIDE the hand with the fingers closing over it. `info` gives `{ palm: [x, y], front: [x, y], ux, uy, s }`.
- **Return value:** an array `[x, y]` (the striking point: knuckles for a fist, fingertips for an open hand) with `.palm`, `.tip` and `.knuckles` attached.
- **Old pose names still work** as presets: `'fist'`, `'open'`, `'chop'`, `'grab'`, plus new `'claw'`, `'pinch'` and `'point'`. `pose` may also be a hand object.
- **`sGauntlet(x, y, s, a, pose, heat, t, extra)`** is a wrapper; `extra` merges into the hand params, e.g. `{ hold, layer, curl }`.

### His arms have physics
This is automatic inside `sunderer()`, stateful per draw like the hero's `life()`. It needs consecutive frames, so judge it with `strip.js`.
- The wrist goes exactly where you put it, so contacts still land on their frame.
- **Around the wrist, automatically:**
  - the elbow trails the hand's motion and overshoots;
  - the shoulder heaves toward the reach;
  - the whole upper body and mask lean into the arms' motion and rock back (add your own on top with `o.lean`, in local units, e.g. a wind-up lean back before a punch);
  - the hand's angle follows the forearm a beat late;
  - a blow that stops dead makes the hand shudder;
  - **finger poses close and open over a few frames instead of snapping.**

  So animate wrist paths with wind-up, strike, follow-through and recovery on arcs; never freeze an arm.
- **Arm options:** `{ x, y, pose, front, cut, ang, heat, fs }`, plus new `hold` (a function, as above) and `layer`.

### Anatomy
- Muscled upper arms (glossy obsidian, rim-lit by fire, veins), porcelain vambraces of three plates with fire in the gaps, an elbow cop, and a shoulder ball.
- The body is bump-mapped obsidian (relief, gloss, fire veins concentrated round the heart).

### Helpers
`limbF(ax, ay, bx, by, rfn(u), rmax, fn(u, side, lit, X, Y, e))` draws a lit tube; `obsLit(lit, X, Y, e, heat)` gives the obsidian colour.

### The world below the clouds
`belowWorld(t, hz, ox, burn, skyCols, lightX)` is richer:
- faceted spires (lit and shadow faces, strata, mist at the base);
- the fire's reflection on the sea under `lightX`;
- the lit underside of the cloud sea.

## What to do in your section
1. **Use the engine, not copies.** Any local copy of the old body, arm or hand renderer, or of a flat background, must be replaced so it looks like the upgraded engine. Either call the engine functions, or bring your copy up to the same fidelity: relief, gloss, rim light, anatomy.
2. **Every point of contact between the villain and the hero, the blade, the orbs or the world:**
   - **Grabs and holds** use `hold` so the fingers wrap round the thing held: palm behind it, fingers over it. The fingers close on cue (animate `pose` from open to grab or fist over 3–6 frames), and the held thing is squeezed (hero `sq`, `cracks`) and struggles.
   - **Punches:**
     - the knuckles land exactly on the hero's body on the hit frame (position the wrist so `.knuckles`/the returned point meets the hero);
     - the hero deforms along the blow (squash, stretch on recoil) and is launched along it with hit-stop;
     - the fist follows through past the contact point, then recovers;
     - his whole body leans into it (`o.lean` wind-up back, then forward);
     - the camera kicks along the blow.
   - **Catches and blocks:** the blade visibly stops between fingers or against the palm. Fingers close on it (`pinch`/`grab` with `hold` drawing the blade first). Sparks come from the exact contact point, and the arm absorbs the force (pushed back a few px, then springs).
   - **Stomps and presses:** the hand flattens onto the hero; fingers splay as it presses (`spread` up, `curl` down); the ground cracks round the fingertips.
3. **His structure must never be stiff:**
   - between blows his arms drift and his fingers flex;
   - his head turns to track the hero (`tilt`, `nod`, eye `look` if useful);
   - he breathes and his shoulders roll;
   - before big moves he winds up with his whole body (`o.lean`, `nod`, the arm drawn back);
   - after them he settles.
4. **Fidelity.** Raise the art to parts II and III:
   - richer backgrounds (layered skies, lit clouds, atmospheric depth, light shafts, embers in depth);
   - no flat single-colour areas;
   - no muddy noise;
   - effects that read clearly;
   - proper lighting on both characters: rim light from the main light source, the fire's glow on nearby surfaces, the hero's light on him when it is close.
5. **Verify.**
   - The build passes and every frame of your section renders.
   - `flashcheck` is fine; render cost stays under about 45 ms/frame on average.
   - Review contacts with `strip.js` at step 1 around each hit, and make before/after strips of the biggest improvements.
