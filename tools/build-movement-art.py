#!/usr/bin/env python3
"""Build the assembling-movement sprites from the six rendered layers.

Source PNGs live in tools/assets-src/movement/, output WebP in
public/assets/movement/. Same contract as build-dial-art.py: lossless art stays
out of the bundle, the site only ever ships the downscaled WebP, and this script
prints the numbers styles.css needs rather than anyone eyeballing them.

The six layers are rendered on one common 1254x1254 frame and are exactly
registered -- compositing 01..06 in order reproduces the supplied
stacked-preview-transparent.png byte for byte, which check_registration()
re-verifies on every build. So the only positioning question is where the shared
frame goes; everything after that is bookkeeping.

  * The FRAME is the union of all six ink boxes: 1089x1126 at (82, 62). Cropping
    to it throws away a transparent border that is 25% of the source area.
  * The frame is placed by the PERIMETER RING, because the ring is the movement's
    visible outer edge -- it is what decides how big the movement reads. The
    ring's outer edge is an axis-aligned ellipse to within 2px of 1089 (0.2%), so
    mapping its box onto a circle concentric with the dial well -- squashing the
    frame 2.7% in y -- makes the movement's rim a true circle by construction.
    That 2.7% anisotropy is invisible on the interior art.
    MOVEMENT_SCALE then says how big that circle is as a fraction of the well.
    It used to be 1.0, i.e. the rim landed on the well and the case appeared to
    close flush around the movement; it is 0.80 now, so the movement sits inside
    the opening with the case's flange showing around it. The squash is a pure
    aspect ratio and so is unaffected either way -- round at any scale.
    The foundation plate reaches 6px past the ring at the bottom (a real mainplate
    is wider than its chapter ring), which is why the frame is the union and not
    just the ring: keeping it means the box is a hair taller than it is wide.
  * Each layer is then cropped to its OWN ink box inside that frame and gets its
    own % box printed. That halves the payload versus six full-frame sprites, and
    it means each layer scales about its own centre -- so the balance seats on
    the balance and the ring closes about the rim, instead of every part
    pivoting on the middle of the movement.

Payload is the real constraint here: this loads during startup, before the user
can do anything, and it replaces ~9 KB of inline SVG. So the sprites are sized
off what the movement is actually drawn at rather than the source's 1254, and
quality is set per layer by how much scrutiny each one gets -- the plate spends
the whole act being covered up, the jewels are the thing you look at.

    python3 tools/build-movement-art.py
"""

import pathlib

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "assets-src" / "movement"
OUT = ROOT / "public" / "assets" / "movement"

# In assembly order, which is also paint order.
LAYERS = [
    ("foundation-plate", "01_foundation-plate.png"),
    ("gear-train", "02_gear-train.png"),
    ("balance-escapement", "03_balance-escapement.png"),
    ("bridge-set", "04_bridge-set.png"),
    ("screws-and-jewels", "05_screws-and-jewels.png"),
    ("perimeter-ring", "06_perimeter-ring.png"),
]

# The layer whose outer edge is the movement's rim, and so places the frame.
RIM_LAYER = "06_perimeter-ring.png"

# The dial well the movement sits in: the front face's `inset: 5.15%` disc.
WELL_INSET = 5.15

# Movement rim diameter as a fraction of the well's. At 1.0 the rim lands on the
# well to within a rounding error and the case appears to close flush around the
# movement. Below that the movement stops being the thing that fills the opening
# and becomes a distinct object sitting inside it, with a visible annulus of the
# case's own flange around it -- which is the intended reading here.
#
# Nothing else in this file depends on it, and in particular the y-squash does
# not: that corrects the art (the ring is rendered 2.76% taller than wide) and is
# a pure aspect ratio, so the rim is a true circle at any scale. The gap the
# scale opens up is (1 - scale) / 2 of the well diameter, in radius.
MOVEMENT_SCALE = 0.80

# Width, in px, that the whole frame is rendered at. The movement is drawn at
# 89.7% of an 86vmin face = 77.1vmin, so this is ~1.15x on a 900px-vmin laptop
# and ~0.68x on a 1440p desktop. Deliberately far below the 2x the permanent
# dial art gets: the movement is on screen for 2.2s, moving and under blur for
# most of it, and then display:none'd forever. Every KB here is spent during
# startup, before the user can do anything, which is the worst place to spend it.
# Measured against the reference composite downsampled to display size, 640 and
# 720 are indistinguishable and the residual is dominated by the resample rather
# than by compression; 680 is the middle, and costs 243 KB against 320 for the
# obvious 720/high-quality build.
#
# That 680 was chosen against the movement's on-screen size, so it tracks
# MOVEMENT_SCALE: drawing the movement smaller without re-exporting would just
# ship pixels the compositor throws away. The same sampling ratio at 0.80 scale
# is 544px.
FRAME_WIDTH_AT_FULL_SIZE = 680
FRAME_WIDTH = round(FRAME_WIDTH_AT_FULL_SIZE * MOVEMENT_SCALE)

