# Site direction — from watch toy to personal website

A design plan, not an implementation. Nothing in `index.html`, `src/styles.css`,
`src/main.js` or `tools/**` has been touched. Read it, argue with it, and mark up
the open decisions at the end; those are the things that need your call before
any code is written.

Everything below is grounded in the tree at `3604464`. Where I quote a selector,
a number or a line, it is the real one.

---

## 1. What is actually there today

Worth being precise about, because most of the recommendations fall out of it.

**The shell.** `.stage` is a flex column, `min-height:100vh`, `overflow:hidden`,
centred. Inside it: `.loader`, then `.watch-stage` (`86vmin × 86vmin`,
`perspective: 2400px`), then `.caption` (`height:5vmin`), then `.hint-bar`
(absolutely positioned, `bottom:2.6vmin`, `font-size:1.05vmin`), then the
`.overlay` panel layer (`position:fixed; z-index:40`) and the `.req-layer`
modal (`z-index:60`).

**The state machine.** `src/main.js` is better structured than it looks. `state`
is a flat object, `render()` paints *every* piece of UI from it — pose, flip,
hands, panels, hints, request layer — and it is idempotent. It runs from
`setInterval(render, 100)` plus a direct call on every event handler. (The brief
described it as a `requestAnimationFrame` loop; it is a 10 Hz interval. That
does not change any conclusion, but it does mean there is headroom: adding a nav
bar to `render()` costs nothing.)

That one-way `state → render()` flow is the single most valuable thing in the
codebase for this project. **A navigation rail is not new machinery. It is a
second view of `state.active`, painted by the same function that already paints
the panels.** Every recommendation about navigation sync in this document is
that sentence, elaborated.

**The five bindings.**

```js
bind($('aboutHit'),    'about');     // hours dial
bind($('dateWindow'),  'featured');  // outsize date
bind($('secondsDial'), 'currently'); // small seconds
bind($('reserve'),     'resume');    // power reserve
bind($('moon'),        'books');     // moonphase
```

`bind()` wires `click → open(id)` plus `mouseenter/mouseleave → state.hover`.
`#crown` and `#corrector` are wired by hand alongside.

**Five parallel lists that all describe the same five things.** `CAPTIONS`,
`ZOOM_ORIGINS`, the five `bind()` calls, the five hard-coded `.hint-dot`
positions in `index.html` (`left:31.3%;top:54%` etc.), and the literal text of
`#hintBar`. Change one section and you edit five places in two files. This is the
first thing to fix, and it is invisible to the user.

**Things I verified in the browser** (Vite on :8814, 900×760 and 390×800):

- There are **no media queries at all** except `@media (prefers-reduced-motion)`.
  The whole layout is `vmin`, which scales but does not reflow.
- At 900px wide the "watch stays visible on the left" promise is already broken:
  `translateX(-28vw) scale(.72)` plus a `min(720px, 92vw)` card leaves a ~30px
  sliver of case. The intended composition only holds somewhere north of 1400px.
- At 390px the panel is a near-fullscreen sheet whose only close affordance is
  `ESC ✕` — and phones have no Escape key. Browser Back exits the site.
- `.hint-dot` is `width: .8%` of the 86vmin stage: **5px at desktop, 2.7px on a
  phone**, at 58% opacity. In the 900×760 screenshot they are essentially
  invisible. They are not blunt; they are inaudible.
- `.hint-bar` at `1.05vmin` is a **4px** font on a 390px phone. Illegible.
- `state.touched` is set by *any* click including the crown, and never persists,
  so the hints vanish after the first interaction and return on every reload.
- Hover state can stick: if the pointer leaves a hit target without a
  `mouseleave` (jump, scroll, tab-out), the caption keeps the old text. Minor,
  but it will get worse once nav also writes `state.hover`.
- All five hit targets do have `cursor:pointer`. Good.
- None of them are focusable. They are `div`s with no `role` and no `tabindex`,
  so **no content on this site is reachable by keyboard at all.**

