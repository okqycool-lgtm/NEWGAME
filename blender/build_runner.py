"""The runner: a modelled courier-thief, split into rigid parts at the joints src/runner.js animates.

Each part's origin is its joint pivot in the rest pose, so the game drops the meshes straight onto
its existing pivots. Blender axes here: +Y is the character's front (three.js -Z), +X their right.
Run: tools/.venv/bin/python blender/build_runner.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib as L  # noqa: E402

HIP = 0.8


def glow(g):                       # same self-illumination curve the box runner used, so he reads at night
    return g * 1.1 + 0.07


def build():
    L.reset()
    M = dict(
        jacket=L.mat(0xff4a1c, 0.55, 0.05, glow(0.3)), jdark=L.mat(0xc7330f, 0.6, 0.05, glow(0.2)),
        shirt=L.mat(0x1d3b45, 0.7, 0.0, glow(0.12)), pants=L.mat(0x565b6e, 0.75, 0.0, glow(0.2)),
        pocket=L.mat(0x6c7186, 0.7, 0.0, glow(0.2)), armor=L.mat(0x8a90a4, 0.45, 0.4, glow(0.2)),
        skin=L.mat(0xe8b08a, 0.55, 0.0, glow(0.12)), hair=L.mat(0x2a2438, 0.35, 0.0, glow(0.14)),
        streak=L.mat(0xfff2b0, 0.4, 0.0, glow(0.55)), chrome=L.mat(0xd4deea, 0.18, 1.0, 0.08),
        boot=L.mat(0x2e2f3a, 0.6, 0.0, glow(0.12)), sole=L.mat(0x2c2c34, 0.8, 0.0, glow(0.05)),
        pack=L.mat(0x2d2f3e, 0.65, 0.0, glow(0.14)), strap=L.mat(0x474a5c, 0.6, 0.0, glow(0.14)),
        cash=L.mat(0x35ff6b, 0.5, 0.0, glow(0.75)), band=L.mat(0xffffff, 0.5, 0.0, glow(0.5)),
        cyan=L.mat(0x39f0ff, 0.4, 0.0, glow(1.0)), red=L.mat(0xff3b30, 0.4, 0.0, glow(1.0)),
        visor=L.mat(0x39f0ff, 0.15, 0.0, glow(0.9)), dark=L.mat(0x101016, 0.4, 0.2, glow(0.02)),
    )

    def limb(name, secs, m, n=12, p=2.6, sub=1):
        """Loft up the Z axis. secs: (z, width_x, depth_y, cx, cy)."""
        rings = [L.ring(L.superellipse(w, d, n, p), z, "Z", (cx, cy)) for z, w, d, cx, cy in secs]
        ob = L.loft(name, rings, m)
        if sub:
            L.subsurf(ob, sub)
        return ob

    parts = {}

    # ---------------------------------------------------------------- pelvis
    o = [limb("hips", [(0.70, 0.36, 0.22, 0, 0), (0.75, 0.50, 0.28, 0, 0), (0.86, 0.52, 0.29, 0, 0), (0.94, 0.46, 0.26, 0, 0)], M["pants"]),
         limb("belt", [(0.89, 0.535, 0.30, 0, 0), (0.925, 0.53, 0.297, 0, 0)], M["cyan"], sub=0, n=16),
         L.box("buckle", 0.11, 0.03, 0.075, (0, 0.152, 0.902), m=M["chrome"], bevel=0.008),
         L.box("pouchL", 0.07, 0.15, 0.13, (-0.275, -0.03, 0.82), (0, 0.12, 0), M["pocket"], bevel=0.015),
         L.box("pouchR", 0.07, 0.13, 0.11, (0.275, -0.05, 0.83), (0, -0.12, 0), M["pocket"], bevel=0.015),
         L.box("pouchFlap", 0.075, 0.155, 0.03, (-0.28, -0.03, 0.875), (0, 0.12, 0), M["strap"], bevel=0.008)]
    parts["Pelvis"] = (o, (0, 0, HIP))

    # ---------------------------------------------------------------- legs
    for tag, sx in (("L", -1), ("R", 1)):
        x = sx * 0.125
        o = [limb("thigh", [(0.84, 0.19, 0.22, x, 0), (0.74, 0.24, 0.265, x, 0), (0.58, 0.225, 0.25, x, 0.005),
                            (0.44, 0.195, 0.215, x, 0), (0.36, 0.16, 0.18, x, 0)], M["pants"]),
             L.box("pocket", 0.06, 0.17, 0.17, (x + sx * 0.118, 0.0, 0.57), (0, sx * -0.04, 0), M["pocket"], bevel=0.015),
             L.box("pflap", 0.066, 0.18, 0.045, (x + sx * 0.121, 0.0, 0.648), (0, sx * -0.04, 0), M["strap"], bevel=0.008),
             limb("strap", [(0.695, 0.25, 0.275, x, 0), (0.725, 0.252, 0.277, x, 0)], M["strap"], sub=0, n=16)]
        if sx > 0:
            o.append(L.box("holster", 0.05, 0.1, 0.16, (x + 0.125, 0.03, 0.74), m=M["dark"], bevel=0.012))
        parts["Thigh" + tag] = (o, (x, 0, 0.77))

        o = [L.sphere("knee", 0.1, (x, 0.0, 0.39), M["pants"], 12, 8, (1, 1.05, 1)),
             L.box("kneepad", 0.15, 0.05, 0.15, (x, 0.108, 0.39), (0.1, 0, 0), M["armor"], bevel=0.02),
             L.box("kneepad2", 0.09, 0.02, 0.08, (x, 0.136, 0.39), (0.1, 0, 0), M["dark"], bevel=0.008),
             limb("shin", [(0.43, 0.17, 0.19, x, 0), (0.31, 0.205, 0.225, x, -0.012), (0.19, 0.18, 0.2, x, 0), (0.12, 0.17, 0.19, x, 0)], M["pants"]),
             # boot: cuff, shaft, foot, sole with a light strip, chrome spring heel
             limb("cuff", [(0.155, 0.215, 0.235, x, 0), (0.2, 0.225, 0.245, x, 0), (0.215, 0.205, 0.225, x, 0)], M["boot"], sub=0, n=16),
             limb("shaft", [(0.02, 0.2, 0.22, x, 0.0), (0.16, 0.205, 0.225, x, 0)], M["boot"], sub=0, n=16),
             L.loft("foot", [L.ring(L.superellipse(w, h, 12, 3.2), y, "Y", (x, cz)) for y, w, h, cz in
                             [(-0.125, 0.15, 0.09, 0.05), (-0.1, 0.2, 0.13, 0.065), (0.06, 0.215, 0.14, 0.07), (0.17, 0.215, 0.115, 0.058),
                              (0.245, 0.19, 0.085, 0.043), (0.275, 0.13, 0.05, 0.03)]], M["boot"]),
             L.box("toecap", 0.2, 0.09, 0.03, (x, 0.215, 0.092), (-0.35, 0, 0), M["armor"], bevel=0.012),
             L.box("sole", 0.235, 0.41, 0.045, (x, 0.07, -0.006), m=M["sole"], bevel=0.015),
             L.box("soleglow", 0.226, 0.4, 0.012, (x, 0.07, 0.022), m=M["cyan"]),
             L.box("laces", 0.1, 0.02, 0.1, (x, 0.118, 0.12), (-0.5, 0, 0), M["strap"], bevel=0.006),
             L.cyl("spring", 0.036, 0.15, (x, -0.16, 0.085), m=M["chrome"], seg=10),
             L.cyl("springcap", 0.05, 0.03, (x, -0.16, 0.165), m=M["chrome"], seg=10, bevel=0.006),
             L.box("springarm", 0.07, 0.07, 0.035, (x, -0.125, 0.16), m=M["armor"], bevel=0.008),
             L.box("heelpad", 0.09, 0.08, 0.025, (x, -0.16, -0.004), m=M["cyan"], bevel=0.008)]
        L.subsurf(o[6], 1)
        parts["Shin" + tag] = (o, (x, 0, 0.39))

    # ---------------------------------------------------------------- torso
    o = [limb("waist", [(0.86, 0.42, 0.24, 0, 0), (0.98, 0.42, 0.245, 0, 0), (1.12, 0.47, 0.265, 0, 0)], M["shirt"]),
         limb("jacket", [(1.07, 0.5, 0.29, 0, 0), (1.1, 0.57, 0.33, 0, 0), (1.25, 0.59, 0.34, 0, 0.005), (1.36, 0.57, 0.32, 0, 0),
                         (1.43, 0.46, 0.27, 0, -0.005), (1.47, 0.26, 0.2, 0, -0.01)], M["jacket"], n=14, p=3.0),
         limb("hem", [(1.06, 0.585, 0.34, 0, 0), (1.115, 0.59, 0.345, 0, 0)], M["jdark"], sub=0, n=16, p=3.0),
         L.box("zip", 0.022, 0.02, 0.3, (0, 0.166, 1.26), m=M["dark"]),
         L.box("chestpatch", 0.09, 0.02, 0.035, (-0.16, 0.166, 1.33), m=M["cyan"]),
         limb("neck", [(1.42, 0.15, 0.15, 0, -0.005), (1.5, 0.14, 0.14, 0, 0)], M["skin"], sub=0, n=12, p=2.0),
         # popped collar: a tall ring, lower at the throat
         L.loft("collar", [[(0.5 * w * math.cos(a), -0.01 + 0.5 * d * math.sin(a), z + (0.035 if math.sin(a) < 0.3 else 0.0) * k)
                            for a in (2 * math.pi * i / 16 for i in range(16))]
                           for z, w, d, k in [(1.41, 0.36, 0.3, 0), (1.5, 0.35, 0.3, 1), (1.505, 0.3, 0.25, 1), (1.42, 0.27, 0.22, 0)]],
                M["jdark"], cap=False, loop=True),
         # pack straps over the shoulders
         L.box("strapL", 0.07, 0.025, 0.34, (-0.17, 0.158, 1.27), (0.04, 0, 0.1), M["strap"], bevel=0.008),
         L.box("strapR", 0.07, 0.025, 0.34, (0.17, 0.158, 1.27), (0.04, 0, -0.1), M["strap"], bevel=0.008),
         L.box("strapTopL", 0.07, 0.34, 0.03, (-0.17, -0.01, 1.428), (0, -0.42, 0), M["strap"], bevel=0.008),
         L.box("strapTopR", 0.07, 0.34, 0.03, (0.17, -0.01, 1.428), (0, 0.42, 0), M["strap"], bevel=0.008),
         L.box("sternum", 0.3, 0.02, 0.035, (0, 0.172, 1.3), m=M["strap"], bevel=0.006),
         L.box("clip", 0.06, 0.03, 0.05, (0, 0.18, 1.3), m=M["chrome"], bevel=0.008),
         L.box("strapled", 0.03, 0.02, 0.03, (-0.175, 0.176, 1.38), m=M["red"])]
    parts["Torso"] = (o, (0, 0, 0.9))

    # ---------------------------------------------------------------- head
    hz = 1.43
    o = [limb("skull", [(hz + 0.035, 0.16, 0.19, 0, 0.03), (hz + 0.07, 0.27, 0.29, 0, 0.012), (hz + 0.15, 0.36, 0.36, 0, 0),
                        (hz + 0.25, 0.39, 0.385, 0, 0), (hz + 0.33, 0.37, 0.375, 0, -0.005), (hz + 0.39, 0.27, 0.29, 0, -0.01),
                        (hz + 0.41, 0.12, 0.14, 0, -0.01)], M["skin"], n=14, p=2.5),
         L.box("nose", 0.05, 0.06, 0.07, (0, 0.185, hz + 0.155), (0.35, 0, 0), M["skin"], bevel=0.018),
         L.box("mouth", 0.09, 0.012, 0.012, (0, 0.165, hz + 0.085), m=M["dark"]),
         limb("visor", [(hz + 0.19, 0.4, 0.4, 0, 0.012), (hz + 0.265, 0.405, 0.405, 0, 0.012)], M["visor"], sub=0, n=20, p=2.5),
         limb("visorRimA", [(hz + 0.178, 0.412, 0.412, 0, 0.012), (hz + 0.192, 0.412, 0.412, 0, 0.012)], M["dark"], sub=0, n=20, p=2.5),
         limb("visorRimB", [(hz + 0.263, 0.416, 0.416, 0, 0.012), (hz + 0.278, 0.416, 0.416, 0, 0.012)], M["dark"], sub=0, n=20, p=2.5),
         L.box("earL", 0.04, 0.07, 0.09, (-0.193, -0.02, hz + 0.17), m=M["skin"], bevel=0.015),
         L.box("earR", 0.04, 0.07, 0.09, (0.193, -0.02, hz + 0.17), m=M["skin"], bevel=0.015),
         L.cyl("implant", 0.05, 0.035, (-0.212, -0.02, hz + 0.225), (0, math.pi / 2, 0), M["chrome"], seg=10, bevel=0.006),
         L.box("implantled", 0.012, 0.03, 0.03, (-0.233, -0.02, hz + 0.225), m=M["cyan"]),
         # hair: a swept cap, the back of the head, and spikes raked backwards
         L.sphere("haircap", 0.2, (0, -0.02, hz + 0.31), M["hair"], 14, 8, (1.05, 1.08, 0.74)),
         L.box("fringe", 0.3, 0.07, 0.07, (-0.02, 0.185, hz + 0.31), (0.25, 0, 0.12), M["hair"], bevel=0.02),
         limb("hairback", [(hz + 0.04, 0.26, 0.1, 0, -0.14), (hz + 0.16, 0.38, 0.16, 0, -0.125), (hz + 0.3, 0.37, 0.18, 0, -0.115)], M["hair"], n=10),
         L.box("sideburnL", 0.03, 0.09, 0.14, (-0.19, 0.05, hz + 0.3), m=M["hair"], bevel=0.01),
         L.box("sideburnR", 0.03, 0.09, 0.14, (0.19, 0.05, hz + 0.3), m=M["hair"], bevel=0.01)]

    def spike(x, y, z, tilt, lean, ln=0.26, r=0.075, m="hair"):
        return L.cyl("spike", r * 1.3, ln * 1.12, (x, y, z - 0.015), (tilt + 0.12, lean, 0), M[m], seg=7, r2=0.006)

    o += [spike(-0.11, 0.1, hz + 0.44, 0.75, -0.18), spike(0.0, 0.12, hz + 0.455, 0.65, 0.0, 0.3, 0.085), spike(-0.15, -0.02, hz + 0.43, 1.0, -0.3),
          spike(-0.05, -0.02, hz + 0.47, 0.95, -0.05, 0.32, 0.09), spike(-0.12, -0.14, hz + 0.39, 1.25, -0.22), spike(0.0, -0.15, hz + 0.41, 1.2, 0.05, 0.3, 0.085),
          spike(-0.06, -0.21, hz + 0.3, 1.5, -0.1, 0.26), spike(0.07, -0.22, hz + 0.26, 1.6, 0.12, 0.24), spike(-0.14, -0.2, hz + 0.2, 1.75, -0.25, 0.22),
          spike(0.02, -0.21, hz + 0.14, 1.9, 0.0, 0.2), spike(0.16, -0.16, hz + 0.33, 1.3, 0.3, 0.24),
          # bleached streak along the right side
          spike(0.12, 0.11, hz + 0.445, 0.7, 0.2, 0.3, 0.08, "streak"), spike(0.13, -0.03, hz + 0.455, 1.0, 0.22, 0.32, 0.085, "streak"),
          spike(0.12, -0.16, hz + 0.38, 1.3, 0.2, 0.28, 0.075, "streak")]
    parts["Head"] = (o, (0, 0, hz))

    # ---------------------------------------------------------------- backpack (pivot at its centre)
    px, py, pz = 0.04, -0.29, 1.2
    o = [L.loft("packbody", [L.ring(L.superellipse(w, d, 14, 3.4), pz + z, "Z", (px, py + cy)) for z, w, d, cy in
                             [(-0.25, 0.36, 0.2, 0), (-0.21, 0.46, 0.27, 0), (0.0, 0.5, 0.3, -0.01), (0.18, 0.47, 0.28, 0), (0.235, 0.4, 0.22, 0)]], M["pack"]),
         L.box("frontpocket", 0.34, 0.09, 0.2, (px, py - 0.155, pz - 0.08), m=M["strap"], bevel=0.03),
         L.box("pocketzip", 0.26, 0.012, 0.015, (px, py - 0.203, pz - 0.02), m=M["chrome"]),
         L.box("sideL", 0.07, 0.16, 0.2, (px - 0.255, py, pz - 0.1), m=M["strap"], bevel=0.025),
         L.box("sideR", 0.07, 0.16, 0.2, (px + 0.255, py, pz - 0.1), m=M["strap"], bevel=0.025),
         L.box("flap", 0.5, 0.2, 0.035, (px, py + 0.09, pz + 0.245), (0.5, 0, 0), M["strap"], bevel=0.012),
         L.cyl("roll", 0.07, 0.5, (px, py - 0.02, pz - 0.3), (0, math.pi / 2, 0), M["shirt"], seg=12, bevel=0.012),
         L.box("rollstrapA", 0.035, 0.155, 0.155, (px - 0.14, py - 0.02, pz - 0.3), m=M["strap"], bevel=0.008),
         L.box("rollstrapB", 0.035, 0.155, 0.155, (px + 0.14, py - 0.02, pz - 0.3), m=M["strap"], bevel=0.008),
         L.box("led", 0.05, 0.02, 0.025, (px + 0.1, py - 0.205, pz - 0.13), m=M["red"]),
         L.cyl("aerial", 0.008, 0.3, (px + 0.22, py - 0.08, pz + 0.3), (0, 0.15, 0), M["chrome"], seg=6),
         L.sphere("aerialtip", 0.02, (px + 0.265, py - 0.08, pz + 0.45), M["cyan"], 8, 6)]
    # cash bundles bursting out of the top (same spots the box runner used)
    for i, (bx, by, bz, r) in enumerate([(-0.13, 0.3, 0.02, 0.3), (0.08, 0.32, 0.0, -0.25), (0.0, 0.28, 0.08, 0.1), (0.17, 0.27, 0.06, -0.6), (-0.18, 0.25, 0.09, 0.7)]):
        loc, rot = (px + bx, py - bz, pz + by), (r * 0.4, r, r)
        o.append(L.box(f"cash{i}", 0.2, 0.1, 0.12, loc, rot, M["cash"], bevel=0.012))
        o.append(L.box(f"band{i}", 0.06, 0.106, 0.126, loc, rot, M["band"]))
    o.append(L.box("cashside", 0.14, 0.06, 0.08, (px - 0.29, py - 0.02, pz - 0.0), (0, 0.5, 0), M["cash"], bevel=0.01))
    parts["Pack"] = (o, (px, py, pz))

    # ---------------------------------------------------------------- arms
    for tag, sx in (("L", -1), ("R", 1)):
        x = sx * 0.375
        o = [L.sphere("shoulder", 0.1, (x, 0, 1.385), M["jacket"], 12, 8, (1, 1.08, 1)),
             limb("sleeve", [(1.41, 0.15, 0.17, x, 0), (1.31, 0.19, 0.215, x, 0), (1.17, 0.18, 0.2, x, 0), (1.115, 0.175, 0.195, x, 0)], M["jacket"]),
             limb("cuff", [(1.095, 0.19, 0.21, x, 0), (1.13, 0.19, 0.21, x, 0)], M["jdark"], sub=0, n=16)]
        if sx < 0:      # armoured pauldron on the chrome-arm side
            o += [L.sphere("pauldron", 0.125, (x - 0.012, 0, 1.405), M["armor"], 12, 8, (1.0, 1.12, 0.78), (0, 0.35, 0)),
                  L.sphere("pauldronstripe", 0.127, (x - 0.012, 0, 1.405), M["cyan"], 12, 8, (1.0, 0.16, 0.78), (0, 0.35, 0))]
        else:
            o += [L.box("patch", 0.012, 0.09, 0.09, (x + 0.103, 0, 1.28), m=M["streak"], bevel=0.004)]
        parts["UpperArm" + tag] = (o, (x, 0, 1.37))

        if sx < 0:      # chrome cyber forearm
            o = [L.sphere("elbow", 0.09, (x, 0, 1.11), M["armor"], 12, 8),
                 limb("forearm", [(1.09, 0.13, 0.15, x, 0), (1.01, 0.175, 0.195, x, 0), (0.91, 0.15, 0.165, x, 0), (0.87, 0.125, 0.14, x, 0)], M["chrome"]),
                 limb("ring", [(1.025, 0.19, 0.21, x, 0), (1.055, 0.19, 0.21, x, 0)], M["cyan"], sub=0, n=16),
                 limb("wrist", [(0.855, 0.14, 0.155, x, 0), (0.885, 0.14, 0.155, x, 0)], M["dark"], sub=0, n=16),
                 L.cyl("piston", 0.018, 0.2, (x, -0.105, 0.98), (0.12, 0, 0), M["armor"], seg=8),
                 L.box("panel", 0.012, 0.07, 0.1, (x - 0.085, 0, 0.98), m=M["dark"]),
                 L.sphere("hand", 0.075, (x, 0.01, 0.8), M["chrome"], 12, 8, (0.8, 1.0, 1.05)),
                 L.box("knuckles", 0.1, 0.06, 0.04, (x, 0.045, 0.77), m=M["armor"], bevel=0.012),
                 L.sphere("thumb", 0.032, (x + 0.055, 0.045, 0.82), M["chrome"], 8, 6)]
        else:
            o = [L.sphere("elbow", 0.085, (x, 0, 1.11), M["jacket"], 12, 8),
                 limb("forearm", [(1.09, 0.13, 0.15, x, 0), (1.02, 0.16, 0.18, x, 0), (0.91, 0.135, 0.15, x, 0), (0.87, 0.115, 0.13, x, 0)], M["skin"]),
                 limb("wrap", [(0.86, 0.135, 0.15, x, 0), (0.92, 0.15, 0.165, x, 0)], M["boot"], sub=0, n=16),
                 L.box("watch", 0.012, 0.06, 0.045, (x + 0.076, 0, 0.9), m=M["cyan"]),
                 L.sphere("hand", 0.075, (x, 0.01, 0.8), M["boot"], 12, 8, (0.8, 1.0, 1.05)),
                 L.box("knuckles", 0.1, 0.06, 0.04, (x, 0.045, 0.77), m=M["armor"], bevel=0.012),
                 L.sphere("thumb", 0.032, (x - 0.055, 0.045, 0.82), M["skin"], 8, 6)]
        parts["Forearm" + tag] = (o, (x, 0, 1.11))

    objs = []
    for name, (members, pivot) in parts.items():
        ob = L.join(members, name)
        objs.append(ob)
    return objs, {n: p for n, (_, p) in parts.items()}


if __name__ == "__main__":
    objs, pivots = build()
    L.bake_ao(objs, samples=32, distance=0.22, floor=0.5)
    L.palettize(objs, "Runner")
    if "--nopreview" not in sys.argv:
        L.preview(os.path.join(L.PREVIEW, "runner.png"), objs, views=((180, 8), (0, 8), (135, 15), (300, 18)), res=(520, 640), samples=24)
        L.preview(os.path.join(L.PREVIEW, "runner_head.png"), [o for o in objs if o.name in ("Head", "Torso", "Pack")],
                  views=((205, 10), (30, 20)), res=(560, 560), samples=24, ground=False)
    for ob in objs:
        L.set_origin(ob, pivots[ob.name])
    L.check(objs)
    print(L.export(objs, "runner.glb"))
