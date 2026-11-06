// THE STAIRCASE v2 - renderer, the climbing camera, lights, and the staircase blocks (a pool of meshes re-used as the
// build front moves up: each block can materialise (wireframe + dissolve-in), slam into place, stand, crack and fall
// apart into four pieces).
(function () {
  const S = window.STAIR, U = S.U, G = S.G, ST = S.stairs, T3 = THREE;

  const PAL = S.PAL = {
    stone: '#f2dfbf', stoneSide: '#e9cfa6', ink: '#1c1433',
    coral: '#ff7b63', coralDark: '#d9503f', coralBelly: '#ffd9c2', coralGlow: '#ffe7a3', screen: '#2a2140',
    ghost: '#8fe9ff', build: '#ffd27a', rope: '#f2c27a', gold: '#ffd36e',
  };
  const KEY_DIR = new T3.Vector3(-0.45, 1.0, 0.55).normalize();

  function setup(canvas, W, H) {
    const renderer = new T3.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T3.PCFSoftShadowMap;
    renderer.outputColorSpace = T3.LinearSRGBColorSpace;   // the final pass converts to sRGB itself
    renderer.toneMapping = T3.NoToneMapping;
    const scene = new T3.Scene();

    // ---- camera: perspective, low and looking up at the climb; placed every frame by S.choreo.camera(t)
    const camera = new T3.PerspectiveCamera(36, W / H, 0.5, 400);
    camera.userData.dist = S.choreo.CAMP.dist;

    // ---- lights (the key light and its shadow box travel with the camera's target)
    const key = new T3.DirectionalLight(new T3.Color('#fff0d8'), 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    const sc = key.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 5; sc.far = 70;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
    scene.add(key, key.target);
    const hemi = new T3.HemisphereLight(new T3.Color('#9d8fe0'), new T3.Color('#6a4566'), 1.05);
    scene.add(hemi);
    G.LIGHT.key.copy(key.color).multiplyScalar(key.intensity);
    const env = { renderer, scene, camera, key, hemi };
    place(env, 0);
    return env;
  }
  // put the camera and the key light where the choreography says, for time t (unwrapped t is fine)
  function place(env, t) {
    const { camera, key } = env;
    const c = S.choreo.camera(t);
    // a small bump when a block slams into place (deterministic; zero again long before the next one)
    let shake = 0;
    const CH = S.choreo, B = CH.builtIdx(t);
    for (const J of [B, B - 1]) { const a = t - CH.landTime(J); if (a >= 0 && a < 0.6) shake += (CH.isJit(J) ? 0.05 : 0.03) * Math.exp(-a * 10) * Math.sin(a * 55); }
    camera.position.set(c.pos.x, c.pos.y + shake, c.pos.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(c.look.x, c.look.y + shake * 0.6, c.look.z);
    if (camera.fov !== c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    const tg = new T3.Vector3(c.look.x, c.look.y - 0.4, c.look.z - 0.5);
    key.target.position.copy(tg); key.position.copy(tg).addScaledVector(KEY_DIR, 30);
    key.target.updateMatrixWorld(); key.updateMatrixWorld();
    const rimV = new T3.Vector3(0.15, 1, -0.2).normalize().transformDirection(camera.matrixWorldInverse);
    G.LIGHT.rimDirView.copy(rimV);
    env.camInfo = c;
  }

  // ---- the staircase block pool: slot p holds blocks J with J = p (mod POOL); POOL = 2 modules
  const POOL = 2 * ST.N;
  function buildStairs(scene) {
    const group = new T3.Group(); scene.add(group);
    const ghostMat = (size) => new T3.ShaderMaterial({
      transparent: true, depthWrite: false, side: T3.DoubleSide, blending: T3.AdditiveBlending,
      uniforms: { uSize: { value: new T3.Vector3().fromArray(size) }, uA: { value: 1 }, uCol: { value: new T3.Color(PAL.build) }, uT: { value: 0 }, uSolid: { value: 0 } },
      vertexShader: `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      // the wireframe the block fills into: crisp edges all round, the grid and haze only above the rising fill front
      fragmentShader: `varying vec3 vL; uniform vec3 uSize; uniform float uA; uniform vec3 uCol; uniform float uT; uniform float uSolid;
${G.FILL}
void main(){ vec3 hs = uSize * 0.5; vec3 q = abs(vL); vec3 e = smoothstep(hs - 0.05, hs - 0.02, q);
  float edge = max(max(e.x * e.y, e.y * e.z), e.x * e.z);
  vec3 g = abs(fract(vL * 5.0 + 0.5) - 0.5); float grid = (1.0 - smoothstep(0.0, 0.035, min(g.x, min(g.y, g.z)))) * 0.5;
  float above = smoothstep(-0.01, 0.05, fillF(vL, uSize) - fillLevel(uSolid));
  float a = (0.05 * above + grid * 0.35 * above + edge * (0.55 + 0.45 * above)) * uA;
  gl_FragColor = vec4(pow(uCol, vec3(2.2)) * (0.6 + edge * 2.6 + grid * 0.8) * a, 1.0); }`,
    });
    const slots = [];
    for (let p = 0; p < POOL; p++) {
      const st = ST.steps[p % ST.N];
      const size = [st.sx - 0.03, ST.T, st.sz - 0.03];
      const geo = G.roundedBox(size[0], size[1], size[2], 0.07);
      const mat = G.toon({ color: PAL.stone, rim: 0.45, dissolve: true, trim: { size }, form: true, glowCol: PAL.gold, edgeCol: '#ffe9b0' });
      const mesh = new T3.Mesh(geo, mat);
      G.reg(mesh, { dissolve: true });
      group.add(mesh);
      const ghost = new T3.Mesh(G.roundedBox(size[0] + 0.02, size[1] + 0.02, size[2] + 0.02, 0.07), ghostMat(size));
      ghost.renderOrder = 5; ghost.visible = false;
      group.add(ghost);
      // crumble pieces: the block split 2 x 2 in plan
      const pieces = [];
      const pm = G.toon({ color: PAL.stone, rim: 0.45, form: true });
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const pg = G.roundedBox(size[0] / 2 - 0.025, size[1] * (0.86 + 0.12 * ((a + b) % 2)), size[2] / 2 - 0.025, 0.06);
        const m = new T3.Mesh(pg, pm); m.rotation.order = 'YXZ'; G.reg(m); m.visible = false; group.add(m);
        pieces.push({ m, lx: (a - 0.5) * size[0] / 2, lz: (b - 0.5) * size[2] / 2, ly: -size[1] / 2 });
      }
      slots.push({ p, st, mesh, mat, ghost, pieces, size });
    }
    return { group, slots, POOL };
  }

  S.scene = { setup, place, buildStairs, POOL };
})();
