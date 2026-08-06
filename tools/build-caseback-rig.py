#!/usr/bin/env python3
"""Caseback living-rig pipeline, v3.

Decomposes the rendered calibre (tools/assets-src/caseback-master.png, 1254x1254)
into a full-train animation rig: rotating wheel/band sprites inside precise
visible-region windows, static bridge sprites cut from the untouched render
layered on top, and a plus-lighter spec layer per moving part so the render's
lighting stays anchored in space while metal turns beneath it.

Ring parts rotate about circles fitted to their own visible tooth-band
curvature (the render is AI-generated; local curvature match inside each
window is the correctness criterion). Occluded sectors are reconstructed by
tooth-/spoke-pitch cloning in polar space. Identity gate: composited at rest,
the full stack (floor + windowed sprites + spec + bridges) equals the master
render exactly; cloned content lives strictly outside every window.

Usage:
  python3 tools/build-caseback-rig.py all [--report-only]
  python3 tools/build-caseback-rig.py register        # registration report only
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "tools/assets-src/caseback-master.png"
OVERRIDES = ROOT / "tools/caseback-overrides.json"
OUT = ROOT / "public/assets/caseback/rig"
QA = ROOT / "tools/qa/caseback"
IMG = 1254

ANG_SAMPLES = 2880


# ---------------------------------------------------------------- utilities

def load_master():
    data = MASTER.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    cfg = json.loads(OVERRIDES.read_text())
    if sha != cfg["master_sha256"]:
        sys.exit(f"FATAL: master sha256 mismatch ({sha[:12]}… != pinned)")
    img = np.array(Image.open(MASTER).convert("RGB"), dtype=np.float32)
    assert img.shape == (IMG, IMG, 3), img.shape
    return img, cfg


def gray(img):
    return cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)


def sample_ring(field, cx, cy, r, n=720):
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    xs = (cx + r * np.cos(a)).astype(np.float32)
    ys = (cy + r * np.sin(a)).astype(np.float32)
    return cv2.remap(field, xs.reshape(1, -1), ys.reshape(1, -1),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)[0]


def angular_profile(field, cx, cy, r0, r1, n=ANG_SAMPLES):
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    rs = np.linspace(r0, r1, max(3, int((r1 - r0) / 0.5)))
    acc = np.zeros(n, dtype=np.float64)
    for r in rs:
        xs = (cx + r * np.cos(a)).astype(np.float32)
        ys = (cy + r * np.sin(a)).astype(np.float32)
        acc += cv2.remap(field, xs.reshape(1, -1), ys.reshape(1, -1),
                         cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)[0]
    return acc / len(rs)


def harmonic_mag(profile, k, valid=None):
    p = profile.astype(np.float64).copy()
    if valid is not None:
        m = p[valid].mean() if valid.any() else p.mean()
        p[~valid] = m
    p = p - p.mean()
    return np.abs(np.fft.rfft(p)[k])


# ---------------------------------------------------------------- registration
# (unchanged v2 machinery: subpixel center refinement + rim eccentricity fit)

def detect_harmonic_k(sobel, cx, cy, r0, r1, kband, valid=None):
    prof = angular_profile(sobel, cx, cy, r0, r1)
    p = prof.astype(np.float64).copy()
    if valid is not None:
        m = p[valid].mean() if valid.any() else p.mean()
        p[~valid] = m
    p -= p.mean()
    spec = np.abs(np.fft.rfft(p))
    k0, k1 = kband
    k = int(np.argmax(spec[k0:k1 + 1]) + k0)
    return k, float(spec[k])


def edge_radius_profile(sobel, cx, cy, r_peak, valid, half_span=6.0, step=0.1):
    n = ANG_SAMPLES
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    rs = np.arange(r_peak - half_span, r_peak + half_span + 1e-6, step)
    xs = (cx + np.outer(rs, np.cos(a))).astype(np.float32)
    ys = (cy + np.outer(rs, np.sin(a))).astype(np.float32)
    m = cv2.remap(sobel, xs, ys, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    idx = np.argmax(m, axis=0)
    idx_c = np.clip(idx, 1, len(rs) - 2)
    y0 = m[idx_c - 1, np.arange(n)]
    y1 = m[idx_c, np.arange(n)]
    y2 = m[idx_c + 1, np.arange(n)]
    denom = (y0 - 2 * y1 + y2)
    with np.errstate(divide="ignore", invalid="ignore"):
        shift = np.where(np.abs(denom) > 1e-9, 0.5 * (y0 - y2) / denom, 0.0)
    r_theta = rs[idx_c] + np.clip(shift, -1, 1) * step
    ok = valid.copy() if valid is not None else np.ones(n, bool)
    ok &= y1 > np.percentile(m.max(axis=0), 20)
    return r_theta, ok


def fit_rim_eccentricity(sobel, cx, cy, r_peak, valid, rounds=2):
    total_dx = total_dy = 0.0
    R = r_peak
    for _ in range(rounds):
        r_theta, ok = edge_radius_profile(sobel, cx, cy, r_peak, valid)
        a = np.linspace(0, 2 * math.pi, ANG_SAMPLES, endpoint=False)[ok]
        r = r_theta[ok]
        A = np.column_stack([np.ones_like(a), np.cos(a), np.sin(a)])
        (R, ex, ey), *_ = np.linalg.lstsq(A, r, rcond=None)
        cx, cy = cx + ex, cy + ey
        total_dx += ex
        total_dy += ey
    r_theta, ok = edge_radius_profile(sobel, cx, cy, r_peak, valid)
    a = np.linspace(0, 2 * math.pi, ANG_SAMPLES, endpoint=False)[ok]
    r = r_theta[ok]
    A = np.column_stack([np.ones_like(a), np.cos(a), np.sin(a),
                         np.cos(2 * a), np.sin(2 * a)])
    (R, e1x, e1y, e2x, e2y), *_ = np.linalg.lstsq(A, r, rcond=None)
    return cx, cy, {
        "R": round(float(R), 2),
        "correction_px": round(math.hypot(total_dx, total_dy), 3),
        "residual_k1_px": round(math.hypot(e1x, e1y), 3),
        "k2_px": round(math.hypot(e2x, e2y), 3),
    }


def occluded_angles(sobel, cx, cy, r_peak, k, grow_deg=3.0):
    prof = angular_profile(sobel, cx, cy, r_peak - 3, r_peak + 3)
    p = prof - prof.mean()
    theta = np.linspace(0, 2 * math.pi, ANG_SAMPLES, endpoint=False)
    z = p * np.exp(-1j * k * theta)
    w = int(ANG_SAMPLES * 15 / 360)
    kern = np.ones(w) / w
    env = np.abs(np.convolve(np.concatenate([z, z[:w]]), kern, mode="same")[:ANG_SAMPLES])
    thresh = 0.35 * np.median(env)
    alive = env >= thresh
    g = int(ANG_SAMPLES * grow_deg / 360)
    dead = (~alive).astype(np.uint8)
    dead = np.convolve(np.concatenate([dead, dead[:2 * g + 1]]),
                       np.ones(2 * g + 1), mode="same")[:ANG_SAMPLES] > 0
    return ~dead, env


def refine_center(sobel, seed, rband, kband, valid_angles=None):
    sx, sy = seed
    best = (-1.0, sx, sy, (rband[0] + rband[1]) / 2)
    for dy in np.arange(-8, 8.01, 0.5):
        for dx in np.arange(-8, 8.01, 0.5):
            cx, cy = sx + dx, sy + dy
            for r in np.arange(rband[0], rband[1] + 0.01, 1.0):
                e = float(sample_ring(sobel, cx, cy, r).mean())
                if e > best[0]:
                    best = (e, cx, cy, r)
    _, cx, cy, r_peak = best
    k, _ = detect_harmonic_k(sobel, cx, cy, r_peak - 3, r_peak + 3, kband, valid_angles)
    best_f = (-1.0, cx, cy, r_peak)
    for dy in np.arange(-1.2, 1.201, 0.1):
        for dx in np.arange(-1.2, 1.201, 0.1):
            fx, fy = cx + dx, cy + dy
            prof = angular_profile(sobel, fx, fy, r_peak - 3, r_peak + 3, n=ANG_SAMPLES)
            mag = harmonic_mag(prof, k, valid_angles)
            if mag > best_f[0]:
                best_f = (mag, fx, fy, r_peak)
    _, fx, fy, _ = best_f
    fx, fy, ecc = fit_rim_eccentricity(sobel, fx, fy, r_peak, valid_angles)
    return fx, fy, r_peak, k, ecc


def stage_register(img, cfg):
    """Refine centers for parts with refine: true; pass through locked centers."""
    g = gray(img)
    sobel = np.hypot(cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3),
                     cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3))
    reg = {}
    lines = []
    for name, p in cfg["parts"].items():
        if p.get("refine"):
            fx, fy, r_peak, k, ecc = refine_center(sobel, p["seed_center"],
                                                   p["radius_band"], p["harmonic_band"])
            valid, _ = occluded_angles(sobel, fx, fy, r_peak, k)
            fx, fy, r_peak, k, ecc = refine_center(sobel, (fx, fy), p["radius_band"],
                                                   p["harmonic_band"], valid)
            reg[name] = {"center": [round(fx, 2), round(fy, 2)], "k": k,
                         "r_peak": float(r_peak), "e_est_px": ecc["residual_k1_px"],
                         "ovality_px": ecc["k2_px"], "rim_R": ecc["R"]}
            lines.append(f"{name}: fitted center=({fx:.2f},{fy:.2f}) rimR={ecc['R']} "
                         f"k={k} e_res={ecc['residual_k1_px']:.3f}px "
                         f"ovality={ecc['k2_px']:.3f}px")
        else:
            reg[name] = {"center": list(p["center"]), "k": None,
                         "e_est_px": 0.0, "ovality_px": 0.0}
            lines.append(f"{name}: locked center=({p['center'][0]},{p['center'][1]}) "
                         f"(tooth-tip lstsq fit)")
    QA.mkdir(parents=True, exist_ok=True)
    (QA / "registration-report.txt").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    return reg


# ---------------------------------------------------------------- bridge mask

def carve_pie_windows(acc, cfg):
    """The flood leaks across soft champagne-to-gold gradients into the moving
    bands. Every pie-windowed part's visible arc is by definition NOT bridge,
    so carve those (slightly shrunk) regions back out of the mask."""
    yy, xx = np.mgrid[0:IMG, 0:IMG]
    for name, part in cfg["parts"].items():
        w = part.get("window", {})
        if "pie_deg" not in w:
            continue
        cx, cy = part["center"]
        if "annulus" in w:
            r0, r1 = w["annulus"]
        else:
            r0, r1 = 0.0, w["disc_r"]
        d = np.hypot(xx + 0.5 - cx, yy + 0.5 - cy)
        m = (d <= r1 - 2) & (d >= r0 + 2)
        a0, a1 = w["pie_deg"]
        ang = np.degrees(np.arctan2(yy + 0.5 - cy, xx + 0.5 - cx)) % 360
        if a0 + 2 <= a1 - 2:
            m &= (ang >= a0 + 2) & (ang <= a1 - 2)
        acc[m] = 0
    return acc


def stage_bridgemask(img, cfg):
    """Flood-fill combined bridge mask on a double-bilateral-smoothed master."""
    bf = cfg["bridge_flood"]
    u8 = img.astype(np.uint8)
    sm = cv2.bilateralFilter(u8, 11, 28, 11)
    sm = cv2.bilateralFilter(sm, 11, 28, 11)
    tol = bf["tolerance"]
    acc = np.zeros((IMG, IMG), np.uint8)
    for sx, sy in bf["seeds"]:
        mask = np.zeros((IMG + 2, IMG + 2), np.uint8)
        cv2.floodFill(sm.copy(), mask, (sx, sy), 0,
                      loDiff=(tol,) * 3, upDiff=(tol,) * 3,
                      flags=cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | 4)
        acc |= mask[1:-1, 1:-1]
    acc = (acc > 0).astype(np.uint8) * 255
    acc = cv2.morphologyEx(acc, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab = cv2.connectedComponents(acc)
    keep = {lab[sy, sx] for sx, sy in bf["seeds"] if lab[sy, sx] != 0}
    acc = (np.isin(lab, list(keep)) * 255).astype(np.uint8)
    # fill interior holes (screw heads, rubies, unflooded lobe shading).
    # The bandLOW pocket (~3k px) is also swallowed here, but the explicit
    # carve below restores exactly it.
    inv = cv2.bitwise_not(acc)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(inv)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 3500:
            acc[lab == i] = 255
    # the flood leaks across the soft lobe->band gradient into the bandLOW
    # zone; that window is bounded by hand-traced polys instead, so carve
    # exactly it (and nothing else) back out of the mask
    low = cfg["parts"]["bandLOW"]
    lw = window_mask(low, "bandLOW", {"bandLOW": {"center": low["center"]}},
                     cfg, np.zeros((IMG, IMG), np.uint8))
    acc[lw > 0.15] = 0
    QA.mkdir(parents=True, exist_ok=True)
    Image.fromarray(acc).save(QA / "bridgemask.png")
    return acc


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


# ---------------------------------------------------------------- windows

def window_mask(part, name, reg, cfg, bridgemask, feather=1.2):
    """Visible-region window in [0,1], full-frame, from boolean geometry."""
    w = part["window"]
    cx, cy = reg[name]["center"]
    s = 2
    ys, xs = np.mgrid[0:IMG * s, 0:IMG * s]
    x = (xs + 0.5) / s
    y = (ys + 0.5) / s
    d = np.hypot(x - cx, y - cy)
    if "disc_r" in w:
        m = d <= w["disc_r"]
    else:
        r0, r1 = w["annulus"]
        m = (d >= r0) & (d <= r1)
    if "pie_deg" in w:
        a0, a1 = w["pie_deg"]
        ang = np.degrees(np.arctan2(y - cy, x - cx)) % 360
        if a0 <= a1:
            m &= (ang >= a0) & (ang <= a1)
        else:
            m &= (ang >= a0) | (ang <= a1)
    m = (m * 255).astype(np.uint8)
    m = cv2.resize(m, (IMG, IMG), interpolation=cv2.INTER_AREA).astype(np.float32) / 255

    for sub in w.get("subtract_discs", []):
        if "part" in sub:
            scx, scy = reg[sub["part"]]["center"]
        else:
            scx, scy = sub["center"]
        yy, xx = np.mgrid[0:IMG, 0:IMG]
        dd = np.hypot(xx + 0.5 - scx, yy + 0.5 - scy)
        soft = np.clip((dd - sub["r"]) / 1.5 + 0.5, 0, 1)
        m = np.minimum(m, soft)
    for pname in w.get("subtract_polys", []):
        pm = poly_mask(cfg["polys"][pname]["polygon"], dilate=2, feather=1.2)
        m = np.minimum(m, 1 - pm)
    if w.get("subtract_bridgemask"):
        dil = cfg["bridge_flood"]["window_dilate_px"]
        bm = cv2.dilate(bridgemask, np.ones((2 * dil + 1,) * 2, np.uint8))
        bm = cv2.GaussianBlur(bm, (0, 0), 1.2).astype(np.float32) / 255
        m = np.minimum(m, 1 - bm)
    if w.get("erode_px"):
        e = int(round(w["erode_px"]))
        m = cv2.erode(m, np.ones((2 * e + 1,) * 2, np.uint8))
    m = cv2.GaussianBlur(m, (0, 0), feather)
    return m


# ---------------------------------------------------------------- sprites

def region_alpha(shape_hw, cx, cy, r_out, r_in=0.0, feather=1.25, supersample=2):
    h, w = shape_hw
    s = supersample
    ys, xs = np.mgrid[0:h * s, 0:w * s]
    d = np.hypot((xs + 0.5) / s - cx, (ys + 0.5) / s - cy)
    a = np.clip((r_out - d) / feather + 0.5, 0, 1)
    if r_in > 0:
        a *= np.clip((d - r_in) / feather + 0.5, 0, 1)
    a = a.reshape(h, s, w, s).mean(axis=(1, 3))
    return a.astype(np.float32)


def wrap_gaussian_lowpass(polar, sigma_deg):
    n = polar.shape[0]
    sigma = sigma_deg / 360 * n
    ksize = int(sigma * 6) | 1
    pad = ksize // 2
    ext = np.concatenate([polar[-pad:], polar, polar[:pad]], axis=0)
    blur = cv2.GaussianBlur(ext, (1, ksize), sigmaY=sigma, sigmaX=0)
    return blur[pad:pad + n]


def to_polar(img, cx, cy, r_max, n_ang=ANG_SAMPLES, rad_step=0.25):
    n_rad = int(r_max / rad_step)
    flags = cv2.INTER_CUBIC | cv2.WARP_POLAR_LINEAR
    return cv2.warpPolar(img, (n_rad, n_ang), (cx, cy), r_max, flags)


def from_polar(polar, cx, cy, r_max, shape_hw):
    flags = cv2.INTER_CUBIC | cv2.WARP_POLAR_LINEAR | cv2.WARP_INVERSE_MAP
    return cv2.warpPolar(polar, (shape_hw[1], shape_hw[0]), (cx, cy), r_max, flags)


def fill_occluded_polar(polar, occ, pitches_cols, blend_deg=2.0):
    n = polar.shape[0]
    out = polar.copy()
    occ_idx = np.where(occ)[0]
    if len(occ_idx) == 0:
        return out
    valid = ~occ
    blend = int(n * blend_deg / 360)
    for i in occ_idx:
        best = None
        for pitch in pitches_cols:
            for k in range(1, 24):
                for sgn in (1, -1):
                    j = int(round(i + sgn * k * pitch)) % n
                    if valid[j]:
                        cand = (k, j)
                        if best is None or cand[0] < best[0]:
                            best = cand
                        break
                else:
                    continue
                break
        if best is None:
            vi = np.where(valid)[0]
            j = vi[np.argmin(np.minimum((vi - i) % n, (i - vi) % n))] if len(vi) else i
        else:
            j = best[1]
        out[i] = polar[j]
    edges = np.where(np.diff(occ.astype(int)) != 0)[0]
    for edge in edges:
        for b in range(1, blend + 1):
            t = 0.5 * (1 + math.cos(math.pi * b / blend)) * 0.5
            lo, hi = (edge - b + 1) % n, (edge + b) % n
            out[lo] = out[lo] * (1 - t) + out[hi] * t
    return out


def fill_angles_interp(pol, occ):
    """Replace occluded angular rows by circular linear interpolation between
    the nearest valid rows (per column). Keeps the angular lowpass from
    smearing foreign (bridge/plate) content into a narrow window's lighting."""
    n = pol.shape[0]
    valid_idx = np.where(~occ)[0]
    if len(valid_idx) == 0 or len(valid_idx) == n:
        return pol.copy()
    ext = np.concatenate([valid_idx - n, valid_idx, valid_idx + n])
    out = pol.copy()
    occ_idx = np.where(occ)[0]
    pos = np.searchsorted(ext, occ_idx)
    lo = ext[np.clip(pos - 1, 0, len(ext) - 1)]
    hi = ext[np.clip(pos, 0, len(ext) - 1)]
    t = np.where(hi != lo, (occ_idx - lo) / np.maximum(hi - lo, 1), 0.0)
    out[occ_idx] = (pol[lo % n] * (1 - t)[:, None, None]
                    + pol[hi % n] * t[:, None, None])
    return out


