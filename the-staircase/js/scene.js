// THE STAIRCASE - renderer, camera, lights, and the staircase meshes (solid blocks, blueprint ghosts, build glow).
(function () {
  const S = window.STAIR, U = S.U, G = S.G, ST = S.stairs, T3 = THREE;

  const PAL = S.PAL = {
    stone: '#f2dfbf', stoneSide: '#e9cfa6', ink: '#1c1433',
    coral: '#ff7b63', coralDark: '#d9503f', coralBelly: '#ffd9c2', coralGlow: '#ffe7a3', screen: '#2a2140',
    char: '#3b3f4d', charDark: '#2a2d38', mint: '#62f2c6', mintDeep: '#2fc79e',
    ghost: '#8fe9ff', rope: '#f2c27a', gold: '#ffd36e',
  };

  function setup(canvas, W, H, SS) {
    const renderer = new T3.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T3.PCFSoftShadowMap;
    renderer.outputColorSpace = T3.LinearSRGBColorSpace;   // the final pass converts to sRGB itself
    renderer.toneMapping = T3.NoToneMapping;
    const scene = new T3.Scene();

    // ---- camera: orthographic, looking exactly along the lap displacement (that is the illusion)
    const V = new T3.Vector3(ST.VIEW.x, ST.VIEW.y, ST.VIEW.z);
    const camera = new T3.OrthographicCamera(-1, 1, 1, -1, 1, 280);
    const target = new T3.Vector3(0, 0, 0);
    const dist = 70;
    camera.position.copy(target).addScaledVector(V, dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.userData.dist = dist;
    camera.updateMatrixWorld();
    // frame the ring: project every step corner into camera space
    const inv = camera.matrixWorldInverse;
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    const p = new T3.Vector3();
    for (const st of ST.steps) for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const dy of [0, -ST.T]) {
      p.set(st.cx + sx * st.sx / 2, st.y + dy, st.cz + sz * st.sz / 2).applyMatrix4(inv);
      mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mny = Math.min(mny, p.y); mxy = Math.max(mxy, p.y);
    }
    const ringW = mxx - mnx;
    const fw = ringW / 0.94;                 // the ring spans ~80% of the frame width
    const fh = fw * H / W;
    const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
    const yOff = -fh * 0.035;                // ring sits a touch below centre: the glow gets the top
    camera.left = cx - fw / 2; camera.right = cx + fw / 2; camera.top = cy + fh / 2 - yOff; camera.bottom = cy - fh / 2 - yOff;
    camera.updateProjectionMatrix();
    camera.userData.ring = { mnx, mxx, mny, mxy, fw, fh };

    // ---- lights
    const keyDir = new T3.Vector3(-0.36, 1.0, 0.62).normalize();
    const key = new T3.DirectionalLight(new T3.Color('#fff0d8'), 2.5);
    key.position.copy(keyDir).multiplyScalar(40);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    const sc = key.shadow.camera; sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 10; sc.far = 80;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
    scene.add(key, key.target);
    const hemi = new T3.HemisphereLight(new T3.Color('#9d8fe0'), new T3.Color('#6a4566'), 1.05);
    scene.add(hemi);
    // light directions in view space for the toon rim
    G.LIGHT.key.copy(key.color).multiplyScalar(key.intensity);
    const rimV = new T3.Vector3(0.15, 1, -0.2).normalize().transformDirection(camera.matrixWorldInverse);
    G.LIGHT.rimDirView.copy(rimV);
    return { renderer, scene, camera, key, hemi, V };
  }

  // ---- the staircase meshes
  function buildStairs(scene) {
    const group = new T3.Group(); scene.add(group);
    const blocks = [];
    const ghostMatBase = (size) => new T3.ShaderMaterial({
      transparent: true, depthWrite: false, side: T3.DoubleSide,
      uniforms: { uSize: { value: new T3.Vector3().fromArray(size) }, uA: { value: 1 }, uCol: { value: new T3.Color(PAL.ghost) }, uT: { value: 0 } },
      vertexShader: `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vL; uniform vec3 uSize; uniform float uA; uniform vec3 uCol; uniform float uT;
void main(){ vec3 hs = uSize * 0.5; vec3 q = abs(vL); vec3 e = smoothstep(hs - 0.07, hs - 0.025, q);
  float edge = max(max(e.x * e.y, e.y * e.z), e.x * e.z);
  vec3 g = abs(fract(vL * 4.0) - 0.5); float grid = (1.0 - smoothstep(0.0, 0.06, min(g.x, min(g.y, g.z)))) * 0.35;
  float scan = 0.5 + 0.5 * sin(vL.y * 30.0 - uT * 6.2831853 * 0.5);
  float a = (0.10 + grid * 0.5 + edge * 0.9) * uA;
  gl_FragColor = vec4(pow(uCol, vec3(2.2)) * (0.5 + edge * 2.2 + grid * 0.6) * (0.85 + 0.15 * scan), a); }`,
    });
    for (const st of ST.steps) {
      const size = [st.sx, ST.T, st.sz];
      const geo = G.roundedBox(size[0], size[1], size[2], 0.07);
      const mat = G.toon({ color: PAL.stone, rim: 0.45, dissolve: true, trim: { size }, seed: st.j * 3.17, glowCol: PAL.gold });
      const mesh = new T3.Mesh(geo, mat);
      mesh.position.set(st.cx, st.y - ST.T / 2, st.cz);
      G.reg(mesh, { dissolve: true });
      group.add(mesh);
      const ghost = new T3.Mesh(geo, ghostMatBase(size));
      ghost.position.copy(mesh.position);
      ghost.renderOrder = 5; ghost.visible = false;
      group.add(ghost);
      blocks.push({ st, mesh, mat, ghost, home: mesh.position.clone() });
    }
    return { group, blocks };
  }

  S.scene = { setup, buildStairs };
})();
