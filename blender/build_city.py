"""Skyline megastructures (buildings.glb) and 3D neon signs (signs.glb).

    tools/.venv/bin/python blender/build_city.py [buildings|signs] [--only Name] [--preview] [--no-export]

Every node: origin at ground centre (buildings, pole/rooftop signs) or back-centre of the mount
(wall signs); the detailed / reading face looks toward -Y. Each file ends up with ONE palette
material (L.palettize) and baked AO in COLOR_0.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib as L  # noqa: E402  (imports bpy first)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Euler, Matrix, Vector  # noqa: E402

M = L.mat
PI = math.pi


# ------------------------------------------------------------------ fast multi-part mesh builder
class B:
    """Accumulates boxes/quads/cylinders with explicit outward winding into one mesh."""

    _BOX = [((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)), ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)),
            ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)), ((0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)),
            ((0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)), ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1))]

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def _face(self, vs, m, smooth=False):
        if m not in self.mats:
            self.mats.append(m)
        f = self.bm.faces.new(vs)
        f.material_index = self.mats.index(m)
        f.smooth = smooth
        return f

    def boxm(self, mx, m):
        v = {(i, j, k): self.bm.verts.new(mx @ Vector((i - 0.5, j - 0.5, k - 0.5))) for i in (0, 1) for j in (0, 1) for k in (0, 1)}
        for f in self._BOX:
            self._face([v[c] for c in f], m)

    def box(self, x0, x1, y0, y1, z0, z1, m):
        x0, x1 = min(x0, x1), max(x0, x1)
        y0, y1 = min(y0, y1), max(y0, y1)
        z0, z1 = min(z0, z1), max(z0, z1)
        self.boxm(Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) @ Matrix.Diagonal((x1 - x0, y1 - y0, z1 - z0, 1)), m)

    def rbox(self, c, size, rot, m):
        self.boxm(Matrix.Translation(c) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*size, 1)), m)

    def beam(self, p0, p1, w, m, w2=None):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        q = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        self.boxm(Matrix.Translation((p0 + p1) / 2) @ q @ Matrix.Diagonal((w, w2 or w, d.length, 1)), m)

    def quad(self, pts, m, mx=None):
        self._face([self.bm.verts.new((mx @ Vector(p)) if mx else p) for p in pts], m)

    def wq(self, face, plane, u0, u1, z0, z1, m):
        """Wall quad on a facade: face S (-Y), N (+Y), W (-X), E (+X); `plane` is the fixed coordinate."""
        p = plane
        pts = {"S": [(u0, p, z0), (u1, p, z0), (u1, p, z1), (u0, p, z1)], "N": [(u0, p, z0), (u0, p, z1), (u1, p, z1), (u1, p, z0)],
               "W": [(p, u0, z0), (p, u0, z1), (p, u1, z1), (p, u1, z0)], "E": [(p, u0, z0), (p, u1, z0), (p, u1, z1), (p, u0, z1)]}[face]
        self.quad(pts, m)

    def cyl(self, cx, cy, z0, z1, r, m, seg=16, r2=None, caps=True, phase=0.0, smooth=True, mx=None):
        r2 = r if r2 is None else r2
        T = mx or Matrix.Identity(4)
        bot = [self.bm.verts.new(T @ Vector((cx + r * math.cos(phase + 2 * PI * i / seg), cy + r * math.sin(phase + 2 * PI * i / seg), z0))) for i in range(seg)]
        top = [self.bm.verts.new(T @ Vector((cx + r2 * math.cos(phase + 2 * PI * i / seg), cy + r2 * math.sin(phase + 2 * PI * i / seg), z1))) for i in range(seg)]
        for i in range(seg):
            j = (i + 1) % seg
            self._face([bot[i], bot[j], top[j], top[i]], m, smooth)
        if caps:
            self._face(top, m)
            self._face(list(reversed(bot)), m)

    def obj(self, name):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


class Facade:
    """Local frame for one wall of an axis-aligned block: u along the wall, `out` away from it."""

    def __init__(self, b, face, x0, x1, y0, y1):
        self.b, self.face = b, face
        self.a0, self.a1 = (x0, x1) if face in "SN" else (y0, y1)
        self.base = {"S": y0, "N": y1, "W": x0, "E": x1}[face]
        self.sgn = -1 if face in "SW" else 1

    def box(self, u0, u1, o0, o1, z0, z1, m):
        p0, p1 = self.base + self.sgn * o0, self.base + self.sgn * o1
        if self.face in "SN":
            self.b.box(u0, u1, p0, p1, z0, z1, m)
        else:
            self.b.box(p0, p1, u0, u1, z0, z1, m)

    def quad(self, out, u0, u1, z0, z1, m):
        self.b.wq(self.face, self.base + self.sgn * out, u0, u1, z0, z1, m)


def clusters(rng, cols, rows, n, rx=(1.5, 5), ry=(1.5, 6)):
    cl = [(rng.uniform(0, cols), rng.uniform(0, rows), rng.uniform(*rx), rng.uniform(*ry)) for _ in range(n)]
    return lambda c, r: any(abs(c - cx) < ax and abs(r - cy) < ay for cx, cy, ax, ay in cl)


def glazing(F, z0, z1, rng, lit, glass, floor=4.4, win=3.2, margin=1.2, proud=0.25, sill=1.0, head=0.8,
            p_in=0.72, p_out=0.05, ncl=None, rx=(1.5, 5), ry=(1.5, 6)):
    """Rows of windows merged into runs: dark glass ribbons broken by lit stretches. Returns (cols, col width)."""
    rows = max(1, int((z1 - z0) / floor))
    span = F.a1 - F.a0 - 2 * margin
    cols = max(1, int(span / win))
    w = span / cols
    inside = clusters(rng, cols, rows, ncl if ncl is not None else max(2, rows * cols // 45), rx, ry)
    for r in range(rows):
        za, zb = z0 + r * floor + sill, z0 + (r + 1) * floor - head
        cells, cur = [], None
        for c in range(cols):
            if rng.random() < (p_in if inside(c, r) else p_out):
                cur = cur if (cur is not None and rng.random() < 0.75) else rng.choice(lit)
                cells.append(cur)
            else:
                cur = None
                cells.append(glass)
        c = 0
        while c < cols:
            e = c
            while e + 1 < cols and cells[e + 1] is cells[c]:
                e += 1
            F.quad(proud, F.a0 + margin + c * w, F.a0 + margin + (e + 1) * w, za, zb, cells[c])
            c = e + 1
    return cols, w


def tier(b, x0, x1, y0, y1, z0, z1, wall, rng, lit, glass, fin, slab, floor=4.4, win=3.2, fin_every=1, fin_d=0.7,
         slab_out=0.45, faces="SNWE", **kw):
    """One building volume: core, glazing on each face, vertical fins and a slab ring per floor."""
    b.box(x0, x1, y0, y1, z0, z1, wall)
    margin = kw.get("margin", 1.2)
    for face in faces:
        F = Facade(b, face, x0, x1, y0, y1)
        cols, w = glazing(F, z0, z1, rng, lit, glass, floor=floor, win=win, **kw)
        if fin is not None:
            for c in range(0, cols + 1, fin_every):
                u = F.a0 + margin + c * w
                F.box(u - 0.18, u + 0.18, 0, fin_d, z0, z1, fin)
    if slab is not None:
        rows = max(1, int((z1 - z0) / floor))
        for r in range(1, rows + 1):
            z = z0 + r * floor
            b.box(x0 - slab_out, x1 + slab_out, y0 - slab_out, y1 + slab_out, z - 0.3, z + 0.2, slab)


def neon_ring(b, x0, x1, y0, y1, z, m, t=0.35, out=0.2):
    b.box(x0 - out - t, x1 + out + t, y0 - out - t, y0 - out, z, z + t, m)
    b.box(x0 - out - t, x1 + out + t, y1 + out, y1 + out + t, z, z + t, m)
    b.box(x0 - out - t, x0 - out, y0 - out, y1 + out, z, z + t, m)
    b.box(x1 + out, x1 + out + t, y0 - out, y1 + out, z, z + t, m)


def mast(b, x, y, z0, h, steel, beacon=None, bars=2, w=0.3):
    b.box(x - w / 2, x + w / 2, y - w / 2, y + w / 2, z0, z0 + h, steel)
    for i in range(bars):
        z = z0 + h * (0.55 + 0.3 * i / max(1, bars - 1))
        s = 1.6 - 0.5 * i
        b.box(x - s, x + s, y - 0.07, y + 0.07, z, z + 0.14, steel)
    if beacon is not None:
        b.box(x - 0.4, x + 0.4, y - 0.4, y + 0.4, z0 + h, z0 + h + 0.8, beacon)


def dish(b, x, y, z, r, az, steel, light, tilt=0.9):
    b.box(x - 0.15, x + 0.15, y - 0.15, y + 0.15, z, z + r * 0.9, steel)
    mx = Matrix.Translation((x, y, z + r * 0.9)) @ Euler((tilt, 0, az)).to_matrix().to_4x4()
    b.cyl(0, 0, 0, r * 0.45, r * 0.15, light, seg=12, r2=r, mx=mx)


def water_tank(b, x, y, z, r, h, body, steel):
    for ox, oy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        b.box(x + ox * r * 0.6 - 0.1, x + ox * r * 0.6 + 0.1, y + oy * r * 0.6 - 0.1, y + oy * r * 0.6 + 0.1, z, z + 1.4, steel)
    b.cyl(x, y, z + 1.4, z + 1.4 + h, r, body, seg=12)
    b.cyl(x, y, z + 1.4 + h, z + 1.4 + h + r * 0.5, r * 1.05, steel, seg=12, r2=0.15)


# ------------------------------------------------------------------ materials
def pal():
    return dict(
        wall_a=M(0x5d5269, 0.85), wall_b=M(0x4f4a66, 0.85), conc=M(0x6a6070, 0.9), wall_c=M(0x3f4a66, 0.8),
        dark=M(0x15121f, 0.6, 0.3), steel=M(0x2b2740, 0.5, 0.6), glass=M(0x241f33, 0.2, 0.1), light=M(0x9aa3ad, 0.5, 0.4),
        cool=[M(0x9fe6ff, 0.4, 0, 2), M(0xbfeaff, 0.4, 0, 2), M(0x59dcff, 0.4, 0, 2)],
        warm=[M(0xffc978, 0.4, 0, 2), M(0xffb060, 0.4, 0, 2)],
        pink=M(0xff6fb5, 0.4, 0, 2),
        cyan=M(0x39f0ff, 0.4, 0, 3), mag=M(0xff3df0, 0.4, 0, 3), org=M(0xff5a36, 0.4, 0, 3),
        red=M(0xff2030, 0.4, 0, 3), yel=M(0xffd60a, 0.4, 0, 3))


# ------------------------------------------------------------------ buildings
def mega_tower(rng):
    P = pal()
    b = B()
    kw = dict(lit=P["cool"] + P["cool"] + P["warm"][:1], glass=P["glass"], fin=P["dark"], slab=P["conc"])
    tiers = [(-20, 20, -20, 20, 0, 36, P["wall_a"]), (-17, 17, -17, 17, 36, 100, P["wall_b"]),
             (-11, 15, -13, 13, 100, 155, P["wall_a"]), (-5, 11, -8, 8, 155, 190, P["wall_b"])]
    for i, (x0, x1, y0, y1, z0, z1, wall) in enumerate(tiers):
        tier(b, x0, x1, y0, y1, z0, z1, wall, rng, floor=4.5 if i == 0 else 4.4, win=3.3, fin_every=1 if i else 2,
             p_in=0.5 if i == 0 else 0.7, p_out=0.03 if i == 0 else 0.05, ry=(2, 7), ncl=(3, 9, 6, 3)[i], **kw)
        b.box(x0 - 1.5, x1 + 1.5, y0 - 1.5, y1 + 1.5, z1 - 1.6, z1 + 0.9, P["conc"])           # heavy set-back slab
        neon_ring(b, x0 - 1.5, x1 + 1.5, y0 - 1.5, y1 + 1.5, z1 - 0.9, P["cyan"] if i % 2 == 0 else P["mag"], t=0.4)
    # buttress blades climbing the lower tiers, neon on the leading edge
    for x in (-9, 9):
        for sy in (-1, 1):
            b.box(x - 1, x + 1, sy * 17, sy * 23, 0, 112, P["conc"])
            b.box(x - 0.2, x + 0.2, sy * 23, sy * 23.3, 6, 110, P["mag"] if sy < 0 else P["org"])
            b.beam((x, sy * 23, 112), (x, sy * 13.2, 124), 1.6, P["conc"])
    for y in (-7, 7):
        for sx in (-1, 1):
            b.box(sx * 17, sx * 23, y - 1, y + 1, 0, 78, P["conc"])
            b.box(sx * 23, sx * 23.3, y - 0.2, y + 0.2, 6, 76, P["cyan"])
    # lobby glow + stacked holo-ad panel on the east face
    b.wq("S", -20.4, -6.5, 6.5, 0.6, 7.5, P["warm"][0])
    b.box(-7.5, 7.5, -22, -20, 7.5, 8.6, P["dark"])
    b.box(18.0, 18.6, -9, 3, 48, 88, P["dark"])
    for k, m in enumerate((P["mag"], P["cyan"], P["org"])):
        b.wq("E", 18.75, -8.4, 2.4, 48.8 + k * 13, 60.2 + k * 13, m)
    # landing pad on the tier-2 roof, facing the route
    b.cyl(0, -21.5, 99.0, 100.0, 6.5, P["conc"], seg=20)
    b.cyl(0, -21.5, 100.0, 100.18, 4.8, P["yel"], seg=20)
    b.cyl(0, -21.5, 100.0, 100.36, 4.2, P["dark"], seg=20)
    b.box(-0.5, 0.5, -24, -19, 100.36, 100.5, P["yel"])
    for sx in (-4, 4):
        b.beam((sx, -26, 99.2), (sx, -17.3, 88), 0.6, P["steel"])
    for k in range(10):
        a = 2 * PI * k / 10
        b.box(6.2 * math.cos(a) - 0.2, 6.2 * math.cos(a) + 0.2, -21.5 + 6.2 * math.sin(a) - 0.2, -21.5 + 6.2 * math.sin(a) + 0.2, 100, 100.45, P["red"] if k % 2 else P["yel"])
    # crown: plant room, antenna farm, dishes, halo rings
    b.box(-2, 8, -5, 5, 190.9, 197, P["dark"])
    neon_ring(b, -2, 8, -5, 5, 196.2, P["org"], t=0.3)
    for x, y, h in ((3, 0, 30), (-0.5, -3.5, 19), (6.5, 3.5, 23), (6.5, -3.5, 14), (-0.5, 3.5, 11), (-3.5, -6.5, 12), (9.5, 6.5, 9)):
        mast(b, x, y, 197 if (-2 <= x <= 8 and abs(y) <= 5) else 190.9, h, P["dark"], P["red"], bars=3 if h > 18 else 2)
    dish(b, -3.5, 5.5, 190.9, 2.4, 2.4, P["steel"], P["light"])
    dish(b, 9.5, -6, 190.9, 1.9, -0.7, P["steel"], P["light"])
    body = b.obj("MegaTower")
    halo = L.torus("halo", 14, 0.45, (3, 0, 204), (0.3, 0.14, 0), P["mag"], seg=32, tseg=6)
    halo2 = L.torus("halo2", 9.5, 0.32, (3, 0, 211), (-0.22, -0.18, 0), P["cyan"], seg=28, tseg=6)
    return L.join([body, halo, halo2], "MegaTower")


def stack_block(rng):
    P = pal()
    b = B()
    mods = [M(c, 0.85) for c in (0x6a5568, 0x7a4f4a, 0x3f6f6a, 0x45587a, 0x8a6a5a, 0x5d5269, 0x6a6070)]
    lit = P["warm"] + P["warm"] + [M(0xff8a5c, 0.4, 0, 2), P["cool"][0], P["pink"]]
    cloth = [M(c, 0.9) for c in (0xf5f1ff, 0xff8fc7, 0x5fe0d8, 0xff6b5e)]
    awn = [M(c, 0.8) for c in (0xa8446a, 0x4f7fa8, 0xc9b06a)]
    acm, rail = P["light"], P["dark"]
    FH = 3.6

    def clad(x0, x1, y0, y1, z0, nfl, ncols, detail, p_mod=0.72):
        b.box(x0, x1, y0, y1, z0, z0 + nfl * FH, P["wall_a"])
        for face in "SNWE":
            F = Facade(b, face, x0, x1, y0, y1)
            cols = ncols[0] if face in "SN" else ncols[1]
            d = detail[face]
            w = (F.a1 - F.a0) / cols
            for u in [F.a0 + w * (c + rng.uniform(0.2, 0.8)) for c in range(cols) if rng.random() < 0.5]:   # downpipes
                F.box(u - 0.15, u + 0.15, 0, 0.3, 0, z0 + nfl * FH, P["steel"])
            for fl in range(nfl):
                z = z0 + fl * FH
                for c in range(cols):
                    u0, u1 = F.a0 + c * w, F.a0 + (c + 1) * w
                    glow = rng.choice(lit) if rng.random() < 0.55 else P["glass"]
                    if fl == 0 and z0 == 0:                                     # street-level shopfronts
                        F.quad(0.15, u0 + 0.5, u1 - 0.5, 0.4, 3.0, rng.choice(lit))
                        F.box(u0 + 0.2, u1 - 0.2, 0, 1.6, 3.1, 3.3, rng.choice(awn))
                        continue
                    if rng.random() < p_mod:
                        a, e = u0 + rng.uniform(0.1, 0.7), u1 - rng.uniform(0.1, 0.7)
                        o = rng.uniform(1.4, 3.8)
                        m0, m1 = z + 0.15, z + FH - rng.uniform(0.05, 0.5)
                        F.box(a, e, 0, o, m0, m1, rng.choice(mods))
                        ww = min(e - a - 0.8, rng.uniform(1.4, 2.6))
                        wa = a + rng.uniform(0.4, e - a - ww - 0.4)
                        F.quad(o + 0.12, wa, wa + ww, m0 + 1.0, m1 - 0.5, glow)
                        if d >= 1 and rng.random() < 0.45:
                            ax = a + rng.uniform(0.2, e - a - 1.3)
                            F.box(ax, ax + 1.1, o, o + 0.6, m0 + 0.15, m0 + 0.85, acm)
                        if d >= 2 and rng.random() < 0.35:
                            F.box(a, e, o, o + 1.3, m1 - 0.14, m1, rng.choice(awn))
                            F.box(a, e, o + 1.2, o + 1.3, m1 - 0.55, m1 - 0.14, rng.choice(awn))
                        elif d >= 1 and rng.random() < 0.4:
                            F.box(a, e, o, o + 1.2, m0 - 0.15, m0, P["conc"])
                            F.box(a, e, o + 1.1, o + 1.2, m0, m0 + 1.0, rail)
                            if d >= 2:
                                for _ in range(rng.randint(1, 3)):
                                    cx = rng.uniform(a, e - 0.7)
                                    F.box(cx, cx + 0.6, o + 1.2, o + 1.25, m0 + 0.15, m0 + 0.95, rng.choice(cloth))
                    else:
                        F.quad(0.12, u0 + 1.2, u1 - 1.2, z + 1.1, z + FH - 0.7, glow)
                        if d >= 1:
                            F.box(u0 + 1.0, u1 - 1.0, 0, 0.3, z + 0.9, z + 1.1, P["conc"])

    clad(-11, 11, -8, 8, 0, 16, (4, 3), dict(S=2, E=1, W=1, N=0))
    top = 16 * FH                                                        # 57.6
    b.box(-11.4, 11.4, -8.4, 8.4, top - 0.2, top + 0.9, P["conc"])       # parapet deck
    b.box(-6, 8, -5, 5, top + 0.9, top + 0.9 + 0.01, P["conc"])
    clad_z = top + 0.9
    clad(-6, 8, -5, 5, clad_z, 3, (2, 2), dict(S=2, E=1, W=1, N=0), p_mod=0.6)
    top2 = clad_z + 3 * FH                                               # 69.3
    b.box(-6.3, 8.3, -5.3, 5.3, top2, top2 + 0.5, P["conc"])
    # terrace shacks with corrugated lean-to roofs
    for x, y, w, d, h in ((-9, -6.2, 3.6, 3.0, 2.6), (-9, 5.6, 3.4, 3.6, 2.8), (9.6, -6.4, 2.4, 3.0, 2.5), (9.7, 6.0, 2.2, 3.4, 2.4)):
        z = top + 0.9
        col = rng.choice(mods)
        b.box(x - w / 2, x + w / 2, y - d / 2, y + d / 2, z, z + h, col)
        sgn = -1 if y < 0 else 1
        b.wq("S" if sgn < 0 else "N", y + sgn * (d / 2 + 0.1), x - w / 2 + 0.5, x - w / 2 + 1.6, z + 1.0, z + 1.9, rng.choice(lit))
        tilt = 0.16 * sgn
        b.rbox((x, y, z + h + 0.12), (w + 0.6, d + 0.9, 0.1), (tilt, 0, 0), M(0x565b78, 0.6, 0.4))
        for k in range(6):
            rx = x - w / 2 - 0.2 + (w + 0.4) * k / 5
            b.rbox((rx, y, z + h + 0.21), (0.14, d + 0.9, 0.1), (tilt, 0, 0), M(0x6f7494, 0.6, 0.4))
    water_tank(b, -8.2, -0.4, top + 0.9, 1.3, 2.4, M(0x8a6a5a, 0.8), P["steel"])
    water_tank(b, 4.5, 2, top2 + 0.5, 1.5, 2.6, M(0x8a6a5a, 0.8), P["steel"])
    water_tank(b, -2.5, -1.5, top2 + 0.5, 1.1, 2.0, M(0x7c8296, 0.6, 0.3), P["steel"])
    mast(b, 0.5, 3.5, top2 + 0.5, 6.5, P["dark"], P["red"])
    mast(b, 7, -3.8, top2 + 0.5, 4.5, P["dark"], None)
    dish(b, -4.5, 3.5, top2 + 0.5, 1.3, 2.6, P["steel"], P["light"])
    dish(b, 9.8, 0.5, top + 0.9, 1.1, -0.6, P["steel"], P["light"])
    # blank neon blade sign standing off the front, readable from both sides, plus a roof-edge strip sign
    b.box(6.9, 7.3, -14.6, -12.3, 20, 40, P["dark"])
    for z in (22, 30, 38):
        b.box(7.0, 7.2, -12.3, -8, z, z + 0.25, P["steel"])
    b.wq("W", 6.78, -14.4, -12.5, 20.3, 39.7, P["mag"])
    b.wq("E", 7.42, -14.4, -12.5, 20.3, 39.7, P["mag"])
    b.box(-9.5, -1, -9.2, -8.7, top + 0.9, top + 3.4, P["dark"])
    b.wq("S", -9.32, -9.2, -1.3, top + 1.2, top + 3.1, P["org"])
    b.box(-9, -8.7, -8.7, -8.4, top + 0.5, top + 0.9, P["steel"])
    b.box(-1.8, -1.5, -8.7, -8.4, top + 0.5, top + 0.9, P["steel"])
    neon_ring(b, -11.4, 11.4, -8.4, 8.4, top + 0.3, P["cyan"], t=0.2, out=0.05)
    return b.obj("StackBlock")


def corp_slab(rng):
    P = pal()
    b = B()
    lit = P["cool"][:2] + [M(0xe6f7ff, 0.4, 0, 2), P["warm"][0]]
    kw = dict(lit=lit, glass=P["glass"], fin=P["dark"], slab=P["conc"], floor=4.2, win=3.0, fin_every=2,
              rx=(3, 9), ry=(0.5, 1.3), p_in=0.85, p_out=0.03)
    tier(b, -25, 25, -9, 9, 0, 14, P["conc"], rng, lit=P["warm"], glass=P["glass"], fin=None, slab=None, floor=7, win=5, p_in=0.85, p_out=0.12, ncl=3, sill=0.8, head=1.6)
    b.box(-26, 26, -10, 10, 13.2, 14.6, P["wall_a"])
    tier(b, -23, 23, -7, 7, 14.6, 65, P["wall_c"], rng, ncl=9, **kw)
    b.box(-21, 21, -5.5, 5.5, 65, 74, P["dark"])                         # recessed sky lobby
    for x in (-22.2, -8, 8, 22.2):
        for y in (-6.2, 6.2):
            b.box(x - 0.6, x + 0.6, y - 0.6, y + 0.6, 65, 74, P["conc"])
    b.wq("S", -5.6, -19, 19, 66.5, 70.5, P["warm"][1])
    b.wq("N", 5.6, -19, 19, 66.5, 70.5, P["warm"][1])
    neon_ring(b, -23, 23, -7, 7, 64.4, P["mag"], t=0.35)
    neon_ring(b, -23, 23, -7, 7, 74.2, P["mag"], t=0.35)
    tier(b, -23, 23, -7, 7, 74, 125, P["wall_c"], rng, ncl=9, **kw)
    b.box(-24, 24, -8, 8, 124.2, 126, P["conc"])
    for x in (-23.5, 23.5):                                              # vertical neon corner tubes
        for y in (-7.5, 7.5):
            b.box(x - 0.22, x + 0.22, y - 0.22, y + 0.22, 14.6, 124.2, P["org"])
    # bridge / overpass stub on the +X side, cut off mid-span
    b.box(23, 37, -4, 4, 40, 49, P["wall_a"])
    b.box(22.5, 37.6, -4.6, 4.6, 48.6, 49.6, P["conc"])
    b.box(22.5, 37.6, -4.6, 4.6, 39.4, 40.2, P["conc"])
    b.wq("S", -4.25, 24, 36, 42.4, 46.4, lit[0])
    b.wq("N", 4.25, 24, 36, 42.4, 46.4, lit[1])
    b.box(23, 37.6, -4.9, -4.6, 49.0, 49.35, P["org"])
    b.box(23, 37.6, 4.6, 4.9, 49.0, 49.35, P["org"])
    for y in (-3.2, 3.2):
        b.beam((36, y, 39.6), (23.3, y, 28), 0.9, P["steel"])
        b.beam((37, y, 44), (40.5, y, 44.6), 0.25, P["steel"])            # exposed rebar
    b.wq("E", 37.25, -3.4, 3.4, 41, 48, P["dark"])
    for y in (-2.4, 0, 2.4):
        b.box(37.2, 37.7, y - 0.4, y + 0.4, 46.6, 47.4, P["red"])
    # roof plant and the big sign truss on the front edge
    b.box(-12, 4, -3.5, 4.5, 126, 132, P["dark"])
    neon_ring(b, -12, 4, -3.5, 4.5, 131.3, P["cyan"], t=0.25)
    for x in (9, 13, 17):
        b.cyl(x, 2, 126, 128.6, 1.3, P["light"], seg=12)
    zt0, zt1 = 126, 140
    xs = [-16, -8, 0, 8, 16]
    for x in xs:
        b.box(x - 0.3, x + 0.3, -6.8, -6.2, zt0, zt1, P["steel"])
        b.beam((x, -6.5, zt1 - 0.3), (x, 3, zt0 + 0.3), 0.4, P["steel"])
    for z in (128, 134, 140):
        b.box(-16.5, 16.5, -6.75, -6.25, z - 0.25, z + 0.25, P["steel"])
    for i in range(len(xs) - 1):
        for z0, z1 in ((128, 134), (134, 140)):
            a, c = (xs[i], xs[i + 1]) if (i + (z0 == 134)) % 2 == 0 else (xs[i + 1], xs[i])
            b.beam((a, -6.5, z0), (c, -6.5, z1), 0.22, P["steel"])
    b.box(-16.5, 16.5, -7.0, -6.75, 140.3, 140.7, P["cyan"])
    mast(b, -9, 2, 132, 12, P["dark"], P["red"], bars=3)
    mast(b, -1, 2, 132, 7, P["dark"], P["red"])
    dish(b, 20, -3, 126, 1.8, -0.5, P["steel"], P["light"])
    return b.obj("CorpSlab")


def capsule_tower(rng):
    P = pal()
    b = B()
    SEG, R = 24, 12.0
    step = 2 * PI / SEG
    ap = R * math.cos(step / 2)
    b.cyl(0, 0, 0, 10, 14.5, P["conc"], seg=SEG, phase=step / 2)
    b.cyl(0, 0, 10, 102, R, P["wall_b"], seg=SEG, phase=step / 2)
    pods = [M(0x8d8590, 0.7), M(0x6a6070, 0.8), M(0x77708a, 0.7), M(0xa5502f, 0.7)]
    lit = P["warm"] + [P["cool"][0], P["cool"][1], P["pink"]]
    FH, NFL = 4.0, 23
    spine = 18                                                           # facet facing -Y (angle 270 deg)
    inside = clusters(rng, SEG, NFL, 9, rx=(2, 5), ry=(2, 6))
    for fl in range(NFL):
        z = 10 + fl * FH
        for i in range(SEG):
            if i == spine:
                continue
            a = i * step
            rot = Matrix.Rotation(a, 4, "Z")
            on = rng.random() < (0.75 if inside(i, fl) else 0.1)
            glow = rng.choice(lit) if on else P["glass"]
            if (i + fl) % 2 == 0:
                b.boxm(rot @ Matrix.Translation((ap + 0.9, 0, z + 2.0)) @ Matrix.Diagonal((2.4, 2.6, 2.9, 1)), pods[(i * 7 + fl * 3) % 4 if rng.random() < 0.9 else 3])
                p = ap + 2.1 + 0.12
                b.quad([(p, -0.85, z + 1.1), (p, 0.85, z + 1.1), (p, 0.85, z + 2.9), (p, -0.85, z + 2.9)], glow, rot)
            else:
                p = ap + 0.15
                b.quad([(p, -1.1, z + 0.9), (p, 1.1, z + 0.9), (p, 1.1, z + 3.1), (p, -1.1, z + 3.1)], glow, rot)
        if fl % 3 == 0:
            b.cyl(0, 0, z - 0.25, z + 0.2, 14.4, P["conc"], seg=SEG, phase=step / 2)
    # lift spine on the front with a neon seam
    rot = Matrix.Rotation(spine * step, 4, "Z")
    b.boxm(rot @ Matrix.Translation((ap + 1.4, 0, 54)) @ Matrix.Diagonal((3.2, 3.0, 108, 1)), P["dark"])
    b.boxm(rot @ Matrix.Translation((ap + 3.1, 0, 56)) @ Matrix.Diagonal((0.25, 0.4, 96, 1)), P["cyan"])
    for zc in (30, 62, 90):
        b.boxm(rot @ Matrix.Translation((ap + 3.15, 0, zc)) @ Matrix.Diagonal((0.3, 2.2, 3.2, 1)), P["warm"][0])
    # street-level shops round the podium
    for i in range(SEG):
        if i % 3 == 1:
            continue
        r2 = Matrix.Rotation(i * step, 4, "Z")
        p = 14.5 * math.cos(step / 2) + 0.15
        b.quad([(p, -1.4, 0.5), (p, 1.4, 0.5), (p, 1.4, 4.2), (p, -1.4, 4.2)], rng.choice(lit), r2)
    # crown
    b.cyl(0, 0, 102, 108, R, P["conc"], seg=SEG, r2=8.5, phase=step / 2)
    b.cyl(0, 0, 108, 109, 9.2, P["dark"], seg=SEG, phase=step / 2)
    for x, y, h in ((0, 0, 15), (3.5, 2, 9), (-3, 3.5, 11), (-4, -3, 7)):
        mast(b, x, y, 109, h, P["dark"], P["red"], bars=3 if h > 12 else 2)
    dish(b, 5, -3.5, 109, 2.2, -0.9, P["steel"], P["light"])
    dish(b, -5.5, 0.5, 109, 1.8, 1.9, P["steel"], P["light"])
    dish(b, 1, 5.5, 109, 1.5, 3.0, P["steel"], P["light"])
    body = b.obj("CapsuleTower")
    r1 = L.torus("ring1", 12.9, 0.3, (0, 0, 103.2), (0, 0, 0), P["cyan"], seg=SEG, tseg=5)
    r2 = L.torus("ring2", 14.9, 0.25, (0, 0, 9.6), (0, 0, 0), P["mag"], seg=SEG, tseg=5)
    return L.join([body, r1, r2], "CapsuleTower")


# ------------------------------------------------------------------ signs
def text(name, body, size, depth, m, font, spacing=1.0, res=3):
    """L.text with a curve-resolution knob (big letters need rounder bowls). Upright, facing -Y."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body, cu.size, cu.extrude = body, size, depth / 2
    cu.align_x, cu.align_y, cu.space_character, cu.resolution_u = "CENTER", "CENTER", spacing, res
    if os.path.exists(font):
        cu.font = bpy.data.fonts.load(font, check_existing=True)
    ob = L._curve_to_mesh(name, cu, m)
    ob.data.transform(Matrix.Rotation(PI / 2, 4, "X"))
    return ob