def synth_polar(n_pol, part, k, rad_step=0.25):
    """Rebuild the delit polar content as a perfectly periodic pattern per
    radial zone, tiled from the part's cleanest angular sector. This is the
    render-cleanup pass: AI junk baked into wheel faces is replaced by the
    part's own best material, so every cog is rotationally exact and the
    motion carries no baked artifacts. Zone borders must sit on smooth
    circles (rim edges) so per-zone phase maps can't create radial seams."""
    n = n_pol.shape[0]
    out = n_pol.copy()
    a0_deg, a1_deg = part["purify"]["sector_deg"]
    src0 = a0_deg / 360 * n
    for zone in part["purify"]["zones"]:
        r0, r1 = zone["r"]
        c0 = int(r0 / rad_step)
        c1 = int(min(r1 / rad_step, n_pol.shape[1]))
        if c1 <= c0:
            continue
        pitch = zone["pitch"]
        if pitch == "teeth":
            p = n / k
        elif pitch == "spokes":
            p = n / part["spokes"]
        else:
            p = n * float(pitch) / 360.0
        assert (a1_deg - a0_deg) / 360 * n >= p - 1e-6, \
            f"purify sector shorter than pitch ({part['purify']}, zone {zone})"
        idx = np.arange(n, dtype=np.float64)
        phase = np.mod(idx - src0, p)
        cols = np.arange(c0, c1, dtype=np.float32)
        map_x = np.tile(cols, (n, 1))
        rows = (src0 + phase).astype(np.float32).reshape(-1, 1)
        map_y = np.tile(rows, (1, c1 - c0)) % n
        tile = cv2.remap(n_pol, map_x, map_y, cv2.INTER_LINEAR,
                         borderMode=cv2.BORDER_WRAP)
        # cosine cross-fade over the last 12% of the period so the tiling seam
        # (sector end -> sector start) is continuous
        w = 0.12 * p
        t = np.clip((phase - (p - w)) / w, 0, 1)
        t = (1 - np.cos(np.pi * t)) / 2
        map_y2 = (map_y - p) % n
        tile2 = cv2.remap(n_pol, map_x, map_y2, cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_WRAP)
        tile = tile * (1 - t[:, None, None]) + tile2 * t[:, None, None]
        out[:, c0:c1] = tile
    return out


