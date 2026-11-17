"""Vehicles: getaway van, harbor skiff, instanced traffic cars, hero hover car.

Run from the repo root:  tools/.venv/bin/python blender/build_vehicles.py [van|skiff|traffic|hovercar]
Writes public/assets/{getaway_van,getaway_skiff,traffic,hovercar}.glb (one palette material per file, AO in COLOR_0).

Conventions
- Getaway vehicles: origin on the ground under the centre of the rear opening (y = 0), body extends to +Y,
  cargo floor top at z = 0.75.
- Traffic + hover car: origin centre-bottom, front toward -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib as L  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

PV = os.environ.get("PREVIEW_DIR", "/home/user/tools/pv")
PI = math.pi
YELLOW, CYAN, ORANGE, GREEN, RED, WARM = 0xffd60a, 0x39f0ff, 0xff7a1c, 0x35ff6b, 0xff2b3b, 0xfff0c8


# ------------------------------------------------------------------ helpers
def slab(name, p0, p1, t, width, m, cx=0.0, out=0.0, bevel=0.0):
    """Thin panel seen in side profile: runs from (y, z) p0 to p1, `t` thick, extruded `width` along X.
    `out` pushes it along its left-hand normal (use to float glazing just proud of a slope)."""
    (y0, z0), (y1, z1) = p0, p1
    ln = math.hypot(y1 - y0, z1 - z0)
    ny, nz = -(z1 - z0) / ln, (y1 - y0) / ln
    a, b = out, out + t
    pts = [(y0 + ny * a, z0 + nz * a), (y1 + ny * a, z1 + nz * a), (y1 + ny * b, z1 + nz * b), (y0 + ny * b, z0 + nz * b)]
    return L.prism(name, pts, width, m, "X", cx, bevel)


def paint(ob, m, pred):
    """Assign material `m` to the faces whose (centre, normal) satisfy pred. Livery without textures."""
    me = ob.data
    if m.name not in [x.name for x in me.materials if x]:
        me.materials.append(m)
    idx = [x.name for x in me.materials].index(m.name)
    for p in me.polygons:
        if pred(Vector(p.center), Vector(p.normal)):
            p.material_index = idx
    return ob


def wheel(name, x, y, r, w, tyre, rim, hub, seg=20, detail=True):
    """Tyre + dished rim along the X axis, centre at (x, y, r)."""
    sx = 1 if x > 0 else -1
    rot = (0, PI / 2, 0)
    parts = [L.cyl(name + "_tyre", r, w, (x, y, r), rot, tyre, seg=seg, bevel=r * 0.14 if detail else 0)]
    if detail:
        parts.append(L.cyl(name + "_rim", r * 0.62, 0.05, (x + sx * (w / 2 - 0.01), y, r), rot, rim, seg=seg))
        parts.append(L.cyl(name + "_hub", r * 0.24, 0.06, (x + sx * (w / 2 + 0.02), y, r), rot, hub, seg=10))
        for k in range(5):                                           # spokes
            a = k * 2 * PI / 5
            parts.append(L.box(f"{name}_sp{k}", 0.025, r * 0.5, 0.07, (x + sx * (w / 2 + 0.018), y + math.cos(a) * r * 0.36, r + math.sin(a) * r * 0.36),
                               (a - PI / 2 + PI / 2, 0, 0), hub))
    return parts


def arch(name, x, y, zc, r0, r1, w, m, n=10):
    """Wheel-arch flare: half annulus in the YZ plane, `w` thick along X, centred at x."""
    outer = [(y + r1 * math.cos(PI * i / n), zc + r1 * math.sin(PI * i / n)) for i in range(n + 1)]
    inner = [(y + r0 * math.cos(PI * i / n), zc + r0 * math.sin(PI * i / n)) for i in range(n, -1, -1)]
    # build as quad strip so the caps are not concave n-gons
    import bmesh
    bm = bmesh.new()
    xa, xb = x - w / 2, x + w / 2
    o_a = [bm.verts.new((xa, p[0], p[1])) for p in outer]
    o_b = [bm.verts.new((xb, p[0], p[1])) for p in outer]
    inner = inner[::-1]
    i_a = [bm.verts.new((xa, p[0], p[1])) for p in inner]
    i_b = [bm.verts.new((xb, p[0], p[1])) for p in inner]
    for i in range(n):
        bm.faces.new((o_a[i], o_a[i + 1], o_b[i + 1], o_b[i]))
        bm.faces.new((i_a[i], i_b[i], i_b[i + 1], i_a[i + 1]))
        bm.faces.new((o_a[i], i_a[i], i_a[i + 1], o_a[i + 1]))
        bm.faces.new((o_b[i], o_b[i + 1], i_b[i + 1], i_b[i]))
    bm.faces.new((o_a[0], o_b[0], i_b[0], i_a[0]))
    bm.faces.new((o_a[n], i_a[n], i_b[n], o_b[n]))
    return L._obj(name, bm, m)


def clean(ob):
    """Weld coincident verts and drop collapsed faces (tube caps, clamped bevels)."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-4)
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def deliver(objs, stem, emit=1.0, views=((35, 14), (145, 14), (215, 28), (325, 45)), pv=True):
    if pv:
        L.preview(os.path.join(PV, stem + ".png"), objs, views=views)
    L.palettize(objs, stem, emit_strength=emit)
    q = L.check(objs)
    r = L.export(objs, stem + ".glb")
    print("EXPORT", stem, r["files"][0]["kb"], "kb", r["files"][0]["summary"])
    return q


