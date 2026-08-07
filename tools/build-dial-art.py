#!/usr/bin/env python3
"""Build the front-dial art sprites from the source renders.

Source PNGs live in tools/assets-src/dial/, output WebP in public/assets/dial/.
Mirrors the caseback pipeline: source art stays lossless and out of the bundle,
the site only ever ships the downscaled WebP.

The moon wheel gets special treatment. main.js spins it with
`rotate(deg 50 50)` in the aperture's 100x50 viewBox, so the sprite has to be
square and centred on the wheel's true axis of rotation -- which is the midpoint
between the two lunar discs, not the centre of the PNG canvas. We locate the
discs, re-crop around that midpoint, and print the geometry the SVG needs.

    python3 tools/build-dial-art.py
"""

import pathlib

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "assets-src" / "dial"
OUT = ROOT / "public" / "assets" / "dial"

# name -> (source file, rendered width in px). Widths are ~2x the largest size
# each sprite is ever drawn at, so they stay crisp on retina without bloating.
PLAIN = {
    "main-dial": ("main-dial-blue-sunburst.png", 1200),
    "hours-minutes-dial": ("hours-minutes-dial-rose-gold.png", 1000),
    "seconds-dial": ("seconds-dial-blue-azurage.png", 600),
}

MOON_SRC = "moonphase-rotating-lunar-wheel.png"
MOON_WIDTH = 900

QUALITY = 88


def moon_geometry(im):
    """Return (axis_xy, orbit_radius_px, moon_radius_px, safe_radius_px).

    safe_radius is how far the wheel is guaranteed to extend from its axis in
    every direction -- the crop half-size we can take without exposing a gap.
    """
    a = np.array(im).astype(int)
    r, g, b, alpha = a[..., 0], a[..., 1], a[..., 2], a[..., 3]

    # Gold lunar discs: warm, opaque, and much larger than the engraved stars.
    gold = (r > 150) & (g > 90) & (b < 160) & (r - b > 60) & (alpha > 128)
    labels, count = ndimage.label(gold)
    sizes = ndimage.sum(gold, labels, range(1, count + 1))
    if count < 2:
        raise SystemExit("could not find two lunar discs in the moon wheel")
    top_two = np.argsort(sizes)[::-1][:2]

    centres = []
    radii = []
    for idx in top_two:
        ys, xs = np.nonzero(labels == idx + 1)
        centres.append((xs.mean(), ys.mean()))
        radii.append(((xs.max() - xs.min()) + (ys.max() - ys.min())) / 4)
    (x1, y1), (x2, y2) = centres

    axis = ((x1 + x2) / 2, (y1 + y2) / 2)
    orbit = np.hypot(x2 - x1, y2 - y1) / 2
    moon_r = sum(radii) / 2

    # The painted disc is very slightly off-centre in the canvas; measure how
    # far it reaches from the rotation axis in the worst direction.
    ys, xs = np.nonzero(alpha > 128)
    disc_c = ((xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2)
    disc_r = ((xs.max() - xs.min()) + (ys.max() - ys.min())) / 4
    drift = np.hypot(disc_c[0] - axis[0], disc_c[1] - axis[1])

    return axis, orbit, moon_r, disc_r - drift


def save(im, path, width):
    if im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=QUALITY, method=6)
    print(f"  {path.relative_to(ROOT)}  {im.width}x{im.height}  {path.stat().st_size / 1024:.0f} KB")


def main():
    print("dial plates:")
    for name, (fname, width) in PLAIN.items():
        im = Image.open(SRC / fname).convert("RGBA")
        save(im, OUT / f"{name}.webp", width)

    print("moon wheel:")
    im = Image.open(SRC / MOON_SRC).convert("RGBA")
    axis, orbit, moon_r, safe_r = moon_geometry(im)

    half = int(safe_r)
    cx, cy = round(axis[0]), round(axis[1])
    crop = Image.new("RGBA", (half * 2, half * 2), (0, 0, 0, 0))
    crop.paste(im.crop((cx - half, cy - half, cx + half, cy + half)), (0, 0))
    save(crop, OUT / "moonphase-wheel.webp", MOON_WIDTH)

    # Aperture viewBox is 100x50 and the moon rides at (50, 50 - orbit_units).
    # Pick the scale from the moon's apparent size so the disc reads at roughly
    # the same weight as the vector moon it replaces, then report the box.
    orbit_units = 34.8
    scale = orbit_units / orbit
    print(
        "\n  aperture geometry (viewBox 0 0 100 50, rotate about 50 50):\n"
        f"    orbit radius      {orbit_units:.2f} units\n"
        f"    moon radius       {moon_r * scale:.2f} units\n"
        f"    moon centre y     {50 - orbit_units:.2f}\n"
        f"    wheel half-extent {half * scale:.2f} units (need >= 47.10)\n"
        f"    <image> box       x/y {50 - half * scale:.3f}  w/h {half * scale * 2:.3f}"
    )


if __name__ == "__main__":
    main()
