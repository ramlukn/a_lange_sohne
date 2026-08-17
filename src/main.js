const CONFIG = {
  transitionStyle: 'panel',
  secondsMotion: 'mechanical',
  showHints: true
};

const SYNODIC_DAYS = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

const CURRENTLY = [
  { label: 'RESEARCHING', value: 'Passive Detection' },
  { label: 'READING', value: 'Haruki Murakami' },
  { label: 'WEARING', value: 'Tudor Black Bay 58 “Navy Blue”' }
];

const SECTIONS = [
  { key: 'about',      label: 'About',      part: 'MAIN DIAL',     hit: 'aboutHit',    panel: 'panel-about',      origin: '31.8% 50%' },
  { key: 'resume',     label: 'Resume',     part: 'POWER RESERVE', hit: 'reserve',     panel: 'panel-resume',     origin: '65.5% 47.5%' },
  { key: 'projects',   label: 'Projects',   part: 'OUTSIZE DATE',  hit: 'dateWindow',  panel: 'panel-projects',   origin: '63.75% 26.05%' },
  { key: 'research',   label: 'Research',   part: 'SMALL SECONDS', hit: 'secondsDial', panel: 'panel-research',   origin: '64.5% 75.115%' },
  { key: 'field-notes', label: 'Field Notes', part: 'MOONPHASE',  hit: 'moon',        panel: 'panel-field-notes', origin: '64.5% 67.535%' }
];
const SECTION = new Map(SECTIONS.map((s) => [s.key, s]));

const CONTACT = { key: 'contact', label: 'Contact', hover: 'crown' };

const EMAIL = 'nikhilr.ramlukan@gmail.com';

const LINKS = {
  linkedin: 'LINKEDIN.COM/IN/NIKHIL-RAMLUKAN',
  github: 'GITHUB.COM/RAMLUKN',
  email: EMAIL.toUpperCase()
};

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

const DEMO = {
  ms: 4000,

  turns: { hour: 1, min: 2, sec: 9, moon: 2 },
  dateTurns: 1,

  reserveSweepDeg: 160,

  reserveMs: 1400,
  reserveCycles: 1,
  reserveHold: 0.85,
  reducedMs: 1200
};
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

const SALUTE_PART = {
  about: 'mainDial',
  resume: 'reserve',
  projects: 'date',
  research: 'sec',
  'field-notes': 'moon'
};

const SALUTE = new Map();

let arrived = false;

let reserveSnapping = false;

function startSalute(key) {
  if (REDUCED_MOTION.matches) return;
  const part = SALUTE_PART[key];
  if (!part || SALUTE.has(part)) return;

  SALUTE.set(part, { t0: Date.now(), base: state.reserve });
  if (!demoPumping) { demoPumping = true; requestAnimationFrame(demoPump); }
}

const NARROW = matchMedia('(max-width: 1199px)');

const GAP_VH = 1.6;

let narrowPose = null;
function measureNarrowPose() {
  if (!NARROW.matches) { narrowPose = null; return; }

  const sheet = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-vh')) || 0;

  const above = parseFloat(getComputedStyle(el.overlay).paddingTop) || 0;

  const below = parseFloat(getComputedStyle(el.overlay).paddingBottom) || 0;
  const box = el.pose.parentElement.getBoundingClientRect();
  if (!box.height) return;
  const gap = (innerHeight * GAP_VH) / 100;

  const band = innerHeight - above - below - (innerHeight * sheet) / 100 - 2 * gap;
  const scale = Math.max(.24, Math.min(.72, band / box.height));

  const dy = (above + gap + (box.height * scale) / 2) - (box.top + box.height / 2);
  narrowPose = `translateY(${dy.toFixed(1)}px) scale(${scale.toFixed(3)})`;
}

NARROW.addEventListener('change', () => { measureNarrowPose(); render(); });
addEventListener('resize', () => { measureNarrowPose(); render(); });

const $ = (id) => document.getElementById(id);