def fit_text(name, body, m, width=None, height=None, depth=0.0, loc=(0, 0, 0), font=None, spacing=1.0, res=4):
    """Upright text facing -Y, scaled to a target width (or cap height) and centred on `loc`."""
    font = font or L.FONT_BOLD
    probe = text(name + "_p", body, 1.0, 0.0, None, font, spacing, 2)
    vs = [v.co for v in probe.data.vertices]
    w1 = max(v.x for v in vs) - min(v.x for v in vs)
    h1 = max(v.z for v in vs) - min(v.z for v in vs)
    bpy.data.objects.remove(probe)
    size = width / w1 if width else height / h1
    t = text(name, body, size, depth, m, font, spacing, res)
    vs = [v.co for v in t.data.vertices]
    cx = (max(v.x for v in vs) + min(v.x for v in vs)) / 2
    cz = (max(v.z for v in vs) + min(v.z for v in vs)) / 2
    L.move(t, (loc[0] - cx, loc[1], loc[2] - cz))
    return t


def stadium(w, h, n=8):
    r = h / 2
    pts = []
    for sx, a0 in ((1, -PI / 2), (-1, PI / 2)):
        for i in range(n + 1):
            a = a0 + PI * i / n
            pts.append((sx * (w / 2 - r) + r * math.cos(a), r * math.sin(a)))
    return pts


