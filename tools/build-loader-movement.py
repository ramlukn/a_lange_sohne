#!/usr/bin/env python3
"""Build the loading-screen movement and splice it into index.html.

    python3 tools/build-loader-movement.py

Draws Calibre NR.1 - mainplate, going train, bridges and escapement - as one
inline SVG in a 200x200 viewBox, and writes it between the <div class=
"loader-mvt"> tags of index.html. No external assets and no requests: the
loader has to paint before anything else loads.

The train is single-module (m = 1.5). Every mesh is wheel<->pinion with a
matched module, a centre distance of exactly r1 + r2, and a phase that drops a
tooth of one gear into a gap of the other, so the teeth stay properly engaged
at every frame. Tooth counts (44/22, 36/12, 21/7) were chosen so the rotation
ratios are small integers and so the wheel-on-wheel overlap that any real plan
view has stays shallow enough to read as depth rather than as a clash.

Animation classes consumed by src/styles.css:
    .mv-plate  the mainplate fading in
    .mv-drop   a part descending onto its arbor  (delay via --d)
    .mv-seat   a bridge or cock seating          (delay via --d)
    .mv-spin   the let-off, one ratio-exact sweep per arbor (--lo)
    .mv-run    the running train, stepped on a 1/6s tick    (--rn)
    .mv-beat-* balance / hairspring / pallet fork, 21600 A/h
Animated groups carry their pivot as an inline transform-origin in viewBox
units, so nesting .mv-drop > .mv-spin > .mv-run about the same point works.
"""

import math
import os
import re

M = 1.5                      # module (user units)
CX = CY = 100.0
R_PLATE = 93.0


def fm(v):
    s = f"{v:.1f}"
    if s.endswith('.0'):
        s = s[:-2]
    return s


def P(cx, cy, r, adeg):
    a = math.radians(adeg)
    return (cx + r * math.cos(a), cy + r * math.sin(a))


def pt(p):
    return f"{fm(p[0])} {fm(p[1])}"


# ---------------------------------------------------------------- gear teeth
def gear_ring(N, rp, phase, rim_in, tip=1.0, root=1.25, w_root=1.0, w_tip=0.48,
              cx=0.0, cy=0.0):
    """Toothed annulus: teeth outline + inner circle (evenodd)."""
    rt = rp + M * tip
    rr = rp - M * root
    ap = 90.0 / N                     # half circular pitch, degrees
    d = []
    for i in range(N):
        th = phase + i * 360.0 / N
        a1, a2, a3, a4 = th - ap * w_root, th - ap * w_tip, th + ap * w_tip, th + ap * w_root
        if i == 0:
            d.append("M" + pt(P(cx, cy, rr, a1)))
        else:
            d.append(f"A{fm(rr)} {fm(rr)} 0 0 1 " + pt(P(cx, cy, rr, a1)))
        d.append("L" + pt(P(cx, cy, rt, a2)))
        d.append(f"A{fm(rt)} {fm(rt)} 0 0 1 " + pt(P(cx, cy, rt, a3)))
        d.append("L" + pt(P(cx, cy, rr, a4)))
    d.append(f"A{fm(rr)} {fm(rr)} 0 0 1 " + pt(P(cx, cy, rr, phase - ap * w_root)))
    d.append("Z")
    if rim_in is not None:
        d.append(f"M{fm(cx + rim_in)} {fm(cy)}"
                 f"A{fm(rim_in)} {fm(rim_in)} 0 1 0 {fm(cx - rim_in)} {fm(cy)}"
                 f"A{fm(rim_in)} {fm(rim_in)} 0 1 0 {fm(cx + rim_in)} {fm(cy)}Z")
    return "".join(d)


def crossings(n, r_out, r_in, width, phase=0.0):
    """n straight tapered arms between r_in and r_out."""
    out = []
    for i in range(n):
        th = phase + i * 360.0 / n
        ao = math.degrees(math.asin(min(0.99, (width * 0.5) / r_out)))
        ai = math.degrees(math.asin(min(0.99, (width * 0.78) / max(r_in, 0.6))))
        d = ("M" + pt(P(0, 0, r_in, th - ai)) +
             "L" + pt(P(0, 0, r_out, th - ao)) +
             f"A{fm(r_out)} {fm(r_out)} 0 0 1 " + pt(P(0, 0, r_out, th + ao)) +
             "L" + pt(P(0, 0, r_in, th + ai)) +
             f"A{fm(r_in)} {fm(r_in)} 0 0 0 " + pt(P(0, 0, r_in, th - ai)) + "Z")
        out.append(d)
    return "".join(out)


