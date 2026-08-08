const CONFIG = {
  transitionStyle: 'panel', // 'panel' | 'zoom' | 'takeover'
  secondsMotion: 'mechanical', // 'mechanical' | 'quartz' | 'smooth'
  showHints: true
};

const SYNODIC_DAYS = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

const CURRENTLY = [
  { label: 'READING', title: 'Reading', value: 'Lorem Ipsum: A History', sub: 'P. 142 OF 320' },
  { label: 'WEARING', title: 'Wearing', value: 'Dolor Sit Ref. 38.5', sub: 'ON GREY SUEDE' },
  { label: 'BUILDING', title: 'Building', value: 'Consectetur Engine', sub: 'V0.4 — IN PROGRESS' },
  { label: 'RESEARCHING', title: 'Researching', value: 'Adipiscing Methods', sub: 'DRAFT DUE AUGUST' }
];

const CAPTIONS = {
  about: 'ABOUT — THE HEART OF THE MATTER',
  featured: 'FEATURED — THE OUTSIZE DATE',
  currently: 'CURRENTLY — THE SMALL SECONDS',
  resume: 'EXPERIENCE — THE POWER RESERVE',
  books: 'BOOK REVIEWS — THE MOONPHASE',
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
  // Halved from the first cut, which read as a blur: the duration is fixed at
  // four seconds, so slowing it down means turning less, not turning for
  // longer. Every total is still a whole number of turns -- that is the
  // invariant, not the ratios between them.
  //
  // The seconds hand would need 720 turns to be honest against the minute
  // hand; at 4 seconds that is a featureless grey disc, so it runs
  // compressed. It has now been halved a third time: 36 -> 18 -> 9 -> 5.
  //
  // 9 does not halve cleanly. 4.5 turns is 1620deg, which parks the hand 180deg
  // out -- pointing at 30 seconds instead of home -- and the whole reason every
  // total here is a whole number is that spin -> 1 has to land each element on
  // its true value with zero velocity. So the choice was 4 or 5, equidistant
  // from 4.5. 5 wins on two counts: it is the shallower cut, so it sits closest
  // to the minute hand's 6 and keeps the damage below as small as possible; and
  // 5 is coprime to 1, 2 and 6, so the seconds hand never phase-locks with the
  // hour hand, the moon or the minute hand during the sweep. 4 shares a factor
  // with min 6 and moon 2, and the pairs would visibly march in step.
  //
  // Say the cost plainly: at 5 against min 6 the seconds hand is now SLOWER
  // than the minute hand. On a real watch the seconds hand is the fastest thing
  // on the dial, and inverting that reads as broken rather than calm -- the
  // previous cut to 9 had already flattened a clean 3:1 to 1.5:1, and this one
  // turns it over. The fix that would actually calm the sweep without inverting
  // anything is to bring every total down together, not to pull one hand under
  // another: { hour: 1, min: 2, sec: 4, moon: 2 } halves the seconds hand as
  // asked and still leaves it turning twice as fast as the minute hand, and
  // { hour: 1, min: 2, sec: 6, moon: 2 } restores the original 3:1. Both are
  // whole turns, so either is a one-line swap.
  //
  // The hour hand is the one that cannot halve: 12 hours is its whole turn and
  // half of that parks it at the far side of the dial, six hours out, instead
  // of home. One turn is its floor, so it holds at 1 while the minute hand
  // halves -- the demo's gearing goes 6:1 rather than the true 12:1, the same
  // licence the seconds hand has always taken. The moon splits the difference
  // the other way: 1.5 turns is not whole, and of the two neighbours 2 is the
  // closer in rate (x1.33 against x1.5) and keeps the plate coasting through
  // the tail instead of stalling in it.
  turns: { hour: 1, min: 6, sec: 5, moon: 2 },
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

const ZOOM_ORIGINS = {
  about: '31.8% 50%',
  featured: '63.75% 26.05%',
  currently: '64.5% 75.115%',
  resume: '65.5% 47.5%',
  books: '64.5% 67.535%'
};

const $ = (id) => document.getElementById(id);

const el = {
  stage: document.querySelector('.watch-stage'),
  pose: $('watchPose'),
  tilt: $('watchTilt'),
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
  hintBar: $('hintBar'),
  overlay: $('overlay'),
  curTitle: $('curTitle'),
  curValue: $('curValue'),
  curSub: $('curSub'),
  curDots: document.querySelectorAll('.cur-dot')
};

const panels = {
  about: $('panel-about'),
  featured: $('panel-featured'),
  currently: $('panel-currently'),
  resume: $('panel-resume'),
  books: $('panel-books')
};

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
  // Where each hand is pointing, in degrees, as of the last render(). The tilt
  // loop needs these to rotate the cast-shadow correction into each hand's own
  // frame -- see handShadows(). render() is the only writer.
  ang: { hour: 0, min: 0, sec: 0, res: RESERVE_AB }
};

