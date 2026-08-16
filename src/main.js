const CONFIG = {
  transitionStyle: 'panel', // 'panel' | 'zoom' | 'takeover'
  secondsMotion: 'mechanical', // 'mechanical' | 'quartz' | 'smooth'
  showHints: true
};

const SYNODIC_DAYS = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

// The rotating status line. It is NOT a section: its whole content was one line
// and that line reads continuously in the caption, so the panel it used to open
// gave back nothing you were not already reading. The array stays; the panel is
// gone, and the small seconds now open Research. render() is its only reader.
//
// THIS IS THE FIRST REAL CONTENT ON THE SITE. Every panel is still Lorem; these
// three lines are not. Length is now a fact rather than a choice -- the caption
// prints `CURRENTLY <label> — <value>` uppercased, and the longest of the three
// sets the caption's own measure, which is why the wrap floor below 760px is
// derived from it (see the .caption rule in src/styles.css).
//
// THE COUNT IS NOT LOAD-BEARING. It went four -> three when BUILDING left, and
// nothing had to move: the ticker is a modulo over CURRENTLY.length, and the
// four dots that used to count the entries went with the panel.
//
// THE NICKNAME TAKES TYPOGRAPHIC QUOTES, not the straight pair it was written
// with. The caption is the one line on this site set in tracked uppercase mono,
// and a straight " is a vertical tick that reads as code beside the em dash the
// same line already prints; “ ” are a matched pair that read as a name. Spline
// Sans Mono cuts both, at the face's own 0.6em advance -- checked on canvas in
// the loaded cut, not assumed, since a missing glyph here would fall back to a
// proportional face mid-word. The words are the visitor's own and are not touched.
const CURRENTLY = [
  { label: 'RESEARCHING', value: 'Passive Detection' },
  { label: 'READING', value: 'Haruki Murakami' },
  { label: 'WEARING', value: 'Tudor Black Bay 58 “Navy Blue”' }
];

// ---- THE SECTIONS ----------------------------------------------------------
// One row per section, and every place that has to agree about a section reads
// it from here: the caption, the zoom origin, the panel, the click binding, the
// accessible name and the rail are all derived below. A section's identity
// used to live in four objects plus the markup plus a hard-coded sentence;
// renaming one meant six edits and there was no way to be sure you had found
// them all. Adding, renaming or dropping a section is now one row.
//
//   key     what state.active / state.hover carry, and what the pulse mark's
//           data-part says in index.html
//   label   the word the section is called -- caption, panel title, and the
//           rail's link text
//   part    the watch part it hangs off, as the caption prints it (no article:
//           "THE " is added where it is used, so a caller can drop it)
//   hit     the element id of the thing you click on the watch
//   panel   the id of the <section> it opens
//   origin  transform-origin for the 'zoom' transition style
//
// The order is the rail's order, top to bottom -- About, Resume, Projects,
// Research, Field Notes, then Contact, which is docs/PLAN.md's own order with
// Books renamed twice. It is not DOM order, and it is
// no longer in any tension with the interaction index's scribe order: the index
// has no scribe order any more -- all five marks are drawn on one frame -- and
// neither does the rail. This list orders the words on the page. It does not
// order anything in time.
//
// THE KEY MOVES WITH THE LABEL, AND IT HAS NOW MOVED TWICE. Books became
// Miscellany because the section was broadening -- books were the first thing in
// it, not the whole of it -- and Miscellany became FIELD NOTES (Nikhil, 10
// August 2026), which says the same breadth in a word that is a section name
// rather than an apology for one. Both times the key went with the label: the
// address is `#/field-notes`, the panel is `panel-field-notes` and the pulse
// mark's data-part is `field-notes`. Renaming the label and leaving the key
// would have put the drift this list exists to prevent inside the list itself:
// one word in the rail, another in the URL, a third in the markup.
//
// IT IS THE FIRST KEY OF TWO WORDS, and it cost nothing: the label's space
// becomes a hyphen, routeKey()'s `[\w-]+` already accepted one, and every other
// reader of a key -- $(), the data-part and data-hover selectors, CAPTIONS --
// takes the string as it is given.
//
// Neither `#/books` nor `#/miscellany` is redirected. Neither was ever published
// -- every panel on this site is still Lorem -- and a route table carrying
// aliases for addresses nobody has is a maintenance cost paid for nothing.
const SECTIONS = [
  { key: 'about',      label: 'About',      part: 'MAIN DIAL',     hit: 'aboutHit',    panel: 'panel-about',      origin: '31.8% 50%' },
  { key: 'resume',     label: 'Resume',     part: 'POWER RESERVE', hit: 'reserve',     panel: 'panel-resume',     origin: '65.5% 47.5%' },
  { key: 'projects',   label: 'Projects',   part: 'OUTSIZE DATE',  hit: 'dateWindow',  panel: 'panel-projects',   origin: '63.75% 26.05%' },
  { key: 'research',   label: 'Research',   part: 'SMALL SECONDS', hit: 'secondsDial', panel: 'panel-research',   origin: '64.5% 75.115%' },
  { key: 'field-notes', label: 'Field Notes', part: 'MOONPHASE',  hit: 'moon',        panel: 'panel-field-notes', origin: '64.5% 67.535%' }
];
const SECTION = new Map(SECTIONS.map((s) => [s.key, s]));

// ---- THE SIXTH WORD --------------------------------------------------------
// Contact is in the rail and NOT in SECTIONS, because it is not one. The five
// rows above each name a part of the dial, open a panel and carry a zoom origin;
// Contact has none of the three. What it has is a destination -- it turns the
// watch over -- and that is the whole of its definition here:
//
//   key     the address it answers to, `#/contact`, alongside the five
//   label   the word in the rail
//   hover   the part that IS this word, in state.hover's own vocabulary. The
//           crown, which already has a caption, a pulse mark and a hit target of
//           its own; CAPTIONS.crown is reused rather than copied, so hovering
//           CONTACT and hovering the crown cannot say two different things.
//
// Putting it in SECTIONS with three empty fields would have been the shorter
// diff and the worse one: `panels`, bind(), showSection() and the caption
// derivation all read those fields unconditionally, and every one of them would
// have needed a guard for the row that is not a section. One row that is honest
// about being different costs one map lookup (hoverKeyOf, below).
const CONTACT = { key: 'contact', label: 'Contact', hover: 'crown' };

// The caption, derived. The crown and the pusher are the two hoverable things
// that are not sections -- the crown turns the watch over, the pusher runs the
// demonstration -- so they are the only captions still written out by hand. The
// crown's is now printed by two controls, the fitting and the rail's CONTACT.
// THE PUBLISHED ADDRESS, ONCE. It is printed in two places -- the mailto: in
// index.html and the caption below -- and those two must never be able to
// disagree, so the caption derives from this and the markup is checked against
// it at startup rather than trusted. The personal address and not the
// university one: a .edu expires with the degree and this site should outlive
// it.
const EMAIL = 'nikhilr.ramlukan@gmail.com';

// The three wheels on the caseback, and what the caption says while you are on
// one. The address is read out in full because that is the whole point of the
// caption here: a mailto: is a dead end for someone who only wants to copy it,
// and the engraved hub says "Gmail", not where it goes.
const LINKS = {
  linkedin: 'LINKEDIN.COM/IN/NIKHIL-RAMLUKAN',
  github: 'GITHUB.COM/RAMLUKN',
  email: EMAIL.toUpperCase()
};

// WHERE THE THREE GO, ONCE. LINKS above says what they are; this says where they
// point. Both ends of the site read it -- the rail's three contact links below
// are built from it, and the caseback's own hrefs are checked against it at
// startup rather than trusted (see the link train). The two URLs used to live
// only in index.html, so putting the same three words in the rail would have
// meant retyping them; a table both ends read is the same defence the address
// already had.
//
// EMAIL IS STILL A mailto: AND IT IS NO LONGER FOLLOWED. Both controls carrying
// it -- the caseback's Gmail wheel and the rail's EMAIL -- copy the address to
// the clipboard instead; see copyEmail(). The href stays because it is what
// keeps them links rather than buttons in a link's clothes: middle-click, "copy
// link address" and the status bar all still work, and a visitor whose script
// never ran gets a mailto: that does exactly what it says.
const LINK_HREF = {
  linkedin: 'https://www.linkedin.com/in/nikhil-ramlukan-2a4a41277',
  github: 'https://github.com/ramlukn',
  email: `mailto:${EMAIL}`
};

const CAPTIONS = {
  ...Object.fromEntries(SECTIONS.map((s) => [s.key, `${s.label.toUpperCase()} — THE ${s.part}`])),
  ...LINKS,
  crown: 'THE MOVEMENT — PULL THE CROWN, TURN IT OVER',
  pusher: 'THE PUSHER — RUN THE WATCH THROUGH ITS PACES'
};

// ---- the demonstration sweep ----------------------------------------------
// Pressing the 10 o'clock pusher winds every complication forward and lets it
// coast back down onto the live reading, like a watch being wound fast on a
// timing machine.
//
// Everything is expressed as a departure FROM the true value that returns to
// nothing -- an added offset for the rotating parts, a blend toward an
// off-the-ends sweep for the reserve -- so the demo is a lens over render()
// rather than a second writer fighting it (render() rewrites all of these
// unconditionally every frame; anything set from a timer would be gone by the
// next one).
//
// The easing is `spin(t) = 1 - (1 - t)^2`: its derivative falls linearly from
// 2 to 0, which is exactly a flywheel coasting to a stop under constant
// friction. Because the totals below are all WHOLE turns and the date total is
// a whole number of trips round the wheel, spin -> 1 lands every rotating
// element back on its true value with zero velocity, so the demo eases home
// instead of snapping. (The reserve reaches zero in both value and slope by a
// different route -- see render().)
const DEMO = {
  ms: 4000,
  // The duration is fixed at four seconds, so calming a hand down means turning
  // it less, not turning it for longer. Every total is a whole number of turns
  // -- that is the invariant, not the ratios between them.
  //
  // The ratios are a judgement about hierarchy rather than gearing. A real watch
  // is 12:1 and 60:1; 60:1 here would be 720 turns, a featureless grey disc, so
  // the seconds hand always runs compressed. What has to survive the compression
  // is the ORDER -- seconds fastest, then minute, then hour -- and the gaps have
  // to be wide enough to read. Three successive halvings of the seconds hand
  // (36 -> 18 -> 9 -> 5) against one of the minute hand (12 -> 6) eventually
  // turned that order over: at min 6 / sec 5 the seconds hand ran slower than
  // the minute hand, which no watch does, and it read as broken rather than
  // calm. The way to calm a sweep is to bring every total down together.
  //
  // Angular rate alone is the wrong yardstick, because the small-seconds subdial
  // is not the main dial. Measured off the rendered sprites, the three tips sit
  // at 0.48 / 1.00 / 0.69 of the minute hand's radius (seconds / minute / hour),
  // so the seconds hand has to turn better than twice as fast as the minute hand
  // just for its tip to MOVE as fast. Tip speed is the honest measure, and it is
  // the one the totals below are chosen against.
  //
  // hour 1 is a floor rather than a choice: 12 hours is its whole turn, and half
  // of that parks it six hours out instead of home. min 2 is then the smallest
  // total that clears it -- 2.0x angular, 2.9x at the tip. sec 9 is the smallest
  // whole total that clears the minute hand by a comparable margin at the tip:
  // 4.5x angular, 2.2x at the tip. 6 restores the old 3:1 angular but is only
  // 1.4x at the tip, on the muddy side of the line; 8 is still under 2x. 9 is
  // also coprime to 1, 2 and 2, so nothing on the dial phase-locks with anything
  // else while the sweep runs. It peaks at 4.5 turns/s and reads as a broad fan,
  // with the leading blade still visible -- fast, but not a disc.
  //
  // The moon splits the difference the other way: 1.5 turns is not whole, and of
  // the two neighbours 2 is the closer in rate (x1.33 against x1.5) and keeps
  // the plate coasting through the tail instead of stalling in it.
  turns: { hour: 1, min: 2, sec: 9, moon: 2 },
  dateTurns: 1,        // one whole trip through 01..31, so it wraps home
  // The reserve sweeps rather than spins, and it is the one element the demo
  // drives as an ANGLE rather than as a value: see render(), where the sweep is
  // deliberately wider than the printed scale.
  reserveSweepDeg: 160, // total travel, vs the printed scale's 98.2deg
  // THE RESERVE HAND KEEPS ITS OWN CLOCK, AND IT IS SHORT.
  // Nikhil, 11 August 2026: "shorten the power display hand animation when
  // opening the reusme section. The pusher animation sohuld be the same."
  //
  // It was 4000ms and three round trips -- the whole demonstration's length,
  // 0.67s a traverse. That is a sweep, and a sweep is what a needle does when it
  // is being tested; the hand is answering a click here, and a click wants a
  // flick. 900ms and ONE round trip: out to one extreme, back through the
  // reading, out to the other, home. 0.45s a traverse, so it is faster on the
  // dial than the old one was and still reads as one gesture rather than as an
  // oscillation you have to wait out. One cycle keeps the whole-cycles invariant
  // that lands the hand home with zero velocity.
  //
  // The pusher takes exactly this, which is what "should be the same" asks for:
  // there is one reserve motion with one duration, and the demonstration simply
  // finishes this hand early and lets it sit true while the rest of the dial
  // runs out its four seconds. See render(), where both read reserveMs.
  reserveMs: 900,      // the reserve's own duration, in BOTH the demo and a salute
  reserveCycles: 1,    // whole end-to-end round trips, ~0.45s per traverse
  reserveHold: 0.85,   // fraction of that 900ms held at full end-to-end travel
  reducedMs: 1200      // reduced motion: no movement, just an acknowledgement
};
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

// ---- THE SECTION'S SALUTE --------------------------------------------------
// Nikhil, 11 August 2026: "for when you open on the sections on the front, make
// the compontent do the same animation that the 10 o clock pusher does. For ex.
// if i click the date dispay, itll spin and only it. same wth other components"
//
// And, the same day: "make the same animation that happens on clicking a front
// face compontent happen when you exit".
//
// So: opening a section turns the ONE part that section hangs off, closing it
// turns the same one again, and nothing else on the dial moves out of its own
// time. Two doors, one call each -- showSection() and hideSection().
//
// WHAT IS REUSED AND WHAT IS ONLY IMITATED. The pusher's demonstration is not
// called here, and it could not be: it is deliberately the whole watch at once
// ("RUN THE WATCH THROUGH ITS PACES"), which is the opposite of what was asked
// for. What is reused is not the feel but the actual arithmetic -- DEMO.ms and
// DEMO.reserveMs, DEMO.turns, DEMO.dateTurns, the reserve's sweep constants,
// and the easing
// spin(t) = 1 - (1 - t)^2 -- applied through the same lens, one part at a time.
// Nothing is copied into a second set of numbers, so calming a hand down in
// DEMO calms it in both places and the two motions cannot drift apart. The
// demonstration itself is untouched.
//
// A LENS, NOT A SECOND WRITER, for the reason written out above DEMO: render()
// rewrites every one of these transforms unconditionally, ten times a second,
// so anything set from a timer or a CSS keyframe would be gone by the next
// tick. This is why there is no stylesheet rule for any of it. Every entry is
// an offset FROM the true reading that returns to nothing, and every total is a
// whole number of turns, so the part eases home onto its live position with
// zero velocity rather than parking anywhere.
//
// WHICH PART EACH SECTION TURNS -- the SECTIONS row's `part` column, in the
// vocabulary render() writes in. MAIN DIAL is its two hands, because that is
// what the main dial's own motion is.
const SALUTE_PART = {
  about: 'mainDial',
  resume: 'reserve',
  projects: 'date',
  research: 'sec',
  'field-notes': 'moon'
};

// part -> { t0, base }. A map rather than one field because two sections opened in quick
// succession name two different parts, and those are independent offsets: the
// one you have just left can coast home on its own easing while the one you
// have just opened starts. Re-asking for a part that is still turning is
// IGNORED, which is the pusher's own re-entrancy rule and the same argument --
// restarting would rewind that part's offset to zero mid-flight and snap it
// backwards. Closing and re-opening a section inside its own duration -- four
// seconds, or the reserve's 900ms -- therefore carries on turning rather than
// stuttering. That guard is what makes the exit flick safe to add: closing a
// panel a beat after opening it, or hammering a rail word, cannot stack two
// runs on one part, because the second one is dropped rather than queued.
//
// SWITCHING SECTIONS FLICKS THE ONE YOU ARE GOING TO, NOT THE ONE YOU LEFT.
// Click Projects while Research is open and the date flicks; the small seconds
// does not. Both readings were defensible and this is the one the site already
// believed: applyRoute() does not close on its way between two sections -- it
// calls showSection() again, and showSection() overwrites -- so there is no exit
// to acknowledge, only a move. The other reading would have meant TWO
// complications answering ONE click, which is the dial talking over itself, and
// on a fast walk down the rail it would have left a trail of parts still
// spinning behind the reader. One gesture in, one gesture out, and a switch is
// one gesture. Nothing enforces this; it is what falls out of the doors, and the
// note is here so a later reader knows it was chosen and not missed.
const SALUTE = new Map();

// False for exactly one call: the applyRoute() at the foot of this file, which
// applies the address the page was loaded on. See showSection().
let arrived = false;

// True on the frames the reserve hand is being driven by an animation, so the
// frame AFTER the last of them can still suppress the hand's .6s transition and
// let the snap be a snap. See render().
let reserveSnapping = false;

