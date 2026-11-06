// THE STAIRCASE - the cast, built from rounded primitives with toon shading: two AI climbers (coral "Pip" with a
// glowing face-screen; charcoal-and-mint "Kip" with a visor and chest light), their builder mini-mes, and four humans
// (a researcher in a lab coat, a suit, an evaluator with clipboard and lanyard, a hoodie). Rubber-hose limbs are live
// tubes from shoulder/hip to hand/foot targets, so a pose is just: pelvis frame, spine, head, hands, feet.
(function () {
  const S = window.STAIR, U = S.U, G = S.G, ST = S.stairs, T3 = THREE, PAL = S.PAL;
  const V3 = (x = 0, y = 0, z = 0) => new T3.Vector3(x, y, z);

  const sph = (r, sx = 1, sy = 1, sz = 1, seg = 28) => { const g = new T3.SphereGeometry(r, seg, Math.round(seg * 0.75)); g.scale(sx, sy, sz); return g; };
  const basic = (hex, k = 1) => { const c = new T3.Color(hex); c.multiplyScalar(k); return new T3.MeshBasicMaterial({ color: c }); };

  class Rig {
    constructor(scene, o) {
      this.o = o; this.scene = scene; this.parts = [];
      this.root = new T3.Group(); this.root.rotation.order = 'YXZ';
      this.spine = new T3.Group(); this.spine.rotation.order = 'YXZ'; this.spine.position.set(0, o.spineY || 0.1, 0);
      this.head = new T3.Group(); this.head.rotation.order = 'YXZ'; this.head.position.set(0, o.headY, 0);
      this.root.add(this.spine); this.spine.add(this.head);
      scene.add(this.root);
      this.limbMat = { arm: o.armMat, leg: o.legMat };
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
    // P: pelvis {x,y,z}, yaw, pitch, roll, spine {pitch, roll, yaw}, head {pitch, yaw, roll}, hands [{x,y,z}], feet [{x,y,z,yaw,pitch}]
    //    k: fold (laps) for body, kf: [left foot, right foot], squash
    apply(P) {
      const o = this.o, LAP = ST.LAP, sc = this.scale;
      const r = this.root;
      r.position.set(P.x, P.y, P.z);
      r.rotation.set(P.pitch || 0, P.yaw || 0, P.roll || 0);
      const sq = P.squash || 1;
      r.scale.set(sc / Math.sqrt(sq), sc * sq, sc / Math.sqrt(sq));
      this.spine.rotation.set(P.spine ? P.spine.pitch || 0 : 0, P.spine ? P.spine.yaw || 0 : 0, P.spine ? P.spine.roll || 0 : 0);
      this.head.rotation.set(P.head ? P.head.pitch || 0 : 0, P.head ? P.head.yaw || 0 : 0, P.head ? P.head.roll || 0 : 0);
      r.updateMatrixWorld(true);
      const fwd = V3(Math.sin(P.yaw || 0), 0, Math.cos(P.yaw || 0));
      const side = V3(Math.cos(P.yaw || 0), 0, -Math.sin(P.yaw || 0));   // local +x
      // arms
      for (let i = 0; i < 2; i++) {
        const a = this.spine.localToWorld(this.w.copy(this.shoulder[i]));
        const hnd = P.hands[i];
        const bend = V3().copy(fwd).multiplyScalar(-0.55).addScaledVector(side, i === 0 ? 0.6 : -0.6); bend.y = -0.5; bend.normalize();
        if (P.elbow) bend.add(P.elbow[i]).normalize();
        G.limbPoints(this.tmpP, 12, a, hnd, bend, o.armLen * sc, o.armR[0] * sc, o.armR[1] * sc, this.tmpR);
        this.arms[i].update(this.tmpP, this.tmpR);
        const k = P.kh ? P.kh[i] : P.k || 0;
        this.arms[i].mesh.position.set(-k * LAP.x, -k * LAP.y, -k * LAP.z);
        this.hands[i].position.set(hnd.x - k * LAP.x, hnd.y - k * LAP.y, hnd.z - k * LAP.z);
        this.hands[i].scale.setScalar(sc * (P.handScale ? P.handScale[i] : 1));
        this.hands[i].rotation.set(0, P.yaw || 0, 0);
      }
      // legs
      for (let i = 0; i < 2; i++) {
        const a = this.root.localToWorld(this.w.copy(this.hip[i]));
        const f = P.feet[i];
        const ank = this.w2.set(f.x, f.y + (o.ankle || 0.09) * sc, f.z);
        const fy = f.yaw == null ? P.yaw || 0 : f.yaw;
        const bend = V3(Math.sin(fy), 0.15, Math.cos(fy)).addScaledVector(side, i === 0 ? 0.25 : -0.25).normalize();
        if (P.knee) bend.add(P.knee[i]).normalize();
        G.limbPoints(this.tmpP, 12, a, ank, bend, o.legLen * sc, o.legR[0] * sc, o.legR[1] * sc, this.tmpR);
        this.legs[i].update(this.tmpP, this.tmpR);
        const k = P.kf ? P.kf[i] : P.k || 0;
        this.legs[i].mesh.position.set(-k * LAP.x, -k * LAP.y, -k * LAP.z);
        const ft = this.feet[i];
        ft.position.set(f.x - k * LAP.x, f.y - k * LAP.y, f.z - k * LAP.z);
        ft.rotation.set(-(f.pitch || 0), fy, f.roll || 0);
        ft.scale.setScalar(sc);
      }
      const k = P.k || 0;
      r.position.set(P.x - k * LAP.x, P.y - k * LAP.y, P.z - k * LAP.z);
      r.updateMatrixWorld(true);
      if (this.onPose) this.onPose(P);
    }
    // world (helix-space) position of a local point on the spine/root, before folding
    pointOn(group, local, P, out) {
      const k = P.k || 0, LAP = ST.LAP;
      (group || this.spine).localToWorld(out.copy(local));
      out.x += k * LAP.x; out.y += k * LAP.y; out.z += k * LAP.z;
      return out;
    }
  }

  // ------------------------------------------------------------------ the AI climbers (and, scaled, their mini-mes)
  function makePip(scene, mini) {
    const coral = G.toon({ color: PAL.coral, rim: 0.7 });
    const coralD = G.toon({ color: PAL.coralDark, rim: 0.5 });
    const cream = G.toon({ color: PAL.coralBelly, rim: 0.5 });
    const o = {
      scale: (mini ? 0.5 : 1) * S.CS, spineY: 0.06, headY: 0.86, shoulder: [0.27, 0.5, 0.0], hip: [0.13, 0.02, 0], armLen: 0.52, armR: [0.075, 0.062],
      legLen: 0.74, legR: [0.088, 0.078], ankle: 0.07, armMat: coral, legMat: coralD, handGeo: sph(0.095, 1, 0.95, 1.05), handMat: cream,
      footGeo: G.roundedBox(0.2, 0.13, 0.3, 0.06), footMat: coralD, footLift: 0.065, pelvisH: 0.5,
    };
    const R = new Rig(scene, o);
    R.kind = 'pip';
    // body: an egg with a cream belly
    R.add(new T3.Mesh(sph(0.31, 1, 1.12, 0.92), coral), R.spine).position.set(0, 0.26, 0);
    R.add(new T3.Mesh(sph(0.2, 1, 1.15, 0.5), cream), R.spine).position.set(0, 0.22, 0.2);
    // belt (where the ropes tie on)
    const belt = R.add(new T3.Mesh(new T3.TorusGeometry(0.285, 0.035, 10, 40), coralD), R.spine); belt.rotation.x = Math.PI / 2; belt.position.set(0, 0.08, 0); belt.scale.set(1, 0.92, 1);
    // head
    R.add(new T3.Mesh(sph(0.37, 1.08, 0.94, 1.0, 36), coral), R.head).position.set(0, 0, 0);
    const scr = new T3.Mesh(sph(0.32, 1.06, 0.8, 0.46, 36), G.toon({ color: PAL.screen, rim: 0.9, rimCol: '#c9b6ff' }));
    scr.position.set(0, 0.0, 0.2); R.add(scr, R.head, { line: 0.6 });
    const glare = new T3.Mesh(sph(0.06, 1.6, 0.6, 0.3), basic('#ffffff', 0.55)); glare.position.set(-0.13, 0.12, 0.33); glare.rotation.z = 0.5; R.add(glare, R.head, { line: 0, cast: false });
    // ears and antenna
    for (const sx of [-1, 1]) { const e = new T3.Mesh(new T3.CylinderGeometry(0.1, 0.1, 0.09, 24), coralD); e.rotation.z = Math.PI / 2; e.position.set(sx * 0.39, 0, 0); R.add(e, R.head); }
    const ant = R.add(new T3.Mesh(new T3.CylinderGeometry(0.018, 0.022, 0.2, 8), coralD), R.head); ant.position.set(0, 0.42, 0);
    const bulb = new T3.Mesh(sph(0.06), basic(PAL.coralGlow, 2.2)); bulb.position.set(0, 0.54, 0); R.add(bulb, R.head, { line: 0.7 });
    // face: eyes (open ovals + happy arcs), mouth
    const eyeMat = basic(PAL.coralGlow, 2.6);
    R.eyes = [-1, 1].map((sx) => { const e = new T3.Mesh(sph(0.06, 1, 1.45, 0.45, 16), eyeMat); e.position.set(sx * 0.12, 0.03, 0.335); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.arcs = [-1, 1].map((sx) => { const e = new T3.Mesh(new T3.TorusGeometry(0.05, 0.016, 6, 16, Math.PI), eyeMat); e.position.set(sx * 0.11, 0.01, 0.34); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.mouth = new T3.Mesh(new T3.TorusGeometry(0.05, 0.014, 6, 16, Math.PI), eyeMat); R.mouth.rotation.z = Math.PI; R.mouth.position.set(0, -0.1, 0.33); R.add(R.mouth, R.head, { line: 0, cast: false });
    R.mouthO = new T3.Mesh(new T3.TorusGeometry(0.035, 0.013, 6, 16), eyeMat); R.mouthO.position.set(0, -0.11, 0.33); R.add(R.mouthO, R.head, { line: 0, cast: false });
    R.waist = V3(0, 0.08, -0.29);   // rope knot, local to the spine (behind)
    if (mini) addHardHat(R, 0.4, 0.33);
    R.onPose = (P) => face(R, P.expr || {});
    return R;
  }

  function makeKip(scene, mini) {
    const charM = G.toon({ color: PAL.char, rim: 0.85, rimCol: '#b8fff0' });
    const charD = G.toon({ color: PAL.charDark, rim: 0.6, rimCol: '#b8fff0' });
    const mintM = G.toon({ color: PAL.mintDeep, rim: 0.6, rimCol: '#e0fff8' });
    const o = {
      scale: (mini ? 0.5 : 1) * S.CS, spineY: 0.08, headY: 0.9, shoulder: [0.29, 0.5, 0.0], hip: [0.13, 0.0, 0], armLen: 0.56, armR: [0.06, 0.05],
      legLen: 0.84, legR: [0.07, 0.06], ankle: 0.07, armMat: charM, legMat: charD, handGeo: sph(0.085, 1, 0.9, 1.1), handMat: mintM,
      footGeo: G.roundedBox(0.17, 0.12, 0.3, 0.05), footMat: charD, footLift: 0.06, pelvisH: 0.58,
    };
    const R = new Rig(scene, o);
    R.kind = 'kip';
    R.add(new T3.Mesh(G.roundedBox(0.52, 0.56, 0.38, 0.16), charM), R.spine).position.set(0, 0.28, 0);
    const chest = new T3.Mesh(new T3.CylinderGeometry(0.085, 0.085, 0.04, 28), basic(PAL.mint, 2.4)); chest.rotation.x = Math.PI / 2; chest.position.set(0, 0.34, 0.19); R.add(chest, R.spine, { line: 0.5, cast: false });
    const ring = R.add(new T3.Mesh(new T3.TorusGeometry(0.11, 0.022, 8, 32), charD), R.spine); ring.position.set(0, 0.34, 0.19);
    const belt = R.add(new T3.Mesh(G.roundedBox(0.56, 0.08, 0.42, 0.04), mintM), R.spine); belt.position.set(0, 0.06, 0);
    R.add(new T3.Mesh(G.roundedBox(0.68, 0.56, 0.6, 0.22), charM), R.head).position.set(0, 0, 0);
    const vis = new T3.Mesh(G.roundedBox(0.6, 0.2, 0.1, 0.05), basic(PAL.mint, 2.1)); vis.position.set(0, 0.02, 0.27); R.add(vis, R.head, { line: 0.6, cast: false });
    const fin = new T3.Mesh(G.roundedBox(0.06, 0.22, 0.3, 0.03), mintM); fin.position.set(0, 0.3, -0.04); R.add(fin, R.head);
    for (const sx of [-1, 1]) { const e = new T3.Mesh(G.roundedBox(0.06, 0.2, 0.2, 0.03), charD); e.position.set(sx * 0.35, 0, 0); R.add(e, R.head); }
    const eyeMat = basic('#163c39', 1);
    R.eyes = [-1, 1].map((sx) => { const e = new T3.Mesh(G.roundedBox(0.1, 0.1, 0.04, 0.02), eyeMat); e.position.set(sx * 0.13, 0.02, 0.325); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.arcs = [-1, 1].map((sx) => { const e = new T3.Mesh(new T3.TorusGeometry(0.05, 0.018, 6, 16, Math.PI), eyeMat); e.position.set(sx * 0.13, 0.0, 0.33); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.mouth = null; R.mouthO = null;
    R.waist = V3(0, 0.06, -0.24);
    if (mini) addHardHat(R, 0.36, 0.33);
    R.onPose = (P) => face(R, P.expr || {});
    return R;
  }

  function addHardHat(R, r, y) {
    const hm = G.toon({ color: PAL.gold, rim: 0.6 });
    const dome = new T3.Mesh(new T3.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm); dome.position.set(0, y - 0.05, 0); R.add(dome, R.head);
    const brim = new T3.Mesh(new T3.CylinderGeometry(r * 1.22, r * 1.22, 0.035, 32), hm); brim.position.set(0, y - 0.05, 0.03); R.add(brim, R.head);
    const ridge = new T3.Mesh(G.roundedBox(0.07, 0.1, r * 1.9, 0.03), hm); ridge.position.set(0, y + r * 0.82, 0); R.add(ridge, R.head);
  }

  // expressions: blink (0 open .. 1 shut), happy (arcs), squint (effort), surprise, look (eye offset x)
  function face(R, e) {
    const blink = U.sat(e.blink || 0), happy = U.sat(e.happy || 0), squint = U.sat(e.squint || 0), sur = U.sat(e.surprise || 0);
    const open = (1 - happy) * (1 - blink * 0.92);
    const isKip = R.kind === 'kip';
    for (let i = 0; i < 2; i++) {
      const ey = R.eyes[i];
      const sy = open * (1 - squint * 0.6) * (1 + sur * 0.35);
      ey.scale.set(1 + sur * 0.25 - (isKip ? squint * 0.0 : 0), Math.max(0.001, sy), 1);
      ey.visible = sy > 0.02;
      ey.position.x = (i === 0 ? -1 : 1) * (isKip ? 0.13 : 0.11) + (e.look || 0) * 0.03;
      ey.rotation.z = (i === 0 ? -1 : 1) * squint * 0.35;
      const a = R.arcs[i]; a.scale.setScalar(Math.max(0.001, happy)); a.visible = happy > 0.02;
    }
    if (R.mouth) {
      R.mouth.scale.set(1, Math.max(0.001, (1 - sur) * (0.6 + 0.4 * (1 - squint))), 1); R.mouth.visible = sur < 0.98;
      R.mouth.rotation.z = Math.PI + (squint > 0.5 ? 0 : 0);
      R.mouthO.scale.setScalar(Math.max(0.001, sur)); R.mouthO.visible = sur > 0.02;
    }
  }

  // ------------------------------------------------------------------ the humans
  const SKIN = ['#8d5a3b', '#f1c6a3', '#5c3a26', '#d9a27c'];
  function makeHuman(scene, kind) {
    const skinHex = { researcher: SKIN[0], suit: SKIN[1], evaluator: SKIN[2], hoodie: SKIN[3] }[kind];
    const skin = G.toon({ color: skinHex, rim: 0.5 });
    const top = G.toon({ color: { researcher: '#f4f1ea', suit: '#2e3a63', evaluator: '#e7ae45', hoodie: '#4b86c9' }[kind], rim: 0.6 });
    const pants = G.toon({ color: { researcher: '#3f4a5c', suit: '#26304f', evaluator: '#4a3b52', hoodie: '#373a46' }[kind], rim: 0.4 });
    const shoe = G.toon({ color: { researcher: '#4b3a33', suit: '#1f1b22', evaluator: '#6a3d2c', hoodie: '#e9e5dc' }[kind], rim: 0.4 });
    const hair = G.toon({ color: { researcher: '#2b1d1a', suit: '#7b4b2a', evaluator: '#231716', hoodie: '#c06b3e' }[kind], rim: 0.5 });
    const sleeve = kind === 'researcher' ? top : top;
    const o = {
      scale: S.HS, spineY: 0.04, headY: 0.74, shoulder: [0.22, 0.5, 0.0], hip: [0.1, 0.0, 0], armLen: 0.62, armR: [0.065, 0.055],
      legLen: 0.8, legR: [0.08, 0.068], ankle: 0.07, armMat: sleeve, legMat: pants, handGeo: sph(0.068, 1, 1, 1.1), handMat: skin,
      footGeo: G.roundedBox(0.14, 0.1, 0.27, 0.045), footMat: shoe, footLift: 0.05, pelvisH: 0.6,
    };
    const R = new Rig(scene, o);
    R.kind = kind;
    // torso
    if (kind === 'researcher') {
      const shirt = G.toon({ color: '#3fb3a6', rim: 0.4 });
      R.add(new T3.Mesh(G.roundedBox(0.4, 0.52, 0.26, 0.12), shirt), R.spine).position.set(0, 0.27, 0);
      // lab coat: an open, flared shell (two front panels + back), down past the hips
      const coat = new T3.CylinderGeometry(0.22, 0.31, 0.78, 28, 1, true, 0.35, Math.PI * 2 - 0.7);
      coat.rotateY(Math.PI / 2); coat.scale(1, 1, 0.78);
      const cm = new T3.Mesh(coat, G.toon({ color: '#f6f3ec', rim: 0.6 })); cm.material.side = T3.DoubleSide; cm.position.set(0, 0.2, 0);
      R.add(cm, R.spine, { side: T3.DoubleSide, nid: G.nidMaterial(null, { side: T3.DoubleSide }) });
      const pen = R.add(new T3.Mesh(new T3.CylinderGeometry(0.012, 0.012, 0.12, 6), G.toon({ color: '#d94a4a' })), R.spine); pen.position.set(-0.12, 0.42, 0.2);
    } else if (kind === 'suit') {
      R.add(new T3.Mesh(G.roundedBox(0.42, 0.54, 0.27, 0.12), top), R.spine).position.set(0, 0.27, 0);
      const collar = R.add(new T3.Mesh(G.roundedBox(0.16, 0.16, 0.05, 0.02), G.toon({ color: '#f4f2ee' })), R.spine); collar.position.set(0, 0.47, 0.12); collar.rotation.z = Math.PI / 4;
      const tie = R.add(new T3.Mesh(G.roundedBox(0.07, 0.3, 0.03, 0.015), G.toon({ color: '#d8423f', rim: 0.5 })), R.spine); tie.position.set(0, 0.33, 0.14);
    } else if (kind === 'evaluator') {
      R.add(new T3.Mesh(G.roundedBox(0.42, 0.52, 0.27, 0.13), top), R.spine).position.set(0, 0.27, 0);
      const lan = R.add(new T3.Mesh(new T3.TorusGeometry(0.12, 0.012, 6, 24), G.toon({ color: '#3a7bd5' })), R.spine); lan.position.set(0, 0.4, 0.1); lan.rotation.x = 1.2; lan.scale.set(1, 1.6, 1);
      const badge = R.add(new T3.Mesh(G.roundedBox(0.09, 0.12, 0.02, 0.01), G.toon({ color: '#ffffff' })), R.spine); badge.position.set(0, 0.24, 0.15);
      const board = new T3.Group();
      board.add(new T3.Mesh(G.roundedBox(0.24, 0.32, 0.02, 0.01), G.toon({ color: '#a8743e' })));
      const paper = new T3.Mesh(G.roundedBox(0.2, 0.26, 0.01, 0.005), G.toon({ color: '#fbfaf5' })); paper.position.set(0, -0.015, 0.012); board.add(paper);
      const clip = new T3.Mesh(G.roundedBox(0.09, 0.04, 0.03, 0.01), G.toon({ color: '#b9bec9' })); clip.position.set(0, 0.155, 0.015); board.add(clip);
      for (const m of board.children) G.reg(m);
      scene.add(board); R.board = board;
    } else {
      R.add(new T3.Mesh(G.roundedBox(0.44, 0.54, 0.29, 0.15), top), R.spine).position.set(0, 0.27, 0);
      const hood = R.add(new T3.Mesh(new T3.TorusGeometry(0.16, 0.07, 10, 24), top), R.spine); hood.position.set(0, 0.55, -0.1); hood.rotation.x = 1.1;
      const pocket = R.add(new T3.Mesh(G.roundedBox(0.28, 0.12, 0.04, 0.02), G.toon({ color: '#3f74b0' })), R.spine); pocket.position.set(0, 0.13, 0.14);
      for (const sx of [-1, 1]) { const st = R.add(new T3.Mesh(new T3.CylinderGeometry(0.01, 0.01, 0.16, 6), G.toon({ color: '#f2f0ea' })), R.spine); st.position.set(sx * 0.05, 0.4, 0.15); }
    }
    // neck + head
    R.add(new T3.Mesh(new T3.CylinderGeometry(0.06, 0.07, 0.14, 12), skin), R.spine).position.set(0, 0.6, 0);
    R.add(new T3.Mesh(sph(0.25, 1, 1.02, 0.96, 32), skin), R.head).position.set(0, 0.0, 0);
    for (const sx of [-1, 1]) R.add(new T3.Mesh(sph(0.055, 0.6, 1, 0.8), skin), R.head).position.set(sx * 0.245, -0.01, 0);
    // hair
    if (kind === 'researcher') {
      const cap = new T3.Mesh(new T3.SphereGeometry(0.265, 28, 14, 0, Math.PI * 2, 0, 1.55), hair); cap.rotation.x = -0.35; cap.position.set(0, 0.02, -0.02); R.add(cap, R.head);
      R.add(new T3.Mesh(sph(0.11), hair), R.head).position.set(0, 0.2, -0.2);   // bun
      const gm = G.toon({ color: '#1d1a24' });
      for (const sx of [-1, 1]) { const g = new T3.Mesh(new T3.TorusGeometry(0.065, 0.013, 6, 20), gm); g.position.set(sx * 0.09, 0.02, 0.235); R.add(g, R.head, { line: 0.3 }); }
      R.add(new T3.Mesh(new T3.CylinderGeometry(0.01, 0.01, 0.05, 6), gm), R.head).position.set(0, 0.03, 0.245);
    } else if (kind === 'suit') {
      const cap = new T3.Mesh(new T3.SphereGeometry(0.262, 28, 14, 0, Math.PI * 2, 0, 1.2), hair); cap.rotation.set(-0.25, 0, 0.25); cap.position.set(0, 0.03, -0.01); R.add(cap, R.head);
      R.add(new T3.Mesh(sph(0.12, 1.4, 0.55, 1), hair), R.head).position.set(-0.08, 0.2, 0.1);  // quiff
    } else if (kind === 'evaluator') {
      for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2; const m = new T3.Mesh(sph(0.1), hair); m.position.set(Math.cos(a) * 0.19, 0.12 + 0.06 * Math.sin(k * 2.1), Math.sin(a) * 0.19 - 0.04); R.add(m, R.head); }
      R.add(new T3.Mesh(sph(0.16), hair), R.head).position.set(0, 0.17, -0.05);
    } else {
      const cap = new T3.Mesh(new T3.SphereGeometry(0.27, 28, 14, 0, Math.PI * 2, 0, 1.3), G.toon({ color: '#6c4bb0', rim: 0.5 })); cap.position.set(0, 0.04, -0.01); cap.rotation.x = -0.2; R.add(cap, R.head);   // beanie
      const fold = new T3.Mesh(new T3.TorusGeometry(0.235, 0.045, 8, 28), G.toon({ color: '#5a3c99' })); fold.rotation.x = Math.PI / 2 - 0.2; fold.position.set(0, 0.1, 0.0); R.add(fold, R.head);
    }
    // face
    const dark = basic('#1b1424');
    R.eyes = [-1, 1].map((sx) => { const e = new T3.Mesh(sph(0.032, 0.85, 1.25, 0.6, 12), dark); e.position.set(sx * 0.09, 0.02, 0.228); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.brows = [-1, 1].map((sx) => { const e = new T3.Mesh(G.roundedBox(0.09, 0.022, 0.02, 0.01), G.toon({ color: '#2a1a16' })); e.position.set(sx * 0.09, 0.1, 0.225); R.add(e, R.head, { line: 0, cast: false }); return e; });
    R.mouth = new T3.Mesh(G.roundedBox(0.09, 0.022, 0.02, 0.01), dark); R.mouth.position.set(0, -0.1, 0.225); R.add(R.mouth, R.head, { line: 0, cast: false });
    R.mouthO = new T3.Mesh(sph(0.035, 1, 1.2, 0.5), basic('#5a2030')); R.mouthO.position.set(0, -0.1, 0.225); R.add(R.mouthO, R.head, { line: 0, cast: false });
    const blush = basic('#ff8f8f', 0.85);
    for (const sx of [-1, 1]) { const b = new T3.Mesh(sph(0.04, 1, 0.6, 0.3), blush); b.position.set(sx * 0.15, -0.05, 0.2); R.add(b, R.head, { line: 0, cast: false }); }
    R.onPose = (P) => humanFace(R, P.expr || {}, P);
    R.chest = V3(0, 0.36, 0.2);
    return R;
  }
  function humanFace(R, e, P) {
    const sur = U.sat(e.surprise || 0), eff = U.sat(e.effort || 0), blink = U.sat(e.blink || 0);
    for (let i = 0; i < 2; i++) {
      R.eyes[i].scale.set(1 + sur * 0.3, Math.max(0.05, (1 - blink) * (1 - eff * 0.45) * (1 + sur * 0.4)), 1);
      R.brows[i].rotation.z = (i === 0 ? -1 : 1) * (eff * 0.45 - sur * 0.25);
      R.brows[i].position.y = 0.1 + sur * 0.035 - eff * 0.01;
    }
    R.mouth.visible = sur < 0.5; R.mouth.scale.set(1 - eff * 0.2, 1 + eff * 1.2, 1);
    R.mouthO.visible = sur >= 0.5; R.mouthO.scale.setScalar(0.6 + sur * 0.5);
    if (R.board && P.board) {
      const b = P.board; R.board.position.set(b.x, b.y, b.z); R.board.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0, 'YXZ');
    }
  }

  S.chars = { Rig, makePip, makeKip, makeHuman };
})();
