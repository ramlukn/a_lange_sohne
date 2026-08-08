#!/usr/bin/env python3
"""Build the front-dial art sprites from the source renders.

Source PNGs live in tools/assets-src/dial/, output WebP in public/assets/dial/.
Mirrors the caseback pipeline: source art stays lossless and out of the bundle,
the site only ever ships the downscaled WebP.

Anything that turns needs its rotation axis at the geometric centre of the file
it ships as, because CSS/SVG spin it about that centre. So the three sprites
that rotate all get measured and re-cropped rather than shipped as rendered.

  * The moon wheel spins via `rotate(deg 50 50)` in the aperture's 100x50
    viewBox. Its axis is the midpoint between the two lunar discs, not the
    centre of the PNG canvas.
  * The four hands each have a round pivot boss with a counterweight tail
    hanging below it, so the axis is mid-art. We find the boss from the
    silhouette's row-width profile (the boss is the one place the outline
    bulges into a circle), then crop a square centred on it so the sprite's
    centre IS the axis and CSS can just say `transform-origin: 50% 50%`.

The static sprites get measured too, because the markup has to know where their
features sit: the date frame's two panes (so the digits can be drawn into them)
and the power-reserve scale's arc centre, radius and angular extent (so the
pointer pivots on the arc's centre and sweeps its full span).

The crown is measured against the case rather than the dial: it is drawn side-on
with its stem to the left, so the length that disappears into the case band is
part of the art. We find the step where the stem swells into the tube collar and
treat that column as the case edge, which makes the CSS `right` offset simply
the crown's protrusion. (The 10 o'clock corrector used to be rendered here too;
it went back to an inline SVG cap in the markup and no longer needs art.)

    python3 tools/build-dial-art.py
"""

import math
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

# name -> (source file, shipped square size in px, tip reach as % of the face).
# The tip reach is the design decision; everything else about the hand's
# placement falls out of it, and build() prints the numbers styles.css needs.
HANDS = {
    "hand-hour": ("hour-hand-sprite.png", 560, 16.96),
    "hand-minute": ("minute-hand-sprite.png", 720, 22.00),
    "hand-seconds": ("seconds-hand-sprite.png", 380, 11.60),
    "reserve-hand": ("power-reserve-hand-sprite.png", 440, 13.50),
}

DATE_SRC = "date-window-blank-sprite.png"
DATE_WIDTH = 420
DATE_FACE_WIDTH = 20.5  # % of the face the frame is drawn at

RESERVE_SRC = "power-reserve-display-sprite.png"
RESERVE_WIDTH = 240
RESERVE_ARC_SPAN_FACE = 21.5  # % of the face the drawn arc spans vertically

CROWN_SRC = "crown-sprite.png"
CROWN_WIDTH = 300
# The design decision for the crown is how far it stands proud of the case at
# 3 o'clock; the CSS-drawn crown it replaces reached 3.29%, so hold that and let
# the sprite's own proportions settle the rest.
CROWN_PROTRUSION_FACE = 3.30
# The crown sits in .watch-flip at z = 0 while the case face is pushed forward
# by --case-depth / 2 = 3vmin under a 2400px perspective, so the band projects
# slightly wider than the crown's own plane and hides a little extra art:
# 3vmin/2400px works out at 0.48% of the face at 760px vmin, ~0.9% at 1400px.
# Take the low end, so the tube collar keeps a sliver showing at every size and
# the stem's flat cut end stays buried at all of them.
CROWN_SEAT_FACE = 0.50

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


def row_runs(mask):
    """Per-row (width, centre-x) of the silhouette, 0 where the row is empty."""
    width = np.zeros(mask.shape[0])
    centre = np.zeros(mask.shape[0])
    for y in range(mask.shape[0]):
        xs = np.nonzero(mask[y])[0]
        if len(xs):
            width[y] = xs.max() - xs.min() + 1
            centre[y] = (xs.min() + xs.max()) / 2
    return width, centre


