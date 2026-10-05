"""The courier's hair: a painted scalp cap, ~90 sculpted ribbon locks laid
over a head ellipsoid (side-swept bangs that fall across the face, side
locks, back hair gathered at the nape) and an interleaved braid.

Each lock is generated as a lens-section tube that lies flat against the
head, widest a third of the way down and pointed at the tip; UVs run
around (u) and along (v) the lock so the material can paint root-to-tip
gradients and strand streaks.
"""
import bpy
import bmesh
import math
import random
from mathutils import Vector, Matrix, Quaternion
import common as C

HEAD_C = Vector((0.0, -0.023, 1.474))
HEAD_R = Vector((0.1, 0.117, 0.139))


def on_head(direction, lift=1.06):
    """Point on the (lifted) head ellipsoid along a direction from its centre."""
    d = Vector(direction).normalized()
    s = 1.0 / math.sqrt((d.x / HEAD_R.x) ** 2 + (d.y / HEAD_R.y) ** 2 + (d.z / HEAD_R.z) ** 2)
    return HEAD_C + d * s * lift


def sph(az, el):
    """Direction from azimuth (deg, 0 = front -Y, + toward her left +X) and elevation (deg)."""
    a, e = math.radians(az), math.radians(el)
    return Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))


def material():
    m = bpy.data.materials.new("c_hairpaint")
    nt, n, l = C._nodes(m)
    out = n.new("ShaderNodeOutputMaterial")
    b = n.new("ShaderNodeBsdfPrincipled")
    b.inputs["Roughness"].default_value = 0.42
    b.inputs["Specular IOR Level"].default_value = 0.5
    uv = n.new("ShaderNodeUVMap"); uv.uv_map = "UVMap"
    sep = n.new("ShaderNodeSeparateXYZ"); l.new(uv.outputs["UV"], sep.inputs[0])
    ramp = n.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = (0.05, 0.004, 0.012, 1)
    cr.elements[1].position = 1.0; cr.elements[1].color = (0.5, 0.06, 0.12, 1)
    e = cr.elements.new(0.35); e.color = (0.2, 0.012, 0.035, 1)
    e = cr.elements.new(0.75); e.color = (0.36, 0.025, 0.07, 1)
    l.new(sep.outputs["Y"], ramp.inputs["Fac"])
    # strand streaks: noise stretched along the lock
    sc = n.new("ShaderNodeVectorMath"); sc.operation = "MULTIPLY"; sc.inputs[1].default_value = (14.0, 0.8, 1.0)
    l.new(uv.outputs["UV"], sc.inputs[0])
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 3.0; nz.inputs["Detail"].default_value = 3
    l.new(sc.outputs[0], nz.inputs["Vector"])
    st = n.new("ShaderNodeMapRange"); st.inputs["To Min"].default_value = 0.7; st.inputs["To Max"].default_value = 1.25
    l.new(nz.outputs["Fac"], st.inputs["Value"])
    # the flat face of the lock catches a painted highlight band
    hl = n.new("ShaderNodeMath"); hl.operation = "SINE"
    um = n.new("ShaderNodeMath"); um.operation = "MULTIPLY"; um.inputs[1].default_value = math.pi
    l.new(sep.outputs["X"], um.inputs[0]); l.new(um.outputs[0], hl.inputs[0])
    hlm = n.new("ShaderNodeMapRange"); hlm.inputs["From Min"].default_value = 0.6; hlm.inputs["To Min"].default_value = 0.85; hlm.inputs["To Max"].default_value = 1.15
    l.new(hl.outputs[0], hlm.inputs["Value"])
    f1 = n.new("ShaderNodeMath"); f1.operation = "MULTIPLY"
    l.new(st.outputs["Result"], f1.inputs[0]); l.new(hlm.outputs["Result"], f1.inputs[1])
    col = n.new("ShaderNodeVectorMath"); col.operation = "SCALE"
    l.new(ramp.outputs["Color"], col.inputs[0]); l.new(f1.outputs[0], col.inputs["Scale"])
    l.new(col.outputs[0], b.inputs["Base Color"])
    bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.3
    l.new(nz.outputs["Fac"], bp.inputs["Height"]); l.new(bp.outputs["Normal"], b.inputs["Normal"])
    fg = n.new("ShaderNodeGroup"); fg.node_tree = C.fog_group(); fg.inputs["Amount"].default_value = 0.4
    l.new(b.outputs[0], fg.inputs["Shader"]); l.new(fg.outputs[0], out.inputs["Surface"])
    return m


