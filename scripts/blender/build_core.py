"""
build_core.py — AnyText hero "relay-core" 3D asset (deterministic, headless bpy).

SOLE SOURCE of geometry for public/assets/relay-core.glb + public/assets/connectors.glb.
The .glb files are BUILD ARTIFACTS — never hand-edit them; always regenerate from here.

Run headless:
    /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/build_core.py

What it does (Stage A of docs/design/anytext-3d-asset-pipeline.md):
  1. Procedurally builds the mechanical core via bmesh lathing (revolve) + radial arrays
     — fully deterministic (no randomness, no operator-context surprises).
  2. Assigns 3 factor-only PBR materials (dark metal / royal-blue plastic / emissive lens).
  3. Renders a Cycles preview PNG (studio HDRI + key + blue rim) → docs/assets/relay-core-preview.png
     for the iterate→render→compare loop vs the reference center.
  4. Exports raw GLBs (core + connectors) to scripts/blender/_build/ (+Y up, applied
     transforms, smooth shading). Stage B (gltf-transform Draco) is run separately.

Spec: docs/design/anytext-living-scene-architecture.md §7.5/§7.6/§7.7.
Named separable parts: hub, lens, ring.*, vanes, bolts, tube.blue.*  (§7.6).
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix

# --------------------------------------------------------------------------------------
# Paths (resolved from this script's location → repo root)
# --------------------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() \
    else os.path.join(os.getcwd(), "scripts", "blender")  # cwd = repo root for stdin/exec runs
REPO = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
BUILD_DIR = os.path.join(SCRIPT_DIR, "_build")
HDRI_PATH = os.path.join(REPO, "public", "assets", "hdri", "brown_photostudio_02_1k.hdr")
PREVIEW_PATH = os.path.join(REPO, "docs", "assets", "relay-core-preview.png")
CORE_RAW = os.path.join(BUILD_DIR, "relay-core.raw.glb")
CONN_RAW = os.path.join(BUILD_DIR, "connectors.raw.glb")
os.makedirs(BUILD_DIR, exist_ok=True)

# --------------------------------------------------------------------------------------
# TUNING CONSTANTS  (the iterate-render-compare loop edits these)
# Unit scale: outer rim radius = 1.0. +Z up in Blender (exported as +Y up).
# --------------------------------------------------------------------------------------
SEG = 96            # revolution segments for turned parts (smooth cylinders)
SHARP_ANGLE = 30.0  # deg — edges sharper than this stay crisp (machined look)

VANE_COUNT = 34     # finer blades, recessed in the channel (not a dominant top fan)
VANE_R = 0.49       # radius of vane center (in the channel)
VANE_LEN = 0.17     # radial length
VANE_THICK = 0.018
VANE_HEIGHT = 0.12
VANE_Z = 0.10       # floor the vanes stand on (recessed)
VANE_PITCH = 20.0   # deg turbine pitch

BOLT_COUNT = 24
BOLT_R = 0.90
BOLT_RAD = 0.034
BOLT_H = 0.055
BOLT_Z = 0.40       # sits on the tall rim top

# Royal-blue tube rings (toruses), each: (major_r, minor_r, center_z, tilt_deg, tilt_axis)
# Thick + asymmetric → glossy pipes wrapping one side, like the reference.
TUBES = [
    (0.97, 0.075, 0.26, 22.0, 'X'),    # prominent thick wrap
    (0.92, 0.055, 0.30, -16.0, 'Y'),   # secondary
    (1.00, 0.050, 0.20, 30.0, 'X'),    # subtle low
]

# Camera (oblique 3/4 view matching the reference barrel-reactor)
CAM_AZ = -58.0
CAM_EL = 25.0
CAM_DIST = 3.25
CAM_LENS = 74.0
CAM_TARGET = (0.0, 0.0, 0.21)

# Lighting — dark env + sharp grazing key + strong blue rim = "black + blue" (§7.7)
WORLD_STRENGTH = 0.25
KEY_ENERGY = 850
KEY_SIZE = 1.6
RIM_ENERGY = 1150
FILL_ENERGY = 70

# Materials (linear RGB factors)
COL_METAL = (0.070, 0.078, 0.098)   # dark satin gunmetal, lifted off pure black (§7.7)
ROUGH_METAL = 0.40
COL_BLUE = (0.030, 0.13, 0.80)      # deep royal-blue plastic
ROUGH_BLUE = 0.08
COL_EMIT = (0.06, 0.32, 1.0)        # lens emissive (deep royal blue)
EMIT_STRENGTH = 9.0

RENDER_SAMPLES = 96
RES = 920


# --------------------------------------------------------------------------------------
# Scene reset
# --------------------------------------------------------------------------------------
def reset_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras,
                  bpy.data.lights, bpy.data.images, bpy.data.worlds):
        for b in list(block):
            try:
                block.remove(b)
            except Exception:
                pass


def clear_mesh_objects():
    """Between core and connector exports: drop mesh objects, keep mats/world/cam/lights."""
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)


# --------------------------------------------------------------------------------------
# Materials
# --------------------------------------------------------------------------------------
def make_material(name, base, metallic, roughness, emission=None, emit_strength=0.0,
                  coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    # Look up by type, not the localizable display name, so this is version-robust.
    bsdf = nodes.get("Principled BSDF") or next(
        (n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        return mat
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if coat and "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.08
    if emission is not None:
        # socket is "Emission Color" (Blender 4.x+) or "Emission" (pre-4.0)
        ecol = next((s for s in ("Emission Color", "Emission") if s in bsdf.inputs), None)
        if ecol:
            bsdf.inputs[ecol].default_value = (*emission, 1.0)
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat


def make_materials():
    # 3 factor-only PBR materials, 0 textures. §7.6's "≤2 atlased materials" budget
    # targets texture/atlas/draw cost; with no texture maps these add ~0 bytes and
    # metal/blue/emissive can't meaningfully merge, so 3 is the honest minimal set.
    return {
        "metal": make_material("M_metal", COL_METAL, 1.0, ROUGH_METAL),
        "blue": make_material("M_blue", COL_BLUE, 0.0, ROUGH_BLUE, coat=0.6),
        "emit": make_material("M_emit", (0.01, 0.02, 0.05), 0.0, 0.4,
                              emission=COL_EMIT, emit_strength=EMIT_STRENGTH),
    }


# --------------------------------------------------------------------------------------
# bmesh helpers
# --------------------------------------------------------------------------------------
def _finalize(bm, name, mat):
    """Mark smooth + sharp-by-angle, write to a new identity-transform object."""
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2:
            try:
                if e.calc_face_angle() > math.radians(SHARP_ANGLE):
                    e.smooth = False
            except (ValueError, RuntimeError):
                pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _lathe(bm, profile, segs):
    """Spin a closed (x,z) profile 360° around the Z axis into a watertight surface."""
    verts = [bm.verts.new((x, 0.0, z)) for (x, z) in profile]
    edges = [bm.edges.new((verts[i], verts[(i + 1) % len(verts)])) for i in range(len(verts))]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1),
                   angle=2 * math.pi, steps=segs, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)


def revolve_part(name, profile, mat, segs=SEG):
    """Lathe a closed (x,z) cross-section profile around the Z axis → one named object."""
    bm = bmesh.new()
    _lathe(bm, profile, segs)
    return _finalize(bm, name, mat)


def _radial_array(bm, proto_geom, count):
    """Duplicate proto geometry (count-1) more times, evenly rotated about Z."""
    for i in range(1, count):
        ret = bmesh.ops.duplicate(bm, geom=proto_geom)
        dup_verts = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.rotate(bm, cent=(0, 0, 0), verts=dup_verts,
                         matrix=Matrix.Rotation(i * 2 * math.pi / count, 3, 'Z'))


def build_vanes(mat):
    bm = bmesh.new()
    res = bmesh.ops.create_cube(bm, size=1.0)
    blade = res["verts"]
    M = (Matrix.Translation((VANE_R, 0.0, VANE_Z + VANE_HEIGHT / 2.0))
         @ Matrix.Rotation(math.radians(VANE_PITCH), 4, 'X')
         @ Matrix.Diagonal((VANE_LEN, VANE_THICK, VANE_HEIGHT, 1.0)))
    bmesh.ops.transform(bm, matrix=M, verts=blade)
    proto = list(bm.verts) + list(bm.edges) + list(bm.faces)
    _radial_array(bm, proto, VANE_COUNT)
    return _finalize(bm, "vanes", mat)


def build_bolts(mat):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=6,
                          radius1=BOLT_RAD, radius2=BOLT_RAD, depth=BOLT_H,
                          matrix=Matrix.Translation((BOLT_R, 0.0, BOLT_Z)))
    proto = list(bm.verts) + list(bm.edges) + list(bm.faces)
    _radial_array(bm, proto, BOLT_COUNT)
    return _finalize(bm, "bolts", mat)


def build_tube(name, major_r, minor_r, cz, tilt_deg, axis, mat,
               seg_major=64, seg_minor=14):
    """Torus via lathing a minor circle; then lift + tilt (baked into geometry)."""
    bm = bmesh.new()
    circle = [(major_r + minor_r * math.cos(2 * math.pi * i / seg_minor),
               minor_r * math.sin(2 * math.pi * i / seg_minor)) for i in range(seg_minor)]
    _lathe(bm, circle, seg_major)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, cz))
    bmesh.ops.rotate(bm, cent=(0, 0, cz), verts=bm.verts,
                     matrix=Matrix.Rotation(math.radians(tilt_deg), 3, axis))
    return _finalize(bm, name, mat)


# --------------------------------------------------------------------------------------
# The core (named separable parts)
# --------------------------------------------------------------------------------------
def build_core(mats):
    objs = []
    # ring.mid — wide shallow outer base flange (concentric base step)
    objs.append(revolve_part("ring.mid", [
        (0.86, 0.00), (1.16, 0.00), (1.16, 0.06), (1.10, 0.09), (0.86, 0.09),
    ], mats["metal"]))

    # ring.base — floor disc the channel/vanes stand on
    objs.append(revolve_part("ring.base", [
        (0.00, 0.05), (0.90, 0.05), (0.90, 0.10), (0.00, 0.10),
    ], mats["metal"]))

    # ring.outer — tall machined barrel wall (carries the bolts), chamfered top-outer edge
    objs.append(revolve_part("ring.outer", [
        (0.80, 0.10), (1.00, 0.10), (1.00, 0.34), (0.95, 0.40), (0.80, 0.40),
    ], mats["metal"]))

    # ring.step — inner concentric barrel, lower → visible stepped well
    objs.append(revolve_part("ring.step", [
        (0.58, 0.10), (0.76, 0.10), (0.76, 0.28), (0.72, 0.32), (0.58, 0.32),
    ], mats["metal"]))

    # ring.inner — collar ring around the hub base (inner channel wall)
    objs.append(revolve_part("ring.inner", [
        (0.30, 0.10), (0.40, 0.10), (0.40, 0.22), (0.37, 0.26), (0.30, 0.26),
    ], mats["metal"]))

    # hub — central boss with an internal stepped funnel (concentric machined rings
    # descending to the recessed lens well)
    objs.append(revolve_part("hub", [
        (0.00, 0.10), (0.32, 0.10), (0.32, 0.30), (0.30, 0.345),
        (0.255, 0.345), (0.255, 0.285), (0.205, 0.285), (0.205, 0.235),
        (0.155, 0.235), (0.155, 0.185), (0.00, 0.185),
    ], mats["metal"]))

    # lens — small emissive dome at the bottom of the funnel (contained glow rising
    # through the concentric steps)
    objs.append(revolve_part("lens", [
        (0.00, 0.270), (0.152, 0.190), (0.152, 0.185), (0.00, 0.185),
    ], mats["emit"], segs=64))

    objs.append(build_vanes(mats["metal"]))
    objs.append(build_bolts(mats["metal"]))

    for i, (mr, nr, cz, tilt, axis) in enumerate(TUBES):
        objs.append(build_tube("tube.blue.%d" % i, mr, nr, cz, tilt, axis, mats["blue"]))
    return objs


# --------------------------------------------------------------------------------------
# Companion connectors (floating blue elbow + T fittings) — separate GLB
# --------------------------------------------------------------------------------------
def _straight_tube(bm, length, radius, matrix, seg=20):
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=radius, radius2=radius, depth=length, matrix=matrix)


def build_connectors(mats):
    """Floating royal-blue pipe fittings (elbow + T) — companion props (§7.6)."""
    objs = []
    # elbow: a 90° bent tube (quarter-torus bend)
    bm = bmesh.new()
    r, bend_R, sm = 0.10, 0.18, 12
    circle = [(bend_R + r * math.cos(2 * math.pi * i / sm),
               r * math.sin(2 * math.pi * i / sm)) for i in range(sm)]
    bv = [bm.verts.new((x, 0.0, z)) for (x, z) in circle]
    be = [bm.edges.new((bv[i], bv[(i + 1) % len(bv)])) for i in range(len(bv))]
    bmesh.ops.spin(bm, geom=bv + be, cent=(0, 0, 0), axis=(0, 0, 1),
                   angle=math.pi / 2, steps=16, use_merge=False)
    objs.append(_finalize(bm, "connector.elbow", mats["blue"]))

    # tee: three radial stubs from a central hub sphere
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.13)
    for ang in (0.0, 2 * math.pi / 3, 4 * math.pi / 3):
        mtx = (Matrix.Rotation(ang, 4, 'Z')
               @ Matrix.Translation((0.22, 0.0, 0.0))
               @ Matrix.Rotation(math.radians(90), 4, 'Y'))
        _straight_tube(bm, 0.30, 0.085, mtx, seg=16)
    # bake a separation offset into the geometry (keep identity object transform)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0.9, 0.0, 0.0))
    objs.append(_finalize(bm, "connector.tee", mats["blue"]))
    return objs


# --------------------------------------------------------------------------------------
# World / lights / camera / render
# --------------------------------------------------------------------------------------
def setup_world():
    world = bpy.data.worlds.new("W")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    if os.path.exists(HDRI_PATH):
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(HDRI_PATH)
        bg = nt.nodes.new("ShaderNodeBackground")
        bg.inputs["Strength"].default_value = WORLD_STRENGTH
        dark = nt.nodes.new("ShaderNodeBackground")
        dark.inputs["Color"].default_value = (0.006, 0.008, 0.014, 1.0)
        lp = nt.nodes.new("ShaderNodeLightPath")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
        nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
        nt.links.new(bg.outputs["Background"], mix.inputs[1])   # non-camera → HDRI
        nt.links.new(dark.outputs["Background"], mix.inputs[2])  # camera → dark bg
        nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    else:
        bg = nt.nodes.new("ShaderNodeBackground")
        bg.inputs["Color"].default_value = (0.02, 0.025, 0.04, 1.0)
        bg.inputs["Strength"].default_value = 1.0
        nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def add_area_light(name, loc, energy, color, size):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.color = color
    ld.size = size
    obj = bpy.data.objects.new(name, ld)
    obj.location = loc
    d = Vector((0, 0, 0)) - Vector(loc)
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(obj)


def setup_lights():
    add_area_light("key", (2.3, -1.9, 3.4), KEY_ENERGY, (1.0, 0.96, 0.88), KEY_SIZE)  # grazing warm key
    add_area_light("rim", (-2.4, 1.6, 1.0), RIM_ENERGY, (0.28, 0.5, 1.0), 2.2)        # blue rim
    add_area_light("fill", (-1.6, -2.0, 1.0), FILL_ENERGY, (0.6, 0.75, 1.0), 3.0)     # soft fill


def setup_camera():
    cd = bpy.data.cameras.new("Camera")
    cd.lens = CAM_LENS
    cam = bpy.data.objects.new("Camera", cd)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    az, el, d = math.radians(CAM_AZ), math.radians(CAM_EL), CAM_DIST
    tx, ty, tz = CAM_TARGET
    cam.location = (tx + d * math.cos(el) * math.cos(az),
                    ty + d * math.cos(el) * math.sin(az),
                    tz + d * math.sin(el))
    direction = Vector(CAM_TARGET) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = RENDER_SAMPLES
    scene.cycles.use_denoising = True
    # Use a GPU backend only if it actually enumerates a non-CPU device; else CPU.
    # (Setting device='GPU' with no GPU device makes Cycles error, so we verify first.)
    scene.cycles.device = 'CPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for backend in ('METAL', 'OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
            try:
                prefs.compute_device_type = backend
            except (TypeError, ValueError):
                continue
            try:
                prefs.refresh_devices()
            except Exception:
                try:
                    prefs.get_devices()
                except Exception:
                    pass
            if any(d.type != 'CPU' for d in prefs.devices):
                for d in prefs.devices:
                    d.use = (d.type != 'CPU')
                scene.cycles.device = 'GPU'
                print("Cycles GPU backend:", backend)
                break
    except Exception as e:
        print("GPU setup failed, using CPU:", e)
        scene.cycles.device = 'CPU'
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.film_transparent = False
    try:
        scene.view_settings.view_transform = 'AGX'
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = PREVIEW_PATH


def export_glb(filepath):
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        export_yup=True,
        use_selection=False,
        export_apply=True,
        export_materials='EXPORT',
    )
    print("exported", filepath, os.path.getsize(filepath), "bytes")


# --------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------
def main():
    reset_scene()
    mats = make_materials()
    build_core(mats)
    # Export the GLB deliverable FIRST — it must not depend on the preview render
    # succeeding (the render needs a GPU/HDRI that a headless/CI box may lack).
    export_glb(CORE_RAW)
    setup_world()
    setup_lights()
    setup_camera()
    setup_render()
    print("rendering preview →", PREVIEW_PATH)
    try:
        bpy.ops.render.render(write_still=True)
    except Exception as e:
        print("preview render failed (non-fatal):", e)
    # connectors → separate GLB
    clear_mesh_objects()
    build_connectors(mats)
    export_glb(CONN_RAW)
    print("DONE")


main()
