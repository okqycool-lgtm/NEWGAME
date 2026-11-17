"""Emulates the Blender CLI on top of the `bpy` Python module. See tools/blender."""
import runpy
import sys
import traceback

import bpy

argv = sys.argv[1:]
rest = []
if "--" in argv:
    i = argv.index("--")
    argv, rest = argv[:i], argv[i + 1:]
blend = script = expr = None
exit_code = 0
i = 0
while i < len(argv):
    a = argv[i]
    if a in ("-P", "--python"):
        script = argv[i + 1]; i += 1
    elif a == "--python-expr":
        expr = argv[i + 1]; i += 1
    elif a == "--python-exit-code":
        exit_code = int(argv[i + 1]); i += 1
    elif a.endswith(".blend"):
        blend = a
    elif a == "--version":
        print("Blender", bpy.app.version_string); sys.exit(0)
    i += 1
if blend:
    bpy.ops.wm.open_mainfile(filepath=blend)
sys.argv = ["blender", "-b"] + (["-P", script] if script else []) + ["--"] + rest
try:
    if expr:
        exec(expr, {"__name__": "__main__"})
    elif script:
        runpy.run_path(script, run_name="__main__")
except SystemExit:
    raise
except Exception:
    traceback.print_exc()
    sys.exit(exit_code or 1)