const el = {
  stage: document.querySelector('.watch-stage'),
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

let leavingPanel = null;
let leavingTimer = 0;

function startPanelLeave(key) {
  leavingPanel = key;
  clearTimeout(leavingTimer);
  leavingTimer = setTimeout(() => { leavingPanel = null; render(); }, 420);
}

function cancelPanelLeave() {
  if (!leavingPanel) return;
  leavingPanel = null;
  clearTimeout(leavingTimer);
}

const railLinks = new Map();

const hoverKeyOf = (key) => (key === CONTACT.key ? CONTACT.hover : key);
el.rail.append(...[...SECTIONS, CONTACT].map((s) => {
  const a = document.createElement('a');
  a.className = 'rail-link';

  a.href = `#/${s.key}`;
  a.dataset.key = s.key;
  a.textContent = s.label;
  railLinks.set(s.key, a);
  return a;
}));

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

  a.dataset.link = key;
  a.href = LINK_HREF[key];
  a.textContent = label;
  if (key === 'email') {

    a.setAttribute('aria-label', `Copy email address ${EMAIL}`);
  } else {
    a.target = '_blank';
    a.rel = 'noopener';

    a.setAttribute('aria-label',
      `${label}, at ${LINK_HREF[key].replace(/^https?:\/\//, '')} (opens in a new tab)`);
  }
  railContacts.append(a);
  return a;
});
el.rail.append(railContacts);

const railMarker = document.createElement('span');
railMarker.className = 'rail-marker';
railMarker.setAttribute('aria-hidden', 'true');
el.rail.append(railMarker);

let markerAt = null;
function placeRailMarker(force) {
  const at = placeNow();
  if (!force && markerAt === at) return;
  const node = at ? railLinks.get(at) : null;

  if (node && !node.offsetHeight) return;
  markerAt = at;
  if (!node) return;
  el.rail.style.setProperty('--mx', `${(node.offsetLeft + node.offsetWidth / 2).toFixed(1)}px`);
  el.rail.style.setProperty('--my', `${(node.offsetTop + node.offsetHeight / 2).toFixed(1)}px`);
}

new ResizeObserver(() => placeRailMarker(true)).observe(el.rail);

const RESERVE_REST = 0.1126;

const RESERVE_AUF = 40.7;
const RESERVE_AB = 138.9;
const RESERVE_SCALE = 98.2;
const reserveDeg = (r) => RESERVE_AB - r * RESERVE_SCALE;

const RESERVE_OVER = (DEMO.reserveSweepDeg - RESERVE_SCALE) / 2;
const RESERVE_DEG_HI = RESERVE_AB + RESERVE_OVER;
const RESERVE_DEG_LO = RESERVE_AUF - RESERVE_OVER;

const state = {
  active: null,
  hover: null,
  flipped: false,
  reserve: RESERVE_REST,
  touched: false,
  demo: null,

  notice: null,

  returnTo: null
};

const placeNow = () => (state.flipped ? CONTACT.key : state.active);

const HACK_MS = 450;
const hack = { on: false, timer: 0, sec: 0, swallow: false };

function beatSec(d) {
  let s = d.getSeconds() + d.getMilliseconds() / 1000;
  if (CONFIG.secondsMotion === 'mechanical') s = Math.floor(s * 6) / 6;
  else if (CONFIG.secondsMotion === 'quartz') s = Math.floor(s);
  return s;
}

function hackStart() {
  hack.timer = 0;
  hack.on = true;
  hack.sec = beatSec(new Date());
  for (const a of rig.anims) a.pause();
  render();
}

