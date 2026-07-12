import trimesh
import numpy as np

# Create a trunk (brown cylinder)
trunk = trimesh.creation.cylinder(radius=0.2, height=2.0)
trunk.visual.face_colors = [139, 69, 19, 255] # SaddleBrown
trunk.apply_translation([0, 1.0, 0])

# Create leaves (green sphere or cone)
leaves = trimesh.creation.icosphere(subdivisions=2, radius=1.5)
leaves.visual.face_colors = [34, 139, 34, 255] # ForestGreen
leaves.apply_translation([0, 2.5, 0])

# Combine
tree = trimesh.util.concatenate([trunk, leaves])

# Export
tree.export('public/models/tree.glb')
print("Tree GLB created!")
