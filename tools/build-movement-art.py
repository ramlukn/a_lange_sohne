#!/usr/bin/env python3
"""Build the finished-movement sprite from the six rendered layers.

Source PNGs live in tools/assets-src/movement/, output WebP in
public/assets/movement/. Same contract as build-dial-art.py: lossless art stays
out of the bundle, the site only ever ships the downscaled WebP, and this script
prints the numbers styles.css needs rather than anyone eyeballing them.

The site ships ONE image: the finished calibre, all six layers flattened. The
six sources are still the masters and are still all read here, for two reasons
that outlive the layered build --

  * the composite is made by stacking them, and check_registration() asserts the
    result equals the supplied stacked-preview-transparent.png exactly. That is
    a real check: it catches a re-export that shifted or resized a single layer,
    which a flattened sprite would otherwise hide until someone looked at it.
  * the PERIMETER RING is what places the frame, and it can only be measured
    while it is still its own image.

Geometry, none of which changed when the layers were flattened:

  * The FRAME is the union of all six ink boxes: 1089x1126 at (82, 62), which
    is also the composite's own ink box. Cropping to it throws away a
    transparent border that is 25% of the source area.
  * The frame is placed by the PERIMETER RING, because the ring is the
    movement's visible outer edge -- it is what decides how big the movement
    reads. The ring's outer edge is an axis-aligned ellipse to within 2px of
    1089 (0.2%), so mapping its box onto a circle concentric with the dial well
    makes the movement's rim a true circle by construction.
    MOVEMENT_SCALE then says how big that circle is as a fraction of the well.
    It used to be 1.0, i.e. the rim landed on the well and the case appeared to
    close flush around the movement; it is 0.80 now, so the movement sits inside
    the opening with the case's flange showing around it. The squash is a pure
    aspect ratio and so is unaffected either way -- round at any scale.
    The foundation plate reaches 6px past the ring at the bottom (a real
    mainplate is wider than its chapter ring), which is why the frame is the
    union and not just the ring: keeping it means the box is a hair taller than
    it is wide.
  * The Y-SQUASH follows from those two boxes and is printed below. The ring is
    rendered 1089x1119, i.e. 2.755% taller than wide, and has to end up round;
    so the frame's box is 71.760% x 72.209% of the face while the sprite's own
    pixels are 1089x1126. Drawing the one into the other with object-fit: fill
    scales y by 0.97319 -- a 2.681% squash on the sprite, which is the same
    correction as the ring's 2.755% expressed against the frame's aspect rather
    than the ring's. Both numbers describe one fact: the art was rendered tall.
    Re-derive rather than copy if the art is ever re-exported; the property that
    has to hold is that the RING comes out circular.

Payload is the real constraint here: this loads during startup, before the user
can do anything. So the sprite is sized off what the movement is actually drawn
at rather than the source's 1254.

    python3 tools/build-movement-art.py
"""

import pathlib

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "assets-src" / "movement"
OUT = ROOT / "public" / "assets" / "movement"

# Paint order. These are the masters; the site ships their flattened sum.
LAYERS = [
    "01_foundation-plate.png",
    "02_gear-train.png",
    "03_balance-escapement.png",
    "04_bridge-set.png",
    "05_screws-and-jewels.png",
    "06_perimeter-ring.png",
]

# The layer whose outer edge is the movement's rim, and so places the frame.
RIM_LAYER = "06_perimeter-ring.png"

# The one file the site loads.
SPRITE = "calibre.webp"

# The dial well the movement sits in: the front face's `inset: 5.15%` disc.
WELL_INSET = 5.15

# Movement rim diameter as a fraction of the well's. At 1.0 the rim lands on the
# well to within a rounding error and the case appears to close flush around the
# movement. Below that the movement stops being the thing that fills the opening
# and becomes a distinct object sitting inside it, with a visible annulus of the
# case's own flange around it -- which is the intended reading here.
#
# Nothing else in this file depends on it, and in particular the y-squash does
# not: that corrects the art and is a pure aspect ratio, so the rim is a true
# circle at any scale. The gap the scale opens up is (1 - scale) / 2 of the well
# diameter, in radius.
MOVEMENT_SCALE = 0.80

# Width, in px, that the frame is rendered at. The movement is drawn at 89.7% of
# an 86vmin face = 77.1vmin, so this is about 1x the CSS-pixel rendering on a
# 900px-vmin laptop and 0.68x on a 1440p desktop. Deliberately far below the 2x
# the permanent dial art gets: the movement is on screen for under two seconds,
# in flight and under blur for the first third of that, and then display:none'd
# forever. Every KB here is spent during startup, before the user can do
# anything, which is the worst place to spend it.
#
# That 680 was chosen against the movement's on-screen size, so it tracks
# MOVEMENT_SCALE: drawing the movement smaller without re-exporting would just
# ship pixels the compositor throws away. The same sampling ratio at 0.80 scale
# is 544px. Measured against the reference downsampled to display size, the
# resample floor at 544 is 3.99 RMS and 608 buys 1.2 RMS for 19 KB -- not worth
# it for an image the user sees still for two thirds of a second.
FRAME_WIDTH_AT_FULL_SIZE = 680
FRAME_WIDTH = round(FRAME_WIDTH_AT_FULL_SIZE * MOVEMENT_SCALE)