def escape_teeth(N, r_tip, r_root, phase=0.0):
    """Club-tooth escape wheel: a long swept flank up to the locking corner,
    then a steep undercut back down to the rim."""
    step = 360.0 / N
    d = []
    for i in range(N):
        th = phase + i * step
        p1 = P(0, 0, r_root, th)
        c1 = P(0, 0, r_root * 1.28, th + step * 0.30)
        p2 = P(0, 0, r_tip, th + step * 0.60)          # locking corner
        p3 = P(0, 0, r_tip * 0.90, th + step * 0.74)   # impulse face
        p4 = P(0, 0, r_root, th + step * 0.80)         # undercut
        if i == 0:
            d.append("M" + pt(p1))
        else:
            d.append(f"A{fm(r_root)} {fm(r_root)} 0 0 1 " + pt(p1))
        d.append("Q" + pt(c1) + " " + pt(p2))
        d.append("L" + pt(p3))
        d.append("L" + pt(p4))
    d.append(f"A{fm(r_root)} {fm(r_root)} 0 0 1 " + pt(P(0, 0, r_root, phase)))
    d.append("Z")
    return "".join(d)


def spiral(r0, r1, turns, a0=0.0, steps=130):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        a = a0 + turns * 360.0 * t
        r = r0 + (r1 - r0) * t
        pts.append(P(0, 0, r, a))
    d = "M" + pt(pts[0]) + "".join("L" + pt(p) for p in pts[1:])
    return d


# ------------------------------------------------------- bridge outline hull
def hull(cs):
    """Outer tangent hull of a chain of circles -> one closed path."""
    n = len(cs)
    L, Rr = [], []
    for i in range(n - 1):
        (x1, y1, r1), (x2, y2, r2) = cs[i], cs[i + 1]
        dx, dy = x2 - x1, y2 - y1
        Ln = math.hypot(dx, dy)
        a = math.atan2(dy, dx)
        b = math.acos(max(-1.0, min(1.0, (r1 - r2) / Ln)))
        L.append((a + b, (x1 + r1 * math.cos(a + b), y1 + r1 * math.sin(a + b)),
                  (x2 + r2 * math.cos(a + b), y2 + r2 * math.sin(a + b))))
        Rr.append((a - b, (x1 + r1 * math.cos(a - b), y1 + r1 * math.sin(a - b)),
                   (x2 + r2 * math.cos(a - b), y2 + r2 * math.sin(a - b))))

    def arc(r, p, sweep):
        return f"A{fm(r)} {fm(r)} 0 0 {sweep} " + pt(p)

    def ang(c, p):
        return math.degrees(math.atan2(p[1] - c[1], p[0] - c[0]))

    def norm(d):
        while d <= -180:
            d += 360
        while d > 180:
            d -= 360
        return d

    d = ["M" + pt(L[0][1])]
    for i in range(n - 1):
        d.append("L" + pt(L[i][2]))
        if i < n - 2:
            c = cs[i + 1]
            df = norm(ang(c, L[i + 1][1]) - ang(c, L[i][2]))
            d.append(arc(c[2], L[i + 1][1], 1 if df > 0 else 0))
    d.append(arc(cs[-1][2], Rr[-1][2], 0))        # far cap
    for i in range(n - 2, -1, -1):
        d.append("L" + pt(Rr[i][1]))
        if i > 0:
            c = cs[i]
            df = norm(ang(c, Rr[i - 1][2]) - ang(c, Rr[i][1]))
            d.append(arc(c[2], Rr[i - 1][2], 1 if df > 0 else 0))
    d.append(arc(cs[0][2], L[0][1], 0))           # near cap
    d.append("Z")
    return "".join(d)


