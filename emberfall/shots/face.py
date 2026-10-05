"""The courier's face: painted skin, eyes, lashes, teeth and expression
shape keys, all derived from landmarks measured on the base mesh.

Landmarks (base-mesh local space, she faces -Y, her left is +X):
  eyes (+-0.047, -0.08, 1.463) r 0.0385, brow ridge z 1.497,
  nose tip (0, -0.164, 1.414), mouth line z 1.396, chin z 1.335.
"""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix
import common as C

EYE_Z = 1.463
EYES = {1: Vector((0.047, -0.08, EYE_Z)), -1: Vector((-0.047, -0.08, EYE_Z))}
EYE_R = 0.0385
NOSE = Vector((0, -0.164, 1.414))
MOUTH_Z = 1.3786  # the lip seam
MOUTH = Vector((0, -0.15, MOUTH_Z))
BROW_Z = 1.487
JAW_PIVOT = Vector((0, 0.01, 1.425))


def _g(d, s):
    return math.exp(-(d / s) ** 2)


def _smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def brow_line(ax):
    """Brow centre height for |x| = ax (inner brow low, arched peak, tapering tail)."""
    return BROW_Z - 0.004 + 0.011 * math.sin(min(1.0, max(0.0, (ax - 0.012) / 0.08)) * math.pi * 0.85)


class _N:
    """Tiny expression builder for shader math: floats or sockets in, sockets out."""
    def __init__(self, nt):
        self.n, self.l = nt.nodes, nt.links

    def _in(self, sock, v):
        if isinstance(v, (int, float)):
            sock.default_value = v
        else:
            self.l.new(v, sock)

    def m(self, op, a, b=0.0, clamp=False):
        nd = self.n.new("ShaderNodeMath"); nd.operation = op; nd.use_clamp = clamp
        self._in(nd.inputs[0], a); self._in(nd.inputs[1], b)
        return nd.outputs[0]

    def smooth(self, e0, e1, x):
        nd = self.n.new("ShaderNodeMapRange"); nd.interpolation_type = "SMOOTHSTEP"
        nd.inputs["From Min"].default_value = e0; nd.inputs["From Max"].default_value = e1
        self._in(nd.inputs["Value"], x)
        return nd.outputs["Result"]

    def gauss(self, d, sigma):
        q = self.m("DIVIDE", d, sigma)
        return self.m("EXPONENT", self.m("MULTIPLY", self.m("MULTIPLY", q, q), -1.0))

    def length3(self, x, y, z):
        return self.m("SQRT", self.m("ADD", self.m("ADD", self.m("MULTIPLY", x, x), self.m("MULTIPLY", y, y)), self.m("MULTIPLY", z, z)))

    def mixc(self, fac, a, b):
        nd = self.n.new("ShaderNodeMix"); nd.data_type = "RGBA"; nd.clamp_factor = True
        self._in(nd.inputs[0], fac)
        for sock, v in ((nd.inputs[6], a), (nd.inputs[7], b)):
            if isinstance(v, (tuple, list, Vector)):
                sock.default_value = (*tuple(v)[:3], 1)
            else:
                self.l.new(v, sock)
        return nd.outputs[2]


