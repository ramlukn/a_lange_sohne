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
// same line already prints; “ ” are a matched pair that read as a name. IBM Plex
// Mono cuts both. The words are the visitor's own and are not touched.
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
// Research, Miscellany, then Contact, which is docs/PLAN.md's own order with
// Books renamed. It is not DOM order, and it is
// no longer in any tension with the interaction index's scribe order: the index
// has no scribe order any more -- all five marks are drawn on one frame -- and
// neither does the rail. This list orders the words on the page. It does not
// order anything in time.
//
// MISCELLANY WAS BOOKS, AND THE KEY MOVED WITH THE LABEL. The section is
// deliberately broadening -- books were the first thing in it, not the whole of
// it -- so the address is `#/miscellany`, the panel is `panel-miscellany` and
// the pulse mark's data-part is `miscellany`. Renaming the label and leaving the
// key would have put the drift this list exists to prevent inside the list
// itself: one word in the rail, another in the URL, a third in the markup.
// `#/books` is not redirected. It was never published -- every panel on this
// site is still Lorem -- and a route table carrying an alias for an address
// nobody has is a maintenance cost paid for nothing.
const SECTIONS = [
  { key: 'about',      label: 'About',      part: 'MAIN DIAL',     hit: 'aboutHit',    panel: 'panel-about',      origin: '31.8% 50%' },
  { key: 'resume',     label: 'Resume',     part: 'POWER RESERVE', hit: 'reserve',     panel: 'panel-resume',     origin: '65.5% 47.5%' },
  { key: 'projects',   label: 'Projects',   part: 'OUTSIZE DATE',  hit: 'dateWindow',  panel: 'panel-projects',   origin: '63.75% 26.05%' },
  { key: 'research',   label: 'Research',   part: 'SMALL SECONDS', hit: 'secondsDial', panel: 'panel-research',   origin: '64.5% 75.115%' },
  { key: 'miscellany', label: 'Miscellany', part: 'MOONPHASE',     hit: 'moon',        panel: 'panel-miscellany', origin: '64.5% 67.535%' }
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
const CAPTIONS = {
  ...Object.fromEntries(SECTIONS.map((s) => [s.key, `${s.label.toUpperCase()} — THE ${s.part}`])),
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
  reserveCycles: 3,    // whole end-to-end round trips, ~0.67s per traverse
  reserveHold: 0.85,   // fraction of the demo held at full end-to-end travel
  reducedMs: 1200      // reduced motion: no movement, just an acknowledgement
};
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

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
// styles.css (twice: THE RAIL and NARROW SCREENS) because the pose is written by
// render() as an inline style ten times a second and a stylesheet cannot reach
// it. Keep the three together.
const NARROW = matchMedia('(max-width: 1199px)');
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
  const wind = (turns) => turns * 360 * spin;   // 0 turns of offset when idle
  const angHour = hr * 30 + wind(DEMO.turns.hour);
  const angMin = min * 6 + wind(DEMO.turns.min);
  const angSec = sec * 6 + wind(DEMO.turns.sec);
  el.hour.style.transform = `rotate(${angHour.toFixed(2)}deg) translateZ(var(--z-hand-hour))`;
  el.min.style.transform = `rotate(${angMin.toFixed(2)}deg) translateZ(var(--z-hand-min))`;
  el.sec.style.transform = `rotate(${angSec.toFixed(2)}deg) translateZ(var(--z-hand-sec))`;

  // The date runs whole months forward, so the wrap lands on today again. The
  // eased rate is already under one day per second past t~0.9, so the true date
  // is showing well before the demo clears -- no jump on the last frame.
  let date = d.getDate();
  if (demoing) date = ((date - 1 + Math.round(spin * DEMO.dateTurns * 31)) % 31) + 1;
  el.dateTens.textContent = Math.floor(date / 10);
  el.dateOnes.textContent = date % 10;

  // The starfield is engraved on the lunar wheel itself, so sky and moon share one rotation.
  const age = moonAge(now);
  const moonDeg = ((age / SYNODIC_DAYS) * 180 - 90 + wind(DEMO.turns.moon)).toFixed(2);
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
  // space: at reach = 0 the expression collapses to v0 exactly, which converts
  // back to reserveDeg(state.reserve) exactly, and the smoothstep's zero slope
  // still lands it there with zero velocity. The hand coasts home rather than
  // snapping, onto the same notch it left.
  const reserveTrue = Math.min(1, Math.max(0, state.reserve));
  let reserveAngle = reserveDeg(reserveTrue);
  if (demoing) {
    const u = Math.min(1, Math.max(0, (demoT - DEMO.reserveHold) / (1 - DEMO.reserveHold)));
    const reach = 1 - u * u * (3 - 2 * u);
    const span = RESERVE_DEG_HI - RESERVE_DEG_LO;          // the 160deg travel
    const v0 = (RESERVE_DEG_HI - reserveAngle) / span;      // truth, in demo units
    const phase = Math.acos(1 - 2 * v0);
    const sweep = 0.5 - 0.5 * Math.cos(2 * Math.PI * DEMO.reserveCycles * demoT + phase);
    reserveAngle = RESERVE_DEG_HI - (v0 + reach * (sweep - v0)) * span;
  }
  // .reserve-hand carries a .6s transition for the scroll-driven wind, which
  // would smear a per-frame sweep into a lagging blur. Suppressed for the demo
  // and restored on the settling frame, where the value is already true.
  el.reserveHand.style.transition = demoing ? 'none' : '';
  el.reserveHand.style.transform = `rotate(${reserveAngle.toFixed(1)}deg) translateZ(var(--z-hand-res))`;
  // The bar reads the printed scale, not the hand's travel, so it stays an
  // honest percentage while the hand is off the end of the dial: past AUF it
  // reads 100 and past AB it reads 0, rather than going over or under. Off the
  // demo this is the identity -- reserveDeg() inverted is state.reserve.
  const reservePct = (RESERVE_AB - reserveAngle) / RESERVE_SCALE;
  el.reserveBar.style.width = `${Math.round(Math.min(1, Math.max(0, reservePct)) * 100)}%`;

  // The status line, on its own four-second clock. The caption below is its only
  // reader now that the panel it also fed has gone.
  const cur = CURRENTLY[Math.floor(now / 4000) % CURRENTLY.length];

  // The demo outranks hover: the cursor is still on the pusher that started it,
  // and under reduced motion this line is the only feedback the press gets.
  el.caption.textContent = state.demo
    ? (state.demo.reduced
        ? 'DEMONSTRATION SKIPPED — REDUCED MOTION'
        : 'DEMONSTRATION — ALL FUNCTIONS IN MOTION')
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
  // MISCELLANY costs one more reader of the same value -- there is no second
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
  placeRailMarker();

  // This one attribute IS the hover highlight's whole state. The CSS rule that
  // carries it only matches while data-hover names the part, so '' -> 'miscellany'
  // starts the arrival and holds the glow, and 'miscellany' -> '' releases it -- the
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
// all arrive from one value, so hovering the word MISCELLANY and hovering the
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
  if (!state.demo) { demoPumping = false; render(); return; }
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
  state.demo = { t0: Date.now(), reduced };
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

// The card's close control and the scrim behind it. Through the router, so
// closing writes the address exactly as Back does -- there is one way out of a
// section and three things that can ask for it.
document.querySelectorAll('[data-close]').forEach((node) =>
  node.addEventListener('click', () => leave())
);

$('resumeScroll').addEventListener('scroll', (e) => {
  const node = e.currentTarget;
  const max = node.scrollHeight - node.clientHeight;
  if (max > 0) {
    // Anchored on RESERVE_REST rather than on a floor of its own: an unscrolled
    // timeline is the resting state, so the bottom of this ramp has to be the
    // same notch the hand starts on, or the first scroll event would jump the
    // hand off it and scrolling back to the top would never return it. The top
    // of the ramp stays AUF, which is what the last entry ("Fully wound.") says.
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

Promise.all([...document.querySelectorAll('.cb-rig img')].map((i) =>
  i.complete && i.naturalWidth ? Promise.resolve()
    : new Promise((res, rej) => { i.addEventListener('load', res); i.addEventListener('error', rej); })
)).then(() => el.back.classList.add('rig-ready'))
  .catch(() => {});

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