def sign_pal():
    return dict(dark=M(0x15121f, 0.55, 0.4), steel=M(0x2b2740, 0.5, 0.7), box=M(0x3a3d52, 0.6, 0.5), white=M(0xfff3e6, 0.4, 0, 4))


def frame_rect(b, x0, x1, z0, z1, y, t, m):
    b.box(x0, x1, y - t / 2, y + t / 2, z0, z0 + t, m)
    b.box(x0, x1, y - t / 2, y + t / 2, z1 - t, z1, m)
    b.box(x0, x0 + t, y - t / 2, y + t / 2, z0 + t, z1 - t, m)
    b.box(x1 - t, x1, y - t / 2, y + t / 2, z0 + t, z1 - t, m)


def sign_kuroma():
    S = sign_pal()
    red = M(0xff5a36, 0.4, 0, 4)
    cap = M(0xff5a36, 0.4, 0, 2.2)
    cy = M(0xbfeaff, 0.4, 0, 3.5)
    b = B()
    for x in (-6.2, 6.2):
        for y in (0, 1.8):
            b.box(x - 0.14, x + 0.14, y - 0.14, y + 0.14, 0.1, 2.3, S["steel"])
            b.box(x - 0.35, x + 0.35, y - 0.35, y + 0.35, 0, 0.1, S["dark"])
        b.box(x - 0.1, x + 0.1, 0.14, 1.66, 2.04, 2.24, S["steel"])
        b.beam((x, 0, 0.3), (x, 1.8, 2.1), 0.1, S["steel"])
        b.beam((x, 0.05, 7.5), (x, 1.8, 2.3), 0.12, S["steel"])
    b.beam((0, 0.05, 7.5), (0, 1.8, 2.3), 0.12, S["steel"])
    b.box(-6.9, 6.9, 1.7, 1.9, 2.02, 2.22, S["steel"])
    xs = [-6.8 + 13.6 * i / 8 for i in range(9)]
    for z in (2.3, 7.5):
        b.box(-6.9, 6.9, -0.1, 0.1, z - 0.1, z + 0.1, S["steel"])
    for i, x in enumerate(xs):
        b.box(x - 0.06, x + 0.06, -0.06, 0.06, 2.4, 7.4, S["steel"])
        if i < 8:
            a, c = (x, xs[i + 1]) if i % 2 == 0 else (xs[i + 1], x)
            b.beam((a, 0.02, 2.4), (c, 0.02, 7.4), 0.07, S["steel"])
    for z in (4.9, 6.3):                                                  # letter rails
        b.box(-6.8, 6.8, -0.12, -0.04, z - 0.05, z + 0.05, S["dark"])
    b.box(-4.3, 4.3, -0.16, -0.06, 7.62, 8.5, S["dark"])                  # katakana backing bar
    b.box(5.3, 6.1, 0.15, 0.75, 2.4, 3.5, S["box"])                       # transformer
    b.box(5.45, 5.95, 0.1, 0.15, 3.0, 3.3, M(0x35ff6b, 0.4, 0, 2))
    fr = b.obj("kframe")
    main = fit_text("kuroma", "KUROMA", red, width=13.2, depth=0.3, loc=(0, -0.27, 5.6), res=8)
    pill = L.prism("pill", stadium(9.2, 1.05), 0.22, cap, axis="Y", center=-0.2)
    L.move(pill, (0, 0, 3.45))
    sub = fit_text("elec", "ELECTRONICS", S["white"], width=7.4, depth=0.0, loc=(0, -0.345, 3.45), spacing=1.25)
    kana = fit_text("kana", "クロマ・エレクトロニクス", cy, width=7.8, depth=0.0, loc=(0, -0.2, 8.06), font=L.FONT_JP)
    cable = L.tube("kcable", [(5.7, 0.45, 3.5), (5.2, 0.5, 5.2), (3.5, 0.3, 6.6), (2.0, 0.1, 7.45)], 0.035, S["dark"], seg=4)
    return L.join([fr, main, pill, sub, kana, cable], "SignKuroma")