// REDUCED MOTION GETS NOTHING, not a shortened version. The house rule is that a
// motion someone has asked not to see becomes a state rather than a fast event,
// and here the state already exists and is already legible without this: the
// panel is open, the rail word is lit, the part is the one named in the caption.
// The demonstration keeps a 1200ms reduced branch only because a press with no
// answer at all reads as a dead control; opening a section is never in that
// position, so there is nothing left to acknowledge. The guard is in script
// rather than in the stylesheet's blanket rule for the same reason the
// demonstration's is: this motion is written as inline transforms by render(),
// and no CSS rule is in a position to switch it off.
function startSalute(key) {
  if (REDUCED_MOTION.matches) return;
  const part = SALUTE_PART[key];
  if (!part || SALUTE.has(part)) return;
  // `base` is the reserve's frozen starting reading -- see THE HAND LET GO OF
  // THE SCROLL in render(). Read once, here, and never again: it is the whole
  // point that the sweep stops asking. Harmless and unused for the other four.
  SALUTE.set(part, { t0: Date.now(), base: state.reserve });
  if (!demoPumping) { demoPumping = true; requestAnimationFrame(demoPump); }
}

// THE WIDTH AT WHICH THE WATCH STOPS FITTING BESIDE THE PANEL.
// The 'panel' pose slides the watch left by 28vw and the card is hard against
// the right margin, so what is left of the watch is (viewport - card)/2 - 28vw
// plus 43vmin of half-diameter. That is comfortable at 1440 and is a ~30px
// sliver at 900 -- the "the watch stays visible beside the panel" promise breaks
// somewhere around 1400px, and below ~1200 the watch is simply behind the card.
//
// 1199 is THE RAIL's breakpoint, taken rather than chosen: it is where the
// navigation stops being a column on the right and becomes a row along the
// bottom, which is the same event seen from the other side -- below it there is
// no right-hand column for the card to sit beside and nothing on the right for
// the watch to be pushed away from. Two breakpoints 19px apart would only have
// made a sliver of viewport where the two halves of one layout disagreed.
//
// Below it the watch moves UP instead of sideways and the card drops to the
// bottom of the screen -- the same two elements, stacked rather than side by
// side, which is the honest degradation. The number is stated here AND in
// styles.css (three times: THE RAIL, THE RAIL'S CLEARANCE and NARROW SCREENS)
// because the pose is written by render() as an inline style ten times a second
// and a stylesheet cannot reach it. Keep the four together.
//
const NARROW = matchMedia('(max-width: 1199px)');

// THE GATE'S SECOND LOCK.
// Him, 10 Aug 2026: "stop mobile view or a rly thin browser dimension so the
// layout doesnt get messed up. It should tell the user to view on desktop".
//
// Him, 11 Aug 2026, verbatim, and this is the trigger that ships: "Forget about
// browser size. Only fail on a mobile device". No width, no height, no aspect
// ratio: a desktop window is never gated at any shape. The size and aspect
// derivations are kept in THE GATE in styles.css as history -- abandoned by his
// decision, not found wrong -- and they drive nothing, here or there.
//
// Him again, 11 Aug 2026, verbatim: "prevent the mobile viewing". THIS BLOCK IS
// A RESTORATION. It was written and verified earlier the same day and was then
// lost in a revert aimed at a separate round of aspect-ratio experiments he had
// rejected -- one of which briefly gave NARROW above a second, ratio-based arm
// at 1.45 and flipped the rail to a top bar on his square monitor. NARROW is
// width-only and stays width-only; the gate below is the only thing restored.
//
// The gate itself is CSS and is NOT here: THE GATE in styles.css swaps .stage
// for the message with `display: none` when the primary pointer is a fingertip
// that cannot hover, which cannot be undone from inside the subtree and does
// not wait for this module to parse. This is only the second turn of
// the key, and it is worth turning for one reason: display:none is a property,
// and a property is a thing a later hand can override at higher specificity
// while believing it is un-hiding one element. `inert` is the primitive the
// rest of this file already uses for exactly this -- el.back.inert on the face
// of the watch, el.rail.inert during the intro -- and it is inherited and
// cannot be refused by a descendant. If .stage is ever visible under the gate,
// it is still not focusable, not clickable and not read.
//
// Nothing else is done here. The gate does not need to stop the clock or the
// rig: both are inside a display:none subtree, where Chrome runs no animation
// and paints nothing.
//
// THE STRING IS THE STYLESHEET'S, CHARACTER FOR CHARACTER. It is the one place
// the condition is written twice, and it has to be: there is no way to hand a
// media condition from CSS to script (`(max-width: var(--x))` is returned
// unparsed by matchMedia and never matches -- verified in Chrome, not assumed).
// Copy it from THE GATE in styles.css if it ever changes; the two must not be
// able to disagree about whether the gate is up.
//
// AND navigator.userAgentData.mobile IS NOT IN THE CONDITION, deliberately. It
// is the one honest device boolean -- browser-provided, not a UA string parsed
// by us -- but it is Chromium-only: Firefox and Safari have no navigator
// .userAgentData at all, so a gate that consulted it would behave differently
// in three browsers on the same phone. Worse, if it were OR'd or AND'd in here
// it could put .stage inert while CSS left it visible, or the reverse, and a
// gate whose two locks disagree is not a gate. So CSS IS THE SOURCE OF TRUTH
// AND THIS LINE ONLY EVER READS IT. The boolean is used for exactly one thing
// below: it warns, once, if the browser's own claim and the query disagree. It
// cannot raise or lower the gate. Support is tested before it is read -- the
// optional chain covers Firefox and Safari, where `mobile` is undefined and the
// `=== true` comparison is simply false, so nothing warns and the query stands
// alone. That is the fallback, and it is the normal case in two of three
// engines.
const GATED = matchMedia('(pointer: coarse) and (hover: none)');
const applyGate = () => { document.querySelector('.stage').inert = GATED.matches; };
GATED.addEventListener('change', applyGate);
applyGate();
if (navigator.userAgentData?.mobile === true && !GATED.matches) {
  console.warn('gate: userAgentData.mobile is true but (pointer: coarse) and (hover: none) does not match; CSS decides, the gate is down');
}

// GAP_VH is the air left between the bottom of the watch and the top of the
// card, at each end of the band. Small, because the band is the scarce thing.
const GAP_VH = 1.6;
// The stacked pose, measured rather than picked. A fixed "up 20vh and scale to
// .54" was tried first and it is wrong at both ends of the range for the same
// reason: the watch is 86vmin and the band above the card is a fraction of vh,
// so how much of the band the watch fills depends entirely on the aspect ratio.
// The same numbers that fit a 390x844 phone put the watch 76px behind the card
// at 1180x800 (where 86vmin is 86% of the height rather than 40% of it), and
// pushing the lift far enough to clear that clipped the top off the phone.
//
// So the scale is whatever makes the watch fill the band, capped at the .72 the
// desktop pose uses -- a stacked watch is never LARGER than the one beside a
// panel -- and the lift is whatever puts the scaled box in the middle of that
// band. Both fall out of one layout read.
//
// Read once per resize and cached, not per frame: render() runs ten times a
// second and getBoundingClientRect() forces layout. The box it measures is
// .watch-stage, which is untransformed (the pose rides the child) and does not
// move when a panel opens (the overlay is position: fixed), so it is stable
// between resizes.
//
// THE BAND IS BETWEEN THE RAIL AND THE CARD, and both of its ends are read from
// the overlay rather than assumed. The rail is a row along the TOP below 1200px,
// so the clearance it charges is the overlay's padding-TOP, and the card -- which
// is bottom-anchored, .overlay { align-items: flex-end } -- sits on the overlay's
// padding-BOTTOM. The two paddings are no longer the same number and no longer
// mean the same thing: the top one is the rail's rent, the bottom one is the
// page's own margin. Reading both is what keeps the arithmetic honest now that
// the watch has furniture above it as well as below it.
let narrowPose = null;
function measureNarrowPose() {
  if (!NARROW.matches) { narrowPose = null; return; }
  // How tall the card is, taken FROM the stylesheet rather than restated here:
  // --sheet-vh is declared in the narrow block next to the rule that uses it, so
  // the card's height and the watch's room above it cannot drift apart.
  const sheet = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-vh')) || 0;
  // The rail's clearance, taken from the overlay's own padding rather than
  // restated. Below 1200px the links are a row across the top and the overlay
  // makes room for them, so this reads the rail's height, its offset and the
  // notch inset as ONE number without knowing that is what any of them are --
  // which is the point: the clearance is stated once, in CSS, where the rail is.
  // Both resolve on a display:none element because they are absolute lengths.
  const above = parseFloat(getComputedStyle(el.overlay).paddingTop) || 0;
  // And how far off the bottom the card sits. Plain page margin now, but read
  // rather than assumed for the same reason as above.
  const below = parseFloat(getComputedStyle(el.overlay).paddingBottom) || 0;
  const box = el.pose.parentElement.getBoundingClientRect();   // .watch-stage
  if (!box.height) return;
  const gap = (innerHeight * GAP_VH) / 100;
  // What is left after the rail, the card and one gap at each end of the watch.
  // The top gap used to be the air under the viewport's own edge; it is now the
  // air under the rail, which is the same job against a different neighbour.
  const band = innerHeight - above - below - (innerHeight * sheet) / 100 - 2 * gap;
  const scale = Math.max(.24, Math.min(.72, band / box.height));
  // The band starts under the rail's clearance, not at the top of the viewport,
  // so the lift carries `above` where it used to carry nothing.
  const dy = (above + gap + (box.height * scale) / 2) - (box.top + box.height / 2);
  narrowPose = `translateY(${dy.toFixed(1)}px) scale(${scale.toFixed(3)})`;
}
// The pump would pick the breakpoint up within 100ms anyway; the listeners are
// so that a window drag reposes on the same frame the layout does.
NARROW.addEventListener('change', () => { measureNarrowPose(); render(); });
addEventListener('resize', () => { measureNarrowPose(); render(); });

const $ = (id) => document.getElementById(id);

const el = {
  pose: $('watchPose'),
  flip: $('watchFlip'),
  front: $('faceFront'),
  back: $('faceBack'),
  hour: $('hourHand'),
  min: $('minHand'),
  sec: $('secHand'),
  dateTens: $('dateTens'),
  dateOnes: $('dateOnes'),
  moonOrbit: $('moonOrbit'),
  reserveHand: $('reserveHand'),
  reserveBar: $('reserveBar'),
  caption: $('caption'),
  hintIndex: $('hintIndex'),
  rail: $('rail'),
  overlay: $('overlay'),
  crown: $('crown')
};

const panels = new Map(SECTIONS.map((s) => [s.key, $(s.panel)]));

// ---- THE RAIL --------------------------------------------------------------
// The navigation: the five SECTIONS rows and then CONTACT, one <a> each, in that
// order. Five of the six come from the same list the captions, the click targets
// and the panels come from. It is #hintBar promoted -- the sentence that used to
// name the live parts said the same thing in prose and could not be clicked --
// and the part names moved into the words.
//
// THERE IS NO REVEAL ORDER, so this list's order is only its reading order.
// Each link used to carry `a.style.setProperty('--i', i)` and the stylesheet
// delayed its arrival by --i * 90ms, which was a queue: five words going on one
// after another. It is gone, and the property with it -- nothing reads --i now,
// in this file or in index.html. The rail arrives on the same frame the
// interaction index is scribed (--rail-at is --hint-at), the index draws its
// five marks at one instant, and the two layers are naming the SAME five parts.
// A queue in one of them and not the other would have been the two halves of
// one statement disagreeing about whether the five are peers. See THE INTRO'S
// LAST BEAT and the arrival note on .rail in src/styles.css.
//
// THE SIXTH ITEM IS HERE, AND IT DOES NOT OPEN A PANEL.
// It was absent for as long as it had nowhere to go: Contact was to live on the
// caseback, that work was called off, and this project's rule for a section with
// no content is that it leaves the rail (docs/PLAN.md: "it doesn't ship: it
// leaves the rail"). It now has the destination docs/PLAN.md specified for it in
// the first place and that needs no content written for it -- "Contact lives on
// the back of the watch. A CONTACT control flips it there" -- so the rule is
// satisfied by the object rather than by a panel. There
// are still no contact details on the caseback; the word promises a movement and
// delivers one, and its caption (CAPTIONS.crown) says so in as many words.
//
// IT IS A PEER IN EVERY WAY THE RAIL CAN EXPRESS, and that took one decision
// each:
//   the address   `#/contact`, alongside the five. The caseback is a place you
//                 can be, so it is a place you can link to, reload into and walk
//                 Back out of -- see WHICH TRANSITIONS ARE HISTORY. This is the
//                 change that made CONTACT a link rather than a button: a real
//                 href that resolves to nothing would have been a broken
//                 middle-click sitting inside working navigation.
//   the marker    travels to CONTACT and stays lit while the watch is turned
//                 over, because the pointer's job is to say where you are and
//                 the caseback is now one of the six places that is. placeNow()
//                 is the one value it reads; nothing in the CSS changed.
//   the cue       hovering CONTACT lights the CROWN and prints the crown's
//                 caption, via hoverKeyOf() below. The reciprocal half comes
//                 free: the crown already writes state.hover, so a pointer on it
//                 lights the word.
//   the toggle    clicking it while it is lit puts it away, the same as the
//                 five. For them that is the panel going and the watch coming
//                 back off its pose; for CONTACT it is the watch turning back to
//                 the dial. This is what stops the crown -- ~30px on a 335px
//                 phone watch -- from being the only way off the caseback.
// The one thing it does not take is THE TOUCH CUE's 600ms delay -- see the click
// handler.
const railLinks = new Map();
// A rail key is a state.hover key for the five; CONTACT's part is the crown, and
// this is the only place the two vocabularies have to be told apart.
const hoverKeyOf = (key) => (key === CONTACT.key ? CONTACT.hover : key);
el.rail.append(...[...SECTIONS, CONTACT].map((s) => {
  const a = document.createElement('a');
  a.className = 'rail-link';
  // A real href, so the link behaves like one -- middle-click, copy link
  // address, the status bar. All six resolve: routeKey() knows the five section
  // keys and CONTACT's, and every one of them names somewhere the site can be.
  // The fragment deliberately matches no element id, so the default action is a
  // route change rather than a scroll when it does get through.
  a.href = `#/${s.key}`;
  a.dataset.key = s.key;
  a.textContent = s.label;
  railLinks.set(s.key, a);
  return a;
}));

// ---- THE THREE UNDER CONTACT -----------------------------------------------
// EMAIL, GITHUB and LINKEDIN, as real links, hanging off the sixth word. They
// are the caseback's three wheels said in words: an engraved hub says "Gmail",
// not where it goes, so the wheels are the prettier half and the illegible one.
// These are the half you can read, tab to, and copy a link address from.
//
// THEY ARE NOT PEERS, AND THE RAIL SAYS SO IN ITS OWN VOCABULARY. No graduation,
// no datum beside them, and the pointer never visits: the scale graduates the
// six places you can BE, and these three are not places on this site. What they
// take from the ladder is the WORDS' own ink at 13px against the column's 20 --
// full ink because they are live controls and light is this site's only word for
// "live", and because a tier down would have put a 13px link under 4.5:1. The
// subordination is carried by size and by being off the scale, which is the one
// hierarchy device this rail has that is not a box. See THE THREE UNDER CONTACT
// in src/styles.css.
//
// THEY APPEAR WHEN CONTACT IS WHERE YOU ARE -- placeNow() === CONTACT.key, the
// same value the pointer and the lit word already read, so there is no second
// state to keep in step, no aria-expanded, and no question about whether opening
// them flips the watch (the flip IS the opening). It is a sublist under the
// current item, not a disclosure, and CONTACT's behaviour is untouched: it
// routes, it flips, and re-clicking it closes -- which now also puts these away.
//
// ALWAYS-VISIBLE WAS MEASURED AND IT DOES NOT FIT, in either layout:
//   the column   the rail's clearance table (THE RAIL in styles.css) already
//                runs NEGATIVE for FIELD NOTES and CONTACT at 1440x900 with a
//                panel open -- the posed case is a 278.6px circle about
//                (316.8, 450) and CONTACT's box is inside it. Three more rows
//                carry LINKEDIN's corner to 236px from that centre, 42px inside
//                the case, which is twice the worst overlap the rail has ever
//                accepted. Tied to the flip they are never on screen with a
//                posed case at all: the caseback has no panel, the watch is
//                centred at 86vmin, and the nearest corner clears it by ~206px.
//   the top row  the row is at its measured limit -- 345.5px of ink in a 351px
//                box at 390px, and FIELD NOTES' extra character has already been
//                paid for out of the word space and the gaps. Three more words
//                IN it is 130px it does not have. They stay a stack and go BELOW
//                the marker channel instead, out of flow, so the row is still
//                six words on one line and pays nothing -- and that stack is
//                only there while the watch is turned over.
// So nothing is hidden on narrow screens: the phone gets the same three words in
// the same arrangement and the same state the desktop gets them.
const railContacts = document.createElement('div');
railContacts.className = 'rail-contacts';
railContacts.hidden = true;
const railContactLinks = [
  { key: 'email', label: 'Email' },
  { key: 'github', label: 'GitHub' },
  { key: 'linkedin', label: 'LinkedIn' }
].map(({ key, label }) => {
  const a = document.createElement('a');
  a.className = 'rail-contact';
  // The same data-link the caseback's wheels carry, because it is the same key:
  // state.hover, CAPTIONS and LINK_HREF are all read with it, so hovering the
  // word prints the full address in the caption exactly as hovering the wheel
  // does. One vocabulary, two ends.
  a.dataset.link = key;
  a.href = LINK_HREF[key];
  a.textContent = label;
  if (key === 'email') {
    // The accessible name says what it does, not where the href goes. This is
    // the honest half of the trade made in LINK_HREF: the element is still an
    // <a href="mailto:">, so it still degrades and still middle-clicks, and the
    // name is what stops it announcing as a link to a mail client it will not
    // open. Set here rather than in the markup so it cannot drift from EMAIL.
    a.setAttribute('aria-label', `Copy email address ${EMAIL}`);
  } else {
    a.target = '_blank';
    a.rel = 'noopener';
    // The host and path in full, from the href itself rather than from LINKS --
    // LINKS is the caption's SHORTENED reading and the LinkedIn one drops the
    // id, which is fine to print under a pointer and wrong to read out as the
    // destination.
    a.setAttribute('aria-label',
      `${label}, at ${LINK_HREF[key].replace(/^https?:\/\//, '')} (opens in a new tab)`);
  }
  railContacts.append(a);
  return a;
});
el.rail.append(railContacts);