# ------------------------------------------------------------------- layout
C = (110.0, 93.0)
B = P(C[0], C[1], 49.5, 215.0)
D = P(C[0], C[1], 36.0, 25.0)
E = P(D[0], D[1], 21.0, 78.0)
PA = P(E[0], E[1], 22.0, 158.0)
BAL = P(PA[0], PA[1], 27.0, 153.0)

TEETH = dict(B=44, Cp=22, C=36, Dp=12, D=21, Ep=7, E=14)
RP = {k: M * v / 2 for k, v in TEETH.items()}

PH = dict(
    B=35.0 - 180.0 / TEETH['B'],
    Cp=215.0,
    C=25.0 - 180.0 / TEETH['C'],
    Dp=205.0,
    D=78.0 - 180.0 / TEETH['D'],
    Ep=258.0,
    E=8.0,
)


def g(cls=None, style=None, extra="", children=""):
    a = ""
    if cls:
        a += f' class="{cls}"'
    if style:
        a += f' style="{style}"'
    if extra:
        a += " " + extra
    return f"<g{a}>{children}</g>"


def origin(p, delay=None):
    s = f"transform-origin:{fm(p[0])}px {fm(p[1])}px"
    if delay is not None:
        s += f";--d:{delay}s"
    return s


out = []
A = out.append

# ------------------------------------------------------------------- defs
stripes = []
for i in range(27):
    t = i / 26
    col = "#6f6152" if i % 2 == 0 else "#877764"
    stripes.append(f'<stop offset="{t:.4f}" stop-color="{col}"/>')
    if i < 26:
        stripes.append(f'<stop offset="{t + 1/26 - 0.001:.4f}" stop-color="{col}"/>')

A(f'''<defs>
<radialGradient id="mvPlate" cx="34%" cy="26%" r="86%">
<stop offset="0" stop-color="#463b31"/><stop offset="55%" stop-color="#2b241e"/><stop offset="100%" stop-color="#17120f"/>
</radialGradient>
<linearGradient id="mvGold" x1="0" y1="0" x2="0.85" y2="1">
<stop offset="0" stop-color="#ffe8ca"/><stop offset="34%" stop-color="#e0a172"/><stop offset="68%" stop-color="#a3663e"/><stop offset="100%" stop-color="#f0c69c"/>
</linearGradient>
<linearGradient id="mvGold2" x1="1" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#f4d2aa"/><stop offset="45%" stop-color="#c48254"/><stop offset="100%" stop-color="#8a5631"/>
</linearGradient>
<linearGradient id="mvSteel" x1="0.1" y1="0" x2="0.9" y2="1">
<stop offset="0" stop-color="#eef1f6"/><stop offset="38%" stop-color="#9aa3b2"/><stop offset="62%" stop-color="#d6dce6"/><stop offset="100%" stop-color="#69717f"/>
</linearGradient>
<linearGradient id="mvRib" x1="0" y1="0" x2="1" y2="0.42">{''.join(stripes)}</linearGradient>
<radialGradient id="mvRuby" cx="36%" cy="32%" r="72%">
<stop offset="0" stop-color="#ff8f97"/><stop offset="40%" stop-color="#c4384a"/><stop offset="100%" stop-color="#7d1626"/>
</radialGradient>
<radialGradient id="mvShade" cx="50%" cy="50%" r="50%">
<stop offset="0" stop-color="rgba(6,3,1,.55)"/><stop offset="74%" stop-color="rgba(6,3,1,.5)"/><stop offset="100%" stop-color="rgba(6,3,1,0)"/>
</radialGradient>
<radialGradient id="mvVig" cx="50%" cy="50%" r="50%">
<stop offset="60%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(0,0,0,.6)"/>
</radialGradient>
</defs>''')

# ------------------------------------------------------------------ mainplate
grain = "".join(
    f'<circle cx="{fm(CX)}" cy="{fm(CY)}" r="{fm(r)}" fill="none" stroke="rgba(255,222,186,.05)" stroke-width=".5"/>'
    for r in [x * 4.6 + 6 for x in range(19)])