def decontaminate_rgb(rgb, alpha, grow=3):
    # only strictly-zero-alpha pixels may be rewritten: any pixel that
    # composites (alpha > 0) must keep its exact original color so the
    # identity pairing n + c == crop holds through the runtime blend.
    a8 = (alpha > 0).astype(np.uint8)
    out = rgb.copy()
    for _ in range(grow):
        dil = cv2.dilate(out, np.ones((3, 3), np.uint8))
        m = cv2.dilate(a8, np.ones((3, 3), np.uint8)) - a8
        out[m > 0] = dil[m > 0]
        a8 = cv2.dilate(a8, np.ones((3, 3), np.uint8))
    return out


def window_occluded_angles(win_full, cx, cy, r_in, r_out, n=ANG_SAMPLES):
    """occ[i]=True where the ray band [r_in,r_out] never crosses the window."""
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    rs = np.linspace(max(r_in, 1), r_out, 32)
    occ = np.zeros(n, bool)
    for i, ang in enumerate(a):
        xs = np.clip((cx + rs * math.cos(ang)).astype(int), 0, IMG - 1)
        ys = np.clip((cy + rs * math.sin(ang)).astype(int), 0, IMG - 1)
        occ[i] = not (win_full[ys, xs] > 0.5).any()
    # grow by 2 deg so clone blends stay strictly under the window's feather
    g = int(n * 2.0 / 360)
    dead = occ.astype(np.uint8)
    dead = np.convolve(np.concatenate([dead, dead[:2 * g + 1]]),
                       np.ones(2 * g + 1), mode="same")[:n] > 0
    return dead