def sign_noodle():
    S = sign_pal()
    mg = M(0xff3df0, 0.4, 0, 4)
    warm = M(0xffc27a, 0.4, 0, 3.5)
    b = B()
    W, H, T = 1.9, 7.0, 0.3
    y0 = -0.75                                                            # blade front face; brackets run back to y=0
    b.box(-W / 2, W / 2, y0, y0 + T, -H / 2, H / 2, S["dark"])
    for z in (-2.6, 0, 2.6):
        b.box(-0.08, 0.08, y0 + T, -0.02, z - 0.08, z + 0.08, S["steel"])
        b.box(-0.3, 0.3, -0.05, 0, z - 0.3, z + 0.3, S["steel"])
    b.beam((0, y0 + T, 2.0), (0, 0, 2.6), 0.05, S["steel"])
    b.box(-0.35, 0.35, y0 + T, y0 + T + 0.35, -3.3, -2.9, S["box"])
    fr = b.obj("nframe")
    yf = y0 - 0.03
    border = L.tube("nborder", [(-W / 2 + 0.12, yf, -H / 2 + 0.12), (W / 2 - 0.12, yf, -H / 2 + 0.12), (W / 2 - 0.12, yf, H / 2 - 0.12), (-W / 2 + 0.12, yf, H / 2 - 0.12)], 0.035, mg, seg=4, cyclic=True)
    parts = [fr, border]
    for i, ch in enumerate("ラーメン"):
        z = 2.75 - i * 1.12
        if ch == "ー":                                                    # long-vowel bar runs vertically in vertical text
            parts.append(L.box("bar", 0.17, 0.08, 0.85, (0, yf - 0.04, z), m=mg))
        else:
            parts.append(fit_text(f"n{i}", ch, mg, height=0.9, depth=0.08, loc=(0, yf - 0.04, z), font=L.FONT_JP))
    # bowl + chopsticks + steam
    bz = -2.0
    bowl = L.prism("bowl", [(-0.6, 0.18), (-0.42, -0.2), (-0.3, -0.28), (0.3, -0.28), (0.42, -0.2), (0.6, 0.18)], 0.08, warm, axis="Y", center=yf - 0.04)
    L.move(bowl, (0, 0, bz))
    parts.append(bowl)
    parts.append(L.box("rim", 1.34, 0.08, 0.07, (0, yf - 0.04, bz + 0.26), m=S["white"]))
    for sx in (-0.12, 0.12):
        parts.append(L.box("stick", 0.045, 0.06, 1.0, (0.42 + sx, yf - 0.04, bz + 0.62), (0, 0.5, 0), S["white"]))
    for k, sx in enumerate((-0.32, -0.05)):
        parts.append(L.tube(f"steam{k}", [(sx, yf - 0.03, bz + 0.42), (sx + 0.1, yf - 0.03, bz + 0.6), (sx - 0.08, yf - 0.03, bz + 0.8), (sx + 0.05, yf - 0.03, bz + 1.0)], 0.028, S["white"], seg=4))
    parts.append(fit_text("sora", "SORA", warm, width=1.45, depth=0.06, loc=(0, yf - 0.03, -2.95)))
    return L.join(parts, "SignNoodle")