plate_screws = "".join(
    f'<g transform="translate({fm(p[0])},{fm(p[1])})">'
    f'<circle r="3" fill="#20262f"/><circle r="2.5" fill="url(#mvSteel)"/>'
    f'<rect x="-2" y="-.4" width="4" height=".8" fill="#2a3038" transform="rotate({fm(a)})"/></g>'
    for p, a in [(P(CX, CY, 84, 128), 20), (P(CX, CY, 84, 300), 66), (P(CX, CY, 86, 12), -35),
                 (P(CX, CY, 62, 158), 8), (P(CX, CY, 78, 196), 52)])

A(g("mv-plate", origin((CX, CY)), children=(
    f'<circle cx="{fm(CX)}" cy="{fm(CY)}" r="{fm(R_PLATE)}" fill="url(#mvPlate)"/>'
    + grain +
    f'<circle cx="{fm(CX)}" cy="{fm(CY)}" r="{fm(R_PLATE)}" fill="url(#mvVig)"/>'
    f'<circle cx="{fm(CX)}" cy="{fm(CY)}" r="{fm(R_PLATE - .6)}" fill="none" stroke="url(#mvGold)" stroke-width="1.2" opacity=".62"/>'
    f'<circle cx="{fm(CX)}" cy="{fm(CY)}" r="{fm(R_PLATE - 3.4)}" fill="none" stroke="rgba(255,226,192,.09)" stroke-width=".7"/>'
    + plate_screws +
    f'<text x="{fm(CX + 38)}" y="{fm(CY - 62)}" fill="rgba(247,222,192,.30)" font-family="var(--font-mono)" font-size="4.6" letter-spacing="1.1" text-anchor="middle" transform="rotate(14 {fm(CX + 38)} {fm(CY - 62)})">NR.1</text>'
    f'<text x="{fm(CX + 44)} " y="{fm(CY - 54)}" fill="rgba(247,222,192,.20)" font-family="var(--font-mono)" font-size="3.2" letter-spacing=".9" text-anchor="middle" transform="rotate(14 {fm(CX + 44)} {fm(CY - 54)})">21 JEWELS</text>'
)))


def shadow_ring(c, r):
    return (f'<circle cx="{fm(c[0] + 1.3)}" cy="{fm(c[1] + 1.8)}" r="{fm(r + 3.2)}" '
            f'fill="url(#mvShade)"/>')


def hub(r_hub):
    s = (f'<circle r="{fm(r_hub)}" fill="url(#mvGold2)"/>'
         f'<circle r="{fm(r_hub * .55)}" fill="#171310"/>')
    return s


# --------------------------------------------------------------------- barrel
barrel_inner = (
    f'<circle r="{fm(RP["B"] - M * 1.25)}" fill="url(#mvGold2)"/>'
    + "".join(f'<circle r="{fm(r)}" fill="none" stroke="rgba(52,29,13,.24)" stroke-width=".4"/>'
              for r in [4.5, 8, 11.5, 15, 18.5, 22, 25.5, 28.8])
    + f'<circle r="{fm(RP["B"] - M * 1.25)}" fill="none" stroke="rgba(255,232,203,.35)" stroke-width=".7"/>'
    + "".join(f'<g transform="translate({fm(P(0,0,24,a)[0])},{fm(P(0,0,24,a)[1])})">'
              f'<circle r="2.1" fill="#20262f"/><circle r="1.7" fill="url(#mvSteel)"/>'
              f'<rect x="-1.35" y="-.3" width="2.7" height=".6" fill="#2a3038"/></g>'
              for a in (30, 150, 270))
    + '<circle r="4.6" fill="url(#mvGold)"/><rect x="-2.5" y="-2.5" width="5" height="5" fill="#2b211a" transform="rotate(22)"/>'
)
A(g("mv-drop", origin(B, 0.12), children=shadow_ring(B, RP['B'] + M) + g(
    "mv-spin", origin(B) + ";--lo:30deg", children=g(
        "mv-run", origin(B) + ";--rn:32.143deg", children=(
            f'<g transform="translate({fm(B[0])},{fm(B[1])})">'
            f'<path d="{gear_ring(TEETH["B"], RP["B"], PH["B"], RP["B"] - M * 1.25)}" fill="url(#mvGold)" fill-rule="evenodd"/>'
            + barrel_inner + '</g>')))))

