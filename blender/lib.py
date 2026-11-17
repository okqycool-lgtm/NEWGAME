"""Shared helpers for the asset build scripts (Blender 5.2+, runs under the `bpy` module or `blender -b -P`).

Conventions
- 1 unit = 1 m, Z up. Every primitive bakes its location/rotation into the mesh, so objects sit at
  the world origin with identity transforms until `set_origin` gives a part its pivot.
- Model with many small flat materials (`mat`), then `palettize` collapses them into ONE material
  that samples a palette atlas (base colour / emissive / ORM). Three.js can't read shader nodes,
  and one material per asset is one draw call.
- `bake_ao` stores Cycles ambient occlusion in the corner colour attribute; glTF exports it as
  COLOR_0, which three.js multiplies into the base colour.
- Export goes through the blender-export-pipelines skill (`web` preset: GLB + meshopt + WebP) and
  QA through blender-asset-qa.
"""
import importlib
import math
import os
import sys

import bpy  # must come first: the bpy module provides bmesh/mathutils
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS = os.path.join(ROOT, "blender-skills", "skills")
OUT = os.path.join(ROOT, "public", "assets")
PREVIEW = os.environ.get("PREVIEW_DIR", os.path.join(ROOT, "blender", "preview"))
FONT_BOLD = "/usr/share/fonts/opentype/inter/Inter-BlackItalic.otf"
FONT_JP = "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"


def skill(name, module):
    """Import a script from blender-skills/skills/<name>/scripts."""
    p = os.path.join(SKILLS, name, "scripts")
    if p not in sys.path:
        sys.path.insert(0, p)
    return importlib.import_module(module)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATS.clear()


# ------------------------------------------------------------------ materials
_MATS = {}


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(hexcolor):
    return ((hexcolor >> 16) & 255) / 255, ((hexcolor >> 8) & 255) / 255, (hexcolor & 255) / 255


def mat(color, rough=0.6, metal=0.0, emit=0.0, name=None):
    """Flat Principled material. `color` is an sRGB hex int; `emit` > 0 makes it glow in that colour."""
    key = (color, round(rough, 3), round(metal, 3), round(emit, 3))
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(name or f"M_{color:06x}_{len(_MATS)}")
    if not m.node_tree:
        m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    r, g, bl = (_lin(c) for c in rgb(color))
    b.inputs["Base Color"].default_value = (r, g, bl, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit > 0:
        b.inputs["Emission Color"].default_value = (r, g, bl, 1)
        b.inputs["Emission Strength"].default_value = emit
    m["pal"] = [color, rough, metal, emit]
    _MATS[key] = m
    return m


# ------------------------------------------------------------------ mesh plumbing
def _xf(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1))


