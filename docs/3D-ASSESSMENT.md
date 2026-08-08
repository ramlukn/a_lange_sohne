# Making the watch 3D — feasibility assessment

> **Merged (2026-08-07):** this document's recommendations now live inside
> `docs/SITE-DIRECTION.md` §8, which phases the pointer tilt and closes four of
> the six open questions in §8 below (tilt vs. the "no ambient motion" rule: yes,
> pointer-driven only; tilt behind an open panel: off; touch: nothing, no
> `deviceorientation`; the three.js lab: delete — it no longer even runs, since
> `three` is in `package.json` but not installed and `npx vite` fails its
> dependency scan on it). Only the clamp angle is still open. The research and
> measurements below stand as taken; read §8 there rather than §8 here.

> "Look into making the watch 3d ish. Will it look good. Is it possible?"

A research document. **No application code was written or changed.** Everything below
is measured against the tree at `96ea245`, in a browser at 900×760, with real build
output and real GPU counters. Where I quote a number, it is one I took, not one I
remember.

---

## The short answer

**Is it possible?** Yes — three different ways, at wildly different prices. One of them
is already half-built and shipping.

**Will it look good?** That depends entirely on which one, and the ranking is the
opposite of what "more 3D = more impressive" would suggest:

| | Verdict |
| --- | --- |
| Tilt/parallax on the **existing CSS 3D rig** | **Already looks good.** I tested it. See §3. |
| A real-time **three.js** watch | **Currently looks bad, and would take weeks to stop.** See §2. |
| Pre-rendered turntable | Would look excellent; there is no 3D model to render, and it costs megabytes. |
| Targeted upgrades (date aperture, hands lift) | Small, cheap, and the highest quality-per-hour on the list. |

The headline finding is that **the watch is already a real 3D object** — much more so
than the framing "pseudo-3D" suggests. What it is missing is not geometry. It is
*motion* that lets you see the geometry. Almost nobody who visits this site ever sees
the case band, because the only thing that rotates the watch is the flip, and the flip
is over in 1.15 seconds.

That is the actual gap, and it is about half a day of work to close.

---

## 1. What "3D-ish" could mean here

Four options, roughly in ascending order of cost.

**(a) Pointer-driven tilt on the existing sprite stack.** The watch already lives inside
`perspective: 2400px` with `preserve-3d` on `.watch-pose` and `.watch-flip`. Add a
small, damped `rotateY`/`rotateX` that follows the pointer. Nothing is rebuilt; a
transform gets a second input. Half a day.

**(b) A real-time WebGL/three.js watch.** Replace the sprite stack with meshes and PBR
materials. This is the `lab-3d.html` experiment. Weeks, and see §2.

**(c) Pre-rendered 3D baked into a sprite sequence or video.** Model the watch properly
offline, render a turntable, scrub the frames on pointer/scroll. Runtime stays trivial;
quality is whatever your renderer can do. But you still have to model the watch first —
so this carries (b)'s asset cost without (b)'s runtime risk.

**(d) Targeted upgrades.** Give one part real depth and leave everything else alone.
Notably, **this has already happened once and it worked**: commit `f2c7e72` added
`--case-depth: 6vmin` and the 48-segment `.case-edge` band, and that band is the single
most convincing piece of 3D on the site.

The phrasing "3d ish" reads to me as asking for (a)/(d) rather than (b). The evidence
below says that instinct is correct.

---

## 2. The prior art: I ran `lab-3d.html` and looked at it

This is the most useful thing in the repo for answering the question, so it gets the
most space. Its own header comment says *"Same source of truth as the SVG caseback;
judge, then decide."* So: judged.

### What it is

`src/lab3d.js` is 207 lines. It loads `src/movement-3d.json` (12 extruded shapes, 9
wheels, a column wheel, a balance, a 241-point hairspring spiral, 13 jewels, 4 chatons,
28 screws), converts the SVG path data to `THREE.Shape`s via `SVGLoader`, extrudes them,
and lights the result with a `RoomEnvironment` PMREM probe plus a directional key from
the upper-left — correctly following the design bible's 315°. It has ACES tone mapping,
soft shadows, seven PBR materials, and pointer parallax. It is competent code. It is not
a stub.