function hackEnd(swallow) {
  clearTimeout(hack.timer);
  hack.timer = 0;
  if (!hack.on) return;
  hack.on = false;
  hack.swallow = swallow;
  for (const a of rig.anims) a.play();
  render();
}

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

  let demoT = -1;
  let spin = 0;
  if (state.demo) {
    const t = (now - state.demo.t0) / (state.demo.reduced ? DEMO.reducedMs : DEMO.ms);
    if (t >= 1) state.demo = null;
    else if (!state.demo.reduced) { demoT = t; spin = 1 - (1 - t) * (1 - t); }
  }
  const demoing = demoT >= 0;

  const lifeOf = (part) => (part === 'reserve' ? DEMO.reserveMs : DEMO.ms);
  for (const [part, s] of SALUTE) if (now - s.t0 >= lifeOf(part)) SALUTE.delete(part);

  const saluteT = (part) => {
    if (demoing) return -1;
    const s = SALUTE.get(part);
    return s === undefined ? -1 : (now - s.t0) / lifeOf(part);
  };

  const saluteSpin = (part) => {
    const t = saluteT(part);
    return t < 0 ? 0 : 1 - (1 - t) * (1 - t);
  };

  const sec = hack.on ? hack.sec : beatSec(d);
  const min = d.getMinutes() + beatSec(d) / 60;
  const hr = (d.getHours() % 12) + min / 60;

  const wind = (turns, part) => turns * 360 * (spin + saluteSpin(part));
  const angHour = hr * 30 + wind(DEMO.turns.hour, 'mainDial');
  const angMin = min * 6 + wind(DEMO.turns.min, 'mainDial');
  const angSec = sec * 6 + wind(DEMO.turns.sec, 'sec');
  el.hour.style.transform = `rotate(${angHour.toFixed(2)}deg) translateZ(var(--z-hand-hour))`;
  el.min.style.transform = `rotate(${angMin.toFixed(2)}deg) translateZ(var(--z-hand-min))`;
  el.sec.style.transform = `rotate(${angSec.toFixed(2)}deg) translateZ(var(--z-hand-sec))`;

  let date = d.getDate();
  const dateSpin = spin + saluteSpin('date');
  if (dateSpin > 0) date = ((date - 1 + Math.round(dateSpin * DEMO.dateTurns * 31)) % 31) + 1;
  el.dateTens.textContent = Math.floor(date / 10);
  el.dateOnes.textContent = date % 10;

  const age = moonAge(now);
  const moonDeg = ((age / SYNODIC_DAYS) * 180 - 90 + wind(DEMO.turns.moon, 'moon')).toFixed(2);
  el.moonOrbit.setAttribute('transform', `rotate(${moonDeg} 50 50)`);

  const reserveTrue = Math.min(1, Math.max(0, state.reserve));
  let reserveAngle = reserveDeg(reserveTrue);

  const resRun = demoing
    ? { t: demoT * DEMO.ms / DEMO.reserveMs, base: state.demo.reserveFrom }
    : (() => { const s = SALUTE.get('reserve'); const t = saluteT('reserve'); return t < 0 ? null : { t, base: s.base }; })();

  const resAnim = resRun && resRun.t <= 1 ? resRun : null;
  if (resAnim) {
    const u = Math.min(1, Math.max(0, (resAnim.t - DEMO.reserveHold) / (1 - DEMO.reserveHold)));
    const reach = 1 - u * u * (3 - 2 * u);
    const span = RESERVE_DEG_HI - RESERVE_DEG_LO;
    const base = Math.min(1, Math.max(0, resAnim.base));
    const v0 = (RESERVE_DEG_HI - reserveDeg(base)) / span;
    const phase = Math.acos(1 - 2 * v0);
    const sweep = 0.5 - 0.5 * Math.cos(2 * Math.PI * DEMO.reserveCycles * resAnim.t + phase);
    reserveAngle = RESERVE_DEG_HI - (v0 + reach * (sweep - v0)) * span;
  }

  el.reserveHand.style.transition = (resAnim || reserveSnapping) ? 'none' : '';
  reserveSnapping = !!resAnim;
  el.reserveHand.style.transform = `rotate(${reserveAngle.toFixed(1)}deg) translateZ(var(--z-hand-res))`;

  el.reserveBar.style.width = `${Math.round(reserveTrue * 100)}%`;

  const cur = CURRENTLY[Math.floor(now / 4000) % CURRENTLY.length];

  if (state.notice && state.notice.until <= now) state.notice = null;

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

        : `CURRENTLY ${cur.label} — ${cur.value.toUpperCase()}`;

  const pose = watchPose();
  el.pose.style.transform = pose.transform;
  el.stage.style.filter = pose.filter;
  el.pose.style.transformOrigin = pose.origin;

  el.flip.style.transform = `rotateY(${state.flipped ? 180 : 0}deg)`;
  el.front.style.opacity = state.flipped ? 0 : 1;
  el.back.style.opacity = state.flipped ? 1 : 0;
  el.back.classList.toggle('is-flipped', state.flipped);

  el.back.inert = !state.flipped;
  el.front.inert = state.flipped;
  if (state.flipped) rigPlay(); else rigStop();

  el.overlay.hidden = !state.active && !leavingPanel;
  el.overlay.dataset.justify = CONFIG.transitionStyle === 'panel' ? 'flex-end' : 'center';

  shotsRun(state.active === 'projects');
  for (const [key, node] of panels) {
    const going = leavingPanel === key && state.active !== key;
    node.hidden = state.active !== key && !going;
    node.classList.toggle('is-leaving', going);
  }

  el.hintIndex.hidden = !(CONFIG.showHints && !state.touched && !state.active && !state.flipped);

  el.rail.hidden = !CONFIG.showHints;

  const at = placeNow();
  for (const [key, node] of railLinks) {
    const want = at === key ? 'active' : state.hover === hoverKeyOf(key) ? 'hover' : '';
    if (node.dataset.state === want) continue;
    node.dataset.state = want;
    if (want === 'active') node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  }

  const wantContacts = at === CONTACT.key;
  if (railContacts.hidden !== !wantContacts) {

    const rescue = !wantContacts && railContacts.contains(document.activeElement);
    railContacts.hidden = !wantContacts;
    if (rescue) railLinks.get(CONTACT.key).focus({ preventScroll: true });
  }
  placeRailMarker();

  const onFitting = state.hover === 'crown' || state.hover === 'pusher';
  const lit = (state.active || (state.flipped && !onFitting)) ? '' : (state.hover || '');
  if (el.flip.dataset.hover !== lit) el.flip.dataset.hover = lit;
}

