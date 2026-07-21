import os

def replace_in_file(path, replacements):
    with open(path, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)

ts_path = 'client/src/main.ts'

replacements = [
    ('#cfa55f', '#00ffcc'),
    ('207, 165, 95', '0, 255, 204'),
    ('207,165,95', '0,255,204'),
    ('Rajdhani', 'Oswald'),
]

replace_in_file(ts_path, replacements)
print("main.ts updated!")