def features(nt, P, base):
    """Paint brows, liner, lips and the cheek mark over `base` colour, from
    rest-pose local position P (vector socket)."""
    N = _N(nt)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(P, sep.inputs[0])
    px, py, pz = sep.outputs["X"], sep.outputs["Y"], sep.outputs["Z"]
    ax = N.m("ABSOLUTE", px)
    front = N.smooth(-0.07, -0.1, py)
    col = base
    # lips: crisp ellipse around the seam, fuller lower lip, upper lip a touch darker
    above = N.m("GREATER_THAN", pz, MOUTH_Z)
    rz = N.m("ADD", 0.0115, N.m("MULTIPLY", above, -0.0035))
    lx = N.m("DIVIDE", ax, 0.0235)
    lz = N.m("DIVIDE", N.m("SUBTRACT", pz, MOUTH_Z - 0.0005), rz)
    r = N.m("SQRT", N.m("ADD", N.m("MULTIPLY", lx, lx), N.m("MULTIPLY", lz, lz)))
    lip = N.m("MULTIPLY", N.smooth(1.05, 0.8, r), N.smooth(-0.125, -0.14, py))
    lipcol = N.mixc(above, LIP, LIP * 0.8)
    col = N.mixc(N.m("MULTIPLY", lip, 0.9), col, lipcol)
    # brows: arched band with hair-stroke breakup
    t = N.m("DIVIDE", N.m("SUBTRACT", ax, 0.012), 0.08, clamp=True)
    bz = N.m("ADD", BROW_Z - 0.004, N.m("MULTIPLY", N.m("SINE", N.m("MULTIPLY", t, math.pi * 0.85)), 0.011))
    thick = N.m("MULTIPLY", 0.0072, N.m("SUBTRACT", 1.0, N.m("MULTIPLY", N.smooth(0.02, 0.095, ax), 0.55)))
    bm_ = N.gauss(N.m("SUBTRACT", pz, bz), thick)
    bm_ = N.m("MULTIPLY", bm_, N.m("MULTIPLY", N.smooth(0.006, 0.016, ax), N.smooth(0.1, 0.085, ax)))
    bm_ = N.m("MULTIPLY", bm_, N.m("LESS_THAN", py, -0.08))
    strokes = nt.nodes.new("ShaderNodeTexNoise"); strokes.inputs["Scale"].default_value = 1.0; strokes.inputs["Detail"].default_value = 2
    sv = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(N.m("MULTIPLY", px, 260.0), sv.inputs["X"]); nt.links.new(N.m("MULTIPLY", pz, 60.0), sv.inputs["Y"])
    nt.links.new(sv.outputs[0], strokes.inputs["Vector"])
    bm_ = N.m("MULTIPLY", bm_, N.m("ADD", 0.55, N.m("MULTIPLY", strokes.outputs["Fac"], 0.9)), clamp=True)
    col = N.mixc(bm_, col, BROW)
    # liner: heavy upper lash line, softer lower, flicked wing at the outer corner
    c = EYES[1]
    d = N.length3(N.m("SUBTRACT", ax, c.x), N.m("SUBTRACT", py, c.y), N.m("SUBTRACT", pz, c.z))
    rim = N.m("MULTIPLY", N.gauss(N.m("SUBTRACT", d, EYE_R + 0.0022), 0.0022), front)
    up = N.smooth(c.z - 0.008, c.z + 0.004, pz)
    liner = N.m("MULTIPLY", rim, N.m("ADD", 0.3, N.m("MULTIPLY", up, 0.7)), clamp=True)
    wd = N.length3(N.m("SUBTRACT", ax, c.x + 0.036), N.m("SUBTRACT", py, -0.1), N.m("SUBTRACT", pz, c.z + 0.007))
    liner = N.m("MAXIMUM", liner, N.m("MULTIPLY", N.gauss(wd, 0.004), 0.85))
    col = N.mixc(liner, col, LINER)
    # mark: three ember dots under her left eye
    mk = 0.0
    for q in ((0.071, -0.118, 1.428), (0.079, -0.112, 1.421), (0.087, -0.104, 1.414)):
        dd = N.length3(N.m("SUBTRACT", px, q[0]), N.m("SUBTRACT", py, q[1]), N.m("SUBTRACT", pz, q[2]))
        mk = N.m("MAXIMUM", mk, N.smooth(0.0026, 0.0018, dd)) if not isinstance(mk, float) else N.smooth(0.0026, 0.0018, dd)
    col = N.mixc(mk, col, MARK)
    return col


# ------------------------------------------------------------------ paint

SKIN = Vector((0.37, 0.17, 0.155))
SKIN_SHADE = Vector((0.23, 0.09, 0.1))
LIP = Vector((0.2, 0.06, 0.07))
LINER = Vector((0.035, 0.012, 0.014))
BROW = Vector((0.09, 0.018, 0.022))
BLUSH = Vector((0.42, 0.1, 0.09))
MARK = Vector((0.3, 0.03, 0.04))