// Where you are. A short gold hairline in the marker channel, level with the
// open section, which travels to the next one over 200ms instead of fading out
// and in -- one pointer along a scale, the gesture the reserve hand already
// makes against AUF/AB. It is one element for all six positions, which is what
// makes travel the only thing it CAN do.
const railMarker = document.createElement('span');
railMarker.className = 'rail-marker';
railMarker.setAttribute('aria-hidden', 'true');
el.rail.append(railMarker);   // last child: the CSS reaches it with `~`

// Both centres are written every time and the stylesheet uses whichever one is
// its own axis -- vertical in the column, horizontal in the top row. That is
// deliberate: it keeps the 1200px breakpoint written once, in CSS, instead of
// copying it into a matchMedia here that could drift from it. offsetTop and
// offsetLeft are measured from the same padding edge the marker's own left/top
// of 0 resolves to, so there is no origin to correct for in either layout.
//
// It follows placeNow() and not state.active, which is what puts the mark on
// CONTACT while the watch is turned over. Six destinations, one pointer.
let markerAt = null;
function placeRailMarker(force) {
  const at = placeNow();
  if (!force && markerAt === at) return;
  const node = at ? railLinks.get(at) : null;
  // A hidden rail measures zero; keep the last good value rather than parking
  // the mark at the top of a box that is not being laid out.
  if (node && !node.offsetHeight) return;
  markerAt = at;
  if (!node) return;   // nothing open -- CSS fades the mark out where it stands
  el.rail.style.setProperty('--mx', `${(node.offsetLeft + node.offsetWidth / 2).toFixed(1)}px`);
  el.rail.style.setProperty('--my', `${(node.offsetTop + node.offsetHeight / 2).toFixed(1)}px`);
}
// The rail's own box changes when the layout flips to the bottom row and on
// every resize while it is there, and both move the items out from under the
// mark. A ResizeObserver rather than a resize listener for the reason
// hintHairline() uses one: it is coalesced to one callback per frame after
// layout, so it cannot read a stale box.
new ResizeObserver(() => placeRailMarker(true)).observe(el.rail);

// Where the reserve hand sits at rest: the first notch above AB, measured off
// the scale sprite rather than guessed. Alpha-scanning reserve-scale.webp's
// largest connected component about the arc centre that tools/build-dial-art.py
// fits (R = 13.673% of the face, one sprite-width left of the sprite box) finds
// the tick ink straddling the arc line at radius 13.15..14.38% -- comfortably
// inside the AUF/AB legends, which start at 16.2% -- in eleven clusters:
//
//   40.33 (AUF stop) 49.58 59.04 68.95 78.79 88.74 98.55 108.23 118.03
//   127.84 139.36 (AB stop)
//
// The nine interior ticks are ~9.8deg apart; the AB stop is 11.5deg below the
// lowest of them, with no ink of any opacity in between, because the arc's last
// segment is drawn as a dark low-power zone running from that tick down to the
// stop. So the first notch above AB is unambiguously the 127.84deg tick, and
// inverting the pointer mapping below gives (138.9 - 127.843) / 98.2.
//
// An inversion was tried on 11 Aug 2026 -- rest at AUF, scrolling running the
// reserve down -- and withdrawn the same day on Nikhil's "revert these changes
// to the power display. Have it point at AB originally and the resume bar be
// empty with ab on the left and auf on the right and scrolling down mamkes its
// grow". Nothing of it survives; the record is here so it is not tried twice.
const RESERVE_REST = 0.1126;

// The printed scale, unchanged. 0deg points at 12 for every hand; the scale
// sprite's end stops measure out at 40.7deg (AUF, full) and 138.9deg (AB,
// empty) about the arc's own centre -- see tools/build-dial-art.py -- so the
// printed scale is exactly 98.2deg wide. reserveDeg() is the pointer mapping
// every non-demo reading goes through, and it is the definition of "on scale".
const RESERVE_AUF = 40.7;
const RESERVE_AB = 138.9;
const RESERVE_SCALE = 98.2;
const reserveDeg = (r) => RESERVE_AB - r * RESERVE_SCALE;

// The demo's arc is wider than the printed one, on purpose: the hand is meant
// to visibly run past both ends rather than pile up against them. 160 - 98.2
// leaves 61.8deg of overshoot, and it is split evenly, 30.9deg beyond each end.
//
// Centred rather than biased, for a reason that is mechanical and not just
// tidy. The sweep below is a cosine, so the hand is at its fastest crossing the
// middle of its travel and decelerates into both extremes. Centring puts the
// printed scale in the middle of that travel: the hand rips across the part
// that is legible and dwells at the two points where it is off the scale, which
// is exactly where the overshoot needs to be visible to read as deliberate.
// Biasing the split would move the printed scale off the cosine's centre, so
// one extreme would dwell and the other would be clipped through at speed, and
// the two ends of the oscillation would no longer look like the same gesture --
// unequal extremes read as a calibration fault rather than as a flourish.
const RESERVE_OVER = (DEMO.reserveSweepDeg - RESERVE_SCALE) / 2;  // 30.9 each end
const RESERVE_DEG_HI = RESERVE_AB + RESERVE_OVER;    // 169.8, past AB
const RESERVE_DEG_LO = RESERVE_AUF - RESERVE_OVER;   // 9.8, past AUF

const state = {
  active: null,
  hover: null,
  flipped: false,
  reserve: RESERVE_REST,
  touched: false,
  demo: null,  // { t0, reduced } while the pusher's sweep is running
  // What the caption has to say instead of itself for a moment: { text, until }.
  // Only ever a failed copy now -- the successful one is the mark against the
  // control that was clicked, see showCopyMark(). Written by copyEmail() and
  // expired by render() reading the clock, which is
  // state.demo's own arrangement and for the same reason -- a timer that wrote
  // the caption directly would be a second author of a line that already has
  // one, and it would fight the hover state that owns it. Here the notice is
  // just another branch of the one expression, so the pointer moving on cannot
  // erase it and it cannot outlive its own deadline.
  notice: null,
  // The element a panel was opened from, so closing can hand focus back to it
  // rather than dropping it on <body> and starting the next Tab from the top.
  returnTo: null
};

// WHERE THE VISITOR IS, AS ONE VALUE: a section key, CONTACT's key, or null for
// the bare watch. state.active and state.flipped are two fields, but they have
// always been mutually exclusive -- flipping closes any open panel, and every
// part that opens one is on the front face -- so the pair only ever expresses
// three-and-a-bit of its four states. Collapsing them here is what lets the rail,
// the marker and the address bar each read ONE thing: six destinations, one
// pointer, one hash. Nothing writes through this; it is a view, not a field.
const placeNow = () => (state.flipped ? CONTACT.key : state.active);

function moonAge(now) {
  let age = ((now - KNOWN_NEW_MOON) / 86400000) % SYNODIC_DAYS;
  if (age < 0) age += SYNODIC_DAYS;
  return age;
}

function watchPose() {
  if (!state.active) return { transform: 'none', filter: 'none', origin: '50% 50%' };
  if (CONFIG.transitionStyle === 'zoom') {
    const section = SECTION.get(state.active);
    return { transform: 'scale(1.55)', filter: 'blur(6px) brightness(.5)', origin: (section && section.origin) || '50% 50%' };
  }
  if (CONFIG.transitionStyle === 'panel') {
    // Narrow: up and smaller instead of left and smaller, into the band above
    // the card. The dimming is unchanged -- the watch reads exactly the
    // same, it is just somewhere else. See measureNarrowPose() for the numbers.
    if (NARROW.matches && narrowPose) {
      return { transform: narrowPose, filter: 'brightness(.62) saturate(.82)', origin: '50% 50%' };
    }
    return { transform: 'translateX(-28vw) scale(.72)', filter: 'brightness(.62) saturate(.82)', origin: '50% 50%' };
  }
  return { transform: 'scale(.5)', filter: 'blur(6px) brightness(.3)', origin: '50% 50%' };
}