def sign_arcade():
    S = sign_pal()
    mg = M(0xff3df0, 0.4, 0, 4)
    cy = M(0x39f0ff, 0.4, 0, 4)
    bulb = M(0xffe2a8, 0.4, 0, 3.5)
    bulb2 = M(0xff8a3d, 0.4, 0, 1.2)
    b = B()
    W, H = 8.0, 3.0
    y0 = -0.6
    b.box(-W / 2, W / 2, y0, y0 + 0.3, -H / 2, H / 2, S["dark"])
    b.box(-2.2, 2.2, y0, y0 + 0.3, H / 2, H / 2 + 0.7, S["dark"])          # stepped crown
    b.box(-1.2, 1.2, y0, y0 + 0.3, H / 2 + 0.7, H / 2 + 1.15, S["dark"])
    frame_rect(b, -W / 2 - 0.1, W / 2 + 0.1, -H / 2 - 0.1, H / 2 + 0.1, y0 + 0.05, 0.12, S["steel"])
    for x in (-2.8, 2.8):
        b.box(x - 0.08, x + 0.08, y0 + 0.3, -0.02, -0.08, 0.08, S["steel"])
        b.box(x - 0.3, x + 0.3, -0.05, 0, -0.3, 0.3, S["steel"])
        b.beam((x, y0 + 0.3, 1.1), (x, 0, 0.1), 0.05, S["steel"])
    b.box(3.0, 3.7, y0 + 0.3, y0 + 0.75, -1.3, -0.5, S["box"])
    yf = y0 - 0.02
    n = 0
    pts = []
    for i in range(21):
        pts.append((-3.8 + 7.6 * i / 20, -1.3))
        pts.append((-3.8 + 7.6 * i / 20, 1.3))
    for i in range(1, 7):
        pts.append((-3.8, -1.3 + 2.6 * i / 7))
        pts.append((3.8, -1.3 + 2.6 * i / 7))
    for x, z in pts:
        s = 0.07
        b.box(x - s, x + s, yf - 0.1, yf + 0.02, z - s, z + s, bulb if n % 3 else bulb2)
        n += 1
    # crown star: a little diamond + rays
    b.rbox((0, yf - 0.03, H / 2 + 0.55), (0.42, 0.06, 0.42), (0, PI / 4, 0), bulb)
    for sx in (-1, 1):
        b.box(sx * 0.6, sx * 1.7, yf - 0.06, yf, H / 2 + 0.5, H / 2 + 0.6, cy)
    fr = b.obj("aframe")
    t1 = fit_text("neonko", "NEONKO", mg, width=6.2, depth=0.16, loc=(0, yf - 0.08, 0.42), res=7)
    t2 = fit_text("arcade", "ARCADE", cy, width=4.6, depth=0.1, loc=(0, yf - 0.05, -0.78), spacing=1.15)
    cable = L.tube("acable", [(3.35, y0 + 0.5, -0.5), (3.3, y0 + 0.45, 0.4), (2.9, y0 + 0.2, 0.9)], 0.03, S["dark"], seg=4)
    return L.join([fr, t1, t2, cable], "SignArcade")