**Two different hover vocabularies.** This matters more than it sounds:

```css
.about-hit:hover    { box-shadow: 0 0 0 .25vmin rgba(240,200,150,.52); }  /* outline */
.date-window:hover  { box-shadow: 0 0 0 .25vmin rgba(240,200,150,.55); }  /* outline */
.seconds-dial:hover { box-shadow: ... 0 0 0 .25vmin rgba(240,200,150,.55); } /* outline */
.reserve:hover .reserve-scale { filter: brightness(1.14); }               /* light */
.moon:hover         { filter: brightness(1.08); }                         /* light */
.crown:hover        { filter: brightness(1.2); }                          /* light */
```

The first three draw a UI ring *around an object*. The last three make *light
fall on metal*. The second idiom is the correct one for this site and the first
is the one that makes it feel like a web page with hotspots. Unifying on light
is a small diff with a large effect on how "instrument" it feels.

---

## 2. Navigation

### Recommendation: a left vertical **index rail**, built as a scale, not a menu

Not a top bar. Three reasons, all geometric:

1. **Vertical space is the scarce axis; horizontal is the surplus.** At 1440×900,
   `vmin` is 900, so the watch is 774px: ~333px of horizontal slack against ~126px
   of vertical. A top bar spends the scarce axis and forces the watch smaller. A
   left rail spends the plentiful one and costs the watch nothing.
2. **A full-width bar across the top of a centred circular object is exactly the
   composition that reads "template with a widget in it."** It is the single most
   dangerous shape available here. A vertical rail hugging the left margin reads
   as a scale beside an instrument.
3. **The dial already carries the wordmark.** `.maker-name` says NIKHIL RAMLUKAN
   in Marcellus at generous tracking. A top bar's canonical left slot is a logo —
   which would repeat the name and cheapen both. The rail has no logo slot, which
   is a feature.

### Shape

Five to seven index marks stacked in the left margin. Each is a hairline gold
rule plus a mono micro-cap label, drawn from tokens already in `:root`
(`--gold-line: #c98662`, `--gold-line-hover: #efc1a0`, `--font-mono`,
`letter-spacing: .24em` as on `.hint-bar`). The active item carries a small gold
pointer — the same gesture as the power-reserve hand against the AUF/AB scale.
No boxes, no pills, no filled buttons, no icons, no underlines.

```html
<nav class="rail" id="rail" aria-label="Sections">
  <a class="rail-item is-on" href="#/about"><i class="rail-tick"></i><span>ABOUT</span></a>
  <a class="rail-item"       href="#/work"><i class="rail-tick"></i><span>WORK</span></a>
  ...
</nav>
```

```css
.rail { position: fixed; left: 0; top: 50%; translate: 0 -50%;
        width: var(--rail-w, 156px); z-index: 50;
        opacity: .55; transition: opacity .3s; }
.rail:hover, .rail:focus-within { opacity: 1; }
.rail-tick { width: 14px; height: 1px; background: var(--gold-line); opacity: .5; }
.rail-item.is-on .rail-tick { width: 30px; opacity: 1; }
```

`z-index: 50` deliberately: above `.overlay` (40) so you can move section to
section without closing first, below `.req-layer` (60) which is a true modal.

### Making room for it — the one structural change

`.stage` becomes a grid shell instead of a flex column:

```css
.stage { display: grid; grid-template-columns: var(--rail-w, 0px) 1fr; }
```

The watch centres in column 2, so the rail displaces rather than overlaps, and
"nothing overlaps the case circle" becomes structural rather than lucky. The
`.overlay` panel layer is confined to column 2 as well, which keeps
`translateX(-28vw)` meaning what it means today.