def paint(body):
    """Per-vertex skin colour (RGB) + freckle mask (A) in attribute 'paint'."""
    me = body.data
    attr = me.color_attributes.new("paint", "FLOAT_COLOR", "POINT")
    marks = [Vector((0.071, -0.118, 1.428)), Vector((0.079, -0.112, 1.421)), Vector((0.087, -0.104, 1.414))]
    for i, v in enumerate(me.vertices):
        p = v.co
        col = SKIN.copy()
        front = _smooth(-0.06, -0.1, p.y)
        ax = abs(p.x)
        if p.z > 1.3:
            # eye sockets: cool, darker
            for c in EYES.values():
                d = (p - c).length
                col = col.lerp(SKIN_SHADE, 0.55 * _g(max(0, d - EYE_R), 0.012) * front)
            # blush across cheeks and nose bridge
            for sx in (1, -1):
                col = col.lerp(BLUSH, 0.3 * _g((p - Vector((sx * 0.058, -0.125, 1.42))).length, 0.022) * front)
            col = col.lerp(BLUSH, 0.25 * _g((p - Vector((0, -0.15, 1.44))).length, 0.016))
            col = col.lerp(BLUSH, 0.3 * _g((p - NOSE).length, 0.01))
            # mouth interior
            if ax < 0.024 and 1.364 < p.z < 1.39 and p.y > -0.131:
                col = Vector((0.07, 0.012, 0.015))
        freck = _g((p - Vector((0, -0.14, 1.43))).length, 0.05) * front if p.z > 1.3 else 0.0
        attr.data[i].color = (col.x, col.y, col.z, freck)
    return attr


def skin_material(tex_loc=(0, 0, 0.8), tex_size=(0.7, 0.2, 0.81)):
    m = bpy.data.materials.new("c_face")
    nt, n, l = C._nodes(m)
    out = n.new("ShaderNodeOutputMaterial")
    b = n.new("ShaderNodeBsdfPrincipled")
    b.inputs["Roughness"].default_value = 0.5
    b.inputs["Specular IOR Level"].default_value = 0.35
    b.inputs["Subsurface Weight"].default_value = 0.1
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.3, 0.2)
    b.inputs["Subsurface Scale"].default_value = 0.008
    at = n.new("ShaderNodeAttribute"); at.attribute_name = "paint"
    tc = n.new("ShaderNodeTexCoord")
    # painterly breakup: soft, large strokes that shift value +-8%
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 60; nz.inputs["Detail"].default_value = 3
    l.new(tc.outputs["Object"], nz.inputs["Vector"])
    mr = n.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = 0.9; mr.inputs["To Max"].default_value = 1.08
    l.new(nz.outputs["Fac"], mr.inputs["Value"])
    mul = n.new("ShaderNodeVectorMath"); mul.operation = "SCALE"
    l.new(at.outputs["Color"], mul.inputs[0]); l.new(mr.outputs["Result"], mul.inputs["Scale"])
    # freckles
    vor = n.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 420; vor.inputs["Randomness"].default_value = 1
    l.new(tc.outputs["Object"], vor.inputs["Vector"])
    dots = n.new("ShaderNodeMapRange"); dots.inputs["From Min"].default_value = 0.22; dots.inputs["From Max"].default_value = 0.12
    l.new(vor.outputs["Distance"], dots.inputs["Value"])
    sel = n.new("ShaderNodeMath"); sel.operation = "GREATER_THAN"; sel.inputs[1].default_value = 0.55
    l.new(vor.outputs["Color"], sel.inputs[0])
    fm = n.new("ShaderNodeMath"); fm.operation = "MULTIPLY"
    l.new(dots.outputs["Result"], fm.inputs[0]); l.new(sel.outputs[0], fm.inputs[1])
    fm2 = n.new("ShaderNodeMath"); fm2.operation = "MULTIPLY"; fm2.use_clamp = True
    l.new(fm.outputs[0], fm2.inputs[0]); l.new(at.outputs["Alpha"], fm2.inputs[1])
    fm3 = n.new("ShaderNodeMath"); fm3.operation = "MULTIPLY"; fm3.inputs[1].default_value = 0.45
    l.new(fm2.outputs[0], fm3.inputs[0])
    mix = n.new("ShaderNodeMix"); mix.data_type = "RGBA"
    l.new(fm3.outputs[0], mix.inputs[0]); l.new(mul.outputs[0], mix.inputs[6])
    mix.inputs[7].default_value = (0.22, 0.07, 0.05, 1)
    # rest-pose position from Generated coords (the mesh's texture space)
    P = n.new("ShaderNodeVectorMath"); P.operation = "MULTIPLY_ADD"
    l.new(tc.outputs["Generated"], P.inputs[0])
    P.inputs[1].default_value = tuple(2 * v for v in tex_size)
    P.inputs[2].default_value = tuple(lc - sz for lc, sz in zip(tex_loc, tex_size))
    l.new(features(nt, P.outputs[0], mix.outputs[2]), b.inputs["Base Color"])
    bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.04
    l.new(nz.outputs["Fac"], bp.inputs["Height"]); l.new(bp.outputs["Normal"], b.inputs["Normal"])
    fg = n.new("ShaderNodeGroup"); fg.node_tree = C.fog_group(); fg.inputs["Amount"].default_value = 0.4
    l.new(b.outputs[0], fg.inputs["Shader"]); l.new(fg.outputs[0], out.inputs["Surface"])
    return m