function moonAge(now) {
  let age = ((now - KNOWN_NEW_MOON) / 86400000) % SYNODIC_DAYS;
  if (age < 0) age += SYNODIC_DAYS;
  return age;
}

function watchPose() {
  if (!state.active) return { transform: 'none', filter: 'none', origin: '50% 50%' };
  if (CONFIG.transitionStyle === 'zoom') {
    return { transform: 'scale(1.55)', filter: 'blur(6px) brightness(.5)', origin: ZOOM_ORIGINS[state.active] || '50% 50%' };
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
  state.ang.hour = hr * 30 + wind(DEMO.turns.hour);
  state.ang.min = min * 6 + wind(DEMO.turns.min);
  state.ang.sec = sec * 6 + wind(DEMO.turns.sec);
  el.hour.style.transform = `rotate(${state.ang.hour.toFixed(2)}deg) translateZ(var(--z-hand-hour))`;
  el.min.style.transform = `rotate(${state.ang.min.toFixed(2)}deg) translateZ(var(--z-hand-min))`;
  el.sec.style.transform = `rotate(${state.ang.sec.toFixed(2)}deg) translateZ(var(--z-hand-sec))`;

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
  state.ang.res = reserveAngle;
  el.reserveHand.style.transform = `rotate(${reserveAngle.toFixed(1)}deg) translateZ(var(--z-hand-res))`;
  // The bar reads the printed scale, not the hand's travel, so it stays an
  // honest percentage while the hand is off the end of the dial: past AUF it
  // reads 100 and past AB it reads 0, rather than going over or under. Off the
  // demo this is the identity -- reserveDeg() inverted is state.reserve.
  const reservePct = (RESERVE_AB - reserveAngle) / RESERVE_SCALE;
  el.reserveBar.style.width = `${Math.round(Math.min(1, Math.max(0, reservePct)) * 100)}%`;

  const curIdx = Math.floor(now / 4000) % CURRENTLY.length;
  const cur = CURRENTLY[curIdx];
  el.curTitle.textContent = cur.title;
  el.curValue.textContent = cur.value;
  el.curSub.textContent = cur.sub;
  el.curDots.forEach((dot, i) => dot.classList.toggle('is-on', i === curIdx));

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
        : `CURRENTLY ${cur.label} — ${cur.value.toUpperCase()}`;

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
  for (const [id, node] of Object.entries(panels)) node.hidden = state.active !== id;

  // The interaction index recedes the moment the watch has been understood:
  // any click sets state.touched, and the scribed marks go with it.
  el.hintIndex.hidden = !(CONFIG.showHints && !state.touched && !state.active && !state.flipped);
  el.hintBar.hidden = !(CONFIG.showHints && !state.active);
}

function open(id) {
  state.active = id;
  state.touched = true;
  state.hover = null;
  // With a panel open the watch is context rather than the subject, and it has
  // just been posed left at 0.72 scale -- a tilt on top of that reads as drift.
  tiltNeutral();
  render();
}

// ---- pointer tilt ----------------------------------------------------------
// The watch is already a real 3D object -- a 48-segment gold cylinder for a
// case band, a bezel with ring thickness, faces half a case-depth apart inside
// perspective: 2400px. What it never had was a reason to turn, so nobody saw
// any of it: the only thing that ever rotated it was the 1.15s flip.
//
// This turns it toward the pointer, and everything about the geometry -- the
// clamp, the damping, the settle threshold -- is derived rather than dialled
// in. The clamp lives in CSS (--tilt-max) because it is the one number here
// whose limit is aesthetic: see THE DEPTH BUDGET in src/styles.css.
//
// It writes to #watchTilt and nothing else does. render() owns .watch-pose and
// .watch-flip and keeps its 10Hz interval; a tilt at 10Hz would judder, and a
// tilt sharing either of those layers would inherit a ~1s transition.
const D2R = Math.PI / 180;
const readVar = (name) => parseFloat(getComputedStyle(el.stage).getPropertyValue(name)) || 0;
const TILT_MAX = readVar('--tilt-max') || 8;

// Damping. The tilt is a hover-class response -- it answers the same cursor the
// hover light answers -- so it settles on the same clock: the .28s of the
// `transition: filter .28s` in THE LIVE PARTS' HOVER. An exponential ease
// reaching 95% in 0.28s has tau = 0.28 / 3 = 0.093s. Computing the per-frame
// coefficient from the real dt keeps that true at 60Hz, 120Hz or a dropped
// frame, which a fixed `+= (target - current) * 0.06` does not.
const TILT_TAU = 0.093;

// Only a real pointer gets this. Touch has none -- a drag-to-turn gesture would
// collide with scrolling and deviceorientation costs an iOS permission prompt
// for a decorative effect, so touch gets a static watch and the flip, which is
// the interaction it already had. Reduced motion gets nothing, live: the query
// is re-read on every event rather than latched at load.
const TILT_POINTER = matchMedia('(hover: hover) and (pointer: fine)');
const tiltLive = () => TILT_POINTER.matches && !REDUCED_MOTION.matches;

const tilt = {
  ax: 0, ay: 0,      // current, degrees
  tx: 0, ty: 0,      // target, degrees
  raf: 0, last: 0,
  cx: 0, cy: 0, half: 1,
  // Settled means "the next step would move the case rim less than half a
  // pixel", which is the point at which continuing to run a rAF loop is
  // spending frames on nothing. The rim is at the stage's own half-width, so
  // eps = atan(0.5px / R) and it re-derives itself whenever the stage resizes.
  eps: .09
};

function tiltMeasure() {
  const r = el.stage.getBoundingClientRect();
  tilt.cx = r.left + r.width / 2;
  tilt.cy = r.top + r.height / 2;
  // Normalised against half the viewport's SHORTER side -- the same unit the
  // watch is sized in (86vmin), so the pointer at the case rim is at 0.86 of
  // full tilt and the last 14% is out in the field around it.
  tilt.half = Math.min(innerWidth, innerHeight) / 2 || 1;
  tilt.eps = Math.atan2(.5, Math.max(1, r.width / 2)) / D2R;
}
tiltMeasure();
addEventListener('resize', tiltMeasure);

// Each hand's drop-shadow, held still on the dial while the hand parallaxes
// over it. A shadow belongs to the light: the 315deg key does not move when the
// viewer does, so the shadow must not either -- but the filter that draws it
// rides on the sprite, which moves by h*sin(tilt). Subtracting exactly that
// back out is what opens and closes the gap between hand and shadow as the
// watch turns, and it is the cue that reads as "these are above the dial".
//
// The correction is a screen-space vector, and the filter is applied inside the
// pivot's own rotate(phi), so it is rotated into the hand's frame first:
// v_local = R(-phi) * (-dx, -dy), with CSS's y-down, clockwise-positive basis.
// The heights come from the same CSS variables the transforms use, so there is
// one definition of how high each hand sits.
const HANDS = [
  [el.hour, 'hour', readVar('--z-hand-hour')],
  [el.min, 'min', readVar('--z-hand-min')],
  [el.sec, 'sec', readVar('--z-hand-sec')],
  [el.reserveHand, 'res', readVar('--z-hand-res')]
];

function handShadows(ay, ax) {
  const ux = Math.sin(ay * D2R);    // screen shift per vmin of height
  const uy = -Math.sin(ax * D2R);
  for (const [node, key, h] of HANDS) {
    if (!ay && !ax) {
      node.style.removeProperty('--shx');
      node.style.removeProperty('--shy');
      continue;
    }
    const p = state.ang[key] * D2R, c = Math.cos(p), s = Math.sin(p);
    const dx = h * ux, dy = h * uy;
    node.style.setProperty('--shx', `${(-dx * c - dy * s).toFixed(3)}vmin`);
    node.style.setProperty('--shy', `${(dx * s - dy * c).toFixed(3)}vmin`);
  }
}

function tiltApply() {
  el.tilt.style.transform = (tilt.ay || tilt.ax)
    ? `rotateY(${tilt.ay.toFixed(3)}deg) rotateX(${tilt.ax.toFixed(3)}deg)`
    : '';
  handShadows(tilt.ay, tilt.ax);
}

// The loop exists only while there is distance left to cover. It is started by
// a change of target and it stops itself on arrival, so an idle page runs no
// animation frames at all -- tilt.raf is 0 and stays 0 until the pointer moves.
function tiltStep(now) {
  const dt = tilt.last ? Math.min(.05, (now - tilt.last) / 1000) : 1 / 60;
  tilt.last = now;
  const k = 1 - Math.exp(-dt / TILT_TAU);
  tilt.ay += (tilt.ty - tilt.ay) * k;
  tilt.ax += (tilt.tx - tilt.ax) * k;
  const done = Math.abs(tilt.ty - tilt.ay) < tilt.eps && Math.abs(tilt.tx - tilt.ax) < tilt.eps;
  if (done) { tilt.ay = tilt.ty; tilt.ax = tilt.tx; }
  tiltApply();
  if (done) { tilt.raf = 0; tilt.last = 0; }
  else tilt.raf = requestAnimationFrame(tiltStep);
}

function tiltTo(ty, tx) {
  if (ty === tilt.ty && tx === tilt.tx) return;
  tilt.ty = ty;
  tilt.tx = tx;
  if (!tilt.raf) { tilt.last = 0; tilt.raf = requestAnimationFrame(tiltStep); }
}
function tiltNeutral() { tiltTo(0, 0); }

addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' || !tiltLive() || state.active) return tiltNeutral();
  const nx = Math.max(-1, Math.min(1, (e.clientX - tilt.cx) / tilt.half));
  const ny = Math.max(-1, Math.min(1, (e.clientY - tilt.cy) / tilt.half));
  // The watch turns to face the pointer: cursor right, the right edge swings
  // back; cursor low, the bottom swings back. The band that comes into view is
  // the far one, which is the whole point of doing this.
  tiltTo(nx * TILT_MAX, -ny * TILT_MAX);
}, { passive: true });

