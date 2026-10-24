# The four slides side by side with gaps, as a carousel shows them.
#   python3 contact_sheet.py  ->  output/00-slides-overview.jpg
from pathlib import Path
from PIL import Image

here = Path(__file__).parent / 'output'
names = ['01-the-design', '02-the-ascent', '03-the-sun', '04-the-sea']
w, h, gap, pad = 540, 960, 28, 48
sheet = Image.new('RGB', (pad * 2 + w * 4 + gap * 3, pad * 2 + h), (24, 23, 26))
for i, n in enumerate(names):
    src = here / f'{n}-1080x1920.png'
    im = Image.open(src if src.exists() else here / f'{n}.png').convert('RGB').resize((w, h), Image.LANCZOS)
    sheet.paste(im, (pad + i * (w + gap), pad))
sheet.save(here / '00-slides-overview.jpg', quality=92)
print('wrote', here / '00-slides-overview.jpg')