### How it looks

Honestly: **it looks like a plastic toy.** Specifically, what I saw on screen:

- **The main plate is visibly a polygon.** You can count roughly twenty straight chords
  around what should be a circle. This is `curveSegments: 10` in the `ExtrudeGeometry`
  options — a one-character fix, and I flag it as such so the rest of this section is
  read as fair.
- **The wheels have no teeth.** The comment says "toothed rim via short cylinder"; it is
  literally a smooth `CylinderGeometry`. Every gear is a plain disc.
- **There is no surface finishing at all.** No perlage, no Glashütte ribbing, no
  engraving, no chamfered and polished anglage on the bridge edges. The bridges are
  cream-coloured rounded blobs. Finishing is the entire point of a Glashütte movement.
- **The jewels read as gumdrops** — red spheres squashed to `scale.z = 0.55`.
- **The blued screws are flat blue dots.** The slot is a thin box that mostly doesn't
  resolve at this size.
- **The balance and hairspring, bottom left, read as a vinyl record**: concentric blue
  rings in a black cavity inside a gold ring.
- **There is no case, no bezel and no crystal.** A movement floats on a dark field.
- The key light *does* read from the upper left, with a soft shadow falling to the lower
  right. That part is right. But the ACES + room-probe result is a washed, plasticky
  cream, not nickel silver.
- Pointer parallax works, and it does genuinely communicate depth. Tilted, the bridges
  lift off the plate convincingly. **That mechanism is the good idea in this file**, and
  it is exactly the mechanism option (a) proposes to reuse — in CSS, for free.

### The comparison that settles it

The lab and the shipped caseback **depict the same movement**. I put them side by side.

The shipped caseback — the v4 overlay rig, pre-rendered part sprites composited over a
base render — has real gear teeth, a hand-engraved balance cock, blued screws with
readable slots, rubies seated in gold chatons, `VIERZIG (40) RUBINE` engraved on the
bridge, Glashütte ribbing, perlage, and a serial number. It is not close. The sprite
version wins by an enormous margin.

That is the whole argument in one image pair: **on this specific subject, on this
specific site, pre-rendered compositing already beats real-time WebGL by a distance that
weeks of shader work would be needed to close.**

### Why it stalled

Git history is unambiguous. `lab-3d.html`, `src/lab3d.js`, `src/movement-3d.json` and
the `three` dependency were **all added in a single commit, `f2c7e72` (4 Aug 2026), and
never touched again.** That is 110 commits ago.

More telling: `f2c7e72` is *also* the commit that introduced `--case-depth` and the
48-segment CSS case band. The author built both approaches in the same sitting, shipped
the CSS one, and left the three.js one in a lab. **The decision has already been made
once, implicitly.**

There is a second, quieter reason it is dead. `movement-3d.json` is written by
`tools/generate-movement.mjs`, and `docs/HANDOFF.md` calls that the *retired* SVG
movement generator which "feeds only the 3D lab". The shipped caseback has since moved
to the v4 overlay rig built from user-supplied part renders. So the lab's input is a
retired pipeline describing a movement the site no longer draws. **It is a dead branch
off a dead branch.**

One more thing worth surfacing, because it bears directly on the question being asked.
`docs/HANDOFF.md` line 33 reads:

> Do not convert it to React, Vue, Canvas, Three.js, or an image unless specifically
> requested.

This question *is* that request, so nothing is being violated by asking. But it means
the project's own standing instruction points away from (b), and any decision to pursue
it should update that line rather than quietly contradict it.

---

## 3. Will it look good? The seams, named

### What I actually tested

I froze the existing rig at two tilt angles and looked:

**At `rotateY(24°) rotateX(-10°)`** — the magnitude a pointer parallax would use — it
looks **genuinely, convincingly three-dimensional**. The case band appears down the left
side as a solid gold cylinder. The bezel reads as a ring with real thickness. The dial
recedes correctly. I could not find a tell.