function showSection(key, from) {
  cancelPanelLeave();
  state.active = key;
  state.hover = null;

  if (state.flipped) state.flipped = false;

  state.returnTo = from || $(SECTION.get(key).hit);

  if (arrived) startSalute(key);
  render();
  const panel = panels.get(key);

  if (panel) panel.focus({ preventScroll: true });
}

function hideSection(keepFocus) {
  if (!state.active) return;

  startSalute(state.active);
  startPanelLeave(state.active);
  state.active = null;
  const back = state.returnTo;
  state.returnTo = null;
  render();
  if (!keepFocus && back && back.isConnected) back.focus();
}

function showContact() {

  hideSection(true);
  state.hover = null;
  state.flipped = true;

  state.demo = null;

  SALUTE.clear();
  render();
  el.crown.focus({ preventScroll: true });
}

function hideContact(keepFocus) {
  if (!state.flipped) return;
  state.flipped = false;
  render();
  if (!keepFocus) el.crown.focus({ preventScroll: true });
}

const HOME_URL = location.pathname + location.search;
const urlFor = (key) => (key ? `#/${key}` : HOME_URL);

const routes = new Set([...SECTION.keys(), CONTACT.key]);
function routeKey() {
  const m = /^#\/([\w-]+)$/.exec(location.hash);
  return m && routes.has(m[1]) ? m[1] : null;
}

function goTo(key, from) {
  if (!routes.has(key) || placeNow() === key) return;
  railCue(null);

  state.touched = true;
  history.pushState({ key, from: placeNow() }, '', urlFor(key));
  applyRoute(from);
}

function leave(focusTo) {
  const leaving = placeNow();
  if (!leaving) return;

  railCue(null);
  const undo = !!history.state && history.state.from === null;

  if (state.flipped) hideContact(!!focusTo); else hideSection(!!focusTo);

  if (focusTo && focusTo.isConnected) focusTo.focus();
  if (undo) history.back();
  else history.pushState({ key: null, from: leaving }, '', urlFor(null));
}

function applyRoute(from) {
  const key = routeKey();

  if (!key && location.hash) history.replaceState(history.state, '', urlFor(null));
  if (key === placeNow()) return;

  if (key === CONTACT.key) showContact();
  else if (key) showSection(key, from);
  else if (state.flipped) hideContact();
  else hideSection();
}

addEventListener('popstate', () => applyRoute());
addEventListener('hashchange', () => applyRoute());

function hintHairline() {
  const box = Math.min(el.hintIndex.offsetWidth, el.hintIndex.offsetHeight);
  if (!box) return;
  el.hintIndex.style.setProperty('--hint-hair', (100 / box).toFixed(4));
}
hintHairline();

measureNarrowPose();

new ResizeObserver(hintHairline).observe(el.hintIndex);

function bind(section) {
  const id = section.key;
  const node = $(section.hit);
  node.setAttribute('aria-label', `${section.label} — the ${section.part.toLowerCase()}`);
  node.addEventListener('click', () => goTo(id, node));
  node.addEventListener('mouseenter', () => { state.hover = id; render(); });

  node.addEventListener('focus', () => { state.hover = id; render(); });
  node.addEventListener('blur', () => {
    if (state.hover === id) { state.hover = null; render(); }
  });

  node.addEventListener('mouseleave', () => {
    if (state.hover === id) { state.hover = null; render(); }
  });
}

