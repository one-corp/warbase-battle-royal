import os

def replace_in_file(path, replacements):
    with open(path, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)

style_path = 'client/src/ui/style.css'
index_path = 'client/index.html'

replacements = [
    ('#cfa55f', '#00ffcc'),
    ('207,165,95', '0,255,204'),
    ('Rajdhani', 'Oswald'),
    ('rgba(0,255,204,0.05)', 'rgba(0,255,204,0.1)'), # adjust opacities a bit if needed
    ('linear-gradient(135deg, #00ffcc 0%, #a07830 100%)', '#00ffcc'), # Fix gradient button
    ('border-radius: 50%', 'border-radius: 0'), # Remove rounding for indicator
    ('box-shadow: 0 0 8px rgba(0,255,204,0.5)', 'box-shadow: none'), # Remove glow
]

replace_in_file(style_path, replacements)
replace_in_file(index_path, replacements)
print("UI files updated!")
