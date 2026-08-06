> Restructure note (2026-08-04): legacy prototypes (`support.js`, `image-slot.js`,
> `Lange Experience.dc.html`) were removed from the tree (git history keeps them);
> docs and reference images now live in `docs/`; `.claude/` is untracked dev tooling.

# Claude handoff — Nikhil Ramlukan Lange 1 portfolio

## Copy-paste master prompt

Paste the following into Claude after uploading the accompanying project bundle:

> Continue improving the attached interactive Lange 1 portfolio website. Do not recreate it from scratch and do not convert it to another framework. The current files in this bundle are the source of truth. Read `CLAUDE_HANDOFF.md` and `WATCH_DESIGN_BIBLE.md` completely before editing anything. Then run the current demo, capture a screenshot, and preserve every approved visual and interaction detail unless I explicitly request a change. Work on one isolated component at a time, render the page after each change, and compare it with the supplied reference images. Keep the watch elegant, restrained, mechanically plausible, and recognizably inspired by the A. Lange & Söhne Lange 1 Moon Phase. Do not improvise generic luxury-watch styling. Before handing work back, test the interaction affected by the edit, check desktop and mobile presentation, and report exactly which files and properties changed.

## Project goal

This is Nikhil Ramlukan's personal portfolio expressed as an interactive mechanical watch. The watch itself is the navigation system. Its visual language is based on the A. Lange & Söhne Lange 1 Moon Phase: asymmetric complication layout, outsize date, power reserve, small seconds with moonphase, warm pink/champagne-gold case, and a deep ink-navy dial.

The target is not a literal branded product page or a generic watch illustration. It is a refined personal interface whose geometry and material rendering remain faithful to the supplied Lange references.

## Source of truth and file map

- `index.html` — the full watch markup: case, dial, complications, panels, and the request modal.
- `src/styles.css` — every style token, complication geometry, hover state, and assembly keyframe.
- `src/main.js` — live time, moon-phase maths, panel/flip/modal state, and all interaction wiring.
- `WATCH_DESIGN_BIBLE.md` — approved measurements, palette, materials, depth, typography, and motion rules.
- `uploads/lange-reference.webp` — primary front-view reference for proportions and colors.
- `uploads/9f44436e1cf67a550df2e664e448cc622fdbe68f.jpg` — secondary three-quarter reference for lighting and case depth.
- `Lange Experience.dc.html`, `support.js`, `image-slot.js` — the retired Design Component prototype, kept only as historical reference. Do not edit these; they no longer drive the site.

The Git restore commit `4f986b9` predates several approved refinements. Do not reset to that commit.

## Runtime and preview

The site is a standalone static build: plain HTML, CSS, and vanilla ES modules, bundled with Vite. There is no framework and no runtime CDN dependency — the only external request is the Google Fonts stylesheet. Do not convert it to React, Vue, Canvas, Three.js, or an image unless specifically requested.

Install once, then run the dev server:

```bash
npm install
```

```bash
npm run dev
```

Then open:

```text
http://localhost:8765/
```

Produce the deployable bundle in `dist/` with:

```bash
npm run build
```

`npm run preview` serves that built bundle for a final check before deploying.

## Approved non-negotiable visual state

### Case and dial

- No strap in the main web composition.
- Circular, thin-looking case with multiple visible depth tiers: outer case, polished bezel, dark rehaut, recessed dial.
- The case is warm pink/champagne gold—not orange copper, yellow brass, flat beige, or grey metal.
- The dial is deep ink navy—not teal, cyan, electric blue, or black.
- Dominant light comes from the upper left, with narrow metal specular bands and restrained sapphire reflections.
- Preserve the current Lange 1 complication proportions. Exact ratios are recorded in `WATCH_DESIGN_BIBLE.md`.

### Ten-o'clock date corrector / review button

This control has been refined repeatedly and must not regress.

- Center: `6.20% / 24.20%` of case diameter.
- Visible cap: approximately `8.65% × 2.10%` of case diameter.
- Front-view tangent: approximately `-60deg`.
- Compact, symmetrical rose-gold cap.
- Both ends and inset corners are mirrored.
- Long edges bow subtly with the case circumference.
- It is partially seated into the case and must not jut outward.
- No visible radial post, floating gap, pill shape, circular button, oversized paddle, or detached tab.
- It remains the click target for “Request a review.”

### Moonphase

- Preserve the current sharp SVG construction.
- It is a two-level display: rotating blue day/night disc behind a separate solid-gold double-moon orbit.
- Preserve crisp aperture edges, stars, twin lower scallops, and independent `dayDeg` / `moonDeg` rotation.
- Do not replace it with a blurred gradient, soft dome, circular photo, fuzzy mask, or oversized moon.
- It remains the click target for book reviews.

### Typography