def measure_pitch_autocorr(img, cx, cy, tooth_r, valid, lo_k=40, hi_k=300):
    """Tooth count (possibly fractional) from the autocorrelation of the
    tooth-band edge profile over the largest contiguous valid angular run.
    Masked FFT harmonics mislock badly when only ~20% of the circle is
    visible; local autocorrelation of the visible run does not."""
    g = gray(img)
    sobel = np.hypot(cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3),
                     cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3))
    prof = angular_profile(sobel, cx, cy, tooth_r - 4, tooth_r + 2)
    n = len(prof)
    # largest circular run of valid angles
    v = np.concatenate([valid, valid])
    best_start, best_len, cur_start, cur_len = 0, 0, None, 0
    for i, ok in enumerate(v):
        if ok:
            if cur_start is None:
                cur_start = i
                cur_len = 0
            cur_len += 1
            if cur_len > best_len:
                best_start, best_len = cur_start, cur_len
        else:
            cur_start = None
    best_len = min(best_len, n)
    seg = np.array([prof[(best_start + i) % n] for i in range(best_len)])
    seg = seg - cv2.GaussianBlur(seg.reshape(-1, 1), (0, 0),
                                 n / lo_k).ravel()
    ac = np.correlate(seg, seg, "full")[len(seg) - 1:]
    lag_lo = max(2, int(n / hi_k))
    lag_hi = min(len(ac) - 2, int(n / lo_k))
    if lag_hi <= lag_lo:
        return None
    # prefer the FUNDAMENTAL: autocorrelation also peaks at period multiples.
    # Take the best peak, then divide its lag by 2..4 — if a sub-lag is also
    # a local peak with a solid score, the smallest such lag wins.
    seg_ac = ac[lag_lo:lag_hi + 1]
    lag = int(np.argmax(seg_ac)) + lag_lo
    for m in (4, 3, 2):
        sub = int(round(lag / m))
        if sub < max(lag_lo, 3):
            continue
        if ac[sub] >= ac[sub - 1] and ac[sub] >= ac[sub + 1] \
                and ac[sub] >= 0.5 * ac[lag]:
            lag = sub
            break
    y0, y1, y2 = ac[lag - 1], ac[lag], ac[lag + 1]
    denom = y0 - 2 * y1 + y2
    shift = 0.5 * (y0 - y2) / denom if abs(denom) > 1e-9 else 0.0
    return n / (lag + np.clip(shift, -1, 1))