# ------------------------------------------------------------------ getaway van
def build_van():
    L.reset()
    BODY = L.mat(0x2a2a38, 0.42, 0.55)
    BODY2 = L.mat(0x1c1c26, 0.5, 0.5)
    TRIM = L.mat(0x5b6072, 0.38, 0.75)
    DARK = L.mat(0x0d0d12, 0.7, 0.2)
    GLASS = L.mat(0x10131c, 0.12, 0.3)
    TYRE = L.mat(0x0b0b0e, 0.9, 0.0)
    RIM = L.mat(0x8f95a6, 0.3, 1.0)
    INT = L.mat(0x34343f, 0.7, 0.2)
    e = lambda c, s=3.5: L.mat(c, 0.4, 0.0, s)
    P = []
    add = P.append
    W = 1.2                                                          # half width of the cargo box

    # cargo bay: floor, walls, roof, bulkhead
    add(L.box("floor", 2.36, 4.4, 0.2, (0, 2.2, 0.65), m=INT))
    for sx in (-1, 1):
        add(L.box(f"wall{sx}", 0.12, 4.4, 1.98, (sx * 1.14, 2.2, 1.72), m=BODY, bevel=0.025))
        # armour plates and lower rocker on the outside
        add(L.box(f"plateA{sx}", 0.05, 1.5, 0.62, (sx * 1.215, 2.55, 2.2), m=BODY2, bevel=0.02, seg=1))
        add(L.box(f"plateB{sx}", 0.05, 0.9, 0.62, (sx * 1.215, 3.85, 2.2), m=BODY2, bevel=0.02, seg=1))
        add(L.box(f"plateC{sx}", 0.05, 1.1, 0.62, (sx * 1.215, 0.85, 2.2), m=BODY2, bevel=0.02, seg=1))
        add(L.box(f"rocker{sx}", 0.1, 2.5, 0.26, (sx * 1.19, 3.0, 0.62), m=TRIM, bevel=0.03, seg=1))
        add(L.box(f"stripe{sx}", 0.03, 4.1, 0.1, (sx * 1.212, 2.2, 1.62), m=e(ORANGE)))
        add(L.box(f"stripeb{sx}", 0.03, 2.2, 0.035, (sx * 1.212, 3.1, 1.47), m=e(ORANGE)))
        for k in range(5):                                           # louvred side vent
            add(L.box(f"vent{sx}{k}", 0.06, 0.62, 0.035, (sx * 1.215, 1.7, 1.02 + k * 0.085), (sx * 0.5, 0, 0), DARK))
        add(L.box(f"ventf{sx}", 0.03, 0.74, 0.5, (sx * 1.205, 1.7, 1.19), m=TRIM, bevel=0.015, seg=1))
        # interior wheel tub
        add(L.box(f"tub{sx}", 0.24, 1.15, 0.2, (sx * 0.96, 0.95, 0.84), m=INT, bevel=0.04, seg=1))
        # tail light on the rear edge of the wall + small reflector
        add(L.box(f"tail{sx}", 0.09, 0.03, 0.62, (sx * 1.14, -0.012, 1.28), m=e(RED, 4)))
        add(L.box(f"tail2{sx}", 0.09, 0.03, 0.2, (sx * 1.14, -0.012, 2.3), m=e(ORANGE, 3)))
        # roof rail
        add(L.tube(f"rail{sx}", [(sx * 0.98, 0.25, 2.82), (sx * 0.98, 0.25, 2.93), (sx * 0.98, 3.9, 2.93), (sx * 0.98, 3.9, 2.82)], 0.028, TRIM, seg=8))
    add(L.box("roof", 2.44, 4.44, 0.12, (0, 2.2, 2.75), m=BODY, bevel=0.03))
    add(L.box("roofpanel", 1.5, 3.2, 0.04, (0, 2.1, 2.815), m=BODY2, bevel=0.015, seg=1))
    add(L.box("bulkhead", 2.16, 0.1, 1.95, (0, 4.35, 1.71), m=INT))
    add(L.box("ceil_light", 1.5, 3.0, 0.03, (0, 2.3, 2.662), m=e(GREEN, 3)))
    add(L.box("ledge", 2.4, 0.12, 0.1, (0, -0.01, 0.75), m=e(YELLOW, 3.5)))
    add(L.box("step", 2.3, 0.3, 0.14, (0, -0.08, 0.5), m=TRIM, bevel=0.03, seg=1))
    for i, (x, y, r) in enumerate([(-0.55, 3.45, 0.1), (0.1, 3.4, -0.2), (0.62, 3.6, 0.3), (-0.2, 3.9, 0.15), (0.4, 3.95, -0.1)]):
        add(L.box(f"cash{i}", 0.5, 0.3, 0.2, (x, y, 0.852), (0, 0, r), e(GREEN, 2.5)))
        add(L.box(f"band{i}", 0.12, 0.31, 0.21, (x, y, 0.852), (0, 0, r), L.mat(0xf2fff4, 0.6)))

    # doors swung open ~110 deg
    for sx in (-1, 1):
        ang = math.radians(110)
        dx, dy = -sx * math.cos(ang), -math.sin(ang)                # door direction from the hinge
        rz = math.atan2(dy, dx)
        hx, hy = sx * 1.2, 0.0
        c = lambda u, o=0.0, z=1.74: (hx + dx * u - dy * o, hy + dy * u + dx * o, z)
        add(L.box(f"door{sx}", 1.18, 0.08, 1.96, c(0.6), (0, 0, rz), BODY, bevel=0.025))
        o = -sx * 0.045                                              # outside face of the door
        add(L.box(f"doorwin{sx}", 0.7, 0.03, 0.5, c(0.62, o, 2.25), (0, 0, rz), GLASS))
        add(L.box(f"doorplate{sx}", 0.86, 0.03, 0.7, c(0.6, o, 1.3), (0, 0, rz), BODY2, bevel=0.012, seg=1))
        add(L.box(f"doorhaz{sx}", 0.86, 0.035, 0.07, c(0.6, o, 1.78), (0, 0, rz), e(YELLOW, 2)))
        add(L.box(f"doorin{sx}", 0.95, 0.03, 1.6, c(0.6, -o, 1.74), (0, 0, rz), INT, bevel=0.012, seg=1))
        for z in (1.05, 2.45):
            add(L.cyl(f"hinge{sx}{z}", 0.05, 0.22, (hx + sx * 0.02, 0.0, z), m=TRIM, seg=8))

    # cab: side profile extruded, then glazing
    prof = [(4.4, 0.42), (6.18, 0.42), (6.3, 0.62), (6.3, 1.22), (6.12, 1.5), (5.5, 1.62), (5.02, 2.58), (4.4, 2.8)]
    add(L.prism("cab", prof, 2.4, BODY, bevel=0.04))
    add(slab("windshield", (5.07, 2.5), (5.47, 1.7), 0.03, 2.05, GLASS, out=0.012))
    add(slab("hoodpanel", (5.58, 1.605), (6.06, 1.512), 0.035, 1.7, BODY2, out=-0.01))
    for sx in (-1, 1):
        # side window: trapezoid following the windshield rake
        win = [(4.55, 1.72), (5.36, 1.72), (4.98, 2.5), (4.55, 2.6)]
        add(L.prism(f"sidewin{sx}", win, 0.03, GLASS, "X", sx * 1.205))
        add(L.box(f"mirror{sx}", 0.2, 0.08, 0.26, (sx * 1.31, 5.42, 1.86), m=BODY2, bevel=0.02, seg=1))
        add(L.box(f"mirrorarm{sx}", 0.2, 0.04, 0.04, (sx * 1.23, 5.42, 1.8), m=TRIM))
        add(L.box(f"cabdoor{sx}", 0.03, 0.9, 1.0, (sx * 1.21, 4.98, 1.14), m=BODY2, bevel=0.012, seg=1))
        add(L.box(f"head{sx}", 0.5, 0.05, 0.2, (sx * 0.8, 6.305, 1.06), m=e(WARM, 4)))
        add(L.box(f"headfr{sx}", 0.6, 0.04, 0.3, (sx * 0.8, 6.29, 1.06), m=DARK))
        add(L.box(f"drl{sx}", 0.5, 0.05, 0.04, (sx * 0.8, 6.305, 1.26), m=e(CYAN, 3)))
    add(L.box("grille", 0.9, 0.05, 0.36, (0, 6.3, 1.02), m=DARK))
    for k in range(4):
        add(L.box(f"grslat{k}", 0.86, 0.04, 0.03, (0, 6.325, 0.9 + k * 0.08), m=TRIM))
    add(L.box("bumper", 2.46, 0.3, 0.3, (0, 6.28, 0.56), m=TRIM, bevel=0.05))
    # bull bar
    for sx in (-1, 1):
        add(L.tube(f"bull{sx}", [(sx * 0.55, 6.44, 0.45), (sx * 0.55, 6.5, 0.8), (sx * 0.55, 6.5, 1.3), (sx * 0.55, 6.36, 1.42)], 0.04, RIM, seg=8))
    for z in (0.78, 1.28):
        add(L.tube(f"bullx{z}", [(-0.98, 6.4, z), (-0.6, 6.5, z), (0.6, 6.5, z), (0.98, 6.4, z)], 0.035, RIM, seg=8))
    # roof light bar + antenna + sensor pod
    add(L.box("barbase", 1.7, 0.26, 0.07, (0, 4.0, 2.835), m=DARK, bevel=0.02, seg=1))
    for i, c in enumerate([ORANGE, WARM, CYAN, CYAN, WARM, ORANGE]):
        add(L.box(f"bar{i}", 0.24, 0.22, 0.1, (-0.675 + i * 0.27, 4.0, 2.91), m=e(c, 3.5), bevel=0.02, seg=1))
    add(L.cyl("antenna", 0.014, 1.5, (-0.95, 0.5, 3.6), m=TRIM, seg=6))
    add(L.cyl("antbase", 0.05, 0.1, (-0.95, 0.5, 2.85), m=DARK, seg=8))
    add(L.box("pod", 0.5, 0.7, 0.16, (0.55, 1.0, 2.88), m=TRIM, bevel=0.04, seg=1))
    add(L.cyl("dish", 0.2, 0.05, (0.55, 1.0, 2.99), m=DARK, seg=12))

    # chassis, underglow, wheels, arches
    add(L.box("chassis", 1.7, 5.6, 0.24, (0, 3.15, 0.44), m=DARK))
    add(L.box("underglow", 1.5, 5.0, 0.03, (0, 3.1, 0.3), m=e(CYAN, 3)))
    for sx in (-1, 1):
        for j, y in enumerate((0.95, 5.2)):
            P.extend(wheel(f"wh{sx}{j}", sx * 1.04, y, 0.46, 0.36, TYRE, RIM, DARK))
            add(arch(f"arch{sx}{j}", sx * 1.235, y, 0.46, 0.56, 0.68, 0.09, TRIM))
    ob = clean(L.join([p for p in P if p], "Van"))
    L.bake_ao([ob], samples=24, distance=0.8, floor=0.32)
    return deliver([ob], "getaway_van")


