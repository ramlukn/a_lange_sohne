# The plan, short version

Reasoning, measurements and the arguments behind all of this live in
`docs/SITE-DIRECTION.md`. This page is just what we're doing.

---

## The one thing that matters

Every panel says *Lorem ipsum*. Nineteen invented items across five panels —
fake jobs, fake projects, fake books by authors who don't exist. That is what
makes the site read as a demo rather than as yours, and no amount of design work
covers it. A convincing review of a book you didn't read is worse than lorem.

**Real content comes first. Everything else is second.**

The list is now six sections, which is *more* writing than five, not less — and
Research has nothing in it at all yet. The new list makes this problem bigger,
so say it plainly. Four honest sections still beat six padded ones.

---

## Already decided

- The watch stays on screen permanently. Sections open over it.
- Six sections: About, Resume, Projects, Research, Books, Contact/links.
- Contact lives on the back of the watch. A CONTACT control flips it there, and
  so does the crown.
- The review-request form is gone (already deleted).
- No first-visit memory. Same experience every time, intro included.
- Navigation is a rail down the **right** side. This overrides
  `SITE-DIRECTION.md` §4.3, which recommended a bottom bar.

---

## The sidebar

Six words in a column down the right edge. Right, not left: when a panel opens
the watch poses *left*, so the right margin is where space appears rather than
disappears. `#hintBar` becomes it — same element, typeface and colour, six links
instead of a sentence; its mode line ("CROWN TO FLIP") moves into the caption.

**It clears the case in both states.** The rail is 96px — 72px of ink (PROJECTS
and RESEARCH are the longest, 8 characters of mono at 11px with .24em tracking)
plus a 24px marker channel — sitting inside the page's existing 45px margin, so
at 1440×900 it occupies **x 1299 → 1395**.

| State | Case reaches | Gap to the rail |
| --- | --- | --- |
| Nothing open | x 1107 | **192px** |
| Panel open | x 594 | **705px** |

The gap *grows* by 513px in the state where navigation matters most. A left rail
did the exact opposite — 126px sitting on the case.

**The card pays for it, not the watch.** The overlay's right padding goes from
`5vmin` to `5vmin + 120px` and the card's column goes 720 → 600. Both are 120px,
so **the card's left edge stays exactly where it is today (x 569), at every
window width** — the side facing the watch doesn't move, the pose isn't touched,
and 600px reads better than 720. Below 1200px the same six links range
horizontally at the bottom, where `#hintBar` already sits: one list, one
vocabulary, one media query; only `flex-direction` and position change.
Derivation in `SITE-DIRECTION.md` §4.8.

**How it behaves** — three motions, no others.

- **Arrival.** Once the interaction index has finished scribing, the words fade
  up top to bottom, 90ms apart, 4px of settle. Nothing before ~4.1s. Don't
  re-order the list to match the index's scribe order — nobody can hold that
  comparison across four seconds.
- **Where you are.** A short gold hairline in the marker channel, level with the
  current section, which *travels* to the new one in 200ms rather than fading
  out and in: one pointer along a scale, the gesture the reserve hand already
  makes against AUF/AB. Never a pill, a fill or a box.
- **Both ways.** Hovering a word lights its watch part; hovering the part lights
  the word — `state.hover` already drives the caption and the part's light, so
  this is one more thing `render()` paints from it. On touch, a tap cues the
  part for ~600ms before the panel opens; that is the only way a phone visitor
  learns the watch is the navigation.

Six real `<a>` elements at `z-index: 50`: the rail stays up with a panel open —
section to section without closing — and keyboard access arrives for free.

---

## What each watch part opens

| Part | Opens | Why that part |
| --- | --- | --- |
| Hours dial | **About** | The biggest thing on the watch, and your name is printed on it. Clicking the surface that says NIKHIL RAMLUKAN to find out who that is needs no caption. Anything else opening it would mislead; About being thin is a content problem, not a mapping one. |
| Outsize date | **Projects** | The watch's signature complication opens the portfolio's headline section. It is also the only indication that is typographic, discrete and dated, jumping value to value — the shape of a numbered list of dated work. |
| Small seconds | **Research** | The only hand that never stops. Research is the work that is never finished; projects are the ones that are. |
| Power reserve | **Resume** | Winds up over time and stores what you put in. That's a CV. Scroll-to-wind is already the best interaction on the site. |
| Moonphase | **Books** | The one complication that exists purely because it's lovely — slow, useless, 29.5 days to make its point. Books are that on a personal site. |
| Crown → caseback | **Contact / links** | You turn a watch over to find the maker's marks. An address is that kind of mark. |