def lock_mesh(bm, uvl, path, width, thick, rng):
    """Append one lock along `path` (list of Vectors) to bm."""
    n = len(path)
    seg = 8
    rings = []
    for i, p in enumerate(path):
        t = i / (n - 1)
        tan = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
        out = (p - HEAD_C)
        out = (out - tan * out.dot(tan)).normalized()  # lies flat against the head
        side = tan.cross(out).normalized()
        # clump profile: swells from the root, holds, then points at the tip
        w = width * ((0.7 + 0.3 * t / 0.2) if t < 0.2 else max(0.03, 1 - ((t - 0.2) / 0.8) ** 2.4))
        h = max(thick * (1 - 0.3 * t), w * (0.3 + 0.35 * t))  # flat at the scalp, chunky where it hangs
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            ring.append(bm.verts.new(p + side * math.cos(a) * w + out * math.sin(a) * h))
        rings.append((ring, t))
    for i in range(n - 1):
        r0, t0 = rings[i]; r1, t1 = rings[i + 1]
        for k in range(seg):
            f = bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
            for loop, (kk, tt) in zip(f.loops, ((k, t0), (k + 1, t0), (k + 1, t1), (k, t1))):
                loop[uvl].uv = (kk / seg, tt)


def path_over_head(d0, d1, n=8, lift0=1.05, lift1=1.09, hang=0.0, hang_dir=(0, 0, -1), sway=Vector()):
    """Slerp a direction from d0 to d1 over the head, then optionally fall
    `hang` metres further along hang_dir."""
    q0, q1 = Vector(d0).normalized(), Vector(d1).normalized()
    pts = []
    ang = q0.angle(q1)
    axis = q0.cross(q1).normalized() if ang > 1e-4 else Vector((1, 0, 0))
    for i in range(n):
        t = i / (n - 1)
        d = Quaternion(axis, ang * t) @ q0
        pts.append(on_head(d, lift0 + (lift1 - lift0) * t) + sway * math.sin(t * math.pi))
    if hang > 0:
        last = pts[-1]
        hd = Vector(hang_dir).normalized()
        m = max(2, int(hang / 0.03))
        for i in range(1, m + 1):
            t = i / m
            pts.append(last + hd * hang * t + Vector((0, 0, -0.02 * t * t)) + sway * 0.5 * t)
    return pts


def build(coll, rng=None, style="down"):
    """Returns a list of hair objects (all in head-bone-ready rest space)."""
    rng = rng or random.Random(7)
    mat = material()
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")

    def lock(d0, d1, width, thick=0.0045, **kw):
        lock_mesh(bm, uvl, path_over_head(d0, d1, **kw), width, thick, rng)

    PART_AZ = 28  # side part on her left
    # bangs: from the part, swept across the brow to her right, falling past the cheek
    for k in range(13):
        az0 = PART_AZ - 4 + rng.uniform(-6, 6)
        el0 = 62 + k * 1.4 + rng.uniform(-3, 3)
        az1 = -38 - k * 5.0 + rng.uniform(-4, 4)
        el1 = 24 - k * 2.0 + rng.uniform(-3, 3)
        hang = (0.03 + 0.1 * (k / 12) + rng.uniform(0, 0.03)) * (1 if k > 3 else 0.4)
        lock(sph(az0, el0), sph(az1, el1), rng.uniform(0.019, 0.028), n=9, lift0=1.04, lift1=1.08 + 0.01 * k / 12,
             hang=hang, hang_dir=(-0.3, -0.1, -1), sway=Vector((0, -0.012, 0.01)))
    # two long locks that fall across the face, between the eyes (signature silhouette)
    for k, (az1, el1, hang) in enumerate(((-4, 22, 0.1), (6, 18, 0.13))):
        lock(sph(PART_AZ + 2, 70), sph(az1, el1), 0.016, thick=0.004, n=9, lift0=1.04, lift1=1.14, hang=hang,
             hang_dir=(-0.1, -0.45, -1), sway=Vector((0, -0.01, 0)))
    # the short side of the part: locks swept back over her left temple
    for k in range(8):
        az0 = PART_AZ + 6 + rng.uniform(-3, 3)
        lock(sph(az0, 65 - k * 2), sph(70 + k * 6, 22 - k * 3), rng.uniform(0.02, 0.026), n=8, lift0=1.04, lift1=1.07,
             hang=0.02 + 0.01 * k, hang_dir=(0.2, 0.5, -1))
    # crown and back: from the part / crown down to the nape
    for k in range(26):
        az0 = rng.uniform(-170, 170)
        el0 = rng.uniform(55, 85)
        az1 = 180 + rng.uniform(-35, 35)
        lock(sph(az0, el0), sph(az1, -48 + rng.uniform(-8, 6)), rng.uniform(0.026, 0.036), thick=0.006, n=10,
             lift0=1.03, lift1=1.06)
    # side locks behind the ears to the nape, a few spilling forward over the cowl
    for sx in (1, -1):
        for k in range(9):
            az0 = sx * (50 + k * 9 + rng.uniform(-4, 4))
            lock(sph(az0, 45 + rng.uniform(-6, 6)), sph(sx * (95 + k * 8), -25 - k * 2), rng.uniform(0.022, 0.03), n=8,
                 lift0=1.04, lift1=1.07, hang=0.03 + rng.uniform(0, 0.05) if k < 3 else 0.0, hang_dir=(sx * 0.15, 0.1, -1))
    hair = C.mesh_obj("hair_locks", bm, mat, coll, smooth=True)
    C.subsurf(hair, 1)

    # scalp cap so no skin shows between locks
    cap_bm = bmesh.new()
    bmesh.ops.create_uvsphere(cap_bm, u_segments=48, v_segments=24, radius=1.0)
    for v in cap_bm.verts:
        d = v.co.copy()
        p = on_head(d, 1.025)
        v.co = p
    # cut the face opening: below the hairline at the front
    kill = []
    for v in cap_bm.verts:
        d = (v.co - HEAD_C)
        az = math.degrees(math.atan2(d.x, -d.y))
        el = math.degrees(math.asin(max(-1, min(1, d.z / d.length))))
        hairline = 38 - 8 * math.cos(math.radians(az * 1.8)) if abs(az) < 75 else -45
        if el < hairline:
            kill.append(v)
    bmesh.ops.delete(cap_bm, geom=kill, context="VERTS")
    cap = C.mesh_obj("hair_cap", cap_bm, mat, coll, smooth=True)
    cap.data.uv_layers.new(name="UVMap")
    return [hair, cap], mat