**At `rotateY(48°) rotateX(-22°)`** — well past anything you would ship — it *still*
holds up, and the tells that appear are all specific and all fixable:

- The **outsize date** shows no aperture thickness. It is the flattest thing on the dial
  at an angle, and it should be the deepest — it is a window cut through the dial.
- The **moonphase** is a flat disc. No aperture step, no lift on the gold moons.
- The **hands do not lift off the dial** and their shadows do not move. In a real watch
  at 24° the hands separate visibly and throw a shadow to the lower right.
- The **10 o'clock corrector** reads as a tab floating slightly off the case.
- **There is no crystal edge.** A sapphire crystal at 48° would show a thick glass wall.

**At `rotateY(112°)`** — mid-flip — the 48-segment band is genuinely excellent. It reads
as a solid machined gold cylinder; the per-segment brightness ramp does its job, and the
seams between facets read almost as a brushed texture rather than as facets. The one
weakness is that the caseback face behind it is a flat plane, so at a steep angle the
movement reads as printed on a disc. Nobody sees this at 1.15 seconds.

### The one seam that genuinely constrains this

**The dial's sunburst is baked, and a sunburst is a view-dependent effect.**

`main-dial.webp` is 1200×1200 of rendered art with the brilliance axis fixed. On the
real object, rotating the watch sweeps that bright axis across the dial — that sweep
*is* the sunburst finish. A baked one cannot sweep. So as tilt grows, the dial slides
from "sunburst dial" toward "photograph of a sunburst dial", and past some angle it
reads as a printed sticker in a real gold case.

At 24° I could not see this. At 48° I could start to argue about it. **That angle is the
budget, and it is the number the user should set with their own eyes.**

The same argument is fatal to option (b) in its mixed form. A real-time PBR case next to
a baked-lit sprite dial will disagree at every single specular. The lab's washed ACES
cream and the dial art's warm rose gold are already visibly *different metals*. Mixing
them would look worse than either alone — which is exactly the risk the brief named, and
it is real.

### The bar the current look sets

The front face is very good: a deep sunburst navy dial, warm rose-gold case with a soft
315° specular band, crisp gold indices, Marcellus wordmark at generous tracking. It
looks like a photograph of an instrument. **Any option that risks that has to be clearly
better, not merely more technically impressive.** Option (b), on today's evidence,
starts out clearly worse.

---

## 4. Is it possible? Measured costs

### Bundle size — the numbers are stark

Two real production builds:

| Build | Minified | **Gzipped** |
| --- | --- | --- |
| Current site (`index.html` + CSS + JS) | 103 kB | **25.8 kB** |
| `lab-3d.html` (three.js + SVGLoader + RoomEnvironment + geometry) | 601 kB | **158.8 kB** |

three.js adds **+133 kB gzipped — 6.1× the entire current code payload**, and that is
*after* tree-shaking, importing only what the lab uses. A minimal three.js core scene
without the loaders is still around 110–120 kB gzipped. There is no version of this that
is cheap.

**But the honest caveat**, because the "24 kB site" framing is misleading:
`public/assets` is **4.5 MB** — 4.0 MB of caseback (`base.webp` alone is 1.4 MB, the
lossless composite another 1.4 MB) and 452 kB of dial art. The site is light in *code*
and heavy in *images*.

That cuts both ways. It means +133 kB is not the dominant byte cost — but it also means
+133 kB of **blocking, parse-and-compile main-thread JavaScript** lands on a page whose
image budget is already strained. I watched the caseback base image pop in visibly black
mid-flip against a warm *local* dev server. That is the existing budget talking.

### Runtime cost

Instrumented via a patched `gl.drawElements` on an M2 Pro at 900×760:

- **~114 meshes → roughly 230–285 draw calls per rendered frame**, and **~59,000
  triangles submitted per frame.** That includes a second full pass for the shadow map.
