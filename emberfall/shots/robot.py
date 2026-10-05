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