function render() {
  const now = Date.now();
  const d = new Date(now);

  // The demonstration, as two numbers the writes below lean on:
  //   demoT  raw 0..1 progress, or -1 when nothing is running
  //   spin   the eased term every offset is scaled by; 0 when nothing is
  //          running, so the expressions collapse back to the live values.
  // The demo expires here rather than on a timer, which means the frame that
  // clears it is also the frame that draws the true reading.
  let demoT = -1;
  let spin = 0;
  if (state.demo) {
    const t = (now - state.demo.t0) / (state.demo.reduced ? DEMO.reducedMs : DEMO.ms);
    if (t >= 1) state.demo = null;
    else if (!state.demo.reduced) { demoT = t; spin = 1 - (1 - t) * (1 - t); }
  }
  const demoing = demoT >= 0;

  // The section's salute, the same two numbers per part -- see THE SECTION'S
  // SALUTE. Entries expire here for the reason state.demo does: the frame that
  // clears one is the frame that draws the true reading, so there is no tick
  // where a part is home but still being offset.
  // The reserve is the one part with a duration of its own -- 900ms, not the
  // demonstration's four seconds. THE RELEASE LIVES HERE AND NOWHERE ELSE: an
  // entry is dropped by this loop reading the clock, so nothing has to fire, no
  // completion event has to arrive, and every way the animation can be
  // interrupted -- the panel closed, the watch flipped, the section reopened,
  // the reduced-motion setting flipped mid-flight -- still ends with the entry
  // gone and the part back on its live reading. A hand left detached from its
  // scroll would be a worse bug than the one this fixes, so the release is not
  // allowed to depend on anything but time.
  const lifeOf = (part) => (part === 'reserve' ? DEMO.reserveMs : DEMO.ms);
  for (const [part, s] of SALUTE) if (now - s.t0 >= lifeOf(part)) SALUTE.delete(part);
  // The demonstration outranks it. The demo is already turning every part,
  // including this one, and letting both write would add two offsets to one hand
  // and land it a fraction of a turn from home. Suspended rather than cancelled:
  // the entry keeps expiring on its own clock underneath.
  const saluteT = (part) => {
    if (demoing) return -1;
    const s = SALUTE.get(part);
    return s === undefined ? -1 : (now - s.t0) / lifeOf(part);
  };
  // The demonstration's own easing, so the two motions are the same gesture.
  const saluteSpin = (part) => {
    const t = saluteT(part);
    return t < 0 ? 0 : 1 - (1 - t) * (1 - t);
  };

  let sec = d.getSeconds() + d.getMilliseconds() / 1000;
  if (CONFIG.secondsMotion === 'mechanical') sec = Math.floor(sec * 6) / 6;
  else if (CONFIG.secondsMotion === 'quartz') sec = Math.floor(sec);
  const min = d.getMinutes() + sec / 60;
  const hr = (d.getHours() % 12) + min / 60;

  // The translateZ rides on the same declaration as the rotate because it has
  // to: this line rewrites `transform` wholesale ten times a second, so a
  // resting height left in the stylesheet would be thrown away on the first
  // tick. The heights themselves stay in CSS -- see THE DEPTH BUDGET in
  // src/styles.css -- so this is the only place that knows there IS a height,
  // not what it is.
  // 0 turns of offset when idle, from either author. `part` is the salute's
  // name for this element; the demo's `spin` is unconditional because the demo
  // is every part at once, and the two are never non-zero together.
  const wind = (turns, part) => turns * 360 * (spin + saluteSpin(part));
  const angHour = hr * 30 + wind(DEMO.turns.hour, 'mainDial');
  const angMin = min * 6 + wind(DEMO.turns.min, 'mainDial');
  const angSec = sec * 6 + wind(DEMO.turns.sec, 'sec');
  el.hour.style.transform = `rotate(${angHour.toFixed(2)}deg) translateZ(var(--z-hand-hour))`;
  el.min.style.transform = `rotate(${angMin.toFixed(2)}deg) translateZ(var(--z-hand-min))`;
  el.sec.style.transform = `rotate(${angSec.toFixed(2)}deg) translateZ(var(--z-hand-sec))`;

  // The date runs whole months forward, so the wrap lands on today again. The
  // eased rate is already under one day per second past t~0.9, so the true date
  // is showing well before the demo clears -- no jump on the last frame.
  //
  // THE ONE NIKHIL NAMED. "if i click the date dispay, itll spin" -- the outsize
  // date is Projects, and this is the same whole trip through 01..31 the pusher
  // runs, driven by whichever of the two is going.
  let date = d.getDate();
  const dateSpin = spin + saluteSpin('date');
  if (dateSpin > 0) date = ((date - 1 + Math.round(dateSpin * DEMO.dateTurns * 31)) % 31) + 1;
  el.dateTens.textContent = Math.floor(date / 10);
  el.dateOnes.textContent = date % 10;

  // The starfield is engraved on the lunar wheel itself, so sky and moon share one rotation.
  const age = moonAge(now);
  const moonDeg = ((age / SYNODIC_DAYS) * 180 - 90 + wind(DEMO.turns.moon, 'moon')).toFixed(2);
  el.moonOrbit.setAttribute('transform', `rotate(${moonDeg} 50 50)`);

  // The reserve sweeps instead of spinning, and it now sweeps WIDER than the
  // scale -- 160deg against the printed 98.2, running 30.9deg off each end.
  //
  // That is why the demo drives an angle here rather than a `reserve` value.
  // The value is normalised to the printed scale and is clamped to [0,1], and
  // that clamp is precisely the thing that used to pin the hand to the stops
  // for a beat; nothing expressed in those units can go off-scale by
  // construction. So the demo works in its own coordinate `v`, 0 at the far
  // side of AB and 1 at the far side of AUF, and only the printed reading is
  // converted into it. `reserveOver` retires with the clamp: with no stop to
  // beat against, the overshoot is the cosine's own turnaround.
  //
  // `sweep` is that cosine, phased to start exactly at the true reading so the
  // press does not jump the hand before it moves it. `reach` is how much of the
  // gap between the sweep and the truth is let through: 1 gives the full 160deg
  // whatever the true reading is (which a fixed +/- amplitude could not, since
  // the rest position is nearly nine times as far from AUF as from AB), and 0
  // pins the hand on the truth.
  //
  // Damping the amplitude from the first frame is what used to guarantee the
  // clean landing, and it is also why the hand never got near AB: by the second
  // swing there was nothing left. So reach is HELD at full travel instead, and
  // released only over the last 15% on a smoothstep, whose slope is zero at
  // both ends -- no kink where the release begins, and zero value AND zero
  // slope at t = 1. Both halves of the settle survive the move into angle
  // space: at reach = 0 the expression collapses to v0 exactly, and the
  // smoothstep's zero slope still lands it there with zero velocity, so the
  // hand coasts rather than stops dead. What it coasts onto is the FROZEN
  // reading and not necessarily the live one -- see THE HAND LET GO OF THE
  // SCROLL below, which is where the difference between the two is settled.
  const reserveTrue = Math.min(1, Math.max(0, state.reserve));
  let reserveAngle = reserveDeg(reserveTrue);
  // ---- THE HAND LET GO OF THE SCROLL ---------------------------------------
  // Nikhil, 11 August 2026: "So delink the hand position to the resume wind top
  // bar until the animation is done, then have it snap to where the hand is".
  //
  // The reserve is the one part whose truth a reader can MOVE while the
  // animation is running: state.reserve is written by the Resume panel's scroll
  // handler, and this sweep used to be phased off it every frame. Scrolling
  // during the animation therefore re-derived `phase` under the cosine, which is
  // not a hand being wound -- it is two authors arguing at 60fps.
  //
  // So the sweep runs against `base`, the reading frozen when the animation
  // started, and stops asking after that. Nothing suspends the scroll handler
  // itself: it keeps writing state.reserve, the panel's own readout keeps
  // following the reader honestly (see the bar below), and it is only THIS HAND
  // that is deaf for 900ms.
  //
  // AND THEN IT SNAPS, in the strict sense. The landing is no longer a coast
  // onto `base`: the frame after the entry expires draws reserveDeg(live) with
  // no offset at all, so the hand arrives at whatever the mapping says AT THAT
  // MOMENT rather than at the reading it left. If the reader has scrolled, that
  // is a jump, and it is the jump that was asked for -- which is why the
  // transition stays suppressed for one frame longer than the animation (below).
  //
  // THE MAPPING IS NOT REIMPLEMENTED OR CACHED HERE. This reads state.reserve,
  // which is the mapping's one output, and it reads it fresh. The scroll
  // handler is free to invert its ramp, change its anchor or change direction
  // without this block knowing -- which it is doing, concurrently.
  //
  // Everything else the demo drives keeps its own time: the seconds hand, the
  // guilloche and the moon are not touched by any of this.
  const resRun = demoing
    ? { t: demoT * DEMO.ms / DEMO.reserveMs, base: state.demo.reserveFrom }
    : (() => { const s = SALUTE.get('reserve'); const t = saluteT('reserve'); return t < 0 ? null : { t, base: s.base }; })();
  // The demonstration's reserve is finished long before the rest of the dial is
  // -- 900ms of a four-second press -- and after that the hand sits true while
  // the hands run on. One motion, one duration, two callers.
  const resAnim = resRun && resRun.t <= 1 ? resRun : null;
  if (resAnim) {
    const u = Math.min(1, Math.max(0, (resAnim.t - DEMO.reserveHold) / (1 - DEMO.reserveHold)));
    const reach = 1 - u * u * (3 - 2 * u);
    const span = RESERVE_DEG_HI - RESERVE_DEG_LO;          // the 160deg travel
    const base = Math.min(1, Math.max(0, resAnim.base));
    const v0 = (RESERVE_DEG_HI - reserveDeg(base)) / span;  // the frozen reading, in demo units
    const phase = Math.acos(1 - 2 * v0);
    const sweep = 0.5 - 0.5 * Math.cos(2 * Math.PI * DEMO.reserveCycles * resAnim.t + phase);
    reserveAngle = RESERVE_DEG_HI - (v0 + reach * (sweep - v0)) * span;
  }
  // .reserve-hand carries a .6s transition for the scroll-driven wind, which
  // would smear a per-frame sweep into a lagging blur. Suppressed while the
  // animation runs, and FOR ONE FRAME AFTER IT: that trailing frame is the snap
  // onto the live reading, and a snap through a .6s ease is not a snap -- it is
  // the same fight moved into the compositor. reserveSnapping carries the fact
  // across exactly one frame and no more, so the reader's next scroll gets its
  // eased hand back.
  el.reserveHand.style.transition = (resAnim || reserveSnapping) ? 'none' : '';
  reserveSnapping = !!resAnim;
  el.reserveHand.style.transform = `rotate(${reserveAngle.toFixed(1)}deg) translateZ(var(--z-hand-res))`;
  // THE BAR IS THE READER'S, NOT THE HAND'S. It used to be derived from the
  // hand's angle, which meant a press or an opening whipped the panel's readout
  // through 160deg of travel the reader had not asked for -- the delink Nikhil
  // asked for is exactly this line. It reads state.reserve, so during the
  // animation it goes on saying where the reader has scrolled to, and when the
  // hand lands the two agree again because they are then the same number.
  // Off the animation this is what it always was: reserveDeg() inverted is
  // state.reserve, so nothing changes for the scroll it was written for.
  el.reserveBar.style.width = `${Math.round(reserveTrue * 100)}%`;

  // The status line, on its own four-second clock. The caption below is its only
  // reader now that the panel it also fed has gone.
  const cur = CURRENTLY[Math.floor(now / 4000) % CURRENTLY.length];

  // The blocked-copy line, expired against the same clock the demo is. It
  // outranks hover for the reason the demo does, and it is the whole reason it
  // has to: the pointer is still on the word it was clicked on, so what this
  // line would otherwise print is the address on its own, and the reader would
  // never learn that the copy did not happen. Cleared here rather than on a
  // timeout so there is exactly one writer -- see state.notice.
  if (state.notice && state.notice.until <= now) state.notice = null;

  // The demo outranks hover: the cursor is still on the pusher that started it,
  // and under reduced motion this line is the only feedback the press gets.
  el.caption.textContent = state.demo
    ? (state.demo.reduced
        ? 'DEMONSTRATION SKIPPED — REDUCED MOTION'
        : 'DEMONSTRATION — ALL FUNCTIONS IN MOTION')
    : state.notice
    ? state.notice.text
    : state.hover
    ? CAPTIONS[state.hover]
    : state.active
      ? ''
      : state.flipped
        ? 'CLICK THE CROWN TO TURN BACK'
        // The status line, and nothing else. It used to end "   ·   CROWN TO
        // FLIP", a mode line inherited from the hint sentence the rail replaced,
        // parked here because the rail said where you can GO and the crown did
        // not go anywhere. The rail says it now: CONTACT is the sixth word and
        // turning the watch over is where it goes. A caption that kept
        // advertising the crown would be the site telling you twice, in the one
        // state where it has something of its own to say.
        : `CURRENTLY ${cur.label} — ${cur.value.toUpperCase()}`;

  const pose = watchPose();
  el.pose.style.transform = pose.transform;
  el.pose.style.filter = pose.filter;
  el.pose.style.transformOrigin = pose.origin;

  el.flip.style.transform = `rotateY(${state.flipped ? 180 : 0}deg)`;
  el.front.style.opacity = state.flipped ? 0 : 1;
  el.back.style.opacity = state.flipped ? 1 : 0;
  el.back.classList.toggle('is-flipped', state.flipped);
  // THE HIDDEN FACE IS STILL IN THE TAB ORDER. The two lines above and
  // `backface-visibility: hidden` on .face answer the paint question and only
  // the paint question: the face turned away stops being drawn, and .face-back
  // is deliberately left flat so nothing inside it hit-tests through the front
  // (see THE FLATTENING / BACKFACE PROBLEM in styles.css). Neither invisible
  // nor untouchable means unfocusable. Without this, turning the watch over
  // leaves ABOUT, the date window, the reserve, the seconds dial and the moon
  // as the next five tab stops behind the caseback -- five buttons a keyboard
  // can reach and press to open a section off a face nobody can see.
  // inert is the primitive the intro's gate uses, for the same reason: it
  // closes the tab stop, Enter and Space, and the accessibility tree along with
  // the pointer (see INERT, NOT pointer-events below). Paint is not one of the
  // doors it closes, so .hover-pulse and its marks inside .face-front are
  // untouched -- they are decorative, never focusable, and lit from
  // .watch-flip[data-hover], which is above both faces.
  // Both faces and not just the front: the caseback carries no control today,
  // but it is where CONTACT goes, and the first link engraved on it would
  // otherwise be tabbable through the dial the moment it is added.
  // Harmless during the intro -- inert is inherited, so el.flip.inert holds the
  // whole subtree shut regardless of what these two say.
  el.back.inert = !state.flipped;
  el.front.inert = state.flipped;
  if (state.flipped) rigPlay(); else rigStop();

  el.overlay.hidden = !state.active;
  el.overlay.dataset.justify = CONFIG.transitionStyle === 'panel' ? 'flex-end' : 'center';
  // BEFORE the panels are hidden, not after, and that ordering is the whole
  // reason this line is not down with them. shotsRun(false) also closes the
  // enlarged frame, and a <dialog> in the top layer stops generating a box the
  // moment an ancestor goes display: none -- so it has to be closed while the
  // card is still on screen, or the picture would still be "open" behind a
  // hidden panel and its focus would have nowhere to return to. Same reasoning
  // as rigPlay/rigStop above: state is the signal, never a poll.
  shotsRun(state.active === 'projects');
  for (const [key, node] of panels) node.hidden = state.active !== key;

  // The interaction index recedes the moment the watch has been understood:
  // any click sets state.touched, and the scribed marks go with it.
  el.hintIndex.hidden = !(CONFIG.showHints && !state.touched && !state.active && !state.flipped);
  // The rail does NOT recede with it, and no longer hides behind an open panel
  // as the sentence it replaced did. It is navigation now: it sits above the
  // overlay so you can go section to section without closing one first, and it
  // stays up on the caseback so the way back to a section is always on screen.
  el.rail.hidden = !CONFIG.showHints;

  // The rail, painted from the same two fields the watch is painted from. This
  // is the reciprocal cue's second half: state.hover already lights the part and
  // names it in the caption, so a pointer on the moonphase lighting the word
  // FIELD NOTES costs one more reader of the same value -- there is no second
  // state, and no way for the two ends to disagree. CONTACT joins on the same
  // terms through hoverKeyOf(): its part is the crown, so a pointer on the crown
  // lights it and a pointer on it lights the crown.
  // Active outranks hover, so the word you are reading stays the word that is
  // lit while the pointer wanders. It is placeNow() and not state.active, which
  // is what keeps CONTACT lit for as long as the watch is turned over. Written
  // only on change: render() also runs on a 100ms pump, and an unconditional
  // write would restyle six links ten times a second and retrigger the colour
  // transition on each.
  const at = placeNow();
  for (const [key, node] of railLinks) {
    const want = at === key ? 'active' : state.hover === hoverKeyOf(key) ? 'hover' : '';
    if (node.dataset.state === want) continue;
    node.dataset.state = want;
    if (want === 'active') node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  }
  // The three under CONTACT, on the same one value. `hidden` and not opacity,
  // so they leave the tab order and the accessibility tree together with the
  // paint -- three links a keyboard could reach behind a dial they are not on
  // would be the same fault el.back.inert exists to prevent.
  const wantContacts = at === CONTACT.key;
  if (railContacts.hidden !== !wantContacts) {
    // Hiding the box focus is standing in throws that focus on <body>. CONTACT
    // is where it belongs: it is the word these three hang off, it is still on
    // screen, and it is the control that put them away. Same rule the panels and
    // the caseback follow, arrived at from the other side. The hide comes first
    // and the move second, so the focus event this fires arrives at a render()
    // that already agrees with itself -- see the [hidden] toggle above.
    const rescue = !wantContacts && railContacts.contains(document.activeElement);
    railContacts.hidden = !wantContacts;
    if (rescue) railLinks.get(CONTACT.key).focus({ preventScroll: true });
  }
  placeRailMarker();

  // This one attribute IS the hover highlight's whole state. The CSS rule that
  // carries it only matches while data-hover names the part, so '' -> 'field-notes'
  // starts the arrival and holds the glow, and 'field-notes' -> '' releases it -- the
  // mark is lit if and only if this string names it, which is what makes a
  // stuck highlight impossible to express. render() is also pumped on a 100ms
  // interval, so the value is only written when it actually differs -- an
  // unconditional write is a restyle of the whole layer ten times a second, and
  // any future :hover-adjacent rule would flicker on it.
  //
  // It is written on .watch-flip rather than on the .hover-pulse layer because
  // the highlight now covers seven parts and two of them, the crown and the
  // corrector, are siblings of the front face rather than children of it. The
  // flip is the nearest element containing all seven marks.
  //
  // THE CASEBACK KEEPS ITS FITTINGS LIT. An open panel still blacks the whole
  // highlight out -- you are reading, not pointing. Turning the watch over used
  // to do the same, and for the five dial parts it still does: they are face-up
  // furniture and there is nothing to light. But the crown and the corrector
  // are fittings in the case band. They are visible from the back, they are
  // still clickable from the back, and the crown is the way back to the dial
  // that is ON the watch -- the rail's lit CONTACT is the other one, and it is
  // not part of this layer at all. Suppressing their highlight there would mean
  // the control you reach for first is the one control that stops answering,
  // which is a worse version of the bug this pass exists to fix.
  // The five dial marks need no guard of their own -- .face-front is
  // backface-hidden, so past 90deg it is neither painted nor hit-tested and
  // state.hover cannot become a dial part -- but the test is written on the
  // fittings rather than against the parts so that a hover left STALE by the
  // flip (the pointer was on the moon when the crown was clicked) cannot leak
  // a lit mark onto the back of the watch.
  const onFitting = state.hover === 'crown' || state.hover === 'pusher';
  const lit = (state.active || (state.flipped && !onFitting)) ? '' : (state.hover || '');
  if (el.flip.dataset.hover !== lit) el.flip.dataset.hover = lit;
}

// Showing and hiding are the two places focus moves on its own, and they are
// pairs: showSection() remembers what it was opened from and puts focus on the
// panel, hideSection() puts it back; showContact() and hideContact() both leave
// it on the crown, which is the control that turns the watch over and the way
// back that lives on the watch itself. Both hides take a keepFocus flag for the
// callers that have somewhere better to put it than their own default -- the
// caseback closing a panel on its way in, and a rail word closing itself, which
// wants focus to stay on the word that was clicked. Nothing is trapped -- Tab
// still walks out of the card and on through the page -- but the keyboard never
// has to start again from the top of the document, which is what "lost focus"
// actually feels like.
//
// These four move STATE ONLY. They know nothing about the address bar, and
// nothing outside the routing block below calls them: every control that
// navigates goes through goTo() / leave(), which is what keeps the address and
// the watch from ever disagreeing. They also do not set state.touched --
// arriving on a link is not operating the watch; see goTo().
function showSection(key, from) {
  state.active = key;
  state.hover = null;
  // THE FLIP. It lives down here rather than up in the intent function, goTo(),
  // because it is an invariant of the state and not of the
  // click: every section is on the FRONT of the watch, so a panel must never
  // open over the back of one. The rail stays up while the watch is turned over,
  // so a section can be asked for from the caseback -- and so can Back, Forward
  // and a pasted address, which are the paths that do not pass through goTo() at
  // all. It is the only place a route to a section unflips the watch, which is
  // why applyRoute() below does not have to say it a second time.
  if (state.flipped) state.flipped = false;
  // Falling back to the section's own hit target rather than to null: Back and
  // Forward open panels with no originating element, and a keyboard that leaves
  // one of those has to land somewhere better than the top of the document. The
  // part that owns the section is the honest answer, and it is the same place a
  // click would have come from.
  state.returnTo = from || $(SECTION.get(key).hit);
  // THE SALUTE, from the one place every route into a section passes through --
  // the dial part, the rail word, an edited hash, Back and Forward. Putting it
  // here rather than in the click handlers is what makes "the same animation"
  // true of all of them instead of of the two that were easiest to reach.
  //
  // EXCEPT A COLD ARRIVAL. `arrived` is false only for the applyRoute() at the
  // foot of this file, which is the address the visitor loaded on. Someone
  // opening a shared #/projects link has not clicked the date; the watch would
  // be performing at a page it has not been asked anything by, over the top of
  // the intro assembly. The salute answers an action, so it waits for one.
  if (arrived) startSalute(key);
  render();
  const panel = panels.get(key);
  // After render(), because the panel is [hidden] until then and a hidden
  // element cannot take focus. tabindex="-1" on .card is what makes this legal.
  if (panel) panel.focus({ preventScroll: true });
}

// keepFocus is for the one caller that has somewhere better to put it:
// showContact() closes any open panel on its way to the caseback, and handing
// focus back to a dial part that is now facing away from you would be worse than
// leaving it alone.
function hideSection(keepFocus) {
  if (!state.active) return;
  // THE SAME FLICK ON THE WAY OUT. Nikhil, 11 August 2026: "make the same
  // animation that happens on clicking a front face compontent happen when you
  // exit". Here rather than in any of the five controls that close, for the
  // reason showSection() carries the opening one: this is the door they all go
  // through -- the card's close control, Escape, a re-clicked rail word, the
  // crown, an edited hash, Back and Forward all reach it via leave() or
  // applyRoute(), and none of them can close a panel without it.
  //
  // Read before state.active is cleared, which is the whole reason this line is
  // the first one in the function.
  //
  // NO `arrived` GUARD, and none is needed: there is no such thing as a cold
  // exit. Nothing is closed before something was opened.
  startSalute(state.active);
  state.active = null;
  const back = state.returnTo;
  state.returnTo = null;
  render();
  if (!keepFocus && back && back.isConnected) back.focus();
}

// The caseback, which the rail's CONTACT and the crown both ask for. It is
// showSection()'s opposite number rather than a special case of it: no panel, no
// returnTo, and the focus lands on the crown by default in and out, because the
// crown is what turned the watch over and is the nearest thing to a handle on
// the back of the watch. It is no longer the ONLY way back -- re-clicking the
// lit CONTACT turns the watch over the other way, which is what hideContact()'s
// keepFocus below exists for.
function showContact() {
  // A panel and the caseback are mutually exclusive, so arriving here closes one
  // if it is open. This is where THE FLIP's invariant is enforced from the other
  // side, and it does not touch the address: applyRoute() is the address's
  // reader, never its writer.
  hideSection(true);
  state.hover = null;
  state.flipped = true;
  // Turning the watch over takes the dial out of view, so the sweep is abandoned
  // rather than left to finish behind the caseback. Cancelling drops every offset
  // to zero, which the next frame draws as the true reading -- and the face it
  // happens on is the one you cannot see.
  state.demo = null;
  // And any salute still turning, for the same reason and with the same result:
  // dropping the offset leaves the true reading, drawn on the face now pointing
  // away from you.
  //
  // INCLUDING THE EXIT FLICK the hideSection() above has just started, and that
  // is deliberate rather than an accident of ordering. The crown is the one exit
  // that takes the dial away with it: a part performing at the back of the case
  // is a part performing at nobody, and it would still be mid-flight when the
  // flip finished. The flip IS the acknowledgement in that direction.
  SALUTE.clear();
  render();
  el.crown.focus({ preventScroll: true });
}

// keepFocus is hideSection()'s parameter, with the same meaning and for the same
// kind of caller. The crown is where focus belongs when the watch turns back over
// with nowhere better to send it -- Escape, the crown itself, Back -- but the one
// caller that HAS somewhere better is the rail's CONTACT closing itself: the word
// is under the pointer, it is the control that was just operated, and it is where
// a third click would land. Handing focus to the crown and letting that caller
// steal it back a moment later would be two focus moves in one gesture, which is
// one more than a screen reader or a focus ring can follow.
function hideContact(keepFocus) {
  if (!state.flipped) return;
  state.flipped = false;
  render();
  if (!keepFocus) el.crown.focus({ preventScroll: true });
}