def measure_tooth_k(img, cx, cy, tooth_r, valid):
    """Dominant angular harmonic of the tooth band over valid angles."""
    g = gray(img)
    sobel = np.hypot(cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3),
                     cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3))
    prof = angular_profile(sobel, cx, cy, tooth_r - 4, tooth_r + 2)
    p = prof.astype(np.float64).copy()
    if valid is not None and valid.any():
        p[~valid] = p[valid].mean()
    p -= p.mean()
    spec = np.abs(np.fft.rfft(p))
    k = int(np.argmax(spec[30:301]) + 30)
    return k


def build_part_sprite(img, name, part, reg, win_full, out_dir, qa_dir):
    cx, cy = reg["center"]
    if part["kind"] == "annulus":
        r_in, r_out = part["annulus"]
    else:
        r_in, r_out = 0.0, part["sprite_r"]

    pad = 6
    size = int(2 * (r_out + pad))
    size += size % 2  # even dims: sprite center == bitmap center
    bx = int(round(cx - size / 2))
    by = int(round(cy - size / 2))
    # padded crop: giant rings (bandC) extend off-frame; edge-replicate padding
    # is safe because the window (always in-frame) never shows those pixels.
    px0, py0 = max(0, -bx), max(0, -by)
    px1 = max(0, bx + size - IMG)
    py1 = max(0, by + size - IMG)
    crop = img[max(0, by):min(IMG, by + size), max(0, bx):min(IMG, bx + size)].copy()
    if px0 or py0 or px1 or py1:
        crop = np.pad(crop, ((py0, py1), (px0, px1), (0, 0)), mode="edge")
    lcx, lcy = cx - bx, cy - by

    if part.get("purify"):
        # binary alpha: the multiplicative shade layer is only exact where
        # alpha is 0 or 1, and the rim always lands in a dark groove whose
        # anti-aliasing is baked into the sprite RGB itself.
        ys_a, xs_a = np.mgrid[0:size, 0:size]
        d_a = np.hypot(xs_a + 0.5 - lcx, ys_a + 0.5 - lcy)
        alpha = ((d_a <= r_out) & (d_a >= r_in)).astype(np.float32)
    else:
        alpha = region_alpha((size, size), lcx, lcy, r_out, r_in)

    # ---- N/C split in polar space
    r_max = r_out + pad
    pol = to_polar(crop, lcx, lcy, r_max)
    lp = wrap_gaussian_lowpass(pol, 45.0)
    base_light = lp.min(axis=0, keepdims=True)
    excess = np.clip(lp - base_light, 0, None)

    win_crop = win_full[max(0, by):min(IMG, by + size), max(0, bx):min(IMG, bx + size)]
    if px0 or py0 or px1 or py1:
        win_crop = np.pad(win_crop, ((py0, py1), (px0, px1)), mode="constant")
    exc_cart = np.nan_to_num(from_polar(excess, lcx, lcy, r_max, (size, size)))
    n_pol = np.clip(pol - excess, 0, 255)

    occ = window_occluded_angles(win_full, cx, cy, max(r_in, 1), r_out)
    valid = ~occ
    k = part.get("k") or reg.get("k") or \
        measure_pitch_autocorr(img, cx, cy, part.get("tooth_r", r_out - 4), valid) or \
        measure_tooth_k(img, cx, cy, part.get("tooth_r", r_out - 4), valid)
    print(f"  {name}: tooth pitch k={k:.1f}" if isinstance(k, float)
          else f"  {name}: tooth pitch k={k}")

    if part.get("purify"):
        # render-cleanup path. Three-layer decomposition:
        #   rotating N   = per-radius base level + tiled periodic texture
        #                  (rotation-uniform: carries no lighting, no shadows)
        #   static shade = alpha-black layer re-imposing the render's cast
        #                  shadows/AO exactly where they were (bridges keep
        #                  their contact shadows; nothing dark ever rotates)
        #   static spec  = plus-lighter layer for everything brighter than N
        # look = original slow lighting field + purified periodic texture.
        # multiplicative separation: texture contrast scales with lighting, so
        # T = pol/lp tiles cleanly across shadow gradients (additive T washes
        # out dark zones). The lighting field is computed from window-valid
        # angles only (occluded sectors filled by circular interpolation), so
        # bright bridge content can never smear into a narrow window's
        # lighting. mode "relight" skips tiling: original texture, but
        # lighting/shadows still move to the static layers (used for the
        # balance, whose slightly out-of-round rims alias under tiling).
        pol_own = fill_angles_interp(pol, occ)
        lp_own = wrap_gaussian_lowpass(pol_own, 45.0)
        lp_safe = np.maximum(lp_own, 8.0)
        # SCALAR (luminance) texture ratio: per-channel ratios amplify the
        # chroma noise of dark pixels into saturated streaks once multiplied
        # by the bright base. Color comes from the smooth lighting fields.
        luma = (pol * np.float32([0.299, 0.587, 0.114])).sum(-1, keepdims=True)
        luma_lp = (lp_safe * np.float32([0.299, 0.587, 0.114])).sum(-1, keepdims=True)
        t_ratio = np.repeat(np.clip(luma / np.maximum(luma_lp, 8.0), 0.0, 3.0),
                            3, axis=-1)
        if part["purify"].get("mode") == "relight":
            # original texture in visible sectors; occluded sectors take the
            # clean tiled pattern so no mush ever rotates into view
            tiled = synth_polar(t_ratio, part, k)
            g = int(ANG_SAMPLES * 2.0 / 360)
            occf = np.convolve(np.concatenate([occ.astype(float), occ[:2 * g + 1].astype(float)]),
                               np.ones(2 * g + 1) / (2 * g + 1), mode="same")[:ANG_SAMPLES]
            occf = np.clip(occf, 0, 1)[:, None, None]
            t_syn = t_ratio * (1 - occf) + tiled * occf
        else:
            t_syn = synth_polar(t_ratio, part, k)
        # per-radius NEAR-MAX base: the shade ratio s = lp/base then cancels
        # texture entirely, so the static layers stay smooth and cast no
        # rest-pose ghosts over the rotating metal (p85 left structured
        # residue in the specular sectors -> colored streaks in motion)
        vi = np.where(valid)[0]
        base_level = np.percentile(lp_own[vi], 98, axis=0, keepdims=True) \
            if len(vi) else np.percentile(lp_own, 98, axis=0, keepdims=True)
        n_bright_pol = np.clip(base_level * t_syn, 0, 255)
        look_pol = np.clip(lp_safe * t_syn, 0, 255)

        region_full = alpha.copy()  # full disc: the floor blend must cover
        # the whole window even where the sprite alpha is cut to metal
        if part.get("openwork"):
            # TRUE TRANSPARENT GAPS: segment metal vs gap on the periodic
            # scalar tile (per-radius threshold), cut the sprite alpha to the
            # metal silhouette, and replace the floor's gap content with a
            # rotation-invariant per-radius background ring (angular median
            # of the gap pixels) so nothing baked ever rotates through the
            # openwork and nothing overlaps.
            Ts = t_syn[..., 0]
            p15 = np.percentile(Ts, 15, axis=0)
            p85v = np.percentile(Ts, 85, axis=0)
            contrast = p85v - p15
            thr = (p15 + p85v) / 2
            M_pol = Ts > thr[None, :]
            solid = contrast < 0.3
            med = np.median(Ts, axis=0)
            M_pol[:, solid] = (med[solid] > 0.75)[None, :]
            gap_vals = np.where(M_pol, np.nan, Ts)
            with np.errstate(all="ignore"):
                bg_ring = np.nanmedian(gap_vals, axis=0)
            cols = np.arange(len(bg_ring))
            ok = ~np.isnan(bg_ring)
            if ok.any():
                bg_ring = np.interp(cols, cols[ok], bg_ring[ok])
            else:
                bg_ring = np.full(len(cols), float(np.median(Ts)))
            # the AI wheel's solid face is not a believable backdrop; clamp
            # to a shadowed-recess level so openwork reveals dark plate
            bg_ring = np.minimum(bg_ring, part.get("bg_t_max", 0.45))
            M3 = M_pol[..., None].astype(np.float32)
            bg3 = bg_ring[None, :, None].astype(np.float32)
            look_pol = np.clip(lp_safe * (t_syn * M3 + bg3 * (1 - M3)), 0, 255)
            bg_pol = np.clip(lp_safe * bg3 * np.ones_like(t_syn), 0, 255)
            bg_cart = np.clip(np.nan_to_num(
                from_polar(bg_pol, lcx, lcy, r_max, (size, size))), 0, 255)
            m_cart = np.nan_to_num(from_polar(
                np.repeat(M_pol[..., None].astype(np.float32), 3, axis=-1),
                lcx, lcy, r_max, (size, size)))[..., 0]
            alpha = alpha * (m_cart > 0.5)
        else:
            bg_cart = None

        # clamp after inverse polar: INTER_CUBIC overshoots at sharp tooth
        # edges, and any value beyond u8 range breaks the additive pairing
        n_synth_cart = np.clip(np.nan_to_num(
            from_polar(n_bright_pol, lcx, lcy, r_max, (size, size))), 0, 255)
        look_cart = np.clip(np.nan_to_num(
            from_polar(look_pol, lcx, lcy, r_max, (size, size))), 0, 255)
        wa = (win_crop * region_full)[..., None]
        target_f = crop * (1 - wa) + look_cart * wa
        n_u8 = np.clip(np.round(n_synth_cart), 0, 255).astype(np.uint8)
        a_f = n_u8.astype(np.float32)
        s_eff = np.clip(target_f / np.maximum(a_f, 1.0), 0, 1)
        shade_u8 = np.clip(np.round((1 - s_eff.min(axis=-1)) * 255), 0, 255) \
            .astype(np.uint8)
        b_f = a_f * (1 - shade_u8[..., None].astype(np.float32) / 255)
        c_u8 = np.clip(np.round(target_f - b_f), 0, 255).astype(np.uint8)
        floor_patch = np.clip(np.round(b_f + c_u8), 0, 255).astype(np.uint8)
        floor_wa = wa[..., 0].astype(np.float32)
        target = floor_patch.astype(np.float32)
    else:
        # exact path: original pixels inside the window, pitch-cloned content
        # strictly outside it
        pitches = [ANG_SAMPLES / k]
        if part.get("spokes"):
            pitches.append(ANG_SAMPLES / part["spokes"])
        n_pol_filled = fill_occluded_polar(n_pol, occ, pitches)
        exc_filled = fill_occluded_polar(excess, occ, pitches)
        n_img = np.nan_to_num(from_polar(n_pol_filled, lcx, lcy, r_max, (size, size)))
        exc_img = np.nan_to_num(from_polar(exc_filled, lcx, lcy, r_max, (size, size)))
        occ_map = np.clip(1.0 - win_crop, 0, 1)[..., None]
        n_exact = crop - exc_cart
        n_final = n_exact * (1 - occ_map) + n_img * occ_map
        n_u8 = np.minimum(np.clip(np.round(n_final), 0, 255), crop).astype(np.uint8)
        c_u8 = (crop.astype(np.int16) - n_u8.astype(np.int16)).astype(np.uint8)
        floor_patch = crop.astype(np.uint8)
        floor_wa = np.zeros(crop.shape[:2], np.float32)
        target = crop
        shade_u8 = None
        bg_cart = None

    n_rgb = decontaminate_rgb(n_u8, alpha)
    a_u8 = np.clip(np.round(alpha * 255), 0, 255).astype(np.uint8)
    n_rgba = np.dstack([n_rgb, a_u8])
    c_rgba = np.dstack([c_u8, a_u8])

    # ---- runtime window mask (crop of the full-frame window)
    w_u8 = np.clip(np.round(win_crop * 255), 0, 255).astype(np.uint8)
    mask_rgba = np.dstack([np.full((size, size, 3), 255, np.uint8), w_u8])

    out_dir.mkdir(parents=True, exist_ok=True)
    Image.fromarray(n_rgba).save(out_dir / f"{name}.webp", lossless=True, quality=100)
    Image.fromarray(c_rgba).save(out_dir / f"{name}-spec.webp", lossless=True, quality=100)
    Image.fromarray(mask_rgba).save(out_dir / f"{name}-window.png")
    if shade_u8 is not None:
        sh_a = np.clip(np.round(shade_u8.astype(np.float32) * alpha), 0, 255) \
            .astype(np.uint8)
        sh_rgba = np.dstack([np.zeros((size, size, 3), np.uint8), sh_a])
        Image.fromarray(sh_rgba).save(out_dir / f"{name}-shade.webp",
                                      lossless=True, quality=100)
    if bg_cart is not None:
        bg_a = np.clip(np.round(win_crop * region_full * 255), 0, 255) \
            .astype(np.uint8)
        bg_rgba = np.dstack([np.clip(np.round(bg_cart), 0, 255).astype(np.uint8),
                             bg_a])
        Image.fromarray(bg_rgba).save(out_dir / f"{name}-bg.webp",
                                      lossless=True, quality=100)

    # ---- per-part identity gate (numpy replay at 0 deg, vs the patched floor)
    af = a_u8.astype(np.float32) / 255
    base = target.astype(np.float32)
    comp = base
    if bg_cart is not None:
        abg = (np.clip(np.round(win_crop * region_full * 255), 0, 255) / 255)[..., None]
        comp = comp * (1 - abg) + np.round(bg_cart) * abg
    comp = comp * (1 - af[..., None]) + n_rgb.astype(np.float32) * af[..., None]
    if shade_u8 is not None:
        shf = (shade_u8.astype(np.float32) / 255 * af)[..., None]
        comp = comp * (1 - shf)
    comp = comp + c_u8.astype(np.float32) * af[..., None]
    wf = w_u8.astype(np.float32) / 255
    comp = base * (1 - wf[..., None]) + comp * wf[..., None]
    diff = np.abs(comp - base)
    core = (af > 0.995) & (wf > 0.995)
    ring = (af > 0.005) & (wf > 0.005) & ~core
    gate = {
        "core_max": float(diff[core].max()) if core.any() else 0.0,
        "core_over2_px": int((diff[core].max(axis=-1) >= 2).sum()) if core.any() else 0,
        "ring_p99": float(np.percentile(diff[ring].max(axis=-1), 99)) if ring.any() else 0.0,
    }
    if gate["core_over2_px"]:
        bad = np.where(core & (diff.max(axis=-1) >= 2))
        pts = [(int(bx + x), int(by + y)) for y, x in zip(*bad[:2])][:12]
        print(f"  {name} gate debug: first offenders (master px): {pts}")

    # ---- QA collage: original | patched | N | composites at 0/15/45/180 deg
    qa_dir.mkdir(parents=True, exist_ok=True)
    tiles = [crop.astype(np.uint8),
             floor_patch,
             n_rgba[..., :3],
             np.clip(c_u8.astype(np.float32) * 4, 0, 255).astype(np.uint8)]
    for deg in (0, 15, 45, 180):
        M = cv2.getRotationMatrix2D((lcx, lcy), -deg, 1.0)
        n_rot = cv2.warpAffine(n_rgba, M, (size, size), flags=cv2.INTER_LINEAR)
        arf = n_rot[..., 3:].astype(np.float32) / 255
        fr = base.copy()
        if bg_cart is not None:
            abg = (win_crop * region_full)[..., None]
            fr = fr * (1 - abg) + bg_cart * abg
        fr = fr * (1 - arf) + n_rot[..., :3].astype(np.float32) * arf
        if shade_u8 is not None:
            fr = fr * (1 - (shade_u8.astype(np.float32) / 255
                            * a_u8.astype(np.float32) / 255)[..., None])
        fr = fr + c_rgba[..., :3].astype(np.float32) * (c_rgba[..., 3:].astype(np.float32) / 255)
        fr = base * (1 - wf[..., None]) + fr * wf[..., None]
        tiles.append(np.clip(fr, 0, 255).astype(np.uint8))
    h = max(t.shape[0] for t in tiles)
    tiles = [np.pad(t, ((0, h - t.shape[0]), (0, 0), (0, 0))) for t in tiles]
    grid = np.concatenate(tiles, axis=1)
    Image.fromarray(grid).save(qa_dir / f"{name}-collage.png")

    return {
        "floor_patch": floor_patch,
        "floor_wa": floor_wa,
        "name": name,
        "center": [round(cx, 2), round(cy, 2)],
        "box_px": [bx, by, size, size],
        "r_in": r_in, "r_out": round(r_out, 2),
        "origin_pct": [round((cx - bx) / size * 100, 3),
                       round((cy - by) / size * 100, 3)],
        "files": {"sprite": f"{name}.webp", "spec": f"{name}-spec.webp",
                  "window": f"{name}-window.png",
                  **({"shade": f"{name}-shade.webp"} if shade_u8 is not None else {}),
                  **({"bg": f"{name}-bg.webp"} if bg_cart is not None else {})},
        "anim": part["anim"],
        "gate": gate,
    }