**Risk to watch for:** `.watch-stage` carries `perspective: 2400px` and its
children `transform-style: preserve-3d`. Grid cells are fine as long as
`.watch-stage` stays a plain block child of the cell and no grid property lands
on the transformed subtree. This needs a real flip test on Chrome and Safari
before Phase 1 ships. It is the only place in this plan where the 3D rig could
break.

### Narrow viewports

Below ~1100px the rail should **overlay rather than displace** (`--rail-w: 0px`,
rail floats at 55% opacity over the empty left margin) — otherwise the watch
loses too much diameter.

Below ~720px the rail becomes a **horizontal scale pinned to the bottom**, above
the safe-area inset, in thumb reach. And here is the cheap insight:

> **`#hintBar` already is the mobile nav.** It reads
> `DIAL · DATE · SECONDS · RESERVE · MOON — CLICK TO EXPLORE · CROWN TO FLIP`.
> That is a five-item index rendered as inert 4px text. Making it live is one of
> the smallest possible diffs with one of the largest effects, and it removes an
> element that is currently illegible on the device where it matters most.

So: one `SECTIONS` array renders the desktop rail *and* the mobile bar *and* the
`bind()` calls *and* `CAPTIONS`. One list, three views.

### The watch stays the hero

Recommendation: the watch remains a permanent, persistent hero and sections stay
overlays over it. Do not convert this into a scrolling page with the watch as
section 0. The cost of scrolling is high and specific: `.stage` is
`overflow:hidden` by design, `.overlay` is `position:fixed`, the 3D flip depends
on a stable `perspective` container, and the assembly choreography assumes the
watch is the thing on screen at t=0. You would be re-founding the layout to gain
a convention this site does not need at five to seven sections.

If you *want* the scroll site anyway — because it reads as more "real" — say so
now, because it changes Phase 0 rather than being bolted on later. See open
decision 1.

### Keeping nav and watch in sync

They already share `state.active`; the rail just calls `open(id)`. The
interesting part is the reverse direction:

**Hovering a rail item should light the corresponding watch part, and vice
versa.** `state.hover` already drives `CAPTIONS`; extend it to also toggle an
`.is-cued` class on the bound node. Hover ABOUT in the rail and the hours dial
glows. Hover the hours dial and ABOUT lights in the rail.

This is the hinge of the whole plan. It makes the rail *teach the watch*: a
first-time visitor who uses the conventional nav is shown, without a single
tooltip, that the watch is the same navigation. Which means section 3's job gets
much easier, and the watch's own signalling is free to be subtle.

---

## 3. Signalling that the watch is tappable

The bar is precision instrumentation, not tooltips. Four moves, in order of
importance.

### 3.1 Retire `.hint-dots`; replace with an index sweep

Five 3px dots pulsing on infinite loops are both invisible *and* in tension with
the design bible's own rule ("no ambient floating, glow, or ornamental looping").
They also duplicate the hit geometry as hard-coded percentages that will drift
the next time a complication moves.

Replace with a **one-shot index sweep**, fired once after assembly completes
(~3.7s): a narrow specular band travels across the crystal, and as it passes each
interactive part, that part's rim brightens for ~200ms in turn — dial, date,
reserve, seconds, moon, in the order the rail lists them.

This is not a new invention: `cbRigSheen` already does exactly this on the
caseback.

```css
@keyframes cbRigSheen {
  from { transform: translateX(-38%); opacity: 0; }
  15%  { opacity: 1; }  85% { opacity: 1; }
  to   { transform: translateX(38%); opacity: 0; }
}
```

Reusing an already-approved mechanism means it will read as the same object under
the same 315° key light, and it explains something (which parts are live) rather
than decorating. It happens once, then the watch is just a watch.

### 3.2 Unify the steady-state hover on the light idiom

Drop the three `box-shadow: 0 0 0 .25vmin` outline rules. Replace with a
brightness lift on the part plus a hairline arc on the **rehaut** — the dark ring
already present in the case stack at `inset: 3.55%` — rather than a ring around
the part itself. The dial furniture stays untouched; only the light changes. A
sketch of the direction:

