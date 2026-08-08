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

// Opening and closing are the only two places focus moves on its own, and they
// are a pair: open() remembers what it was opened from and puts focus on the
// panel, close() puts it back. Nothing is trapped -- Tab still walks out of the
// card and on through the page -- but the keyboard never has to start again
// from the top of the document, which is what "lost focus" actually feels like.
function open(id, from) {
  state.active = id;
  state.touched = true;
  state.hover = null;
  state.returnTo = from || null;
  render();
  const panel = panels.get(id);
  // After render(), because the panel is [hidden] until then and a hidden
  // element cannot take focus. tabindex="-1" on .card is what makes this legal.
  if (panel) panel.focus();
}

// One door into a section, for all of the ways in. open() is the mechanism --
// it moves focus and remembers where from -- and this is the intent: "show me
// this section, whatever the watch is currently doing". The watch's own hit
// targets, the rail and (Phase 3) an address in the bar all come through here,
// so a rule that has to hold for every one of them is written once.
//
// The one such rule today is the flip. The rail stays up while the watch is
// turned over, so a section can be asked for from the caseback -- and every
// section lives on the front of the watch, so the panel would otherwise open
// over the back of a watch you had just navigated away from.
function goToSection(key, from) {
  if (!SECTION.has(key)) return;
  railCue(null);   // whether this call is the cue's own or something that beat it
  if (state.flipped) state.flipped = false;
  open(key, from || null);
}

function close() {
  if (!state.active) return;
  state.active = null;
  const back = state.returnTo;
  state.returnTo = null;
  render();
  if (back && back.isConnected) back.focus();
}

// Turning the watch over. Extracted from the crown's click handler because
// Escape is now a second way in: it returns from the caseback exactly as it
// returns from a panel.
function flipTo(flipped) {
  state.flipped = flipped;
  state.touched = true;
  state.active = null;
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
    // Phase 3 owns the address bar. Until it lands the href is there for what a
    // real link gives you off the primary click; the navigation itself is this.
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

document.querySelectorAll('[data-close]').forEach((node) =>
  node.addEventListener('click', close)
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
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (state.active) { close(); return; }
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
const BEAT = { mechanical: 1000 / 6, quartz: 1000 }[CONFIG.secondsMotion] || 0;
(function pump() {
  render();
  const now = Date.now();
  const wait = BEAT ? BEAT - (now % BEAT) : 100;
  setTimeout(pump, Math.max(8, Math.min(wait, 100)));
})();
