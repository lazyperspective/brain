#!/usr/bin/env python3
"""Make 1:2 style-prompt cards (1080x2160): title, a snapshot from the film, and a generic style prompt.

  python3 tools/style_cards.py      # reads out/park_film.mp4, writes out/style_prompts/*.png
"""
import os, subprocess, textwrap
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILM = os.path.join(ROOT, 'out', 'park_film.mp4')
OUT = os.path.join(ROOT, 'out', 'style_prompts')
F = '/usr/share/fonts/truetype/dejavu/'
SERIF_B = F + 'DejaVuSerif-Bold.ttf'
SANS = F + 'DejaVuSans.ttf'
SANS_B = F + 'DejaVuSans-Bold.ttf'

W, H, M = 1080, 2160, 60
BG, INK, SOFT = (245, 240, 231), (38, 33, 29), (120, 110, 100)

# (file, title, tagline, film time s, crop x-centre 0..1, accent, prompt)
STYLES = [
    ('01_paper_popup', 'Paper Pop-Up', 'cut cardstock, layered shadows', 2.8, 0.5, (214, 72, 52),
     "[SUBJECT], made as a handcrafted paper pop-up diorama. Everything is cut from matte coloured cardstock "
     "with visible paper grain and crisp hand-cut edges. The scene is built from stacked flat layers with small "
     "gaps, so each layer casts a soft drop shadow on the one below. Simple bold shapes in flat colour, no outlines, "
     "no gradients. Objects stand up on folded hinges like a pop-up book and spring open with a small bouncy "
     "overshoot. Warm tabletop light from the upper left, soft contact shadows, shallow depth of field. "
     "Cosy, handmade, storybook.\n\nAvoid: plastic or CGI shine, photorealism, text, logos."),
    ('02_gouache', 'Gouache', 'painted picture-book', 27.3, 0.55, (86, 128, 170),
     "[SUBJECT], painted in gouache as a moving illustration. Opaque, chalky, matte paint with visible brush "
     "strokes and dabs, slightly uneven painted edges, pigment pooling darker at the edges, and the grain of "
     "watercolour paper showing through. Simplified shapes, warm sunlit planes and cool violet-blue shadows, "
     "a painted sky with soft clouds. Rich but harmonious colour, like a classic picture book brought to life. "
     "Gentle, smooth camera moves.\n\nAvoid: glossy 3D render look, hard CGI edges, photorealism, text, logos."),
    ('03_needle_felt', 'Needle Felt', 'fuzzy wool stop-motion', 11.6, 0.42, (204, 120, 150),
     "[SUBJECT], made entirely of needle-felted wool, like a handmade stop-motion set. Every surface is soft and "
     "fuzzy with visible wool fibres and stray fluffy hairs on the edges; shapes are round, puffy and plush. "
     "Trees are felted balls, the ground is a felt blanket, small details are stitched or embroidered. "
     "Pastel and warm colours, soft diffuse daylight, gentle shadows, shallow depth of field like macro "
     "photography. Animated on twos (12 fps) with a slight stop-motion wobble. Cosy, tactile, cute.\n\n"
     "Avoid: shiny plastic, hard edges, realistic textures, text, logos."),
    ('04_low_poly', 'Low-Poly Tycoon', 'clean faceted 3D', 14.0, 0.30, (40, 140, 210),
     "[SUBJECT], as a clean low-poly 3D diorama, like a polished management or tycoon game. Simple faceted "
     "geometry with flat-shaded triangles and crisp edges, no textures, only solid saturated colours. High "
     "three-quarter isometric view, bright sunny daylight, soft ambient occlusion and clear crisp shadows, "
     "a slight tilt-shift blur at the top and bottom of frame. Lots of tiny details (people, trees, props) "
     "kept simple and readable. Cheerful, tidy, satisfying.\n\nAvoid: realistic textures, grime, heavy fog, "
     "noisy detail, text, logos."),
    ('05_pixel_art', 'Pixel Tycoon', 'isometric pixel art', 18.3, 0.40, (92, 170, 70),
     "[SUBJECT], as crisp isometric pixel art, like a classic 90s simulation or tycoon game. Rendered at low "
     "resolution and scaled up with hard nearest-neighbour pixels, no blur or anti-aliasing. A limited colour "
     "palette with ordered dithering for shading, dark outlines on objects, clean isometric angles, and tiny "
     "animated characters only a few pixels tall. Bright saturated daylight colours and readable shapes. "
     "Snappy, playful motion and zooms in whole-pixel steps.\n\nAvoid: smooth gradients, blurry upscaling, "
     "mixed pixel sizes, text, logos."),
    ('06_tin_toy', 'Tin Toys', 'vintage wind-up metal', 23.3, 0.6, (60, 80, 170),
     "[SUBJECT], made of vintage lithographed tin toys. Glossy enamel-painted sheet metal with printed patterns "
     "(stars, checks, stripes), rolled edges, visible tabs, seams and rivets, and brass wind-up keys. Chunky, "
     "simple toy shapes in bold primary colours with crisp specular highlights. Lit like a tabletop product "
     "shot: warm key light, soft reflections, shallow depth of field. Movement is mechanical clockwork, "
     "jerky, ticking and hopping, animated on twos. Playful and nostalgic.\n\nAvoid: rust, realism, matte "
     "plastic, text, logos."),
    ('07_tilt_shift', 'Tilt-Shift Miniature', 'real world as a tiny model', 38.5, 0.45, (232, 170, 60),
     "[SUBJECT], filmed so it looks like a tiny scale model, shot with a tilt-shift lens. High aerial angle "
     "with a narrow band of sharp focus across the middle and strong blur above and below. Slightly boosted "
     "saturation and contrast, glossy plastic-like surfaces, toy-like simplified details. At dusk and night, "
     "tiny warm bulbs and window lights glow with soft bokeh against deep blue shadows. Slow, smooth camera "
     "moves; motion slightly sped up like a time-lapse.\n\nAvoid: deep focus everywhere, gritty realism, "
     "text, logos."),
    ('08_snow_globe', 'Snow Globe', 'a world under glass', 40.8, 0.5, (150, 110, 70),
     "[SUBJECT], as a miniature world inside a glass snow globe on a wooden table. A clear glass dome with "
     "soft reflections, a bright rim highlight and slight refraction at the edges, on a polished wooden base "
     "with a brass ring. Inside, a detailed tiny scene under a light dusting of snow, with warm lit windows "
     "and fairy lights. Large soft snowflakes swirl and slowly drift down after a shake. A cosy room at "
     "night with warm lamp light and golden bokeh behind, shallow depth of field.\n\nAvoid: cracked or "
     "dirty glass, harsh light, text, logos."),
]