# One image now, so one quality, and it is a compromise the layered build did not
# have to make: the mainplate's grain field and the jewels are in the same
# picture and can no longer be priced separately. Set from the jewels and the
# balance, which are the only saturated colour in it and the parts actually
# looked at, then walked down to the knee of the rate curve -- 80 costs 66 KB,
# and 84 buys 0.43 RMS for another 9.
#
# ALPHA is nearly free either way and so is not cut: the alpha channel is one
# disc, and everything from 55 to 100 lands within 0.01 RMS of each other. 72 is
# where the rim's antialiased edge stops degrading for a cost of 0.2 KB.
QUALITY, ALPHA_QUALITY = 80, 72


def ink_bbox(im):
    """Tight (x0, y0, x1, y1) around everything that is not fully transparent."""
    ys, xs = np.nonzero(np.array(im)[..., 3] > 0)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def build_composite(sources):
    """Stack the layers, and assert the result is the supplied reference.

    The reference ships next to the sources; if it is not there we can still
    check the weaker property that matters most -- that every layer is on the
    same canvas -- but the byte-exact check is the one worth having, because it
    catches a re-export that shifted or resized a single layer.
    """
    sizes = {im.size for im in sources.values()}
    if len(sizes) != 1:
        raise SystemExit(f"layers are not on a common canvas: {sizes}")

    comp = Image.new("RGBA", next(iter(sizes)), (0, 0, 0, 0))
    for fname in LAYERS:
        comp = Image.alpha_composite(comp, sources[fname])

    ref_path = SRC / "stacked-preview-transparent.png"
    if not ref_path.exists():
        print(f"  no {ref_path.name} to check against; canvas {comp.size} shared")
        return comp

    diff = np.abs(
        np.array(comp).astype(int)
        - np.array(Image.open(ref_path).convert("RGBA")).astype(int)
    )
    if diff.max():
        raise SystemExit(
            f"layers no longer stack into {ref_path.name} "
            f"(max channel error {diff.max()}) -- registration has drifted"
        )
    print(f"  01..06 composite == {ref_path.name}, exactly. registration holds.")
    return comp


def main():
    sources = {fname: Image.open(SRC / fname).convert("RGBA") for fname in LAYERS}

    print("registration:")
    comp = build_composite(sources)

    # The frame: the composite's ink, i.e. the union of every layer's.
    fx0, fy0, fx1, fy1 = ink_bbox(comp)
    fw, fh = fx1 - fx0, fy1 - fy0

    # Place the frame from the rim. The ring's box has to land on the well, so
    # one source px is well/ring_w wide and well/ring_h tall, and the frame's
    # own size and offset follow from that.
    rx0, ry0, rx1, ry1 = ink_bbox(sources[RIM_LAYER])
    rw, rh = rx1 - rx0, ry1 - ry0
    well = 100 - 2 * WELL_INSET  # % of the face the dial well spans
    rim = well * MOVEMENT_SCALE  # ... and the % the movement's own rim spans
    kx = rim / rw  # % of the face per source px, horizontally
    ky = rim / rh  # ... and vertically

    # The rim is concentric with the well, so its inset is whatever centres it.
    # (At MOVEMENT_SCALE == 1 this is WELL_INSET exactly.)
    rim_inset = (100 - rim) / 2
    box_w, box_h = fw * kx, fh * ky
    print(
        f"\nframe (the composite's own ink box):\n"
        f"    source box       {fx0},{fy0} .. {fx1},{fy1}  ({fw}x{fh}px, "
        f"{fh / fw:.5f} tall)\n"
        f"    rim box          {rx0},{ry0} .. {rx1},{ry1}  "
        f"({rw}x{rh}px, {rh / rw:.5f} tall)\n"
        f"    dial well        inset {WELL_INSET}% -> {well:.2f}% of the face\n"
        f"    movement rim     scale {MOVEMENT_SCALE:.2f} -> {rim:.2f}% of the face, "
        f"inset {rim_inset:.3f}%\n"
        f"    ring/well gap    {(well - rim) / 2:.3f}% of the face in radius "
        f"({(well - rim) / 2 / well * 200:.1f}% of the well radius)\n"
        f"    rim as drawn     {rw * kx:.3f}% x {rh * ky:.3f}% of the face "
        f"-- circular by construction\n"
        f"    y-squash         box is {box_h / box_w:.5f} tall, sprite is "
        f"{fh / fw:.5f}: object-fit: fill scales y by "
        f"{(box_h / box_w) / (fh / fw):.5f}\n"
        f"  .watch-mvt         left {rim_inset - (rx0 - fx0) * kx:.3f}%  "
        f"top {rim_inset - (ry0 - fy0) * ky:.3f}%  "
        f"width {box_w:.3f}%  height {box_h:.3f}%  of the face"
    )

    crop = comp.crop((fx0, fy0, fx1, fy1))
    w = FRAME_WIDTH
    h = round(fh * FRAME_WIDTH / fw)
    crop = crop.resize((w, h), Image.LANCZOS)

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / SPRITE
    crop.save(path, "WEBP", quality=QUALITY, alpha_quality=ALPHA_QUALITY, method=6)
    print(
        f"\nsprite (fills .watch-mvt exactly, so it needs no box of its own):\n"
        f"  {SPRITE:19s} {w}x{h}  q{QUALITY}/a{ALPHA_QUALITY}  "
        f"{path.stat().st_size / 1024:.1f} KB"
    )

    stale = sorted(p for p in OUT.glob("*.webp") if p.name != SPRITE)
    if stale:
        print(
            "\n  stale sprites from the layered build still in "
            f"{OUT.relative_to(ROOT)}: {', '.join(p.name for p in stale)}"
        )


if __name__ == "__main__":
    main()
