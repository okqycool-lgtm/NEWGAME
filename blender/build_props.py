"""Rooftop props -> public/assets/props.glb (one shared palette material, AO in vertex colours).

Run from the repo root:  tools/.venv/bin/python blender/build_props.py   (NO_PREVIEW=1 skips renders)
Every node: origin at the ground centre of its footprint, front toward -Y, 1 unit = 1 m.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib as L  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

PI = math.pi
R = math.radians

L.reset()          # before any material is made: reset wipes the file

# ------------------------------------------------------------------ shared palette
CASE = L.mat(0xb9b3b8, 0.55, 0.2)       # painted sheet metal
CASE2 = L.mat(0x9b9498, 0.6, 0.2)
DARK = L.mat(0x2a2632, 0.7, 0.2)
MID = L.mat(0x6e6672, 0.6, 0.3)
STEEL = L.mat(0x8a8290, 0.35, 0.9)
BLACK = L.mat(0x121218, 0.8, 0.0)
RUST = L.mat(0x8a6a5a, 0.8, 0.3)
RUST2 = L.mat(0x6a4f48, 0.85, 0.3)
RUSTD = L.mat(0x4a3a3a, 0.8, 0.5)
PURPLE = L.mat(0x4f4a78, 0.6, 0.3)
FRAME = L.mat(0x2c2a3c, 0.5, 0.6)
YELLOW = L.mat(0xffd60a, 0.5, 0.1)
RED = L.mat(0xd6342c, 0.4, 0.0)
BLUE = L.mat(0x3558c9, 0.4, 0.0)
WHITE = L.mat(0xe9eef5, 0.45, 0.0)
COOLB = L.mat(0x3a6fd0, 0.4, 0.0)
TEAL = L.mat(0x2f8f86, 0.7, 0.3)
RUSTO = L.mat(0xa5502f, 0.8, 0.3)
SBLUE = L.mat(0x3566a8, 0.7, 0.3)
ROOF = L.mat(0x565b78, 0.6, 0.5)
CELL = L.mat(0x16305c, 0.15, 0.6)
CELLL = L.mat(0x2a4a8c, 0.3, 0.6)
POT = L.mat(0x5a6e8c, 0.25, 0.0)
SOIL = L.mat(0x2a2018, 0.95, 0.0)
BARK = L.mat(0x4a3628, 0.9, 0.0)
LEAF = L.mat(0x2f5a3c, 0.85, 0.0)
LEAF2 = L.mat(0x3f7a4c, 0.85, 0.0)
AWN = L.mat(0xa8446a, 0.8, 0.0)
DRUM = L.mat(0x2a5560, 0.45, 0.7)
E_CYAN = L.mat(0x39f0ff, 0.4, 0, 3)
E_MAG = L.mat(0xff3df0, 0.4, 0, 3)
E_RED = L.mat(0xff3b30, 0.4, 0, 4)
E_WARM = L.mat(0xffc978, 0.4, 0, 2.5)
E_PANEL = L.mat(0x8fe6f2, 0.4, 0, 1.2)
E_GREEN = L.mat(0x7dffb0, 0.4, 0, 2)
CAN = [L.mat(c, 0.35, 0.3, 0.5) for c in (0xff5a36, 0xffd60a, 0x39f0ff, 0xff3df0, 0x7dffb0)]


def B(n, sx, sy, sz, loc, m, bv=0.0, rot=(0, 0, 0), seg=1):
    return L.box(n, sx, sy, sz, loc, rot, m, bevel=bv, seg=seg)


def T(n, a, b, r, m, seg=4):
    return L.tube(n, [a, b], r, m, seg=seg)


def bounds(ob):
    vs = [Vector(v.co) for v in ob.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return lo, hi


def fit(ob, size=None):
    """Centre the footprint on the origin with the bottom at z=0; optionally scale to exact (x, y, z)."""
    lo, hi = bounds(ob)
    L.move(ob, (-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    if size:
        d = hi - lo
        L.move(ob, scale=(size[0] / d.x, size[1] / d.y, size[2] / d.z))
    return ob


# ------------------------------------------------------------------ props
def ac_unit():
    p = []
    for sx in (-0.8, 0.8):
        p.append(B("foot", 0.14, 0.9, 0.08, (sx, 0, 0.04), DARK))
    p.append(B("case", 2.2, 0.94, 0.9, (0, 0, 0.53), CASE, 0.03))
    p.append(B("lid", 2.2, 1.0, 0.07, (0, 0, 1.015), CASE2, 0.015))
    p.append(B("seam", 0.03, 0.02, 0.86, (0, -0.475, 0.53), MID))
    p.append(B("kick", 2.1, 0.02, 0.07, (0, -0.475, 0.13), MID))
    yf = -0.47
    for cx in (-0.55, 0.55):
        cz = 0.56
        p.append(L.cyl("well", 0.37, 0.03, (cx, yf - 0.005, cz), (PI / 2, 0, 0), BLACK, seg=16))
        p.append(L.torus("rim", 0.385, 0.03, (cx, yf - 0.02, cz), (PI / 2, 0, 0), CASE2, seg=20, tseg=4))
        p.append(L.cyl("hub", 0.085, 0.07, (cx, yf - 0.035, cz), (PI / 2, 0, 0), MID, seg=8))
        for k in range(5):
            a = 2 * PI * k / 5 + 0.3
            p.append(B("blade", 0.27, 0.012, 0.13, (cx + math.cos(a) * 0.2, yf - 0.03, cz + math.sin(a) * 0.2), CASE2,
                       rot=(0.45, -a, 0)))
        p.append(L.torus("grille", 0.22, 0.009, (cx, yf - 0.055, cz), (PI / 2, 0, 0), STEEL, seg=16, tseg=3))
        for a in (0, PI / 2, PI / 4, -PI / 4):
            p.append(B("bar", 0.74, 0.012, 0.014, (cx, yf - 0.055, cz), STEEL, rot=(0, a, 0)))
    for sx in (-1, 1):                                               # louvred side vents
        for k in range(5):
            p.append(B("louvre", 0.03, 0.6, 0.05, (sx * 1.105, 0, 0.36 + k * 0.1), MID, rot=(0, sx * 0.5, 0)))
    p.append(B("led", 0.07, 0.012, 0.03, (0.0, -0.476, 0.93), E_CYAN))
    p.append(B("plate", 0.22, 0.012, 0.1, (0.0, -0.475, 0.2), YELLOW))
    p.append(L.cyl("conduit", 0.06, 0.2, (0.7, 0.55, 0.22), (PI / 2, 0, 0), RUST, seg=8))
    p.append(B("jbox", 0.3, 0.08, 0.3, (0.7, 0.5, 0.3), MID, 0.01))
    return fit(L.join(p, "ACUnit"), (2.2, 1.0, 1.05))


def crate():
    p = [B("body", 1.2, 0.9, 0.9, (0, 0, 0.5), PURPLE, 0.015)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(B("post", 0.13, 0.13, 1.0, (sx * 0.585, sy * 0.435, 0.5), FRAME, 0.015))
        for z in (0.05, 0.95):
            p.append(B("railY", 0.1, 0.78, 0.1, (sx * 0.6, 0, z), FRAME))
    for sy in (-1, 1):
        for z in (0.05, 0.95):
            p.append(B("railX", 1.06, 0.1, 0.1, (0, sy * 0.45, z), FRAME))
    p.append(B("lid", 1.1, 0.8, 0.03, (0, 0, 0.96), L.mat(0x5a5488, 0.6, 0.3), 0.01))
    p.append(B("strip", 1.04, 0.02, 0.1, (0, -0.458, 0.5), E_CYAN))
    for x in (-0.3, 0.3):                                            # latches + hazard tag
        p.append(B("latch", 0.1, 0.03, 0.14, (x, -0.47, 0.84), STEEL, 0.008))
    p.append(B("tag", 0.3, 0.012, 0.16, (0.3, -0.456, 0.25), YELLOW))
    p.append(B("tagk", 0.1, 0.014, 0.16, (0.3, -0.457, 0.25), BLACK, rot=(0, 0.6, 0)))
    for sx in (-1, 1):                                               # side handles
        p.append(L.tube("handle", [(sx * 0.6, -0.14, 0.62), (sx * 0.67, -0.14, 0.6), (sx * 0.67, 0.14, 0.6), (sx * 0.6, 0.14, 0.62)],
                        0.016, STEEL, seg=4))
    return fit(L.join(p, "Crate"), (1.3, 1.0, 1.0))


def vending():
    body = L.mat(0x1b1b28, 0.45, 0.4)
    p = [B("plinth", 0.94, 0.7, 0.06, (0, 0, 0.03), BLACK),
         B("body", 1.0, 0.76, 1.92, (0, 0, 1.02), body, 0.03)]
    yf = -0.38
    wx, wz, ww, wh = -0.15, 1.12, 0.6, 1.02                           # product window
    p.append(B("glow", ww, 0.02, wh, (wx, yf - 0.005, wz), E_PANEL))
    for (sx, sz, lx, lz) in ((ww + 0.06, 0.03, 0, wh / 2), (ww + 0.06, 0.03, 0, -wh / 2), (0.03, wh, ww / 2, 0), (0.03, wh, -ww / 2, 0)):
        p.append(B("wframe", sx, 0.03, sz, (wx + lx, yf - 0.012, wz + lz), E_MAG))
    for r in range(4):
        z = wz - wh / 2 + 0.07 + r * 0.245
        p.append(B("shelf", ww - 0.03, 0.03, 0.02, (wx, yf - 0.014, z), BLACK))
        for c in range(5):
            p.append(B("can", 0.075, 0.03, 0.15, (wx - 0.22 + c * 0.11, yf - 0.02, z + 0.085), CAN[(r * 2 + c) % 5]))
    px = 0.33                                                          # control column
    p.append(B("panel", 0.22, 0.02, 0.62, (px, yf - 0.006, 1.2), MID, 0.008))
    p.append(B("screen", 0.16, 0.012, 0.1, (px, yf - 0.018, 1.42), E_CYAN))
    for i in range(6):
        p.append(B("key", 0.04, 0.012, 0.04, (px - 0.05 + (i % 3) * 0.05, yf - 0.018, 1.27 - (i // 3) * 0.06), E_GREEN))
    p.append(B("coin", 0.05, 0.014, 0.1, (px, yf - 0.018, 1.02), BLACK))
    p.append(B("slot", 0.62, 0.03, 0.2, (wx, yf - 0.006, 0.33), BLACK, 0.01))
    p.append(B("flap", 0.56, 0.02, 0.13, (wx, yf - 0.022, 0.35), MID, rot=(-0.2, 0, 0)))
    p.append(B("light", 0.94, 0.05, 0.2, (0, yf - 0.02, 1.84), E_MAG, 0.01))
    p.append(B("brand", 0.5, 0.012, 0.07, (-0.14, yf - 0.05, 1.84), WHITE))
    p.append(B("kick", 0.94, 0.02, 0.1, (0, yf - 0.004, 0.13), FRAME))
    for sx in (-1, 1):
        p.append(B("stripe", 0.012, 0.6, 0.05, (sx * 0.502, 0, 1.6), E_CYAN))
    p.append(B("vent", 0.5, 0.02, 0.3, (0, 0.385, 0.5), MID))
    return fit(L.join(p, "Vending"), (1.0, 0.8, 2.0))


def chair(name, m):
    p = [B("seat", 0.46, 0.44, 0.04, (0, -0.02, 0.44), m, 0.015),
         B("apron", 0.4, 0.38, 0.05, (0, -0.02, 0.4), m)]
    for sx in (-1, 1):
        p.append(L.tube("legF", [(sx * 0.255, -0.26, 0), (sx * 0.2, -0.2, 0.42)], 0.024, m, seg=4))
        p.append(L.tube("legB", [(sx * 0.255, 0.25, 0), (sx * 0.2, 0.17, 0.44), (sx * 0.21, 0.24, 0.89)], 0.024, m, seg=4))
    for z, w in ((0.6, 0.09), (0.72, 0.08), (0.83, 0.1)):
        y = 0.17 + (z - 0.44) / 0.45 * 0.07
        p.append(B("slat", 0.44, 0.025, w, (0, y, z), m, 0.008, rot=(-0.15, 0, 0)))
    return fit(L.join(p, name), (0.56, 0.56, 0.9))


def cooler():
    p = [B("body", 0.58, 0.38, 0.29, (0, 0, 0.145), WHITE, 0.02),
         B("lid", 0.6, 0.4, 0.09, (0, 0, 0.335), COOLB, 0.02),
         B("band", 0.585, 0.385, 0.05, (0, 0, 0.16), COOLB),
         B("latch", 0.07, 0.02, 0.08, (0, -0.2, 0.28), MID),
         L.tube("handle", [(-0.2, 0, 0.37), (-0.2, 0.03, 0.4), (0.2, 0.03, 0.4), (0.2, 0, 0.37)], 0.012, MID, seg=4)]
    return fit(L.join(p, "Cooler"), (0.6, 0.4, 0.4))


def sat_dish():
    p = [B("base", 0.72, 0.72, 0.07, (0, 0, 0.035), DARK, 0.01)]
    for x in (-0.2, 0.2):
        p.append(B("block", 0.3, 0.5, 0.12, (x, 0.02, 0.13), MID, 0.012))
    p.append(L.cyl("mast", 0.045, 0.95, (0, 0, 0.545), m=STEEL, seg=8))
    p.append(L.tube("brace", [(0, 0.3, 0.08), (0, 0, 0.6)], 0.018, STEEL))
    # dish built along +Z, then tilted to look up and toward -Y
    n, rad, k, th = 16, 0.8, 0.36, 0.022
    rs = [0.06, 0.25, 0.45, 0.63, 0.8]
    prof = [(r, k * r * r) for r in rs] + [(r, k * r * r - th) for r in reversed(rs)]
    circ = [(math.cos(2 * PI * i / n), math.sin(2 * PI * i / n)) for i in range(n)]
    d = [L.loft("dish", [[(c * r, s * r, z) for c, s in circ] for r, z in prof], L.mat(0xc9c6cc, 0.4, 0.3))]
    d.append(L.torus("rim", rad, 0.018, (0, 0, k * rad * rad - th / 2), m=CASE2, seg=n, tseg=4))
    f = 0.62
    for a in (PI / 2, PI / 2 + 2.1, PI / 2 - 2.1):
        d.append(T("strut", (math.cos(a) * 0.78, math.sin(a) * 0.78, k * 0.61), (0, 0, f), 0.012, STEEL))
    d.append(L.cyl("lnb", 0.05, 0.14, (0, 0, f), m=DARK, seg=8))
    d.append(L.cyl("lnbcap", 0.055, 0.03, (0, 0, f - 0.08), m=E_MAG, seg=8))
    d.append(B("mount", 0.16, 0.16, 0.2, (0, 0, -0.1), MID, 0.015))
    dish = L.join(d, "dishasm")
    L.move(dish, (0, -0.05, 1.12), (R(52), 0, 0))
    p.append(dish)
    p.append(L.tube("cable", [(0, 0.02, 1.0), (0.05, 0.06, 0.6), (0.06, 0.1, 0.1), (0.3, 0.3, 0.02)], 0.012, BLACK))
    return fit(L.join(p, "SatDish"))


def antenna_mast():
    p = [B("plate", 0.8, 0.8, 0.06, (0, 0, 0.03), DARK, 0.01)]
    H, b0, b1 = 5.2, 0.3, 0.07
    w = lambda z: b0 + (b1 - b0) * (z - 0.06) / (H - 0.06)       # noqa: E731
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for sx, sy in corners:
        p.append(T("leg", (sx * b0, sy * b0, 0.06), (sx * b1, sy * b1, H), 0.022, FRAME))
    levels = [0.06, 1.0, 1.9, 2.75, 3.5, 4.15, 4.7, H]
    for i, z in enumerate(levels[1:], 1):
        a, zp = w(z), levels[i - 1]
        ap = w(zp)
        for j in range(4):
            (x0, y0), (x1, y1) = corners[j], corners[(j + 1) % 4]
            p.append(T("ring", (x0 * a, y0 * a, z), (x1 * a, y1 * a, z), 0.012, FRAME))
            if (i + j) % 2:
                p.append(T("diag", (x0 * ap, y0 * ap, zp), (x1 * a, y1 * a, z), 0.01, FRAME))
            else:
                p.append(T("diag", (x1 * ap, y1 * ap, zp), (x0 * a, y0 * a, z), 0.01, FRAME))
    p.append(L.cyl("pole", 0.028, 0.85, (0, 0, H + 0.4), m=STEEL, seg=6))
    p.append(L.sphere("beacon", 0.075, (0, 0, H + 0.86), E_RED, seg=8, rings=6))
    p.append(B("armA", 1.7, 0.05, 0.05, (0, 0, 4.45), FRAME))
    p.append(B("armB", 0.05, 1.3, 0.05, (0, 0, 3.7), FRAME))
    for x in (-0.82, 0.82):
        p.append(B("panel", 0.13, 0.09, 0.75, (x, -0.05, 4.6), CASE, 0.015))
    p.append(B("panel", 0.09, 0.13, 0.6, (0.03, -0.62, 3.9), CASE, 0.015))
    p.append(L.cyl("whip", 0.012, 0.9, (0, 0.62, 4.15), m=STEEL, seg=5))
    p.append(L.cyl("drum", 0.26, 0.12, (0.0, -0.3, 2.9), (PI / 2, 0, 0), CASE2, seg=12, bevel=0.015))
    p.append(B("drumarm", 0.05, 0.2, 0.05, (0, -0.2, 2.9), FRAME))
    p.append(B("cabinet", 0.36, 0.24, 0.5, (0.0, -0.16, 0.34), MID, 0.015))
    p.append(B("cabled", 0.05, 0.012, 0.03, (0.08, -0.283, 0.5), E_GREEN))
    p.append(L.tube("cable", [(0.08, -0.1, 0.55), (0.2, 0.2, 1.4), (0.14, 0.15, 3.0), (0.06, 0.06, 4.4)], 0.014, BLACK))
    p.append(B("warn", 0.05, 0.05, 0.05, (0, 0, 2.75), E_RED))
    return fit(L.join(p, "AntennaMast"))


def water_tank():
    p = []
    LG = 0.95
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(B("leg", 0.14, 0.14, 1.62, (sx * LG, sy * LG, 0.81), DARK, 0.012))
            p.append(B("foot", 0.3, 0.3, 0.04, (sx * LG, sy * LG, 0.02), MID))
    cs = [(-LG, -LG), (LG, -LG), (LG, LG), (-LG, LG)]
    for j in range(4):
        (x0, y0), (x1, y1) = cs[j], cs[(j + 1) % 4]
        p.append(T("brA", (x0, y0, 0.2), (x1, y1, 1.5), 0.03, FRAME))
        p.append(T("brB", (x1, y1, 0.2), (x0, y0, 1.5), 0.03, FRAME))
    p.append(L.cyl("deck", 1.5, 0.1, (0, 0, 1.67), m=DARK, seg=20))
    p.append(L.cyl("tank", 1.46, 2.2, (0, 0, 2.82), m=RUST, seg=24))
    for z in (1.95, 2.82, 3.7):
        p.append(L.cyl("band", 1.49, 0.09, (0, 0, z), m=RUSTD, seg=24, caps=False))
    for i in range(12):                                             # stave lines
        a = 2 * PI * i / 12 + 0.13
        p.append(B("stave", 0.03, 0.02, 2.16, (math.cos(a) * 1.462, math.sin(a) * 1.462, 2.82), RUST2, rot=(0, 0, a + PI / 2)))
    p.append(L.cyl("eave", 1.56, 0.06, (0, 0, 3.94), m=RUSTD, seg=24))
    p.append(L.cyl("lid", 1.54, 0.6, (0, 0, 4.27), m=RUST2, seg=24, r2=0.14))
    p.append(L.cyl("finial", 0.1, 0.1, (0, 0, 4.6), m=RUSTD, seg=8))
    for x in (-0.2, 0.2):                                           # ladder
        p.append(T("rail", (x, -1.56, 0), (x, -1.56, 4.0), 0.022, STEEL))
    for i in range(10):
        z = 0.35 + i * 0.38
        p.append(T("rung", (-0.2, -1.56, z), (0.2, -1.56, z), 0.016, STEEL))
    p.append(L.tube("pipe", [(0.5, 0.3, 1.62), (0.5, 0.3, 0.25), (0.5, 1.3, 0.25), (0.5, 1.3, 0.0)], 0.07, MID, seg=8))
    p.append(L.cyl("valve", 0.13, 0.04, (0.5, 0.3, 0.9), (0, PI / 2, 0), L.mat(0xc0413a, 0.5, 0.3), seg=8))
    p.append(B("gauge", 0.06, 0.02, 1.2, (0.75, -1.3, 2.8), DARK, rot=(0, 0, R(30))))
    p.append(B("level", 0.03, 0.022, 0.7, (0.752, -1.302, 2.6), E_CYAN, rot=(0, 0, R(30))))
    return fit(L.join(p, "WaterTank"))


def bonsai():
    def ring(w, d, z):
        return L.ring(L.superellipse(w, d, 12, 5.0), z)
    p = [L.loft("pot", [ring(0.4, 0.28, 0.03), ring(0.5, 0.36, 0.2), ring(0.56, 0.42, 0.21), ring(0.56, 0.42, 0.25),
                         ring(0.48, 0.34, 0.25), ring(0.48, 0.34, 0.22)], POT)]
    for sx in (-0.16, 0.16):
        p.append(B("foot", 0.08, 0.26, 0.04, (sx, 0, 0.02), POT))
    p.append(B("soil", 0.47, 0.33, 0.02, (0, 0, 0.225), SOIL))
    p.append(L.sphere("moss", 0.08, (0.12, -0.05, 0.235), LEAF2, seg=8, rings=5, scale=(1.3, 1, 0.4)))
    trunk = [(-0.06, 0, 0.22), (0.04, 0.02, 0.4), (-0.07, -0.02, 0.56), (0.05, 0.03, 0.72), (0.0, 0.0, 0.9), (0.03, -0.02, 1.02)]
    p.append(L.tube("trunk", trunk[:3], 0.05, BARK, seg=8))
    p.append(L.tube("trunk2", trunk[2:], 0.034, BARK, seg=8))
    p.append(L.tube("root", [(-0.06, 0, 0.3), (-0.16, 0.05, 0.225)], 0.03, BARK))
    pads = [((0.3, 0.02, 0.6), 0.2, LEAF), ((-0.3, -0.03, 0.74), 0.22, LEAF2), ((0.2, 0.06, 0.9), 0.19, LEAF2), ((0.02, -0.02, 1.08), 0.2, LEAF)]
    srcs = [trunk[2], trunk[3], trunk[4], trunk[5]]
    for (c, r, m), s in zip(pads, srcs):
        p.append(L.tube("branch", [s, (c[0] * 0.8, c[1], c[2] - 0.03)], 0.018, BARK))
        p.append(L.sphere("pad", r, c, m, seg=10, rings=6, scale=(1.15, 0.95, 0.38)))
        p.append(L.sphere("pad2", r * 0.7, (c[0] + r * 0.55, c[1] + 0.06, c[2] + 0.04), LEAF if m is LEAF2 else LEAF2, seg=8, rings=5, scale=(1.1, 0.95, 0.4)))
        p.append(L.sphere("pad3", r * 0.65, (c[0] - r * 0.5, c[1] - 0.07, c[2] + 0.05), m, seg=8, rings=5, scale=(1.1, 0.95, 0.4)))
    return fit(L.join(p, "Bonsai"))


def solar_panel():
    t = R(28)
    c, s = math.cos(t), math.sin(t)
    P = (0, 0, 0.6)                                                   # panel centre
    on = lambda u, h: (0, u * c - h * s, 0.6 + u * s + h * c)      # noqa: E731  (u along slope, h along normal)
    p = [B("frame", 1.6, 1.25, 0.05, P, STEEL, 0.01, rot=(t, 0, 0)),
         B("cells", 1.52, 1.17, 0.012, on(0, 0.027), CELL, rot=(t, 0, 0))]
    for x in (-0.38, 0, 0.38):
        q = on(0, 0.031)
        p.append(B("gridv", 0.012, 1.16, 0.008, (x, q[1], q[2]), CELLL, rot=(t, 0, 0)))
    for u in (-0.29, 0.29):
        p.append(B("gridh", 1.51, 0.012, 0.008, on(u, 0.031), CELLL, rot=(t, 0, 0)))
    p.append(B("edge", 1.5, 0.02, 0.02, on(-0.61, 0.035), E_CYAN, rot=(t, 0, 0)))
    for sx in (-0.65, 0.65):
        f, b = on(-0.5, -0.03), on(0.5, -0.03)
        p.append(T("legF", (sx, f[1], 0), (sx, f[1], f[2]), 0.025, MID))
        p.append(T("legB", (sx, b[1], 0), (sx, b[1], b[2]), 0.025, MID))
        p.append(T("rail", (sx, f[1], 0.05), (sx, b[1], 0.05), 0.02, MID))
        p.append(T("brace", (sx, f[1], 0.05), (sx, b[1], b[2] - 0.1), 0.014, MID))
    b = on(0.5, -0.03)
    p.append(T("cross", (-0.65, b[1], 0.1), (0.65, b[1], b[2] - 0.1), 0.014, MID))
    p.append(B("jbox", 0.2, 0.1, 0.14, on(0.3, -0.07), DARK, rot=(t, 0, 0)))
    return fit(L.join(p, "SolarPanel"))


def shack():
    yF, yB, hF, hB, W = -1.1, 1.5, 2.28, 2.56, 3.8
    hz = lambda y: hF + (hB - hF) * (y - yF) / (yB - yF)            # noqa: E731
    p = [L.prism("walls", [(yF, 0), (yB, 0), (yB, hB), (yF, hF)], W, L.mat(0x3a4a58, 0.8, 0.3))]
    door_x, win_x = (-1.4, -0.45), (0.35, 1.45)
    # patchwork sheets + ribs on the front
    sheets = [(-1.9, -1.45, TEAL), (-0.4, 0.3, RUSTO), (0.3, 1.9, SBLUE)]
    for x0, x1, m in sheets:
        p.append(B("sheet", x1 - x0 - 0.02, 0.03, hF - 0.06, ((x0 + x1) / 2, yF - 0.015, hF / 2), m))
    x = -1.84
    while x < 1.88:
        m = next((mm for a, b, mm in sheets if a <= x < b), TEAL)
        if not (door_x[0] - 0.08 < x < door_x[1] + 0.08):
            if win_x[0] - 0.1 < x < win_x[1] + 0.1:
                p.append(B("rib", 0.05, 0.035, 0.84, (x, yF - 0.04, 0.44), m))
            else:
                p.append(B("rib", 0.05, 0.035, hF - 0.1, (x, yF - 0.04, hF / 2), m))
        x += 0.19
    for sx, cols in ((-1, (RUSTO, TEAL)), (1, (TEAL, SBLUE))):       # sides
        for (y0, y1), m in zip(((yF, 0.3), (0.3, yB)), cols):
            h = hz(y0)
            p.append(B("sheet", 0.03, y1 - y0 - 0.02, h - 0.06, (sx * (W / 2 + 0.015), (y0 + y1) / 2, h / 2), m))
            y = y0 + 0.1
            while y < y1 - 0.05:
                p.append(B("rib", 0.035, 0.05, h - 0.1, (sx * (W / 2 + 0.04), y, h / 2), m))
                y += 0.2
    # back wall: one long patched sheet with wider-spaced ribs
    for (x0, x1), m in (((-1.9, 0.5), SBLUE), ((0.5, 1.9), RUSTO)):
        p.append(B("sheet", x1 - x0 - 0.02, 0.03, hB - 0.06, ((x0 + x1) / 2, yB + 0.015, hB / 2), m))
        x = x0 + 0.15
        while x < x1 - 0.05:
            p.append(B("rib", 0.05, 0.035, hB - 0.1, (x, yB + 0.04, hB / 2), m))
            x += 0.32
    # door
    dx = (door_x[0] + door_x[1]) / 2
    p.append(B("doorframe", 1.03, 0.06, 2.0, (dx, yF - 0.02, 1.0), FRAME))
    p.append(B("door", 0.9, 0.05, 1.9, (dx, yF - 0.04, 0.96), L.mat(0x5a6478, 0.6, 0.4), 0.012))
    p.append(B("doorpanel", 0.7, 0.02, 0.6, (dx, yF - 0.07, 0.5), MID))
    p.append(B("doorwin", 0.3, 0.02, 0.3, (dx, yF - 0.07, 1.5), E_PANEL))
    p.append(B("knob", 0.05, 0.06, 0.14, (dx + 0.34, yF - 0.08, 1.0), STEEL))
    p.append(B("step", 1.1, 0.35, 0.08, (dx, yF - 0.2, 0.04), MID, 0.01))
    # bulkhead lamp over the door
    p.append(B("lampbase", 0.2, 0.06, 0.14, (dx, yF - 0.05, 2.1), DARK))
    p.append(B("lamp", 0.14, 0.08, 0.1, (dx, yF - 0.1, 2.1), E_WARM, 0.02))
    for k in (-0.045, 0, 0.045):
        p.append(B("cage", 0.012, 0.1, 0.13, (dx + k, yF - 0.105, 2.1), BLACK))
    p.append(B("cageh", 0.17, 0.106, 0.012, (dx, yF - 0.105, 2.1), BLACK))
    # window with a warm glow, mullions, sill and awning
    wx = (win_x[0] + win_x[1]) / 2
    p.append(B("winframe", 1.14, 0.05, 0.86, (wx, yF - 0.035, 1.33), FRAME))
    p.append(B("glass", 1.0, 0.05, 0.72, (wx, yF - 0.045, 1.33), E_WARM))
    p.append(B("mullv", 0.04, 0.07, 0.72, (wx, yF - 0.045, 1.33), FRAME))
    p.append(B("mullh", 1.0, 0.064, 0.04, (wx, yF - 0.045, 1.4), FRAME))
    p.append(B("sill", 1.2, 0.14, 0.04, (wx, yF - 0.07, 0.9), MID))
    p.append(B("awning", 1.4, 0.5, 0.03, (wx, yF - 0.24, 1.93), AWN, rot=(R(-24), 0, 0)))
    p.append(B("awnedge", 1.4, 0.03, 0.1, (wx, yF - 0.47, 1.79), L.mat(0xf5f1ff, 0.8, 0)))
    for sx in (-0.66, 0.66):
        p.append(T("strut", (wx + sx, yF - 0.02, 1.76), (wx + sx, yF - 0.45, 1.84), 0.012, FRAME))
    # roof: sloped slab with ribs, overhanging the front
    a = math.atan2(hB - hF, yB - yF)
    y0, y1 = -1.5, 1.52
    yc = (y0 + y1) / 2
    zc = hz(yc) + 0.03
    ln = (y1 - y0) / math.cos(a)
    p.append(B("roof", 4.0, ln, 0.05, (0, yc, zc), ROOF, rot=(a, 0, 0)))
    x = -1.9
    i = 0
    while x < 1.95:
        p.append(B("roofrib", 0.07, ln - 0.03, 0.035, (x, yc - 0.04 * math.sin(a), zc + 0.04), L.mat(0x6a708e, 0.6, 0.5) if i % 5 else RUSTO, rot=(a, 0, 0)))
        x += 0.253
        i += 1
    p.append(B("fascia", 3.98, 0.04, 0.1, (0, y0 + 0.01, hz(y0) - 0.02), FRAME))
    p.append(L.cyl("flue", 0.07, 0.4, (1.4, -0.3, hz(-0.3) + 0.12), m=RUST2, seg=8))
    p.append(L.cyl("fluecap", 0.11, 0.04, (1.4, -0.3, hz(-0.3) + 0.3), m=RUSTD, seg=8))
    p.append(B("neon", 0.03, 0.03, 1.5, (1.82, yF - 0.07, 1.25), E_MAG))
    return fit(L.join(p, "Shack"), (4.0, 3.0, 2.6))


def roof_duct():
    w = 0.66
    prof = [(-1.2, 0), (-0.6, 0), (-0.6, 0.45), (0.98, 0.45), (0.98, 0.95), (-0.95, 0.95), (-1.2, 0.7)]
    p = [L.prism("duct", prof, w, CASE, axis="Y", bevel=0.02)]
    for z in (0.06, 0.38):
        p.append(B("flangeR", 0.68, w + 0.1, 0.04, (-0.9, 0, z), CASE2))
    for x in (-0.3, 0.35):
        p.append(B("flangeH", 0.04, w + 0.1, 0.58, (x, 0, 0.7), CASE2))
    p.append(B("hood", 0.22, w + 0.1, 0.58, (1.09, 0, 0.7), MID, 0.02))
    p.append(B("mouth", 0.02, w - 0.04, 0.44, (1.205, 0, 0.7), BLACK))
    for k in range(4):
        p.append(B("slat", 0.07, w - 0.02, 0.02, (1.21, 0, 0.54 + k * 0.105), CASE2, rot=(0, R(35), 0)))
    for sy in (-0.24, 0.24):
        p.append(T("leg", (0.6, sy, 0), (0.6, sy, 0.46), 0.025, DARK))
    p.append(B("foot", 0.2, 0.66, 0.03, (0.6, 0, 0.015), DARK))
    p.append(B("hatch", 0.4, 0.02, 0.28, (0.0, -w / 2 - 0.008, 0.7), MID, 0.008))
    p.append(B("label", 0.16, 0.012, 0.1, (-0.9, -w / 2 - 0.006, 0.24), YELLOW))
    p.append(B("led", 0.04, 0.012, 0.04, (0.14, -w / 2 - 0.02, 0.78), E_CYAN))
    return fit(L.join(p, "RoofDuct"))


def barrel():
    n = 16
    prof = [(0.0, 0.275), (0.02, 0.292), (0.28, 0.292), (0.3, 0.3), (0.32, 0.292), (0.58, 0.292), (0.6, 0.3), (0.62, 0.292),
            (0.88, 0.292), (0.9, 0.3), (0.9, 0.27), (0.875, 0.27)]
    circ = [(math.cos(2 * PI * i / n), math.sin(2 * PI * i / n)) for i in range(n)]
    p = [L.loft("drum", [[(c * r, s * r, z) for c, s in circ] for z, r in prof], DRUM)]
    p.append(L.cyl("stripe", 0.2945, 0.18, (0, 0, 0.45), m=YELLOW, seg=n, caps=False))
    for i in range(8):
        a = 2 * PI * i / 8
        p.append(B("tick", 0.05, 0.012, 0.2, (math.cos(a) * 0.293, math.sin(a) * 0.293, 0.45), BLACK, rot=(0, 0.6, a + PI / 2)))
    p.append(L.cyl("bung", 0.04, 0.03, (0.14, 0.05, 0.885), m=STEEL, seg=8))
    p.append(L.cyl("bung2", 0.025, 0.025, (-0.16, -0.06, 0.885), m=STEEL, seg=6))
    return fit(L.join(p, "Barrel"))


# ------------------------------------------------------------------ build
def main():
    props = [ac_unit(), crate(), vending(), chair("ChairRed", RED), chair("ChairBlue", BLUE), cooler(), sat_dish(),
             antenna_mast(), water_tank(), bonsai(), solar_panel(), shack(), roof_duct(), barrel()]
    for i, o in enumerate(props):                                     # spread out so nothing occludes its neighbour
        L.move(o, (i * 10.0, 0, 0))
    L.bake_ao(props, samples=24, distance=0.5, floor=0.3)
    for o in props:
        print(o.name, [round(v, 3) for v in o.dimensions], L.tris([o]))
    L.check(props)                                                    # while still spread out
    for i, o in enumerate(props):
        L.move(o, (-i * 10.0, 0, 0))
    props += L.lods(props, 0.4)                                       # _LOD1 for dressing away from the lane
    L.palettize(props, "Props", emit_strength=1.0)
    r = L.export(props, "props.glb")
    print("EXPORT", r["files"][0]["kb"], "kB", r["files"][0]["summary"])

    if os.environ.get("NO_PREVIEW"):
        return
    pv = os.environ.get("PROPS_PV", "/home/user/tools/pv")
    groups = {"units": ["ACUnit", "Crate", "Vending", "RoofDuct", "Barrel"],
              "seating": ["ChairRed", "Cooler", "ChairBlue", "Bonsai", "SolarPanel"],
              "tall": ["SatDish", "WaterTank", "AntennaMast"],
              "shack": ["Shack"]}
    only = os.environ.get("GROUPS")
    by = {o.name: o for o in props}
    for g, names in groups.items():
        if only and g not in only.split(","):
            continue
        x = 0.0
        moved = []
        for o in props:
            o.hide_render = o.name not in names
        for nme in names:
            o = by[nme]
            w = o.dimensions.x
            L.move(o, (x + w / 2, 0, 0))
            moved.append((o, x + w / 2))
            x += w + max(0.25, w * 0.25)
        bpy.context.view_layer.update()
        L.preview(os.path.join(pv, f"props_{g}.png"), [by[n] for n in names], res=(640, 480), samples=24)
        for o, dx in moved:
            L.move(o, (-dx, 0, 0))


if __name__ == "__main__":
    main()