```css
.hit { transition: filter .25s; }
.hit:hover, .hit.is-cued { filter: brightness(1.12) saturate(1.04); }
.hit:hover  ~ .rehaut-cue { opacity: 1; }  /* short gold arc at that bearing */
```

Also collapse five bespoke selectors into one shared `.hit` class while you are
in there.

### 3.3 Touch: there is no hover, so say what happens instead

On a phone, `mouseenter` never fires, `CAPTIONS` never appear, `.hint-bar` is
4px, and the dots are 2.7px. Today, touch discovery is effectively zero. Fix:

- The **bottom rail is the primary affordance on touch.** The watch is the
  reward, not the only door.
- Tapping a rail item cues its watch part for ~600ms *before* the panel opens —
  the same `.is-cued` state hover would give, on a timer. That is how a touch
  user learns the mapping.
- The caption line, which is dead weight on touch, is driven by the rail's
  active/pressed item instead of by `state.hover`.
- Run the index sweep once on load, and once more if the user has been idle
  >8s without opening anything. One slow re-cue, one part at a time. Never a
  loop.

### 3.4 First visit vs returning

Persist a flag (`localStorage['nr.seen']`) and let `state.touched` initialise
from it.

- **First visit:** sweep plays; rail labels shown in full; caption explains.
- **Returning:** sweep suppressed; rail collapses to ticks with labels on hover;
  the watch is quiet.

Honest cost: someone who visited once six months ago gets the quiet version and
may not realise the watch is interactive. Mitigation is the rail — which they can
always see. This is only safe *because* the rail exists, which is why section 2
ships before section 3.

### 3.5 Keyboard (currently: nothing works)