def _obj(name, bm, m=None, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if m:
        me.materials.append(m)
    if smooth:
        shade(ob)
    return ob


def shade(ob, angle=40):
    """Smooth shading with edges sharper than `angle` degrees kept hard."""
    me = ob.data
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.set_sharp_from_angle(angle=math.radians(angle))
    return ob


def box(name, sx, sy, sz, loc=(0, 0, 0), rot=(0, 0, 0), m=None, bevel=0.0, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=_xf(loc, rot, (sx, sy, sz)))
    ob = _obj(name, bm, m)
    if bevel:
        bevel_mod(ob, bevel, seg)
    return ob


def cyl(name, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), m=None, seg=16, r2=None, caps=True, bevel=0.0):
    """Cylinder/cone along local Z (r at the bottom, r2 at the top)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r,
                          radius2=r if r2 is None else r2, depth=depth, matrix=_xf(loc, rot))
    ob = _obj(name, bm, m)
    if bevel:
        bevel_mod(ob, bevel, 2)
    return ob


def sphere(name, r, loc=(0, 0, 0), m=None, seg=16, rings=10, scale=(1, 1, 1), rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r, matrix=_xf(loc, rot, scale))
    return _obj(name, bm, m)


def torus(name, R, r, loc=(0, 0, 0), rot=(0, 0, 0), m=None, seg=32, tseg=8):
    """Ring in the local XY plane."""
    rings = [[(math.cos(a) * (R + r * math.cos(b)), math.sin(a) * (R + r * math.cos(b)), r * math.sin(b))
              for b in (2 * math.pi * j / tseg for j in range(tseg))]
             for a in (2 * math.pi * i / seg for i in range(seg))]
    ob = loft(name, rings, m, cap=False, loop=True)
    ob.data.transform(_xf(loc, rot))
    return ob


def superellipse(w, h, n=16, p=4.0):
    """Closed outline of a rounded rectangle (p=2 ellipse, larger p = squarer). Returns [(u, v)]."""
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        out.append((0.5 * w * math.copysign(abs(c) ** (2 / p), c), 0.5 * h * math.copysign(abs(s) ** (2 / p), s)))
    return out


def ring(profile, at, axis="Z", offset=(0, 0)):
    """Place a 2D outline [(u, v)] in 3D at coordinate `at` along `axis` (u, v map to the other two axes in XYZ order)."""
    ou, ov = offset
    if axis == "Z":
        return [(u + ou, v + ov, at) for u, v in profile]
    if axis == "Y":
        return [(u + ou, at, v + ov) for u, v in profile]
    return [(at, u + ou, v + ov) for u, v in profile]


def loft(name, rings, m=None, cap=True, loop=False, smooth=True):
    """Skin a list of rings (equal point counts) into a tube; `cap` fills both ends, `loop` joins last to first."""
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in r] for r in rings]
    n = len(rings[0])
    pairs = list(zip(vs, vs[1:])) + ([(vs[-1], vs[0])] if loop else [])
    for a, b in pairs:
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap and not loop:
        bm.faces.new(list(reversed(vs[0])))
        bm.faces.new(vs[-1])
    return _obj(name, bm, m, smooth)


def prism(name, outline, width, m=None, axis="X", center=0.0, bevel=0.0):
    """Extrude a 2D outline [(u, v)] by `width` along `axis` (centred on `center`)."""
    a, b = center - width / 2, center + width / 2
    ob = loft(name, [ring(outline, a, axis), ring(outline, b, axis)], m, cap=True, smooth=True)
    if bevel:
        bevel_mod(ob, bevel, 2)
    return ob


def tube(name, points, r, m=None, seg=8, cyclic=False, fill=True):
    """Round pipe/cable along a polyline (smoothly interpolated when it has more than 2 points)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = max(0, seg // 4 - 1)
    cu.use_fill_caps = fill
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for p, co in zip(sp.points, points):
        p.co = (*co, 1)
    sp.use_cyclic_u = cyclic
    return _curve_to_mesh(name, cu, m)


def text(name, body, size=1.0, depth=0.05, m=None, loc=(0, 0, 0), rot=(math.pi / 2, 0, 0), font=FONT_BOLD,
         align="CENTER", bevel=0.0, spacing=1.0):
    """Extruded text. Default rotation stands it upright facing -Y (reads left to right along +X)."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = depth / 2
    cu.bevel_depth = bevel
    cu.bevel_resolution = 1
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.space_character = spacing
    cu.resolution_u = 3
    if font and os.path.exists(font):
        cu.font = bpy.data.fonts.load(font, check_existing=True)
    ob = _curve_to_mesh(name, cu, m)
    ob.data.transform(_xf(loc, rot))
    return ob


def _curve_to_mesh(name, cu, m):
    tmp = bpy.data.objects.new(name + "_cu", cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg), depsgraph=dg)
    me.name = name
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.clear()
    if m:
        me.materials.append(m)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    return shade(ob)


# ------------------------------------------------------------------ editing
def move(ob, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    ob.data.transform(_xf(loc, rot, scale))
    if scale[0] * scale[1] * scale[2] < 0:
        ob.data.flip_normals()
    return ob


def mirror_copy(ob, name=None, axis=0):
    """Duplicate mirrored across the world plane perpendicular to `axis` (0 = X)."""
    c = ob.copy()
    c.data = ob.data.copy()
    c.name = name or ob.name + "_R"
    bpy.context.scene.collection.objects.link(c)
    s = [1, 1, 1]
    s[axis] = -1
    c.data.transform(Matrix.Diagonal((*s, 1)))
    c.data.flip_normals()
    for md in ob.modifiers:
        n = c.modifiers.get(md.name)
        if n is None:
            continue
    return c


def copy(ob, name=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    c = ob.copy()
    c.data = ob.data.copy()
    c.name = name or ob.name + "_c"
    bpy.context.scene.collection.objects.link(c)
    c.data.transform(_xf(loc, rot))
    return c


def bevel_mod(ob, width, seg=2, angle=30):
    md = ob.modifiers.new("Bevel", "BEVEL")
    md.width = width
    md.segments = seg
    md.limit_method = "ANGLE"
    md.angle_limit = math.radians(angle)
    md.use_clamp_overlap = True
    md.harden_normals = True
    md.miter_outer = "MITER_ARC"
    wn = ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
    wn.mode = "FACE_AREA"
    wn.keep_sharp = True
    wn.weight = 50
    return ob


def subsurf(ob, levels=1):
    md = ob.modifiers.new("Subsurf", "SUBSURF")
    md.levels = md.render_levels = levels
    return ob


def solidify(ob, thickness, offset=-1):
    md = ob.modifiers.new("Solidify", "SOLIDIFY")
    md.thickness = thickness
    md.offset = offset
    return ob


def boolean(ob, cutter, op="DIFFERENCE", keep=False):
    md = ob.modifiers.new("Bool", "BOOLEAN")
    md.object = cutter
    md.operation = op
    md.solver = "EXACT"
    apply_mods(ob)
    if not keep:
        bpy.data.objects.remove(cutter)
    return ob


def apply_mods(ob):
    """Freeze the modifier stack into the mesh (keeps weighted normals)."""
    if not ob.modifiers:
        return ob
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    me.name = ob.name
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return ob


def join(objs, name):
    """Merge objects into one (modifiers applied first). The result keeps an identity transform."""
    objs = [o for o in objs if o is not None]
    for o in objs:
        apply_mods(o)
    bpy.context.view_layer.update()
    tgt = objs[0]
    if len(objs) > 1:
        with bpy.context.temp_override(active_object=tgt, object=tgt, selected_objects=objs, selected_editable_objects=objs):
            assert bpy.ops.object.join() == {"FINISHED"}
    tgt.name = name
    tgt.data.name = name
    return tgt


def set_origin(ob, point):
    """Move the object's pivot to a world-space point without moving the geometry."""
    p = Vector(point)
    delta = ob.matrix_world.inverted() @ p
    ob.data.transform(Matrix.Translation(-delta))
    ob.matrix_world.translation = p
    bpy.context.view_layer.update()
    return ob


def parent(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()
    return child


def empty(name, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    bpy.context.scene.collection.objects.link(e)
    bpy.context.view_layer.update()
    return e


def tris(objs):
    n = 0
    for o in objs:
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n


# ------------------------------------------------------------------ bake + palette
def bake_ao(objs, samples=24, distance=0.6, floor=0.28, gamma=1.0):
    """Bake ambient occlusion into each mesh's corner colours. All visible objects occlude each other."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new("World")
    sc.world.light_settings.distance = distance
    sc.render.bake.target = "VERTEX_COLORS"
    for ob in objs:
        apply_mods(ob)
        me = ob.data
        for ca in list(me.color_attributes):
            me.color_attributes.remove(ca)
        col = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        me.color_attributes.active_color = col
        me.color_attributes.render_color_index = 0
        for o in bpy.context.view_layer.objects:
            o.select_set(o == ob)
        bpy.context.view_layer.objects.active = ob
        assert bpy.ops.object.bake(type="AO") == {"FINISHED"}
        col = me.color_attributes["Col"]
        a = np.empty(len(col.data) * 4, dtype=np.float32)
        col.data.foreach_get("color", a)
        a = a.reshape(-1, 4)
        v = floor + (1 - floor) * np.clip(a[:, 0], 0, 1) ** gamma
        a[:, 0] = a[:, 1] = a[:, 2] = v
        a[:, 3] = 1
        col.data.foreach_set("color", a.ravel())
        me.update()


def lods(objs, ratio=0.4):
    """<name>_LOD1 copies from the blender-game-optimization skill's Decimate chain.
    Call after bake_ao (so the copies don't occlude the originals) and before palettize
    (collapse must not blend palette UVs). Returns the new objects."""
    ml = skill("blender-game-optimization", "make_lods")
    for o in objs:
        apply_mods(o)
    ml.run(objects=[o.name for o in objs], ratios=[ratio])
    out = []
    for o in objs:
        lod = bpy.data.objects[o.name + "_LOD1"]
        lod.hide_set(False)
        lod.hide_render = False
        shade(lod, 50)
        out.append(lod)
    return out


def palettize(objs, name, emit_strength=1.0, cell=8, grid=8):
    """Collapse every flat `mat` on these objects into one material sampling a shared palette atlas."""
    size = cell * grid
    base = np.zeros((size, size, 4), np.float32)
    emis = np.zeros((size, size, 4), np.float32)
    orm = np.zeros((size, size, 4), np.float32)
    base[..., 3] = emis[..., 3] = orm[..., 3] = 1
    orm[..., 0] = 1
    orm[..., 1] = 0.6
    cells = {}
    emax = max([m["pal"][3] for o in objs for m in o.data.materials if m and "pal" in m] + [1e-6])
    for ob in objs:
        apply_mods(ob)
        me = ob.data
        uv = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
        for extra in [l for l in me.uv_layers if l.name != "UVMap"]:
            me.uv_layers.remove(extra)
        uv = me.uv_layers["UVMap"]
        uv.active = True
        uv.active_render = True
        co = np.zeros((len(me.loops), 2), np.float32)
        for poly in me.polygons:
            m = me.materials[poly.material_index] if me.materials else None
            pal = tuple(m["pal"]) if m and "pal" in m else (0xff00ff, 0.6, 0.0, 0.0)
            if pal not in cells:
                i = len(cells)
                assert i < grid * grid, "palette full"
                cx, cy = i % grid, i // grid
                sl = (slice(cy * cell, (cy + 1) * cell), slice(cx * cell, (cx + 1) * cell))
                c = rgb(int(pal[0]))
                base[sl][..., :3] = c
                if pal[3] > 0:
                    k = pal[3] / emax
                    emis[sl][..., :3] = [min(1.0, v * k) if emax > 1 else v * k for v in c]
                orm[sl][..., 1] = pal[1]
                orm[sl][..., 2] = pal[2]
                cells[pal] = ((cx + 0.5) / grid, (cy + 0.5) / grid)
            co[poly.loop_start:poly.loop_start + poly.loop_total] = cells[pal]
        uv.data.foreach_set("uv", co.ravel())
    has_emit = any(p[3] > 0 for p in cells)

    def img(nm, arr, data=False):
        im = bpy.data.images.new(nm, size, size, alpha=False)
        if data:
            im.colorspace_settings.is_data = True
        im.pixels.foreach_set(arr.ravel())
        im.pack()
        return im

    m = bpy.data.materials.new("M_" + name)
    if not m.node_tree:
        m.use_nodes = True
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")

    def tex(image, x, y):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = image
        n.interpolation = "Closest"
        n.location = (x, y)
        return n

    tb = tex(img(f"T_{name}_BaseColor", base), -600, 300)
    nt.links.new(tb.outputs["Color"], b.inputs["Base Color"])
    to = tex(img(f"T_{name}_ORM", orm, True), -600, 0)
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    sep.location = (-300, 0)
    nt.links.new(to.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
    nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
    if has_emit:
        te = tex(img(f"T_{name}_Emissive", emis), -600, -300)
        nt.links.new(te.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit_strength * max(1.0, emax)
    for ob in objs:
        ob.data.materials.clear()
        ob.data.materials.append(m)
        ob.data.polygons.foreach_set("material_index", [0] * len(ob.data.polygons))
    return m


# ------------------------------------------------------------------ deliver
def qa(objs, **kw):
    r = skill("blender-asset-qa", "qa_check").run(objects=[o.name for o in objs], profile="game", **kw)
    return r


def check(objs, accept=("zero-area UV", "floating/detached", "back-to-back", "n-gons")):
    """QA summary with the findings this pipeline produces on purpose filtered out:
    zero-area UVs (palette atlas maps each face to one texel), floating decals/letters/lights,
    back-to-back faces where kitbashed parts touch, n-gons on flat hard-surface faces."""
    r = qa(objs)
    bad = [e for e in r.get("errors", []) + r.get("warnings", []) if not any(a in e for a in accept)]
    out = {"tris": tris(objs), "issues": bad, "zfighting": r.get("zfighting", [])[:8],
           "dims": {o.name: [round(v, 2) for v in o.dimensions] for o in objs}}
    print("QA", out)
    return out


def export(objs, filename, **kw):
    """GLB via the export skill's `web` preset; vertex colours (baked AO) always included."""
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, filename)
    ex = skill("blender-export-pipelines", "export_asset")
    # the bpy wheel ships without the meshopt bridge, and lossy WebP would smear palette cells
    opts = dict(export_vertex_color="ACTIVE", export_active_vertex_color_when_no_material=True, export_yup=True,
                export_image_format="AUTO", export_meshopt_compression_enable=False)
    opts.update(kw)
    r = ex.run(preset="web", objects=[o.name for o in objs], out=path, set=[f"{k}={v}" for k, v in opts.items()])
    return r


def preview(path, objs=None, views=((35, 12), (145, 12), (215, 25), (325, 40)), res=(560, 420), samples=20,
            dist=None, lens=50, ground=True, target=None):
    """Cycles contact sheet under a night neon rig. `views` are (azimuth deg from -Y, elevation deg)."""
    from PIL import Image
    sc = bpy.context.scene
    objs = objs or [o for o in sc.objects if o.type == "MESH"]
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    ctr = Vector(target) if target else (lo + hi) / 2
    rad = (hi - lo).length / 2
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.image_settings.file_format = "PNG"
    try:
        sc.view_settings.view_transform = "Standard"
    except TypeError:
        pass
    if sc.world is None:
        sc.world = bpy.data.worlds.new("World")
    wn = sc.world.node_tree if sc.world.node_tree else None
    if wn is None:
        sc.world.use_nodes = True
        wn = sc.world.node_tree
    bg = next(n for n in wn.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.05, 0.045, 0.11, 1)
    bg.inputs["Strength"].default_value = 1.0
    tmp = []

    def light(kind, loc, energy, color, size=1.0):
        d = bpy.data.lights.new("pv", kind)
        d.energy = energy
        d.color = color
        if kind == "AREA":
            d.size = size
        o = bpy.data.objects.new("pv", d)
        o.location = ctr + Vector(loc) * rad
        o.rotation_euler = (ctr - o.location).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(o)
        tmp.append(o)

    e = rad * rad * 60
    light("AREA", (-1.6, -2.2, 2.4), e * 2.2, (0.85, 0.9, 1.0), rad * 2)
    light("AREA", (-3.0, 1.0, 0.8), e * 1.5, (1.0, 0.25, 0.9), rad * 2)
    light("AREA", (3.0, 0.5, 0.8), e * 1.5, (0.25, 0.9, 1.0), rad * 2)
    if ground:
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=rad * 12, matrix=Matrix.Translation((ctr.x, ctr.y, lo.z - 0.001)))
        me = bpy.data.meshes.new("pv_ground")
        bm.to_mesh(me)
        bm.free()
        g = bpy.data.objects.new("pv_ground", me)
        me.materials.append(mat(0x3a3644, 0.45, 0.0))
        sc.collection.objects.link(g)
        tmp.append(g)
    cam = bpy.data.objects.new("pv_cam", bpy.data.cameras.new("pv_cam"))
    cam.data.lens = lens
    cam.data.clip_end = 5000
    sc.collection.objects.link(cam)
    tmp.append(cam)
    sc.camera = cam
    d = dist or rad * 3.1
    os.makedirs(os.path.dirname(path), exist_ok=True)
    shots = []
    for i, (az, el) in enumerate(views):
        a, b = math.radians(az), math.radians(el)
        cam.location = ctr + Vector((math.sin(a) * math.cos(b), -math.cos(a) * math.cos(b), math.sin(b))) * d
        cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = f"{path}.{i}.png"
        bpy.ops.render.render(write_still=True)
        shots.append(sc.render.filepath)
    cols = 2 if len(shots) > 1 else 1
    rows = (len(shots) + cols - 1) // cols
    sheet = Image.new("RGB", (res[0] * cols, res[1] * rows))
    for i, s in enumerate(shots):
        sheet.paste(Image.open(s).convert("RGB"), ((i % cols) * res[0], (i // cols) * res[1]))
        os.remove(s)
    sheet.save(path)
    for o in tmp:
        bpy.data.objects.remove(o)
    return path