// ---- ADDRESSES -------------------------------------------------------------
// One address per destination, laid over the state that was already there.
// `#/about` opens About; `#/contact` turns the watch over; no hash, `#/`, or a
// hash naming nothing is the bare watch, face up. Keyed on SECTIONS plus
// CONTACT, so a new row gets an address for free and a route can never name a
// destination that does not exist.
//
// THE CASEBACK IS AN ADDRESS TOO, and that is the change the rail's sixth word
// brought with it. It could have been a <button> that flips and writes nothing,
// and that would have left one control in the navigation whose middle-click does
// nothing, whose Back leaves the site, and whose state a reload forgets -- five
// links and an impostor. Making it a route costs the widened routeKey() below
// and one show/hide pair, and it buys the caseback the same three things every
// section has: a link you can send, a Back that returns to the dial, and a
// reload that lands where you were.
//
// The `#` is never sent to the server, so nothing about the build or the hosting
// changes -- this is still one hand-authored index.html. What it buys is the
// three things a single address cannot: a link you can send someone that opens
// your CV, a Back button that closes a panel instead of leaving the site (which
// matters most on a phone, where there is no Escape key), and a reload that
// lands where you were.
//
// WHICH TRANSITIONS ARE HISTORY, decided one at a time:
//
//   opening a section        pushState      the one thing a visitor does that
//   or the caseback                         they might want to undo, link to or
//                                           come back to
//   closing one, when the    history.back() the entry we pushed is RETIRED
//   entry underneath is                     rather than buried under a second
//   the bare watch                          one, so the history stays as short
//                                           as the visit actually was
//   closing one, any other   pushState      a second destination underneath
//   time                                    (Back there would re-open what you
//                                           just closed) or a deep-link arrival
//                                           (Back there leaves the site)
//   a hash naming nothing    replaceState   the dead address is corrected in
//                                           place, so Back still leads back out
//                                           the way the visitor came
//   render()                 nothing        it runs ten times a second
//
// Section -> caseback and caseback -> section are ONE entry each, not a close
// plus an open: goTo() pushes the destination and showSection()/showContact()
// each shut the other down without touching the address. Back from the caseback
// therefore re-opens the panel you flipped away from, which is what "back" means.
//
// THE TWO DIRECTIONS CANNOT FIGHT. Exactly one function moves the state in
// response to the address -- applyRoute() -- and it returns early when the two
// already agree, so a hashchange naming where you already are is a no-op rather
// than a re-open. Exactly one function writes an address in response to a
// control -- goTo() -- and it returns early for the destination that is already
// up. And pushState fires no event at all, so a click never round-trips through
// the address bar and back into the state.
const HOME_URL = location.pathname + location.search;
const urlFor = (key) => (key ? `#/${key}` : HOME_URL);

// The address bar's half of the rail: the five section keys and CONTACT's.
// Anything else is the bare watch -- a typo is not an error page.
const routes = new Set([...SECTION.keys(), CONTACT.key]);
function routeKey() {
  const m = /^#\/([\w-]+)$/.exec(location.hash);
  return m && routes.has(m[1]) ? m[1] : null;
}

// THE ONE DOOR IN, and Phase 2's function with an address bolted to the front of
// it. Every control that navigates calls this rather than opening a panel or
// flipping the watch itself -- the five watch parts, the rail's six links, the
// crown, the keyboard -- so there is no way to change where you are without
// changing the address. `from` is the element focus should return to when a
// panel closes; the caseback ignores it and hands focus to the crown.
function goTo(key, from) {
  if (!routes.has(key) || placeNow() === key) return;
  railCue(null);   // whether this call is the cue's own or something that beat it
  // Set HERE and not in showSection(), because this is what state.touched
  // actually means: the visitor has operated the watch. Following a link into a
  // section, or walking Back through one, is not operating it -- and if it
  // counted, someone arriving on a shared #/resume link would close the panel to
  // a watch with the interaction index already spent, which is the one thing
  // telling them anything on it is clickable.
  state.touched = true;
  history.pushState({ key, from: placeNow() }, '', urlFor(key));
  applyRoute(from);
}

// Closing, whichever of the two is up. history.state.from is the key of the entry
// underneath this one, and `null` means the bare watch -- the one case where the
// entry we pushed can be retired with a plain Back instead of being buried under
// a second one. Anything else gets a pushed home entry: a second destination
// underneath, or a deep-link arrival, which carries no history.state at all
// because we never created it.
//
// THE ONE DOOR OUT, and the reason there is no second one. Four controls close:
// Escape, the card's close control, the crown on the caseback, and now a rail
// word re-clicked where it is already lit. All four call this, so all four leave
// the same entry behind -- which is exactly the failure the block above is
// written to prevent, three ways out that agree about the state and disagree
// about the address.
//
// `focusTo` is the element focus should land on afterwards, for the caller that
// has a better answer than the two defaults (the part a panel was opened from,
// or the crown): the rail word that was just clicked. Everything else omits it
// and gets the default, which is the behaviour that was already here.
function leave(focusTo) {
  const leaving = placeNow();
  if (!leaving) return;
  // A tap that closes must not sit through the touch cue, and a cue left running
  // must not re-open what was just closed. goTo() clears it on the way in for the
  // first reason; this clears it on the way out for the second, which also covers
  // Escape and the close control landing while a cue is still counting down.
  railCue(null);
  const undo = !!history.state && history.state.from === null;
  // The panel or the flip goes now rather than on the popstate a task later.
  // history.back() is asynchronous, and Escape has to feel like a key, not like
  // a request.
  if (state.flipped) hideContact(!!focusTo); else hideSection(!!focusTo);
  // After the hide and before the history write: the hides are what make the
  // panel [hidden] and the caseback face away, and focus must not be sitting
  // inside either when that happens. isConnected because the rail is rebuilt by
  // nothing today but the check costs nothing and hideSection() already makes it.
  if (focusTo && focusTo.isConnected) focusTo.focus();
  if (undo) history.back();   // applyRoute() then finds nothing left to do
  else history.pushState({ key: null, from: leaving }, '', urlFor(null));
}

function applyRoute(from) {
  const key = routeKey();
  // A hash that names nothing is corrected in place rather than pushed away: the
  // visitor typed or was sent a dead address, and replacing it means Back still
  // leads back out the way they came instead of to a URL that never worked.
  if (!key && location.hash) history.replaceState(history.state, '', urlFor(null));
  if (key === placeNow()) return;   // the address and the state already agree
  // Each of these three shuts the other two down on its own -- showSection()
  // unflips, showContact() closes the panel -- so there is no teardown step here
  // that could get out of step with them.
  if (key === CONTACT.key) showContact();
  else if (key) showSection(key, from);
  else if (state.flipped) hideContact();
  else hideSection();
}

// Both events, because they cover different halves and applyRoute() is
// idempotent, so overlap costs nothing. popstate is the only one fired when two
// adjacent entries share a hash (which the replaceState above can produce);
// hashchange is the only one fired when someone edits the hash in the address
// bar, which is a fresh navigation rather than a traversal. Neither is fired by
// pushState, which is what keeps goTo() from feeding itself.
addEventListener('popstate', () => applyRoute());
addEventListener('hashchange', () => applyRoute());

// ---- interaction index: the hairline -----------------------------------
// The one number the .hint-index layer cannot work out for itself.
//
// The scribe draws each mark by walking stroke-dashoffset from 100 to 0 over a
// dash that spans the whole path, and what makes "100" mean "the whole path"
// for a circle, a rect and two arcs alike is pathLength="100" on each shape.
// That normalisation is a USER-space rule. `vector-effect: non-scaling-stroke`
// -- which used to hold the hairline at 1px -- moves the entire stroke, dash
// pattern included, into SCREEN space, where pathLength does not apply at all:
// `stroke-dasharray: 100` then means 100 screen px, which on the 1043px hours
// rim is five repeating dashes and on the 142px reserve arc is most of one. The
// two features cannot both be on the mark. Dashes keep user space; the hairline
// is held here instead. Do not put non-scaling-stroke back -- see the long note
// on .hint-mark in src/styles.css.
//
// The layer is a 100x100 viewBox stretched over its own box, so one user unit
// is (box / 100) px and one CSS pixel is (100 / box) user units. One value for
// the whole layer -- pathLength keeps doing all the per-shape work, so nudging
// a complication's geometry still needs nothing here.
//
// Measured off offsetWidth, not getBoundingClientRect: the layer rides the pose
// scale, and a hairline that thickened as the watch was posed away would be
// chasing a transform. Layout size is the stable reference -- which is why the
// numbers in the styles.css note differ by a percent (654px of layout, 661px
// on screen once the pose scale is on it). min() of the two axes
// because the svg is preserveAspectRatio="none": the box is square in practice,
// and if it ever is not, the hairline stays a hairline on the tighter axis.
function hintHairline() {
  const box = Math.min(el.hintIndex.offsetWidth, el.hintIndex.offsetHeight);
  if (!box) return;   // display:none behind a panel -- keep the last good value
  el.hintIndex.style.setProperty('--hint-hair', (100 / box).toFixed(4));
}
hintHairline();
// Same shape, and for the same reason: one layout read at startup, cached until
// something changes the layout. See measureNarrowPose() up in the pose section.
measureNarrowPose();
// A ResizeObserver rather than a resize listener, for two reasons: the browser
// coalesces it to one callback per frame after layout and before paint, so it
// is self-debouncing and cannot flash a stale width; and it also fires when the
// layer comes back from display:none, which is the one case a window resize
// misses (the box is 0 while a panel is open, so the measurement above bails).
new ResizeObserver(hintHairline).observe(el.hintIndex);

// One section, one hit target, wired from its row. The element is a real
// <button>, so Enter and Space, the tab stop and the button role all come from
// the platform rather than from a role="button" plus a hand-rolled key handler.
// The accessible name comes off the row too -- "Projects, the outsize date" --
// so it says both what opens and which part of the watch you are on, and it
// cannot drift from the caption printed for the same hover.
function bind(section) {
  const id = section.key;
  const node = $(section.hit);
  node.setAttribute('aria-label', `${section.label} — the ${section.part.toLowerCase()}`);
  node.addEventListener('click', () => goTo(id, node));
  node.addEventListener('mouseenter', () => { state.hover = id; render(); });
  // Focus is the keyboard's pointer, so it lights the part and prints the same
  // caption a hover does. The focus ring in styles.css says WHERE the keyboard
  // is; this says which part that is, in the watch's own language.
  node.addEventListener('focus', () => { state.hover = id; render(); });
  node.addEventListener('blur', () => {
    if (state.hover === id) { state.hover = null; render(); }
  });
  // Only clear what this node actually owns. The five hit boxes are unrelated
  // siblings rather than a nest, and two of them overlap -- .moon's box sits
  // over .seconds-dial's -- so a crossing is a leave and an enter on two
  // elements with no ancestor relationship, and nothing in the DOM guarantees
  // the leave is delivered first. An unconditional `state.hover = null` that
  // lands second blanks the part the pointer has just arrived on; the guard
  // makes a stale leave a no-op instead. It matters more than it did: the
  // highlight is held now, not 780ms long, so a dropped one stays dropped until
  // the pointer moves again.
  node.addEventListener('mouseleave', () => {
    if (state.hover === id) { state.hover = null; render(); }
  });
}

SECTIONS.forEach(bind);

// The rail's other end of the same wiring. These handlers write the SAME
// state.hover the watch's own hit targets write, which is the whole reciprocal
// cue: the caption, the part's brightness lift and the bloom on its silhouette
// all arrive from one value, so hovering the words FIELD NOTES and hovering the
// moonphase cannot say different things. Focus is included for the reason bind()
// includes it -- focus is the keyboard's pointer -- and the guards on leave and
// blur are the same guards, for the same reason.
//
// hoverKeyOf() is what makes the sixth word part of that and not an exception:
// CONTACT writes 'crown', so the fitting lights, the crown's caption prints, and
// the crown's own handlers below light CONTACT coming back the other way.
const COARSE_POINTER = matchMedia('(hover: none)');
const TOUCH_CUE_MS = 600;
let touchCue = 0;

// The cue's own attribute, and the only two lines that write it. It is separate
// from data-hover because it has to be: on touch there is no mouseleave, so the
// part's :hover treatment is walled inside (hover: hover) -- see THE TOUCH CUE
// in styles.css -- and a cue driven by a timer is the one form of it that
// cannot get stuck. Clearing is unconditional and idempotent, and every path
// out of the cue goes through it.
function railCue(key) {
  clearTimeout(touchCue);
  if (key) el.flip.dataset.cue = key;
  else el.flip.removeAttribute('data-cue');
}

for (const [key, node] of railLinks) {
  const part = hoverKeyOf(key);
  node.addEventListener('mouseenter', () => { state.hover = part; render(); });
  node.addEventListener('focus', () => { state.hover = part; render(); });
  node.addEventListener('mouseleave', () => {
    if (state.hover === part) { state.hover = null; render(); }
  });
  node.addEventListener('blur', () => {
    if (state.hover === part) { state.hover = null; render(); }
  });
  node.addEventListener('click', (e) => {
    // The href is a real address now, so a MODIFIED click is let through: it is
    // asking the browser for a new tab, a new window or a saved link, and this
    // handler has no business answering that. Swallowing it was correct while
    // the address did nothing.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // A plain click is ours, and it does NOT fall through to the href. Letting
    // the browser do the navigation would work -- hashchange would open the
    // panel -- but the entry it creates carries no history.state, and that is
    // what tells leave() whether the bare watch is underneath. Same address
    // either way; this one knows how it got there.
    e.preventDefault();
    // A SECOND CLICK ON THE LIT WORD CLOSES IT, and it is the same click either
    // way: the rail item you are on is the control for the place you are in, so
    // it opens it and it puts it away. All six behave alike -- the five reverse
    // the pose and take the panel down, CONTACT turns the watch back to the dial
    // -- which is what makes the sixth word a peer here as well. On a phone it is
    // the difference between a way out and the crown, a ~30px target on a 335px
    // watch, being the only one. (docs/SITE-DIRECTION.md 6.6 asked for exactly
    // this: "Tapping CONTACT again, or any other item, flips back".)
    //
    // BEFORE the touch cue, not after, and this is the whole reason it is written
    // here rather than folded into goTo(). Opening waits 600ms on touch so the
    // watch can answer first; closing has nothing to announce -- the answer IS
    // the watch coming back -- and a close that sat through the cue would read as
    // a dropped tap. It also has to come before goTo(), whose first line returns
    // early for the destination that is already up: that guard is what stops the
    // address bar and a re-entrant route from re-opening a panel, and it would
    // swallow this too.
    //
    // leave() and not a hide, so the address is written the same way Escape, the
    // card's close control and the crown write it, and `node` so focus stays on
    // the word under the pointer instead of being thrown to the dial part or the
    // crown -- see leave().
    if (placeNow() === key) { leave(node); return; }
    // A touch device has no hover, so a tap would open the panel with the watch
    // never having answered -- and the one thing a phone visitor has to learn is
    // that the watch IS this rail. So the tap lights the part first and opens
    // 600ms later: long enough to see which complication just replied, short
    // enough that it does not read as a stall. On a pointer device the hover has
    // already said it, so there is nothing to wait for.
    //
    // CONTACT IS EXEMPT, and not for want of a rule to reuse. The cue exists to
    // make the watch answer before the panel hides it; CONTACT hides nothing and
    // its answer is the watch turning over, which is the largest thing this site
    // does. Lighting the crown for 600ms first would delay that answer in order
    // to announce it. (THE TOUCH CUE in styles.css also has no rule for the
    // crown, and this is why it does not need one.)
    if (COARSE_POINTER.matches && key !== CONTACT.key) {
      state.hover = part;
      railCue(key);
      render();
      touchCue = setTimeout(() => goTo(key, node), TOUCH_CUE_MS);
      return;
    }
    goTo(key, node);
  });
}

// The two ways a pointer can stop being on a part without that part ever
// hearing about it. Both used to cost 780ms of stale glow, which nobody would
// have noticed; now they would cost an indefinitely lit mark, so they are shut
// off explicitly rather than trusted to the hit boxes.
//   - the pointer leaving the window. Chrome does fire mouseleave on the way
//     out, but only if the exit path crosses the element's box -- a fast
//     diagonal out of the corner, or the pointer being captured by a native
//     scrollbar or the dev tools, can skip it.
//   - the window losing focus with the pointer parked on a part (cmd-tab,
//     another app taking over). No pointer event is generated at all: the
//     cursor is still geometrically over the watch, and it may be somewhere
//     else entirely by the time focus comes back.
// Both are idempotent and cost one render each, and neither can fire while the
// pointer is genuinely on a part, so nothing legitimate is cancelled.
document.addEventListener('mouseleave', () => {
  if (state.hover) { state.hover = null; render(); }
});
window.addEventListener('blur', () => {
  if (state.hover) { state.hover = null; render(); }
});

// The crown and the rail's CONTACT are the same control by two routes, so they
// go through the same door: the fitting no longer flips the watch itself, it
// asks for `#/contact` and lets applyRoute() do it. That is what makes the two
// agree about history -- clicking the crown and clicking CONTACT leave the same
// entry behind -- and what lets Back off the caseback work at all.
el.crown.addEventListener('click', () => { if (state.flipped) leave(); else goTo(CONTACT.key, el.crown); });
el.crown.addEventListener('mouseenter', () => { state.hover = 'crown'; render(); });
el.crown.addEventListener('focus', () => { state.hover = 'crown'; render(); });
// Same guard as bind()'s: the crown and the pusher own state.hover too, and a
// leave of theirs arriving after a part's enter would blank the part.
el.crown.addEventListener('mouseleave', () => {
  if (state.hover === 'crown') { state.hover = null; render(); }
});
el.crown.addEventListener('blur', () => {
  if (state.hover === 'crown') { state.hover = null; render(); }
});

// render() is normally pumped by a 100ms interval, which is far too coarse for
// a spinning seconds hand. The demo borrows requestAnimationFrame for its own
// duration and hands the dial back when it is done -- one pump at a time, and
// the interval keeps running underneath either way.
let demoPumping = false;
function demoPump() {
  // Either author holds the pump: the demonstration, or any section salute still
  // turning. One pump between them, so a press during a salute does not start a
  // second rAF loop drawing the same frames twice.
  if (!state.demo && !SALUTE.size) { demoPumping = false; render(); return; }
  render();
  requestAnimationFrame(demoPump);
}