SECTIONS.forEach(bind);

const COARSE_POINTER = matchMedia('(hover: none)');
const TOUCH_CUE_MS = 600;
let touchCue = 0;

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

    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    e.preventDefault();

    if (placeNow() === key) { leave(node); return; }

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

document.addEventListener('mouseleave', () => {
  if (state.hover) { state.hover = null; render(); }
});
window.addEventListener('blur', () => {
  if (state.hover) { state.hover = null; render(); }
});

el.crown.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  el.crown.setPointerCapture(e.pointerId);
  clearTimeout(hack.timer);
  hack.timer = setTimeout(hackStart, HACK_MS);
});
el.crown.addEventListener('pointerup', () => {
  clearTimeout(hack.timer);
  hack.timer = 0;
  hackEnd(true);
});
el.crown.addEventListener('pointercancel', () => {
  clearTimeout(hack.timer);
  hack.timer = 0;
  hackEnd(false);
});
el.crown.addEventListener('contextmenu', (e) => e.preventDefault());
el.crown.addEventListener('click', () => {
  if (hack.swallow) { hack.swallow = false; return; }
  if (state.flipped) leave(); else goTo(CONTACT.key, el.crown);
});
el.crown.addEventListener('mouseenter', () => { state.hover = 'crown'; render(); });
el.crown.addEventListener('focus', () => { state.hover = 'crown'; render(); });

el.crown.addEventListener('mouseleave', () => {
  if (state.hover === 'crown') { state.hover = null; render(); }
});
el.crown.addEventListener('blur', () => {
  if (state.hover === 'crown') { state.hover = null; render(); }
});

let demoPumping = false;
function demoPump() {

  if (!state.demo && !SALUTE.size) { demoPumping = false; render(); return; }
  render();
  requestAnimationFrame(demoPump);
}

