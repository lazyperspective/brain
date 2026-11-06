// THE STAIRCASE v2 - the cast, built from rounded primitives with toon shading: Claude (the coral round climber with
// the glowing face-screen and a "Claude" name plate on chest and back), its builder helper (a smaller Claude in a hard
// hat with a small "Claude" tag on the hat), and three humans (a researcher in an open lab coat, an evaluator with a
// clipboard and lanyard, a person in a suit). Rubber-hose limbs are live tubes from shoulder/hip to hand/foot targets,
// so a pose is just: pelvis frame, spine, head, hands, feet.
(function () {
  const S = window.STAIR, U = S.U, G = S.G, T3 = THREE, PAL = S.PAL;
  const V3 = (x = 0, y = 0, z = 0) => new T3.Vector3(x, y, z);

  const sph = (r, sx = 1, sy = 1, sz = 1, seg = 28) => { const g = new T3.SphereGeometry(r, seg, Math.round(seg * 0.75)); g.scale(sx, sy, sz); return g; };
  // the cast's toon material: clean light bands, a crisp warm rim, shadow sides that keep their colour
  const CT = (o) => G.toon(Object.assign({ crisp: 1, shadeSat: 1.15 }, o));
  const basic = (hex, k = 1) => { const c = new T3.Color(hex); c.multiplyScalar(k); return new T3.MeshBasicMaterial({ color: c }); };

  class Rig {
    constructor(scene, o) {
      this.o = o; this.scene = scene;
      this.root = new T3.Group(); this.root.rotation.order = 'YXZ';
      this.spine = new T3.Group(); this.spine.rotation.order = 'YXZ'; this.spine.position.set(0, o.spineY || 0.1, 0);
      this.head = new T3.Group(); this.head.rotation.order = 'YXZ'; this.head.position.set(0, o.headY, 0);
      this.root.add(this.spine); this.spine.add(this.head);
      scene.add(this.root);
      this.arms = [0, 1].map(() => new G.Tube(12, 10, o.armMat));
      this.legs = [0, 1].map(() => new G.Tube(12, 10, o.legMat));
      for (const t of [...this.arms, ...this.legs]) { G.reg(t.mesh); scene.add(t.mesh); }
      this.hands = [0, 1].map(() => { const m = new T3.Mesh(o.handGeo, o.handMat); G.reg(m); scene.add(m); return m; });
      this.feet = [0, 1].map(() => { const g = new T3.Group(); g.rotation.order = 'YXZ'; const m = new T3.Mesh(o.footGeo, o.footMat); m.position.set(0, o.footLift || 0.05, 0.03); G.reg(m); g.add(m); scene.add(g); return g; });
      this.tmpP = new Float32Array(36); this.tmpR = new Float32Array(12);
      this.shoulder = [V3(o.shoulder[0], o.shoulder[1], o.shoulder[2]), V3(-o.shoulder[0], o.shoulder[1], o.shoulder[2])];
      this.hip = [V3(o.hip[0], o.hip[1], o.hip[2]), V3(-o.hip[0], o.hip[1], o.hip[2])];
      this.w = V3(); this.w2 = V3();
      this.scale = o.scale || 1;
      this.root.scale.setScalar(this.scale);
    }
    add(mesh, parent, opts) { (parent || this.spine).add(mesh); if (mesh.isMesh) G.reg(mesh, opts); return mesh; }
    setVisible(v) { this.root.visible = v; for (const m of [...this.arms, ...this.legs]) m.mesh.visible = v; for (const m of [...this.hands, ...this.feet]) m.visible = v; }
    // P: pelvis {x,y,z}, yaw, pitch, roll, spine {pitch, roll, yaw}, head {pitch, yaw, roll}, hands [{x,y,z}], feet [{x,y,z,yaw,pitch}]
    apply(P) {
      const o = this.o, sc = this.scale, r = this.root;
      r.position.set(P.x, P.y, P.z);
      r.rotation.set(P.pitch || 0, P.yaw || 0, P.roll || 0);
      const sq = P.squash || 1;
      r.scale.set(sc / Math.sqrt(sq), sc * sq, sc / Math.sqrt(sq));
      this.spine.rotation.set(P.spine ? P.spine.pitch || 0 : 0, P.spine ? P.spine.yaw || 0 : 0, P.spine ? P.spine.roll || 0 : 0);
      this.head.rotation.set(P.head ? P.head.pitch || 0 : 0, P.head ? P.head.yaw || 0 : 0, P.head ? P.head.roll || 0 : 0);
      r.updateMatrixWorld(true);
      const fwd = V3(Math.sin(P.yaw || 0), 0, Math.cos(P.yaw || 0));
      const side = V3(Math.cos(P.yaw || 0), 0, -Math.sin(P.yaw || 0));   // local +x
      for (let i = 0; i < 2; i++) {
        const a = this.spine.localToWorld(this.w.copy(this.shoulder[i]));
        const hnd = P.hands[i];
        const bend = V3().copy(fwd).multiplyScalar(-0.55).addScaledVector(side, i === 0 ? 0.6 : -0.6); bend.y = -0.5; bend.normalize();
        if (P.elbow) bend.add(P.elbow[i]).normalize();
        G.limbPoints(this.tmpP, 12, a, hnd, bend, o.armLen * sc, o.armR[0] * sc, o.armR[1] * sc, this.tmpR);
        this.arms[i].update(this.tmpP, this.tmpR);
        this.hands[i].position.set(hnd.x, hnd.y, hnd.z);
        this.hands[i].scale.setScalar(sc * (P.handScale ? P.handScale[i] : 1));
        this.hands[i].rotation.set(0, P.yaw || 0, 0);
      }
      for (let i = 0; i < 2; i++) {
        const a = this.root.localToWorld(this.w.copy(this.hip[i]));
        const f = P.feet[i];
        const ank = this.w2.set(f.x, f.y + (o.ankle || 0.09) * sc, f.z);
        const fy = f.yaw == null ? P.yaw || 0 : f.yaw;
        const bend = V3(Math.sin(fy), 0.15, Math.cos(fy)).addScaledVector(side, i === 0 ? 0.25 : -0.25).normalize();
        if (P.knee) bend.add(P.knee[i]).normalize();
        G.limbPoints(this.tmpP, 12, a, ank, bend, o.legLen * sc, o.legR[0] * sc, o.legR[1] * sc, this.tmpR);
        this.legs[i].update(this.tmpP, this.tmpR);
        const ft = this.feet[i];
        ft.position.set(f.x, f.y, f.z);
        ft.rotation.set(-(f.pitch || 0), fy, f.roll || 0);
        ft.scale.setScalar(sc);
      }
      if (this.onPose) this.onPose(P);
    }
    pointOn(group, local, out) { (group || this.spine).localToWorld(out.copy(local)); return out; }
  }

  // ------------------------------------------------------------------ the "Claude" name plate (canvas texture)
  // Plain text, bold rounded sans (Nunito Black, vendored), light text on a dark rounded plate.
  function tagTexture(opts = {}) {
    const w = opts.w || 640, h = opts.h || 220;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const r = h * 0.42, pad = h * 0.06;
    const rr = (x, y, ww, hh, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + ww, y, x + ww, y + hh, rad); g.arcTo(x + ww, y + hh, x, y + hh, rad); g.arcTo(x, y + hh, x, y, rad); g.arcTo(x, y, x + ww, y, rad); g.closePath(); };
    g.fillStyle = opts.rim || '#ffcfb4'; rr(0, 0, w, h, r); g.fill();
    g.fillStyle = opts.plate || '#2a1f3d'; rr(pad, pad, w - 2 * pad, h - 2 * pad, r - pad); g.fill();
    const fam = '"Nunito Tag", "Nunito", "Inter", sans-serif';
    let fs = h * 0.78;
    g.font = `900 ${fs}px ${fam}`;
    const tw = g.measureText('Claude').width, maxW = w - 2 * pad - h * 0.36;
    if (tw > maxW) { fs *= maxW / tw; g.font = `900 ${fs}px ${fam}`; }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const m = g.measureText('Claude');
    const capH = m.actualBoundingBoxAscent, base = h / 2 + capH / 2 - (m.actualBoundingBoxDescent > 0 ? 0 : 0);
    g.fillStyle = opts.text || '#fff3e2';
    g.lineJoin = 'round'; g.strokeStyle = opts.text || '#fff3e2'; g.lineWidth = fs * 0.035;
    g.strokeText('Claude', w / 2, base); g.fillText('Claude', w / 2, base);
    const tex = new T3.CanvasTexture(c);
    tex.colorSpace = T3.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = T3.LinearMipmapLinearFilter;
    tex.userData = { capFrac: capH / h, textFrac: m.width / w };
    return tex;
  }
  // a curved plate: a slice of an elliptic cylinder (radii rx, rz) centred on angle a0 (0 = +z, the chest)
  function platePlane(rx, rz, height, arc, a0, segs = 24) {
    const g = new T3.CylinderGeometry(1, 1, height, segs, 1, true, a0 - arc / 2, arc);
    g.scale(rx, 1, rz);
    return g;
  }
  function tagMaterial(tex, glow) {
    const m = new T3.MeshBasicMaterial({ map: tex, side: T3.FrontSide });
    m.color.setScalar(glow || 1);
    return m;
  }

  // ------------------------------------------------------------------ Claude (and, small, the helper)
  function makeClaude(scene, mini) {
    const coral = CT({ color: PAL.coral, rim: 0.7, shadeSat: 1.35, shadeTint: [1.1, 0.93, 0.97] });
    const coralD = CT({ color: PAL.coralDark, rim: 0.5, shadeSat: 1.35, shadeTint: [1.1, 0.93, 0.97] });
    const cream = CT({ color: PAL.coralBelly, rim: 0.5 });
    const o = {
      scale: (mini ? S.MS : 1) * S.CS, spineY: 0.06, headY: 0.86, shoulder: [0.3, 0.5, 0.0], hip: [0.14, 0.02, 0], armLen: 0.54, armR: [0.075, 0.062],
      legLen: 0.74, legR: [0.09, 0.08], ankle: 0.07, armMat: coral, legMat: coralD, handGeo: sph(0.095, 1, 0.95, 1.05), handMat: cream,
      footGeo: G.roundedBox(0.21, 0.13, 0.3, 0.06), footMat: coralD, footLift: 0.065, pelvisH: 0.5,
    };
    const R = new Rig(scene, o);
    R.kind = mini ? 'helper' : 'claude';
    R.mats = { coral, coralD, cream };
    // body: a round egg; the name plate wraps its chest and back
    const BX = 0.345, BY = 0.36, BZ = 0.3;
    R.add(new T3.Mesh(sph(1, BX, BY, BZ, 36), coral), R.spine).position.set(0, 0.27, 0);
    const belt = R.add(new T3.Mesh(new T3.TorusGeometry(1, 0.035, 10, 44), coralD), R.spine); belt.rotation.x = Math.PI / 2; belt.position.set(0, 0.06, 0); belt.scale.set(BX * 0.93, BZ * 0.95, 1);
    if (!mini) {
      const tex = tagTexture();
      R.tagTex = tex;
      const ph = 0.25, py = 0.3;
      // at the plate's height the egg's cross-section is a little smaller than at the equator
      const k = Math.sqrt(1 - ((py - 0.27) / BY) ** 2);
      for (const a0 of [0, Math.PI]) {
        const m = new T3.Mesh(platePlane(BX * k + 0.018, BZ * k + 0.018, ph, 1.9, a0, 36), tagMaterial(tex, 1.0));
        m.position.set(0, py, 0);
        R.add(m, R.spine, { line: 0.55, cast: false });
      }
      R.tagH = ph;
    } else {
      R.add(new T3.Mesh(sph(0.2, 1.05, 1.1, 0.5), cream), R.spine).position.set(0, 0.24, 0.17);
    }
    // head
    R.add(new T3.Mesh(sph(0.37, 1.08, 0.94, 1.0, 36), coral), R.head).position.set(0, 0, 0);
    const scr = new T3.Mesh(sph(0.32, 1.06, 0.8, 0.6, 36), CT({ color: PAL.screen, rim: 0.9, rimCol: '#c9b6ff' }));
    scr.position.set(0, 0.0, 0.2); R.add(scr, R.head, { line: 0.6 });
    const glare = new T3.Mesh(sph(0.06, 1.6, 0.6, 0.3), basic('#ffffff', 0.55)); glare.position.set(-0.13, 0.12, 0.355); glare.rotation.z = 0.5; R.add(glare, R.head, { line: 0, cast: false });
    for (const sx of [-1, 1]) { const e = new T3.Mesh(new T3.CylinderGeometry(0.1, 0.1, 0.09, 24), coralD); e.rotation.z = Math.PI / 2; e.position.set(sx * 0.39, 0, 0); R.add(e, R.head); }
    // the antenna module (Claude's is the part the helper swaps for a fresh one)
    R.antenna = makeAntenna(coralD, mini);
    R.antenna.group.position.set(0, mini ? 0.3 : 0.33, 0);
    R.head.add(R.antenna.group);
    // face: eyes (open ovals + happy arcs), mouth
    const eyeMat = basic(PAL.coralGlow, 2.6);
    R.eyeMat = eyeMat; R.eyeBase = eyeMat.color.clone();
    R.eyes = [-1, 1].map((sx) => { const e = new T3.Mesh(sph(0.06, 1, 1.45, 0.45, 16), eyeMat); e.position.set(sx * 0.12, 0.03, 0.372); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.arcs = [-1, 1].map((sx) => { const e = new T3.Mesh(new T3.TorusGeometry(0.05, 0.016, 6, 16, Math.PI), eyeMat); e.position.set(sx * 0.11, 0.01, 0.383); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.mouth = new T3.Mesh(new T3.TorusGeometry(0.05, 0.014, 6, 16, Math.PI), eyeMat); R.mouth.rotation.z = Math.PI; R.mouth.position.set(0, -0.1, 0.385); R.add(R.mouth, R.head, { line: 0, cast: false });
    R.mouthO = new T3.Mesh(new T3.TorusGeometry(0.035, 0.013, 6, 16), eyeMat); R.mouthO.position.set(0, -0.11, 0.383); R.add(R.mouthO, R.head, { line: 0, cast: false });
    R.waist = V3(0, 0.06, -0.31);   // rope knot, local to the spine (behind)
    R.shoulderTop = [V3(0.2, 0.62, -0.02), V3(-0.2, 0.62, -0.02)];
    if (mini) addHardHat(R, 0.4, 0.33);
    R.onPose = (P) => face(R, P.expr || {});
    return R;
  }

  // rod + collar + glowing bulb; the same model is used for the module that gets tossed
  function makeAntenna(darkMat, mini) {
    const g = new T3.Group();
    const rod = new T3.Mesh(new T3.CylinderGeometry(0.024, 0.03, 0.24, 10), darkMat); rod.position.y = 0.12; g.add(rod); G.reg(rod);
    const collar = new T3.Mesh(new T3.CylinderGeometry(0.065, 0.075, 0.06, 16), CT({ color: '#b9bec9', rim: 0.6 })); collar.position.y = 0.025; g.add(collar); G.reg(collar);
    const nut = new T3.Mesh(new T3.CylinderGeometry(0.05, 0.05, 0.035, 6), CT({ color: '#9aa1ae', rim: 0.6 })); nut.position.y = 0.07; g.add(nut); G.reg(nut, { line: 0.5 });
    const bulbMat = basic(PAL.coralGlow, 2.2);
    const bulb = new T3.Mesh(sph(0.085), bulbMat); bulb.position.y = 0.29; g.add(bulb); G.reg(bulb, { line: 0.7 });
    const cage = new T3.Mesh(new T3.TorusGeometry(0.09, 0.014, 6, 20), darkMat); cage.position.y = 0.29; cage.rotation.x = Math.PI / 2; g.add(cage); G.reg(cage, { line: 0.5 });
    return { group: g, bulb, bulbMat, base: new T3.Color(PAL.coralGlow) };
  }

  function addHardHat(R, r, y) {
    const hm = CT({ color: PAL.gold, rim: 0.6 });
    // (the hat casts no shadow: its wide brim would otherwise put the little helper's face and body in the dark)
    const dome = new T3.Mesh(new T3.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm); dome.position.set(0, y - 0.05, 0); R.add(dome, R.head, { cast: false });
    const brim = new T3.Mesh(new T3.CylinderGeometry(r * 1.22, r * 1.22, 0.035, 32), hm); brim.position.set(0, y - 0.05, 0.03); R.add(brim, R.head, { cast: false });
    const ridge = new T3.Mesh(G.roundedBox(0.07, 0.1, r * 1.9, 0.03), hm); ridge.position.set(0, y + r * 0.82, 0); R.add(ridge, R.head, { cast: false });
    // the small "Claude" tag on the front of the hat
    const tex = tagTexture({ w: 512, h: 200 });
    const tag = new T3.Mesh(new T3.SphereGeometry(r + 0.012, 24, 8, Math.PI / 2 - 0.62, 1.24, 0.95, 0.42), tagMaterial(tex, 1.0));
    // SphereGeometry's phi runs from -x around; rotate so the slice faces +z
    tag.rotation.y = -Math.PI / 2 + Math.PI / 2;
    tag.position.set(0, y - 0.05, 0);
    fixSphereSliceUV(tag.geometry);
    R.add(tag, R.head, { line: 0.4, cast: false });
    R.hatTag = tag;
  }
  // remap a sphere slice's uvs to the full 0..1 of the tag texture
  function fixSphereSliceUV(geo) {
    const uv = geo.attributes.uv; let u0 = 1, u1 = 0, v0 = 1, v1 = 0;
    for (let i = 0; i < uv.count; i++) { u0 = Math.min(u0, uv.getX(i)); u1 = Math.max(u1, uv.getX(i)); v0 = Math.min(v0, uv.getY(i)); v1 = Math.max(v1, uv.getY(i)); }
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - u0) / (u1 - u0), (uv.getY(i) - v0) / (v1 - v0));
  }

  // expressions: blink (0 open .. 1 shut), happy (arcs), squint (effort), surprise, look (eye offset x)
  function face(R, e) {
    const blink = U.sat(e.blink || 0), happy = U.sat(e.happy || 0), squint = U.sat(e.squint || 0), sur = U.sat(e.surprise || 0);
    const open = (1 - happy) * (1 - blink * 0.92);
    for (let i = 0; i < 2; i++) {
      const ey = R.eyes[i];
      const sy = open * (1 - squint * 0.6) * (1 + sur * 0.35);
      ey.scale.set(1 + sur * 0.25, Math.max(0.001, sy), 1);
      ey.visible = sy > 0.02;
      ey.position.x = (i === 0 ? -1 : 1) * 0.12 + (e.look || 0) * 0.03;
      ey.position.y = 0.03 + (e.lookUp || 0) * 0.03;
      ey.rotation.z = (i === 0 ? -1 : 1) * squint * 0.35;
      const a = R.arcs[i]; a.scale.setScalar(Math.max(0.001, happy)); a.visible = happy > 0.02;
    }
    R.mouth.scale.set(1 + 0.3 * happy, Math.max(0.001, (1 - sur) * (0.6 + 0.4 * (1 - squint)) * (1 + 0.4 * happy)), 1); R.mouth.visible = sur < 0.98;
    R.mouthO.scale.setScalar(Math.max(0.001, sur)); R.mouthO.visible = sur > 0.02;
  }

  // ------------------------------------------------------------------ the humans
  // an open lab coat: an elliptic shell whose front opening widens toward a flared hem, lapels, pockets
  function labCoatGeo() {
    const g = new T3.CylinderGeometry(1, 1, 1, 40, 10, true);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const v = 0.5 - y;                                   // 0 at the collar, 1 at the hem
      let a = Math.atan2(x, z);                            // 0 = front
      if (a < 0) a += Math.PI * 2;
      const gap = U.lerp(0.36, 1.12, Math.pow(v, 0.75));    // half-angle of the front opening
      const a2 = gap + (a / (Math.PI * 2)) * (Math.PI * 2 - 2 * gap);
      const r = U.lerp(0.215, 0.335, Math.pow(v, 0.9)) * (1 + 0.1 * v * v * Math.pow(Math.cos(a2 / 2), 2));
      const flareFront = 0.09 * v * v * Math.max(0, Math.cos(a2));    // the front panels kick out at the hem
      pos.setXYZ(i, Math.sin(a2) * r * 1.05, y * 0.86 - v * v * 0.02, Math.cos(a2) * (r * 0.8 + flareFront));
    }
    g.computeVertexNormals();
    return g;
  }
  const SKIN = { researcher: '#8d5a3b', suit: '#f1c6a3', evaluator: '#5c3a26' };
  function makeHuman(scene, kind) {
    const skin = CT({ color: SKIN[kind], rim: 0.5, shadeSat: 1.3, shadeTint: [1.12, 0.97, 0.9] });
    const top = CT({ color: { researcher: '#f7f4ee', suit: '#2e3a63', evaluator: '#e7ae45' }[kind], rim: 0.6 });
    const pants = CT({ color: { researcher: '#3f4a5c', suit: '#26304f', evaluator: '#4a3b52' }[kind], rim: 0.4 });
    const shoe = CT({ color: { researcher: '#4b3a33', suit: '#1f1b22', evaluator: '#6a3d2c' }[kind], rim: 0.4 });
    const hair = CT({ color: { researcher: '#2b1d1a', suit: '#7b4b2a', evaluator: '#231716' }[kind], rim: 0.5 });
    const o = {
      scale: S.HS, spineY: 0.04, headY: 0.76, shoulder: [0.22, 0.5, 0.0], hip: [0.1, 0.0, 0], armLen: 0.62, armR: [0.066, 0.056],
      legLen: 0.8, legR: [0.08, 0.068], ankle: 0.07, armMat: top, legMat: pants, handGeo: sph(0.07, 1, 1, 1.1), handMat: skin,
      footGeo: G.roundedBox(0.14, 0.1, 0.27, 0.045), footMat: shoe, footLift: 0.05, pelvisH: 0.6,
    };
    const R = new Rig(scene, o);
    R.kind = kind;
    if (kind === 'researcher') {
      const shirt = CT({ color: '#3fb3a6', rim: 0.4 });
      R.add(new T3.Mesh(G.roundedBox(0.36, 0.52, 0.24, 0.11), shirt), R.spine).position.set(0, 0.27, 0);
      const coatM = CT({ color: '#f7f4ee', rim: 0.6 });
      const cg = labCoatGeo();
      const coat = new T3.Mesh(cg, coatM); coat.scale.set(1, 0.92, 1); coat.position.set(0, 0.14, -0.005);
      R.add(coat, R.spine, { nid: G.nidMaterial(null, { side: T3.DoubleSide }) });
      // the lining: the inside of the coat, a shade darker, so the open front reads as a coat and not a tube
      const linM = CT({ color: '#cfcabd', rim: 0.2 }); linM.side = T3.BackSide;
      const lin = new T3.Mesh(cg, linM); lin.scale.set(0.985, 0.92, 0.985); lin.position.copy(coat.position);
      R.add(lin, R.spine, { nid: G.nidMaterial(null, { side: T3.BackSide }) });
      // lapels: folded-back flaps on each side of the opening
      const lapM = CT({ color: '#e4dfd3', rim: 0.5 });
      for (const sx of [-1, 1]) {
        const lp = new T3.Mesh(G.roundedBox(0.075, 0.24, 0.025, 0.012), lapM);
        lp.position.set(sx * 0.085, 0.43, 0.165); lp.rotation.set(-0.15, sx * 0.45, sx * 0.42);
        R.add(lp, R.spine, { line: 0.8 });
      }
      const collar = new T3.Mesh(new T3.TorusGeometry(0.13, 0.03, 8, 24, Math.PI * 1.25), lapM); collar.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 1.375 + Math.PI); collar.position.set(0, 0.55, -0.01); R.add(collar, R.spine, { line: 0.6 });
      // pockets on the coat's front panels + a pen in the breast pocket
      for (const sx of [-1, 1]) { const pk = new T3.Mesh(G.roundedBox(0.11, 0.08, 0.02, 0.01), lapM); pk.position.set(sx * 0.21, -0.05, 0.215); pk.rotation.y = sx * 0.55; R.add(pk, R.spine, { line: 0.6 }); }
      const bp = new T3.Mesh(G.roundedBox(0.08, 0.07, 0.02, 0.01), lapM); bp.position.set(-0.15, 0.36, 0.17); bp.rotation.y = -0.5; R.add(bp, R.spine, { line: 0.5 });
      const pen = R.add(new T3.Mesh(new T3.CylinderGeometry(0.012, 0.012, 0.12, 6), CT({ color: '#d94a4a' })), R.spine); pen.position.set(-0.14, 0.41, 0.18);
    } else if (kind === 'suit') {
      R.add(new T3.Mesh(G.roundedBox(0.42, 0.56, 0.27, 0.12), top), R.spine).position.set(0, 0.27, 0);
      const shirt = R.add(new T3.Mesh(G.roundedBox(0.15, 0.2, 0.05, 0.02), CT({ color: '#f4f2ee' })), R.spine); shirt.position.set(0, 0.43, 0.12);
      const tie = R.add(new T3.Mesh(G.roundedBox(0.065, 0.3, 0.03, 0.015), CT({ color: '#d8423f', rim: 0.5 })), R.spine); tie.position.set(0, 0.33, 0.145);
      for (const sx of [-1, 1]) { const lp = new T3.Mesh(G.roundedBox(0.06, 0.22, 0.02, 0.01), CT({ color: '#243056' })); lp.position.set(sx * 0.09, 0.4, 0.145); lp.rotation.z = sx * 0.35; R.add(lp, R.spine, { line: 0.6 }); }
    } else if (kind === 'evaluator') {
      R.add(new T3.Mesh(G.roundedBox(0.42, 0.52, 0.27, 0.13), top), R.spine).position.set(0, 0.27, 0);
      const lan = R.add(new T3.Mesh(new T3.TorusGeometry(0.12, 0.013, 6, 24), CT({ color: '#3a7bd5' })), R.spine); lan.position.set(0, 0.4, 0.1); lan.rotation.x = 1.2; lan.scale.set(1, 1.6, 1);
      const badge = R.add(new T3.Mesh(G.roundedBox(0.09, 0.12, 0.02, 0.01), CT({ color: '#ffffff' })), R.spine); badge.position.set(0, 0.24, 0.15);
      const board = new T3.Group();
      board.add(new T3.Mesh(G.roundedBox(0.25, 0.33, 0.02, 0.01), CT({ color: '#a8743e' })));
      const paper = new T3.Mesh(G.roundedBox(0.21, 0.27, 0.01, 0.005), CT({ color: '#fbfaf5' })); paper.position.set(0, -0.015, 0.012); board.add(paper);
      for (let k = 0; k < 4; k++) { const ln = new T3.Mesh(G.roundedBox(0.15 - 0.03 * (k % 2), 0.012, 0.004, 0.002), CT({ color: '#7d8aa6' })); ln.position.set(-0.01, 0.06 - k * 0.045, 0.019); board.add(ln); }
      const clip = new T3.Mesh(G.roundedBox(0.09, 0.04, 0.03, 0.01), CT({ color: '#b9bec9' })); clip.position.set(0, 0.16, 0.015); board.add(clip);
      for (const m of board.children) G.reg(m, { line: 0.6 });
      board.scale.setScalar(S.HS);
      scene.add(board); R.board = board;
      const pen = new T3.Mesh(new T3.CylinderGeometry(0.012, 0.012, 0.14, 6), CT({ color: '#3a7bd5' })); G.reg(pen); pen.scale.setScalar(S.HS); scene.add(pen); R.pen = pen;
    }
    // neck + head
    R.add(new T3.Mesh(new T3.CylinderGeometry(0.06, 0.07, 0.14, 12), skin), R.spine).position.set(0, 0.6, 0);
    R.add(new T3.Mesh(sph(0.25, 1, 1.02, 0.96, 32), skin), R.head).position.set(0, 0.0, 0);
    for (const sx of [-1, 1]) R.add(new T3.Mesh(sph(0.055, 0.6, 1, 0.8), skin), R.head).position.set(sx * 0.245, -0.01, 0);
    R.add(new T3.Mesh(sph(0.04, 1, 0.9, 1), skin), R.head).position.set(0, -0.03, 0.245);   // nose
    if (kind === 'researcher') {
      const cap = new T3.Mesh(new T3.SphereGeometry(0.265, 28, 14, 0, Math.PI * 2, 0, 1.55), hair); cap.rotation.x = -0.35; cap.position.set(0, 0.02, -0.02); R.add(cap, R.head);
      R.add(new T3.Mesh(sph(0.11), hair), R.head).position.set(0, 0.2, -0.2);   // bun
      const gm = CT({ color: '#1d1a24' });
      for (const sx of [-1, 1]) { const g = new T3.Mesh(new T3.TorusGeometry(0.065, 0.014, 6, 20), gm); g.position.set(sx * 0.09, 0.03, 0.24); R.add(g, R.head, { line: 0.3 }); }
      R.add(new T3.Mesh(new T3.CylinderGeometry(0.01, 0.01, 0.05, 6), gm), R.head).position.set(0, 0.04, 0.25);
    } else if (kind === 'suit') {
      const cap = new T3.Mesh(new T3.SphereGeometry(0.262, 28, 14, 0, Math.PI * 2, 0, 1.2), hair); cap.rotation.set(-0.25, 0, 0.25); cap.position.set(0, 0.03, -0.01); R.add(cap, R.head);
      R.add(new T3.Mesh(sph(0.12, 1.4, 0.55, 1), hair), R.head).position.set(-0.08, 0.2, 0.1);  // quiff
    } else {
      for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2; const m = new T3.Mesh(sph(0.1), hair); m.position.set(Math.cos(a) * 0.19, 0.12 + 0.06 * Math.sin(k * 2.1), Math.sin(a) * 0.19 - 0.04); R.add(m, R.head); }
      R.add(new T3.Mesh(sph(0.16), hair), R.head).position.set(0, 0.17, -0.05);
    }
    // face: eyes with whites, brows, mouth
    const dark = basic('#1b1424');
    R.whites = [-1, 1].map((sx) => { const e = new T3.Mesh(sph(0.05, 0.9, 1.15, 0.45, 14), basic('#fbf7f0', 1)); e.position.set(sx * 0.09, 0.02, 0.222); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.eyes = [-1, 1].map((sx) => { const e = new T3.Mesh(sph(0.03, 0.9, 1.2, 0.6, 12), dark); e.position.set(sx * 0.09, 0.015, 0.238); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.brows = [-1, 1].map((sx) => { const e = new T3.Mesh(G.roundedBox(0.1, 0.026, 0.02, 0.01), CT({ color: '#2a1a16' })); e.position.set(sx * 0.09, 0.1, 0.228); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.mouth = new T3.Mesh(G.roundedBox(0.1, 0.024, 0.02, 0.01), dark); R.mouth.position.set(0, -0.11, 0.222); R.add(R.mouth, R.head, { line: 0, cast: false });
    R.mouthO = new T3.Mesh(sph(0.038, 1, 1.2, 0.5), basic('#5a2030')); R.mouthO.position.set(0, -0.11, 0.222); R.add(R.mouthO, R.head, { line: 0, cast: false });
    const blush = basic('#ff8f8f', 0.85);
    for (const sx of [-1, 1]) { const b = new T3.Mesh(sph(0.04, 1, 0.6, 0.3), blush); b.position.set(sx * 0.15, -0.05, 0.2); R.add(b, R.head, { line: 0, cast: false }); }
    R.onPose = (P) => humanFace(R, P.expr || {}, P);
    return R;
  }
  function humanFace(R, e, P) {
    const sur = U.sat(e.surprise || 0), eff = U.sat(e.effort || 0), blink = U.sat(e.blink || 0), det = U.sat(e.determined || 0);
    for (let i = 0; i < 2; i++) {
      const sy = Math.max(0.05, (1 - blink) * (1 - eff * 0.5) * (1 + sur * 0.4));
      R.eyes[i].scale.set(1 - sur * 0.15, sy * (1 - sur * 0.2), 1);
      R.whites[i].scale.set(1 + sur * 0.25, Math.max(0.05, sy * (1 + sur * 0.15)), 1);
      R.eyes[i].position.x = (i === 0 ? -1 : 1) * 0.09 + (e.look || 0) * 0.018;
      R.brows[i].rotation.z = (i === 0 ? -1 : 1) * ((eff + det) * 0.42 - sur * 0.3);
      R.brows[i].position.y = 0.1 + sur * 0.04 - (eff + det) * 0.012;
    }
    R.mouth.visible = sur < 0.5; R.mouth.scale.set(1 + eff * 0.35, 1 + eff * 0.9, 1); R.mouth.rotation.z = 0;
    R.mouthO.visible = sur >= 0.5; R.mouthO.scale.setScalar(0.6 + sur * 0.6);
    if (R.board && P.board) { const b = P.board; R.board.position.set(b.x, b.y, b.z); R.board.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0, 'YXZ'); }
    if (R.pen && P.pen) { const b = P.pen; R.pen.position.set(b.x, b.y, b.z); R.pen.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0, 'YXZ'); }
  }

  S.chars = { Rig, makeClaude, makeHuman, makeAntenna, tagTexture };
})();