- **~1 ms CPU submit time per frame.** On desktop this is nothing.
- The expensive part is a **2048×2048 PCF-soft shadow map re-rendered every frame**,
  even though the scene is completely static apart from the balance wheel. On a
  mid-range Android that is the difference between an idle page and a page that warms
  the phone in your hand. It is also trivially avoidable — but it is a good illustration
  of how much *tuning* a real-time watch needs before it is polite on mobile.

### No-WebGL fallback — the argument I find most decisive

WebGL is unavailable on roughly 0.5% of traffic: locked-down corporate machines, Safari
with hardware acceleration disabled, some older Android, and anyone with a blocklisted
driver.

Under option (b), those visitors need a fallback — which means **the current CSS watch
has to keep existing and keep being maintained.** So (b) does not *replace* the current
implementation. It *adds a second one*, and commits the project to keeping two watches
visually in sync forever, on a site where the design bible records measurements to two
decimal places. That is an ongoing tax, not a one-time cost, and it is the thing I would
push back hardest on.

### Effort, honestly

| Option | Effort | Confidence |
| --- | --- | --- |
| (a) Pointer tilt on existing rig | **0.5 day** | High — I tested the output |
| (d) Date aperture depth + hands lift-off | **0.5–1 day** | High |
| (c) Pre-rendered turntable | 1–3 weeks (mostly modelling) | Low — no source model exists |
| (b) Real-time three.js at parity | **3–6 weeks**, parity not guaranteed | Low |

The (b) estimate is not padding. To beat the current dial you need an anisotropic
sunburst BRDF, real involute gear teeth, polished anglage, perlage and engraving normal
maps, an HDRI matched to the 315° key, and a sapphire crystal with correct IOR and
AR-coating tint. That is a full CG lookdev job, and the lab is what one pass without any
of it looks like.

### Is `movement-3d.json` a head start?

**No — it is a dead end, and this matters.** It is a *2D vector description* of a
movement the site no longer draws, emitted by a retired generator. Extruding flat SVG
paths gives you flat-topped slabs; it cannot give you a domed jewel setting, a chamfered
bridge edge, or a tooth profile. Those need real modelling. The file is a head start on
*layout*, and layout is the part the project has already solved twice over.

---

## 5. Interaction consequences

I tested this rather than reasoning about it, and the result is clean.

**Under CSS tilt, DOM hit-testing is completely unaffected.** I probed all five hit
targets with `elementFromPoint` at their visual centres, flat and at
`rotateY(48°) rotateX(-22°)`:

```
flat:   aboutHit OK   dateWindow OK   secondsDial OK   reserve OK   moon OK
tilted: aboutHit OK   dateWindow OK   secondsDial OK   reserve OK   moon OK
```

Identical. The browser hit-tests through 3D transforms correctly. `:hover`,
`cursor: pointer`, `:focus-visible`, `aria-label` and screen readers all keep working
because the parts are still DOM nodes. **Option (a) costs nothing here.**

**Under real 3D (option b) you lose all of it.** Five `<div>`s become five meshes behind
one `<canvas>`. You need raycasting for hover and click, and hand-built hover-enter and
hover-leave bookkeeping to replace `mouseenter`/`mouseleave`. Assistive technology sees
a blank canvas.

The accessibility angle deserves precision, because the obvious version of it is wrong.
The site has **zero `tabindex` attributes** — confirmed by grep — so nothing on the watch
is keyboard reachable today. So 3D would not *break* keyboard access; there is none to
break.

What it would break is **how cheap the fix currently is.** Today, fixing it means making
five `<div>`s into `<button>`s with labels — roughly twenty lines, an afternoon, and it
is already written up as Phase 0 in `docs/SITE-DIRECTION.md`. Under WebGL it becomes
"build and maintain an invisible accessible proxy DOM mirroring the scene graph" — days
of work, easy to get subtly wrong, and permanently in the way.

**So: 3D makes accessibility worse — not by removing something, but by pricing the fix
out of reach right before it was about to be made.** Given that `SITE-DIRECTION.md` puts
that fix in the very next phase, the sequencing matters.