# ------------------------------------------------------------------ harbor skiff
def build_skiff():
    L.reset()
    HULL = L.mat(0x1f3038, 0.4, 0.55)
    HULL2 = L.mat(0x152126, 0.5, 0.5)
    TRIM = L.mat(0x6c7c84, 0.35, 0.8)
    DARK = L.mat(0x0a0e10, 0.7, 0.2)
    GLASS = L.mat(0x0d1a1c, 0.1, 0.3)
    DECK = L.mat(0x2c3a40, 0.75, 0.2)
    e = lambda c, s=3.5: L.mat(c, 0.4, 0.0, s)
    P = []
    add = P.append

    # belly: lofted hull under the bed, tapering up into the raked bow
    def sec(y, w, top, bot, p=5.0):
        return L.ring(L.superellipse(w, top - bot, 12, p), y, "Y", (0, (top + bot) / 2))
    add(L.loft("belly", [sec(0.0, 2.3, 0.74, 0.42), sec(0.35, 2.5, 0.74, 0.34), sec(4.6, 2.5, 0.74, 0.34), sec(6.4, 2.4, 0.9, 0.42),
                         sec(7.1, 1.9, 1.02, 0.66), sec(7.6, 1.1, 1.08, 0.9)], HULL))
    add(L.box("bed", 2.26, 4.58, 0.04, (0, 2.31, 0.73), m=DECK))
    for sx in (-1, 1):
        # side wall: leaning outward, capped with a rail
        wall = [(-0.0, 0.72), (4.6, 0.72), (4.6, 1.4), (0.5, 1.4), (0.0, 1.15)]
        w = L.prism(f"wall{sx}", wall, 0.14, HULL, "X", sx * 1.18, bevel=0.03)
        add(w)
        add(L.tube(f"rail{sx}", [(sx * 1.18, 0.55, 1.43), (sx * 1.18, 4.6, 1.43)], 0.04, TRIM, seg=8))
        add(L.box(f"stripe{sx}", 0.03, 3.9, 0.12, (sx * 1.262, 2.5, 1.12), m=e(ORANGE)))
        add(L.box(f"stripe2{sx}", 0.03, 1.6, 0.04, (sx * 1.262, 3.6, 0.95), m=e(ORANGE)))
        for k in range(4):
            add(L.box(f"wrib{sx}{k}", 0.05, 0.1, 0.56, (sx * 1.095, 0.9 + k * 1.05, 1.06), m=HULL2, bevel=0.015, seg=1))
        add(L.box(f"tail{sx}", 0.1, 0.03, 0.3, (sx * 1.18, -0.01, 1.0), (0, 0, 0), e(RED, 4)))
        # outboard stabiliser fin by the cab
        fin = [(4.9, 0.0), (6.3, 0.0), (5.5, 0.5), (5.0, 0.5)]
        f = L.prism(f"fin{sx}", [(y, 0.95 + z) for y, z in fin], 0.06, HULL2, "X", sx * 1.42, bevel=0.015)
        add(f)
        add(L.box(f"finarm{sx}", 0.26, 0.9, 0.08, (sx * 1.3, 5.45, 0.98), m=TRIM, bevel=0.02, seg=1))
        add(L.box(f"finlight{sx}", 0.03, 0.5, 0.05, (sx * 1.455, 5.35, 1.3), m=e(CYAN, 3)))
    add(L.box("frontwall", 2.3, 0.14, 0.9, (0, 4.6, 1.15), m=HULL, bevel=0.03))
    add(L.box("ledge", 2.54, 0.12, 0.1, (0, -0.01, 0.75), m=e(YELLOW, 3.5)))

    # cab
    prof = [(4.66, 0.74), (6.4, 0.74), (6.4, 1.2), (5.75, 1.92), (4.9, 1.98), (4.66, 1.8)]
    add(L.prism("cab", prof, 2.26, HULL2, bevel=0.04))
    add(slab("glass_f", (5.78, 1.84), (6.33, 1.23), 0.03, 1.95, GLASS, out=0.01))
    for sx in (-1, 1):
        win = [(4.85, 1.3), (6.15, 1.3), (5.68, 1.82), (4.95, 1.86)]
        add(L.prism(f"sidewin{sx}", win, 0.03, GLASS, "X", sx * 1.135))
        add(L.box(f"head{sx}", 0.34, 0.06, 0.1, (sx * 0.72, 6.43, 0.98), m=e(WARM, 4)))
        add(L.box(f"headfr{sx}", 0.44, 0.05, 0.18, (sx * 0.72, 6.41, 0.98), m=DARK))
    add(L.box("cabroof", 1.7, 0.9, 0.05, (0, 5.32, 1.972), (-0.07, 0, 0), HULL, bevel=0.02, seg=1))
    add(L.box("barbase", 1.3, 0.2, 0.06, (0, 5.2, 2.03), m=DARK))
    for i, c in enumerate([ORANGE, CYAN, CYAN, ORANGE]):
        add(L.box(f"bar{i}", 0.26, 0.16, 0.08, (-0.45 + i * 0.3, 5.2, 2.09), m=e(c, 3.5), bevel=0.02, seg=1))
    add(L.cyl("antenna", 0.014, 1.3, (0.8, 4.9, 2.6), m=TRIM, seg=6))
    add(L.box("bowstrip", 1.0, 0.04, 0.05, (0, 7.48, 1.02), (0.25, 0, 0), e(CYAN, 3)))
    add(L.box("bowplate", 1.5, 0.8, 0.04, (0, 6.8, 1.0), (0.17, 0, 0), HULL2, bevel=0.015, seg=1))
    # keel light + thruster pods
    add(L.box("keel", 0.5, 3.4, 0.03, (0, 2.7, 0.335), m=e(CYAN, 2.5)))
    for sx in (-1, 1):
        for j, y in enumerate((0.9, 4.6)):
            x = sx * 1.0
            add(L.cyl(f"pod{sx}{j}", 0.6, 0.34, (x, y, 0.45), m=DARK, seg=16, r2=0.5, bevel=0.03))
            add(L.torus(f"podring{sx}{j}", 0.56, 0.045, (x, y, 0.3), m=TRIM, seg=16, tseg=6))
            add(L.cyl(f"podglow{sx}{j}", 0.4, 0.03, (x, y, 0.268), m=e(CYAN, 4), seg=16))
            add(L.box(f"podarm{sx}{j}", 0.5, 0.3, 0.12, (sx * 1.2, y, 0.575), m=TRIM, bevel=0.03, seg=1))
    # cargo: cash + a strapped crate
    for i, (x, y, r) in enumerate([(-0.5, 3.4, 0.1), (0.5, 3.45, -0.2), (-0.45, 3.95, 0.25), (0.5, 3.9, 0.05)]):
        add(L.box(f"cash{i}", 0.5, 0.3, 0.2, (x, y, 0.852), (0, 0, r), e(GREEN, 2.5)))
        add(L.box(f"band{i}", 0.12, 0.31, 0.21, (x, y, 0.852), (0, 0, r), L.mat(0xf2fff4, 0.6)))
    for k in range(6):                                               # hazard chevrons along the rear deck edge
        add(L.box(f"haz{k}", 0.2, 0.3, 0.012, (-0.95 + k * 0.38, 0.28, 0.752), (0, 0, 0.5), L.mat(YELLOW, 0.6)))
    ob = clean(L.join([p for p in P if p], "Skiff"))
    L.bake_ao([ob], samples=24, distance=0.8, floor=0.32)
    return deliver([ob], "getaway_skiff")


