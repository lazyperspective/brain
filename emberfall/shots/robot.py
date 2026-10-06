"""The protagonist: Blender Studio's Security Bot from the open movie
"Charge" (CC-BY 4.0), appended with its full CloudRig and re-dressed for
EMBERFALL (paint splats off, teal eye, ember-red trim glow).

    rig, parts = robot.build()
    robot.walk(rig, (f0, f1), speed=1.0)
    robot.pose(rig, frame, {"Head": (x, y, z), ...})

Run ./fetch_assets.sh first. Faces -Y, feet at z=0, 1.94 m tall.
"""
import bpy
import math
import os
from mathutils import Vector, Euler
import common as C

BLEND = os.path.join(C.ROOT, "assets", "secbot", "security_bot_release_v1.blend")
RIG = "RIG-security_bot"
PROPS = "Properties_Character_SecBot"


def build(coll=None, eye=(0.15, 0.85, 1.0), eye_strength=1.0, gun=False):
    if not os.path.exists(BLEND):
        raise FileNotFoundError(f"{BLEND} missing: run ./fetch_assets.sh")
    with bpy.data.libraries.load(BLEND, link=False) as (src, dst):
        dst.collections = ["CH-security_bot"]
        dst.actions = ["Gun Mode", "Default Mode"]
    ch = dst.collections[0]
    (coll or bpy.context.scene.collection).children.link(ch)
    bpy.context.view_layer.update()  # builds the appended rig's pose
    rig = bpy.data.objects[RIG]
    objs = [o for c in [ch] + list(ch.children_recursive) for o in c.objects]
    # hide the asset's own camera / light rigs
    for ob in objs:
        if ob.type in ("CAMERA", "LIGHT") or ob.name.startswith(("WGT", "LGT")):
            ob.hide_render = True
            ob.hide_viewport = True
    for c in ch.children_recursive:
        if c.name.startswith(("cameras", "lighting", "lights")):
            c.hide_render = True
            c.hide_viewport = True
    # retint the eye/mouth emitters toward the film's teal
    for mn in ("robot_emit",):
        m = bpy.data.materials.get(mn)
        if not m:
            continue
        for nd in m.node_tree.nodes:
            if nd.type == "BSDF_PRINCIPLED" and "Emission Color" in nd.inputs:
                nd.inputs["Emission Color"].default_value = (*eye, 1)
    # the rig's switches drive collection contents, so set them last
    pb = rig.pose.bones[PROPS]
    pb["Paint Splash"] = 0
    pb["Paint Wipe"] = 0
    pb["Quality"] = 2  # render detail
    pb["Eye Light"] = eye_strength
    rig.update_tag()
    bpy.context.view_layer.update()
    if gun:
        apply_action(rig, "Gun Mode")
    parts = {"collection": ch, "props": pb}
    return rig, parts


def apply_action(rig, name, frame=None):
    """Bake a pose from one of the asset's pose actions into the current pose."""
    a = bpy.data.actions[name]
    f = frame if frame is not None else a.frame_range[0]
    for fc in C.fcurves(a):
        try:
            holder, attr = fc.data_path.rsplit(".", 1)
            tgt = rig.path_resolve(holder)
            v = fc.evaluate(f)
            cur = getattr(tgt, attr)
            if hasattr(cur, "__len__"):
                cur[fc.array_index] = v
            else:
                setattr(tgt, attr, v)
        except Exception:
            pass


def key_pose(rig, frame, bones):
    for bn in bones:
        pb = rig.pose.bones[bn]
        pb.keyframe_insert("location", frame=frame)
        if pb.rotation_mode == "QUATERNION":
            pb.keyframe_insert("rotation_quaternion", frame=frame)
        else:
            pb.keyframe_insert("rotation_euler", frame=frame)


def pose(rig, frame, rots=None, locs=None):
    """rots/locs: {bone: (x, y, z)} applied and keyed at frame."""
    for bn, r in (rots or {}).items():
        pb = rig.pose.bones[bn]
        pb.rotation_euler = r
        pb.keyframe_insert("rotation_euler", frame=frame)
    for bn, l in (locs or {}).items():
        pb = rig.pose.bones[bn]
        pb.location = l
        pb.keyframe_insert("location", frame=frame)


def world_offset(rig, bone, d):
    """Pose-space location for a world-space offset d (rig unrotated)."""
    return rig.data.bones[bone].matrix_local.to_3x3().inverted() @ Vector(d)