# ---------------------------------------------------------------- bridges

def build_bridge_sprites(img, cfg, bridgemask, out_dir):
    """Static top-layer sprites: combined bridges (flood mask) + configured polys."""
    entries = []
    dil = cfg["bridge_flood"]["sprite_dilate_px"]
    bm = cv2.dilate(bridgemask, np.ones((2 * dil + 1,) * 2, np.uint8))
    bm = cv2.GaussianBlur(bm, (0, 0), 1.2)
    masks = {"bridges": bm.astype(np.float32) / 255}
    for pname, p in cfg["polys"].items():
        if p.get("sprite"):
            masks[pname] = poly_mask(p["polygon"], dilate=2, feather=p.get("feather_px", 1.3))
    for name, m in masks.items():
        ys, xs = np.where(m > 0.004)
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        y0, y1 = int(ys.min()), int(ys.max()) + 1
        # clamp to frame, pad 2
        x0 = max(0, x0 - 2); y0 = max(0, y0 - 2)
        x1 = min(IMG, x1 + 2); y1 = min(IMG, y1 + 2)
        crop = img[y0:y1, x0:x1].astype(np.uint8)
        a = np.clip(np.round(m[y0:y1, x0:x1] * 255), 0, 255).astype(np.uint8)
        rgb = decontaminate_rgb(crop, m[y0:y1, x0:x1])
        rgba = np.dstack([rgb, a])
        out_dir.mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgba).save(out_dir / f"static-{name}.webp",
                                   lossless=True, quality=100)
        entries.append({"name": name, "box_px": [x0, y0, x1 - x0, y1 - y0],
                        "file": f"static-{name}.webp"})
    return entries