# ------------------------------------------------------------------ instanced traffic
def build_traffic():
    L.reset()
    PAINT = L.mat(0xf2f2f6, 0.4, 0.4)
    GLASS = L.mat(0x10131c, 0.15, 0.3)
    DARK = L.mat(0x101116, 0.8, 0.1)
    HEAD = L.mat(WARM, 0.4, 0, 4)
    TAIL = L.mat(RED, 0.4, 0, 4)
    GLOW = L.mat(CYAN, 0.4, 0, 3)

    def wheels(n, xs, ys, r, w):
        return [L.cyl(f"{n}w{i}", r, w, (x, y, r), (0, PI / 2, 0), DARK, seg=8) for i, (x, y) in enumerate((x, y) for x in xs for y in ys)]

    def sec(y, w, top, bot, n=8, p=4.0):
        return L.ring(L.superellipse(w, top - bot, n, p), y, "Y", (0, (top + bot) / 2))

    # sedan: low wedge nose, fastback cabin
    P = [L.loft("sb", [sec(-2.1, 1.5, 0.62, 0.3), sec(-1.75, 1.8, 0.74, 0.22), sec(1.75, 1.8, 0.82, 0.22), sec(2.1, 1.6, 0.8, 0.36)], PAINT)]
    cab = L.loft("sc", [sec(-0.85, 1.62, 0.8, 0.7), sec(-0.2, 1.46, 1.3, 0.7), sec(0.75, 1.46, 1.3, 0.7), sec(1.7, 1.56, 0.84, 0.7)], GLASS)
    paint(cab, PAINT, lambda c, n: n.z > 0.85 and c.z > 1.2)
    P += [cab, L.box("sh", 1.5, 0.08, 0.14, (0, -2.1, 0.52), m=HEAD), L.box("st", 1.56, 0.08, 0.13, (0, 2.1, 0.64), m=TAIL)]
    P += wheels("s", (-0.84, 0.84), (-1.3, 1.3), 0.32, 0.22)
    sedan = clean(L.join(P, "CarSedan"))

    # van / box truck
    P = [L.loft("vb", [sec(-2.5, 1.7, 1.05, 0.3), sec(-2.2, 1.85, 1.2, 0.24), sec(-1.2, 1.85, 1.9, 0.24), sec(2.45, 1.85, 1.95, 0.24), sec(2.5, 1.8, 1.9, 0.3)], PAINT)]
    paint(P[0], GLASS, lambda c, n: c.y < -1.3 and c.z > 1.0 and n.z > 0.2 and n.y < -0.2)
    P += [L.box("vs", 1.87, 0.7, 0.4, (0, -1.75, 1.42), m=GLASS),
          L.box("vband", 1.87, 3.2, 0.16, (0, 0.75, 1.0), m=DARK),
          L.box("vh", 1.6, 0.08, 0.16, (0, -2.5, 0.62), m=HEAD), L.box("vt", 1.7, 0.08, 0.2, (0, 2.5, 0.8), m=TAIL),
          L.box("vt2", 0.9, 0.08, 0.1, (0, 2.5, 1.86), m=TAIL)]
    P += wheels("v", (-0.86, 0.86), (-1.6, 1.6), 0.36, 0.24)
    van = clean(L.join(P, "CarVan"))

    # hover car: wedge fuselage, twin nacelles on a wing, glowing underside
    P = [L.loft("hb", [sec(-2.1, 0.5, 0.5, 0.36, 8), sec(-1.3, 1.0, 0.66, 0.26, 8), sec(0.3, 1.15, 0.86, 0.22, 8), sec(1.6, 1.1, 0.8, 0.26, 8), sec(2.1, 0.9, 0.7, 0.4, 8)], PAINT)]
    can = L.loft("hc", [sec(-1.0, 0.7, 0.68, 0.6, 8, 2.5), sec(-0.2, 0.86, 1.12, 0.6, 8, 2.5), sec(0.7, 0.8, 1.06, 0.6, 8, 2.5), sec(1.5, 0.6, 0.82, 0.6, 8, 2.5)], GLASS)
    P.append(can)
    for sx in (-1, 1):
        x = sx * 0.78
        nac = L.loft(f"hn{sx}", [L.ring(L.superellipse(w, h, 6, 2.5), y, "Y", (x, 0.42)) for y, w, h in
                                 [(-1.7, 0.12, 0.1), (-1.2, 0.42, 0.36), (1.5, 0.46, 0.4), (1.9, 0.36, 0.3)]], PAINT)
        paint(nac, DARK, lambda c, n: -0.6 < c.y < 0.4)
        P += [nac, L.box(f"hg{sx}", 0.3, 2.6, 0.04, (x, 0.2, 0.215), m=GLOW),
              L.box(f"ht{sx}", 0.34, 0.08, 0.28, (x, 1.92, 0.42), m=TAIL),
              L.box(f"hh{sx}", 0.2, 0.3, 0.07, (sx * 0.3, -1.72, 0.56), (0.17, 0, 0), HEAD),
              L.box(f"hf{sx}", 0.05, 0.9, 0.42, (sx * 0.86, 1.5, 0.8), (0.0, sx * -0.3, 0), PAINT)]
    P += [L.box("hw", 1.9, 1.3, 0.1, (0, 0.5, 0.42), m=DARK), L.box("hgc", 0.5, 2.2, 0.04, (0, 0.2, 0.215), m=GLOW),
          L.box("htc", 0.9, 0.08, 0.1, (0, 2.1, 0.6), m=TAIL)]
    hover = clean(L.join(P, "CarHover"))

    objs = [sedan, van, hover]
    # bake each at the origin with the others hidden so they don't shadow one another
    for o in objs:
        for q in objs:
            q.hide_render = q is not o
        L.bake_ao([o], samples=24, distance=0.6, floor=0.4)
    for q in objs:
        q.hide_render = False
    # previews side by side (temporary offsets), export stacked at the origin
    for i, o in enumerate(objs):
        o.location.x = (i - 1) * 3.2
    bpy.context.view_layer.update()
    L.preview(os.path.join(PV, "traffic.png"), objs, views=((35, 18), (150, 18), (215, 40), (0, 80)))
    for o in objs:
        o.location.x = 0
    bpy.context.view_layer.update()
    for o in objs:
        print("TRIS", o.name, L.tris([o]))
    return deliver(objs, "traffic", pv=False)


