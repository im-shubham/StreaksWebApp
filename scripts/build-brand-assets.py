"""
Builds the MOMENTUM icon / splash / in-app logo PNGs from the supplied logo.

Source: assets/brand/source/momentum-logo.webp (1254x1254, opaque RGB on
near-black). The artwork is only resized (Lanczos) or padded with black --
never cropped, recoloured or redrawn.

    python3 scripts/build-brand-assets.py   # needs Pillow
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
src = Image.open(ASSETS / "brand/source/momentum-logo.webp").convert("RGB")
assert src.width == src.height, "logo must be square"


def resized(size: int) -> Image.Image:
    return src.resize((size, size), Image.LANCZOS)


def padded(canvas: int, scale: float) -> Image.Image:
    """Logo scaled to `scale` of the canvas, centred on black (matches the logo's own background)."""
    out = Image.new("RGB", (canvas, canvas), (0, 0, 0))
    art = resized(round(canvas * scale))
    off = (canvas - art.width) // 2
    out.paste(art, (off, off))
    return out


# iOS / default app icon: 1024x1024, opaque (iOS applies its own corner mask).
resized(1024).save(ASSETS / "icon.png", optimize=True)
# Android adaptive foreground: launcher masks can cut up to ~1/3 of the layer,
# so the tile is shrunk to stay inside the 66% safe zone.
padded(1024, 0.79).save(ASSETS / "android-icon-foreground.png", optimize=True)
# Splash image (shown at imageWidth on a black background).
resized(1024).save(ASSETS / "splash-icon.png", optimize=True)
# In-app logo (largest use is the ~112pt Welcome badge -> 336px @3x).
resized(512).save(ASSETS / "brand/momentum-logo.png", optimize=True)
# Web favicon.
resized(48).save(ASSETS / "favicon.png", optimize=True)
print("brand assets written")