# --------------------------------------------------------------- centre wheel
A(g("mv-drop", origin(C, 0.21), children=shadow_ring(C, RP['C'] + M) + g(
    "mv-spin", origin(C) + ";--lo:-60deg", children=g(
        "mv-run", origin(C) + ";--rn:-64.286deg", children=(
            f'<g transform="translate({fm(C[0])},{fm(C[1])})">'
            # centre-wheel (gold) teeth + rim + crossings
            f'<path d="{gear_ring(TEETH["C"], RP["C"], PH["C"], RP["C"] - M * 3.2)}" fill="url(#mvGold)" fill-rule="evenodd"/>'
            f'<path d="{crossings(5, RP["C"] - M * 3.1, 6.2, 3.4)}" fill="url(#mvGold2)"/>'
            # the large pinion the barrel drives (polished steel)
            f'<path d="{gear_ring(TEETH["Cp"], RP["Cp"], PH["Cp"], None, root=1.1, w_tip=0.55)}" fill="url(#mvSteel)"/>'
            f'<circle r="{fm(RP["Cp"] - M * 1.1)}" fill="url(#mvSteel)"/>'
            f'<circle r="{fm(RP["Cp"] - M * 1.1)}" fill="none" stroke="rgba(20,26,34,.5)" stroke-width=".5"/>'
            + hub(4.2) + '</g>')))))

# ---------------------------------------------------------------- third wheel
A(g("mv-drop", origin(D, 0.29), children=shadow_ring(D, RP['D'] + M) + g(
    "mv-spin", origin(D) + ";--lo:180deg", children=g(
        "mv-run", origin(D) + ";--rn:150deg", children=(
            f'<g transform="translate({fm(D[0])},{fm(D[1])})">'
            f'<path d="{gear_ring(TEETH["D"], RP["D"], PH["D"], RP["D"] - M * 3.0)}" fill="url(#mvGold)" fill-rule="evenodd"/>'
            f'<path d="{crossings(4, RP["D"] - M * 2.9, 4.4, 2.8)}" fill="url(#mvGold2)"/>'
            f'<path d="{gear_ring(TEETH["Dp"], RP["Dp"], PH["Dp"], None, root=1.1, w_tip=0.55)}" fill="url(#mvSteel)"/>'
            f'<circle r="{fm(RP["Dp"] - M * 1.1)}" fill="url(#mvSteel)"/>'
            + hub(3) + '</g>')))))

# --------------------------------------------------------------- escape wheel
A(g("mv-drop", origin(E, 0.36), children=shadow_ring(E, 12) + g(
    "mv-spin", origin(E) + ";--lo:-540deg", children=g(
        "mv-run", origin(E) + ";--rn:-385.714deg", children=(
            f'<g transform="translate({fm(E[0])},{fm(E[1])})">'
            f'<path d="{escape_teeth(TEETH["E"], 12, 8.3, PH["E"])}" fill="url(#mvSteel)"/>'
            f'<circle r="8.3" fill="rgba(22,17,13,.72)"/>'
            f'<path d="{crossings(4, 8.4, 2.9, 1.9)}" fill="url(#mvSteel)"/>'
            f'<path d="{gear_ring(TEETH["Ep"], RP["Ep"], PH["Ep"], None, root=1.0, w_tip=0.6)}" fill="url(#mvSteel)"/>'
            f'<circle r="{fm(RP["Ep"] - M)}" fill="url(#mvSteel)"/>'
            f'<circle r="1.5" fill="#171310"/></g>')))))

# -------------------------------------------------------------------- bridges
def waist(cs, k=0.62, bow=()):
    """Pinch a smaller circle between each pair so the arms narrow like real
    bridges, optionally bowed sideways so an arm clears the line of centres
    (and therefore the mesh) it would otherwise sit on top of."""
    out = [cs[0]]
    for i, (a, b) in enumerate(zip(cs, cs[1:])):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        o = bow[i] if i < len(bow) else 0.0
        if o:
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            mx += -dy / L * o
            my += dx / L * o
        out.append((mx, my, min(a[2], b[2]) * k))
        out.append(b)
    return out


