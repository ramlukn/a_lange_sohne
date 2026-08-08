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
// gone, and the small seconds now open Research.
const CURRENTLY = [
  { label: 'READING', value: 'Lorem Ipsum: A History' },
  { label: 'WEARING', value: 'Dolor Sit Ref. 38.5' },
  { label: 'BUILDING', value: 'Consectetur Engine' },
  { label: 'RESEARCHING', value: 'Adipiscing Methods' }
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
// The order is the rail's order, top to bottom (docs/PLAN.md: About, Resume,
// Projects, Research, Books, then Contact on the caseback). It is deliberately
// NOT the interaction index's scribe order -- nobody can hold that comparison
// across four seconds -- and it is not DOM order either.
const SECTIONS = [
  { key: 'about',    label: 'About',    part: 'MAIN DIAL',     hit: 'aboutHit',    panel: 'panel-about',    origin: '31.8% 50%' },
  { key: 'resume',   label: 'Resume',   part: 'POWER RESERVE', hit: 'reserve',     panel: 'panel-resume',   origin: '65.5% 47.5%' },
  { key: 'projects', label: 'Projects', part: 'OUTSIZE DATE',  hit: 'dateWindow',  panel: 'panel-projects', origin: '63.75% 26.05%' },
  { key: 'research', label: 'Research', part: 'SMALL SECONDS', hit: 'secondsDial', panel: 'panel-research', origin: '64.5% 75.115%' },
  { key: 'books',    label: 'Books',    part: 'MOONPHASE',     hit: 'moon',        panel: 'panel-books',    origin: '64.5% 67.535%' }
];
const SECTION = new Map(SECTIONS.map((s) => [s.key, s]));

// The caption, derived. The crown and the pusher are the two hoverable things
// that are not sections -- the crown turns the watch over, the pusher runs the
// demonstration -- so they are the only captions still written out by hand.
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
let narrowPose = null;
function measureNarrowPose() {
  if (!NARROW.matches) { narrowPose = null; return; }
  // How tall the card is, taken FROM the stylesheet rather than restated here:
  // --sheet-vh is declared in the narrow block next to the rule that uses it, so
  // the card's height and the watch's room above it cannot drift apart.
  const sheet = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-vh')) || 0;
  // And how far off the bottom the card sits, taken from the overlay's own
  // padding rather than restated. That padding is THE RAIL's: below 1200px the
  // links become a row along the bottom and the overlay makes room for them, so
  // this reads the rail's clearance without knowing that is what it is. It
  // resolves on a display:none element because it is an absolute length.
  const below = parseFloat(getComputedStyle(el.overlay).paddingBottom) || 0;
  const box = el.pose.parentElement.getBoundingClientRect();   // .watch-stage
  if (!box.height) return;
  const gap = (innerHeight * GAP_VH) / 100;
  const band = innerHeight - below - (innerHeight * sheet) / 100 - 2 * gap;
  const scale = Math.max(.24, Math.min(.72, band / box.height));
  const dy = (gap + (box.height * scale) / 2) - (box.top + box.height / 2);
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
// The navigation, built from the same SECTIONS list the captions, the click
// targets and the panels come from: one <a> per row, in that list's order, top
// to bottom. It is #hintBar promoted -- the sentence that used to name the live
// parts said the same thing in prose and could not be clicked. Its mode line,
// "CROWN TO FLIP", moved into the caption; the part names moved into the words.
//
// The reveal order is this list's order and NOT the interaction index's scribe
// order. Matching them was considered and is cleverness with no audience: the
// index finishes four seconds before the first word arrives, and nobody can
// hold an ordering across that gap to notice it agreeing.
//
// THE SIXTH ITEM IS ABSENT, AND THAT IS A DECISION.
// The rail was specified as six -- Contact is the sixth -- but Contact was to
// live on the caseback and that work has been called off, so there is nothing
// for a CONTACT link to open. This project's own rule for a section with no
// content is that it leaves the rail (docs/PLAN.md: "it doesn't ship: it leaves
// the rail"), and a link that looks live and does nothing is the worst of the
// available options; rendering it greyed out is the same lie with an apology
// printed next to it. So it is not here. When Contact has a destination it is
// one more row in SECTIONS above, and nothing in this block changes.
const railLinks = new Map();
el.rail.append(...SECTIONS.map((s, i) => {
  const a = document.createElement('a');
  a.className = 'rail-link';
  // A real href, so the link behaves like one -- middle-click, copy link
  // address, the status bar -- and so Phase 3's routing has only to drop the
  // preventDefault in the click handler below and listen for hashchange. The
  // fragment deliberately matches no element id, so the default action would be
  // a no-op rather than a scroll even if it ever got through.
  a.href = `#/${s.key}`;
  a.dataset.key = s.key;
  a.style.setProperty('--i', i);   // this word's place in the reveal queue
  a.textContent = s.label;
  railLinks.set(s.key, a);
  return a;
}));

// Where you are. A short gold hairline in the marker channel, level with the
// open section, which travels to the next one over 200ms instead of fading out
// and in -- one pointer along a scale, the gesture the reserve hand already
// makes against AUF/AB. It is one element for all five positions, which is what
// makes travel the only thing it CAN do.
const railMarker = document.createElement('span');
railMarker.className = 'rail-marker';
railMarker.setAttribute('aria-hidden', 'true');
el.rail.append(railMarker);   // last child: the CSS reaches it with `~`

// Both centres are written every time and the stylesheet uses whichever one is
// its own axis -- vertical in the column, horizontal in the bottom row. That is
// deliberate: it keeps the 1200px breakpoint written once, in CSS, instead of
// copying it into a matchMedia here that could drift from it. offsetTop and
// offsetLeft are measured from the same padding edge the marker's own left/top
// of 0 resolves to, so there is no origin to correct for in either layout.
let markerAt = null;
function placeRailMarker(force) {
  if (!force && markerAt === state.active) return;
  const node = state.active ? railLinks.get(state.active) : null;
  // A hidden rail measures zero; keep the last good value rather than parking
  // the mark at the top of a box that is not being laid out.
  if (node && !node.offsetHeight) return;
  markerAt = state.active;
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
        // "CROWN TO FLIP" is the hint sentence's mode line, moved here when the
        // rail took the element it used to live in. It belongs with the status
        // line rather than in the rail: the rail says where you can GO, and the
        // crown does not go anywhere -- it turns the object over. This is the
        // one state in which nothing else is being said, which is why it can
        // carry it without displacing anything.
        : `CURRENTLY ${cur.label} — ${cur.value.toUpperCase()}   ·   CROWN TO FLIP`;

  const pose = watchPose();
  el.pose.style.transform = pose.transform;
  el.pose.style.filter = pose.filter;
  el.pose.style.transformOrigin = pose.origin;

  el.flip.style.transform = `rotateY(${state.flipped ? 180 : 0}deg)`;
  el.front.style.opacity = state.flipped ? 0 : 1;
  el.back.style.opacity = state.flipped ? 1 : 0;
  el.back.classList.toggle('is-flipped', state.flipped);
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
  // BOOKS costs one more reader of the same value -- there is no second state,
  // and no way for the two ends to disagree.
  // Active outranks hover, so the word you are reading stays the word that is
  // lit while the pointer wanders. Written only on change: render() also runs on
  // a 100ms pump, and an unconditional write would restyle five links ten times
  // a second and retrigger the colour transition on each.
  for (const [key, node] of railLinks) {
    const want = state.active === key ? 'active' : state.hover === key ? 'hover' : '';
    if (node.dataset.state === want) continue;
    node.dataset.state = want;
    if (want === 'active') node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  }
  placeRailMarker();

  // This one attribute IS the hover highlight's whole state. The CSS rule that
  // carries it only matches while data-hover names the part, so '' -> 'books'
  // starts the arrival and holds the glow, and 'books' -> '' releases it -- the
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
  // still clickable from the back, and the crown is the ONLY way back to the
  // dial. Suppressing their highlight there would mean the one control you
  // actually need is the one control that stops answering, which is a worse
  // version of the bug this pass exists to fix.
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

// Showing and hiding are the only two places focus moves on its own, and they
// are a pair: showSection() remembers what it was opened from and puts focus on
// the panel, hideSection() puts it back. Nothing is trapped -- Tab still walks
// out of the card and on through the page -- but the keyboard never has to start
// again from the top of the document, which is what "lost focus" actually feels
// like.
//
// These two move STATE ONLY. They know nothing about the address bar, and
// nothing outside the routing block below calls them: every control that
// navigates goes through goToSection() / leaveSection(), which is what keeps the
// address and the panel from ever disagreeing. They also do not set
// state.touched -- arriving on a link is not operating the watch; see
// goToSection().
function showSection(key, from) {
  state.active = key;
  state.hover = null;
  // THE FLIP, from Phase 2's goToSection(). It lives down here rather than up in
  // the intent function because it is an invariant of the state and not of the
  // click: every section is on the FRONT of the watch, so a panel must never
  // open over the back of one. The rail stays up while the watch is turned over,
  // so a section can be asked for from the caseback -- and so can Back, Forward
  // and a pasted address, which are the paths that do not pass through
  // goToSection() at all.
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

// keepFocus is for the one caller that has somewhere better to put it: flipping
// the watch over closes any open panel, and handing focus back to a dial part
// that is now facing away from you would be worse than leaving it alone.
function hideSection(keepFocus) {
  if (!state.active) return;
  state.active = null;
  const back = state.returnTo;
  state.returnTo = null;
  render();
  if (!keepFocus && back && back.isConnected) back.focus();
}

// ---- ADDRESSES -------------------------------------------------------------
// One address per section, laid over the state that was already there.
// `#/about` opens About; no hash, `#/`, or a hash naming nothing is the bare
// watch. Keyed on SECTIONS, so a new row gets an address for free and a route
// can never name a section that does not exist.
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
//                                           they might want to undo, link to or
//                                           come back to
//   closing one, when the    history.back() the entry we pushed is RETIRED
//   entry underneath is                     rather than buried under a second
//   the bare watch                          one, so the history stays as short
//                                           as the visit actually was
//   closing one, any other   pushState      a second section underneath (Back
//   time                                    there would re-open the panel you
//                                           just closed) or a deep-link arrival
//                                           (Back there leaves the site)
//   a hash naming nothing    replaceState   the dead address is corrected in
//                                           place, so Back still leads back out
//                                           the way the visitor came
//   render()                 nothing        it runs ten times a second
//
// THE TWO DIRECTIONS CANNOT FIGHT. Exactly one function moves state.active in
// response to the address -- applyRoute() -- and it returns early when the two
// already agree, so a hashchange that names the open section is a no-op rather
// than a re-open. Exactly one function writes an address in response to a
// control -- goToSection() -- and it returns early for the section that is
// already open. And pushState fires no event at all, so a click never
// round-trips through the address bar and back into the state.
const HOME_URL = location.pathname + location.search;
const urlFor = (key) => (key ? `#/${key}` : HOME_URL);

// The address bar's half of SECTIONS. Anything that is not `#/` plus a key we
// know is the bare watch: a typo is not an error page.
function routeKey() {
  const m = /^#\/([\w-]+)$/.exec(location.hash);
  return m && SECTION.has(m[1]) ? m[1] : null;
}

// THE ONE DOOR IN, and Phase 2's function with an address bolted to the front of
// it. Every control that navigates calls this rather than opening a panel itself
// -- the five watch parts, the rail's five links, the keyboard -- so there is no
// way to change the section without changing the address. `from` is the element
// focus should return to when the panel closes.
function goToSection(key, from) {
  if (!SECTION.has(key) || state.active === key) return;
  railCue(null);   // whether this call is the cue's own or something that beat it
  // Set HERE and not in showSection(), because this is what state.touched
  // actually means: the visitor has operated the watch. Following a link into a
  // section, or walking Back through one, is not operating it -- and if it
  // counted, someone arriving on a shared #/resume link would close the panel to
  // a watch with the interaction index already spent, which is the one thing
  // telling them anything on it is clickable.
  state.touched = true;
  history.pushState({ key, from: state.active }, '', urlFor(key));
  applyRoute(from);
}

// Closing. history.state.from is the key of the entry underneath this one, and
// `null` means the bare watch -- the one case where the entry we pushed can be
// retired with a plain Back instead of being buried under a second one. Anything
// else gets a pushed home entry: a second section underneath, or a deep-link
// arrival, which carries no history.state at all because we never created it.
function leaveSection(keepFocus) {
  if (!state.active) return;
  const leaving = state.active;
  const undo = !!history.state && history.state.from === null;
  // The panel goes now rather than on the popstate a task later. history.back()
  // is asynchronous, and Escape has to feel like a key, not like a request.
  hideSection(keepFocus);
  if (undo) history.back();   // applyRoute() then finds nothing left to do
  else history.pushState({ key: null, from: leaving }, '', urlFor(null));
}

function applyRoute(from) {
  const key = routeKey();
  // A hash that names nothing is corrected in place rather than pushed away: the
  // visitor typed or was sent a dead address, and replacing it means Back still
  // leads back out the way they came instead of to a URL that never worked.
  if (!key && location.hash) history.replaceState(history.state, '', urlFor(null));
  if (key === state.active) return;   // the address and the state already agree
  if (key) showSection(key, from);
  else hideSection();
}

// Both events, because they cover different halves and applyRoute() is
// idempotent, so overlap costs nothing. popstate is the only one fired when two
// adjacent entries share a hash (which the replaceState above can produce);
// hashchange is the only one fired when someone edits the hash in the address
// bar, which is a fresh navigation rather than a traversal. Neither is fired by
// pushState, which is what keeps goToSection() from feeding itself.
addEventListener('popstate', () => applyRoute());
addEventListener('hashchange', () => applyRoute());

// Turning the watch over. Extracted from the crown's click handler because
// Escape is now a second way in: it returns from the caseback exactly as it
// returns from a panel.
function flipTo(flipped) {
  // Any open panel closes THROUGH the router, so the address stops naming a
  // section that is no longer on screen. Focus is deliberately left where it is:
  // the crown is what turned the watch over (by click, by Escape, or later by
  // the rail's CONTACT), and handing focus back to a dial part now facing away
  // from the viewer is worse than leaving it on the control that was used.
  // ...and onto the crown, which is where it should have been and is the only
  // way back to the dial. Without this the closing panel drops focus on <body>,
  // because the element that had it has just been hidden.
  if (state.active) { leaveSection(true); el.crown.focus({ preventScroll: true }); }
  state.flipped = flipped;
  state.touched = true;
  // Turning the watch over takes the dial out of view, so the sweep is
  // abandoned rather than left to finish behind the caseback. Cancelling drops
  // every offset to zero, which the next frame draws as the true reading -- and
  // the face it happens on is the one you cannot see.
  state.demo = null;
  render();
}

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
  node.addEventListener('click', () => goToSection(id, node));
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
// all arrive from one value, so hovering the word BOOKS and hovering the
// moonphase cannot say different things. Focus is included for the reason bind()
// includes it -- focus is the keyboard's pointer -- and the guards on leave and
// blur are the same guards, for the same reason.
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
  node.addEventListener('mouseenter', () => { state.hover = key; render(); });
  node.addEventListener('focus', () => { state.hover = key; render(); });
  node.addEventListener('mouseleave', () => {
    if (state.hover === key) { state.hover = null; render(); }
  });
  node.addEventListener('blur', () => {
    if (state.hover === key) { state.hover = null; render(); }
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
    // what tells leaveSection() whether the bare watch is underneath. Same
    // address either way; this one knows how it got there.
    e.preventDefault();
    // A touch device has no hover, so a tap would open the panel with the watch
    // never having answered -- and the one thing a phone visitor has to learn is
    // that the watch IS this rail. So the tap lights the part first and opens
    // 600ms later: long enough to see which complication just replied, short
    // enough that it does not read as a stall. On a pointer device the hover has
    // already said it, so there is nothing to wait for.
    if (COARSE_POINTER.matches) {
      state.hover = key;
      railCue(key);
      render();
      touchCue = setTimeout(() => goToSection(key, node), TOUCH_CUE_MS);
      return;
    }
    goToSection(key, node);
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

el.crown.addEventListener('click', () => flipTo(!state.flipped));
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
  node.addEventListener('click', () => leaveSection())
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

// Escape is "go back one", and there are two things to go back from. A panel
// and the caseback are mutually exclusive -- flipping closes any open panel,
// and the parts that open panels are on the front face -- so the order below is
// a formality rather than a precedence rule, but the panel is checked first
// because it is the nearer of the two.
//
// Escape still means CLOSE, not "walk the history". It lands on the bare watch
// even when a second section is underneath in the history -- leaveSection()
// pushes home in that case rather than backing into the previous panel, because
// a key that closes a card by opening a different one is not a close.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (state.active) { leaveSection(); return; }
  // Returning from the caseback puts focus on the crown: it is the control that
  // turned the watch over, so it is where the keyboard was, or should have been.
  if (state.flipped) { flipTo(false); el.crown.focus(); }
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

const BEAT = { mechanical: 1000 / 6, quartz: 1000 }[CONFIG.secondsMotion] || 0;
(function pump() {
  render();
  const now = Date.now();
  const wait = BEAT ? BEAT - (now % BEAT) : 100;
  setTimeout(pump, Math.max(8, Math.min(wait, 100)));
})();