// Neutral the moment the pointer is no longer over the document, or the window
// stops being the one in front. relatedTarget === null is the pointer crossing
// the window boundary rather than moving between two elements inside it.
addEventListener('pointerout', (e) => { if (!e.relatedTarget) tiltNeutral(); });
addEventListener('blur', tiltNeutral);
REDUCED_MOTION.addEventListener('change', () => { if (REDUCED_MOTION.matches) tiltNeutral(); });

function bind(node, id) {
  node.addEventListener('click', () => open(id));
  node.addEventListener('mouseenter', () => { state.hover = id; render(); });
  node.addEventListener('mouseleave', () => { state.hover = null; render(); });
}

bind($('aboutHit'), 'about');
bind($('dateWindow'), 'featured');
bind($('secondsDial'), 'currently');
bind($('reserve'), 'resume');
bind($('moon'), 'books');

$('crown').addEventListener('click', () => {
  state.flipped = !state.flipped;
  state.touched = true;
  state.active = null;
  // Turning the watch over takes the dial out of view, so the sweep is
  // abandoned rather than left to finish behind the caseback. Cancelling drops
  // every offset to zero, which the next frame draws as the true reading -- and
  // the face it happens on is the one you cannot see.
  state.demo = null;
  render();
});
$('crown').addEventListener('mouseenter', () => { state.hover = 'crown'; render(); });
$('crown').addEventListener('mouseleave', () => { state.hover = null; render(); });

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
$('corrector').addEventListener('mouseleave', () => { state.hover = null; render(); });

document.querySelectorAll('[data-close]').forEach((node) =>
  node.addEventListener('click', () => { state.active = null; render(); })
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

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    state.active = null;
    render();
  }
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

render();
setInterval(render, 100);