def bridge(cs, bow=()):
    cs = waist(cs, bow=bow)
    d = hull(cs)
    inner = hull([(x, y, max(r - 1.25, .5)) for x, y, r in cs])
    s = (f'<path d="{d}" fill="rgba(8,5,3,.4)" transform="translate(.9,1.2)"/>'
         f'<path d="{d}" fill="url(#mvGold)"/>'
         f'<path d="{inner}" fill="url(#mvRib)"/>'
         f'<path d="{inner}" fill="none" stroke="rgba(255,238,214,.4)" stroke-width=".55"/>'
         f'<path d="{d}" fill="none" stroke="rgba(24,14,7,.6)" stroke-width=".5"/>')
    return s


def chaton(p, r=3.0, screws=True):
    s = [f'<g transform="translate({fm(p[0])},{fm(p[1])})">',
         f'<circle r="{fm(r)}" fill="url(#mvGold)"/>',
         f'<circle r="{fm(r)}" fill="none" stroke="rgba(28,16,8,.55)" stroke-width=".45"/>',
         f'<circle r="{fm(r * .58)}" fill="url(#mvRuby)"/>',
         f'<circle r="{fm(r * .22)}" fill="rgba(255,210,214,.5)"/>']
    if screws:
        for a in (30, 150, 270):
            q = P(0, 0, r * 1.42, a)
            s.append(f'<circle cx="{fm(q[0])}" cy="{fm(q[1])}" r="1.15" fill="url(#mvSteel)"/>'
                     f'<rect x="{fm(q[0]-.85)}" y="{fm(q[1]-.18)}" width="1.7" height=".36" fill="#2a3038"/>')
    s.append('</g>')
    return "".join(s)


BARREL_BRIDGE = [(37.0, 54.0, 4.4), (B[0], B[1], 8.8), (107.0, 27.0, 4.2)]
CENTRE_COCK  = [(C[0], C[1], 7.2), (135.5, 57.0, 4.2)]
TRAIN_BRIDGE = [(D[0], D[1], 6.6), (E[0], E[1], 5.8), (162.0, 148.0, 4.2)]
PALLET_COCK = [(PA[0], PA[1], 4.7), (151.0, 165.0, 3.4)]
BAL_COCK = [(BAL[0], BAL[1], 7.8), (56.0, 157.0, 4.9)]

A(g("mv-seat", origin((C[0] + 10, C[1] - 14), 0.44), children=bridge(CENTRE_COCK)))
A(g("mv-seat", origin((D[0] + 8, D[1] + 12), 0.48), children=bridge(TRAIN_BRIDGE, bow=(-5.0, 0.0))))
A(g("mv-seat", origin((B[0], B[1]), 0.52), children=bridge(BARREL_BRIDGE)))

# ---------------------------------------------------------------- pallet fork
pal_ang = math.degrees(math.atan2(E[1] - PA[1], E[0] - PA[0]))       # toward escape
fork_ang = math.degrees(math.atan2(BAL[1] - PA[1], BAL[0] - PA[0]))  # toward balance
arm = []
for sgn in (-1, 1):
    a = pal_ang + sgn * 26.0
    q = [P(0, 0, 4.8, a - 17 * sgn), P(0, 0, 12.9, a - 5.2 * sgn),
         P(0, 0, 12.9, a + 5.2 * sgn), P(0, 0, 4.8, a + 17 * sgn)]
    arm.append('<path d="M' + pt(q[0]) + 'L' + pt(q[1]) + 'L' + pt(q[2]) + 'L' + pt(q[3]) +
               'Z" fill="url(#mvSteel)"/>')
    # rectangular pallet jewel set into the end of the arm
    j = [P(0, 0, 10.4, a - 4.6 * sgn), P(0, 0, 13.1, a - 4.0 * sgn),
         P(0, 0, 13.1, a + 4.0 * sgn), P(0, 0, 10.4, a + 4.6 * sgn)]
    arm.append('<path d="M' + pt(j[0]) + 'L' + pt(j[1]) + 'L' + pt(j[2]) + 'L' + pt(j[3]) +
               'Z" fill="url(#mvRuby)"/>')
