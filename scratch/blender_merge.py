import bpy
import os
import glob
import sys

bpy.ops.wm.read_factory_settings(use_empty=True)

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mixamo_dir = os.path.join(base_dir, "mixamo", "Character")
out_path = os.path.join(base_dir, "client", "public", "models", "AnimatedSoldier.glb")

character_file = os.path.join(mixamo_dir, "Character.fbx")

if not os.path.exists(character_file):
    print("\n[ERROR] Character.fbx not found!")
    sys.exit(1)

print("\n--- IMPORTING CHARACTER ---")
bpy.ops.import_scene.fbx(filepath=character_file)

main_armature = None
for obj in bpy.context.scene.objects:
    if obj.type == 'ARMATURE':
        main_armature = obj
        break

if not main_armature:
    print("[ERROR] No armature found!")
    sys.exit(1)

main_armature.name = "Armature"
if not main_armature.animation_data:
    main_armature.animation_data_create()

for track in main_armature.animation_data.nla_tracks:
    main_armature.animation_data.nla_tracks.remove(track)

if main_armature.animation_data.action:
    main_armature.animation_data.action.name = "TPose"
    track = main_armature.animation_data.nla_tracks.new()
    track.name = "TPose"
    track.strips.new("TPose", int(main_armature.animation_data.action.frame_range[0]), main_armature.animation_data.action)

print("\n--- IMPORTING ANIMATIONS ---")
fbx_files = glob.glob(os.path.join(mixamo_dir, "*.fbx"))
for fbx in fbx_files:
    if os.path.basename(fbx).lower() == "character.fbx":
        continue
        
    anim_name = os.path.splitext(os.path.basename(fbx))[0]
    print(f"Importing animation: {anim_name}")
    
    bpy.ops.import_scene.fbx(filepath=fbx)
    
    new_armature = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE' and obj != main_armature:
            new_armature = obj
            break
            
    if new_armature and new_armature.animation_data and new_armature.animation_data.action:
        action = new_armature.animation_data.action
        action.name = anim_name
        
        track = main_armature.animation_data.nla_tracks.new()
        track.name = anim_name
        track.strips.new(action.name, int(action.frame_range[0]), action)
        
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj != main_armature and obj.parent != main_armature:
            obj.select_set(True)
    bpy.ops.object.delete()

print("\n--- EXPORTING GLB ---")
os.makedirs(os.path.dirname(out_path), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_animations=True,
    export_nla_strips=True,
    export_current_frame=False,
    export_materials='EXPORT',
    export_image_format='JPEG',
    export_jpeg_quality=75
)

print(f"\n[SUCCESS] Exported {out_path}!\n")