# ------------------------------------------------------------------- eyes

def eye_material(name="c_eye"):
    """Sclera, teal iris with gold collarette and fibres, adjustable pupil,
    a painted catchlight, glossy cornea. Returns (mat, pupil_socket, glow_socket)."""
    m = bpy.data.materials.new(name)
    nt, n, l = C._nodes(m)
    out = n.new("ShaderNodeOutputMaterial")
    b = n.new("ShaderNodeBsdfPrincipled")
    b.inputs["Roughness"].default_value = 0.35
    b.inputs["Coat Weight"].default_value = 1.0
    b.inputs["Coat Roughness"].default_value = 0.02
    tc = n.new("ShaderNodeTexCoord")
    nrm = n.new("ShaderNodeVectorMath"); nrm.operation = "NORMALIZE"
    l.new(tc.outputs["Object"], nrm.inputs[0])
    cosv = n.new("ShaderNodeVectorMath"); cosv.operation = "DOT_PRODUCT"; cosv.inputs[1].default_value = (0, -1, 0)
    l.new(nrm.outputs[0], cosv.inputs[0])
    c = cosv.outputs["Value"]
    pupil = n.new("ShaderNodeValue"); pupil.outputs[0].default_value = 0.2; pupil.label = "pupil"
    # pupil threshold: 1 - 0.06 * pupil
    pth = n.new("ShaderNodeMath"); pth.operation = "MULTIPLY_ADD"; pth.inputs[1].default_value = -0.06; pth.inputs[2].default_value = 1.0
    l.new(pupil.outputs[0], pth.inputs[0])
    pm = n.new("ShaderNodeMath"); pm.operation = "SUBTRACT"
    l.new(c, pm.inputs[0]); l.new(pth.outputs[0], pm.inputs[1])
    pmask = n.new("ShaderNodeMapRange"); pmask.inputs["From Min"].default_value = -0.002; pmask.inputs["From Max"].default_value = 0.003
    l.new(pm.outputs[0], pmask.inputs["Value"])
    imask = n.new("ShaderNodeMapRange"); imask.inputs["From Min"].default_value = 0.912; imask.inputs["From Max"].default_value = 0.92
    l.new(c, imask.inputs["Value"])
    ring = n.new("ShaderNodeMapRange"); ring.inputs["From Min"].default_value = 0.81; ring.inputs["From Max"].default_value = 0.84
    l.new(c, ring.inputs["Value"])
    # iris colour: gold collarette near the pupil -> teal -> dark limbal ring
    ir = n.new("ShaderNodeValToRGB"); cr = ir.color_ramp
    cr.elements[0].position = 0.915; cr.elements[0].color = (0.005, 0.03, 0.035, 1)
    cr.elements[1].position = 0.988; cr.elements[1].color = (0.4, 0.26, 0.06, 1)
    e = cr.elements.new(0.935); e.color = (0.015, 0.2, 0.2, 1)
    e = cr.elements.new(0.97); e.color = (0.06, 0.36, 0.32, 1)
    l.new(c, ir.inputs["Fac"])
    # radial fibres
    fib = n.new("ShaderNodeTexNoise"); fib.inputs["Scale"].default_value = 30; fib.inputs["Detail"].default_value = 4
    sx = n.new("ShaderNodeSeparateXYZ"); l.new(nrm.outputs[0], sx.inputs[0])
    cmb = n.new("ShaderNodeCombineXYZ")
    at2 = n.new("ShaderNodeMath"); at2.operation = "ARCTAN2"
    l.new(sx.outputs["X"], at2.inputs[0]); l.new(sx.outputs["Z"], at2.inputs[1])
    l.new(at2.outputs[0], cmb.inputs["X"]); l.new(c, cmb.inputs["Y"])
    sc = n.new("ShaderNodeVectorMath"); sc.operation = "MULTIPLY"; sc.inputs[1].default_value = (1.0, 8.0, 1.0)
    l.new(cmb.outputs[0], sc.inputs[0]); l.new(sc.outputs[0], fib.inputs["Vector"])
    fmr = n.new("ShaderNodeMapRange"); fmr.inputs["To Min"].default_value = 0.6; fmr.inputs["To Max"].default_value = 1.35
    l.new(fib.outputs["Fac"], fmr.inputs["Value"])
    irf = n.new("ShaderNodeVectorMath"); irf.operation = "SCALE"
    l.new(ir.outputs["Color"], irf.inputs[0]); l.new(fmr.outputs["Result"], irf.inputs["Scale"])
    # sclera, warmer toward the corners
    scl = n.new("ShaderNodeValToRGB")
    scl.color_ramp.elements[0].position = 0.2; scl.color_ramp.elements[0].color = (0.55, 0.32, 0.3, 1)
    scl.color_ramp.elements[1].position = 0.7; scl.color_ramp.elements[1].color = (0.82, 0.76, 0.72, 1)
    l.new(c, scl.inputs["Fac"])
    m1 = n.new("ShaderNodeMix"); m1.data_type = "RGBA"
    l.new(imask.outputs["Result"], m1.inputs[0]); l.new(scl.outputs["Color"], m1.inputs[6]); l.new(irf.outputs[0], m1.inputs[7])
    m2 = n.new("ShaderNodeMix"); m2.data_type = "RGBA"
    l.new(pmask.outputs["Result"], m2.inputs[0]); l.new(m1.outputs[2], m2.inputs[6]); m2.inputs[7].default_value = (0.005, 0.005, 0.006, 1)
    l.new(m2.outputs[2], b.inputs["Base Color"])
    # iris glow (keyable) + painted catchlight
    glow = n.new("ShaderNodeValue"); glow.outputs[0].default_value = 0.0; glow.label = "glow"
    gm = n.new("ShaderNodeMath"); gm.operation = "MULTIPLY"
    l.new(imask.outputs["Result"], gm.inputs[0]); l.new(glow.outputs[0], gm.inputs[1])
    gm2 = n.new("ShaderNodeMath"); gm2.operation = "MULTIPLY"
    inv = n.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1
    l.new(pmask.outputs["Result"], inv.inputs[1])
    l.new(gm.outputs[0], gm2.inputs[0]); l.new(inv.outputs[0], gm2.inputs[1])
    cl = n.new("ShaderNodeVectorMath"); cl.operation = "DOT_PRODUCT"
    cl.inputs[1].default_value = Vector((-0.35, -0.88, 0.32)).normalized()
    l.new(nrm.outputs[0], cl.inputs[0])
    clm = n.new("ShaderNodeMapRange"); clm.inputs["From Min"].default_value = 0.9965; clm.inputs["From Max"].default_value = 0.998
    clm.inputs["To Max"].default_value = 6.0
    l.new(cl.outputs["Value"], clm.inputs["Value"])
    emc = n.new("ShaderNodeMix"); emc.data_type = "RGBA"; emc.inputs[6].default_value = (0.15, 0.85, 0.8, 1)
    emc.inputs[7].default_value = (1, 1, 1, 1)
    l.new(clm.outputs["Result"], emc.inputs[0])
    est = n.new("ShaderNodeMath"); est.operation = "ADD"
    l.new(gm2.outputs[0], est.inputs[0]); l.new(clm.outputs["Result"], est.inputs[1])
    l.new(emc.outputs[2], b.inputs["Emission Color"]); l.new(est.outputs[0], b.inputs["Emission Strength"])
    l.new(b.outputs[0], out.inputs["Surface"])
    return m, pupil.outputs[0], glow.outputs[0]