### What changed, and what it costs

**One binding moves, one section dies, everything else is naming.** Full cost
list in `SITE-DIRECTION.md` §5.6.

- **Small seconds: Currently → Research.** One `bind()` call, the `currently`
  key renamed in `CAPTIONS` and `ZOOM_ORIGINS`, `#panel-currently` →
  `#panel-research` with a new eyebrow and title. **Zoom coordinates, the five
  `.hint-mark` shapes and the index's scribe order do not change** — the part
  hasn't moved, only what it opens.
- **"Currently" stops being a section.** Its whole content was one line, and
  that line already reads continuously in the caption, so the click gave back
  nothing you weren't already reading. The rotating `CURRENTLY` array stays and
  keeps feeding the caption; only the panel goes. This overrides §5.3, and it
  deletes the stale-section risk §5.3 needed code to defend against.
- **Renames, no re-wiring:** `featured` → `projects`, Reading → **Books**,
  Experience → **Resume** (the id is already `resume`; the label was the odd one
  out). Do these in Phase 0, when the `SECTIONS` list makes it one edit not four.
- **Reword the About caption** to "THE MAIN DIAL", and **drop the moon-phase
  labels on individual books** (NEW MOON · PHILOSOPHY) — decoration pretending
  to be meaning.

Six sections and six parts is a coincidence, not a design, and the danger is
that a perfect fit hides the ceiling. The 10 o'clock corrector is the seventh
clickable thing and it already has a job; it does not get a section. **Seven is
a ceiling, not a target.** If Research or Books has nothing real in it, it
doesn't ship: it leaves the rail and its complication goes back to being a plain
part of the watch — no light, no index mark, no dead click.

---

## Phases

Each ships on its own. Detail in `SITE-DIRECTION.md` §10.

| Phase | What | Why |
| --- | --- | --- |
| **0 — Plumbing** ~0.5–1d | One `SECTIONS` list the captions, click targets and rail all read from; the renames land here; hit targets become keyboard-reachable; Escape unflips the watch. | A section name lives in four places today, and nothing on this site can be reached by keyboard at all. |
| **1 — Real content** ~0.5d + writing | Copy moves from `index.html` into `src/content.js`. Real About, portrait, projects, research, experience, a downloadable CV; anything not real yet is left out. | The phase that turns a demo into a website. Nothing else does. |
| **2 — The rail goes live** ~1d | `#hintBar` becomes the six-link rail: right column above 1200px, bottom row below, painted from `state`, hover both ways. | A visitor reads the nav and clicks a word, and is shown without being told that the watch is the same navigation. |
| **3 — Addresses and phones** ~1–1.5d | `#/about` links so Back works and reloads land where you were; the first rules for narrow screens. | You can't send anyone a link to your own CV, and on a phone Back leaves the site. |
| **4 — Contact on the caseback** ~0.5–1d | Four engraved words above the hallmark; the address reads out in the caption; nothing inside the sapphire. | Contact doesn't exist anywhere on the site today. |
| **5 — Depth** ~1–1.5d | Pointer tilt, a real date aperture, hands off the dial. | Polish, which is why it is last. |

**Later, only if earned.** A second level on projects. Real per-page addresses.
A Writing section, when two real pieces exist — don't build the slot first.

---

## Five rules to hold

1. Nothing new gets eyeballed where the existing work is measured.
2. Motion has to explain something. No drifting, floating or looping.
3. The panels must look like they belong to the same object as the watch. Today
   they don't — they're generic dark cards with rounded corners and pill tags.
4. Deleting counts as progress.
5. Never invent a section to fill a complication.

---

## Still open

1. **Does the crown join the interaction index** as a sixth mark, now that
   Contact is a real section? Default no — a crown is already the most obviously
   pressable thing on any watch, and six marks break the index's rhythm.
2. **Rail width is one number.** 96px follows from 11px type; at 12px it becomes
   104px and the card's column 592px. Set the type size, then derive.
3. **Tilt angle.** Start at ±10°. Your eye, nobody else's.

Two consequences to expect rather than decide: the ~4.1s intro plays on every
visit, and the interaction index scribes itself every visit too. Both follow
from the no-memory decision. If the intro grates, let a click interrupt it —
don't start remembering people.
