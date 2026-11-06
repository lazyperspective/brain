// THE STAIRCASE - geometry and material helpers: rounded boxes, live tubes (limbs, ropes), the toon material family
// (soft two-band cel ramp + banded shadows + rim light + optional dissolve / glow trim), and the matching
// normal+ID material used by the outline / AO pass.
(function () {
  const S = window.STAIR, U = S.U;
  const T3 = THREE;
  let NEXT_ID = 1;

  // ---- rounded box (w x h x d, corner radius r), centred on the origin
  function roundedBox(w, h, d, r) {
    const n = 8, g0 = 0.25;
    const geo = new T3.BoxGeometry(2, 2, 2, n, n, n);
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    const half = [w / 2, h / 2, d / 2];
    r = Math.min(r, half[0] * 0.95, half[1] * 0.95, half[2] * 0.95);
    const p = [0, 0, 0], inner = [0, 0, 0];
    for (let i = 0; i < pos.count; i++) {
      const g = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      for (let a = 0; a < 3; a++) {
        const ag = Math.abs(g[a]), sg = Math.sign(g[a]);
        let v;
        if (ag <= g0 + 1e-6) v = (ag / g0) * (half[a] - r);
        else { const th = (Math.PI / 4) * (ag - g0) / (1 - g0); v = half[a] - r + r * Math.tan(th); }
        p[a] = sg * v;
        inner[a] = U.clamp(p[a], -(half[a] - r), half[a] - r);
      }
      let nx = p[0] - inner[0], ny = p[1] - inner[1], nz = p[2] - inner[2];
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      pos.setXYZ(i, inner[0] + nx * r, inner[1] + ny * r, inner[2] + nz * r);
      nor.setXYZ(i, nx, ny, nz);
    }
    geo.computeBoundingSphere();
    return geo;
  }

  // ---- live tube: centre points + radius per ring, rotation-minimising frames; geometry rewritten in place
  class Tube {
    constructor(rings, radial, mat) {
      this.rings = rings; this.radial = radial;
      const nv = rings * (radial + 1);
      this.geo = new T3.BufferGeometry();
      this.pos = new Float32Array(nv * 3); this.nor = new Float32Array(nv * 3);
      const uv = new Float32Array(nv * 2), idx = [];
      for (let i = 0; i < rings; i++) for (let j = 0; j <= radial; j++) { uv[(i * (radial + 1) + j) * 2] = i / (rings - 1); uv[(i * (radial + 1) + j) * 2 + 1] = j / radial; }
      for (let i = 0; i < rings - 1; i++) for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      this.geo.setAttribute('position', new T3.BufferAttribute(this.pos, 3));
      this.geo.setAttribute('normal', new T3.BufferAttribute(this.nor, 3));
      this.geo.setAttribute('uv', new T3.BufferAttribute(uv, 2));
      this.geo.setIndex(idx);
      this.mesh = new T3.Mesh(this.geo, mat);
      this.mesh.frustumCulled = false;
      this.mesh.castShadow = true; this.mesh.receiveShadow = true;
      this.P = new Float32Array(rings * 3); this.R = new Float32Array(rings); this.SH = new Float32Array(rings * 3);
    }
    // pts: flat array of ring centres (rings*3), rad: radii; shift (optional): per-ring xyz offsets (fold)
    update(pts, rad, shift) {
      const n = this.rings, m = this.radial, P = pts, pos = this.pos, nor = this.nor;
      let nx = 0, ny = 1, nz = 0;
      for (let i = 0; i < n; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
        let tx = P[i1 * 3] - P[i0 * 3], ty = P[i1 * 3 + 1] - P[i0 * 3 + 1], tz = P[i1 * 3 + 2] - P[i0 * 3 + 2];
        let tl = Math.hypot(tx, ty, tz); if (tl < 1e-9) { tx = 1; ty = 0; tz = 0; tl = 1; }
        tx /= tl; ty /= tl; tz /= tl;
        if (i === 0) { // initial normal: anything perpendicular
          if (Math.abs(ty) < 0.9) { nx = 0; ny = 1; nz = 0; } else { nx = 1; ny = 0; nz = 0; }
        }
        // project previous normal onto the plane perpendicular to t
        const d = nx * tx + ny * ty + nz * tz; nx -= d * tx; ny -= d * ty; nz -= d * tz;
        let nl = Math.hypot(nx, ny, nz); if (nl < 1e-6) { nx = -ty; ny = tx; nz = 0; nl = Math.hypot(nx, ny, nz) || 1; }
        nx /= nl; ny /= nl; nz /= nl;
        const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
        const r = rad[i];
        const ox = shift ? shift[i * 3] : 0, oy = shift ? shift[i * 3 + 1] : 0, oz = shift ? shift[i * 3 + 2] : 0;
        for (let j = 0; j <= m; j++) {
          const a = (j / m) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
          const vx = nx * c + bx * s, vy = ny * c + by * s, vz = nz * c + bz * s;
          const k = (i * (m + 1) + j) * 3;
          pos[k] = P[i * 3] + vx * r + ox; pos[k + 1] = P[i * 3 + 1] + vy * r + oy; pos[k + 2] = P[i * 3 + 2] + vz * r + oz;
          nor[k] = vx; nor[k + 1] = vy; nor[k + 2] = vz;
        }
      }
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true;
    }
  }

  // quadratic bezier limb: shoulder a, hand b, chord-length-driven bend along `bend` (unit vector), limb length len
  function limbPoints(out, rings, a, b, bend, len, taper0, taper1, rad) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, dl = Math.hypot(dx, dy, dz);
    const k = Math.sqrt(Math.max(0, len * len - dl * dl)) * 0.62;   // how much the elbow/knee pushes out
    const cx = (a.x + b.x) / 2 + bend.x * k, cy = (a.y + b.y) / 2 + bend.y * k, cz = (a.z + b.z) / 2 + bend.z * k;
    for (let i = 0; i < rings; i++) {
      const u = i / (rings - 1), w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u;
      out[i * 3] = w0 * a.x + w1 * cx + w2 * b.x; out[i * 3 + 1] = w0 * a.y + w1 * cy + w2 * b.y; out[i * 3 + 2] = w0 * a.z + w1 * cz + w2 * b.z;
      rad[i] = U.lerp(taper0, taper1, u) * (1 + 0.08 * Math.sin(Math.PI * u));
    }
  }

  // ---- toon materials
  const LIGHT = { key: new T3.Color(1, 1, 1), dirView: new T3.Vector3(0, 1, 0), rimDirView: new T3.Vector3(0, 1, 0) };
  const TOON_PARS = `
varying vec3 vViewPosition;
struct ToonMaterial { vec3 diffuseColor; };
uniform vec3 uKeyCol;
float toonRamp(float v) { return 0.58 * smoothstep(0.46, 0.52, v) + 0.42 * smoothstep(0.80, 0.86, v); }
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  float v = dot(geometryNormal, directLight.direction) * 0.5 + 0.5;
  float sh = clamp(directLight.color.r / max(uKeyCol.r, 1e-4), 0.0, 1.0);
  float lit = toonRamp(min(v, mix(0.3, 1.0, smoothstep(0.25, 0.75, sh))));
  reflectedLight.directDiffuse += lit * uKeyCol * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;
  const NOISE = `
float hsh(vec3 p){ p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hsh(i+vec3(0,0,0)),hsh(i+vec3(1,0,0)),f.x),mix(hsh(i+vec3(0,1,0)),hsh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hsh(i+vec3(0,0,1)),hsh(i+vec3(1,0,1)),f.x),mix(hsh(i+vec3(0,1,1)),hsh(i+vec3(1,1,1)),f.x),f.y),f.z); }
float dnoise(vec3 p){ return 0.62*vnoise(p*6.0) + 0.38*vnoise(p*13.0+3.1); }
`;

  // opts: color, emissive, emissiveI, rim (0..1), rimCol, dissolve (bool), trim {size:[w,h,d]}, flat (unlit amount)
  function toon(opts) {
    const m = new T3.MeshToonMaterial({ color: new T3.Color(opts.color || '#ffffff') });
    if (opts.emissive) { m.emissive = new T3.Color(opts.emissive); m.emissiveIntensity = opts.emissiveI == null ? 1 : opts.emissiveI; }
    const u = m.userData.u = {
      uKeyCol: { value: LIGHT.key },
      uRimDir: { value: LIGHT.rimDirView },
      uRim: { value: opts.rim == null ? 0.55 : opts.rim },
      uRimCol: { value: new T3.Color(opts.rimCol || '#ffe2b8') },
      uSolid: { value: 1 },
      uEdgeCol: { value: new T3.Color(opts.edgeCol || '#9ff3ff') },
      uGlow: { value: 0 },
      uGlowCol: { value: new T3.Color(opts.glowCol || '#ffd27a') },
      uSize: { value: new T3.Vector3().fromArray(opts.trim ? opts.trim.size : [1, 1, 1]) },
      uSeed: { value: opts.seed || 0 },
      uFlat: { value: opts.flat || 0 },
    };
    const dis = !!opts.dissolve, trim = !!opts.trim;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLPos = transformed;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <lights_toon_pars_fragment>', TOON_PARS)
        .replace('#include <common>', `#include <common>
