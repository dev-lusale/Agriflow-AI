#!/usr/bin/env python3
"""Rebuild every website brand asset from the vector logo.

    npm run icons        (needs Python 3 with Pillow, and rsvg-convert from librsvg)

Source: assets/brand/agriflow-mark.svg — the "G + leaves" mark traced from the owner's artwork
(assets/brand/agriflow-logo-source.png). Wordmark font: Plus Jakarta Sans (OFL), from the app.
"""
import io
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "assets/brand/agriflow-mark.svg"
FONT = ROOT / "mobile_app/assets/fonts/PlusJakartaSans-VariableFont_wght.ttf"
INK, CORAL, MUTED, CREAM = (23, 21, 20, 255), (242, 103, 82, 255), (119, 113, 111, 255), (250, 246, 244, 255)


def render(width):
    png = subprocess.run(["rsvg-convert", "-w", str(width), str(SVG)], capture_output=True, check=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    return im.crop(im.getbbox())


def font(size, weight):
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_axes([weight])
    return f


def tile(m, size, scale, rounded=True):
    c = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if rounded:
        ImageDraw.Draw(c).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=(255, 255, 255, 255))
    else:
        c.paste(Image.new("RGBA", (size, size), (255, 255, 255, 255)))
    w = int(size * scale)
    mm = m.resize((w, int(m.height * w / m.width)), Image.LANCZOS)
    c.alpha_composite(mm, ((size - w) // 2, (size - mm.height) // 2))
    return c


def main():
    m = render(1600)
    out = lambda p: ROOT / p  # noqa: E731
    mark = m.resize((int(m.width * 512 / m.height), 512), Image.LANCZOS)
    mark.save(out("public/brand/agriflow-mark.png"), optimize=True)

    f = font(300, 800)
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    w1, w2 = d.textlength("AgriFlow ", font=f), d.textlength("AI", font=f)
    mk = m.resize((int(m.width * 560 / m.height), 560), Image.LANCZOS)
    lock = Image.new("RGBA", (int(mk.width + 180 + w1 + w2), 783), (0, 0, 0, 0))
    lock.alpha_composite(mk, (60, (783 - mk.height) // 2))
    dd = ImageDraw.Draw(lock)
    x = 60 + mk.width + 60
    dd.text((x, 391), "AgriFlow ", font=f, fill=INK, anchor="lm")
    dd.text((x + w1, 391), "AI", font=f, fill=CORAL, anchor="lm")
    lock = lock.crop(lock.getbbox())
    lock.save(out("public/brand/agriflow-logo.png"), optimize=True)

    for s in [48, 72, 96, 128, 144, 192, 256, 384, 512]:
        tile(m, s, 0.72).save(out(f"public/icons/icon-{s}.png"), optimize=True)
    for s in [192, 512]:
        tile(m, s, 0.56, rounded=False).save(out(f"public/icons/icon-maskable-{s}.png"), optimize=True)
    tile(m, 180, 0.72, rounded=False).convert("RGB").save(out("public/apple-touch-icon.png"), optimize=True)
    tile(m, 256, 0.86).save(out("public/favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

    inner = re.sub(r"^<svg[^>]*>|</svg>$", "", SVG.read_text().strip())
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', SVG.read_text()).group(1).split()]
    scale = 512 * 0.8 / vb[2]
    tx, ty = (512 - vb[2] * scale) / 2, (512 - vb[3] * scale) / 2
    out("public/icon.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#ffffff"/>'
        f'<g transform="translate({tx:.1f} {ty:.1f}) scale({scale:.4f})">{inner}</g></svg>'
    )

    og = Image.new("RGBA", (1200, 630), CREAM)
    L = lock.resize((int(lock.width * 140 / lock.height), 140), Image.LANCZOS)
    og.alpha_composite(L, ((1200 - L.width) // 2, 170))
    t = font(36, 600)
    dg = ImageDraw.Draw(og)
    dg.text((600, 395), "Farm records, Grok-powered advice, crop health checks,", font=t, fill=MUTED, anchor="mm")
    dg.text((600, 445), "local weather and a marketplace for Zambian farmers", font=t, fill=MUTED, anchor="mm")
    dg.rectangle([0, 616, 1200, 630], fill=CORAL)
    for p in ["public/brand/og-image.png", "src/app/opengraph-image.png"]:
        og.convert("RGB").save(out(p), optimize=True)
    print("Brand assets written.")


if __name__ == "__main__":
    main()
