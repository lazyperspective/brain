// style_lowpoly.js: low-poly tycoon (shots 04 blueprint wave, 08 POV lift, 13 POV loop)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { makeFactory, U, depthMat } from './mat.js';
import { buildScene, cameraFor } from './scene.js';
import { skyDome, horizon, GradeShader, tiltPass } from './common.js';
import { buildBlueprint } from './blueprint.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export async function setup({ park, shot, W, H, qs }) {
  const BP = shot.id.startsWith('04');
  const POV = shot.camera.mode === 'pov';
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H); document.body.appendChild(renderer.domElement);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const M = makeFactory('lowpoly', { bp: BP });
  const scene = new THREE.Scene();
  const detailBox = BP ? { x0: -160, x1: 320, z0: -280, z1: 140 } : null;
  const Wd = buildScene(park, M, { personLOD: BP ? 'lo' : 'hi', detailBox, treeSub: 0 });
  scene.add(Wd.root);
  const sky = skyDome(); scene.add(sky.mesh);
  const hz = horizon(M); scene.add(hz);
  const fog = new THREE.Fog(0xcfe2f7, 450, 3200); scene.fog = fog;
  const L = park.data.lighting; const d = L.sun_day.direction_to_sun; const sunDir = new THREE.Vector3(...d).normalize();
  sky.U.sunDir.value.copy(sunDir); sky.U.top.value.set('#5f97da'); sky.U.hor.value.set('#d4e6fb'); sky.U.sunK.value = 0.6;
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x9dbf7a, 1.05); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.1); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05; scene.add(sun); scene.add(sun.target);
  Wd.setLights({ all: 0 });
  // blueprint depth material on everything (unbuilt objects cast no shadow)
  let bp = null;
  if (BP) {
    const dm = depthMat(true), dmNZ = depthMat(true, true); Wd.root.traverse(o => { if (o.isMesh) o.customDepthMaterial = (o.material && o.material.userData && o.material.userData.patch && o.material.userData.patch.noZone) ? dmNZ : dm; });
    // shot 05 match: the midway lot is a bare dirt pad with the toy-box crate (06 set: 70 x 46 x 30 at (120,0,62))
    {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(150, 92).rotateX(-Math.PI / 2), M.std({ color: 0x8b6a43, kind: 'ground', key: 'dirtpad', polygonOffset: -2, fragExtra: f => f.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 0.86 + 0.24 * mn(vWP.xz * 0.35) + 0.08 * mh(floor(vWP.xz * 3.0));') }));
      pad.position.set(121, 0.09, 66); pad.receiveShadow = true; Wd.root.add(pad);
      // clear trees/planting off the lot (05 shows bare dirt there)
      const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
      Wd.root.traverse(o => { if (o.isInstancedMesh && (o.userData.matKey === 'leaf' || o.userData.matKey === 'bark')) { let ch = false; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); const x = m4.elements[12], z = m4.elements[14]; if (x > 46 && x < 196 && z > 20 && z < 112) { o.setMatrixAt(i, zero); ch = true; } } if (ch) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere(); } } });
      const cm = (c) => M.std({ color: c, noZone: true, key: 'crate' + c });
      const crate = new THREE.Group(); crate.position.set(120, 0, 62); crate.visible = false; // 05 shows the crate only later: not in our frames
      const add = (geo, c, x, y, z) => { const m = new THREE.Mesh(geo, cm(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; crate.add(m); return m; };
      add(new THREE.BoxGeometry(70, 30, 46), 0x9a6a3c, 0, 15, 0);
      for (let i = 0; i < 7; i++) { add(new THREE.BoxGeometry(70.4, 0.5, 46.4), 0x6e4626, 0, 2 + i * 4.3, 0); }
      for (const x of [-35, 35]) for (const z of [-23, 23]) add(new THREE.BoxGeometry(2.6, 30.6, 2.6), 0x4a4f57, x, 15, z);
      for (const y of [0.4, 29.8]) for (const z of [-23, 23]) add(new THREE.BoxGeometry(72, 1.2, 1.2), 0x4a4f57, 0, y, z);
      for (const y of [0.4, 29.8]) for (const x of [-35, 35]) add(new THREE.BoxGeometry(1.2, 1.2, 48), 0x4a4f57, x, y, 0);
      add(new THREE.BoxGeometry(72, 0.8, 1.6), 0xc0392b, 0, 30.2, 23.4); add(new THREE.BoxGeometry(1.6, 0.8, 48), 0xc0392b, 36, 30.2, 0);
      const star = (r) => { const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.42 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (k) sh.lineTo(x, y); else sh.moveTo(x, y); } return new THREE.ShapeGeometry(sh); };
      { const m = add(star(7), 0xf1c40f, 0, 30.3, 0); m.rotation.x = -Math.PI / 2; }
      { const m = add(star(6), 0xd7263d, -14, 16, 23.2); }
      { const m = add(star(6), 0x2e86c1, 35.2, 16, 4); m.rotation.y = Math.PI / 2; }
      add(new THREE.BoxGeometry(3, 4, 0.6), 0x4a4f57, 0, 22, 23.4);
      crate.traverse(o => { if (o.isMesh) o.customDepthMaterial = depthMat(true, true); });
    }
    U.uZoneA.value.set(180, -205, 300, 150);      // frontier + wooden coaster: built in shot 05 (pixel build mode)
    U.uZoneB.value.set(44, 18, 180, 150);         // midway lot: unbuilt (toy box in 06)
    bp = buildBlueprint(park, Wd, { box: detailBox });
    scene.add(bp.group);
  }
  const cams = { persp: new THREE.PerspectiveCamera(40, W / H, 0.3, 6000), ortho: new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000) };
  // composer
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
  const rp = new RenderPass(scene, cams.persp); composer.addPass(rp);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.35, 0.5, 0.92); if (BP) composer.addPass(bloom);
  const tilt = tiltPass(W, H); tilt.uniforms.maxR.value = BP ? 5 : 0; tilt.uniforms.band.value = 0.2; tilt.uniforms.focusY.value = 0.5; tilt.uniforms.bokeh.value = 0; if (BP) composer.addPass(tilt);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader); grade.uniforms.uSat.value = 1.12; grade.uniforms.uVig.value = POV ? 0.35 : 0.28; grade.uniforms.uWarm.value = 0.6; grade.uniforms.uContrast.value = 0.18; composer.addPass(grade);

  const frontAt = (t) => { // blueprint wave front (s = (x - z)/sqrt2), enters at (-50,-50) at 12.5, NE corner of Skyline Thrills at 14.5
    if (t < 12.22) return -1e4;
    if (t < 12.5) return -260 + (t - 12.22) / 0.28 * 260;
    if (t < 14.5) return (t - 12.5) * 128;
    return 256 + (t - 14.5) * 220;
  };
  function renderAt(t, i) {
    let { cam, c } = cameraFor(park, shot, t, W, H, cams);
    if (qs.get('dbg')) { const v = qs.get('dbg').split(',').map(Number); const cc = park.camera(shot, t); cam = cams.persp; cam.fov = v[3] || 50; cam.position.set(cc.position[0] + v[0], cc.position[1] + v[1], cc.position[2] + v[2]); cam.up.set(0, 1, 0); cam.lookAt(...cc.position); cam.updateProjectionMatrix(); cam.updateMatrixWorld(); }
    rp.camera = cam; scene.fog = c.mode === 'ortho' ? null : fog;
    Wd.update(t, shot);
    // shadow frustum follows the view
    const focus = c.mode === 'ortho' ? new THREE.Vector3(...c.target) : new THREE.Vector3(...c.position).add(new THREE.Vector3(...c.target).sub(new THREE.Vector3(...c.position)).normalize().multiplyScalar(90));
    focus.y = 0;
    const ext = c.mode === 'ortho' ? c.orthoHalfHeight * W / H * 1.25 : 330;
    const sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 10; sc.far = 2500; sc.updateProjectionMatrix();
    sun.position.copy(focus).addScaledVector(sunDir, 900); sun.target.position.copy(focus); sun.target.updateMatrixWorld();
    if (BP) {
      const f = frontAt(t); U.uFront.value = f; U.uBand.value = 26;
      bp.update(t, f); tilt.uniforms.maxR.value = 5 * (1 - smooth(15.0, 15.9, t)); tilt.enabled = tilt.uniforms.maxR.value > 0.3;
      bloom.strength = 0.25 + 0.5 * (1 - smooth(14.6, 15.4, t)); bloom.threshold = 0.85;
      // ground scan
    }
    grade.uniforms.uSeed.value = i * 1.37;
    composer.render();
  }
  return { renderAt, canvas: renderer.domElement, info: { buildMs: Wd.buildMs } };
}
