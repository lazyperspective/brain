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
        idx.push(a, a + 1, b, b, a + 1, b + 1);   // counter-clockwise seen from outside (front faces face out)
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
  const LIGHT = { key: new T3.Color(1, 1, 1), dirView: new T3.Vector3(0, 1, 0), rimDirView: new T3.Vector3(0, 1, 0), feet: Array.from({ length: 16 }, () => new T3.Vector4(0, -1e4, 0, 0)) };
  const TOON_PARS = `
varying vec3 vViewPosition;
struct ToonMaterial { vec3 diffuseColor; };
uniform vec3 uKeyCol;
uniform float uBandK;   // band crispness: 0 = the original soft bands, 1 = clean narrow transitions
float toonRamp(float v) {
  float a = mix(0.03, 0.015, uBandK), b = mix(0.03, 0.016, uBandK);
  return 0.58 * smoothstep(0.49 - a, 0.49 + a, v) + 0.42 * smoothstep(0.83 - b, 0.83 + b, v);
}
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
  // the materialisation: a clean fill front sweeping up through the block (bottom -> top, a slight tilt), no noise
  const FILL = `
float fillF(vec3 p, vec3 size){ vec3 q = clamp(p / size + 0.5, 0.0, 1.0); return q.y * 0.86 + 0.07 + 0.08 * (q.x - 0.5) + 0.05 * (q.z - 0.5); }
float fillLevel(float s){ return s * 1.14 - 0.07; }
`;
  // opts: color, emissive, emissiveI, rim (0..1), rimCol, dissolve (bool), trim {size:[w,h,d]}, flat (unlit amount),
  //   crisp (0..1: clean narrow light bands + a crisp rim line instead of the broad fresnel glow; the cast uses 1),
  //   shadeSat (chroma of the shadow side, 1 = as lit by the sky fill), shadeTint (multiplier on the shadow side),
  //   form (the staircase blocks: distinct top / riser / side values, bevel highlight, contact shading under feet)
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
      uFlat: { value: opts.flat || 0 },
      uBandK: { value: opts.crisp || 0 },
      uCrisp: { value: opts.crisp || 0 },
      uShadeSat: { value: opts.shadeSat == null ? 1 : opts.shadeSat },
      uShadeTint: { value: new T3.Color().setRGB(...(opts.shadeTint || [1, 1, 1])) },
      uFeet: { value: LIGHT.feet },
    };
    const dis = !!opts.dissolve, trim = !!opts.trim, form = !!opts.form;
    if (dis) m.side = T3.DoubleSide;      // the inside of a half-filled block shows as its glowing cross-section
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLPos; varying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLPos = transformed;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <lights_toon_pars_fragment>', TOON_PARS)
        .replace('#include <common>', `#include <common>
