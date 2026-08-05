#!/usr/bin/env python3
"""Caseback living-rig pipeline.

Decomposes the rendered calibre (tools/assets-src/caseback-master.png, 1254x1254)
into a layered animation rig: inpainted base + complete transparent sprites +
static occluder masks, emitted to public/assets/caseback/rig/.

Every stage is gated; the identity gate at the end must pass or the build fails.
See tools/caseback-overrides.json for seeds, occluder polygons, master sha256.

Usage:
  python3 tools/build-caseback-rig.py all [--report-only]
  python3 tools/build-caseback-rig.py register        # registration + report only
  python3 tools/build-caseback-rig.py verify          # gates against existing rig/
"""
import cv2
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "tools/assets-src/caseback-master.png"
OVERRIDES = ROOT / "tools/caseback-overrides.json"
OUT = ROOT / "public/assets/caseback/rig"
QA = ROOT / "tools/qa/caseback"
IMG = 1254

ANG_SAMPLES = 2880  # angular resolution for polar analysis (0.125 deg)


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
    """Bilinear samples of a scalar field along a circle."""
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    xs = (cx + r * np.cos(a)).astype(np.float32)
    ys = (cy + r * np.sin(a)).astype(np.float32)
    return cv2.remap(field, xs.reshape(1, -1), ys.reshape(1, -1),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)[0]


def angular_profile(field, cx, cy, r0, r1, n=ANG_SAMPLES):
    """Mean of field over radius band [r0,r1], per angle. Returns (n,) array."""
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
    """|FFT_k| of an angular profile; `valid` bool mask excludes occluded angles
    (masked samples are replaced by the profile mean to avoid spectral leakage)."""
    p = profile.astype(np.float64).copy()
    if valid is not None:
        m = p[valid].mean() if valid.any() else p.mean()
        p[~valid] = m
    p = p - p.mean()
    return np.abs(np.fft.rfft(p)[k])


# ---------------------------------------------------------------- registration

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


def refine_center(sobel, seed, rband, kband, valid_angles=None, report=None):
    """Two-phase center fit. Returns (cx, cy, r_peak, k, diagnostics)."""
    sx, sy = seed
    # ---- coarse: ring Sobel energy over center grid x radius band
    best = (-1.0, sx, sy, (rband[0] + rband[1]) / 2)
    for dy in np.arange(-8, 8.01, 0.5):
        for dx in np.arange(-8, 8.01, 0.5):
            cx, cy = sx + dx, sy + dy
            for r in np.arange(rband[0], rband[1] + 0.01, 1.0):
                e = float(sample_ring(sobel, cx, cy, r).mean())
                if e > best[0]:
                    best = (e, cx, cy, r)
    _, cx, cy, r_peak = best

    # ---- harmonic k at the coarse fit, from a band around the peak radius
    k, _ = detect_harmonic_k(sobel, cx, cy, r_peak - 3, r_peak + 3, kband, valid_angles)

    # ---- fine: maximize |FFT_k| over sub-pixel center grid
    best_f = (-1.0, cx, cy, r_peak)
    for dy in np.arange(-1.2, 1.201, 0.1):
        for dx in np.arange(-1.2, 1.201, 0.1):
            fx, fy = cx + dx, cy + dy
            prof = angular_profile(sobel, fx, fy, r_peak - 3, r_peak + 3, n=ANG_SAMPLES)
            mag = harmonic_mag(prof, k, valid_angles)
            if mag > best_f[0]:
                best_f = (mag, fx, fy, r_peak)
    _, fx, fy, _ = best_f

    # ---- eccentricity fit from the subpixel rim edge: r(theta) = R + ex cos + ey sin.
    # The k=1 term IS the center error; correct it. Residual k=2 = out-of-round
    # (uncorrectable by any center choice — gates spin eligibility).
    fx, fy, ecc = fit_rim_eccentricity(sobel, fx, fy, r_peak, valid_angles)

    diag = {
        "seed": [sx, sy], "coarse": [cx, cy], "fine": [round(fx, 2), round(fy, 2)],
        "r_peak": float(r_peak), "k": int(k),
        "e_est_px": ecc["residual_k1_px"],
        "ovality_k2_px": ecc["k2_px"],
        "rim_R": ecc["R"],
        "correction_px": ecc["correction_px"],
    }
    if report is not None:
        report.append(diag)
    return fx, fy, r_peak, k, diag