Not glamorous but it is a correctness bug, and it is cheap while you are already
touching the hit targets. Make each one a `<button class="hit">` (or
`role="button" tabindex="0"`), give it an `aria-label` ("About — hours and
minutes dial"), and give `:focus-visible` the same light treatment as hover so
focus looks like part of the instrument rather than a browser outline. Arrow keys
move through the rail; Escape already closes.

---

## 4. Information architecture

### The structural constraint nobody has named yet

Every section is currently pinned to a complication. That is charming, and it is
also the thing that will block IA growth: adding a section means finding a watch
part for it, and a Lange 1 has about seven clickable features (dial, date,
reserve, seconds, moon, crown, pusher) before you start inventing hardware. The
handoff explicitly forbids inventing hardware.

**Recommendation: decouple them.** The rail is the complete index; the watch
carries the headline five. Sections without a complication (Contact, Writing)
simply appear in the rail and cue nothing on the dial. A soft asymmetry, honestly
signalled — rail items that own a complication show their tick in gold, those
that do not show it in grey. That is a small, legible rule, and it means IA can
grow without the watch having to.

### Proposed sections

| Section | Complication | Status |
| --- | --- | --- |
| About | hours dial | Keep. Needs real copy — currently lorem — and a real portrait; `.portrait` is a dashed placeholder. |
| Work | outsize date | Keep, but **needs depth**. Today it is three `.feature-row`s with no detail view. See below. |
| Writing | — (rail only) | **New.** Absent today. Books are reviews of *other people's* work; this is yours. |
| Reading | moonphase | Keep. Add the request-form link in its footer. |
| Experience | power reserve | Keep. The scroll-winds-the-reserve gag is the best interaction on the site — do not touch it. Add a downloadable CV so it functions as one. |
| Currently | small seconds | Demote — see below. |
| Contact | caseback | **New.** See below. |

### Work needs a second level

Three lines of text is a list of things you did, not a portfolio. A real personal
site needs one project you can read for two minutes. Recommended pattern: the
card holds the list; clicking a row expands a detail *in place* within the same
card (push/pop, keeping the watch pose). That avoids a second overlay layer and
keeps the composition. It does, however, raise the routing question — a project
worth writing about is a project worth linking to. See section 5, and open
decision 6.

### Currently should probably stop being a destination

`CURRENTLY` is a four-item array in `main.js` that rotates every 4s, and it is
*already displayed continuously* in the caption line. Clicking the small seconds
opens a card whose entire content is those same three lines. It is the thinnest
section on the site and it costs a full nav slot.

It is also the most *alive* idea on the site, and it earns the small seconds.
Recommendation: keep the small-seconds click and keep it in the rail, but give it
something to be — a short running log (last 8–10 entries with dates), so opening
it rewards you rather than repeating the line you can already read. If you would
rather not maintain that, fold Currently into the top of About as a live strip and
let the small seconds cue About. Open decision 4.

### Contact belongs on the caseback

This is the recommendation I am most confident about. The caseback is the maker's
side of a watch; `.cb-hallmark` already engraves `Au 750 · Nº 1 · 250735` in the
right idiom. Engraving the contact links there as a second arc — email, GitHub,
LinkedIn — is exactly correct, uses a beautiful surface that currently does
nothing but exist, and finally gives the contact links a home.

The rail's CONTACT item flips the watch (`state.flipped = true`) and reveals them.
That also gives the caseback a *reason* to be visited by someone who is not a
watch person, which it does not currently have.

### The request form

`#reqLayer` is about to lose its only trigger. Recommendation:

**Put it in the footer of the Reading card** — a single mono link, "Request a
review →", that sets `state.reqOpen = true`. Optionally repeat it on the caseback
contact panel. Roughly ten lines of change and no new state.

Reasoning: it is topically part of book/watch reviews, so it belongs to that
section rather than to the global chrome; it does not deserve a nav slot; and the
"hidden pusher" charm dies the moment the pusher does another job — so do not
build a second hiding place for it. Better a small honest link than a second
secret nobody finds.

### Content should stop living in markup

All copy is hand-authored inside a 448-line, 36KB `index.html` where line 51
alone is 33KB of generated rig markup. Adding Work detail and Writing means a lot
more of that.

Recommendation: move **panel content only** into data (`src/content.js` or a JSON
file) rendered by a small template function. The watch markup stays exactly as it
is. This is also the lowest-merge-risk shape available while three other agents
are editing the watch: new content lives in new files.

---

## 5. Routing and deep-linking

The biggest structural decision here, so let me lay out the whole trade rather
than just picking.

### What "no URL" costs today

There is no URL state at all. Concretely: you cannot send someone your CV. You
cannot link a project from a job application. Browser Back does not close a
panel — on Android it leaves the site entirely, and on iOS there is no Escape key
so `ESC ✕` is the only exit. There is one `<title>` and one meta description for
the whole site. No per-section analytics.

For a *portfolio*, "cannot link to my own CV" is close to a defect.

### Recommendation: hash routing over the existing `state`. Now, and cheaply.

Not a router library, not multi-page. Roughly fifteen lines:

```js
function open(id) {
  state.active = id; state.touched = true; state.hover = null;
  history.pushState(null, '', id ? '#/' + id : location.pathname);
  render();
}
addEventListener('popstate', () => {
  state.active = idFromHash(location.hash);   // null → closed
  render();
});
```

Routes: `#/about`, `#/work`, `#/reading`, `#/experience`, `#/currently`,
`#/contact` (which also sets `state.flipped`). This gets you shareable links,
working Back — which is the real fix for mobile, better than any close button —
and section-level analytics, for almost nothing.

### The one hard part: deep links versus the assembly animation

The assembly is ~3.7 seconds of `animation-delay` chained through `index.html`
and `styles.css`. Someone opening a shared `#/experience` link should not watch
it. A deep-linked load must skip to the assembled end state and open the panel
immediately, with the watch already posed.

The mechanism already exists in the file — the reduced-motion block does exactly
this collapse:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important;
    animation-delay: 0s !important; transition-duration: .01ms !important; }
}
```

Mirror it as `.stage.is-instant *` and set `is-instant` before first paint when
`location.hash` is non-empty. Fiddly to get exactly right (the loader, the
`rig-ready` promise and the flip transition all need checking) but well
understood. Budget half a day for this alone.

### What hash routing does *not* buy

Social previews and SEO per section. One document means one `<title>`, one
description, one OG image. Pasting `#/work/lange-essay` into Slack or LinkedIn
previews the site, not the piece.

