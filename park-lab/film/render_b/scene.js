// scene.js: assemble the detailed park + per-land light control + camera helper
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { installPeople, buildGuests } from './people.js';
import { buildTracks } from './tracks.js';
import { buildRides } from './rides.js';
import { buildNature } from './nature.js';
import { U } from './mat.js';

export function buildScene(park, M, opts = {}) {
  const t0 = performance.now();
  const W = buildWorld(park, M, opts);
  installPeople(W, park, { lod: opts.personLOD || 'hi' });
  buildRides(W, park, opts);
  buildTracks(W, park, opts);
  buildNature(W, park, opts);
  buildGuests(W, park, { subsample: opts.guestSub || 1 });
  W.buildMs = performance.now() - t0;
  W.update = (t, shot) => { U.uTime.value = t; for (const a of W.animators) a(t, shot); };
  // ---- per-land light levels: {land: 0..1}; gains for bulbs, windows, glows, pools
  W.setLights = (levels, gain = 1, t = 0) => {
    const lv = l => (levels[l] != null ? levels[l] : (levels.all || 0));
    for (const k in W.MAT) {
      const m = W.MAT[k]; const land = m.userData.land; if (!land) continue;
      const v = lv(land);
      if (m.userData.bulb) { m.color.setScalar(v * (W.bulbGain || 3.2) * gain); m.visible = v > 0.001; }
      else m.emissiveIntensity = v * (m.userData.glow || 1) * gain;
    }
    for (const im of W.poolMeshes || []) { const v = lv(im.userData.land); im.material.opacity = v * (W.poolGain || 0.55) * gain; im.visible = v > 0.001; }
    for (const im of [...(W.staticBulbs || []), ...(W.movingBulbs || [])]) im.visible = lv(im.userData.land) > 0.001;
  };
  return W;
}

// THREE camera from park.camera(shot, t)
export function cameraFor(park, shot, t, W, H, cams) {
  const c = park.camera(shot, t);
  let cam;
  if (c.mode === 'ortho') {
    cam = cams.ortho; const hh = c.orthoHalfHeight; cam.left = -hh * W / H; cam.right = hh * W / H; cam.top = hh; cam.bottom = -hh;
    const tg = new THREE.Vector3(...c.target); const dir = tg.clone().sub(new THREE.Vector3(...c.position)).normalize();
    cam.position.copy(tg).addScaledVector(dir, -1500); cam.near = 10; cam.far = 9000; cam.up.set(...c.up); cam.lookAt(tg); cam.updateProjectionMatrix();
  } else {
    cam = cams.persp; cam.fov = c.fov; cam.aspect = W / H; cam.near = 0.3; cam.far = 6000; cam.position.set(...c.position); cam.up.set(...c.up); cam.lookAt(...c.target); cam.updateProjectionMatrix();
  }
  cam.updateMatrixWorld(true);
  return { cam, c };
}
