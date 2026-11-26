// globe_room.js: snow-globe set (wooden base, walnut table, room wall, ticket stack), snow particles, glass + DOF shaders
import * as THREE from 'three';
import { rng } from './geo.js';

function canvasTex(w, h, draw, repeat, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }

export async function buildRoomAsync(M, park, opts) { return buildRoom(M, park, opts); }
export function buildRoom(M, park, opts = {}) {
  // ---- table (y = -160). Polish: the SAME honey-walnut plank texture and plank layout as render_c's shot 01 table
  // (same canvas drawing + seed, same plane orientation), shifted by z +640 so the planks sit in the same place relative
  // to the ticket (01: ticket at z 8 on a table at y 0; 16: ticket at z 648 on a table at y -160). This keeps the loop seam.
  const walnut = canvasTex(2048, 2048, (g, w, h) => { const R = rng(3); g.fillStyle = '#5a3420'; g.fillRect(0, 0, w, h); const pw = 256;
    for (let p = 0; p < w / pw; p++) { const base = ['#5c3e2f', '#523629', '#614232', '#573a2c'][p % 4]; g.fillStyle = base; g.fillRect(p * pw, 0, pw - 3, h);
      for (let i = 0; i < 90; i++) { const x = p * pw + R() * pw; g.strokeStyle = `rgba(${R() < 0.5 ? '30,15,5' : '150,95,55'},${0.08 + R() * 0.14})`; g.lineWidth = 1 + R() * 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y / 180 + i) * 6 + Math.sin(y / 37 + i * 3) * 1.5, y); g.stroke(); }
      for (let k = 0; k < 2; k++) { const cx = p * pw + 40 + R() * (pw - 80), cy = R() * h; for (let r = 4; r < 40; r += 5) { g.strokeStyle = 'rgba(40,20,8,0.18)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy, r * 0.6, r * 1.8, 0, 0, 7); g.stroke(); } }
      g.fillStyle = 'rgba(20,10,5,0.55)'; g.fillRect(p * pw + pw - 3, 0, 3, h); }
  }, true);
  walnut.repeat.set(8, 8);
  const tableMat = new THREE.MeshStandardMaterial({ map: walnut, color: new THREE.Color(0.72, 0.6, 0.42), roughness: 0.42, metalness: 0, envMapIntensity: 0.5 });
  const table = new THREE.Group();
  // 9600 m plane with repeat 8 = render_c's 4800 m plane with repeat 4 (same texel scale, same phase)
  const top = new THREE.Mesh(new THREE.PlaneGeometry(9600, 9600), tableMat); top.rotation.x = -Math.PI / 2; top.rotation.z = Math.PI / 2; top.position.set(0, -160, 640); top.receiveShadow = true; table.add(top);
  // ---- ticket stack (closed paper ticket), print up, long side along x, image top -> north (-z)
  const tex = new THREE.TextureLoader().load('/film/plan/ticket_print.png'); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const side = canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#efe3c8'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? 'rgba(150,120,80,0.35)' : 'rgba(255,255,255,0.4)'; g.fillRect(0, y, w, 1); } }, true);
  const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.85 }); const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }); const botMat = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.9 });
  const ticket = new THREE.Mesh(new THREE.BoxGeometry(200, 6, 96), [sideMat, sideMat, topMat, botMat, sideMat, sideMat]);
  ticket.position.set(0, -157, 648); ticket.castShadow = true; ticket.receiveShadow = true; table.add(ticket);
  // ---- wooden base (lathe): y 0 (r 385) -> y -160 (r 440), brass rings, clear-coated
  const wood = canvasTex(1024, 256, (g, w, h) => { const r = rng(21); g.fillStyle = '#6b3a1f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { const y = r() * h; g.strokeStyle = `rgba(${r() < 0.5 ? '40,18,8' : '150,90,50'},${0.15 + r() * 0.25})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 4 + (r() - 0.5) * 2); g.stroke(); } }, true);
  wood.repeat.set(4, 1);
  const woodMat = new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15, color: 0xffffff });
  const prof = [[0, -158], [436, -158], [442, -154], [442, -146], [430, -138], [424, -112], [408, -70], [398, -38], [402, -30], [394, -22], [388, -10], [386, -1], [0, -1]].map(([x, y]) => new THREE.Vector2(x, y));
  const base = new THREE.Group();
  const bm = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), woodMat); bm.position.set(0, 0, -20); bm.castShadow = true; bm.receiveShadow = true; base.add(bm);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a64a, metalness: 0.95, roughness: 0.22 });
  for (const [r0, y] of [[398, -34], [441, -150], [387, -4]]) { const tor = new THREE.Mesh(new THREE.TorusGeometry(r0, 3.2, 12, 160), brass); tor.rotation.x = Math.PI / 2; tor.position.set(0, y, -20); base.add(tor); }
  // globe floor ring between the park disc (r 350) and the glass (r ~381): moss/felt that takes snow
  const floor = new THREE.Mesh(new THREE.RingGeometry(330, 392, 128, 1).rotateX(-Math.PI / 2), M.std({ color: 0x3f6a34, rough: 0.9, snowK: 1, key: 'globefloor' })); floor.position.set(0, -0.6, -20); floor.receiveShadow = true; base.add(floor);
  // ---- room wall with warm bokeh (out of focus anyway)
  const wallTex = canvasTex(2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#120f14'); gr.addColorStop(0.6, '#1d1612'); gr.addColorStop(1, '#2a1c12'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(11);
    const lg = g.createRadialGradient(w * 0.16, h * 0.42, 10, w * 0.16, h * 0.42, w * 0.28); lg.addColorStop(0, 'rgba(255,190,120,0.55)'); lg.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = lg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) { const x = r() * w, y = h * (0.12 + 0.55 * r()) + Math.sin(x * 0.005) * 70, rad = 14 + r() * 34; const c = r() < 0.8 ? [255, 180 + r() * 50, 100 + r() * 50] : [255, 120, 90];
      const bg = g.createRadialGradient(x, y, rad * 0.2, x, y, rad); bg.addColorStop(0, `rgba(${c[0]},${c[1] | 0},${c[2] | 0},${0.22 + r() * 0.2})`); bg.addColorStop(0.85, `rgba(${c[0]},${c[1] | 0},${c[2] | 0},${0.15 + r() * 0.12})`); bg.addColorStop(1, `rgba(${c[0]},${c[1] | 0},${c[2] | 0},0)`); g.fillStyle = bg; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9000, 4500), new THREE.MeshBasicMaterial({ map: wallTex, fog: false })); wall.position.set(0, 900, -2600);
  // ---- lamp key light (upper-left-back), direction to light [-0.5, 0.8, -0.35]
  const key = new THREE.DirectionalLight(0xffd9a0, 2.4); key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.5;
  table.add(key); table.add(key.target);
  const kd = new THREE.Vector3(-0.5, 0.8, -0.35).normalize();
  const fill = new THREE.DirectionalLight(0x8090c0, 0.25); fill.position.set(0.6, 0.4, 0.8); table.add(fill);
  const update = (t, cam) => {
    // shadow frustum: globe early, ticket at the end
    const u = Math.min(1, Math.max(0, (t - 42.9) / 1.1));
    const c = new THREE.Vector3(0, -100, -20).lerp(new THREE.Vector3(0, -157, 648), u);
    const ext = 520 + (160 - 520) * u;
    key.position.copy(c).addScaledVector(kd, 2400); key.target.position.copy(c); key.target.updateMatrixWorld();
    const sc = key.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 100; sc.far = 5000; sc.updateProjectionMatrix();
  };
  return { table, base, wall, key, ticket, update };
}