def walk(rig, frames, speed=1.0, stride=0.62, heavy=1.0, start=Vector((0, 0, 0)), heading=0.0, ground=None):
    """Heavy, deliberate walk. The rig object travels forward (-Y in its own
    space, rotated by `heading` about Z); IK feet plant and lift; hips sink
    and sway over the planted foot; IK wrists swing. Offsets are authored in
    world terms and converted into each bone's rest space."""
    f0, f1 = frames
    cycle = 2 * stride / speed * C.FPS  # frames per full cycle (two steps)
    fwd = Vector((math.sin(heading), -math.cos(heading), 0))
    rig.rotation_euler = (0, 0, heading)
    for f in range(f0 - 2, f1 + 3):
        t = (f - f0) / C.FPS
        ph = 2 * math.pi * (f - f0) / cycle
        rig.location = start + fwd * speed * t
        if ground:
            rig.location.z = ground(rig.location)
        rig.keyframe_insert("location", frame=f)
        locs, rots = {}, {}
        for side, p, sx in (("L", ph, 1), ("R", ph + math.pi, -1)):
            s = math.sin(p)
            lift = max(0.0, math.cos(p)) ** 1.5  # airborne during the forward swing
            locs[f"IK-Foot.{side}"] = (sx * 0.05 * heavy, stride / 2 * s, 0.09 * lift * heavy)
            rots[f"IK-Foot.{side}"] = (0.3 * lift * (1 if math.sin(p + 0.6) < 0 else -0.5), 0, 0)
            # arms swing opposite the legs, slightly out from the bulk
            locs[f"IK-Wrist.{side}"] = (sx * 0.06, -0.16 * s, 0.02 + 0.03 * max(0, -s))
        bob = 0.035 * heavy * math.cos(2 * ph)
        locs["Torso"] = (0.035 * math.sin(ph), -0.04, -0.08 * heavy + bob)  # sunk, weight forward
        rots["Torso"] = (0.12, 0.05 * math.sin(ph), 0.07 * math.sin(ph))
        rots["Chest"] = (0.06, -0.04 * math.sin(ph), -0.1 * math.sin(ph))
        rots["Head"] = (-0.1, 0.0, 0.05 * math.sin(ph))  # chin up a touch: the visor glares ahead
        for bn, r in rots.items():
            pb = rig.pose.bones[bn]
            pb.rotation_euler = r
            pb.keyframe_insert("rotation_euler", frame=f)
        for bn, d in locs.items():
            pb = rig.pose.bones[bn]
            pb.location = world_offset(rig, bn, d)
            pb.keyframe_insert("location", frame=f)


def bone_parent(ob, rig, bone):
    """Parent ob to a pose bone, keeping its current world transform."""
    from mathutils import Matrix
    bpy.context.view_layer.update()
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = bone
    b = rig.data.bones[bone]
    ob.matrix_parent_inverse = (rig.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))).inverted()
    ob.matrix_world = mw
    return ob


def gauntlet(rig, coll=None):
    """A capacitor drum strapped to the right forearm: brass sleeve, six teal
    cells, a glowing muzzle ring. Returns (objects, cell_strength_socket)."""
    b = rig.data.bones["ROBO-Forearm.R"]
    h, t = Vector(b.head_local), Vector(b.tail_local)
    axis = (t - h).normalized()
    q = axis.to_track_quat("Z", "Y").to_euler()
    mid = h.lerp(t, 0.55)
    brass = C.painted("g_brass", (0.42, 0.22, 0.08), dark=(0.15, 0.07, 0.03), light=(0.75, 0.5, 0.22),
                      rough=0.3, metal=1.0, edge=(1.0, 0.8, 0.5), edge_w=0.006, stroke=12, fog=0.3)
    enamel = C.painted("g_enamel", (0.32, 0.03, 0.035), dark=(0.11, 0.01, 0.015), light=(0.5, 0.08, 0.06),
                       rough=0.4, metal=0.3, edge=(1.0, 0.55, 0.4), edge_w=0.008, stroke=8, fog=0.3)
    cell = C.emissive("g_cell", (0.1, 0.75, 1.0), 2.0)
    obs = []

    def put(ob, off=0.0, radial=None):
        ob.location = mid + axis * off + (radial if radial is not None else Vector())
        ob.rotation_euler = q
        bone_parent(ob, rig, "ROBO-Forearm.R")
        obs.append(ob)
        return ob
    put(C.cylinder("g_sleeve", 0.075, 0.2, r2=0.068, mat=brass, coll=coll, verts=24, bevel=0.004))
    put(C.cylinder("g_drum", 0.095, 0.09, mat=enamel, coll=coll, verts=32, bevel=0.006), -0.02)
    side = axis.orthogonal().normalized()
    up = axis.cross(side).normalized()
    for k in range(6):
        a = k * math.pi / 3
        r = (side * math.cos(a) + up * math.sin(a)) * 0.096
        put(C.sphere(f"g_cell{k}", 0.018, mat=cell, coll=coll, segs=12, rings=6), -0.02, r)
    put(C.torus("g_muzzle", 0.05, 0.008, mat=cell, coll=coll, major=32, minor=6), 0.13)
    for ob in obs:
        ob.visible_shadow = False
    return obs, cell.node_tree.nodes["Emission"].inputs["Strength"]