---

## 6. Recommendation

### Do option (a), plus two items from (d). About 1–1.5 days.

**1. Pointer-driven tilt.** A damped `rotateY`/`rotateX` on the watch following the
pointer, clamped to roughly ±8–12°, springing back to zero when the pointer leaves the
stage. This is the whole ask: it makes the case band, the bezel thickness and the dial
recession *visible*, which they currently are not.

Two implementation notes worth knowing before starting:

- `src/main.js:221` writes `el.flip.style.transform` directly on every `render()` tick
  (10 Hz), and `.watch-pose` owns the panel pose. **Tilt must not fight either.** It
  wants its own layer inside `.watch-stage`, not a fourth writer on an existing one.
- Both existing transform layers carry ~1 s CSS transitions. A pointer tilt on either
  would lag badly. The tilt layer needs **no CSS transition** and rAF damping instead —
  the same lerp the lab already uses (`+= (target - current) * 0.06`).

**2. Give the outsize date its aperture depth.** It is the flattest thing on the dial
under tilt and should be the deepest — it is a hole cut through the dial. A frame with
`translateZ` and an inner shadow.

**3. Lift the hands off the dial.** A small `translateZ` plus a soft offset shadow.
This is the single cheapest change on the entire list that makes a watch look real, and
it pays off even at zero tilt.

### Cheapest viable version

**Just item 1, clamped to ±8°.** Half a day, one new element, no asset work, reversible
in a single revert. If it does not land, nothing else was disturbed.

### Rough effort and the single biggest risk

Effort: 1–1.5 days for all three; half a day for the cheapest version.

**Biggest risk: the baked sunburst** (§3). Past some tilt angle the dial stops reading as
brushed metal and starts reading as a printed image. Mitigation is structural, not
clever — **make the clamp a single CSS variable and judge it on a screenshot at maximum
tilt, with the dial's bright axis pointing the wrong way.** If it reads as a sticker,
turn the number down. The recommendation is safe precisely because its main risk is
controlled by one tunable number.

**Second risk, smaller but real:** `docs/DESIGN_BIBLE.md` says *"Every motion must
explain function or depth. No ambient floating, glow, or ornamental looping."* A
pointer-driven tilt explains depth, so I read it as permitted — but it must be
**pointer-driven only**, never an idle drift, and it must settle to exactly zero at rest.
That is the user's rule and their call (see open question 3).

### What I recommend against

**Option (b), a real-time three.js watch.** Three to six weeks to *maybe* reach parity
with art that already exists, a 6× code payload increase, a permanent second
implementation to maintain for the no-WebGL fallback, and the loss of DOM interaction
and the cheap accessibility fix. The lab is the evidence: it is competent code and it
still lost badly to the sprite caseback of the same movement.

**Option (c)** I would keep on the shelf rather than reject. It is the *right* answer if
a proper 3D model of this watch ever exists — and note the site already proves the
pattern works, since the caseback rig is pre-rendered parts composited at runtime. But
there is no model today; the dial and caseback art were produced externally, and
`movement-3d.json` is not one. So (c) currently carries all of (b)'s asset cost. Revisit
it only if a model appears.

---

## 7. Verdict on the prior art

### Delete `lab-3d.html` and `src/lab3d.js`, and drop `three` from `package.json`.

1. **It answered its own question.** The header says "judge, then decide." I judged: it
   loses decisively to the shipped caseback of the same movement. Keeping a lab whose
   verdict is in is just keeping the verdict unwritten.
2. **Its input pipeline is already retired.** `movement-3d.json` comes from
   `tools/generate-movement.mjs`, which `HANDOFF.md` documents as feeding only this lab.
   Deleting the lab also frees `generate-movement.mjs` (45 kB), `update-movement.mjs`,
   `tools/movement.svg` (67 kB) and `movement-3d.json` — roughly 130 kB of tooling that
   describes a movement the site no longer draws.
