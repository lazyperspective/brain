"""key stills (finished, vertical framing) + contact sheet."""
import os, sys, cv2, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from finish import Finisher, ROOT
OUT = os.path.join(ROOT, "out")
os.makedirs(os.path.join(OUT, "stills"), exist_ok=True)
fin = Finisher("vertical")
KEYS = [(0, "00_frame0_drop_falling"), (22, "01_vortex_ring_through_old_ink"), (80, "02_bloom_forming_forest"), (134, "03_forest_clearest"),
        (232, "04_forest_dissolves_next_drop"), (344, "05_whale_clearest"), (444, "06_whale_dissolves_next_drop"), (500, "07_bloom_forming_city"),
        (554, "08_city_clearest"), (710, "09_bloom_forming_face"), (764, "10_face_clearest"), (832, "11_face_breaking_up")]
for f, name in KEYS:
    cv2.imwrite(os.path.join(OUT, "stills", f"{name}_f{f:03d}.jpg"), fin.frame(f)[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, 94])
    print(name, flush=True)
# contact sheet: 28 frames, one per second
tiles = []
for i in range(28):
    f = i * 30
    im = cv2.resize(fin.frame(f), (270, 480), interpolation=cv2.INTER_AREA)[:, :, ::-1].copy()
    cv2.putText(im, f"{f / 30:.0f}s", (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (60, 40, 30), 1, cv2.LINE_AA)
    tiles.append(im)
rows = [np.hstack(tiles[r * 7:(r + 1) * 7]) for r in range(4)]
cv2.imwrite(os.path.join(OUT, "contact_sheet.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 90])
print("contact sheet done")