If you want that, it means real per-URL HTML — Vite multi-page via
`rollupOptions.input`, or a static generator, or prerendering. That is a
genuinely different project shape and it fractures the single hand-authored
`index.html` that `docs/HANDOFF.md` calls the source of truth.

**If you go there, one rule: do not split the watch across pages.** Use History
API paths with an SPA fallback plus prerendered HTML for crawlers, so the watch
never reloads or reassembles when moving between sections. A watch that
re-assembles on every navigation would destroy the thing that makes this site
worth visiting.

My recommendation: hash routing in Phase 2, real URLs only if and when project
detail pages exist and sharing them actually matters. But this depends on whether
you want individual work/writing items shareable — open decision 6 — and the
answer also decides whether content-as-data is optional or mandatory.

---

## 6. Not turning this into a template with a widget

The failure mode is specific and easy to name, so name it and hold the line.

**Rules for the chrome:**

1. **No horizontal bar across the top.** Full-width bar, logo left, links right,
   over a centred circular object — that is the exact composition that says
   template. This is the one non-negotiable.
2. **The dial is the wordmark.** `.maker-name` already sets NIKHIL RAMLUKAN in
   Marcellus at generous tracking. The chrome must never repeat the name.
3. **The chrome is drawn from the watch's vocabulary.** Hairline gold rules at
   `--gold-line`, IBM Plex Mono micro-caps at the existing `.24em` tracking, the
   established 315° light. No boxes, no pills, no filled buttons, no icon set, no
   border-radius that does not already exist in the file.
4. **Nothing overlaps the case circle.** Enforced by the grid shell, not by
   hoping.
5. **Chrome is absent during assembly.** Nothing appears before ~3.5s, matching
   `.hint-dots`' current `animation: fadeIn .5s ease 3.45s`. The first thing a
   visitor sees is still a watch being built, with no UI around it.
6. **Chrome recedes.** Rail at ~55% opacity at rest, full on hover/focus-within.
   Never a hard-edged panel.
7. **The rail is a scale, not a menu.** Ticks and a pointer, reading like the
   AUF/AB scale that is already on the dial. If it ever looks like a list of
   links, it is wrong.

**Rules for the watch:** do not touch sprite geometry, the measured ratios in
`docs/DESIGN_BIBLE.md`, `ZOOM_ORIGINS`, the `.cb-rig` block (generated — never
hand-edited), the assembly order, or anything under `tools/`. Add the rail and
the sweep to the regression checklist in `docs/HANDOFF.md` when they land.

A good test at every phase: **take a screenshot with the chrome at rest and ask
whether it still looks like a photograph of an instrument.** If the chrome is the
first thing your eye lands on, back it off.

---

## 7. Phasing

Each phase is independently shippable. Effort is a working estimate, excluding
writing the actual copy.

### Phase 0 — Foundations. Invisible to the user. ~0.5 day

- One `SECTIONS` array in `main.js`: `{ id, label, nodeId, caption, complication }`.
  `CAPTIONS`, the five `bind()` calls and (later) the rail all read from it.
  Deletes the five-parallel-lists problem.
- Grid shell on `.stage` with `--rail-w: 0px`, so nothing moves yet.
- Hit targets become focusable buttons with labels and `:focus-visible`.
- Fix the stuck-hover case while you are in `bind()`.

*Risk:* the grid/`preserve-3d` interaction. Flip test on Chrome and Safari before
merging. Everything else here is mechanical.