3. **The dependency costs more than bytes.** Nothing in the shipped site imports `three`,
   so it adds nothing to the bundle. But it is 25 MB in `node_modules`, it shows up in
   every audit and dependabot pass, and — most expensively — **it signals to the next
   agent that three.js is a sanctioned direction for this project.** `HANDOFF.md` says
   the opposite. That contradiction will cost someone a day eventually.
4. **Git keeps it.** `git show f2c7e72:src/lab3d.js` restores it in one command. That is
   the entire safety argument, and it is sufficient.

### The counter-argument, stated fairly

The lab is ~200 lines of *working* harness — SVG-to-extrude, PBR materials, a PMREM
environment probe, shadowing, pointer parallax — and it took real effort. If the answer
to "might we want a genuinely 3D watch in a year?" is *yes*, rebuilding that harness is
a day of work, and keeping it costs only a `package.json` line and disk space.

So: **delete if full 3D is a no or a not-soon. Quarantine if you want to preserve
optionality** — move both files to `experiments/` with a two-line README saying "judged
against the sprite caseback and not pursued; see docs/3D-ASSESSMENT.md", and keep
`three` as a `devDependency` so it is visibly not shipping.

I lean delete, because the misleading signal to future contributors is the largest cost
here and quarantining only half-fixes it. But this is a genuine trade and it is
reversible either way, so it is worth thirty seconds of the user's opinion rather than
my picking for them. See open question 4.

---

## 8. Open questions for you

1. **Tilt clamp — how far?** I would start at ±10° and it needs your eye at maximum
   tilt, because the limit is aesthetic (when does the baked sunburst read as a sticker?)
   and not technical.
2. **Touch devices have no pointer.** Options: nothing (tilt is a desktop nicety, the
   flip stays the touch interaction); a drag-to-turn gesture; or `deviceorientation`,
   which on iOS requires an explicit permission prompt. I lean **nothing** — a permission
   dialog for a decorative tilt is a bad trade — but it means the improvement is
   desktop-only, and most portfolio traffic is mobile.
3. **Does pointer tilt violate your own "no ambient floating" rule?** I read it as
   permitted because it is pointer-driven and explains depth, but it is your rule and I
   would rather ask than assume.
4. **Delete the three.js lab, or quarantine it in `experiments/`?** §7. Hinges entirely
   on whether full 3D is permanently off the table or merely not now.
5. **Should tilt stay active while a content panel is open?** The watch is posed left at
   0.72 scale then. I lean **off** — the watch is context at that point, not the subject
   — but it is a taste call.
6. **`HANDOFF.md:33` currently forbids Three.js.** If the decision is to delete the lab,
   that line should be strengthened to record *why*, so this question does not get
   re-litigated from scratch in six months. If the decision is to keep the option open,
   that line should be softened. Either way it should stop being ambiguous.

---

## Appendix — how the numbers were obtained

- **Builds:** `npx vite build` for the baseline; a scratch Vite config with
  `rollupOptions.input` pointing at `lab-3d.html` for the lab. Both figures are Vite's
  own reported gzip sizes.
- **Draw calls / triangles:** monkey-patched `gl.drawElements` on the lab's WebGL2
  context, counting calls and `count / 3`, with frame boundaries detected from >4 ms gaps
  in call timestamps. GPU reported as `ANGLE (Apple, ANGLE Metal Renderer: Apple M2
  Pro)`. FPS was *not* measured — the browser pane throttles `requestAnimationFrame`
  when backgrounded, so any figure would have been meaningless. CPU submit time is
  reliable; a real mobile FPS number would need a real device.
- **Tilt tests:** intervals cleared to stop `render()` overwriting the transform, then
  `transform` set with `!important` on `#watchFlip` at 24°/−10°, 48°/−22° and 112°.
- **Hit-testing:** `document.elementFromPoint` at each target's bounding-box centre,
  probed flat and tilted in the same tick, with the transform removed afterwards.
- **Asset sizes:** `du -sh public/assets` and PIL for image dimensions.
- Dev server on `:8824`, killed afterwards. No tracked file other than this document was
  modified.