$('corrector').addEventListener('click', () => {
  state.touched = true;
  // Re-entrancy: a press during the sweep is ignored. Restarting would rewind
  // the offsets to zero mid-flight and snap every hand backwards; ignoring is
  // the one option with no discontinuity, and it cannot stack.
  if (state.demo) return;
  const reduced = REDUCED_MOTION.matches;
  // reserveFrom is the reserve hand's frozen starting reading, taken here for
  // the same reason a salute takes it -- see THE HAND LET GO OF THE SCROLL in
  // render(). The press and the opening are one motion on this hand, so they
  // start it the same way.
  state.demo = { t0: Date.now(), reduced, reserveFrom: state.reserve };
  // Reduced motion gets no spin at all -- four seconds of whirling hands is
  // precisely the thing the setting asks us not to do. The demo state still
  // exists, purely so the caption can acknowledge the press, and the 100ms
  // interval is enough to expire it.
  if (!reduced && !demoPumping) { demoPumping = true; requestAnimationFrame(demoPump); }
  render();
});
$('corrector').addEventListener('mouseenter', () => { state.hover = 'pusher'; render(); });
$('corrector').addEventListener('focus', () => { state.hover = 'pusher'; render(); });
$('corrector').addEventListener('mouseleave', () => {
  if (state.hover === 'pusher') { state.hover = null; render(); }
});
$('corrector').addEventListener('blur', () => {
  if (state.hover === 'pusher') { state.hover = null; render(); }
});

// ---- the link train on the caseback ---------------------------------------
// The same four listeners bind() and the rail use, and the same guard on the
// two that clear: a leave arriving after a neighbouring enter would otherwise
// blank the wheel the pointer has just arrived on, and these three sit close
// enough to each other for that to be an ordinary crossing rather than a
// corner case.
//
// FOCUS IS NOT OPTIONAL HERE, and it matters more than anywhere else on the
// site. The caption is the ONLY place the address appears in full -- the hub
// says Gmail and the href says nothing you can read -- so without the focus
// half, a keyboard visitor is handed a mailto: and never shown where it goes.
//
// THE RAIL'S THREE JOIN THE SAME LOOP, because they are the same three controls
// by a second route -- the arrangement the crown and CONTACT already have. One
// key, one caption, one set of listeners; a wheel and its word cannot say
// different things because there is only one thing being said.
const linkControls = [...document.querySelectorAll('.cb-gear'), ...railContactLinks];
for (const node of linkControls) {
  const key = node.dataset.link;
  node.addEventListener('mouseenter', () => { state.hover = key; render(); });
  node.addEventListener('focus', () => { state.hover = key; render(); });
  node.addEventListener('mouseleave', () => {
    if (state.hover === key) { state.hover = null; render(); }
  });
  node.addEventListener('blur', () => {
    if (state.hover === key) { state.hover = null; render(); }
  });
}

// ---- the address is copied, not followed ----------------------------------
// A mailto: is a dead end for the visitor who only wants the address: it hands
// the page to a mail client that may not exist, and on a machine where it does
// not, nothing at all happens. Both controls carrying it now put it on the
// clipboard and say so, and neither leaves the page.
//
// WHAT IT SAYS AND WHERE, IN TWO CHANNELS AND THREE PLACES. The mark -- see
// showCopyMark() -- is the visible answer: a small gold box that stands against
// whichever of the two controls was pressed and says only what happened, COPIED
// or COPY BLOCKED. The announcement is its accessible half, and it says the same
// fact in a sentence. The caption is the third place and it carries the ADDRESS,
// on both outcomes: it outranks hover while it is up and expires against
// render()'s own clock, see state.notice. The three never disagree because all
// three are written from one boolean in copyEmail().
//
// TWO DURATIONS, BECAUSE THE TWO OUTCOMES ASK DIFFERENT THINGS OF THE READER. A
// confirmation is read once; a failure is an instruction to select the address
// by hand, and it prints the address for exactly that reason. One pair of
// numbers, read by the mark and by the caption, so the two cannot fall out of
// step on screen.
const COPY_OK_MS = 1900;
const COPY_FAIL_MS = 4500;

// The announcement. role="status" is polite -- it waits for a gap rather than
// cutting in -- and it has to be its own element rather than the caption
// itself: the caption rewrites every 100ms with the CURRENTLY line, and a live
// region on that would narrate the status line at a screen reader ten times a
// second. Built here rather than in index.html so it exists from the first
// frame, which is what makes the first announcement land at all.
const copyStatus = document.createElement('p');
copyStatus.className = 'rail-copy-status';
copyStatus.setAttribute('role', 'status');
document.body.append(copyStatus);
function announce(text) {
  // Cleared and rewritten on a task rather than assigned straight, because a
  // live region set to the string it already holds is not a change and is not
  // announced -- which would make the second of two copies silent.
  copyStatus.textContent = '';
  setTimeout(() => { copyStatus.textContent = text; }, 0);
}

// ---- THE COPY MARK: the confirmation stands where the click was ------------
// WHY THIS EXISTS NEXT TO A CAPTION THAT ALREADY SAID IT. The two controls that
// copy are nowhere near each other and neither is near the caption: at 1440 the
// rail's EMAIL is in the top-left corner and the Gmail wheel is mid-face on the
// caseback, some 500px apart, and the caption is a line under the watch that
// neither of them is looking at. On a phone the rail is a row along the top and
// the wheel is under the reader's own thumb. A confirmation printed in one fixed
// place is a confirmation printed where the reader is not, which is the fault a
// toast in a corner would have had too, at less code and the same cost. So: one
// element, placed per activation from the trigger's own rect, so the answer
// appears against the thing that was pressed.
//
// ONE ELEMENT AND ONE TIMER FOR BOTH CONTROLS. Two popups would be two things to
// keep in step and two clocks to leave running; here the second of two clicks
// clears the first one's timeout and restarts it, so nothing stacks and nothing
// is orphaned.
//
// IT IS NOT IN THE ACCESSIBILITY TREE, deliberately. aria-hidden, because the
// role="status" region above is the accessible half of this pair and says the
// same fact in its own words -- without this, every copy would be announced
// twice, once in chrome uppercase. Built here rather than in index.html for the
// reason copyStatus is: it has to exist before the first click can happen.
//
// TWO TREATMENTS, AND ONE OF THEM IS ADDRESSED AT A GUESS -- READ THIS BEFORE
// MOVING IT. The brief was "an outlined box beside the EMAIL text" and "for the
// search, a solid box that disappears". The first is unambiguous and is the rail
// variant. THERE IS NO SEARCH ON THIS PAGE -- no input, no field, no filter, and
// every match for the string in index.html is inside the word RESEARCH, which is
// a section and not a control -- so "the search" was read as the
// OTHER place a copy fires, which is the caseback's Gmail wheel, and the solid
// plate was built there. If that reading is wrong, the fix is one line: the two
// variants are chosen by `brass` in showCopyMark() below, which is one test on
// the trigger's class. Point that test at whatever the real second control turns
// out to be and both treatments follow it; nothing else in this file or in
// .copy-mark's CSS knows which control is which.
const COPY_MARK_GAP = 10;   // px of air between the trigger and the mark
const copyMark = document.createElement('p');
copyMark.className = 'copy-mark';
copyMark.setAttribute('aria-hidden', 'true');
document.body.append(copyMark);
let copyMarkTimer = 0;

function showCopyMark(trigger, ok) {
  // The restart. clearTimeout on 0 is a no-op, so the first call needs no guard.
  clearTimeout(copyMarkTimer);
  // WHICH SURFACE IT IS LANDING ON, decided once and used three times below --
  // for the treatment, for the placement and for nothing else. The two controls
  // sit on two materials, the page's near-black behind the rail and the
  // caseback's light brass under the Gmail wheel, and .copy-mark draws itself as
  // a gold line on the first and a gold plate on the second. The trigger says
  // which, because the trigger is on it.
  const brass = trigger.classList.contains('cb-gear');
  copyMark.classList.toggle('copy-mark--brass', brass);
  copyMark.classList.toggle('copy-mark--rail', !brass);
  // TWO WORDS AND NOT A SENTENCE, now that there is a box around them. This used
  // to read COPIED — <address>: 35 characters, which is the right length for a
  // bare line of type set under a control and the wrong length for a box that
  // has to stand BESIDE a five-letter word in the page's left margin. The
  // address did not go missing with it -- the caption underneath carries it now,
  // see copyEmail() -- so the division is that the box says WHAT HAPPENED and
  // the caption says WHAT IT IS.
  //
  // IT CANNOT SAY COPIED WHEN NOTHING WAS COPIED. ok is the single source for
  // this string, for the caption and for the announcement, and it is the
  // clipboard write's own answer; the failure branch names the failure in the
  // same box rather than declining to appear, because a control that answers
  // sometimes is worse than one that answers badly.
  copyMark.textContent = ok ? 'COPIED' : 'COPY BLOCKED';
  // Measured while it is still invisible: visibility:hidden is laid out, so the
  // rect is real, and the text is nowrap so its width is its content's wherever
  // it is about to be put. Placing first and showing second is what keeps it
  // from appearing for one frame at the previous click's position.
  const r = trigger.getBoundingClientRect();
  const m = copyMark.getBoundingClientRect();
  // The page's own outer margin -- .overlay's 5vmin -- so the mark stops where
  // everything else on this site stops rather than at some margin of its own.
  const margin = 0.05 * Math.min(window.innerWidth, window.innerHeight);
  let x = null;
  let y = 0;
  if (!brass) {
    // BESIDE THE WORD ON THE RAIL, AND UNDER IT IS NOT AVAILABLE. EMAIL is the
    // first of three contact rows stacked 23px apart, so a box dropped 10px
    // below it lands on GITHUB. Beside is also where the room is: from 1201 up
    // the rail is a column in the left margin and everything to its right is
    // empty page.
    //
    // RIGHT FIRST, THEN LEFT, and the second branch is not defensive padding.
    // Below 1200 the rail turns into a row along the TOP and the three contacts
    // hang under CONTACT -- the last of six centred words -- where
    // .rail-contacts is already clamped flush against the right margin at 375px.
    // There is no room on that side by construction, and there is room on the
    // other.
    const right = r.right + COPY_MARK_GAP;
    const left = r.left - COPY_MARK_GAP - m.width;
    if (right + m.width <= window.innerWidth - margin) x = right;
    else if (left >= margin) x = left;
    // Level with the word rather than aligned to its top: the box is the height
    // of a contact row (see .copy-mark's padding), so centring the two on one
    // axis is what makes them read as one line.
    if (x !== null) y = r.top + r.height / 2 - m.height / 2;
  }
  if (x === null) {
    // THE CASEBACK'S PLACEMENT, AND THE RAIL'S LAST RESORT: centred under the
    // trigger, clamped to the page's margin. The wheel is a 97px circle with
    // clear plate below it and nothing stacked under it, so under is simply
    // where a label belongs; the rail reaches this only on a viewport too narrow
    // to have a side, and then under is better than off-screen.
    const lo = margin;
    const hi = window.innerWidth - margin - m.width;
    // lo > hi means the box is wider than the space between the two margins, and
    // then there is nothing to clamp to and the middle is the least bad place.
    x = r.left + r.width / 2 - m.width / 2;
    x = lo > hi ? (window.innerWidth - m.width) / 2 : Math.min(Math.max(x, lo), hi);
    // Under the trigger, and above it if under would go off the bottom -- which
    // is the rail's bottom-most row on a short window, not a hypothetical.
    y = r.bottom + COPY_MARK_GAP;
    if (y + m.height > window.innerHeight - margin) y = r.top - COPY_MARK_GAP - m.height;
  }
  copyMark.style.left = `${Math.round(x)}px`;
  copyMark.style.top = `${Math.round(y)}px`;
  copyMark.classList.add('is-on');
  // The two durations are the caption's own, because they are one pair of
  // numbers answering one question -- see COPY_OK_MS.
  copyMarkTimer = setTimeout(() => { copyMark.classList.remove('is-on'); },
    ok ? COPY_OK_MS : COPY_FAIL_MS);
}

// The fallback, and it is a real one rather than a gesture: navigator.clipboard
// is undefined on an insecure origin and its write can be denied outright, and
// both are ordinary rather than exotic -- a portfolio opened over http:// on a
// LAN hits the first every time. execCommand('copy') is deprecated and still
// the only synchronous route, so it is tried second and its result is believed
// only when it says true.
function copyByExecCommand(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  // Off-screen, but laid out: a display:none or visibility:hidden field cannot
  // be selected, and position:fixed at the top-left with no size keeps the page
  // from scrolling to it.
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0';
  document.body.append(ta);
  const sel = document.getSelection();
  const held = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  let ok = false;
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch (err) {
    ok = false;
  }
  ta.remove();
  // Whatever the visitor had selected is put back. Copying an address should not
  // silently discard a selection they made for some other reason.
  if (held && sel) { sel.removeAllRanges(); sel.addRange(held); }
  return ok;
}

function copyEmail(trigger) {
  const done = (ok) => {
    // THE MARK CARRIES THE OUTCOME AND THE CAPTION CARRIES THE ADDRESS. That was
    // already the division; the box has just made it strict. The mark used to
    // print COPIED — <address>, so the caption could stay silent on success and
    // nothing was lost. The mark now prints six letters -- a box beside a
    // five-letter word cannot carry twenty-six more -- so the address has to be
    // somewhere, and the caption is the place on this site where the address is
    // printed.
    //
    // AND THE SUCCESS LINE IS THE ADDRESS AND NOTHING ELSE. Not COPIED —
    // <address>: the box three inches away is already saying COPIED, and a site
    // that prints one word twice in one instant is telling you twice. So the box
    // answers WHAT HAPPENED and this answers WHAT IT IS, and neither repeats the
    // other.
    //
    // ON A POINTER THIS CHANGES NOTHING ON SCREEN, WHICH IS THE POINT. While
    // either control is hovered or focused the caption is ALREADY CAPTIONS.email
    // -- the same string, character for character -- so the notice overwrites the
    // hover line with itself and the caption does not flicker. What it buys is
    // the case that has no hover: a tap on a phone lights nothing, and without
    // this a touch visitor would get COPIED and never see the address they were
    // told was copied. It also holds the line for COPY_OK_MS after the pointer
    // leaves, which is long enough to read twenty-six characters.
    //
    // THE FAILURE LINE STAYS AS IT WAS, and it is not the same case. It is not a
    // second confirmation, it is the instruction's object: the announcement says
    // the address is printed under the watch to select by hand, and this is that
    // printing. It repeats the box's COPY BLOCKED on purpose, where the success
    // pair refuses to -- a failure has to be legible in both places at once,
    // because the box names it and only this line can be selected.
    //
    // A LINE THAT SAID "COPIED" WHEN NOTHING WAS COPIED is still the one outcome
    // this must never produce; ok is the single source for all three channels.
    showCopyMark(trigger, ok);
    state.notice = ok
      ? { text: LINKS.email, until: Date.now() + COPY_OK_MS }
      : { text: `COPY BLOCKED — ${LINKS.email}`, until: Date.now() + COPY_FAIL_MS };
    // THE SPOKEN LINE IS NOT THE PRINTED ONE, and this is the one place on the
    // site where that is right. The caption is uppercase because everything in
    // this chrome is; an address read aloud should be in its own case, and a
    // failure has to say what to do about it, which a status line 40 characters
    // wide cannot. Same two facts, said the way each channel says things.
    announce(ok
      ? `Copied ${EMAIL} to the clipboard`
      : `Could not copy. The address is ${EMAIL} — it is printed under the watch to select by hand.`);
    render();
  };
  const clip = navigator.clipboard;
  if (clip && clip.writeText) {
    // .then and not await, so this file stays free of async functions, and a
    // rejection -- denied permission, an unfocused document -- lands in the same
    // fallback the missing API does rather than in an unhandled rejection.
    clip.writeText(EMAIL).then(() => done(true), () => done(copyByExecCommand(EMAIL)));
    return;
  }
  done(copyByExecCommand(EMAIL));
}

// Both controls, one handler. Enter on a link fires exactly this event, so the
// keyboard needs nothing of its own; Space does not activate a link and is not
// meant to.
function onEmailActivate(e) {
  // A MODIFIED CLICK IS LET THROUGH, on the rail's own reasoning: it is asking
  // the browser for a new tab, a new window or a saved link, and this handler
  // has no business answering that. What it reaches is the mailto:, which is
  // still there and still correct.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  // currentTarget and not target: the caseback's wheel is an <a> wrapped round an
  // <img>, so target is the picture and its rect is the picture's, not the
  // control's. currentTarget is the element this handler was bound to, which is
  // the thing the reader pressed in both places.
  copyEmail(e.currentTarget);
}

// The address is written twice by necessity -- once as a mailto: this file does
// not own, once as a caption this file does -- so the two are checked against
// each other rather than assumed to agree. A silent mismatch here is a contact
// link that goes somewhere the site says it does not.
//
// ALL THREE ARE CHECKED NOW, not just the address, because the rail builds its
// three from LINK_HREF and the caseback keeps its own in the markup: two
// spellings of one destination is exactly the drift this check already existed
// to catch, and it is now catching it in three places instead of one. It warns
// rather than throws -- a wrong link is worth a console line, not a blank page.
for (const node of document.querySelectorAll('.cb-gear')) {
  const key = node.dataset.link;
  const href = node.getAttribute('href');
  if (href !== LINK_HREF[key]) {
    console.warn(`link train: ${key} disagrees with LINK_HREF (${href} vs ${LINK_HREF[key]})`);
  }
  if (key !== 'email') continue;
  // The Gmail wheel stops navigating here. Its accessible name is rewritten to
  // match, from EMAIL rather than from the markup: the hub's alt says "Email",
  // which was true of a mailto: and is no longer the whole of what the control
  // does, and the address it copies is the one thing a screen reader could not
  // otherwise get at.
  node.setAttribute('aria-label', `Copy email address ${EMAIL}`);
  node.addEventListener('click', onEmailActivate);
}
// The rail's EMAIL, by its key rather than by its position in the list, so
// reordering the three cannot quietly bind this to GITHUB.
railContactLinks.find((a) => a.dataset.link === 'email')
  .addEventListener('click', onEmailActivate);

// The card's close control and the scrim behind it. Through the router, so
// closing writes the address exactly as Back does -- there is one way out of a
// section and three things that can ask for it.
document.querySelectorAll('[data-close]').forEach((node) =>
  node.addEventListener('click', () => leave())
);