def braid(coll, mat, path):
    """Interleaved lobes along a path: reads as a three-strand braid."""
    obs = []
    bm = bmesh.new()
    pts = [Vector(p) for p in path]
    total = sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))
    n = int(total / 0.022)

    def at(s):
        acc = 0
        for i in range(len(pts) - 1):
            L = (pts[i + 1] - pts[i]).length
            if acc + L >= s:
                t = (s - acc) / L
                return pts[i].lerp(pts[i + 1], t), (pts[i + 1] - pts[i]).normalized()
            acc += L
        return pts[-1], (pts[-1] - pts[-2]).normalized()
    for k in range(n):
        s = total * k / n
        p, tan = at(s)
        taper = 1.0 - 0.45 * (k / n)
        side = tan.cross(Vector((0, -1, 0))).normalized()
        tilt = 0.55 if k % 2 else -0.55
        q = tan.to_track_quat("Z", "Y")
        rot = Quaternion(tan, tilt) @ q
        lobe = bmesh.new()
        bmesh.ops.create_uvsphere(lobe, u_segments=10, v_segments=6, radius=1.0)
        for v in lobe.verts:
            v.co = Vector((v.co.x * 0.016 * taper, v.co.y * 0.011 * taper, v.co.z * 0.02))
        bmesh.ops.transform(lobe, matrix=Matrix.Translation(p + side * (0.004 if k % 2 else -0.004)) @ rot.to_matrix().to_4x4(), verts=lobe.verts)
        me = bpy.data.meshes.new("tmp"); lobe.to_mesh(me); lobe.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for lp in f.loops:
            lp[uvl].uv = (0.5, 0.75)
    ob = C.mesh_obj("braid", bm, mat, coll, smooth=True)
    end, tan = at(total)
    tie = C.torus("braid_tie", 0.011, 0.004, loc=tuple(end), mat=None, coll=coll)
    tie.rotation_euler = tan.to_track_quat("Z", "Y").to_euler()
    tuft_bm = bmesh.new()
    uvt = tuft_bm.loops.layers.uv.new("UVMap")
    for k in range(5):
        a = k * 2 * math.pi / 5
        start = end + Vector((math.cos(a) * 0.006, math.sin(a) * 0.006, 0))
        lock_mesh(tuft_bm, uvt, [start + tan * 0.012 * i + Vector((math.cos(a), math.sin(a), 0)) * 0.002 * i for i in range(6)], 0.008, 0.003, None)
    tuft = C.mesh_obj("braid_tuft", tuft_bm, mat, coll, smooth=True)
    return [ob, tie, tuft]
