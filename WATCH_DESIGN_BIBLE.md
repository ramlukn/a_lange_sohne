# Lange 1 Portfolio — Design Bible

## Product intent

An interactive personal portfolio expressed through the visual grammar of the A. Lange & Söhne Lange 1: asymmetrical but balanced complications, restrained typography, deep blue dial, warm gold case, and precise click targets. The watch remains the navigation surface; decoration must never compete with legibility or geometry.

## Reference hierarchy

1. Primary proportion and color reference: `959f7686c620bbaebcc41654db19c707536b723e.webp`.
2. Secondary lighting/depth reference: `9f44436e1cf67a550df2e664e448cc622fdbe68f.jpg`.
3. Existing Claude implementation: preserve its interactions, overlays, real-time movement, caseback, and load choreography.

## Measured layout ratios

All values are percentages of the circular case diameter.

| Component | Left | Top | Width | Notes |
| --- | ---: | ---: | ---: | --- |
| Dial opening | 5.15 | 5.15 | 89.70 | Deeply seated under a stepped bezel |
| Hours/minutes | 6.50 | 21.70 | 50.60 | Center at 31.80 / 47.00 |
| Outsize date | 53.50 | 20.30 | 20.50 | Slightly overlaps the hour-dial field |
| Power reserve pivot | 65.50 | 47.50 | — | Hand reads toward the right-side scale |
| Small seconds | 46.80 | 57.20 | 27.20 | Center at 60.40 / 70.80 |
| Moon phase | 49.35 | 58.45 | 22.10 | Centered in the upper half of small seconds |
| Date corrector | center 6.20 | center 24.20 | 8.65 × 2.10 | Mirrored bowed cap at −60°, seated flush into the case |
| Maker signature | 21.50 | 10.70 | 57.00 | Centered above the complications |

## Color and material tokens

| Token | Value | Use |
| --- | --- | --- |
| `background` | `#030509` | Page falloff |
| `dial-shadow` | `#061427` | Dial perimeter and recesses |
| `dial-body` | `#0D2742` | Main blue |
| `dial-mid` | `#16324F` | Radial transition |
| `dial-light` | `#213A59` | Upper-left illumination |
| `gold-deep` | `#2C160D` | Case occlusion |
| `gold-shadow` | `#74442D` | Warm metal shadow |
| `gold-body` | `#B97C55` | Rose/champagne gold body |
| `gold-light` | `#F2D1AD` | Broad reflection |
| `gold-specular` | `#FFF1DD` | Narrow highlight |
| `ivory` | `#F3EEE6` | Printing and minute tracks |
| `reserve-red` | `#B4373F` | Low reserve accent only |

The case uses a champagne/rose-gold ramp with warm brown shadows—not orange copper. The dial is ink navy, not teal or electric blue. White printing is softened to ivory.

## Depth and lighting

- Single dominant light from upper-left (approximately 315°).
- Four visible depth tiers: outer case, polished bezel, dark rehaut, recessed dial.
- Metal reflections use narrow specular bands plus broad warm transitions.
- Subdials sit below the main dial with an inner top shadow and a restrained lower rim light.
- Sapphire reflections remain faint and cannot obscure text or hands.

## Typography

- Maker signature and complication numerals: Marcellus.
- Interface/body text: Archivo.
- Technical labels and captions: IBM Plex Mono.
- Signature uses generous tracking; utility text stays compact and subordinate.

## Motion and interaction

- Preserve real-time mechanical seconds, live hour/minute hands, loading assembly, complication zooms, hover captions, and crown flip.
- The opening assembly is visible after the loader clears: outer case seats first, followed by bezel and rehaut, the navy dial, the three complication groups, maker signature, hands, correctors, and finally the sapphire crystal. The sequence completes in roughly 3.7 seconds and collapses to near-instant motion when reduced motion is requested.
- Content opens in a restrained right-side panel by default; the watch remains visible at reduced scale on the left instead of disappearing under an oversized blurred zoom.
- Every motion must explain function or depth. No ambient floating, glow, or ornamental looping.
- The moon/book control remains as a deliberately reduced portfolio affordance so the Lange 1 composition stays dominant.
- The caseback shows a **hand-wound** calibre after the L121.3. It must never carry an oscillating rotor: the Lange 1 Moon Phase is manually wound, so the whole caseback is given over to the three-quarter plate. Required elements are the untreated German-silver three-quarter plate with Glashütte ribbing running lower-left to upper-right, the cutout at nine o'clock holding the balance, the hand-engraved balance cock tapering from a broad engraved head into the balance boss, screwed gold chatons (gold ring, ruby, three thermally blued screws), loose blued screws, the whiplash precision index adjuster, and the twin mainspring barrel. The balance beats at 21,600 vph — one full oscillation every 1/3 second.
- The moon display follows Lange's two-level construction: a 24-hour blue day/night disc behind a separate solid-gold double-moon orbit. The aperture, stars, moon edges, and twin lower scallops are crisp SVG geometry with no blurred mask or soft dome overlay.
- The 10 o'clock review control follows the official Lange date corrector: a compact rose-gold cap (about eight and a half percent of case diameter), aligned to the front-view case tangent at approximately −60°. Its ends and inset corners are mirrored, its long edges bow subtly with the case circumference, and the cap is partially seated into the case with no visible stand-off.