# Per layer: (quality, alpha_quality). Set by how hard each layer is looked at
# and by what the alpha channel is doing. The plate is a grain field that
# everything else covers up, and its alpha is one plain disc, so it takes the
# deepest cut on both. The gear train is the expensive one -- a lace of fine
# teeth, i.e. almost all edge -- but it is also never still. The jewels and the
# balance are small, cheap, and the only parts with saturated colour in them, so
# they keep their quality.
QUALITY = {
    "foundation-plate": (66, 70),
    "gear-train": (70, 74),
    "balance-escapement": (80, 88),
    "bridge-set": (72, 78),
    "screws-and-jewels": (82, 88),
    "perimeter-ring": (74, 80),
}


def ink_bbox(im):
    """Tight (x0, y0, x1, y1) around everything that is not fully transparent."""
    ys, xs = np.nonzero(np.array(im)[..., 3] > 0)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def check_registration(sources):
    """Assert the layers still stack into the supplied reference composite.

    The reference ships next to the sources; if it is not there we can still
    check the weaker property that matters most -- that every layer is on the
    same canvas -- but the byte-exact check is the one worth having, because it
    catches a re-export that shifted or resized a single layer.
    """
    sizes = {im.size for im in sources.values()}
    if len(sizes) != 1:
        raise SystemExit(f"layers are not on a common canvas: {sizes}")

    ref_path = SRC / "stacked-preview-transparent.png"
    if not ref_path.exists():
        print(f"  no {ref_path.name} to check against; canvas {sizes.pop()} shared")
        return

    comp = Image.new("RGBA", next(iter(sizes)), (0, 0, 0, 0))
    for _, fname in LAYERS:
        comp = Image.alpha_composite(comp, sources[fname])
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


def main():
    sources = {
        fname: Image.open(SRC / fname).convert("RGBA") for _, fname in LAYERS
    }

    print("registration:")
    check_registration(sources)

    boxes = {fname: ink_bbox(im) for fname, im in sources.items()}

    # The frame: union of every layer's ink.
    fx0 = min(b[0] for b in boxes.values())
    fy0 = min(b[1] for b in boxes.values())
    fx1 = max(b[2] for b in boxes.values())
    fy1 = max(b[3] for b in boxes.values())
    fw, fh = fx1 - fx0, fy1 - fy0

    # Place the frame from the rim. The ring's box has to land on the well, so
    # one source px is well/ring_w wide and well/ring_h tall, and the frame's
    # own size and offset follow from that.
    rx0, ry0, rx1, ry1 = boxes[RIM_LAYER]
    well = 100 - 2 * WELL_INSET  # % of the face the dial well spans
    rim = well * MOVEMENT_SCALE  # ... and the % the movement's own rim spans
    kx = rim / (rx1 - rx0)  # % of the face per source px, horizontally
    ky = rim / (ry1 - ry0)  # ... and vertically

    # The rim is concentric with the well, so its inset is whatever centres it.
    # (At MOVEMENT_SCALE == 1 this is WELL_INSET exactly.)
    rim_inset = (100 - rim) / 2
    frame_left = rim_inset - (rx0 - fx0) * kx
    frame_top = rim_inset - (ry0 - fy0) * ky
    print(
        f"\nframe (union of all six):\n"
        f"    source box       {fx0},{fy0} .. {fx1},{fy1}  ({fw}x{fh}px)\n"
        f"    rim box          {rx0},{ry0} .. {rx1},{ry1}  "
        f"({rx1 - rx0}x{ry1 - ry0}px, {(rx1 - rx0) / (ry1 - ry0):.4f} aspect)\n"
        f"    dial well        inset {WELL_INSET}% -> {well:.2f}% of the face\n"
        f"    movement rim     scale {MOVEMENT_SCALE:.2f} -> {rim:.2f}% of the face, "
        f"inset {rim_inset:.3f}%\n"
        f"    ring/well gap    {(well - rim) / 2:.3f}% of the face in radius "
        f"({(well - rim) / 2 / 89.7 * 100:.1f}% of the well radius)\n"
        f"    y-squash         {(rx1 - rx0) / (ry1 - ry0):.4f}  "
        f"(rim ellipse -> true circle, at any scale)\n"
        f"  .watch-mvt         left {frame_left:.3f}%  top {frame_top:.3f}%  "
        f"width {fw * kx:.3f}%  height {fh * ky:.3f}%  of the face"
    )

    print("\nlayers (boxes are % of .watch-mvt, sprites are `inset` in them):")
    total = 0
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fname in LAYERS:
        x0, y0, x1, y1 = boxes[fname]
        crop = sources[fname].crop((x0, y0, x1, y1))

        w = round(crop.width * FRAME_WIDTH / fw)
        h = round(crop.height * FRAME_WIDTH / fw)
        crop = crop.resize((w, h), Image.LANCZOS)

        q, aq = QUALITY[name]
        path = OUT / f"{name}.webp"
        crop.save(path, "WEBP", quality=q, alpha_quality=aq, method=6)
        size = path.stat().st_size
        total += size

        # Positions are % of the frame box, so the markup needs no arithmetic.
        print(
            f"  {name:19s} {w:>4}x{h:<4} q{q}/a{aq}  {size / 1024:5.1f} KB\n"
            f"    {'':17s} left {(x0 - fx0) / fw * 100:7.3f}%  top {(y0 - fy0) / fh * 100:7.3f}%"
            f"  width {(x1 - x0) / fw * 100:7.3f}%  height {(y1 - y0) / fh * 100:7.3f}%"
        )

    print(f"\n  total shipped      {total / 1024:.0f} KB across {len(LAYERS)} sprites")


if __name__ == "__main__":
    main()
