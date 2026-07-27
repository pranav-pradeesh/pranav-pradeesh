#!/usr/bin/env python3
"""Generate assets/portrait.jpg — a stand-in figure for the particle portrait.

This exists so the scroll effect works on a fresh clone. Replace
assets/portrait.jpg with a real photograph (subject on a plain backdrop,
portrait crop) and delete this script; nothing in the site imports it.

    python3 tools/make_placeholder_portrait.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

W, H = 1024, 1536
SS = 3  # supersample factor for antialiasing

SHIRT = (17, 18, 17)
SHIRT_LIT = (34, 36, 34)
TROUSER = (13, 14, 13)
BELT = (24, 24, 26)
BUCKLE = (152, 152, 158)
SKIN = (170, 122, 88)
SKIN_SHADE = (139, 97, 68)
HAIR = (21, 17, 15)
BROW = (30, 24, 21)
LIP = (150, 94, 86)


def backdrop() -> Image.Image:
    """Soft studio grey, built small and scaled up so it stays smooth."""
    small = Image.new("RGB", (48, 72))
    px = small.load()
    for y in range(72):
        for x in range(48):
            nx, ny = x / 47 - 0.5, y / 71 - 0.5
            fall = (nx * nx * 1.5 + ny * ny) ** 0.5
            v = int(239 - 26 * min(1.0, fall * 1.25))
            px[x, y] = (v, v, v + 1)
    return small.resize((W * SS, H * SS), Image.BICUBIC)


def rotated(size, draw_fn, angle, anchor):
    """Draw onto a transparent layer, rotate about its centre, return it."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    layer = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    return layer, (anchor[0] - layer.width // 2, anchor[1] - layer.height // 2)


def s(*vals):
    return tuple(v * SS for v in vals)


def build() -> Image.Image:
    img = backdrop()
    d = ImageDraw.Draw(img)

    # ---- head ------------------------------------------------------
    # ears first, so the face overlaps them
    d.ellipse([s(408, 268), s(440, 328)], fill=SKIN_SHADE)
    d.ellipse([s(584, 268), s(616, 328)], fill=SKIN_SHADE)

    # cranium and jaw
    d.ellipse([s(418, 150), s(606, 372)], fill=SKIN)
    d.polygon([s(438, 300), s(586, 300), s(560, 388), s(464, 388)], fill=SKIN)
    d.ellipse([s(452, 322), s(572, 404)], fill=SKIN)
    # temple / cheek shading gives the silhouette some interior gradient
    d.ellipse([s(414, 196), s(462, 322)], fill=SKIN_SHADE)
    d.ellipse([s(562, 196), s(610, 322)], fill=SKIN_SHADE)

    # hair: crown cap plus a swept fringe that stops above the brow line
    d.ellipse([s(410, 122), s(614, 268)], fill=HAIR)
    d.polygon([s(414, 226), s(420, 164), s(482, 126), s(560, 128), s(608, 164),
               s(612, 230), s(584, 192), s(526, 208), s(468, 196), s(438, 228)], fill=HAIR)
    d.ellipse([s(444, 112), s(566, 182)], fill=HAIR)
    d.ellipse([s(536, 118), s(612, 178)], fill=HAIR)

    # brows, eyes, nose, mouth
    d.rounded_rectangle([s(444, 258), s(496, 270)], radius=6 * SS, fill=BROW)
    d.rounded_rectangle([s(528, 258), s(580, 270)], radius=6 * SS, fill=BROW)
    d.ellipse([s(450, 280), s(492, 302)], fill=(240, 238, 234))
    d.ellipse([s(532, 280), s(574, 302)], fill=(240, 238, 234))
    d.ellipse([s(462, 283), s(484, 301)], fill=(44, 31, 23))
    d.ellipse([s(542, 283), s(564, 301)], fill=(44, 31, 23))
    d.polygon([s(512, 296), s(497, 334), s(527, 334)], fill=SKIN_SHADE)
    d.ellipse([s(496, 328), s(528, 342)], fill=SKIN)
    d.rounded_rectangle([s(488, 358), s(536, 370)], radius=6 * SS, fill=LIP)

    # ---- neck ------------------------------------------------------
    d.polygon([s(474, 356), s(550, 356), s(566, 458), s(458, 458)], fill=SKIN)
    d.polygon([s(474, 356), s(550, 356), s(546, 398), s(478, 398)], fill=SKIN_SHADE)

    # ---- torso -----------------------------------------------------
    d.polygon(
        [s(474, 442), s(376, 470), s(306, 540), s(294, 660), s(300, 900),
         s(312, 1176), s(712, 1176), s(724, 900), s(730, 660), s(718, 540),
         s(648, 470), s(550, 442)],
        fill=SHIRT,
    )
    # shoulder caps catch the key light
    d.ellipse([s(322, 470), s(452, 606)], fill=SHIRT_LIT)
    d.ellipse([s(572, 470), s(702, 606)], fill=SHIRT_LIT)

    # open collar over the sternum
    d.polygon([s(474, 442), s(512, 528), s(550, 442), s(528, 434), s(496, 434)], fill=(9, 10, 9))

    # ---- crossed forearms -----------------------------------------
    # sleeves sit forward of the chest, so they read a stop lighter;
    # far arm crosses first and the near arm is pasted over it
    ARM = (44, 46, 44)
    ARM_EDGE = (12, 13, 12)

    def sleeve(dr, w_px, h_px):
        dr.rounded_rectangle([0, 0, w_px * SS, h_px * SS],
                             radius=(h_px // 2) * SS, fill=ARM,
                             outline=ARM_EDGE, width=5 * SS)

    far, at = rotated(s(400, 118), lambda dr: sleeve(dr, 400, 118), -9, s(500, 1006))
    img.paste(far, at, far)
    # that hand comes to rest on the near bicep
    d.ellipse([s(650, 898), s(736, 996)], fill=SKIN)
    d.ellipse([s(662, 912), s(708, 972)], fill=SKIN_SHADE)

    near, at = rotated(s(400, 124), lambda dr: sleeve(dr, 400, 124), 8, s(520, 902))
    img.paste(near, at, near)
    d.ellipse([s(280, 936), s(366, 1034)], fill=SKIN)
    d.ellipse([s(308, 950), s(354, 1010)], fill=SKIN_SHADE)

    # ---- belt and trousers ----------------------------------------
    d.rectangle([s(312, 1160), s(712, 1208)], fill=BELT)
    d.rounded_rectangle([s(478, 1164), s(548, 1204)], radius=5 * SS, fill=BUCKLE)
    d.polygon([s(314, 1202), s(710, 1202), s(724, 1536), s(300, 1536)], fill=TROUSER)
    d.polygon([s(504, 1208), s(522, 1208), s(516, 1536), s(510, 1536)], fill=(26, 27, 26))

    img = img.resize((W, H), Image.LANCZOS)
    return img.filter(ImageFilter.GaussianBlur(0.6))


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "assets" / "portrait.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    build().save(out, "JPEG", quality=88, optimize=True)
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