h1 = P(0, 0, 17.8, fork_ang - 9.5)
h2 = P(0, 0, 17.8, fork_ang + 9.5)
notch = P(0, 0, 13.2, fork_ang)
f_b1 = P(0, 0, 4.6, fork_ang - 30)
f_b2 = P(0, 0, 4.6, fork_ang + 30)
fork = ('<path d="M' + pt(f_b1) + 'L' + pt(h1) + 'L' + pt(notch) + 'L' + pt(h2) + 'L' + pt(f_b2) +
        'Z" fill="url(#mvSteel)"/>')
A(g("mv-drop", origin(PA, 0.62), children=g(
    "mv-beat mv-beat-pallet", origin(PA), children=(
        f'<g transform="translate({fm(PA[0])},{fm(PA[1])})">'
        + fork + "".join(arm)
        + '<circle r="4.6" fill="url(#mvSteel)"/><circle r="1.5" fill="#171310"/></g>'))))

A(g("mv-seat", origin(PA, 0.70), children=(
    bridge(PALLET_COCK) + chaton(PA, 2.7))))

# -------------------------------------------------------------- balance wheel
rim = []
for i in range(8):
    q = P(0, 0, 22.0, i * 45 + 22.5)
    rim.append(f'<circle cx="{fm(q[0])}" cy="{fm(q[1])}" r="1.9" fill="url(#mvGold)"/>'
               f'<circle cx="{fm(q[0])}" cy="{fm(q[1])}" r="1.0" fill="rgba(40,22,10,.45)"/>')
balance = (
    f'<circle r="22" fill="none" stroke="url(#mvGold)" stroke-width="4"/>'
    f'<circle r="24" fill="none" stroke="rgba(20,12,6,.4)" stroke-width=".6"/>'
    f'<circle r="20" fill="none" stroke="rgba(20,12,6,.4)" stroke-width=".6"/>'
    + f'<path d="{crossings(3, 20.2, 3.2, 3.0)}" fill="url(#mvGold2)"/>'
    + "".join(rim)
    + '<circle r="3.4" fill="url(#mvGold2)"/>')

A(g("mv-drop", origin(BAL, 0.86), children=(
    g("mv-beat mv-beat-hair", origin(BAL), children=(
        f'<g transform="translate({fm(BAL[0])},{fm(BAL[1])})">'
        f'<path d="{spiral(3.9, 13.4, 4.4, 200)}" fill="none" stroke="#6d8fc4" stroke-width=".72" stroke-linecap="round" opacity=".92"/>'
        f'</g>')) +
    g("mv-beat mv-beat-bal", origin(BAL), children=(
        f'<g transform="translate({fm(BAL[0])},{fm(BAL[1])})">' + balance + '</g>')))))

# balance cock, swan-neck regulator, endstone
sn_a = P(BAL[0], BAL[1], 15.5, 118)
sn_b = P(BAL[0], BAL[1], 15.5, 196)
A(g("mv-seat", origin(BAL, 0.94), children=(
    bridge(BAL_COCK)
    + f'<path d="M{pt(sn_a)}Q{pt(P(BAL[0], BAL[1], 20.5, 157))} {pt(sn_b)}" fill="none" stroke="url(#mvSteel)" stroke-width="1.15" stroke-linecap="round"/>'
    + chaton(BAL, 3.5)
)))

# ------------------------------------------------------------------- chatons
for i, (p, r) in enumerate([(C, 3.1), (D, 2.9), (E, 2.6), (B, 3.0)]):
    A(g("mv-drop", origin(p, round(0.76 + i * 0.04, 3)), children=chaton(p, r)))

svg = ('<svg class="mv" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" '
       'aria-hidden="true" focusable="false">' + "".join(out) + '</svg>')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
page = os.path.join(ROOT, 'index.html')
html = open(page).read()
m = re.search(r'(<div class="loader-mvt">)<svg class="mv".*?</svg>(</div>)', html, re.S)
if not m:
    raise SystemExit('index.html: <div class="loader-mvt"> block not found')
open(page, 'w').write(html[:m.start()] + m.group(1) + svg + m.group(2) + html[m.end():])
print(f'index.html updated ({len(svg)} chars of SVG)')
