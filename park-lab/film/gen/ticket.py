"""Procedural ticket print (no text) -> ../plan/ticket_print.png  (2000 x 960 = 200 x 96 world units at 10 px/unit)."""
import math, numpy as np
from PIL import Image, ImageDraw, ImageFilter
W, H = 2000, 960
rng = np.random.default_rng(3)
cream = (243, 230, 204); red = (200, 70, 58); navy = (46, 41, 78); gold = (217, 164, 65); teal = (47, 110, 142)
im = Image.new('RGB', (W, H), cream); d = ImageDraw.Draw(im)
# paper fibre + age stains
noise = (rng.normal(0, 6, (H // 4, W // 4))).astype(np.int16)
n = Image.fromarray(np.clip(128 + noise, 0, 255).astype('uint8')).resize((W, H), Image.BILINEAR)
im = Image.blend(im, Image.merge('RGB', [n, n, n]), 0.06); d = ImageDraw.Draw(im)
stub = 1560   # perforation x
# red border
d.rectangle([18, 18, W - 18, H - 18], outline=red, width=26)
d.rectangle([56, 56, W - 56, H - 56], outline=gold, width=6)
# scalloped inner frame (main part)
x0, y0, x1, y1 = 90, 90, stub - 50, H - 90
d.rectangle([x0, y0, x1, y1], fill=(250, 240, 220), outline=red, width=8)
for x in range(x0, x1 + 1, 40):
    d.ellipse([x - 20, y0 - 20, x + 20, y0 + 20], fill=cream, outline=red, width=6)
    d.ellipse([x - 20, y1 - 20, x + 20, y1 + 20], fill=cream, outline=red, width=6)
for y in range(y0, y1 + 1, 40):
    d.ellipse([x0 - 20, y - 20, x0 + 20, y + 20], fill=cream, outline=red, width=6)
    d.ellipse([x1 - 20, y - 20, x1 + 20, y + 20], fill=cream, outline=red, width=6)
cx, cy = (x0 + x1) // 2, H // 2
# rays
rays = Image.new('RGB', (W, H), (250, 240, 220)); rd = ImageDraw.Draw(rays)
for k in range(36):
    a0, a1 = k * 10, k * 10 + 5
    rd.pieslice([cx - 900, cy - 900, cx + 900, cy + 900], a0, a1, fill=(247, 222, 180))
mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).rectangle([x0 + 24, y0 + 24, x1 - 24, y1 - 24], fill=255)
im.paste(rays, (0, 0), mask); d = ImageDraw.Draw(im)
# big star
def star(cx, cy, r0, r1, n=5, rot=-math.pi / 2):
    pts = []
    for i in range(2 * n):
        r = r0 if i % 2 == 0 else r1; a = rot + i * math.pi / n
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts
d.ellipse([cx - 300, cy - 300, cx + 300, cy + 300], fill=navy)
d.ellipse([cx - 270, cy - 270, cx + 270, cy + 270], outline=gold, width=10)
d.polygon(star(cx, cy, 230, 95), fill=gold)
d.polygon(star(cx, cy, 190, 78), fill=(244, 185, 66))
# small stars + coaster silhouette band
for sx in (cx - 520, cx + 520):
    d.polygon(star(sx, cy, 70, 28), fill=red)
pts = [(x0 + 60 + i * 12, y1 - 120 - 60 * math.sin(i / 9.0) ** 2) for i in range(int((x1 - x0 - 120) / 12))]
d.line(pts, fill=teal, width=10)
# stub
for y in range(40, H - 40, 34):
    d.ellipse([stub - 8, y - 8, stub + 8, y + 8], fill=(180, 160, 130))
d.rectangle([stub + 60, 110, W - 70, H - 110], outline=red, width=8)
d.polygon(star((stub + W) // 2, H // 2, 120, 50), fill=red)
for k in [0, 1, 5, 6]:
    d.rectangle([stub + 110, 170 + k * 100, W - 120, 184 + k * 100], fill=(220, 200, 170))
# age stains + wear
st = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(st)
for _ in range(14):
    x, y, r = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(40, 220)
    sd.ellipse([x - r, y - r, x + r, y + r], fill=int(rng.uniform(10, 35)))
st = st.filter(ImageFilter.GaussianBlur(40))
brown = Image.new('RGB', (W, H), (150, 110, 60))
im = Image.composite(brown, im, st)
im.save('../plan/ticket_print.png')
print('ticket_print.png')