// ---- THE PROJECT ROWS: the loop, the index, and the enlarged frame ---------
// THREE FRAMES SHARE ONE SLOT. A five-second timer advances them and three dots
// underneath choose one directly -- both, not one or the other.
//
// THE RULE THIS BREAKS, AND WHO BROKE IT. Until 9 Aug 2026 this block held a
// long argument for why there must never be a timer here: docs/DESIGN_BIBLE.md
// requires that every motion explain function or depth -- "no ambient floating,
// glow, or ornamental looping" -- and SITE-DIRECTION.md 0.3 had already thrown
// out an idle re-cue on a timer with "a loop with a long period is still a
// loop". That argument was correct and it lost. Nikhil asked for the loop in his
// own words on 9 Aug 2026 -- "make the images auto rotate every 5 seconds" --
// and asked again after being shown the stepper it would replace. The comment
// that used to stand here said DO NOT ADD ONE LATER; it is deleted rather than
// left to contradict the code beneath it, which is this codebase's recurring
// failure mode.
// WHAT DOES NOT CHANGE. The rule still holds everywhere else on the site: the
// stage's guilloche remains the only loop that earns itself on the merits (its
// angle IS the time, so the motion is the function), and no later pass may cite
// these rows as a precedent for a second decorative loop. This is the owner's
// decision about his own panel, recorded with its date.
// WHAT THE OLD COMMENT DEMANDED IF A LOOP EVER ARRIVED, and where each is paid:
// a pause on hover and on focus (below), a reduced-motion branch (below), and an
// aria-live region -- which is deliberately NOT paid. A live region here would
// announce a picture nobody asked to see, every five seconds, over whatever else
// is being read. The frames carry aria-hidden so only the current one is in the
// tree at all, and the dots announce themselves when pressed; that is the whole
// of what a screen reader needs and none of what it does not.
//
// A DOT PRESS DEFERS THE TIMER, IT DOES NOT SWITCH IT OFF. This was the open
// question and it is decided here. Stopping permanently would make one control
// do two things -- "show me frame 2" and, silently, "never move again" -- and a
// reader who wanted only the first would get the second without asking and with
// no way back short of closing and reopening the panel. Deferring takes nothing
// away: pressing a dot restarts the interval, so the frame you chose gets the
// same full five seconds every other frame gets rather than being swapped out
// 0.3s later by a tick that was already most of the way through.
// WHAT DEFERRING COSTS is that there is no OFF, and that is paid twice over: the
// loop halts entirely while the pointer is inside the row or the keyboard focus
// is, which is exactly where a reader who has stopped to study a frame has them,
// and prefers-reduced-motion never starts it at all.
//
// REDUCED MOTION SWITCHES THE TIMER OFF, NOT DOWN. A motion someone has asked
// not to see becomes a state and not a fast event -- the argument
// .stage-guilloche's `animation: none` already makes -- and half the interval is
// the same loop. Nothing is out of reach in that mode: the dots are behind no
// media query, so every frame is still one press away, which is why the
// unstacking fallback that used to live in styles.css was deleted rather than
// kept. The crossfade itself needs no branch: the blanket @media at the top of
// styles.css collapses the opacity transition to .01ms, which is a cut, and a
// cut is the correct reduced-motion form of a state change.
//
// THE MARKUP IS THE STATE. `data-current` on the frame is what the stylesheet
// paints; `aria-current` on the dot is what a screen reader announces; `inert`
// on the buttons is what stops the two frames nobody can see from taking the
// click. None is mirrored in a variable, so there is no index to fall out of
// step with the DOM, and show() is idempotent -- re-running it cannot
// desynchronise anything because it writes all three sets from one argument.
const SHOT_MS = 5000;
const shotReduced = matchMedia('(prefers-reduced-motion: reduce)');
const shots = [];

for (const car of document.querySelectorAll('.shot-carousel')) {
  const frames = [...car.querySelectorAll('.shot-frames .feature-shot')];
  const dots = [...car.querySelectorAll('.shot-dot')];
  // A row with four frames and three dots is a row two of whose pictures cannot
  // be reached, and it would look fine. Say so rather than wiring up a control
  // that lies about how much there is.
  if (!frames.length || frames.length !== dots.length) {
    console.warn(`shot carousel: ${frames.length} frames against ${dots.length} dots`);
    continue;
  }

  const row = { car, frames, dots, at: 0, timer: 0, held: false };

  const show = (i) => {
    row.at = i;
    frames.forEach((f, n) => {
      f.toggleAttribute('data-current', n === i);
      // aria-hidden rather than nothing at all: an image at opacity 0 is still
      // in the accessibility tree, so without this a screen reader would read
      // all three alts and report a row that prints three pictures at once.
      if (n === i) f.removeAttribute('aria-hidden');
      else f.setAttribute('aria-hidden', 'true');
      // inert and not pointer-events: three buttons share grid cell 1/1 and all
      // three generate boxes, so the last in DOM order would take every click.
      // inert closes the pointer, the tab stop, Enter/Space and the
      // accessibility tree at once -- the primitive el.back.inert uses on the
      // face of the watch nobody can see.
      const btn = f.closest('.shot-open');
      if (btn) btn.inert = n !== i;
    });
    dots.forEach((d, n) => {
      if (n === i) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
  };
  row.show = show;

  // ONE setTimeout RE-ARMED, NOT A setInterval, and that is what makes "a dot
  // press resets the clock" a one-line truth rather than a race. With an
  // interval, a press 4.7s in leaves the pending tick alone and the chosen frame
  // is replaced 0.3s later; clearing and re-arming is the only way the press
  // buys a whole period. Every path that changes the frame goes through arm().
  row.arm = () => {
    clearTimeout(row.timer);
    row.timer = 0;
    if (!row.running || row.held || shotReduced.matches) return;
    row.timer = setTimeout(() => {
      show((row.at + 1) % frames.length);
      row.arm();
    }, SHOT_MS);
  };

  dots.forEach((d, i) => d.addEventListener('click', () => { show(i); row.arm(); }));

  // THE PAUSE, AND WHY IT IS NOT A BUTTON. The old comment asked for a pause
  // control; the pointer and the keyboard ARE it. A reader studying a frame has
  // one or the other inside the row and a reader who is not has neither, so the
  // loop stops for exactly the person it would interrupt and for nobody else --
  // without a ninth mark on a panel whose argument is that a bare mark is
  // enough.
  // THE HOLD IS RECOMPUTED, NEVER TOGGLED. Two conditions can each hold the row
  // and they expire independently: a mouseleave while a dot still has the
  // keyboard, a Tab away while the pointer is still over the picture. A boolean
  // set true by one and false by the other resumes the loop under a reader who
  // is still holding it with the other, so every listener asks the DOM the whole
  // question again instead.
  // :focus-visible AND NOT activeElement, deliberately. Clicking a dot leaves
  // focus on that dot, so a plain focus test would mean one mouse click stops
  // the row until something else is clicked -- which is "a dot press switches
  // the loop off", the behaviour argued against at the head of this block. A
  // mouse reader is held by :hover while the pointer is there and released when
  // it leaves, which is the deferral that was promised; :focus-visible holds it
  // only for the keyboard, which is the case that needs holding.
  // focusout IS DEFERRED BY A TASK because activeElement is <body> while it is
  // dispatching -- asking the question during the event answers it about a
  // moment that does not exist yet.
  row.sync = () => {
    row.held = car.matches(':hover')
      || !!car.querySelector(':focus-visible')
      || !!(zoom && zoom.open);
    row.arm();
  };
  car.addEventListener('mouseenter', row.sync);
  car.addEventListener('mouseleave', row.sync);
  car.addEventListener('focusin', row.sync);
  car.addEventListener('focusout', () => setTimeout(row.sync, 0));

  // EVERY DOT IS ITS OWN TAB STOP, which is a deliberate departure from the
  // roving tabindex a tablist would use. These are not tabs -- there is no panel
  // to move into after choosing -- so a single stop would mean a keyboard reader
  // can only reach frames 2 and 3 after first discovering that the arrow keys do
  // something. Three stops a row is cheap and needs discovering by nobody.
  // The arrows are added on top for anyone who expects them, and they move the
  // focus AND the frame together: a focused dot that is not the frame on screen
  // is two cursors disagreeing.
  car.querySelector('.shot-index').addEventListener('keydown', (e) => {
    const at = dots.indexOf(document.activeElement);
    if (at < 0) return;
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: dots.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();          // Home/End would otherwise scroll the card
    const next = (to + dots.length) % dots.length;
    show(next);
    dots[next].focus();
    row.arm();
  });

  // The markup already ships the first frame current. Re-asserting it here is
  // what guarantees the three attribute sets agree before anything is clicked --
  // and it is what lets a row be edited to open on a different frame without
  // this file having to be told.
  show(Math.max(0, frames.findIndex((f) => f.hasAttribute('data-current'))));
  shots.push(row);
}

// THE TIMER IS HUNG OFF state.active, NOT OFF A POLL. render() is the one place
// that knows a panel is open, and it already turns the caseback rig on and off
// on the same line of reasoning (see rigPlay/rigStop). A loop advancing behind a
// closed panel is invisible work on every device and a visible one on a phone;
// worse, it would be advancing frames whose row has display: none, so the reader
// would return to a card that had silently moved on.
// IDEMPOTENT BECAUSE render() IS PUMPED TEN TIMES A SECOND. shotsRun() returns
// on the first line unless `running` actually changed, so re-arming is not a
// re-clock: an unconditional arm() here would reset every row's five seconds
// 100ms before it was due to fire, and the frames would never advance at all.
// That failure is silent and looks exactly like a broken timer, which is why the
// guard is the first thing in the function.
// A function declaration, hoisted, because render() is defined above this line.
function shotsRun(on) {
  for (const row of shots) {
    if (row.running === on) continue;
    row.running = on;
    row.arm();
  }
  if (!on) closeZoom();
}

// ---- FIELD NOTES: THE THREE TABS ------------------------------------------
// Nikhil, 10 August 2026: "for miscelleny to basically make a section for
// reviews/misc. Where theres a tab for Book reviews, a tab for watch reviews,
// and a tab for misc stuff."
//
// THIS IS A TABLIST AND THE ROW ABOVE IT IS NOT, AND THAT IS ONE ARGUMENT'S TWO
// CONCLUSIONS RATHER THAN AN INCONSISTENCY. EVERY DOT IS ITS OWN TAB STOP, forty
// lines up, gives the project dots three tab stops and a role="group" on the
// grounds that "these are not tabs -- there is no panel to move into after
// choosing -- so a single stop would mean a keyboard reader can only reach
// frames 2 and 3 after first discovering that the arrow keys do something."
// Here there IS a panel to move into: the tabs are the only way to reach two
// thirds of the section's content, and Tab from the selected tab lands in the
// panel that tab selected. So the premise reverses, and with it the pattern --
// APG tabs, one roving tabindex, arrows to move. A reader who does not know the
// arrows do something still reaches every panel by Tab, which is the exact thing
// the roving stop costs the dots and does not cost these. Do not harmonise them.
//
// THE MARKUP IS THE STATE, the same way the carousel above holds it: aria-selected
// on the tab is what the stylesheet paints and what a screen reader announces,
// [hidden] on the panel is what removes it from the page and the tab order
// together, and tabindex is the roving stop. None is mirrored in a variable, so
// there is no index to fall out of step with the DOM; show() writes all three
// sets from one argument and is idempotent.
//
// NO REDUCED-MOTION BRANCH, AND NOTHING TO PUT IN ONE. Switching panels is
// [hidden] on and off -- a cut, with no transition to collapse. The only motion
// in the row is .misc-tab's colour, which the blanket @media at the top of
// styles.css already takes to .01ms.
for (const list of document.querySelectorAll('[data-tabs]')) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  // The carousel's own guard, for the carousel's own reason: a tablist whose
  // third tab points at nothing would look fine and be a third of the section
  // nobody can read. Say so rather than wiring up a control that lies.
  if (!tabs.length || panels.some((p) => !p)) {
    console.warn(`misc tabs: ${tabs.length} tabs against ${panels.filter(Boolean).length} panels`);
    continue;
  }

  const show = (i) => {
    tabs.forEach((t, n) => {
      t.setAttribute('aria-selected', String(n === i));
      // The roving stop. Exactly one tab is in the tab order, so Tab out of the
      // row goes to the panel rather than to the next two tabs -- which is the
      // whole reason the row is a tablist and the dots are not.
      t.tabIndex = n === i ? 0 : -1;
    });
    // [hidden] and not opacity or display in the sheet, the same primitive
    // .rail-contacts uses: it closes the paint, the tab order and the
    // accessibility tree in one attribute, so the two panels nobody can see
    // cannot be tabbed into behind the one they can.
    panels.forEach((p, n) => { p.hidden = n !== i; });
  };

  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));

  // Delegated to the list rather than bound per tab: the handler asks the DOM
  // where focus is, so it needs no closure over which tab fired it. Same shape
  // as .shot-index's, including the wrap and the preventDefault -- Home and End
  // would otherwise scroll the card out from under the row.
  // FOCUS AND SELECTION MOVE TOGETHER (APG's "automatic activation"), which is
  // the right choice here for the reason the carousel gives about a focused dot
  // that is not the frame on screen: two cursors disagreeing. It is also the
  // cheap choice -- there are three panels, each one line long, so following the
  // arrows costs nothing to render.
  list.addEventListener('keydown', (e) => {
    const at = tabs.indexOf(document.activeElement);
    if (at < 0) return;
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = (to + tabs.length) % tabs.length;
    show(next);
    tabs[next].focus();
  });

  // The markup already ships the first tab selected. Re-asserting it from what
  // the markup says -- rather than from 0 -- is what guarantees the three
  // attribute sets agree before anything is pressed, and it is what lets the
  // panel be edited to open on a different tab without this file being told.
  show(Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')));
}

// ---- THE ENLARGED FRAME ---------------------------------------------------
// "Become big when you click on them (fullscreen ish i guess)". A modal
// <dialog>, and the reasoning for that over the Fullscreen API is written at the
// element in index.html. What is here is the wiring, and it is three things.
//
// THE CAP IS THE SOURCE FILE, WRITTEN PER PICTURE. --shot-w / --shot-h come off
// the clicked frame's naturalWidth/naturalHeight, so the ceiling is the file
// rather than a number chosen in the stylesheet, and min() in .shot-zoom-img
// takes whichever of the source and the viewport binds first. The three sources
// are 1092x585, 1021x600 and 327x600, so 1092 wide and 600 tall are the largest
// anything is ever drawn and nothing is upscaled at any viewport. Falling back
// to the markup's width/height attributes rather than to nothing: the frames are
// loading="lazy" and a picture that has not decoded reports naturalWidth 0,
// which would leave the cap at 92vw and blow a 327px phone screenshot up to
// 1324px on a desktop -- the one thing this whole block exists to prevent.
//
// FOCUS GOES BACK TO THE FRAME THAT OPENED IT. close() does this itself in
// current browsers; afterZoom() re-asserts it rather than trusting it, because
// the element is one this file already holds and an isConnected check is cheaper
// than a bug that puts the keyboard at the top of the document. Trapping while
// open is showModal()'s job, not ours.
//
// AND THE LOOP STOPS WHILE IT IS OPEN, ON A CONDITION OF ITS OWN. Neither of
// the other two brakes survives the open: the dialog is in the top layer, so
// focus leaves the row's subtree the moment it appears, and the pointer is over
// a scrim rather than over the row. `zoom.open` is therefore the third term in
// row.sync() -- an enlarged picture holds every row, including the one it did
// not come from, because a frame swapping behind the scrim is a frame the reader
// never saw change.
const zoom = document.querySelector('.shot-zoom');
let zoomFrom = null;

function openZoom(img) {
  if (!zoom || zoom.open) return;
  const w = img.naturalWidth || Number(img.getAttribute('width')) || 0;
  const h = img.naturalHeight || Number(img.getAttribute('height')) || 0;
  if (w) zoom.style.setProperty('--shot-w', `${w}px`);
  if (h) zoom.style.setProperty('--shot-h', `${h}px`);
  const big = zoom.querySelector('.shot-zoom-img');
  big.src = img.currentSrc || img.src;
  // The alt is the frame's own, unchanged: the enlargement is the same picture,
  // so a second description of it would be a second chance to get it wrong.
  big.alt = img.alt;
  zoomFrom = img.closest('.shot-open');
  zoom.showModal();
  // After showModal(), because sync() reads zoom.open as one of the three things
  // that hold a row.
  for (const row of shots) row.sync();
}

function closeZoom() {
  if (!zoom || !zoom.open) return;
  zoom.close();
  afterZoom();
}

// THE TIDY-UP IS CALLED, NOT AWAITED, AND THE `close` EVENT IS ONLY THE BACKSTOP.
// <dialog>'s close event is fired from a QUEUED task, not from close() itself,
// and a document that is not being rendered can leave that task sitting: in the
// review harness -- a hidden document -- it never arrived at all, for the same
// family of reasons rAF never fires there. Hanging the focus return on it would
// mean the keyboard is left in the top layer of a dialog that has gone. So every
// path that closes the picture calls this directly and the event is wired to it
// as well, for a close this file did not initiate. It is idempotent: the first
// run clears the src, and the second returns on that.
function afterZoom() {
  const big = zoom.querySelector('.shot-zoom-img');
  if (!zoomFrom && !big.hasAttribute('src')) return;
  // The src is dropped so a 1092px decode is not held for a picture nobody is
  // looking at, and so the next open cannot flash the previous frame.
  big.removeAttribute('src');
  big.alt = '';
  const back = zoomFrom;
  zoomFrom = null;
  // The UA restores focus on close() by itself; this re-asserts it rather than
  // trusting it, and skips a frame that is no longer the current one -- a picture
  // opened, left open past an advance and then closed must not hand the keyboard
  // to an inert button.
  if (back && back.isConnected && !back.inert) back.focus({ preventScroll: true });
  // The rows re-ask the whole question rather than being handed `false`: the
  // pointer may well still be over the frame that was just clicked, in which
  // case the row stays held and the loop does not restart under it.
  for (const row of shots) row.sync();
}