def lashes(coll, mat):
    """Upper lash ribbons along each lid edge, longest at the outer corner."""
    obs = []
    for sx, c in EYES.items():
        bm = bmesh.new()
        R = EYE_R + 0.0035
        prev = None
        N = 16
        for i in range(N + 1):
            s = -1 + 2 * i / N  # -1 inner corner .. +1 outer corner
            dx = sx * (0.002 + 0.031 * s)
            dz = 0.0125 * (1 - s * s) + 0.004 * max(0, s) + 0.0005
            dy = -math.sqrt(max(1e-6, R * R - dx * dx - dz * dz))
            base = c + Vector((dx, dy, dz))
            nrm = (base - c).normalized()
            L = 0.0025 + 0.0045 * (0.5 + 0.5 * s)
            tip = base + (nrm * 0.6 + Vector((sx * 0.25 * max(0, s), -0.25, 0.75))).normalized() * L
            v0 = bm.verts.new(base); v1 = bm.verts.new(tip)
            if prev:
                bm.faces.new((prev[0], v0, v1, prev[1]))
            prev = (v0, v1)
        ob = C.mesh_obj(f"lash{sx}", bm, mat, coll)
        so = ob.modifiers.new("thick", "SOLIDIFY"); so.thickness = 0.0007
        obs.append(ob)
    return obs