def frame(t):
    tmp = os.path.join(OUT, '_f.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', FILM, '-frames:v', '1', tmp], check=True)
    im = Image.open(tmp).convert('RGB')
    os.remove(tmp)
    return im


def rounded(im, r):
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], r, fill=255)
    return im, mask


def wrap(draw, text, font, width):
    lines = []
    for para in text.split('\n'):
        if not para:
            lines.append('')
            continue
        words, cur = para.split(' '), ''
        for w in words:
            trial = (cur + ' ' + w).strip()
            if draw.textlength(trial, font=font) <= width:
                cur = trial
            else:
                lines.append(cur)
                cur = w
        lines.append(cur)
    return lines


def card(name, title, tag, t, cx, accent, prompt):
    c = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(c)
    y = 70
    d.text((M, y), 'STYLE PROMPT', font=ImageFont.truetype(SANS_B, 26), fill=accent)
    y += 50
    d.text((M, y), title, font=ImageFont.truetype(SERIF_B, 76), fill=INK)
    y += 100
    d.text((M, y), tag, font=ImageFont.truetype(SANS, 32), fill=SOFT)
    y += 70

    # prompt layout first, so the snapshot can take all remaining height
    pad, size = 44, 33
    tw = W - 2 * M - 2 * pad
    font = ImageFont.truetype(SANS, size)
    lines = wrap(d, prompt, font, tw)
    lh = int(size * 1.42)
    box_h = pad + 60 + len(lines) * lh - (lh - size) + pad
    foot = 110
    gap = 56
    box_top = H - foot - box_h
    img_w = W - 2 * M
    img_h = box_top - gap - y

    # snapshot: crop the 16:9 frame to the slot's aspect
    im = frame(t)
    cw = int(round(1080 * img_w / img_h))
    x0 = int(min(max(cx * 1920 - cw / 2, 0), 1920 - cw))
    im = im.crop((x0, 0, x0 + cw, 1080)).resize((img_w, img_h), Image.LANCZOS)
    sh = Image.new('L', (img_w + 60, img_h + 60), 0)
    ImageDraw.Draw(sh).rounded_rectangle([30, 36, img_w + 30, img_h + 36], 28, fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    c.paste(Image.new('RGB', sh.size, (120, 100, 80)), (M - 30, y - 30), sh)
    im, mask = rounded(im, 28)
    c.paste(im, (M, y), mask)

    box_bot = box_top + box_h
    d.rounded_rectangle([M, box_top, W - M, box_bot], 28, fill=(255, 252, 246), outline=(226, 216, 200), width=2)
    ty = box_top + pad
    d.text((M + pad, ty), 'PROMPT  ·  copy and paste', font=ImageFont.truetype(SANS_B, 24), fill=accent)
    ty += 60
    for ln in lines:
        if ln.startswith('Avoid:'):
            fb = ImageFont.truetype(SANS_B, size)
            d.text((M + pad, ty), 'Avoid:', font=fb, fill=INK)
            d.text((M + pad + d.textlength('Avoid: ', font=fb), ty), ln[7:], font=font, fill=SOFT)
        else:
            x = M + pad
            if '[SUBJECT]' in ln:
                pre, post = ln.split('[SUBJECT]', 1)
                d.text((x, ty), pre, font=font, fill=INK)
                x += d.textlength(pre, font=font)
                fb = ImageFont.truetype(SANS_B, size)
                d.text((x, ty), '[SUBJECT]', font=fb, fill=accent)
                x += d.textlength('[SUBJECT]', font=fb)
                d.text((x, ty), post, font=font, fill=INK)
            else:
                d.text((x, ty), ln, font=font, fill=INK)
        ty += lh
    d.text((M, H - 78), 'Replace [SUBJECT] with your own scene. Works for any subject.', font=ImageFont.truetype(SANS, 26), fill=SOFT)
    path = os.path.join(OUT, name + '.png')
    c.save(path)
    return path, img_h, box_h


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for s in STYLES:
        print(*card(*s))