# ---------------------------------------------------------------- full gate

def full_identity_gate(floor, parts_out, bridges_out, out_dir):
    """Replay the whole runtime stack at rest and diff against the floor."""
    comp = floor.copy()
    for p in parts_out:
        bx, by, w, h = p["box_px"]
        spr = np.array(Image.open(out_dir / p["files"]["sprite"])).astype(np.float32)
        spc = np.array(Image.open(out_dir / p["files"]["spec"])).astype(np.float32)
        win = np.array(Image.open(out_dir / p["files"]["window"])).astype(np.float32)
        # clip to frame (giant rings have off-frame boxes)
        sx0, sy0 = max(0, -bx), max(0, -by)
        dx0, dy0 = max(0, bx), max(0, by)
        cw = min(bx + w, IMG) - dx0
        ch = min(by + h, IMG) - dy0
        spr = spr[sy0:sy0 + ch, sx0:sx0 + cw]
        spc = spc[sy0:sy0 + ch, sx0:sx0 + cw]
        win = win[sy0:sy0 + ch, sx0:sx0 + cw]
        af = spr[..., 3:] / 255
        layer = comp[dy0:dy0 + ch, dx0:dx0 + cw]
        if "bg" in p["files"]:
            bg = np.array(Image.open(out_dir / p["files"]["bg"])).astype(np.float32)
            bg = bg[sy0:sy0 + ch, sx0:sx0 + cw]
            layer = layer * (1 - bg[..., 3:] / 255) + bg[..., :3] * (bg[..., 3:] / 255)
        layer = layer * (1 - af) + spr[..., :3] * af
        if "shade" in p["files"]:
            shd = np.array(Image.open(out_dir / p["files"]["shade"])).astype(np.float32)
            shd = shd[sy0:sy0 + ch, sx0:sx0 + cw]
            layer = layer * (1 - shd[..., 3:] / 255)
        layer = layer + spc[..., :3] * (spc[..., 3:] / 255)
        wf = win[..., 3:] / 255
        comp[dy0:dy0 + ch, dx0:dx0 + cw] = \
            comp[dy0:dy0 + ch, dx0:dx0 + cw] * (1 - wf) + layer * wf
    for b in bridges_out:
        bx, by, w, h = b["box_px"]
        spr = np.array(Image.open(out_dir / b["file"])).astype(np.float32)
        af = spr[..., 3:] / 255
        comp[by:by + h, bx:bx + w] = comp[by:by + h, bx:bx + w] * (1 - af) + spr[..., :3] * af
    diff = np.abs(comp - floor).max(axis=-1)
    gate = {"max": float(diff.max()), "over2_px": int((diff >= 2).sum()),
            "over1_px": int((diff >= 1).sum())}
    vis = np.clip(diff * 64, 0, 255).astype(np.uint8)
    Image.fromarray(vis).save(QA / "identity-diff.png")
    return gate