// ---------------------------------------------------------------- snow
export function buildSnow(GC, GR, W, H) {
  // polish: fewer, bigger flakes (they read as flakes at 1080p instead of grain), with a bright core and soft edge
  const NF = 1500; const fr = rng(42);
  const fl = []; const pos = new Float32Array(NF * 3), size = new Float32Array(NF), alpha = new Float32Array(NF);
  for (let i = 0; i < NF; i++) {
    const light = fr() < 0.4;
    fl.push({ th: fr() * 6.283, r0: Math.sqrt(fr()) * 330, yTop: 30 + Math.pow(fr(), 1.2) * (GC.y + GR * 0.8 - 30), vf: light ? 6 + fr() * 10 : 70 + fr() * 100, light, ts: 41.0 + fr() * 0.18, om: 6 + fr() * 9, ph: fr() * 6.28, wob: 0.3 + fr() * 0.8 });
    size[i] = light ? 5.0 + fr() * 4.0 : 6.5 + fr() * 6.0; alpha[i] = 0.6 + fr() * 0.4;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const U = { uScale: { value: H / (2 * Math.tan(THREE.MathUtils.degToRad(36) / 2)) }, uVis: { value: 0 } };
  const points = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale, uVis; varying float vA; varying float vR;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * uScale / -mv.z, 2.0, 48.0); vA = aAlpha * uVis; vR = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.283; }`,
    fragmentShader: `varying float vA; varying float vR; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float ang = atan(c.y, c.x) + vR;
      float star = 0.36 + 0.08 * cos(ang * 6.0);   // a faint six-fold edge so big flakes are not perfect discs
      float a = (smoothstep(star, star * 0.45, d) * 0.75 + smoothstep(0.22, 0.0, d) * 0.35) * vA; if (a < 0.01) discard;
      gl_FragColor = vec4(vec3(1.3, 1.32, 1.38) * (0.85 + 0.25 * smoothstep(0.3, 0.0, d)), min(a, 1.0)); }`,
  }));
  points.frustumCulled = false; points.renderOrder = 5;
  const update = (t) => {
    U.uVis.value = Math.min(1, Math.max(0, (t - 41.0) / 0.12));
    const top = GC.y + GR * 0.85;
    for (let i = 0; i < NF; i++) {
      const f = fl[i]; const u = Math.max(0, t - f.ts);
      const swirl = f.om * 0.5 * (1 - Math.exp(-u / 0.5));
      const th = f.th + swirl + u * 0.1;
      const rise = 1 - Math.exp(-u / 0.22);
      const fall = Math.max(0, u - 0.45); let y = 5 + (f.yTop - 5) * rise - f.vf * fall * fall / (fall + 0.6);
      if (y < 3) { if (f.light) y = top - ((3 - y) % (top - 3)); else y = -50; }
      let r = f.r0 * (0.6 + 0.4 * rise) + Math.sin(t * f.wob * 2 + f.ph) * 12 * rise;
      const dy = y - GC.y; const rmax = Math.sqrt(Math.max(0, GR * GR - dy * dy)) * 0.94; r = Math.min(r, rmax);
      pos[i * 3] = Math.cos(th) * r + GC.x; pos[i * 3 + 1] = u > 0 ? y : -50; pos[i * 3 + 2] = Math.sin(th) * r + GC.z;
    }
    g.attributes.position.needsUpdate = true;
  };
  return { points, update };
}

// ---------------------------------------------------------------- glass (analytic sphere, refraction + Fresnel + highlights + haze)
export const GlassShader = {
  uniforms: { tScene: { value: null }, tDepth: { value: null }, invProj: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, viewProj: { value: new THREE.Matrix4() },
    camPos: { value: new THREE.Vector3() }, center: { value: new THREE.Vector3() }, radius: { value: 400 }, near: { value: 0.3 }, far: { value: 6000 }, haze: { value: 0 }, glassK: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `precision highp float;
    uniform sampler2D tScene, tDepth; uniform mat4 invProj, camWorld, viewProj; uniform vec3 camPos, center; uniform float radius, near, far, haze, glassK; varying vec2 vUv;
    vec3 envCol(vec3 r){
      vec3 c = mix(vec3(0.05, 0.035, 0.03), vec3(0.09, 0.085, 0.1), smoothstep(-0.2, 0.6, r.y));
      // warm lamp softbox upper-left-back (the key), and a cool window far right
      vec3 ld = normalize(vec3(-0.5, 0.8, -0.35)); vec3 ax = normalize(cross(ld, vec3(0,1,0))), ay = cross(ax, ld);
      vec2 p = vec2(dot(r, ax), dot(r, ay)) / max(dot(r, ld), 0.001);
      float lamp = (1.0 - smoothstep(0.16, 0.3, length(p * vec2(1.0, 1.3)))) * step(0.0, dot(r, ld));
      c += vec3(2.4, 1.7, 1.0) * lamp;
      vec3 wd = normalize(vec3(0.8, 0.35, 0.5)); vec3 ax2 = normalize(cross(wd, vec3(0,1,0))), ay2 = cross(ax2, wd);
      vec2 q = vec2(dot(r, ax2), dot(r, ay2)) / max(dot(r, wd), 0.001);
      float win = (1.0 - smoothstep(0.2, 0.3, abs(q.x))) * (1.0 - smoothstep(0.28, 0.38, abs(q.y))) * step(0.0, dot(r, wd));
      float mull = clamp(1.0 - (1.0 - smoothstep(0.0, 0.02, abs(q.x))) - (1.0 - smoothstep(0.0, 0.02, abs(q.y))), 0.0, 1.0);
      c += vec3(0.35, 0.42, 0.6) * win * mull;
      return c;
    }
    float viewDist(vec2 uv, vec3 d, vec3 fwd){ float z = texture2D(tDepth, uv).x; float ndc = z * 2.0 - 1.0; float vz = 2.0 * near * far / (far + near - ndc * (far - near)); return vz / max(dot(d, fwd), 1e-3); }
    void main(){
      vec4 ndcF = vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vec4 vp = invProj * ndcF; vp /= vp.w;
      vec3 d = normalize((camWorld * vec4(vp.xyz, 0.0)).xyz);
      vec3 fwd = normalize((camWorld * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
      vec3 oc = camPos - center; float b = dot(oc, d); float c = dot(oc, oc) - radius * radius; float h = b * b - c;
      vec3 sceneC = texture2D(tScene, vUv).rgb;
      if (h < 0.0 || glassK < 0.001) { gl_FragColor = vec4(sceneC, 1.0); return; }
      float sh = sqrt(h); float t0 = -b - sh, t1 = -b + sh;
      if (t0 < 0.0) { gl_FragColor = vec4(sceneC, 1.0); return; }
      float ds = viewDist(vUv, d, fwd);
      if (ds < t0 - 0.5) { gl_FragColor = vec4(sceneC, 1.0); return; }
      vec3 P = camPos + d * t0; vec3 n = normalize(P - center);
      // the glass meets the base at y = 0 (local): below that we see the wooden collar, not glass
      float cosi = clamp(dot(-d, n), 0.0, 1.0);
      float inner = min(ds, t1) - t0;
      vec3 col = vec3(0.0);
      float iors[3]; iors[0] = 1.0/1.1175; iors[1] = 1.0/1.12; iors[2] = 1.0/1.1225; // polish: half the dispersion (flakes were rainbow-fringed)
      for (int k = 0; k < 3; k++) {
        vec3 r = refract(d, n, iors[k]); vec3 Q = P + r * inner;
        vec4 cl = viewProj * vec4(Q, 1.0); vec2 uv2 = clamp(cl.xy / cl.w * 0.5 + 0.5, 0.001, 0.999);
        uv2 = mix(vUv, uv2, glassK);
        vec3 s = texture2D(tScene, uv2).rgb; if (k == 0) col.r = s.r; else if (k == 1) col.g = s.g; else col.b = s.b;
      }
      float F = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
      vec3 refl = envCol(reflect(d, n));
      float edge = pow(1.0 - cosi, 3.0);
      col *= mix(vec3(1.0), mix(vec3(0.98, 0.99, 1.0), vec3(0.55, 0.65, 0.68), edge * 0.8), glassK);
      float lum = dot(col, vec3(0.3, 0.59, 0.11));
      col = mix(col, vec3(0.8, 0.84, 0.9) * (0.35 + 0.8 * lum) + vec3(0.06, 0.05, 0.04), haze * (0.55 + 0.45 * cosi));
      col = col * (1.0 - F * glassK) + refl * (F * 1.1 + 0.02) * glassK;
      vec4 cc = viewProj * vec4(center, 1.0); vec2 cs = cc.xy / cc.w * 0.5 + 0.5; vec2 dv = vUv - cs; float ang = atan(dv.y, dv.x);
      float rho = sqrt(max(0.0, 1.0 - cosi * cosi));
      float arc = smoothstep(0.76, 0.86, rho) * (1.0 - smoothstep(0.9, 0.95, rho)) * exp(-pow((ang - 2.3) / 0.42, 2.0));
      float arcB = smoothstep(0.86, 0.9, rho) * (1.0 - smoothstep(0.93, 0.965, rho)) * exp(-pow((ang + 0.8) / 0.5, 2.0));
      float spot = exp(-pow(length(dv - normalize(vec2(-0.55, 0.85)) * 0.0) , 2.0)) * 0.0;
      col += (vec3(1.0, 0.92, 0.8) * arc * 0.75 + vec3(1.0, 0.85, 0.65) * arcB * 0.3 + vec3(0.7, 0.72, 0.78) * smoothstep(0.986, 0.999, rho) * 0.55) * glassK;
      gl_FragColor = vec4(col, 1.0);
    }`,
  depthTest: false, depthWrite: false,
};

// ---------------------------------------------------------------- DOF (gather, CoC from depth)
export const DofShader = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2(1920, 1080) }, focus: { value: 1000 }, near: { value: 0.3 }, far: { value: 6000 }, amount: { value: 1 }, maxR: { value: 14 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: `uniform sampler2D tDiffuse, tDepth; uniform vec2 res; uniform float focus, near, far, amount, maxR; varying vec2 vUv;
    float lin(float z){ float ndc = z * 2.0 - 1.0; return 2.0 * near * far / (far + near - ndc * (far - near)); }
    float coc(vec2 uv){ float d = lin(texture2D(tDepth, uv).x); return clamp(abs(d - focus) / d * 3.2, 0.0, 1.0) * maxR * amount; }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      float r = coc(vUv); vec4 base = texture2D(tDiffuse, vUv);
      if (r < 0.7) { gl_FragColor = base; return; }
      vec3 acc = vec3(0.0); float ws = 0.0; float jit = hash(gl_FragCoord.xy) * 6.283;
      for (int i = 0; i < 28; i++) { float fi = float(i) + 0.5; float rr = sqrt(fi / 28.0) * r; float a = fi * 2.39996 + jit; vec2 o = vec2(cos(a), sin(a)) * rr / res;
        float rs = coc(vUv + o); float w = smoothstep(rr - 1.0, rr + 1.0, rs + 0.5) + 0.05; vec3 c = texture2D(tDiffuse, vUv + o).rgb; float l = dot(c, vec3(0.3,0.59,0.11)); w *= 1.0 + smoothstep(1.0, 3.0, l) * 3.0; acc += c * w; ws += w; }
      gl_FragColor = vec4(acc / ws, 1.0);
    }`,
};