def teeth(coll, mat):
    """Upper and lower tooth rows tucked behind the lips; the lower row rides
    a jaw pivot so it follows the 'open' shape key."""
    def row(name, z, y, w, h, down):
        bm = bmesh.new()
        prev = None
        for i in range(13):
            a = math.radians(-60 + 120 * i / 12)
            x = math.sin(a) * w
            yy = y + (1 - math.cos(a)) * 0.022
            v0 = bm.verts.new((x, yy, z)); v1 = bm.verts.new((x, yy, z - h if down else z + h))
            if prev:
                bm.faces.new((prev[0], v0, v1, prev[1]))
            prev = (v0, v1)
        ob = C.mesh_obj(name, bm, mat, coll, smooth=True)
        s = ob.modifiers.new("thick", "SOLIDIFY"); s.thickness = 0.003
        return ob
    up = row("teeth_upper", MOUTH_Z + 0.0045, -0.1355, 0.018, 0.0075, True)
    jaw = C.empty("jaw_pivot", tuple(JAW_PIVOT), coll=coll)
    lo = row("teeth_lower", MOUTH_Z - 0.005, -0.1325, 0.016, 0.006, False)
    lo.parent = jaw
    lo.matrix_parent_inverse = Matrix.Translation(-JAW_PIVOT)
    return up, jaw, lo


# ------------------------------------------------------------- expression

JAW_OPEN = 0.13  # radians at shape value 1


def expression_keys(body):
    """Shape keys: worry (brows knit and lift inside), wide (upper lids up),
    open (jaw drops around a pivot), snarl (upper lip lifts)."""
    if not body.data.shape_keys:
        body.shape_key_add(name="Basis")
    keys = {}
    for nm in ("worry", "wide", "open", "snarl", "lids"):
        keys[nm] = body.shape_key_add(name=nm, from_mix=False)
    basis = body.data.shape_keys.key_blocks["Basis"]
    rot = Matrix.Rotation(JAW_OPEN, 3, "X")
    for i, bv in enumerate(basis.data):
        p = bv.co.copy()
        if p.z < 1.28 or p.y > 0.04:
            continue
        ax = abs(p.x)
        front = _smooth(-0.07, -0.11, p.y)
        # worry: inner brows up + toward centre, outer brows slightly down
        bw = _g(p.z - (BROW_Z + 0.002), 0.016) * front * _smooth(0.11, 0.08, ax)
        inner = _g(ax - 0.022, 0.022)
        outer = _g(ax - 0.085, 0.02)
        keys["worry"].data[i].co = p + Vector((-math.copysign(0.0016, p.x) * inner, 0, 0.0045 * inner - 0.0018 * outer)) * bw
        # wide eyes: upper-lid ring lifts
        for c in EYES.values():
            d = (p - c).length
            if p.z > c.z - 0.004 and d < EYE_R + 0.016:
                w = _g(d - (EYE_R + 0.004), 0.007) * _smooth(c.z - 0.004, c.z + 0.01, p.z) * front
                keys["wide"].data[i].co = p + Vector((0, -0.0006, 0.0028)) * w
        # heavy lids: lid skin rotates around the eyeball (upper down ~18deg, lower up ~6deg)
        for c in EYES.values():
            d = (p - c).length
            if d < EYE_R + 0.02 and front > 0:
                w = _g(max(0.0, d - (EYE_R + 0.002)), 0.008) * front
                if p.z > c.z:
                    ang = 0.32 * w * _smooth(c.z - 0.002, c.z + 0.008, p.z)
                else:
                    ang = -0.1 * w * _smooth(c.z + 0.002, c.z - 0.008, p.z)
                if abs(ang) > 1e-5:
                    keys["lids"].data[i].co = c + Matrix.Rotation(ang, 3, "X") @ (p - c)
        # jaw open: everything under the mouth line rotates about the pivot
        inside = _smooth(0.03, 0.022, ax)  # 1 between the mouth corners
        vert = (1.0 if p.z < MOUTH_Z else 0.0) * inside + _smooth(MOUTH_Z + 0.004, MOUTH_Z - 0.012, p.z) * (1 - inside)
        wj = vert * _smooth(0.095, 0.055, ax) * _smooth(0.03, -0.02, p.y)
        if wj > 0:
            q = JAW_PIVOT + rot @ (p - JAW_PIVOT)
            keys["open"].data[i].co = p.lerp(q, wj)
        # snarl: upper lip lifts at the centre, corners pull back
        ws = _g(p.z - (MOUTH_Z + 0.005), 0.006) * _g(ax - 0.008, 0.02) * _smooth(-0.12, -0.14, p.y) * (1.0 if p.z > MOUTH_Z else 0.0)
        # ...and the mouth corners pull out and back so the open mouth reads wide, not round
        wc = _g((Vector((ax, p.y, p.z)) - Vector((0.024, -0.135, MOUTH_Z))).length, 0.012)
        keys["snarl"].data[i].co = p + Vector((0, 0.0012, 0.0042)) * ws + Vector((math.copysign(0.0032, p.x), 0.003, 0.001)) * wc
    for k in keys.values():
        k.value = 0.0
    return keys