def sign_motors():
    S = sign_pal()
    am = M(0xffb347, 0.4, 0, 4)
    b = B()
    b.cyl(0, 0, 0, 0.12, 0.55, S["dark"], seg=12)
    b.cyl(0, 0, 0.12, 4.6, 0.14, S["steel"], seg=10)
    b.box(-0.22, 0.22, -0.22, 0.22, 4.4, 4.9, S["box"])
    for sx in (-1, 1):
        b.beam((sx * 0.1, 0, 3.2), (sx * 0.9, 0, 4.95), 0.07, S["steel"])
    b.box(-0.3, 0.3, 0.12, 0.5, 1.0, 1.9, S["box"])                       # service box on the pole
    b.box(-0.2, 0.2, 0.5, 0.53, 1.5, 1.7, M(0x35ff6b, 0.4, 0, 2))
    zc = 6.6
    fr = b.obj("mframe")
    hexo = [(2.05 * math.cos(PI * k / 3), 2.05 * math.sin(PI * k / 3)) for k in range(6)]
    panel = L.prism("hex", hexo, 0.34, S["dark"], axis="Y", center=0)
    L.move(panel, (0, 0, zc))
    rim = L.tube("hexrim", [(1.9 * math.cos(PI * k / 3), -0.2, zc + 1.9 * math.sin(PI * k / 3)) for k in range(6)], 0.045, am, seg=4, cyclic=True)
    rim2 = L.tube("hexrim2", [(1.72 * math.cos(PI * k / 3), -0.2, zc + 1.72 * math.sin(PI * k / 3)) for k in range(6)], 0.02, S["white"], seg=4, cyclic=True)
    t1 = fit_text("kibo", "KIBO", am, width=2.5, depth=0.12, loc=(0, -0.23, zc + 0.12))
    t2 = fit_text("motors", "MOTORS", S["white"], width=1.9, depth=0.0, loc=(0, -0.19, zc - 0.62), spacing=1.3)
    parts = [fr, panel, rim, rim2, t1, t2]
    for sx in (-1, 1):                                                    # winged chevrons above the name
        parts.append(L.box("chev", 0.95, 0.06, 0.09, (sx * 0.48, -0.2, zc + 0.98), (0, -sx * 0.32, 0), am))
        parts.append(L.box("chev2", 0.6, 0.06, 0.07, (sx * 0.32, -0.2, zc + 0.78), (0, -sx * 0.32, 0), S["white"]))
    return L.join(parts, "SignMotors")