varying vec3 vLPos;
uniform vec3 uRimDir; uniform float uRim; uniform vec3 uRimCol; uniform float uSolid; uniform vec3 uEdgeCol;
uniform float uGlow; uniform vec3 uGlowCol; uniform vec3 uSize; uniform float uSeed; uniform float uFlat;
${NOISE}`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  float dEdge = 0.0;
  ${dis ? `float dn = dnoise(vLPos + uSeed); if (dn > uSolid * 1.08) discard; dEdge = (uSolid < 0.999) ? (1.0 - smoothstep(0.0, 0.07, uSolid * 1.08 - dn)) : 0.0;` : ''}`)
        .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', `
  {
    vec3 nV = normalize(normal);
    float fres = pow(1.0 - clamp(nV.z, 0.0, 1.0), 2.6);
    float rimMask = smoothstep(-0.15, 0.6, dot(nV, uRimDir));
    totalEmissiveRadiance += uRimCol * fres * rimMask * uRim * 0.9;
    ${trim ? `
    vec3 hs = uSize * 0.5; vec3 q = abs(vLPos);
    float top = smoothstep(hs.y - 0.075, hs.y - 0.035, vLPos.y);
    float side = max(smoothstep(hs.x - 0.075, hs.x - 0.03, q.x), smoothstep(hs.z - 0.075, hs.z - 0.03, q.z));
    float strip = top * side;
    totalEmissiveRadiance += uGlowCol * strip * uGlow;` : ''}
    totalEmissiveRadiance += uEdgeCol * dEdge * 3.0;
  }
  vec3 outgoingLight = mix(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, diffuseColor.rgb, uFlat) + totalEmissiveRadiance;`);
    };
    m.customProgramCacheKey = () => 'toon' + (dis ? 'D' : '') + (trim ? 'T' : '');
    return m;
  }

  // normal + id material for the outline/AO pass (shares the dissolve uniforms of `src` when given)
  function nidMaterial(src, opts = {}) {
    const id = NEXT_ID++;
    const su = src && src.userData.u;
    const dis = !!opts.dissolve;
    const m = new T3.ShaderMaterial({
      uniforms: { uId: { value: (id % 250) + 3 }, uSolid: su ? su.uSolid : { value: 1 }, uSeed: su ? su.uSeed : { value: 0 }, uLine: { value: opts.line == null ? 1 : opts.line } },
      vertexShader: `varying vec3 vN; varying vec3 vLPos;