### Phase 1 — The rail and the reciprocal cue. ~1–1.5 days

- Desktop rail from `SECTIONS`; `#hintBar` becomes the live mobile bar.
- `state.hover` drives `.is-cued` on the bound watch node, both directions.
- `render()` paints rail `.is-on` from `state.active`.

*Risk:* optical centring — the watch's visual centre shifts by half the rail
width and will need a human eye, not a formula. Below ~1100px the rail should
overlay rather than displace; that breakpoint is a judgement call best made
against screenshots. Biggest single UX gain in the plan.

### Phase 2 — Routing and mobile. ~1 day

- Hash routes, `popstate`, deep-link `.is-instant` skip.
- The first real media queries in the file: rail breakpoints, mobile panel as a
  bottom sheet with a visible close control, a `px` floor under `.hint-bar` and
  `.caption` so `vmin` typography stops going illegible.

*Risk:* the deep-link/assembly skip is the fiddly bit. The media queries will
surface pose problems (`translateX(-28vw)`) that are already latent.

### Phase 3 — Affordance rework. ~0.5–1 day

- Retire `.hint-dots`; build the index sweep on the `cbRigSheen` pattern.
- Unify hover on the light idiom; collapse to a shared `.hit` class.
- `localStorage` first-visit flag; single idle re-cue.

*Risk:* entirely subjective; expect two or three iterations against screenshots.
Deliberately *after* the rail: once the rail exists, discovery no longer depends
on the watch alone, so the watch's cue is free to be as quiet as it should be.

### Phase 4 — Content and IA. ~1–3 days of code, plus writing

- Panel content moves to data; watch markup untouched.
- Contact engraved on the caseback; rail item flips to it.
- Request form rehomed to the Reading footer.
- Work gains a detail level; Writing added; lorem replaced throughout.

*Risk:* the real cost here is the copy, not the code. Note that the site cannot
honestly ship as a personal website while every panel says *Lorem ipsum* — this
phase is the one that actually converts a demo into a website, and it is the one
most likely to stall.

### Phase 5 — Real URLs. Optional, only if decision 6 says yes. ~1–2 days

Prerendered per-URL HTML with an SPA fallback, watch persistent across
navigations. Do not start this before Phase 4 has produced content worth linking
to.

---

## 8. Open decisions — your call

1. **Watch as permanent hero (recommended) or as section 0 of a scrolling page?**
   The hero version is cheaper and protects the 3D rig; the scroll version reads
   as more conventionally "a website". This changes Phase 0, so decide first.
2. **At narrow widths, does the rail displace the watch or overlay it?**
   Displacing is cleaner structurally; overlaying keeps the watch bigger. I lean
   overlay below ~1100px, but it is a taste call best made on a screenshot.
3. **Does the IA stay locked to complications (cap ~7 sections) or does the rail
   carry sections the watch does not have?** I recommend decoupling, with grey
   ticks for rail-only sections. The purist alternative is to cap the site at what
   the watch can express — which is a defensible and quite beautiful constraint.
4. **Currently: a real section with a running log, or folded into About?**
   As it stands it is the thinnest section and costs a full slot.
5. **Contact on the caseback (recommended) or a plain sixth panel?** The caseback
   is idiomatically perfect but means one extra interaction step to reach an email
   address — which some visitors will not take.
6. **Hash routing now with real URLs deferred (recommended), or commit to real
   per-item URLs up front?** This decides whether content-as-data is optional or
   mandatory, and whether Phase 5 exists at all. It hinges on one question: do you
   want to paste a link to a single project or essay and have it preview properly?
7. **Request form: Reading-card footer (recommended), its own rail entry, or cut
   it?** It is a nice piece of personality with no home; it is also the one
   feature nobody asked you for.
8. **First-visit memory in `localStorage` — acceptable, or keep the site
   stateless?** Stateless means returning visitors see the cue every time, which
   is safer for discovery and slightly cheapens repeat visits.
