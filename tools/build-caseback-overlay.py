#!/usr/bin/env python3
"""Caseback overlay rig, v4.

Real part sprites (user-supplied wheel renders) spin over a wheel-less
caseback base. Static occluders — the bridges, the engraved cock, the steel
arm and the plate edge — are cut from the same base and sit above the moving
parts, so wheels never cross bridgework ("translucent zones").

Each part sprite is re-centred on its arbor (the centroid of its central
alpha hole), cropped square with even dimensions, and rescaled so its outer
radius lands exactly at the configured radius in the 1254px base frame.

Outputs to public/assets/caseback/rig/ (replacing the v3 assets):
  base.webp            the wheel-less floor (lossless)
  part-<name>.webp     re-centred rotating sprites
  static-<name>.webp   occluder cutouts
  rig.json             v4 geometry + animation table
Plus public/assets/caseback/l9511-simplified-lossless.webp — the composed
at-rest fallback (shown when the rig is hidden / reduced motion).

Usage: python3 tools/build-caseback-overlay.py
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CFG = ROOT / "tools/caseback-overlay.json"
OUT = ROOT / "public/assets/caseback/rig"
QA = ROOT / "tools/qa/caseback"
IMG = 1254


def poly_mask(poly, dilate=0, feather=0.0, supersample=2):
    s = supersample
    m = np.zeros((IMG * s, IMG * s), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(poly, np.float64) * s).astype(np.int32)], 255)
    if dilate:
        m = cv2.dilate(m, np.ones((2 * dilate * s + 1,) * 2, np.uint8))
    m = cv2.resize(m, (IMG, IMG), interpolation=cv2.INTER_AREA)
    if feather:
        m = cv2.GaussianBlur(m, (0, 0), feather)
    return m.astype(np.float32) / 255


def decontaminate_rgb(rgb, alpha, grow=3):
    a8 = (alpha > 0).astype(np.uint8)
    out = rgb.copy()
    for _ in range(grow):
        dil = cv2.dilate(out, np.ones((3, 3), np.uint8))
        m = cv2.dilate(a8, np.ones((3, 3), np.uint8)) - a8
        out[m > 0] = dil[m > 0]
        a8 = cv2.dilate(a8, np.ones((3, 3), np.uint8))
    return out


def bridge_mask(base_u8, fl):
    sm = cv2.bilateralFilter(base_u8, 11, 28, 11)
    sm = cv2.bilateralFilter(sm, 11, 28, 11)
    tol = fl["tolerance"]
    acc = np.zeros((IMG, IMG), np.uint8)
    for sx, sy in fl["seeds"]:
        mask = np.zeros((IMG + 2, IMG + 2), np.uint8)
        cv2.floodFill(sm.copy(), mask, (sx, sy), 0,
                      loDiff=(tol,) * 3, upDiff=(tol,) * 3,
                      flags=cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | 4)
        acc |= mask[1:-1, 1:-1]
    acc = (acc > 0).astype(np.uint8) * 255
    acc = cv2.morphologyEx(acc, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab = cv2.connectedComponents(acc)
    keep = {lab[sy, sx] for sx, sy in fl["seeds"] if lab[sy, sx] != 0}
    acc = (np.isin(lab, list(keep)) * 255).astype(np.uint8)
    inv = cv2.bitwise_not(acc)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(inv)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < fl["hole_fill_px"]:
            acc[lab == i] = 255
    return acc


def hole_center(alpha):
    """Arbor = centroid of the central transparent hole."""
    h, w = alpha.shape
    solid = (alpha > 10).astype(np.uint8)
    inv = 1 - solid
    n, lab = cv2.connectedComponents(inv)
    cy, cx = h // 2, w // 2
    # walk outward from the bitmap centre until we're in a hole component
    lbl = lab[cy, cx]
    if lbl == 0 or solid[cy, cx]:
        for r in range(1, 200):
            found = False
            for dy, dx in ((0, r), (0, -r), (r, 0), (-r, 0)):
                if not solid[cy + dy, cx + dx] and lab[cy + dy, cx + dx] != lab[0, 0]:
                    lbl = lab[cy + dy, cx + dx]
                    found = True
                    break
            if found:
                break
    ys, xs = np.where(lab == lbl)
    return float(xs.mean()), float(ys.mean())


def build_part(p):
    src = np.array(Image.open(ROOT / p["src"]).convert("RGBA"))
    a = src[..., 3]
    hx, hy = hole_center(a)
    ys, xs = np.where(a > 10)
    r_src = float(np.hypot(xs - hx, ys - hy).max())
    scale = p["r_out"] / r_src
    # crop square around the hole centre, even size, then rescale
    half = int(np.ceil(r_src)) + 4
    x0, y0 = int(round(hx - half)), int(round(hy - half))
    size = 2 * half
    pad = np.zeros((size, size, 4), np.uint8)
    sx0, sy0 = max(0, -x0), max(0, -y0)
    cx0, cy0 = max(0, x0), max(0, y0)
    cw = min(x0 + size, src.shape[1]) - cx0
    ch = min(y0 + size, src.shape[0]) - cy0
    pad[sy0:sy0 + ch, sx0:sx0 + cw] = src[cy0:cy0 + ch, cx0:cx0 + cw]
    out_px = int(round(size * scale))
    out_px += out_px % 2
    spr = cv2.resize(pad, (out_px, out_px), interpolation=cv2.INTER_AREA)
    rgb = decontaminate_rgb(spr[..., :3], spr[..., 3].astype(np.float32) / 255)
    spr = np.dstack([rgb, spr[..., 3]])
    box = out_px  # px in base frame
    cx, cy = p["center"]
    bx = cx - box / 2
    by = cy - box / 2
    print(f"  {p['name']}: hole=({hx:.1f},{hy:.1f}) r_src={r_src:.1f} "
          f"-> r_out={p['r_out']} box={box}px")
    return spr, {
        "name": p["name"],
        "center": [cx, cy],
        "box_px": [round(bx, 2), round(by, 2), box, box],
        "r_out": p["r_out"],
        "z": p["z"],
        "anim": p["anim"],
        "file": f"part-{p['name']}.webp",
        **({"shadow": p["shadow"]} if p.get("shadow") else {}),
    }


def main():
    cfg = json.loads(CFG.read_text())
    base = np.array(Image.open(ROOT / cfg["base"]).convert("RGB"))
    assert base.shape == (IMG, IMG, 3), base.shape
    OUT.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)

    # wipe v3 assets: this rig replaces them wholesale
    for f in OUT.iterdir():
        f.unlink()

    Image.fromarray(base).save(OUT / "base.webp", lossless=True, quality=100)

    parts_out = []
    sprites = {}
    for p in sorted(cfg["parts"], key=lambda q: q["z"]):
        spr, info = build_part(p)
        sprites[p["name"]] = spr
        Image.fromarray(spr).save(OUT / info["file"], lossless=True, quality=100)
        parts_out.append(info)

    # ---- statics from the base
    statics_out = []
    bm = bridge_mask(base, cfg["flood"])
    Image.fromarray(bm).save(QA / "bridgemask-v4.png")
    dil = cfg["flood"]["sprite_dilate_px"]
    bmf = cv2.dilate(bm, np.ones((2 * dil + 1,) * 2, np.uint8))
    bmf = cv2.GaussianBlur(bmf, (0, 0), 1.2).astype(np.float32) / 255
    masks = {"bridges": bmf}
    shadow_layers = {}
    for name, spec in cfg["polys"].items():
        feather = spec.get("feather_px", 1.3)
        dil = 1 if spec.get("up_shadow") else 2
        m = poly_mask(spec["polygon"], dilate=dil, feather=feather)
        if spec.get("up_shadow"):
            # slight upward shadow the support casts on the ring beneath it:
            # the dilated silhouette shifted up, minus the silhouette itself,
            # clipped to the balance band's radii so it never smears across
            # the static dome or spring
            grown = poly_mask(spec["polygon"], dilate=4, feather=1.4)
            shifted = np.roll(grown, -3, axis=0)
            band = np.clip(shifted - m, 0, 1) * 0.30
            bal = next(q for q in cfg["parts"] if q["name"] == "balance")
            bcx, bcy = bal["center"]
            yy2, xx2 = np.mgrid[0:IMG, 0:IMG]
            dd = np.hypot(xx2 + 0.5 - bcx, yy2 + 0.5 - bcy)
            ring_zone = np.clip((dd - 94) / 3, 0, 1) * np.clip((131 - dd) / 3, 0, 1)
            band *= ring_zone
            if band.max() > 0.02:
                shadow_layers[f"{name}-shadow"] = band
        masks[name] = m
    # shadows must composite before (under) their arms; statics draw in order
    ordered = {}
    for name in masks:
        if f"{name}-shadow" in shadow_layers:
            ordered[f"{name}-shadow"] = shadow_layers[f"{name}-shadow"]
        ordered[name] = masks[name]
    masks = ordered
    for name, m in masks.items():
        if name.endswith("-shadow"):
            ys, xs = np.where(m > 0.004)
            x0 = max(0, int(xs.min()) - 2); y0 = max(0, int(ys.min()) - 2)
            x1 = min(IMG, int(xs.max()) + 3); y1 = min(IMG, int(ys.max()) + 3)
            a = np.clip(np.round(m[y0:y1, x0:x1] * 255), 0, 255).astype(np.uint8)
            rgba = np.dstack([np.zeros((y1 - y0, x1 - x0, 3), np.uint8), a])
            Image.fromarray(rgba).save(OUT / f"static-{name}.webp",
                                       lossless=True, quality=100)
            statics_out.append({"name": name, "box_px": [x0, y0, x1 - x0, y1 - y0],
                                "file": f"static-{name}.webp"})
            continue
        ys, xs = np.where(m > 0.004)
        x0 = max(0, int(xs.min()) - 2); y0 = max(0, int(ys.min()) - 2)
        x1 = min(IMG, int(xs.max()) + 3); y1 = min(IMG, int(ys.max()) + 3)
        crop = base[y0:y1, x0:x1]
        a = np.clip(np.round(m[y0:y1, x0:x1] * 255), 0, 255).astype(np.uint8)
        rgb = decontaminate_rgb(crop, m[y0:y1, x0:x1])
        Image.fromarray(np.dstack([rgb, a])).save(OUT / f"static-{name}.webp",
                                                  lossless=True, quality=100)
        statics_out.append({"name": name, "box_px": [x0, y0, x1 - x0, y1 - y0],
                            "file": f"static-{name}.webp"})

    # ---- gems: chaton discs cloned from the base, pinned static over wheel
    # arbors (the jewel caps the pivot while the wheel turns beneath it)
    for gem in cfg.get("gems", []):
        gr = gem["r"]
        dx, dy = gem["donor"]
        size = 2 * (gr + 2)
        yy, xx = np.mgrid[0:size, 0:size]
        d = np.hypot(xx + 0.5 - size / 2, yy + 0.5 - size / 2)
        a = np.clip((gr - d) / 1.5 + 0.5, 0, 1)
        crop = base[int(dy - size / 2):int(dy - size / 2) + size,
                    int(dx - size / 2):int(dx - size / 2) + size]
        rgb = decontaminate_rgb(crop, a)
        spr = np.dstack([rgb, np.clip(np.round(a * 255), 0, 255).astype(np.uint8)])
        fn = f"static-gem-{gem['name']}.webp"
        Image.fromarray(spr).save(OUT / fn, lossless=True, quality=100)
        gx, gy = gem["at"]
        statics_out.append({"name": f"gem-{gem['name']}",
                            "box_px": [round(gx - size / 2, 2),
                                       round(gy - size / 2, 2), size, size],
                            "file": fn})

    # ---- at-rest composite: fallback image + QA
    comp = base.astype(np.float32)
    for info in parts_out:
        spr = sprites[info["name"]].astype(np.float32)
        bx, by, w, h = info["box_px"]
        bx, by = int(round(bx)), int(round(by))
        sx0, sy0 = max(0, -bx), max(0, -by)
        dx0, dy0 = max(0, bx), max(0, by)
        cw = min(bx + w, IMG) - dx0
        ch = min(by + h, IMG) - dy0
        s = spr[sy0:sy0 + ch, sx0:sx0 + cw]
        af = s[..., 3:] / 255
        # baked contact shadow so the fallback matches the runtime drop-shadow;
        # "high" parts (the balance) get a deeper, further-thrown shadow so
        # they read as the tallest component in the stack
        part_cfg = next(q for q in cfg["parts"] if q["name"] == info["name"])
        if part_cfg.get("shadow") == "high":
            sh = np.roll(np.roll(af, 5, axis=0), 4, axis=1) * 0.55
            floor_mix = 0.35
        else:
            sh = np.roll(np.roll(af, 3, axis=0), 2, axis=1) * 0.45
            floor_mix = 0.25
        dst = comp[dy0:dy0 + ch, dx0:dx0 + cw]
        dst = dst * (1 - sh) + dst * sh * floor_mix
        comp[dy0:dy0 + ch, dx0:dx0 + cw] = dst * (1 - af) + s[..., :3] * af
    for info in statics_out:
        spr = np.array(Image.open(OUT / info["file"])).astype(np.float32)
        bx, by, w, h = info["box_px"]
        bx, by = int(round(bx)), int(round(by))
        af = spr[..., 3:] / 255
        comp[by:by + h, bx:bx + w] = comp[by:by + h, bx:bx + w] * (1 - af) \
            + spr[..., :3] * af
    comp_u8 = np.clip(np.round(comp), 0, 255).astype(np.uint8)
    Image.fromarray(comp_u8).save(
        ROOT / "public/assets/caseback/l9511-simplified-lossless.webp",
        lossless=True, quality=100)
    Image.fromarray(comp_u8).save(QA / "overlay-composite.png")

    # ---- leak check: any part pixel visible outside every occluder and its
    # own footprint means a wheel peeks where it shouldn't (user-visible bug)
    diff = (np.abs(comp - base.astype(np.float32)).max(axis=-1) > 10)
    cover = np.zeros((IMG, IMG), bool)
    yy, xx = np.mgrid[0:IMG, 0:IMG]
    for info in parts_out:
        cx, cy = info["center"]
        margin = 10 if info.get("shadow") == "high" else 4
        cover |= np.hypot(xx + 0.5 - cx, yy + 0.5 - cy) <= info["r_out"] + margin
    for gem in cfg.get("gems", []):
        gx, gy = gem["at"]
        cover |= np.hypot(xx + 0.5 - gx, yy + 0.5 - gy) <= gem["r"] + 4
    for info in statics_out:
        if "shadow" in info["name"]:
            bx, by, w, h = (int(round(v)) for v in info["box_px"])
            cover[by:by + h, bx:bx + w] = True
    leaks = diff & ~cover
    n_lab, lab, stats, cents = cv2.connectedComponentsWithStats(
        leaks.astype(np.uint8), connectivity=8)
    big = [(int(cents[i][0]), int(cents[i][1]), int(stats[i, cv2.CC_STAT_AREA]))
           for i in range(1, n_lab) if stats[i, cv2.CC_STAT_AREA] > 30]
    if big:
        print("LEAK WARNING: composite differs from base outside part footprints:")
        for x, y, area in sorted(big, key=lambda t: -t[2])[:10]:
            print(f"  at ({x},{y}) area {area}px")
    else:
        print("leak check clean: parts only ever show inside their footprints")

    rig = {"version": 4, "image": {"w": IMG, "h": IMG},
           "parts": parts_out, "statics": statics_out, "beat_hz": 2.5}
    (OUT / "rig.json").write_text(json.dumps(rig, indent=2))
    total = sum(f.stat().st_size for f in OUT.iterdir())
    print(f"v4 rig emitted: {len(parts_out)} parts, {len(statics_out)} statics, "
          f"{total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