def sign_pharma():
    S = sign_pal()
    gr = M(0x7dffb0, 0.4, 0, 4)
    b = B()
    y0 = -0.55
    b.box(-1.5, 1.5, y0, y0 + 0.4, -1.5, 1.5, S["dark"])
    frame_rect(b, -1.58, 1.58, -1.58, 1.58, y0 + 0.08, 0.1, S["steel"])
    for z in (-0.9, 0.9):
        b.box(-0.07, 0.07, y0 + 0.4, -0.02, z - 0.07, z + 0.07, S["steel"])
        b.box(-0.25, 0.25, -0.05, 0, z - 0.25, z + 0.25, S["steel"])
    yf = y0 - 0.02
    cz = 0.38
    b.box(-0.28, 0.28, yf - 0.1, yf, cz - 0.85, cz + 0.85, gr)             # cross: upright + two arms
    b.box(-0.85, -0.28, yf - 0.1, yf, cz - 0.28, cz + 0.28, gr)
    b.box(0.28, 0.85, yf - 0.1, yf, cz - 0.28, cz + 0.28, gr)
    b.box(-1.25, 1.25, yf - 0.04, yf, -0.72, -0.67, S["white"])
    fr = b.obj("pframe")
    border = L.tube("pborder", [(-1.36, yf, -1.36), (1.36, yf, -1.36), (1.36, yf, 1.36), (-1.36, yf, 1.36)], 0.03, gr, seg=4, cyclic=True)
    t = fit_text("mirai", "MIRAI", gr, width=2.1, depth=0.08, loc=(0, yf - 0.04, -1.02))
    return L.join([fr, border, t], "SignPharma")


