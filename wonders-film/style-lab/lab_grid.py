#!/usr/bin/env python3
"""style-lab: out/styles_grid.jpg - the snapshot frame in the current look and the five new directions, labelled."""
import os
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
TILES = [('style_0_current.png', '0  CURRENT  -  reference-derived ink + flat fill'),
         ('style_1_riso.png', '1  RISO  "Spot-Ink Atlas"'),
         ('style_2_watercolour.png', '2  WATERCOLOUR  "Field Journal"'),
         ('style_3_blueprint.png', '3  CYANOTYPE  "Patent & Gilt"'),
         ('style_4_papercut.png', '4  CUT PAPER  "Paper Theatre"'),
         ('style_5_cloisonne.png', '5  CLOISONNE  "Enamel & Gold"')]
TW, TH, PAD = 960, 540, 12
sheet = np.full((2 * TH + 3 * PAD, 3 * TW + 4 * PAD, 3), 24, np.uint8)
for k, (fn, label) in enumerate(TILES):
    im = cv2.imread(os.path.join(OUT, fn))
    im = cv2.resize(im, (TW, TH), interpolation=cv2.INTER_AREA)
    band = im[TH - 46:, :].astype(np.float32)
    im[TH - 46:, :] = (band * 0.35 + 8).astype(np.uint8)
    cv2.putText(im, label, (18, TH - 15), cv2.FONT_HERSHEY_DUPLEX, 0.78, (245, 245, 245), 1, cv2.LINE_AA)
    r, c = divmod(k, 3)
    y, x = PAD + r * (TH + PAD), PAD + c * (TW + PAD)
    sheet[y:y + TH, x:x + TW] = im
p = os.path.join(OUT, 'styles_grid.jpg')
cv2.imwrite(p, sheet, [cv2.IMWRITE_JPEG_QUALITY, 92])
print(p)