# ---------------------------------------------------------------- main

def main():
    args = sys.argv[1:]
    cmd = args[0] if args else "all"
    report_only = "--report-only" in args
    img, cfg = load_master()

    reg = stage_register(img, cfg)
    for name, r in reg.items():
        part = cfg["parts"][name]
        if part.get("refine") and r["e_est_px"] > 0.75:
            print(f"GATE FAIL: {name} wobble e_est={r['e_est_px']}px > 0.75")
            if not report_only:
                sys.exit(1)
    print("registration gates passed")
    if cmd == "register":
        return

    bridgemask = stage_bridgemask(img, cfg)

    parts_out = []
    floor = img.copy()
    # windows must be mutually exclusive (each purifies its own content, and
    # the floor can only satisfy one part per pixel): later parts yield to
    # earlier ones with a 2px margin, which always lands in a dark groove.
    win_union = np.zeros((IMG, IMG), np.float32)
    for name, part in cfg["parts"].items():
        win = window_mask(part, name, reg, cfg, bridgemask)
        claimed = cv2.dilate((win_union > 0.004).astype(np.uint8) * 255,
                             np.ones((5, 5), np.uint8))
        claimed = cv2.GaussianBlur(claimed, (0, 0), 1.0).astype(np.float32) / 255
        win = win * (1 - claimed)
        win_union = np.maximum(win_union, win)
        if win.max() < 0.5:
            sys.exit(f"GATE FAIL: {name} window is empty")
        Image.fromarray((win * 255).astype(np.uint8)).save(QA / f"win-{name}.png")
        info = build_part_sprite(img, name, part, reg[name], win, OUT, QA)
        patch = info.pop("floor_patch").astype(np.float32)
        wa = info.pop("floor_wa")[..., None]
        bx, by, w, h = info["box_px"]
        sx0, sy0 = max(0, -bx), max(0, -by)
        dx0, dy0 = max(0, bx), max(0, by)
        cw = min(bx + w, IMG) - dx0
        ch = min(by + h, IMG) - dy0
        # the patch already carries the window blend against the original;
        # replace (don't re-blend) wherever this part's window touches
        pw = patch[sy0:sy0 + ch, sx0:sx0 + cw]
        ww = wa[sy0:sy0 + ch, sx0:sx0 + cw]
        dst = floor[dy0:dy0 + ch, dx0:dx0 + cw]
        floor[dy0:dy0 + ch, dx0:dx0 + cw] = np.where(ww > 0.004, pw, dst)
        g = info["gate"]
        print(f"{name}: identity core_max={g['core_max']:.1f} "
              f"core_over2={g['core_over2_px']} ring_p99={g['ring_p99']:.1f}")
        if g["core_over2_px"] > 0 or g["ring_p99"] > 24:
            print(f"GATE FAIL: {name} identity")
            if not report_only:
                sys.exit(1)
        parts_out.append(info)

    # statics are cut from the CLEANED floor: their own pixels are untouched by
    # purify, but their feathered alpha tails overlap purified windows and must
    # blend against the same content they sit on.
    bridges_out = build_bridge_sprites(floor, cfg, bridgemask, OUT)

    gate = full_identity_gate(floor, parts_out, bridges_out, OUT)
    print(f"full-stack identity: max={gate['max']:.1f} over1={gate['over1_px']} "
          f"over2={gate['over2_px']}")
    if gate["over2_px"] > 0:
        print("GATE FAIL: full-stack identity")
        if not report_only:
            sys.exit(1)

    # lossless floor: the (purify-patched) master the rig composites against.
    floor_path = ROOT / "public/assets/caseback/l9511-simplified-lossless.webp"
    Image.fromarray(np.clip(np.round(floor), 0, 255).astype(np.uint8)) \
        .save(floor_path, lossless=True, quality=100)
    Image.fromarray(np.clip(np.round(floor), 0, 255).astype(np.uint8)) \
        .save(QA / "floor-cleaned.png")
    print(f"floor emitted: {floor_path.name} ({floor_path.stat().st_size / 1024:.0f} KB)")

    rig = {
        "version": 3,
        "image": {"w": IMG, "h": IMG, "master_sha256": cfg["master_sha256"]},
        "parts": parts_out,
        "bridges": bridges_out,
        "beat_hz": 2.5,
    }
    (OUT / "rig.json").write_text(json.dumps(rig, indent=2))
    total = sum(f.stat().st_size for f in OUT.iterdir())
    print(f"rig emitted: {len(parts_out)} moving parts, {len(bridges_out)} statics, "
          f"{total / 1024:.0f} KB total")
    if total > 4 * 1024 * 1024:
        sys.exit("GATE FAIL: budget")
    print("ALL GATES PASSED")


if __name__ == "__main__":
    main()