def hand_pivot(im):
    """Return (pivot_xy, boss_radius, tip, tail, half_width) in source pixels.

    The hands are not bottom-pivot bars: each is a blade with a round pivot boss
    part way down and a counterweight tail below it. The boss is the only place
    the silhouette bulges into a circle, so it owns the widest row -- and for a
    circle the width profile w(y) = 2*sqrt(R^2 - (y-cy)^2) is symmetric about the
    centre. Slice the profile at 80% of its peak (safely above the blade, and
    only 0.6R off centre so the crossings are still on the boss) and take the
    midpoint of the run: that is the axis the watchmaker would have staked.
    """
    alpha = np.array(im)[..., 3]
    mask = alpha > 128
    width, centre = row_runs(mask)

    peak = int(np.argmax(width))
    level = 0.8 * width[peak]
    top = peak
    while top - 1 >= 0 and width[top - 1] >= level:
        top -= 1
    bottom = peak
    while bottom + 1 < len(width) and width[bottom + 1] >= level:
        bottom += 1

    # +0.5 moves from pixel indices to continuous coordinates (pixel i spans
    # [i, i+1)), which is what the crop below has to be symmetric about.
    cy = (top + bottom) / 2 + 0.5
    cx = centre[top:bottom + 1].mean() + 0.5

    ys, xs = np.nonzero(alpha > 16)
    return (
        (cx, cy),
        width[peak] / 2,
        cy - ys.min(),
        ys.max() + 1 - cy,
        max(cx - xs.min(), xs.max() + 1 - cx),
    )


def centre_crop(im, pivot, half):
    """Square crop of side 2*half centred exactly on `pivot` (sub-pixel)."""
    px, py = pivot
    left, top = math.floor(px - half), math.floor(py - half)
    # Shift the art by the sub-pixel remainder so the crop lands dead centre.
    dx, dy = px - half - left, py - half - top
    if dx or dy:
        im = im.transform(
            im.size, Image.AFFINE, (1, 0, dx, 0, 1, dy), resample=Image.BICUBIC
        )
    out = Image.new("RGBA", (half * 2, half * 2), (0, 0, 0, 0))
    out.paste(im.crop((left, top, left + half * 2, top + half * 2)), (0, 0))
    return out


def fit_circle(xs, ys):
    """Kasa algebraic circle fit. Returns (cx, cy, r)."""
    a = np.column_stack([xs, ys, np.ones(len(xs))])
    b = xs ** 2 + ys ** 2
    sol, *_ = np.linalg.lstsq(a, b, rcond=None)
    cx, cy = sol[0] / 2, sol[1] / 2
    return cx, cy, math.sqrt(sol[2] + cx ** 2 + cy ** 2)


def reserve_geometry(im):
    """Measure the power-reserve scale: arc centre, radius and angular span.

    The AUF / AB lettering is baked into the sprite as separate blobs, so the
    scale itself is simply the largest connected component. Its ticks and end
    stops straddle the arc symmetrically, which means the per-row centroid of
    that component tracks the arc's centreline and can be circle-fitted.
    """
    alpha = np.array(im)[..., 3]
    mask = alpha > 128
    labels, count = ndimage.label(mask)
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    scale = labels == int(np.argmax(sizes)) + 1

    ys = np.nonzero(scale.any(axis=1))[0]
    pts = [(np.nonzero(scale[y])[0].mean(), y) for y in ys]
    px = np.array([p[0] for p in pts])
    py = np.array([p[1] for p in pts])
    cx, cy, r = fit_circle(px, py)

    # Angles measured the way CSS rotate() does: 0deg points straight up, and
    # positive turns clockwise on screen.
    yy, xx = np.nonzero(scale)
    bearings = np.degrees(np.arctan2(xx - cx, cy - yy))

    # The two end stops are fatter than the ticks and sit at the ends of the
    # scale. What the pointer should line up with is the middle of each stop,
    # not its outer edge, so take the centroid of everything within a stop's
    # width of either extreme (3deg is ~26px of arc here; a stop is ~12px).
    lo = bearings[bearings <= bearings.min() + 3].mean()
    hi = bearings[bearings >= bearings.max() - 3].mean()
    return (cx, cy), r, lo, hi, scale