def sign_vanta():
    S = sign_pal()
    cy = M(0x7de3ff, 0.4, 0, 4)
    b = B()
    W, H = 9.0, 1.8
    y0 = -0.45
    b.box(-W / 2, W / 2, y0, y0 + 0.25, -H / 2, H / 2, S["dark"])
    frame_rect(b, -W / 2 - 0.08, W / 2 + 0.08, -H / 2 - 0.08, H / 2 + 0.08, y0 + 0.06, 0.1, S["steel"])
    for x in (-3.4, 0, 3.4):
        b.box(x - 0.07, x + 0.07, y0 + 0.25, -0.02, -0.07, 0.07, S["steel"])
        b.box(x - 0.22, x + 0.22, -0.05, 0, -0.22, 0.22, S["steel"])
    yf = y0 - 0.02
    b.box(-2.55, 4.1, yf - 0.05, yf, -0.74, -0.69, cy)                     # underline
    b.box(3.7, 4.25, y0 + 0.25, y0 + 0.6, -0.6, 0.12, S["box"])
    fr = b.obj("vframe")
    sh = [(0, -0.72), (0.42, -0.42), (0.58, 0.1), (0.58, 0.62), (0, 0.74), (-0.58, 0.62), (-0.58, 0.1), (-0.42, -0.42)]
    shield = L.prism("shield", sh, 0.08, cy, axis="Y", center=yf - 0.04)
    inner = L.prism("shield_in", [(u * 0.78, v * 0.78) for u, v in sh], 0.06, S["dark"], axis="Y", center=yf - 0.08)
    vee = fit_text("vee", "V", cy, height=0.62, depth=0.05, loc=(0, yf - 0.125, 0.02))
    for o in (shield, inner, vee):
        L.move(o, (-3.55, 0, 0))
    t1 = fit_text("vanta", "VANTA", cy, width=3.5, depth=0.14, loc=(-0.95, yf - 0.07, 0.1), res=6)
    t2 = fit_text("security", "SECURITY", S["white"], width=2.75, depth=0.0, loc=(2.65, yf - 0.02, 0.1), spacing=1.1)
    cable = L.tube("vcable", [(3.95, y0 + 0.45, 0.1), (3.6, y0 + 0.4, 0.8), (2.6, y0 + 0.15, 0.9)], 0.025, S["dark"], seg=4)
    return L.join([fr, shield, inner, vee, t1, t2, cable], "SignVanta")


# ------------------------------------------------------------------ driver
BUILDINGS = [("MegaTower", mega_tower, 11), ("StackBlock", stack_block, 22), ("CorpSlab", corp_slab, 33), ("CapsuleTower", capsule_tower, 44)]
SIGNS = [("SignKuroma", sign_kuroma), ("SignNoodle", sign_noodle), ("SignArcade", sign_arcade), ("SignMotors", sign_motors),
         ("SignPharma", sign_pharma), ("SignVanta", sign_vanta)]


def run(kind, only=None, do_preview=False, do_export=True):
    L.reset()
    objs = []
    if kind == "buildings":
        for name, fn, seed in BUILDINGS:
            if only and name not in only:
                continue
            objs.append(fn(random.Random(seed)))
        gap, ao = 400, dict(samples=12, distance=6.0, floor=0.32)
    else:
        for name, fn in SIGNS:
            if only and name not in only:
                continue
            objs.append(fn())
        gap, ao = 40, dict(samples=16, distance=0.8, floor=0.35)
    for i, o in enumerate(objs):                                          # spread out so they don't occlude each other
        o.location = (i * gap, 0, 0)
    bpy.context.view_layer.update()
    L.bake_ao(objs, **ao)
    for o in objs:
        print(o.name, "tris", L.tris([o]), "dims", [round(v, 2) for v in o.dimensions])
    if do_preview:
        for o in objs:
            for p in objs:
                p.hide_render = p is not o
            if kind == "buildings":
                L.preview(os.path.join(L.PREVIEW, o.name + ".png"), [o], views=((20, 6), (160, 6), (250, 18), (340, 32)), res=(440, 660), samples=16)
                h = o.dimensions.z
                L.preview(os.path.join(L.PREVIEW, o.name + "_detail.png"), [o], views=((25, 4), (335, 30)), res=(620, 500), samples=16,
                          dist=h * 0.5, target=(o.location.x, 0, h * 0.8), lens=35)
            else:
                tall = o.dimensions.z > o.dimensions.x * 1.5
                L.preview(os.path.join(L.PREVIEW, o.name + ".png"), [o], views=((0, 4), (38, 12), (322, 18), (150, 12)),
                          res=(400, 620) if tall else (620, 440), samples=16)
        for p in objs:
            p.hide_render = False
    for o in objs:
        o.location = (0, 0, 0)
    bpy.context.view_layer.update()
    if kind == "buildings" and not only:
        objs += L.lods(objs, 0.5)                                     # _LOD1 for the far skyline
    L.palettize(objs, "City" if kind == "buildings" else "Signs", emit_strength=1.0)
    for o in objs:
        L.check([o])
    if do_export and not only:
        r = L.export(objs, kind + ".glb")
        print("EXPORT", r["files"][0]["kb"], "kB", r["files"][0]["summary"])


if __name__ == "__main__":
    args = sys.argv[1:]
    only = args[args.index("--only") + 1].split(",") if "--only" in args else None
    kinds = [a for a in args if a in ("buildings", "signs")] or ["buildings", "signs"]
    for k in kinds:
        run(k, only, "--preview" in args, "--no-export" not in args)