if (zoom) {
  for (const btn of document.querySelectorAll('.shot-open')) {
    btn.addEventListener('click', () => {
      const img = btn.querySelector('.feature-shot');
      if (img) openZoom(img);
    });
  }
  zoom.querySelector('[data-shot-close]').addEventListener('click', () => closeZoom());
  zoom.addEventListener('close', afterZoom);

  // THE SCRIM DISMISSES IT TOO. "make clicking outside of it, bring it back to
  // normal size" -- 10 Aug 2026. A third way out beside the ✕ and Escape, and
  // the one a reader reaches for first.
  // MEASURED AGAINST THE PICTURE'S RECT, NOT `e.target === zoom`. Target equality
  // is the usual hook for a backdrop click, and it is wrong here: this dialog's
  // box is a column, so the ✕ and its 10px gap are inside that box and above the
  // picture. A press in that strip reports the dialog and would close a frame the
  // reader was aiming at. The image's own rect is the only edge he can see.
  // BOTH ENDS OUTSIDE, WHICH IS WHY THIS IS NOT ONE click HANDLER. A press that
  // starts on the picture and releases on the scrim -- a slip, or a drag -- still
  // dispatches a click, at the dialog, because the dialog is the common ancestor.
  // A plain click handler would shut the picture the reader was holding, so the
  // press is recorded on pointerdown and the release has to be outside as well.
  // Do not simplify this back. Pointer events rather than mouse: a tap outside is
  // the same gesture and gets the same answer.
  const outsideShot = (e) => {
    const r = zoom.querySelector('.shot-zoom-img').getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right ||
           e.clientY < r.top  || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  zoom.addEventListener('pointerdown', (e) => { pressedOutside = outsideShot(e); });
  zoom.addEventListener('click', (e) => {
    const from = pressedOutside;
    // Cleared unconditionally, so a click arriving without a press of its own --
    // Enter on the ✕ synthesises one at 0,0, which is outside every rect -- cannot
    // inherit an earlier press's answer.
    pressedOutside = false;
    if (from && outsideShot(e)) closeZoom();
  });

  // ESCAPE CLOSES THE PICTURE FIRST AND THE PANEL ONLY WHEN NONE IS OPEN.
  // The window handler further down turns Escape into leave(), and a modal
  // dialog does not stop the key reaching it: the keydown is dispatched at the
  // dialog and bubbles all the way up, and only afterwards does the UA process
  // its own close request. Without this, one press would shut the picture AND
  // the panel behind it.
  // CAPTURE, ON window, so the ordering does not depend on which listener was
  // registered first -- a capture listener on window runs before any bubble
  // listener anywhere. The dialog is closed here explicitly rather than left to
  // the UA, because stopPropagation is what keeps the key off leave() and there
  // is no way to stop propagation and still be sure the default close ran.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !zoom.open) return;
    e.preventDefault();
    e.stopPropagation();
    closeZoom();
  }, true);
}

$('resumeScroll').addEventListener('scroll', (e) => {
  const node = e.currentTarget;
  const max = node.scrollHeight - node.clientHeight;
  if (max > 0) {
    // Anchored on RESERVE_REST rather than on a floor of its own: an unscrolled
    // timeline is the resting state, so the bottom of this ramp has to be the
    // same notch the hand starts on, or the first scroll event would jump the
    // hand off it and scrolling back to the top would never return it. The top
    // of the ramp is AUF: reading to the end of the run winds the movement
    // fully. (It used to be the FULLY WOUND line under the last entry that said
    // so. That line is gone -- removed on its own instruction as an AI artefact
    // -- and it does not come back with this direction.) One state.reserve
    // feeds both the dial hand and the panel meter, so they cannot disagree.
    state.reserve = Math.min(1, RESERVE_REST + (1 - RESERVE_REST) * (node.scrollTop / max));
    render();
  }
});

// Escape is "go back one", and there are two things to go back from -- a panel
// and the caseback. It used to test for them in turn; placeNow() is that test,
// and leave() dispatches on the same value, so the key is now one line and the
// precedence question it used to answer no longer exists. Returning from the
// caseback still puts focus on the crown -- hideContact() does it, so this path
// does not have to say so. The one path that lands somewhere else is a rail word
// closing itself, which keeps focus on the word; it passes leave() the element,
// and everything that does not pass one gets the crown.
//
// Escape still means CLOSE, not "walk the history". It lands on the bare watch
// even when a second destination is underneath in the history -- leave() pushes
// home in that case rather than backing into the previous panel, because a key
// that closes a card by opening a different one is not a close.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  leave();
});

// ---- living caseback rig ---------------------------------------------------
// Every wheel animates via WAAPI against one shared epoch, so the stepped
// seconds pair advances on the same 5-per-second beat grid as the balance
// swing. Animations exist only while the caseback shows; cancel() returns
// each sprite to the untransformed (crisp) raster path, keeping the at-rest
// caseback byte-identical to the render. Reduced motion never animates, and
// the rig only fades in once every layer has loaded (any failure leaves the
// original render showing).
const rig = {
  parts: [...document.querySelectorAll('.cb-rig-part')],
  anims: [],
  reduced: matchMedia('(prefers-reduced-motion: reduce)'),
  nudgeT: 0,
};

// Chrome can miss the lossless floor's first raster inside the 3D-flipped
// subtree (the aperture shows black until any paint invalidation). A style
// toggle across two frames after the flip transition settles forces it.
function rigNudgePaint() {
  // will-change toggle with a forced style flush, held across real frames —
  // the transform-toggle variant cleared inside coalesced rAFs and never
  // survived a commit, so the missing raster stayed missing
  const fire = () => {
    for (const sel of ['.cb-movement-image', '.cb-rig-base']) {
      const im = document.querySelector(sel);
      if (!im) continue;
      im.style.willChange = 'auto';
      void im.offsetWidth;
      im.style.willChange = 'transform';
      void im.offsetWidth;
      setTimeout(() => { im.style.willChange = ''; }, 150);
    }
  };
  // the stall appears when the flip transition settles and Chrome
  // re-rasterizes the 3D subtree — nudge after it, with spaced backstops
  el.flip.addEventListener('transitionend', () => setTimeout(fire, 120), { once: true });
  clearTimeout(rig.nudgeT);
  rig.nudgeT = setTimeout(fire, 2400);
  setTimeout(fire, 4500);
}

// ---- THE RIG APPEARS EVEN IF ITS PARTS DO NOT ------------------------------
// Nikhil, 11 Aug 2026: "improve the loading of everything in the webiste. Poor
// wifi shouldnt affect the webiste. it should just take longer to load".
//
// .cb-rig is opacity 0 until .rig-ready (see the @supports block in styles.css),
// and this is the only thing that ever adds it. So this line decides whether the
// living movement is ever seen, and it used to decide it ALL OR NOTHING across
// twenty-five sprites: Promise.all with a REJECT on `error`, caught and dropped.
// Two ways that lost the movement for good, both measured, both silent:
//
//   ONE SPRITE 404s -> reject -> .catch(() => {}) -> .rig-ready never added.
//   Measured: 404 on rig/base.webp, .rig-ready never arrived; the aperture kept
//   the static lossless floor for ever. A 1KB corrector plate failing to fetch
//   cost the whole movement, which is the wrong exchange rate by three orders of
//   magnitude -- a sprite that never comes should leave a GAP, not a dead rig.
//
//   ONE SPRITE STALLS -> neither `load` nor `error` ever fires -> the promise
//   never settles -> .rig-ready never added, no error, nothing in the console.
//   This is the poor-wifi case exactly: not a failure, just a request the
//   network has not finished, and the movement was gone permanently because of
//   it. Measured: stalling part-balance.webp alone did it.
//
// So: allSettled, not all -- an errored sprite is a settled sprite and must not
// veto the other twenty-four. And a deadline, because allSettled still waits for
// ever on a request that never answers, and a promise that never settles is the
// same dead page as a rejected one. Whichever comes first wins; both are
// idempotent, classList.add being a set operation.
//
// THE DEADLINE IS 4s AND IT IS A BACKSTOP, NOT A SCHEDULE. On any connection
// that answers, allSettled wins the race and the behaviour is byte-identical to
// before -- fast loads were measured at ~1.4s, well inside it. It only fires
// when the network has genuinely stopped answering, and what it buys is the rig
// revealed with holes in it rather than not revealed. Holes are cheap here: the
// sprites are layered OVER .cb-movement-image, the same render they were cut
// from, so a part that has not arrived shows the lossless floor's own pixels in
// its place and the aperture is never blank. Late arrivals paint themselves in
// as they land -- an <img> that decodes inside a visible parent needs nothing
// from this file. That is what makes it progressive rather than all-or-nothing.
//
// `i.complete` alone, where it used to be `i.complete && i.naturalWidth`. The
// second term was a third way to hang: an image that had ALREADY failed before
// this line ran is complete with naturalWidth 0, so it took the else branch and
// waited on a `load`/`error` that had both already been dispatched and would
// never come again. Complete is complete, however it ended.
const rigSettled = Promise.allSettled(
  [...document.querySelectorAll('.cb-rig img')].map((i) =>
    i.complete ? Promise.resolve()
      : new Promise((res) => {
          // resolve on BOTH: `error` means this sprite is a gap, which is a
          // decided outcome, and the other sprites are not waiting on a verdict
          i.addEventListener('load', res, { once: true });
          i.addEventListener('error', res, { once: true });
        })
  ));
const rigDeadline = new Promise((res) => setTimeout(res, 4000));
Promise.race([rigSettled, rigDeadline])
  .then(() => el.back.classList.add('rig-ready'));

function rigPlay() {
  if (rig.reduced.matches || rig.anims.length) return;
  rigNudgePaint();
  const t0 = document.timeline.currentTime + 60;
  for (const img of rig.parts) {
    let cfg;
    try { cfg = JSON.parse(img.dataset.anim); } catch { continue; }
    let a;
    if (cfg.type === 'spin') {
      const to = cfg.direction === 'ccw' ? -360 : 360;
      a = img.animate(
        [{ transform: 'rotate(0deg)' }, { transform: `rotate(${to}deg)` }],
        { duration: cfg.period_s * 1000, iterations: Infinity,
          easing: cfg.steps ? `steps(${cfg.steps}, jump-end)` : 'linear' });
    } else {
      // balance: one swing per iteration, alternate; iterationStart .5 makes
      // it depart from 0 deg (the identity pose) at the flip moment
      a = img.animate(
        [{ transform: `rotate(${-cfg.amplitude_deg}deg)` },
         { transform: `rotate(${cfg.amplitude_deg}deg)` }],
        { duration: cfg.period_s * 500, iterations: Infinity,
          direction: 'alternate', easing: 'ease-in-out', iterationStart: 0.5 });
    }
    a.startTime = t0;
    rig.anims.push(a);
  }
}

function rigStop() {
  for (const a of rig.anims) a.cancel();
  rig.anims.length = 0;
}

// ---- THE WATCH IS NOT ANSWERING YET ----------------------------------------
// The seven hit targets are laid out at their final positions from the first
// frame, so until the watch has assembled they answer a pointer crossing a dial
// that is not there: a lit pulse mark and the part's caption over empty black.
//
// INERT, NOT pointer-events. The gate has to close four doors, and inert is the
// only one primitive that closes all four -- the pointer, the tab stop, Enter
// and Space, and the accessibility tree. pointer-events would leave the
// keyboard walking into an unbuilt watch and opening a section from it, which
// is the same bug with a different input device. It also has no holes:
// #secondsDial and #moon opt back into hit testing with an id (see the
// pointer-events note on .dial-group), and no class rule can outrank that.
//
// WHEN IT OPENS is not a number here, and not a timeout. It is the end of the
// partsLive animation in styles.css, whose delay is --hint-at -- the instant
// the interaction index declares these parts live -- so the gate and the
// promise are the same moment. Waiting on an animation rather than on a clock
// is what makes the three arrival paths one path: the two rules that collapse
// the intro for a deep link and for reduced motion zero that delay along with
// every other, so the gate opens as soon as the watch is there in all three.
// .finished rather than an animationend listener, because on the deep-link path
// the animation is already over by the time this line runs.
//
// A CLICK DURING THE INTRO IS SWALLOWED, and does not cut the intro short.
// Before the watch is on screen there is nothing to have clicked -- opening a
// section from a click on empty black is answering a question nobody asked --
// and the site has already decided it gives the same intro every time, which is
// why the sessionStorage intro-skip was removed (see ARRIVING MID-SITE in
// index.html). Someone who wants in immediately has the address, and #/resume
// is exactly the path that skips this.
//
// state.touched is left alone. It means "the visitor has operated the watch",
// and nothing that happens behind the gate is an operation, so the interaction
// index is still unspent at the moment it is scribed.
let pointerAt = null;
const trackPointer = (e) => { pointerAt = { x: e.clientX, y: e.clientY }; };

function goLive() {
  removeEventListener('pointermove', trackPointer);
  el.flip.inert = false;
  // The rail is the same bug through the other door. Its words are laid out and
  // hit-testable from the first frame while railIn holds them at opacity 0, so
  // before the gate an invisible word can be hovered, focused, tabbed to and
  // clicked -- and hovering one writes state.hover, which fires the reciprocal
  // highlight into a watch that is not built yet. One rule on one element does
  // it, because the rail arrives as a single animation on .rail rather than as
  // five staggered ones. Released here rather than on its own clock: --rail-at
  // IS --hint-at, so there is one moment, and tying it to one timer keeps it
  // that way if either is ever retimed.
  el.rail.inert = false;
  // The pointer may have rested on a part for the whole intro, and a subtree
  // that stops being inert generates no boundary event of its own -- so the
  // part under the cursor would stay dark until the visitor happened to move.
  // Ask what is under the last known pointer and let that part say what it
  // would have said. Dispatching the event rather than writing state.hover
  // keeps this from drifting from bind()'s handlers and the fittings' own.
  if (!pointerAt) return;
  const under = document.elementFromPoint(pointerAt.x, pointerAt.y);
  const part = under && under.closest('.part-hit');
  if (part) part.dispatchEvent(new MouseEvent('mouseenter'));
}

const gate = el.flip.getAnimations().find((a) => a.animationName === 'partsLive');
// No clock, no gate. If the rule is ever renamed or the stylesheet fails, the
// watch is live immediately rather than inert for ever: a missing gate must
// cost the fix, never the site.
if (!gate) goLive();
else {
  el.flip.inert = true;
  el.rail.inert = true;
  addEventListener('pointermove', trackPointer, { passive: true });
  gate.finished.then(goLive, goLive);   // a cancelled clock opens the gate too
}

// The idle pump. 'mechanical' quantises the seconds hand onto a 1/6s beat, and
// a fixed 100ms period cannot land on one: the hand still takes every 1deg step
// and drops none, but it takes them 200, 200, then 100ms apart, which is an even
// step drawn at an uneven interval and reads as a limp. So each frame is
// scheduled at the next beat rather than a fixed period later, and the wait is
// capped at the old 100ms so nothing else on the dial refreshes more slowly than
// it used to. The demo puts rAF on top of this for its own four seconds -- see
// demoPump() -- and this pump keeps running underneath it either way.

// The address the visitor actually arrived on, applied once before the first
// pump: a reload lands where you were, and a shared link opens what it names.
// No history entry is created here -- the entry we are standing on is the one
// the browser made -- which is also what makes Back from a deep link go back to
// wherever the link was clicked, rather than nowhere.
//
// The matching intro skip is NOT here. It has to be decided before the first
// paint, or the loader is already on screen and the assembly already running, so
// it is six lines of inline script in <head> and three CSS rules; see ARRIVING
// MID-SITE in src/styles.css.
applyRoute();
// Everything after this line is a visitor doing something, so a section opened
// from here on turns its part. See THE SECTION'S SALUTE.
arrived = true;

// ---- THE GUILLOCHE'S PHASE ------------------------------------------------
// The engine-turned field on the stage runs at one degree per second, so its
// angle IS a reading of the clock -- but only if it starts where the clock is.
// Left to itself a CSS animation starts at 0deg whenever the page happens to
// load, which would make it a six-minute loop that merely has the right rate.
// A negative animation-delay seeks it instead: the animation is told it began
// `into` seconds ago, so the first painted frame is already at the right angle
// and every visitor at a given instant sees the same one.
//
// Set once, not pumped. The animation keeps its own time from here, and the
// pump next door redraws the hands ten times a second without touching this --
// re-seeking it every tick would fight the compositor for a value it already
// has right.
//
// Local time rather than UTC, deliberately: it is the same clock the hands are
// reading two layers up. 360 is the cycle in seconds AND in degrees, which is
// what 1deg/s buys -- the modulo and the angle are the same number, so there is
// no conversion here to get wrong.
{
  const d = new Date();
  const into = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
                + d.getMilliseconds() / 1000) % 360;
  const node = $('stageGuilloche');
  node.style.animationDelay = `${-into.toFixed(3)}s`;
  // The same angle as a static value, for the reduced-motion rule that turns
  // the animation off -- see THE ENGINE TURNING in src/styles.css. Written
  // unconditionally because the animation outranks it whenever it is running.
  node.style.setProperty('--guilloche-at', `${into.toFixed(1)}deg`);
}

const BEAT = { mechanical: 1000 / 6, quartz: 1000 }[CONFIG.secondsMotion] || 0;
(function pump() {
  render();
  const now = Date.now();
  const wait = BEAT ? BEAT - (now % BEAT) : 100;
  setTimeout(pump, Math.max(8, Math.min(wait, 100)));
})();
