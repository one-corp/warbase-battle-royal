import bpy
import os
import glob
import sys

# Clear existing objects in the default Blender scene (like the default cube, camera, and light)
bpy.ops.wm.read_factory_settings(use_empty=True)

# Define paths relative to this script
base_dir = os.path.dirname(os.path.abspath(__file__))
mixamo_dir = os.path.join(base_dir, "mixamo")
out_path = os.path.join(base_dir, "fps-game", "public", "models", "AnimatedSoldier.glb")

character_file = os.path.join(mixamo_dir, "Character.fbx")

if not os.path.exists(character_file):
    print("\n[ERROR] Character.fbx not found in the 'mixamo' folder!")
    print(f"Expected to find it here: {character_file}")
    sys.exit(1)

print("\n--- IMPORTING CHARACTER ---")
# Import Character
bpy.ops.import_scene.fbx(filepath=character_file)

main_armature = None
for obj in bpy.context.scene.objects:
    if obj.type == 'ARMATURE':
        main_armature = obj
        break

if not main_armature:
    print("[ERROR] No armature found in Character.fbx!")
    sys.exit(1)

# Standardize the rig name for Babylon.js
main_armature.name = "Armature"
if not main_armature.animation_data:
    main_armature.animation_data_create()

# Clear any default NLA tracks on the main character
for track in main_armature.animation_data.nla_tracks:
    main_armature.animation_data.nla_tracks.remove(track)

# Check if the main character has an action, rename it to TPose
if main_armature.animation_data.action:
    main_armature.animation_data.action.name = "TPose"
    track = main_armature.animation_data.nla_tracks.new()
    track.name = "TPose"
    track.strips.new("TPose", int(main_armature.animation_data.action.frame_range[0]), main_armature.animation_data.action)

print("\n--- IMPORTING ANIMATIONS ---")
# Import all other FBX files as animations
fbx_files = glob.glob(os.path.join(mixamo_dir, "*.fbx"))
for fbx in fbx_files:
    if os.path.basename(fbx).lower() == "character.fbx":
        continue
        
    anim_name = os.path.splitext(os.path.basename(fbx))[0]
    print(f"Importing animation: {anim_name}")
    
    # Import animation fbx
    bpy.ops.import_scene.fbx(filepath=fbx)
    
    # Find the newly imported armature (it's the one that isn't the main_armature)
    new_armature = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE' and obj != main_armature:
            new_armature = obj
            break
            
    if new_armature and new_armature.animation_data and new_armature.animation_data.action:
        action = new_armature.animation_data.action
        action.name = anim_name
        
        # (Skipping root motion strip to rely on Mixamo's "In Place" checkbox)
        
        # Stash the action onto the main armature so the GLTF exporter bundles it
        track = main_armature.animation_data.nla_tracks.new()
        track.name = anim_name
        track.strips.new(action.name, int(action.frame_range[0]), action)
        
    # Delete the imported objects (the temporary animation armature and its meshes)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj != main_armature and obj.parent != main_armature:
            obj.select_set(True)
    bpy.ops.object.delete()

print("\n--- EXPORTING GLB ---")
# Create output directory if it doesn't exist
os.makedirs(os.path.dirname(out_path), exist_ok=True)

# Export to GLB with compression settings to drastically reduce 115MB -> ~5MB
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_animations=True,
    export_nla_strips=True,
    export_current_frame=False,
    export_materials='EXPORT',
    export_image_format='JPEG',
    export_jpeg_quality=75 # Compress textures
)

print(f"\n[SUCCESS] Exported {out_path}!")
print("You can now start your game, the new character is ready!\n")
