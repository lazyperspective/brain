# Tunnel book + shadow theatre style tests

Both clips were rendered on the CPU in Python (numpy and OpenCV, no GPU, no 3D engine). Every texture is procedural (`common.py`).
Both scenes are made of real planes at real depths. Each plane is parallel to the image plane, so
camera projection and point-lamp shadow projection are both exact affine maps (scale and offset).
The depth, parallax, penumbra and defocus therefore follow the real geometry, not 2D layer fakes.

## tunnel_book.mp4 (`tunnel.py`)
- There are 14 flats between z=3.0 and z=4.95: the proscenium with painted drapes and "THEATRE ROYAL" cartouche,
  a cloud border, four sea flats, the boat on a stick, the cliff and lighthouse, a vellum beam on a pivot pin,
  the whale on a stick, far sea, horizon, the moon on a wire, and a sky backdrop with pin-pricked stars.
- Each flat is a hand-cut silhouette (outline jittered along its normal). It is painted with gouache (streaky
  directional strokes) or watercolour (granulation, blooms, pigment pooled at the edges). It also has ink
  outlines, engraved-style hatching, paper fibre and tooth as bump shading, and a white cut-paper rim on the
  edges that face the lamp.
- Light comes from a warm area lamp in front, above and to the left. For every pair of flats, the front flat's
  alpha is projected through the lamp onto the flat behind it, with a penumbra blur that grows with the gap.
  This gives real cast shadows, such as the lighthouse shadow on the sky and the boat shadow on the wave behind.
  A spot cone, cool ambient fill and backlit emissive parts (lantern, moon tissue, stars, beam) finish the lighting.
- Camera: a 0.88-unit dolly forward through the proscenium with a slight crab. The depth of field is thin-lens
  (circle of confusion proportional to |1/d - 1/focus|) and focused on the lighthouse and whale plane.
- Motion: sea flats slide on rails in alternate phase, the boat bobs and rocks on its stick, the whale rises
  and tilts on its stick, and the beam turns on its pin.

**Critique:** This is the most convincingly physical of the two. The parallax, defocused proscenium, paper
rims and cast shadows read as a real object. Weak points: the flats are perfectly flat (no card warp, and you
never see paper thickness side-on), and the valance shadow darkens much of the upper sky. The beam reads as a
painted paper wedge more than as light, and the whale and boat are simple, graphic shapes.

## shadow_theatre.mp4 (`shadow.py`)
- A warm lamp sits 3 units behind a washi screen. It has a slight flicker in intensity and a jitter in position,
  so the far shadows shimmer more than the near ones.
- Each puppet is a plane at distance d. Its shadow scales by S/(S-d) and blurs by lamp_r*d/(S-d), which is
  exactly why shadows near the screen are sharp and shadows near the lamp are big and soft.
- Materials, as transmittance: black card (cliff and lighthouse with wayang-style lacework, slit stripes and an
  amber-gel lantern; foam-punched wave cards); dyed translucent leather (sails, the mid wave, and the jointed
  whale with carved dots, pleat slits, a pinned tail joint and two rods); and acetate gels (three overlapping
  sky strips at different depths with scratches, tape and a moon hole, a tissue moon, and a sea gel).
- The bamboo rods are 3D segments projected through the lamp, so they soften as they run back toward the
  puppeteer. The lighthouse beam is a small lantern just behind the screen shining through a swinging
  yellow-gel slot.
- The washi has fibres, a seam where two sheets overlap, and a crease. It sits at the back of a wooden box. The
  camera pushes in, so the perspective box walls (lit by the screen's glow) and the defocused front face
  parallax against the screen.
- Motion: the whale travels from near the lamp (a huge soft shape over the sky) to the screen, where it
  sharpens and its tail flicks. The boat bobs on its rod, the wave cards slide, and the beam gel swings.

**Critique:** The whale coming toward the screen and sharpening is the strongest "depth made of shadow" moment.
The gels, tape and lacework sell the handmade feel. Weak points: the bottom third is mostly black card, and
the box and frame are dim, so the physical stage reads less strongly than the screen. The sky gels are
saturated poster bands, and the analytic beam is a little too clean and digital.