# ------------------------------------------------------------------ hero hover car
def build_hovercar():
    L.reset()
    Y = L.mat(YELLOW, 0.3, 0.35)
    BLK = L.mat(0x0c0c10, 0.45, 0.4)
    WHT = L.mat(0xf4f4f0, 0.4, 0.2)
    GLASS = L.mat(0x0c1220, 0.08, 0.4)
    MET = L.mat(0x7c8290, 0.3, 1.0)
    DARK = L.mat(0x08080b, 0.7, 0.2)
    e = lambda c, s=3.5: L.mat(c, 0.4, 0.0, s)
    P = []
    add = P.append
    N = 16

    def sec(y, w, top, bot, p=3.4, x=0.0, n=N):
        return L.ring(L.superellipse(w, top - bot, n, p), y, "Y", (x, (top + bot) / 2))

    # fuselage: needle nose rising to the cockpit, squared-off tail
    S = [(-2.6, 0.22, 0.44, 0.34), (-2.3, 0.5, 0.52, 0.28), (-1.7, 0.78, 0.62, 0.22), (-1.0, 0.98, 0.72, 0.18), (-0.3, 1.1, 0.8, 0.16),
         (0.5, 1.2, 0.88, 0.16), (1.3, 1.26, 0.92, 0.18), (1.5, 1.26, 0.92, 0.18), (2.1, 1.2, 0.86, 0.24), (2.35, 1.06, 0.8, 0.32)]
    fus = L.loft("fus", [sec(*s) for s in S], Y)
    paint(fus, BLK, lambda c, n: n.z > 0.5 and abs(c.x) < 0.2)                         # centre racing stripe
    paint(fus, BLK, lambda c, n: n.z < -0.3)                                           # belly
    paint(fus, BLK, lambda c, n: 1.3 < c.y < 1.5 and n.z > -0.3)                       # tail band
    paint(fus, WHT, lambda c, n: n.z > 0.5 and abs(c.x) < 0.2 and c.y < -2.2)          # nose tip
    add(fus)
    # bubble canopy
    add(L.sphere("canopy", 0.5, (0, 0.05, 0.78), GLASS, seg=16, rings=8, scale=(0.84, 2.0, 0.8)))
    add(L.box("canopy_spine", 0.07, 1.2, 0.05, (0, 0.5, 1.13), (-0.12, 0, 0), BLK, bevel=0.015, seg=1))

    for sx in (-1, 1):
        x = sx * 0.98
        # forward pontoon / nacelle
        NS = [(-2.42, 0.3, 0.49, 0.21), (-2.3, 0.4, 0.53, 0.15), (-1.5, 0.46, 0.56, 0.12), (-1.3, 0.46, 0.56, 0.12), (-1.1, 0.46, 0.56, 0.12),
              (-0.9, 0.46, 0.56, 0.12), (-0.7, 0.46, 0.56, 0.12), (0.2, 0.48, 0.58, 0.12), (0.8, 0.42, 0.54, 0.16), (1.15, 0.3, 0.48, 0.22)]
        nac = L.loft(f"nac{sx}", [sec(y, w, t, b, 3.0, x, 12) for y, w, t, b in NS], Y)
        paint(nac, BLK, lambda c, n: (-1.5 < c.y < -1.3 or -1.1 < c.y < -0.9) and n.z > -0.5)   # hazard bands
        paint(nac, BLK, lambda c, n: n.z < -0.5)
        paint(nac, DARK, lambda c, n: n.y < -0.9)
        paint(nac, WHT, lambda c, n: -2.3 < c.y < -1.5 and n.z > 0.75 and abs(c.x) > 0.9)
        add(nac)
        add(L.box(f"skid{sx}", 0.1, 2.0, 0.06, (x, -0.7, 0.03), m=MET, bevel=0.02, seg=1))
        for y in (-1.5, 0.1):
            add(L.box(f"strut{sx}{y}", 0.06, 0.1, 0.12, (x, y, 0.1), m=MET))
        add(L.box(f"under{sx}", 0.24, 1.8, 0.02, (x, -0.6, 0.115), m=e(CYAN, 3)))
        add(L.box(f"head{sx}", 0.2, 0.04, 0.07, (x, -2.43, 0.38), m=e(WARM, 4)))
        add(L.box(f"drl{sx}", 0.22, 0.04, 0.025, (x, -2.43, 0.3), m=e(CYAN, 3)))
        # intake on the nacelle shoulder
        add(L.box(f"intake{sx}", 0.3, 0.5, 0.1, (x, 0.3, 0.6), (0.1, 0, 0), BLK, bevel=0.02, seg=1))
        # rear thruster
        tx = sx * 0.78
        add(L.cyl(f"thr{sx}", 0.27, 0.9, (tx, 2.05, 0.48), (PI / 2, 0, 0), MET, seg=16, r2=0.2, bevel=0.015))
        add(L.torus(f"thr_ring{sx}", 0.275, 0.03, (tx, 2.5, 0.48), (PI / 2, 0, 0), BLK, seg=16, tseg=6))
        add(L.cyl(f"thr_glow{sx}", 0.22, 0.04, (tx, 2.5, 0.48), (PI / 2, 0, 0), e(CYAN, 4), seg=16))
        add(L.cyl(f"thr_core{sx}", 0.09, 0.08, (tx, 2.5, 0.48), (PI / 2, 0, 0), L.mat(0xeaffff, 0.4, 0, 4), seg=10))
        # canted tail fin
        fin = [(1.25, 0.0), (2.45, 0.0), (2.6, 0.55), (2.15, 0.55)]
        f = L.prism(f"fin{sx}", [(y, z) for y, z in fin], 0.05, Y, "X", 0.0, bevel=0.012)
        paint(f, BLK, lambda c, n: c.z > 0.36)
        L.move(f, (sx * 0.62, 0, 0.72), (0, sx * 0.38, 0))
        add(f)
        add(L.box(f"fin_tip{sx}", 0.03, 0.3, 0.035, (sx * (0.62 + 0.2), 2.4, 1.24), (0, sx * 0.38, 0), e(RED, 3)))
        # side decal
        t = L.text(f"decal{sx}", "KIBO", 0.2, 0.012, BLK, (0, 0, 0), (PI / 2, 0, sx * PI / 2), spacing=1.05)
        L.move(t, (sx * 1.213, -0.3, 0.37))
        add(t)
    # wing joining the pontoons, with a black leading edge and white number
    add(L.box("wing", 2.1, 1.3, 0.09, (0, -0.35, 0.34), m=Y, bevel=0.025))
    add(L.box("wing_le", 2.0, 0.16, 0.1, (0, -1.0, 0.34), m=BLK, bevel=0.025, seg=1))
    for sx in (-1, 1):
        add(L.box(f"wing_stripe{sx}", 0.1, 1.05, 0.012, (sx * 0.64, -0.3, 0.39), m=BLK))
    num = L.text("num", "07", 0.34, 0.012, WHT, (0, 0, 0), (0, 0, PI), spacing=1.0)
    L.move(num, (0.0, 1.9, 0.905), (0.08, 0, 0))
    add(num)
    # rear deck, spoiler bridge, tail light strip
    add(L.box("spoiler", 1.7, 0.3, 0.04, (0, 2.42, 1.26), (0.1, 0, 0), BLK, bevel=0.012, seg=1))
    add(L.box("tail", 1.0, 0.05, 0.07, (0, 2.37, 0.7), m=e(RED, 4)))
    add(L.box("tail_plate", 1.02, 0.06, 0.3, (0, 2.34, 0.56), m=DARK))
    add(L.box("nose_strip", 0.3, 0.04, 0.03, (0, -2.4, 0.42), (0.4, 0, 0), e(CYAN, 3)))
    add(L.box("belly_glow", 0.5, 2.6, 0.02, (0, 0.6, 0.165), m=e(CYAN, 3)))
    ob = clean(L.join([p for p in P if p], "HoverCar"))
    L.bake_ao([ob], samples=24, distance=0.7, floor=0.34)
    return deliver([ob] + L.lods([ob], 0.35), "hovercar")             # HoverCar_LOD1 flies in traffic


BUILDS = {"van": build_van, "skiff": build_skiff, "traffic": build_traffic, "hovercar": build_hovercar}

if __name__ == "__main__":
    want = [a for a in sys.argv[1:] if a in BUILDS] or list(BUILDS)
    for k in want:
        print("=====", k)
        BUILDS[k]()