varying vec3 vLPos; varying vec3 vWPos;
uniform vec3 uRimDir; uniform float uRim; uniform vec3 uRimCol; uniform float uSolid; uniform vec3 uEdgeCol;
uniform float uGlow; uniform vec3 uGlowCol; uniform vec3 uSize; uniform float uFlat; uniform float uCrisp;
uniform float uShadeSat; uniform vec3 uShadeTint; uniform vec4 uFeet[16];
${FILL}`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  float dEdge = 0.0, dBelow = 0.0;
  ${dis ? `float fl = fillLevel(uSolid), ff = fillF(vLPos, uSize); if (ff > fl) discard;
  if (uSolid < 0.999) { dEdge = 1.0 - smoothstep(0.0, 0.035, fl - ff); dBelow = exp(-(fl - ff) * 9.0); }` : ''}`)
        .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', `
  vec3 indL = reflectedLight.indirectDiffuse;
  {
    vec3 nV = normalize(normal);
    vec3 vV = normalize(vViewPosition);
    float fr = 1.0 - clamp(dot(nV, vV), 0.0, 1.0);
    float facing = dot(nV, uRimDir);
    // rim: the original broad fresnel glow, or (crisp) a clean warm line on the edges that face the glow above plus a
    // faint sheen
    float soft = pow(1.0 - clamp(nV.z, 0.0, 1.0), 2.6) * smoothstep(-0.15, 0.6, facing) * 0.9;
    float crisp = smoothstep(0.6, 0.67, fr) * smoothstep(0.05, 0.45, facing) * 0.85 + pow(fr, 3.0) * smoothstep(-0.2, 0.6, facing) * 0.18;
    totalEmissiveRadiance += uRimCol * mix(soft, crisp, uCrisp) * uRim;
    // the shadow side keeps its colour: chroma of the sky fill pushed back up, then tinted
    float il = dot(indL, vec3(0.2126, 0.7152, 0.0722));
    indL = max(mix(vec3(il), indL, uShadeSat), 0.0) * uShadeTint;
    ${trim ? `
    vec3 hs = uSize * 0.5; vec3 q = abs(vLPos);
    float top = smoothstep(hs.y - 0.075, hs.y - 0.035, vLPos.y);
    float side = max(smoothstep(hs.x - 0.075, hs.x - 0.03, q.x), smoothstep(hs.z - 0.075, hs.z - 0.03, q.z));
    float strip = top * side;
    totalEmissiveRadiance += uGlowCol * strip * uGlow;` : ''}
    ${form ? `
    {
      vec3 nW = inverseTransformDirection(nV, viewMatrix);
      float upF = smoothstep(0.55, 0.92, nW.y);
      // tops a touch warmer and lifted (they face the glow), risers as lit, the shadow sides a little cooler
      reflectedLight.directDiffuse *= mix(vec3(1.0), vec3(1.06, 1.03, 0.97), upF);
      indL *= mix(vec3(0.9, 0.94, 1.1), vec3(1.04, 1.0, 0.97), upF);
      vec3 hs2 = uSize * 0.5; vec3 q2 = abs(vLPos);
      // risers and sides darken a little toward their lower edge (light falls off under the tread above)
      float vert = 1.0 - smoothstep(0.35, 0.7, abs(nW.y));
      float grad = mix(0.84, 1.0, smoothstep(-hs2.y, hs2.y * 0.6, vLPos.y));
      reflectedLight.directDiffuse *= mix(1.0, grad, vert);
      indL *= mix(1.0, grad, vert);
      // the rounded top edges catch the light: a thin highlight along the bevel
      float bev = smoothstep(hs2.y - 0.07, hs2.y - 0.03, vLPos.y) * max(smoothstep(hs2.x - 0.07, hs2.x - 0.02, q2.x), smoothstep(hs2.z - 0.07, hs2.z - 0.02, q2.z));
      float bevLit = bev * smoothstep(0.15, 0.6, nW.y) * (1.0 - smoothstep(0.85, 0.99, nW.y));
      totalEmissiveRadiance += vec3(1.0, 0.86, 0.66) * bevLit * 0.16 * (0.4 + 0.6 * smoothstep(-0.2, 0.5, dot(nW, normalize(vec3(-0.3, 1.0, -0.6)))));
      // soft contact shading where feet stand on a tread
      float ao = 0.0;
      for (int i = 0; i < 16; i++) {
        vec4 f = uFeet[i];
        if (f.w <= 0.0) continue;
        vec2 d = vWPos.xz - f.xz;
        float r = length(d * vec2(1.0, 1.0)) / f.w;
        ao = max(ao, (1.0 - smoothstep(0.25, 1.0, r)) * (1.0 - smoothstep(0.0, 0.12, abs(vWPos.y - f.y))));
      }
      ao *= upF;
      reflectedLight.directDiffuse *= 1.0 - 0.45 * ao;
      indL *= mix(vec3(1.0), vec3(0.62, 0.56, 0.74), ao);
    }` : ''}
    totalEmissiveRadiance += uEdgeCol * (dEdge * 3.0 + dBelow * 0.45);
  }
  vec3 outgoingLight = mix(reflectedLight.directDiffuse + indL, diffuseColor.rgb, uFlat) + totalEmissiveRadiance;
  ${dis ? `if (!gl_FrontFacing) outgoingLight = uEdgeCol * 1.7;` : ''}`);
    };
    m.customProgramCacheKey = () => 'toon2' + (dis ? 'D' : '') + (trim ? 'T' : '') + (form ? 'F' : '');
    return m;
  }

  // normal + id material for the outline/AO pass (shares the fill uniforms of `src` when given)
  function nidMaterial(src, opts = {}) {
    const id = NEXT_ID++;
    const su = src && src.userData.u;
    const dis = !!opts.dissolve;
    const m = new T3.ShaderMaterial({
      uniforms: { uId: { value: (id % 250) + 3 }, uSolid: su ? su.uSolid : { value: 1 }, uSize: su ? su.uSize : { value: new T3.Vector3(1, 1, 1) }, uLine: { value: opts.line == null ? 1 : opts.line } },
      vertexShader: `varying vec3 vN; varying vec3 vLPos;
void main(){ vLPos = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vN; varying vec3 vLPos; uniform float uId; uniform float uSolid; uniform vec3 uSize; uniform float uLine;
${FILL}
void main(){ ${dis ? 'if (fillF(vLPos, uSize) > fillLevel(uSolid)) discard;' : ''}
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  gl_FragColor = vec4(n.xy * 0.5 + 0.5, uLine, uId / 255.0); }`,
      side: opts.side || (dis ? T3.DoubleSide : T3.FrontSide),
    });
    return m;
  }

  // a depth material for shadows that fills in with its owner
  function dissolveDepth(src) {
    const m = new T3.MeshDepthMaterial({ depthPacking: T3.RGBADepthPacking });
    const u = src.userData.u;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSolid = u.uSolid; sh.uniforms.uSize = u.uSize;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLPos = transformed;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLPos; uniform float uSolid; uniform vec3 uSize;\n' + FILL)
        .replace('void main() {', 'void main() {\n if (fillF(vLPos, uSize) > fillLevel(uSolid)) discard;');
    };
    m.customProgramCacheKey = () => 'filldepth';
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

  S.G = { roundedBox, Tube, limbPoints, toon, nidMaterial, reg, LIGHT, FILL };
})();