void main(){ vLPos = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vN; varying vec3 vLPos; uniform float uId; uniform float uSolid; uniform float uSeed; uniform float uLine;
${NOISE}
void main(){ ${dis ? 'if (dnoise(vLPos + uSeed) > uSolid * 1.08) discard;' : ''}
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  gl_FragColor = vec4(n.xy * 0.5 + 0.5, uLine, uId / 255.0); }`,
      side: opts.side || T3.FrontSide,
    });
    return m;
  }

  // a depth material for shadows that dissolves with its owner
  function dissolveDepth(src) {
    const m = new T3.MeshDepthMaterial({ depthPacking: T3.RGBADepthPacking });
    const u = src.userData.u;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSolid = u.uSolid; sh.uniforms.uSeed = u.uSeed;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLPos = transformed;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLPos; uniform float uSolid; uniform float uSeed;\n' + NOISE)
        .replace('void main() {', 'void main() {\n if (dnoise(vLPos + uSeed) > uSolid * 1.08) discard;');
    };
    m.customProgramCacheKey = () => 'disdepth';
    return m;
  }

  // register a mesh for both passes. kind: 'solid' (default) | 'nooutline'
  function reg(mesh, opts = {}) {
    mesh.userData.mat = mesh.material;
    mesh.userData.nid = opts.nid || nidMaterial(mesh.material, opts);
    mesh.castShadow = opts.cast !== false; mesh.receiveShadow = opts.receive !== false;
    if (opts.dissolve) mesh.customDepthMaterial = dissolveDepth(mesh.material);
    return mesh;
  }

  S.G = { roundedBox, Tube, limbPoints, toon, nidMaterial, reg, LIGHT, NOISE };
})();