def edge_radius_profile(sobel, cx, cy, r_peak, valid, half_span=6.0, step=0.1):
    """Subpixel radial position of the strongest edge near r_peak, per angle.
    Returns (r_theta, ok_mask) over ANG_SAMPLES angles."""
    n = ANG_SAMPLES
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    rs = np.arange(r_peak - half_span, r_peak + half_span + 1e-6, step)
    # sample matrix: rows = radius, cols = angle
    xs = (cx + np.outer(rs, np.cos(a))).astype(np.float32)
    ys = (cy + np.outer(rs, np.sin(a))).astype(np.float32)
    m = cv2.remap(sobel, xs, ys, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    idx = np.argmax(m, axis=0)
    # parabolic sub-sample refinement
    idx_c = np.clip(idx, 1, len(rs) - 2)
    y0 = m[idx_c - 1, np.arange(n)]
    y1 = m[idx_c, np.arange(n)]
    y2 = m[idx_c + 1, np.arange(n)]
    denom = (y0 - 2 * y1 + y2)
    with np.errstate(divide="ignore", invalid="ignore"):
        shift = np.where(np.abs(denom) > 1e-9, 0.5 * (y0 - y2) / denom, 0.0)
    r_theta = rs[idx_c] + np.clip(shift, -1, 1) * step
    ok = valid.copy() if valid is not None else np.ones(n, bool)
    # drop angles where the edge response is weak (occluder boundaries etc.)
    ok &= y1 > np.percentile(m.max(axis=0), 20)
    return r_theta, ok


def fit_rim_eccentricity(sobel, cx, cy, r_peak, valid, rounds=2):
    """Iteratively correct the center using the k=1 Fourier term of the rim edge."""
    total_dx = total_dy = 0.0
    R = r_peak
    for _ in range(rounds):
        r_theta, ok = edge_radius_profile(sobel, cx, cy, r_peak, valid)
        a = np.linspace(0, 2 * math.pi, ANG_SAMPLES, endpoint=False)[ok]
        r = r_theta[ok]
        # LSQ: r ~ R + ex cos a + ey sin a
        A = np.column_stack([np.ones_like(a), np.cos(a), np.sin(a)])
        (R, ex, ey), *_ = np.linalg.lstsq(A, r, rcond=None)
        cx, cy = cx + ex, cy + ey
        total_dx += ex
        total_dy += ey
    # residual k=1 and k=2 after correction
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
    """Bool mask over ANG_SAMPLES angles: True where the tooth harmonic is alive
    (i.e. NOT occluded). Demodulation: |boxcar(profile * e^{-ik theta})|."""
    prof = angular_profile(sobel, cx, cy, r_peak - 3, r_peak + 3)
    p = prof - prof.mean()
    theta = np.linspace(0, 2 * math.pi, ANG_SAMPLES, endpoint=False)
    z = p * np.exp(-1j * k * theta)
    w = int(ANG_SAMPLES * 15 / 360)
    kern = np.ones(w) / w
    env = np.abs(np.convolve(np.concatenate([z, z[:w]]), kern, mode="same")[:ANG_SAMPLES])
    thresh = 0.35 * np.median(env)
    alive = env >= thresh
    # grow occluded spans by grow_deg
    g = int(ANG_SAMPLES * grow_deg / 360)
    dead = (~alive).astype(np.uint8)
    dead = np.convolve(np.concatenate([dead, dead[:2 * g + 1]]),
                       np.ones(2 * g + 1), mode="same")[:ANG_SAMPLES] > 0
    return ~dead, env


def stage_register(img, cfg):
    sobel_x = cv2.Sobel(gray(img), cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray(img), cv2.CV_32F, 0, 1, ksize=3)
    sobel = np.hypot(sobel_x, sobel_y)
    results = {}
    report_lines = []
    for name, part in cfg["parts"].items():
        seed = part["seed_center"]
        # first pass without validity mask to get k + occlusion; then refit with it
        fx, fy, r_peak, k, _ = refine_center(sobel, seed, part["radius_band"],
                                             part["harmonic_band"])
        valid, env = occluded_angles(sobel, fx, fy, r_peak, k)
        fx, fy, r_peak, k, diag = refine_center(sobel, (fx, fy), part["radius_band"],
                                                part["harmonic_band"], valid)
        valid, env = occluded_angles(sobel, fx, fy, r_peak, k)
        occl_frac = float((~valid).mean())
        results[name] = {
            "center": [round(fx, 2), round(fy, 2)], "r_peak": float(r_peak),
            "k": int(k), "e_est_px": diag["e_est_px"],
            "ovality_px": diag["ovality_k2_px"], "rim_R": diag["rim_R"],
            "occluded_frac": round(occl_frac, 3),
            "valid_angles": valid,
        }
        report_lines.append(
            f"{name}: center=({fx:.2f},{fy:.2f}) rimR={diag['rim_R']} k={k} "
            f"corr={diag['correction_px']}px e_res={diag['e_est_px']:.3f}px "
            f"ovality(k2)={diag['ovality_k2_px']:.3f}px occluded={occl_frac*100:.1f}%")
    QA.mkdir(parents=True, exist_ok=True)
    (QA / "registration-report.txt").write_text("\n".join(report_lines) + "\n")
    print("\n".join(report_lines))
    return results


# ---------------------------------------------------------------- sprites

def region_alpha(shape_hw, cx, cy, r_out, r_in=0.0, feather=1.25, supersample=2):
    """Anti-aliased disc/annulus alpha in [0,1], via supersampled distance field."""
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
    """Angular low-pass with wraparound. polar: (n_ang, n_rad[, ch])."""
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
    p = cv2.warpPolar(img, (n_rad, n_ang), (cx, cy), r_max, flags)
    return p  # rows = angle, cols = radius


def polygon_occluded_angles(poly, cx, cy, r_in, r_out, n=ANG_SAMPLES):
    """Angles whose ray segment [r_in, r_out] intersects the polygon."""
    mask = np.zeros((IMG, IMG), np.uint8)
    cv2.fillPoly(mask, [np.array(poly, np.int32)], 255)
    occ = np.zeros(n, bool)
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    rs = np.linspace(max(r_in, 1), r_out, 24)
    for i, ang in enumerate(a):
        xs = np.clip((cx + rs * math.cos(ang)).astype(int), 0, IMG - 1)
        ys = np.clip((cy + rs * math.sin(ang)).astype(int), 0, IMG - 1)
        occ[i] = mask[ys, xs].any()
    return occ


def fill_occluded_polar(polar, occ, pitches_cols, blend_deg=2.0):
    """Fill occluded angular columns of a polar image (n_ang, n_rad, ch) row-block
    at a time using the given candidate pitches (in columns); cosine seam blends."""
    n = polar.shape[0]
    out = polar.copy()
    occ_idx = np.where(occ)[0]
    if len(occ_idx) == 0:
        return out
    valid = ~occ
    blend = int(n * blend_deg / 360)
    for i in occ_idx:
        # choose nearest valid source among +-k*pitch for each candidate pitch
        best = None
        for pitch in pitches_cols:
            for k in range(1, 12):
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
            j = occ_idx[0] - 1  # fallback: nearest valid edge
            j = j % n
        else:
            j = best[1]
        out[i] = polar[j]
    # cosine cross-fade at occlusion boundaries (seam softening)
    edges = np.where(np.diff(occ.astype(int)) != 0)[0]
    for edge in edges:
        for b in range(1, blend + 1):
            t = 0.5 * (1 + math.cos(math.pi * b / blend)) * 0.5
            i0, i1 = edge % n, (edge + 1) % n
            lo, hi = (edge - b + 1) % n, (edge + b) % n
            out[lo] = out[lo] * (1 - t) + out[hi] * t
    return out


def from_polar(polar, cx, cy, r_max, shape_hw):
    flags = cv2.INTER_CUBIC | cv2.WARP_POLAR_LINEAR | cv2.WARP_INVERSE_MAP
    return cv2.warpPolar(polar, (shape_hw[1], shape_hw[0]), (cx, cy), r_max, flags)


def decontaminate_rgb(rgb, alpha, grow=3):
    """Dilate RGB into alpha<=0 zones so bilinear edge sampling never mixes black."""
    a8 = (alpha > 0.02).astype(np.uint8)
    out = rgb.copy()
    for _ in range(grow):
        dil = cv2.dilate(out, np.ones((3, 3), np.uint8))
        m = cv2.dilate(a8, np.ones((3, 3), np.uint8)) - a8
        out[m > 0] = dil[m > 0]
        a8 = cv2.dilate(a8, np.ones((3, 3), np.uint8))
    return out


def build_part_sprite(img, name, part_cfg, reg, out_dir, qa_dir):
    """Build N (moving) + C (static specular) + occluder mask for one part.
    Sprite region: opaque disc (gear) or annulus (balance) of ORIGINAL pixels,
    split so low-frequency angular lighting stays in the static C layer."""
    cx, cy = reg["center"]
    if "annulus" in part_cfg:
        r_in, r_out = part_cfg["annulus"]
    else:
        r_in, r_out = 0.0, reg["rim_R"] + 2.5

    pad = 6
    size = int(2 * (r_out + pad))
    bx = int(round(cx - size / 2))
    by = int(round(cy - size / 2))
    crop = img[by:by + size, bx:bx + size].copy()
    lcx, lcy = cx - bx, cy - by

    # --- region alpha
    alpha = region_alpha((size, size), lcx, lcy, r_out, r_in)

    # --- N/C split in polar space (per channel)
    r_max = r_out + pad
    pol = to_polar(crop, lcx, lcy, r_max)
    # sigma must kill k=5 spoke structure (else C ghosts): 45deg -> x0.0005 at k=5
    lp = wrap_gaussian_lowpass(pol, 45.0)
    base_light = lp.min(axis=0, keepdims=True)          # darkest low-freq per radius
    excess = np.clip(lp - base_light, 0, None)          # anchored light component
    n_pol = np.clip(pol - excess, 0, 255)

    # --- reconstruct occluded angular sectors (content that rotates out from
    #     under static bridgework). Cloning candidates: tooth pitch + spoke pitch.
    occ = np.zeros(ANG_SAMPLES, bool)
    for occl in part_cfg.get("occluders", []):
        occ |= polygon_occluded_angles(occl["polygon_px"], cx, cy,
                                       max(r_in, 1), r_out)
    pitch_candidates = []
    if reg.get("k"):
        pitch_candidates.append(ANG_SAMPLES / reg["k"])          # tooth/tick pitch
    if part_cfg.get("spokes"):
        pitch_candidates.append(ANG_SAMPLES / part_cfg["spokes"])  # spoke pitch
    n_pol_filled = fill_occluded_polar(n_pol, occ, pitch_candidates)
    exc_filled = fill_occluded_polar(excess, occ, pitch_candidates)

    n_img = np.nan_to_num(from_polar(n_pol_filled, lcx, lcy, r_max, (size, size)))
    exc_img = np.nan_to_num(from_polar(exc_filled, lcx, lcy, r_max, (size, size)))

    # identity-by-construction: cloned content replaces originals ONLY inside the
    # actual occluder footprint (2D polygon, dilated 2px, feathered) — everywhere
    # else the sprite carries exact original pixels.
    occ_map = np.zeros((size, size), np.float32)
    for occl in part_cfg.get("occluders", []):
        poly = np.array(occl["polygon_px"], np.float64) - [bx, by]
        m = np.zeros((size, size), np.uint8)
        cv2.fillPoly(m, [np.round(poly).astype(np.int32)], 255)
        m = cv2.dilate(m, np.ones((5, 5), np.uint8))
        m = cv2.GaussianBlur(m, (0, 0), 1.5)
        occ_map = np.maximum(occ_map, m.astype(np.float32) / 255)
    occ_map = occ_map[..., None]
    exc_cart = np.nan_to_num(from_polar(excess, lcx, lcy, r_max, (size, size)))
    n_exact = crop - exc_cart                     # exact split, unoccluded zones
    n_final = n_exact * (1 - occ_map) + n_img * occ_map
    c_final = exc_cart * (1 - occ_map) + exc_img * occ_map

    # quantize with exact-identity pairing: N = round clamped <= P, C = P - N
    n_u8 = np.minimum(np.clip(np.round(n_final), 0, 255), crop).astype(np.uint8)
    c_u8 = (crop.astype(np.int16) - n_u8.astype(np.int16)).astype(np.uint8)

    n_rgb = decontaminate_rgb(n_u8, alpha)
    a_u8 = np.clip(np.round(alpha * 255), 0, 255).astype(np.uint8)
    n_rgba = np.dstack([n_rgb, a_u8])
    c_rgba = np.dstack([c_u8, a_u8])

    # --- occluder mask (white shows sprite; transparent where base bridges show)
    # containment invariant: window >= clone-blend zone >= occluder footprint.
    # The blend map dilates the polygon by 5px+blur, so the window dilates by 8
    # before feathering — cloned content can never peek out at rest.
    occl_mask = np.full((size, size), 255, np.uint8)
    for occl in part_cfg.get("occluders", []):
        poly = np.array(occl["polygon_px"], np.float64) - [bx, by]
        m = np.zeros((size * 2, size * 2), np.uint8)
        cv2.fillPoly(m, [np.round(poly * 2).astype(np.int32)], 255)
        m = cv2.dilate(m, np.ones((17, 17), np.uint8))
        m = cv2.GaussianBlur(m, (0, 0), occl.get("feather_px", 1.5) * 2)
        m = cv2.resize(m, (size, size), interpolation=cv2.INTER_AREA)
        occl_mask = np.minimum(occl_mask, 255 - m)
    mask_rgba = np.dstack([np.full((size, size, 3), 255, np.uint8), occl_mask])

    # --- emit (lossless)
    out_dir.mkdir(parents=True, exist_ok=True)
    Image.fromarray(n_rgba).save(out_dir / f"{name}.webp", lossless=True, quality=100)
    Image.fromarray(c_rgba).save(out_dir / f"{name}-spec.webp", lossless=True, quality=100)
    Image.fromarray(mask_rgba).save(out_dir / f"{name}-occluder.png")

    # --- identity gate (numpy replay of runtime compositing at 0 deg)
    af = a_u8.astype(np.float32) / 255
    comp = crop * (1 - af[..., None]) + n_rgb.astype(np.float32) * af[..., None]
    comp = comp + c_u8.astype(np.float32) * af[..., None]          # plus-lighter
    wf = occl_mask.astype(np.float32) / 255
    comp = crop * (1 - wf[..., None]) + comp * wf[..., None]        # occluder window
    diff = np.abs(comp - crop)
    core = (af > 0.995) & (wf > 0.995) & (occ_map[..., 0] < 0.01)
    ring = (af > 0.005) & ~core & (occ_map[..., 0] < 0.01)
    gate = {
        "core_max": float(diff[core].max()) if core.any() else 0.0,
        "core_over2_px": int((diff[core].max(axis=-1) >= 2).sum()) if core.any() else 0,
        "ring_p99": float(np.percentile(diff[ring].max(axis=-1), 99)) if ring.any() else 0.0,
    }

    # --- QA collage: original | N | C(x4) | composites at rotations
    qa_dir.mkdir(parents=True, exist_ok=True)
    tiles = [crop.astype(np.uint8),
             n_rgba[..., :3],
             np.clip(c_u8.astype(np.float32) * 4, 0, 255).astype(np.uint8)]
    for deg in (0, 15, 45, 180):
        M = cv2.getRotationMatrix2D((lcx, lcy), -deg, 1.0)
        n_rot = cv2.warpAffine(n_rgba, M, (size, size), flags=cv2.INTER_LINEAR)
        c_stat = c_rgba
        arf = n_rot[..., 3:].astype(np.float32) / 255
        fr = crop * (1 - arf) + n_rot[..., :3].astype(np.float32) * arf
        fr = fr + c_stat[..., :3].astype(np.float32) * (c_stat[..., 3:].astype(np.float32) / 255)
        fr = crop * (1 - wf[..., None]) + fr * wf[..., None]
        tiles.append(np.clip(fr, 0, 255).astype(np.uint8))
    grid = np.concatenate([np.concatenate(tiles[0:3] + [tiles[3]], axis=1),
                           np.concatenate(tiles[3:7], axis=1)], axis=0)
    Image.fromarray(grid).save(qa_dir / f"{name}-collage.png")

    return {
        "name": name,
        "center": [round(cx, 2), round(cy, 2)],
        "box_px": [bx, by, size, size],
        "r_in": r_in, "r_out": round(r_out, 2),
        "origin_pct": [round((cx - bx) / size * 100, 3),
                       round((cy - by) / size * 100, 3)],
        "files": {"sprite": f"{name}.webp", "spec": f"{name}-spec.webp",
                  "occluder": f"{name}-occluder.png"},
        "gate": gate,
    }


# ---------------------------------------------------------------- main

def main():
    args = sys.argv[1:]
    cmd = args[0] if args else "all"
    img, cfg = load_master()
    if cmd in ("register", "all"):
        reg = stage_register(img, cfg)
        for name, r in reg.items():
            if r["e_est_px"] > 0.75:
                print(f"GATE FAIL: {name} wobble bootstrap e_est={r['e_est_px']}px > 0.75")
                if "--report-only" not in args:
                    sys.exit(1)
        print("registration gates passed")
    if cmd == "register":
        return

    parts_out = []
    anims = {
        "gear": {"type": "spin", "period_s": 60, "direction": "cw",
                  "easing": "steps(300, end)"},
        "balance": {"type": "oscillate", "amplitude_deg": 13, "period_s": 0.2,
                     "easing": "cubic-bezier(.37,0,.63,1)"},
    }
    for name in ("gear", "balance"):
        r = reg[name]
        # spin eligibility gates (ladder: demote, never loosen)
        if anims[name]["type"] == "spin" and (r["e_est_px"] > 0.35 or r["ovality_px"] > 0.8):
            print(f"DEMOTED: {name} fails spin gates (e={r['e_est_px']}, oval={r['ovality_px']})")
            continue
        if anims[name]["type"] == "oscillate" and (r["e_est_px"] > 0.5 or r["ovality_px"] > 1.0):
            print(f"DEMOTED: {name} fails oscillation gates")
            continue
        part_cfg = dict(cfg["parts"][name])
        if name == "gear":
            part_cfg["spokes"] = 5
        info = build_part_sprite(img, name, part_cfg, r, OUT, QA)
        info["anim"] = anims[name]
        g = info["gate"]
        print(f"{name}: identity core_max={g['core_max']:.1f} "
              f"core_over2={g['core_over2_px']} ring_p99={g['ring_p99']:.1f}")
        if g["core_over2_px"] > 0 or g["ring_p99"] > 24:
            print(f"GATE FAIL: {name} identity")
            if "--report-only" not in args:
                sys.exit(1)
        parts_out.append(info)

    rig = {
        "version": 2,
        "image": {"w": IMG, "h": IMG, "master_sha256": cfg["master_sha256"]},
        "parts": parts_out,
        "topwheel_demoted": "out-of-round k2=1.79px — static per ladder",
    }
    (OUT / "rig.json").write_text(json.dumps(rig, indent=2))
    total = sum(f.stat().st_size for f in OUT.iterdir())
    print(f"rig emitted: {len(parts_out)} parts, {total/1024:.0f} KB total")
    if total > 3 * 1024 * 1024:
        sys.exit("GATE FAIL: budget")
    print("ALL GATES PASSED")


if __name__ == "__main__":
    main()
