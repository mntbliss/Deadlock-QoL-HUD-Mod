from PIL import Image, ImageDraw, ImageFilter
import math
import os

out_dir = os.path.dirname(os.path.abspath(__file__))
size = 256
img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

cell = 32
dots = [
    (2.0, 2.0, 1.25),
    (6.0, 2.0, 1.05),
    (2.0, 6.0, 1.05),
    (6.0, 6.0, 1.35),
]

cx = cy = size / 2
max_r = size * 0.48
# Hollow ring only — no filled disk (that became the armored orange blast).
inner_r = 0.58
outer_r = 1.0

for gy in range(size // cell):
    for gx in range(size // cell):
        ox = gx * cell
        oy = gy * cell
        for dx, dy, r in dots:
            px = ox + dx * (cell / 8.0)
            py = oy + dy * (cell / 8.0)
            dist = math.hypot(px - cx, py - cy) / max_r
            if dist < inner_r or dist > outer_r:
                continue
            # Soft edge only near outer rim; keep dots crisp, no center fill.
            edge = 1.0 - abs(dist - 0.78) / 0.28
            fall = max(0.0, min(1.0, edge)) ** 0.85
            rad = r * (cell / 8.0) * 1.1
            for k in range(3, 0, -1):
                rr = rad * (k / 3.0)
                a = int(255 * fall * (0.25 + 0.75 * (k / 3.0)))
                draw.ellipse([px - rr, py - rr, px + rr, py + rr], fill=(255, 255, 255, a))

img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
path = os.path.join(out_dir, "soul_orb_dot_grid.png")
img.save(path, "PNG")
print("wrote", path)