def set_expression(body, jaw, frame, worry=0.0, wide=0.0, open_=0.0, snarl=0.0, lids=0.75):
    kb = body.data.shape_keys.key_blocks
    for nm, v in (("worry", worry), ("wide", wide), ("open", open_), ("snarl", snarl), ("lids", lids)):
        kb[nm].value = v
        kb[nm].keyframe_insert("value", frame=frame)
    if jaw is not None:
        jaw.rotation_euler = (JAW_OPEN * open_, 0, 0)
        jaw.keyframe_insert("rotation_euler", frame=frame)


def sculpt(body):
    """Reshape the stylised base face toward a leaner, older one: slimmer
    cheeks, a V-shaped jaw, a longer chin and a stronger nose bridge."""
    bm = bmesh.new(); bm.from_mesh(body.data)
    for v in bm.verts:
        p = v.co
        if p.z < 1.28 or p.z > 1.56 or p.y > 0.06:
            continue
        ax = abs(p.x); sx = 1 if p.x >= 0 else -1
        front = _smooth(-0.02, -0.09, p.y)
        # cheeks: pull in and back under the cheekbone
        ck = _g(p.z - 1.405, 0.03) * _smooth(0.035, 0.07, ax) * front
        p.x -= sx * 0.006 * ck
        p.y += 0.003 * ck
        # jaw: narrow toward the chin
        jw = _smooth(1.41, 1.34, p.z) * _smooth(0.02, 0.07, ax) * _smooth(0.05, -0.06, p.y)
        p.x -= sx * 0.008 * jw
        # chin: longer and a touch forward
        ch = _smooth(MOUTH_Z - 0.01, 1.335, p.z) * _smooth(0.045, 0.0, ax) * _smooth(0.02, -0.1, p.y)
        p.z -= 0.006 * ch
        p.y -= 0.003 * ch
        # nose bridge: forward between the eyes
        nb = _g(p.z - 1.45, 0.022) * _g(ax, 0.008) * _smooth(-0.11, -0.135, p.y)
        p.y -= 0.004 * nb
        # cheekbones: lifted and slightly out under the outer eye
        cb = _g((Vector((ax, p.y, p.z)) - Vector((0.072, -0.1, 1.43))).length, 0.016)
        p.x += sx * 0.002 * cb
        p.y -= 0.0015 * cb
        # lips: less pout; tuck back and flatten toward the seam
        lp = _g(p.z - MOUTH_Z, 0.009) * _smooth(0.03, 0.012, ax) * _smooth(-0.125, -0.145, p.y)
        p.y += 0.0028 * lp
        p.z += (MOUTH_Z - p.z) * 0.22 * lp
        # nose: narrower wings and tip
        nw = _g(p.z - 1.41, 0.01) * _g(ax - 0.016, 0.008) * _smooth(-0.11, -0.14, p.y)
        p.x -= sx * 0.0025 * nw
    bm.to_mesh(body.data); bm.free()