$('corrector').addEventListener('click', () => {
  state.touched = true;

  if (state.demo) return;
  const reduced = REDUCED_MOTION.matches;

  state.demo = { t0: Date.now(), reduced, reserveFrom: state.reserve };

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

const COPY_OK_MS = 1900;
const COPY_FAIL_MS = 4500;

const copyStatus = document.createElement('p');
copyStatus.className = 'rail-copy-status';
copyStatus.setAttribute('role', 'status');
document.body.append(copyStatus);
function announce(text) {

  copyStatus.textContent = '';
  setTimeout(() => { copyStatus.textContent = text; }, 0);
}

const COPY_MARK_GAP = 10;
const copyMark = document.createElement('p');
copyMark.className = 'copy-mark';
copyMark.setAttribute('aria-hidden', 'true');
document.body.append(copyMark);
let copyMarkTimer = 0;

function showCopyMark(trigger, ok) {

  clearTimeout(copyMarkTimer);

  const brass = trigger.classList.contains('cb-gear');
  copyMark.classList.toggle('copy-mark--brass', brass);
  copyMark.classList.toggle('copy-mark--rail', !brass);

  copyMark.textContent = ok ? 'COPIED' : 'COPY BLOCKED';

  const r = trigger.getBoundingClientRect();
  const m = copyMark.getBoundingClientRect();

  const margin = 0.05 * Math.min(window.innerWidth, window.innerHeight);
  let x = null;
  let y = 0;
  if (!brass) {

    const right = r.right + COPY_MARK_GAP;
    const left = r.left - COPY_MARK_GAP - m.width;
    if (right + m.width <= window.innerWidth - margin) x = right;
    else if (left >= margin) x = left;

    if (x !== null) y = r.top + r.height / 2 - m.height / 2;
  }
  if (x === null) {

    const lo = margin;
    const hi = window.innerWidth - margin - m.width;

    x = r.left + r.width / 2 - m.width / 2;
    x = lo > hi ? (window.innerWidth - m.width) / 2 : Math.min(Math.max(x, lo), hi);

    y = r.bottom + COPY_MARK_GAP;
    if (y + m.height > window.innerHeight - margin) y = r.top - COPY_MARK_GAP - m.height;
  }
  copyMark.style.left = `${Math.round(x)}px`;
  copyMark.style.top = `${Math.round(y)}px`;
  copyMark.classList.add('is-on');

  copyMarkTimer = setTimeout(() => { copyMark.classList.remove('is-on'); },
    ok ? COPY_OK_MS : COPY_FAIL_MS);
}

function copyByExecCommand(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');

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

  if (held && sel) { sel.removeAllRanges(); sel.addRange(held); }
  return ok;
}

function copyEmail(trigger) {
  const done = (ok) => {

    showCopyMark(trigger, ok);
    state.notice = ok
      ? { text: LINKS.email, until: Date.now() + COPY_OK_MS }
      : { text: `COPY BLOCKED — ${LINKS.email}`, until: Date.now() + COPY_FAIL_MS };

    announce(ok
      ? `Copied ${EMAIL} to the clipboard`
      : `Could not copy. The address is ${EMAIL} — it is printed under the watch to select by hand.`);
    render();
  };
  const clip = navigator.clipboard;
  if (clip && clip.writeText) {

    clip.writeText(EMAIL).then(() => done(true), () => done(copyByExecCommand(EMAIL)));
    return;
  }
  done(copyByExecCommand(EMAIL));
}

function onEmailActivate(e) {

  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();

  copyEmail(e.currentTarget);
}

for (const node of document.querySelectorAll('.cb-gear')) {
  const key = node.dataset.link;
  const href = node.getAttribute('href');
  if (href !== LINK_HREF[key]) {
    console.warn(`link train: ${key} disagrees with LINK_HREF (${href} vs ${LINK_HREF[key]})`);
  }
  if (key !== 'email') continue;

  node.setAttribute('aria-label', `Copy email address ${EMAIL}`);
  node.addEventListener('click', onEmailActivate);
}

railContactLinks.find((a) => a.dataset.link === 'email')
  .addEventListener('click', onEmailActivate);

document.querySelectorAll('[data-close]').forEach((node) =>
  node.addEventListener('click', () => leave())
);

const SHOT_MS = 5000;
const shotReduced = matchMedia('(prefers-reduced-motion: reduce)');
const shots = [];

for (const car of document.querySelectorAll('.shot-carousel')) {
  const frames = [...car.querySelectorAll('.shot-frames .feature-shot')];
  const dots = [...car.querySelectorAll('.shot-dot')];

  if (!frames.length || frames.length !== dots.length) {
    console.warn(`shot carousel: ${frames.length} frames against ${dots.length} dots`);
    continue;
  }

  const row = { car, frames, dots, at: 0, timer: 0, held: false };

  const show = (i) => {
    row.at = i;
    frames.forEach((f, n) => {
      f.toggleAttribute('data-current', n === i);

      if (n === i) f.removeAttribute('aria-hidden');
      else f.setAttribute('aria-hidden', 'true');

      const btn = f.closest('.shot-open');
      if (btn) btn.inert = n !== i;
    });
    dots.forEach((d, n) => {
      if (n === i) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
  };
  row.show = show;

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

  car.querySelector('.shot-index').addEventListener('keydown', (e) => {
    const at = dots.indexOf(document.activeElement);
    if (at < 0) return;
    const to = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: dots.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = (to + dots.length) % dots.length;
    show(next);
    dots[next].focus();
    row.arm();
  });

  show(Math.max(0, frames.findIndex((f) => f.hasAttribute('data-current'))));
  shots.push(row);
}

function shotsRun(on) {
  for (const row of shots) {
    if (row.running === on) continue;
    row.running = on;
    row.arm();
  }
  if (!on) closeZoom();
}

for (const list of document.querySelectorAll('[data-tabs]')) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

  if (!tabs.length || panels.some((p) => !p)) {
    console.warn(`misc tabs: ${tabs.length} tabs against ${panels.filter(Boolean).length} panels`);
    continue;
  }

  const show = (i) => {
    tabs.forEach((t, n) => {
      t.setAttribute('aria-selected', String(n === i));

      t.tabIndex = n === i ? 0 : -1;
    });

    panels.forEach((p, n) => { p.hidden = n !== i; });
  };

  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));

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

  show(Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')));
}

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

  big.alt = img.alt;
  zoomFrom = img.closest('.shot-open');
  zoom.showModal();

  for (const row of shots) row.sync();
}

function closeZoom() {
  if (!zoom || !zoom.open) return;
  zoom.close();
  afterZoom();
}

function afterZoom() {
  const big = zoom.querySelector('.shot-zoom-img');
  if (!zoomFrom && !big.hasAttribute('src')) return;

  big.removeAttribute('src');
  big.alt = '';
  const back = zoomFrom;
  zoomFrom = null;

  if (back && back.isConnected && !back.inert) back.focus({ preventScroll: true });

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

  const outsideShot = (e) => {
    const r = zoom.querySelector('.shot-zoom-img').getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right ||
           e.clientY < r.top  || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  zoom.addEventListener('pointerdown', (e) => { pressedOutside = outsideShot(e); });
  zoom.addEventListener('click', (e) => {
    const from = pressedOutside;

    pressedOutside = false;
    if (from && outsideShot(e)) closeZoom();
  });

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

    state.reserve = Math.min(1, RESERVE_REST + (1 - RESERVE_REST) * (node.scrollTop / max));
    render();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  leave();
});

const rig = {
  parts: [...document.querySelectorAll('.cb-rig-part')],
  anims: [],
  reduced: matchMedia('(prefers-reduced-motion: reduce)'),
  nudgeT: 0,
};

function rigNudgePaint() {

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

  el.flip.addEventListener('transitionend', () => setTimeout(fire, 120), { once: true });
  clearTimeout(rig.nudgeT);
  rig.nudgeT = setTimeout(fire, 2400);
  setTimeout(fire, 4500);
}

const rigSettled = Promise.allSettled(
  [...document.querySelectorAll('.cb-rig img')].map((i) =>
    i.complete ? Promise.resolve()
      : new Promise((res) => {

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

      a = img.animate(
        [{ transform: `rotate(${-cfg.amplitude_deg}deg)` },
         { transform: `rotate(${cfg.amplitude_deg}deg)` }],
        { duration: cfg.period_s * 500, iterations: Infinity,
          direction: 'alternate', easing: 'ease-in-out', iterationStart: 0.5 });
    }
    a.startTime = t0;
    if (hack.on) a.pause();
    rig.anims.push(a);
  }
}

function rigStop() {
  for (const a of rig.anims) a.cancel();
  rig.anims.length = 0;
}

let pointerAt = null;
const trackPointer = (e) => { pointerAt = { x: e.clientX, y: e.clientY }; };

function goLive() {
  try { localStorage.setItem('site-visited', '1'); } catch (e) {}
  removeEventListener('pointermove', trackPointer);
  el.flip.inert = false;

  el.rail.inert = false;

  if (!pointerAt) return;
  const under = document.elementFromPoint(pointerAt.x, pointerAt.y);
  const part = under && under.closest('.part-hit');
  if (part) part.dispatchEvent(new MouseEvent('mouseenter'));
}

const gate = el.flip.getAnimations().find((a) => a.animationName === 'partsLive');

if (!gate) goLive();
else {
  el.flip.inert = true;
  el.rail.inert = true;
  addEventListener('pointermove', trackPointer, { passive: true });
  gate.finished.then(goLive, goLive);
}

applyRoute();

arrived = true;

{
  const d = new Date();
  const into = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
                + d.getMilliseconds() / 1000) % 360;
  const node = $('stageGuilloche');
  node.style.animationDelay = `${-into.toFixed(3)}s`;

  node.style.setProperty('--guilloche-at', `${into.toFixed(1)}deg`);
}

function setTimeOfDayLight(hour) {
  const d = new Date();
  const h = hour ?? d.getHours() + d.getMinutes() / 60;
  const day = (Math.cos((h - 13) * Math.PI / 12) + 1) / 2;
  const warmth = 1 - day;
  const dim = warmth * warmth;
  const root = document.documentElement.style;
  root.setProperty('--tod-warmth', warmth.toFixed(3));
  root.setProperty('--tod-dim', dim.toFixed(3));
}
setTimeOfDayLight();
setInterval(() => setTimeOfDayLight(), 3600000);
window.setTimeOfDayLight = setTimeOfDayLight;

const BEAT = { mechanical: 1000 / 6, quartz: 1000 }[CONFIG.secondsMotion] || 0;
(function pump() {
  render();
  const now = Date.now();
  const wait = BEAT ? BEAT - (now % BEAT) : 100;
  setTimeout(pump, Math.max(8, Math.min(wait, 100)));
})();
