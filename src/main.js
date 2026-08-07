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
  pusher: 'REQUEST A REVIEW — A HIDDEN PUSHER'
};

const ZOOM_ORIGINS = {
  about: '31.8% 47%',
  featured: '63.75% 26.05%',
  currently: '60.4% 70.8%',
  resume: '65.5% 47.5%',
  books: '60.4% 63.9%'
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
  hintDots: $('hintDots'),
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
  reqType: 'watch'
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

  let sec = d.getSeconds() + d.getMilliseconds() / 1000;
  if (CONFIG.secondsMotion === 'mechanical') sec = Math.floor(sec * 6) / 6;
  else if (CONFIG.secondsMotion === 'quartz') sec = Math.floor(sec);
  const min = d.getMinutes() + sec / 60;
  const hr = (d.getHours() % 12) + min / 60;

  el.hour.style.transform = `rotate(${(hr * 30).toFixed(2)}deg)`;
  el.min.style.transform = `rotate(${(min * 6).toFixed(2)}deg)`;
  el.sec.style.transform = `rotate(${(sec * 6).toFixed(2)}deg)`;

  const date = d.getDate();
  el.dateTens.textContent = Math.floor(date / 10);
  el.dateOnes.textContent = date % 10;

  // The starfield is engraved on the lunar wheel itself, so sky and moon share one rotation.
  const age = moonAge(now);
  const moonDeg = ((age / SYNODIC_DAYS) * 180 - 90).toFixed(2);
  el.moonOrbit.setAttribute('transform', `rotate(${moonDeg} 50 50)`);

  el.reserveHand.style.transform = `rotate(${(18 - state.reserve * 38).toFixed(1)}deg)`;
  el.reserveBar.style.width = `${Math.round(state.reserve * 100)}%`;

  const curIdx = Math.floor(now / 4000) % CURRENTLY.length;
  const cur = CURRENTLY[curIdx];
  el.curTitle.textContent = cur.title;
  el.curValue.textContent = cur.value;
  el.curSub.textContent = cur.sub;
  el.curDots.forEach((dot, i) => dot.classList.toggle('is-on', i === curIdx));

  el.caption.textContent = state.hover
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

  el.hintDots.hidden = !(CONFIG.showHints && !state.touched && !state.active && !state.flipped);
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
  render();
});
$('crown').addEventListener('mouseenter', () => { state.hover = 'crown'; render(); });
$('crown').addEventListener('mouseleave', () => { state.hover = null; render(); });

$('corrector').addEventListener('click', () => {
  state.reqOpen = true;
  state.touched = true;
  state.reqDone = false;
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