def date_panes(im):
    """Return (frame_bbox, [pane_bbox, pane_bbox]) for the twin date window."""
    a = np.array(im).astype(int)
    alpha, red, blue = a[..., 3], a[..., 0], a[..., 2]
    lum = a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114
    solid = alpha > 200

    ys, xs = np.nonzero(solid)
    frame = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)

    # The panes are the big flat cream fields; the frame around them is a far
    # warmer rose gold, so a cap on red-minus-blue separates the two cleanly.
    cream = solid & (lum > 200) & (red - blue > 10) & (red - blue < 70)
    labels, count = ndimage.label(cream)
    sizes = ndimage.sum(cream, labels, range(1, count + 1))
    panes = []
    for idx in np.argsort(sizes)[::-1][:2]:
        py, px = np.nonzero(labels == idx + 1)
        panes.append((px.min(), py.min(), px.max() + 1, py.max() + 1))
    panes.sort()
    return frame, panes


def ink_bbox(im, thresh=0):
    """Tight (x0, y0, x1, y1) around everything that is not fully transparent."""
    ys, xs = np.nonzero(np.array(im)[..., 3] > thresh)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def crown_geometry(im):
    """Return (bbox, axis_y, seam_x) for the side-on crown.

    Left to right the render is: a thin stem, a stepped tube collar, the fluted
    barrel, then the domed end cap. Only the stem belongs inside the case, so
    the seam we butt against the band is the first column where the silhouette
    swells past the stem's plateau -- found from the column-extent profile,
    which is flat over the stem and steps up at the collar.

    The axis is the stem's centreline: that is the line the crown turns about
    and the height the hole in the case band would be bored at.
    """
    alpha = np.array(im)[..., 3]
    mask = alpha > 0
    x0, y0, x1, y1 = ink_bbox(im)

    extent = np.zeros(mask.shape[1])
    centre = np.zeros(mask.shape[1])
    for x in range(x0, x1):
        ys = np.nonzero(mask[:, x])[0]
        extent[x] = ys.max() - ys.min() + 1
        centre[x] = (ys.min() + ys.max() + 1) / 2

    stem = extent[x0]
    seam = next(
        (x for x in range(x0, x1) if extent[x] > stem * 1.15),
        x0,
    )
    axis = centre[x0:seam].mean()
    return (x0, y0, x1, y1), axis, seam


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

    print("\nhands:")
    for name, (fname, out_w, tip_face) in HANDS.items():
        im = Image.open(SRC / fname).convert("RGBA")
        pivot, boss_r, tip, tail, half_w = hand_pivot(im)
        half = math.ceil(max(tip, tail, half_w)) + 3
        save(centre_crop(im, pivot, half), OUT / f"{name}.webp", out_w)

        # One scale converts every measurement to % of the face: the tip has to
        # land at tip_face, and the crop is `half` px from the axis in each
        # direction, so the square wrapper is 2 * half * (tip_face / tip) wide.
        k = tip_face / tip
        box = 2 * half * k
        print(
            f"    axis in source   ({pivot[0]:.2f}, {pivot[1]:.2f})  of {im.width}x{im.height}"
            f"  (canvas centre {im.width / 2:.1f}, {im.height / 2:.1f})\n"
            f"    reach px         tip {tip:.1f}  tail {tail:.1f}  boss r {boss_r:.1f}\n"
            f"    square crop      {half * 2}px, axis dead centre\n"
            f"    CSS box          {box:.3f}% of the face  (tip {tip_face:.2f}%, "
            f"tail {tail * k:.2f}%, boss r {boss_r * k:.3f}%)\n"
            f"    offset from axis left/top -{box / 2:.3f}%"
        )

    print("\ndate window:")
    im = Image.open(SRC / DATE_SRC).convert("RGBA")
    frame, panes = date_panes(im)
    crop = im.crop(frame)
    save(crop, OUT / "date-window.webp", DATE_WIDTH)
    fw, fh = crop.size
    print(f"    frame            {fw}x{fh}px, aspect {fw / fh:.4f}")
    print(f"    CSS box          {DATE_FACE_WIDTH:.2f}% x {DATE_FACE_WIDTH * fh / fw:.3f}% of the face")
    for i, (x0, y0, x1, y1) in enumerate(panes):
        x0, y0, x1, y1 = x0 - frame[0], y0 - frame[1], x1 - frame[0], y1 - frame[1]
        print(
            f"    pane {i}           left {x0 / fw * 100:.2f}%  top {y0 / fh * 100:.2f}%"
            f"  w {(x1 - x0) / fw * 100:.2f}%  h {(y1 - y0) / fh * 100:.2f}%"
            f"  centre ({(x0 + x1) / 2 / fw * 100:.2f}%, {(y0 + y1) / 2 / fh * 100:.2f}%)"
        )

    print("\npower reserve scale:")
    im = Image.open(SRC / RESERVE_SRC).convert("RGBA")
    (cx, cy), r, a_top, a_bottom, scale_mask = reserve_geometry(im)
    ys, xs = np.nonzero(np.array(im)[..., 3] > 16)
    bbox = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    crop = im.crop(bbox)
    save(crop, OUT / "reserve-scale.webp", RESERVE_WIDTH)
    cx, cy = cx - bbox[0], cy - bbox[1]
    sw, sh = crop.size

    arc_rows = np.nonzero(scale_mask.any(axis=1))[0]
    span_px = arc_rows.max() - arc_rows.min() + 1
    k = RESERVE_ARC_SPAN_FACE / span_px  # % of the face per source pixel
    print(
        f"    sprite           {sw}x{sh}px, aspect {sw / sh:.4f}\n"
        f"    arc centre       ({cx:.1f}, {cy:.1f}) px  ->  "
        f"({cx / sw * 100:.2f}%, {cy / sh * 100:.2f}%) of the sprite box\n"
        f"    arc radius       {r:.1f}px = {r * k:.3f}% of the face\n"
        f"    end stops        {a_top:.2f}deg (AUF, full) .. {a_bottom:.2f}deg (AB, empty)"
        f"  -> sweep {a_bottom - a_top:.2f}deg\n"
        f"    main.js pointer  rotate({a_bottom:.1f} - reserve * {a_bottom - a_top:.1f})deg\n"
        f"    CSS box          {sw * k:.3f}% x {sh * k:.3f}% of the face"
    )

    print("\ncrown:")
    im = Image.open(SRC / CROWN_SRC).convert("RGBA")
    (x0, y0, x1, y1), axis, seam = crown_geometry(im)
    crop = im.crop((x0, y0, x1, y1))
    save(crop, OUT / "crown.webp", CROWN_WIDTH)
    cw, ch = crop.size

    # One scale again: the art right of the seam has to measure
    # CROWN_PROTRUSION_FACE, and every other number follows from it.
    k = CROWN_PROTRUSION_FACE / (x1 - seam)
    box_w, box_h = cw * k, ch * k
    # The seam is parked on the band's apparent edge, which the seat allowance
    # puts CROWN_SEAT_FACE outside the nominal face box.
    right = CROWN_PROTRUSION_FACE + CROWN_SEAT_FACE
    print(
        f"    ink bbox         {x0},{y0} .. {x1},{y1}  ({cw}x{ch}px, aspect {cw / ch:.4f})\n"
        f"    stem axis        y {axis:.1f}px  ({(axis - y0) / ch * 100:.2f}% down the crop)\n"
        f"    case seam        x {seam}px  -> stem {(seam - x0) * k:.3f}% buried,"
        f" {CROWN_PROTRUSION_FACE:.2f}% of crown proud of the band\n"
        f"    CSS box          {box_w:.3f}% x {box_h:.3f}% of the face\n"
        f"    offsets          right -{right:.2f}%  "
        f"top {50 - (axis - y0) * k:.3f}%  (axis on the 50% line)"
    )


if __name__ == "__main__":
    main()
