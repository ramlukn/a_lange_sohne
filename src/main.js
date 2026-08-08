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
// Everything is expressed as an offset ADDED to the true value, driven by one
// eased progress term, so the demo is a lens over render() rather than a second
// writer fighting it (render() rewrites all of these unconditionally every
// frame; anything set from a timer would be gone by the next one).
//
// The easing is `spin(t) = 1 - (1 - t)^2`: its derivative falls linearly from
// 2 to 0, which is exactly a flywheel coasting to a stop under constant
// friction. Because the totals below are all WHOLE turns and the date total is
// a whole number of months, spin -> 1 lands every element back on its true
// value with zero velocity, so the demo eases home instead of snapping.
const DEMO = {
  ms: 4000,
  // Hour : minute is the true 12:1 -- 12 minute turns IS one hour turn, i.e.
  // the watch is wound twelve hours forward. The seconds hand would need 720
  // turns to match; at 4 seconds that is a featureless grey disc, so it is
  // compressed to 3x the minute hand, which still reads as the fastest thing
  // on the dial and resolves into a readable sweep as it slows.
  turns: { hour: 1, min: 12, sec: 36, moon: 3 },
  dateTurns: 2,        // whole trips through 01..31, so it wraps home
  reserveCycles: 2.5,  // AUF <-> AB round trips, damped to nothing
  reserveSwing: 0.85,  // enough to clamp against both end stops on the way
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
  hintBar: $('hintBar'),
  overlay: $('overlay'),
  curTitle: $('curTitle'),
  curValue: $('curValue'),
  curSub: $('curSub'),
  curDots: document.querySelectorAll('.cur-dot'),
  reqLayer: $('reqLayer'),
  reqForm: $('reqForm'),
  reqDone: $('reqDone'),
  reqWatch: $('reqWatch'),
  reqBook: $('reqBook')
};

const panels = {
  about: $('panel-about'),
  featured: $('panel-featured'),
  currently: $('panel-currently'),
  resume: $('panel-resume'),
  books: $('panel-books')
};

const state = {
  active: null,
  hover: null,
  flipped: false,
  reserve: 0.72,
  touched: false,
  reqOpen: false,
  reqDone: false,
  reqType: 'watch',
  demo: null   // { t0, reduced } while the pusher's sweep is running
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

  const wind = (turns) => turns * 360 * spin;   // 0 turns of offset when idle
  el.hour.style.transform = `rotate(${(hr * 30 + wind(DEMO.turns.hour)).toFixed(2)}deg)`;
  el.min.style.transform = `rotate(${(min * 6 + wind(DEMO.turns.min)).toFixed(2)}deg)`;
  el.sec.style.transform = `rotate(${(sec * 6 + wind(DEMO.turns.sec)).toFixed(2)}deg)`;

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

  // The reserve swings instead of spinning: a sine damped by (1 - t)^2, which
  // is zero in both value and slope at the end, so it also coasts onto the true
  // reading. The swing overshoots the 0..1 scale on purpose -- the clamp is the
  // hand sitting against AUF and AB for a beat, the way a real one would.
  let reserve = state.reserve;
  if (demoing) {
    const damp = (1 - demoT) * (1 - demoT);
    const swing = Math.sin(2 * Math.PI * DEMO.reserveCycles * demoT) * damp * DEMO.reserveSwing;
    reserve = Math.min(1, Math.max(0, state.reserve + swing));
  }
  // .reserve-hand carries a .6s transition for the scroll-driven wind, which
  // would smear a per-frame sweep into a lagging blur. Suppressed for the demo
  // and restored on the settling frame, where the value is already true.
  el.reserveHand.style.transition = demoing ? 'none' : '';
  // 0deg points at 12 for every hand. The scale sprite's end stops measure out
  // at 40.7deg (AUF, full) and 138.9deg (AB, empty) about the arc's own centre
  // -- see tools/build-dial-art.py -- so the pointer covers all 98.2deg of it.
  el.reserveHand.style.transform = `rotate(${(138.9 - reserve * 98.2).toFixed(1)}deg)`;
  el.reserveBar.style.width = `${Math.round(reserve * 100)}%`;

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
    : (state.active || state.reqOpen)
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
  el.hintBar.hidden = !(CONFIG.showHints && !state.active && !state.reqOpen);

  el.reqLayer.hidden = !state.reqOpen;
  el.reqForm.hidden = state.reqDone;
  el.reqDone.hidden = !state.reqDone;
  el.reqWatch.classList.toggle('is-on', state.reqType === 'watch');
  el.reqBook.classList.toggle('is-on', state.reqType === 'book');
}

function open(id) {
  state.active = id;
  state.touched = true;
  state.hover = null;
  render();
}

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
document.querySelectorAll('[data-close-req]').forEach((node) =>
  node.addEventListener('click', () => { state.reqOpen = false; render(); })
);

// NOTE: the review-request layer (#reqLayer / #reqForm / #reqDone and the
// handlers below) is currently UNREACHABLE. The pusher used to open it and now
// runs the demonstration sweep instead, and nothing else sets state.reqOpen.
// Left intact and working, pending a decision about where it should live.
el.reqWatch.addEventListener('click', () => { state.reqType = 'watch'; render(); });
el.reqBook.addEventListener('click', () => { state.reqType = 'book'; render(); });
el.reqForm.addEventListener('submit', (e) => {
  e.preventDefault();
  state.reqDone = true;
  render();
});

$('resumeScroll').addEventListener('scroll', (e) => {
  const node = e.currentTarget;
  const max = node.scrollHeight - node.clientHeight;
  if (max > 0) {
    state.reserve = Math.min(1, 0.15 + 0.85 * (node.scrollTop / max));
    render();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    state.active = null;
    state.reqOpen = false;
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
