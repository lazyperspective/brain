# Part IV — fourth pass: keep improving

The user watched the flow pass and said: **"Continue to improve."** So it went in the right direction (longer, connected,
camera-driven action, whole-body villain motion). Keep that and raise the quality further. All the rules in brief.md,
brief2.md, brief3.md and cues.md still hold: locked cue times and captions, ≤ ~3 flashes/s, one-frame impact frames, no long
freezes, no git, only your own file.

## Method
1. **Make a one-frame-per-second contact sheet of your range** from the current film:
   `ffmpeg -ss T0 -t DUR -i /home/user/brain/fable-saga-video/the-sunderer-16x9.mp4 -vf "fps=1,scale=384:216,tile=6x10" -frames:v 1 out.png`.
   (It has the latest picture.)
   Critique every second honestly. Look for:
   - anything plain: flat gradients, empty backgrounds, muddy noise, a hard-edged box;
   - anything unclear: you can't tell who hits whom, a silhouette lost in glare, the subject off-frame;
   - anything stiff: frozen limbs, a body that doesn't react;
   - anything abrupt: a cut that jumps in space, light or scale with no motivation;
   - anything inconsistent with the world: where they are, the time of day, which side each is on.
2. **Fix the worst ten or so things, in order of how much a viewer would notice.** Then make a new sheet and check again.
3. **Report:** a before/after sheet, the list of what you fixed, what's still weakest, and the verification (build, all frames render, flashcheck, ms/frame).

## Known weak points to include
- **s4 (58–104):**
  - the slam at 65.2–66.0 is a lone close-up arm (join it to the beating world or show his body);
  - the 62.75 cut-in mirrors the hero, so it faces the other way;
  - the pit punch at 100.35–101.25 loses the hero's light under the fist, the wall scroll streaks, and the change into the rock strata is weak;
  - the chasm field at the blade's root is a flat noise-textured red wedge, so give it real walls;
  - the 62.6 lip slab and the 88.9 ride's sea-to-cloud band are plain.
- **s5 (104–180):**
  - the final cut at 144.6–146.6: his mask is too small and hidden, so "crown to base" doesn't read; frame it so the cut through his whole height is unmistakable;
  - the cut at 139.6 jumps from the split-sun night to the brighter combo sky, so match the light;
  - the 146.6 plain wide-to-close cut;
  - at FURTHER (134–135.3) the black sun being thrown back is off-frame;
  - the two-hand sun crush (123.3–124.3) hides the sun behind his knuckles: show it squeezed, light bursting between the fingers;
  - the slow cuts at 107.4, 110.5, 113 and 114.6: make them flow (match cuts, camera moves) where it helps.
