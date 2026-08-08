# The plan, short version

Reasoning, measurements and the arguments behind all of this live in
`docs/SITE-DIRECTION.md`. This page is just what we're doing.

---

## The one thing that matters

Every panel says *Lorem ipsum*. Nineteen invented items across five panels —
fake jobs, fake projects, fake books by authors who don't exist.

That is what makes the site read as a demo rather than as yours, and no amount
of design work covers it. It's also the only job here nobody else can do: a
convincing review of a book you didn't read is worse than lorem, not better.

**Real content comes first. Everything else is second.**

Four honest sections beat seven padded ones. One project you can write two
paragraphs about is a portfolio; three invented ones aren't.

---

## Already decided

- The watch stays on screen permanently. Sections open over it.
- Contact lives on the back of the watch. A CONTACT control flips it there, and
  so does the crown.
- The review-request form is gone (already deleted).
- No first-visit memory. Same experience every time, intro included.

---

## What each watch part opens

| Part | Opens | Why that part |
| --- | --- | --- |
| Main dial (hours & minutes) | **About** | The biggest thing on the watch, and your name is already printed on it. Clicking the surface that says NIKHIL RAMLUKAN to find out who that is needs no caption. |
| Outsize date | **Work** | The date is the one indication that's typographic, discrete and dated, and it jumps from one value to the next. A numbered list of dated projects is that same shape. |
| Small seconds | **Currently** | The only hand that never stops. The only section that has to be current. |
| Power reserve | **Experience** | Winds up over time and stores what you put in. That's a CV. Scroll-to-wind is already the best interaction on the site. |
| Moonphase | **Reading** | The one complication that exists purely because it's lovely — slow, useless, 29.5 days to make its point. Books are that on a personal site. |
| Crown → caseback | **Contact** | You turn a watch over to find the maker's marks. An address is that kind of mark. |

### What changed, and what it costs

I went looking for a re-wiring and didn't find one worth paying for. **No hit
target moves to a different section.** What changes is naming and discipline:

- **"Featured" → "Work".** "Featured" names a slot; "Work" names a thing. Frame
  it as dated, numbered entries and the date window earns it. *Cost:* a caption
  string, the panel's eyebrow and title, one word in the bottom bar. Optionally
  rename the `featured` key across `bind()`, `ZOOM_ORIGINS`, `CAPTIONS` and
  `#panel-featured` — same values, different key.
- **"Book Reviews" → "Reading".** Reviews implies a publication. Same cost
  shape; the `books` id can stay as-is.
- **Reword the About caption.** Every other one names a real part — the outsize
  date, the small seconds, the power reserve. About's says "the heart of the
  matter", wordplay meaning nothing mechanical. Make it "THE MAIN DIAL".
- **Drop the moon-phase labels on individual books** (NEW MOON · PHILOSOPHY) —
  decoration pretending to be meaning.

Zoom origins, hint-mark geometry and the interaction index's scribe order are
untouched by all of the above.

**On the main dial opening the most generic section:** the fix is a real About,
not a different mapping. The dial carries your name; anything else opening it
would actively mislead. About being thin is a content problem.

**Five isn't a target.** If a section has nothing real in it, it doesn't ship —
it leaves the bar and its complication goes back to being a plain part of the
watch (no light, no index mark, no dead click). Currently needs this rule
anyway: date every entry, and if the newest is over ~8 weeks old the section
stands down on its own. Reading is the other one at risk — easiest to pad,
most expensive to do honestly.

---

## Phases

Each ships on its own.

**Phase 0 — Plumbing. ~0.5–1 day**
One list of sections in `main.js` that the captions, the click targets and the
bar all read from; the five hit targets become keyboard-reachable; Escape also
unflips the watch.
*Why:* a section name currently lives in four places. And nothing on this site
can be reached by keyboard at all — that's a straight bug, cheap now and
expensive later.

**Phase 1 — Real content. ~0.5 day of code, plus the writing**
Panel copy moves out of `index.html` into `src/content.js`. Real About, real
portrait, real projects, real experience, a downloadable CV. Anything not real
yet is left out rather than filled in.
*Why:* this is the phase that turns a demo into a website. Nothing else does.

**Phase 2 — The bottom bar goes live. ~1 day**
The line of text under the watch becomes real navigation, stays visible while a
panel is open, and hovering a word lights the matching watch part (and back the
other way).
*Why:* a visitor does the conventional thing — reads the nav, clicks a word —
and is shown without being told that the watch is the navigation.

**Phase 3 — Addresses and phones. ~1–1.5 days**
`#/about`-style links so Back works and reloads land where you were; the site's
first layout rules for narrow screens.
*Why:* right now you can't send anyone a link to your own CV, and on a phone the
Back button leaves the site entirely.

**Phase 4 — Contact on the caseback. ~0.5–1 day**
Four engraved words in the empty bottom of the caseback band, above the
hallmark; the full address reads out in the caption line under the watch.
Nothing ever goes inside the sapphire.
*Why:* contact doesn't currently exist anywhere on the site.

**Phase 5 — Depth. ~1–1.5 days**
The watch tilts a few degrees toward the pointer; the date window gets real
aperture depth; the hands lift off the dial.
*Why:* makes the object more convincing. Pure polish — it changes nothing about
what the site is, which is why it's last.

**Later, only if earned**
A second level on projects (click one, read for two minutes), once there's
something worth reading. Real per-page addresses, if you need a link to preview
with a project's own title and picture. A Writing section, when two real pieces
exist — don't build the slot first.

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

1. **Bottom bar or top bar?** Default is the bottom bar — there's only 58px of
   spare vertical space, and a top bar costs the watch 7% of its diameter.
   Decide before Phase 2; it's the one answer that changes the plan's shape.
2. **Does the crown join the interaction index** as a sixth mark, now that
   Contact is a real section? Default no — a crown is already the most obviously
   pressable thing on any watch, and six marks break the index's rhythm.
3. **Tilt angle.** Start at ±10°. Your eye, nobody else's.

Two consequences to expect rather than decide: the ~4.1s intro now plays on
every single visit, and the interaction index scribes itself every visit too.
Both follow from the no-memory decision. If the intro grates, the fix is to let
a click interrupt it — not to start remembering people.
