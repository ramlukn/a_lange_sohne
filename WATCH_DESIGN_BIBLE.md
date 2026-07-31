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
- Every motion must explain function or depth. No ambient floating, glow, or ornamental looping.
- The moon/book control remains as a deliberately reduced portfolio affordance so the Lange 1 composition stays dominant.