- Maker signature and complication numerals: Marcellus.
- Interface/body: Archivo.
- Technical labels and captions: IBM Plex Mono.
- Preserve generous maker-signature tracking and small, restrained utility copy.

## Approved interaction map

| Watch part | Portfolio action |
| --- | --- |
| Hours/minutes dial | About |
| Outsize date | Featured work |
| Small seconds | Currently |
| Power reserve | Experience / resume |
| Moonphase | Book reviews |
| Crown at 3 o'clock | Flip to the movement display back |
| Corrector at 10 o'clock | Request a review |
| Escape key | Close active panel |

Keep the default `panel` transition. When content opens, the watch moves left and remains visible at a reduced scale while the content panel occupies the right side. Do not cover the watch with a giant blurred overlay. `zoom` and `takeover` may remain optional component properties, but they are not the default.

## Approved assembly animation

The loader clears first, then the watch assembles visibly in a mechanical order:

1. Outer case blank seats into place.
2. Bezel and rehaut seat inside it.
3. Navy dial drops into the case.
4. Hours/minutes, outsize date, small seconds/moonphase, and power-reserve groups arrive.
5. Maker signature and technical line appear.
6. Hands wind into position.
7. Crown and ten-o'clock corrector seat into the case.
8. Sapphire crystal closes the stack.
9. Interaction hints appear only after assembly is complete.

The full sequence is roughly 3.7 seconds. Preserve `prefers-reduced-motion`; it collapses animation and transition durations to near instant.

Motion must explain assembly, mechanical function, panel navigation, or depth. Do not add ambient floating, random parallax, neon glow, continuous camera drift, or ornamental loops.

## Live behavior to preserve

- Real local hour and minute hands.
- Mechanical six-beat seconds motion by default, with quartz and smooth component options retained.
- Live local date in the outsize-date window.
- Astronomical moon age based on the existing synodic calculation.
- Time-of-day rotation for the day/night disc.
- Rotating “currently” text.
- Crown flip to the sapphire display back with the living overlay rig: five real part sprites turn over the wheel-less base (stepped seconds wheel, centre wheel, third wheel, one-tooth-per-beat escape wheel) and the screwed balance swings ±28° at 2.5 Hz, all under static bridge/cock cutouts so nothing crosses bridgework. Regenerate assets with `python3 tools/build-caseback-overlay.py` and the markup with `node tools/generate-rig-markup.mjs` (paste into the `.cb-rig` block; never hand-edit it). The SVG movement generators (`generate-movement.mjs`/`update-movement.mjs`) feed only the 3D lab.
- Hover captions and optional interaction hints.
- Request-review modal and its watch/book selection.
- Resume scroll updating the power-reserve indicator.

## Editing workflow Claude must follow

1. Read this file and `WATCH_DESIGN_BIBLE.md` completely.
2. Run the unchanged page and capture a baseline screenshot.
3. Identify the single component involved in the request.
4. Compare that component against the supplied visual references; use official Lange sources when extra mechanical detail is needed.
5. State the exact measured property being changed: position, proportion, tangent, radius, color, depth, or timing.
6. Edit only the smallest relevant section of `index.html`, `src/styles.css`, or `src/main.js`.
7. Render the result at desktop size and inspect it visually.
8. Verify the affected click/hover/keyboard behavior.
9. Check a narrow/mobile viewport when the change can affect layout.
10. Run a syntax/diff check and summarize the exact change.

Do not make unrelated “improvements” during a precision correction. If the request concerns the moonphase, do not alter the case or corrector. If it concerns the corrector, do not alter the moonphase, dial, panel system, or assembly animation.

## Regression checklist

Before returning any revision, confirm all of these:

- [ ] Watch remains centered and fully visible when no panel is open.
- [ ] Case remains gold and dial remains ink navy.
- [ ] Corrector is short, curved, symmetrical, flush, and clickable.
- [ ] Moonphase is crisp, aligned, and clickable.
- [ ] Crown flips the watch and can flip it back.
- [ ] Each complication opens the correct content.
- [ ] Default content treatment is the restrained right-side panel.
- [ ] Assembly plays in the approved order after reload.
- [ ] Hint dots do not appear before assembly finishes.
- [ ] Reduced-motion behavior remains intact.
- [ ] No strap has been added.
- [ ] No reference image is being shown as a substitute for the interactive watch.

## Reference research

When an official product detail is ambiguous, prioritize A. Lange & Söhne's own material:

- Product: `https://www.alange-soehne.com/us-en/timepieces/lange-1/lange-1-moon-phase/lange-1-moon-phase-in-750-pink-gold-192-032`
- Press material: `https://press.alange-soehne.com/lange-1-moon-phase/`

Use those references to understand construction and proportion. Do not copy brand text, logos, or protected imagery into the personal interface.

